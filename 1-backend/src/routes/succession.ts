import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requirePermission, audit, resolveScope, visibleEmployeeIds } from '../auth.js';
import { computeResult } from './talent.js';

/**
 * KẾ HOẠCH KẾ THỪA (QĐ-21) — vị trí then chốt → ứng viên kế thừa → mức sẵn sàng.
 * Liên thông: ô 9-Box gần nhất · điểm 360° nhóm Lãnh đạo · tình trạng IDP của từng ứng viên.
 * Quy tắc gợi ý ứng viên [PROPOSAL]: nằm ở ô 6, 8, 9 của 9-Box gần nhất; HR quyết định cuối cùng.
 */
export const successionRouter = Router();

const CRITICALITY = ['CRITICAL', 'HIGH', 'MEDIUM'] as const;
const READINESS = ['READY_NOW', 'READY_1_2Y', 'READY_3Y'] as const;
const RISK = ['LOW', 'MEDIUM', 'HIGH'] as const;
const SUGGEST_BOXES = [9, 8, 6];

async function planScope(req: Request) {
  const scope = await resolveScope(req.user!);
  return scope === null ? {} : { OR: [{ orgUnitId: { in: scope } }, { orgUnitId: null }] };
}

/** Hồ sơ nhân tài tóm tắt của một nhân sự: 9-Box gần nhất, 360° Lãnh đạo, IDP gần nhất */
async function talentSnapshot(employeeIds: string[]) {
  const out = new Map<string, { box: number | null; boxCycle: string | null; calibrated: boolean; leadership: number | null; idpStatus: string | null; idpProgress: number | null }>();
  if (!employeeIds.length) return out;
  const reviews = await prisma.talentReview.findMany({ where: { employeeId: { in: employeeIds } }, orderBy: { cycle: 'desc' } });
  const idps = await prisma.idpPlan.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { cycle: 'desc' },
    include: { goals: { include: { actions: { select: { status: true } } } } },
  });
  const campaign = await prisma.assessmentCampaign.findFirst({ where: { status: 'CLOSED' }, orderBy: { endDate: 'desc' } });
  const parts = campaign
    ? new Set((await prisma.assessmentParticipant.findMany({ where: { campaignId: campaign.id, employeeId: { in: employeeIds } }, select: { employeeId: true } })).map((p) => p.employeeId))
    : new Set<string>();
  for (const id of employeeIds) {
    const r = reviews.find((x) => x.employeeId === id);
    const idp = idps.find((x) => x.employeeId === id);
    const acts = idp?.goals.flatMap((g) => g.actions) ?? [];
    let leadership: number | null = null;
    if (campaign && parts.has(id)) leadership = (await computeResult(campaign.id, id))?.summary.leadership ?? null;
    out.set(id, {
      box: r?.box ?? null, boxCycle: r?.cycle ?? null, calibrated: r?.calibrated ?? false, leadership,
      idpStatus: idp?.status ?? null,
      idpProgress: idp ? (acts.length ? Math.round((acts.filter((a) => a.status === 'DONE').length / acts.length) * 100) : 0) : null,
    });
  }
  return out;
}

const empSelect = { id: true, employeeCode: true, fullName: true, jobTitle: true, jobLevelCode: true } as const;

successionRouter.get('/succession', authenticate, requirePermission('talent:review', 'assessment:manage'), async (req, res) => {
  const plans = await prisma.successionPlan.findMany({
    where: await planScope(req),
    include: {
      orgUnit: { select: { code: true, name: true } },
      incumbent: { select: empSelect },
      candidates: { include: { employee: { select: empSelect } } },
    },
    orderBy: [{ criticality: 'asc' }, { positionTitle: 'asc' }],
  });
  const snap = await talentSnapshot([...new Set(plans.flatMap((p) => p.candidates.map((c) => c.employeeId)))]);
  const items = plans.map((p) => ({
    ...p,
    candidates: p.candidates
      .map((c) => ({ ...c, talent: snap.get(c.employeeId) ?? null }))
      .sort((a, b) => READINESS.indexOf(a.readiness as never) - READINESS.indexOf(b.readiness as never)),
    coverage: {
      readyNow: p.candidates.filter((c) => c.readiness === 'READY_NOW').length,
      ready12: p.candidates.filter((c) => c.readiness === 'READY_1_2Y').length,
      total: p.candidates.length,
    },
  }));
  const crit = items.filter((p) => p.criticality === 'CRITICAL');
  res.json({
    items,
    metrics: {
      plans: items.length,
      withReadyNow: items.filter((p) => p.coverage.readyNow > 0).length,
      withoutCandidate: items.filter((p) => p.coverage.total === 0).length,
      criticalUncovered: crit.filter((p) => p.coverage.readyNow === 0).length,
      // Bench strength = tỷ lệ vị trí có ít nhất 1 ứng viên sẵn sàng ngay hoặc trong 1–2 năm
      benchStrength: items.length ? Math.round((items.filter((p) => p.coverage.readyNow + p.coverage.ready12 > 0).length / items.length) * 100) : 0,
    },
    rule: 'Gợi ý ứng viên [PROPOSAL]: nhân sự ở ô 9, 8, 6 của 9-Box gần nhất, ưu tiên ô cao hơn rồi điểm 360° Lãnh đạo. Mức sẵn sàng do HR và quản lý quyết định.',
  });
});

const PlanInput = z.object({
  positionTitle: z.string().trim().min(3).max(200),
  orgUnitCode: z.string().optional().nullable(),
  jobRoleCode: z.string().optional().nullable(),
  incumbentEmployeeCode: z.string().optional().nullable(),
  criticality: z.enum(CRITICALITY).optional(),
  vacancyRisk: z.enum(RISK).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

async function resolvePlanRefs(d: z.infer<typeof PlanInput>) {
  const unit = d.orgUnitCode ? await prisma.orgUnit.findUnique({ where: { code: d.orgUnitCode } }) : null;
  if (d.orgUnitCode && !unit) return { error: `Không có đơn vị ${d.orgUnitCode}` };
  const inc = d.incumbentEmployeeCode ? await prisma.employee.findUnique({ where: { employeeCode: d.incumbentEmployeeCode } }) : null;
  if (d.incumbentEmployeeCode && !inc) return { error: `Không có nhân sự ${d.incumbentEmployeeCode}` };
  if (d.jobRoleCode && !(await prisma.jobRole.findUnique({ where: { code: d.jobRoleCode } }))) return { error: `Không có vai trò ${d.jobRoleCode}` };
  return { unitId: unit?.id ?? null, incumbentId: inc?.id ?? null };
}

successionRouter.post('/succession', authenticate, requirePermission('talent:review'), async (req, res) => {
  const body = PlanInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  const refs = await resolvePlanRefs(body.data);
  if ('error' in refs) return res.status(400).json({ error: refs.error });
  const plan = await prisma.successionPlan.create({
    data: {
      positionTitle: body.data.positionTitle, orgUnitId: refs.unitId, jobRoleCode: body.data.jobRoleCode ?? null,
      incumbentEmployeeId: refs.incumbentId, criticality: body.data.criticality ?? 'HIGH',
      vacancyRisk: body.data.vacancyRisk ?? null, notes: body.data.notes ?? null, createdByEmail: req.user!.email,
    },
  });
  await audit(req, 'CREATE', 'SuccessionPlan', plan.id, { entityName: plan.positionTitle });
  res.status(201).json(plan);
});

successionRouter.patch('/succession/:id', authenticate, requirePermission('talent:review'), async (req, res) => {
  const body = PlanInput.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const before = await prisma.successionPlan.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
  const refs = await resolvePlanRefs({ positionTitle: before.positionTitle, ...body.data });
  if ('error' in refs) return res.status(400).json({ error: refs.error });
  const after = await prisma.successionPlan.update({
    where: { id: before.id },
    data: {
      ...(body.data.positionTitle ? { positionTitle: body.data.positionTitle } : {}),
      ...(body.data.orgUnitCode !== undefined ? { orgUnitId: refs.unitId } : {}),
      ...(body.data.incumbentEmployeeCode !== undefined ? { incumbentEmployeeId: refs.incumbentId } : {}),
      ...(body.data.jobRoleCode !== undefined ? { jobRoleCode: body.data.jobRoleCode } : {}),
      ...(body.data.criticality ? { criticality: body.data.criticality } : {}),
      ...(body.data.vacancyRisk !== undefined ? { vacancyRisk: body.data.vacancyRisk } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
    },
  });
  await audit(req, 'UPDATE', 'SuccessionPlan', after.id, { entityName: after.positionTitle, newValues: body.data });
  res.json(after);
});

successionRouter.delete('/succession/:id', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const p = await prisma.successionPlan.findUnique({ where: { id: req.params.id }, include: { candidates: true } });
  if (!p) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
  await prisma.successionPlan.delete({ where: { id: p.id } });
  await audit(req, 'DELETE', 'SuccessionPlan', p.id, { entityName: p.positionTitle, oldValues: p });
  res.json({ ok: true });
});

successionRouter.get('/succession/:id/suggestions', authenticate, requirePermission('talent:review'), async (req, res) => {
  const p = await prisma.successionPlan.findUnique({ where: { id: req.params.id }, include: { candidates: true } });
  if (!p) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
  const visible = await visibleEmployeeIds(req.user!);
  const exclude = new Set([...p.candidates.map((c) => c.employeeId), ...(p.incumbentEmployeeId ? [p.incumbentEmployeeId] : [])]);
  const latest = await prisma.talentReview.findMany({ where: { box: { in: SUGGEST_BOXES } }, orderBy: { cycle: 'desc' } });
  const seen = new Set<string>();
  const picks = latest.filter((r) => {
    if (seen.has(r.employeeId)) return false;
    seen.add(r.employeeId);
    return !exclude.has(r.employeeId) && (visible === null || visible.has(r.employeeId));
  });
  const emps = await prisma.employee.findMany({ where: { id: { in: picks.map((r) => r.employeeId) }, status: 'ACTIVE' }, select: empSelect });
  const snap = await talentSnapshot(emps.map((e) => e.id));
  const items = emps
    .map((e) => ({ employee: e, talent: snap.get(e.id)! }))
    .sort((a, b) => (b.talent.box ?? 0) - (a.talent.box ?? 0) || (b.talent.leadership ?? 0) - (a.talent.leadership ?? 0));
  res.json({ items });
});

const CandInput = z.object({
  employeeCode: z.string().optional(),
  employeeId: z.string().optional(),
  readiness: z.enum(READINESS),
  riskOfLoss: z.enum(RISK).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

successionRouter.post('/succession/:id/candidates', authenticate, requirePermission('talent:review'), async (req, res) => {
  const body = CandInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const p = await prisma.successionPlan.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Không tìm thấy kế hoạch' });
  const emp = body.data.employeeId
    ? await prisma.employee.findUnique({ where: { id: body.data.employeeId } })
    : body.data.employeeCode ? await prisma.employee.findUnique({ where: { employeeCode: body.data.employeeCode } }) : null;
  if (!emp) return res.status(400).json({ error: 'Không tìm thấy nhân sự' });
  if (emp.id === p.incumbentEmployeeId) return res.status(400).json({ error: 'Người đang giữ vị trí không là ứng viên kế thừa' });
  const visible = await visibleEmployeeIds(req.user!);
  if (visible !== null && !visible.has(emp.id)) return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi của bạn' });
  const exists = await prisma.successionCandidate.findUnique({ where: { planId_employeeId: { planId: p.id, employeeId: emp.id } } });
  if (exists) return res.status(409).json({ error: 'Nhân sự đã là ứng viên của vị trí này' });
  const c = await prisma.successionCandidate.create({
    data: { planId: p.id, employeeId: emp.id, readiness: body.data.readiness, riskOfLoss: body.data.riskOfLoss ?? 'MEDIUM', notes: body.data.notes ?? null },
  });
  await audit(req, 'CREATE', 'SuccessionCandidate', c.id, { entityName: `${p.positionTitle} ← ${emp.employeeCode}`, newValues: { readiness: c.readiness } });
  res.status(201).json(c);
});

successionRouter.patch('/succession-candidates/:id', authenticate, requirePermission('talent:review'), async (req, res) => {
  const body = CandInput.omit({ employeeCode: true, employeeId: true }).partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const before = await prisma.successionCandidate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
  const after = await prisma.successionCandidate.update({ where: { id: before.id }, data: body.data });
  await audit(req, 'UPDATE', 'SuccessionCandidate', after.id, {
    entityName: 'Ứng viên kế thừa',
    oldValues: { readiness: before.readiness, riskOfLoss: before.riskOfLoss },
    newValues: { readiness: after.readiness, riskOfLoss: after.riskOfLoss },
  });
  res.json(after);
});

successionRouter.delete('/succession-candidates/:id', authenticate, requirePermission('talent:review'), async (req, res) => {
  const c = await prisma.successionCandidate.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
  await prisma.successionCandidate.delete({ where: { id: c.id } });
  await audit(req, 'DELETE', 'SuccessionCandidate', c.id, { entityName: 'Ứng viên kế thừa', oldValues: c });
  res.json({ ok: true });
});
