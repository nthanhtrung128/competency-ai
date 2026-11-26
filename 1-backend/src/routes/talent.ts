import { Router, type Request } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { z } from 'zod';
import type { Prisma, RaterRelation } from '@prisma/client';
import { currentWorkspace, prisma } from '../db.js';
import { authenticate, requirePermission, audit, visibleEmployeeIds } from '../auth.js';

/**
 * QĐ-06 — Đánh giá 360°, 9-Box, IDP trên dữ liệu thật, liên thông với nhau:
 *   Chiến dịch 360° (chốt phiên bản năng lực) → phiếu đánh giá → kết quả có bảo vệ ẩn danh
 *   → gợi ý trục Tiềm năng cho 9-Box → khoảng cách so với yêu cầu vai trò → mục tiêu IDP (70-20-10).
 */
export const talentRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ================================================================ tiện ích

type Snap = Array<{ code: string; name: string; competencyId: string; versionId: string; category: string }>;
type Ind = { level: number; indicator: string };

const RELATION_VI: Record<string, RaterRelation> = {
  SELF: 'SELF', 'TỰ ĐÁNH GIÁ': 'SELF', 'BẢN THÂN': 'SELF',
  MANAGER: 'MANAGER', 'QUẢN LÝ': 'MANAGER', 'QUẢN LÝ TRỰC TIẾP': 'MANAGER', 'CẤP TRÊN': 'MANAGER',
  PEER: 'PEER', 'ĐỒNG NGHIỆP': 'PEER',
  DIRECT_REPORT: 'DIRECT_REPORT', 'CẤP DƯỚI': 'DIRECT_REPORT', 'NHÂN VIÊN': 'DIRECT_REPORT',
  OTHER: 'OTHER', 'KHÁC': 'OTHER',
};

const fail = (status: number, message: string) => ({ err: { status, message } }) as { err: { status: number; message: string } };

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

async function canSee(req: Request, employeeId: string) {
  const ids = await visibleEmployeeIds(req.user!);
  return ids === null || ids.has(employeeId);
}

function isManage(req: Request) {
  return req.user!.permissions.includes('assessment:manage');
}

/** Năng lực mặc định cho 360° cấp quản lý: Cốt lõi + Lãnh đạo ĐÃ BAN HÀNH (bỏ qua bản nháp như CO7–CO9) */
async function defaultCompetencyCodes() {
  const rows = await prisma.competency.findMany({
    where: { isActive: true, currentVersionId: { not: null }, category: { code: { in: ['COR', 'LEA'] } } },
    select: { code: true },
    orderBy: { code: 'asc' },
  });
  return rows.map((r) => r.code);
}

/** Chốt phiên bản đang hiệu lực của từng năng lực khi mở chiến dịch */
async function buildSnapshot(codes: string[]) {
  const comps = await prisma.competency.findMany({
    where: { code: { in: codes } },
    include: { category: { select: { code: true } } },
  });
  const problems: string[] = [];
  const snap: Snap = [];
  for (const code of codes) {
    const c = comps.find((x) => x.code === code);
    if (!c) { problems.push(`${code}: không có trong Từ điển`); continue; }
    if (!c.currentVersionId) { problems.push(`${code}: chưa có phiên bản ban hành`); continue; }
    if (!c.scaleId) { problems.push(`${code}: thuộc nhóm không chấm điểm`); continue; }
    snap.push({ code, name: c.name, competencyId: c.id, versionId: c.currentVersionId, category: c.category.code });
  }
  return { snap, problems };
}

/** Yêu cầu năng lực của vai trò mà nhân sự đang đảm nhận */
async function roleRequirements(jobRoleCode: string | null) {
  if (!jobRoleCode) return new Map<string, { level: number; status: string }>();
  const role = await prisma.jobRole.findUnique({ where: { code: jobRoleCode }, include: { requirements: true } });
  const m = new Map<string, { level: number; status: string }>();
  for (const q of role?.requirements ?? []) {
    if (currentWorkspace() && (!role?.isActive || q.mappingStatus !== 'APPROVED')) continue;
    if (!q.competencyId) continue;
    const prev = m.get(q.competencyId);
    if (!prev || q.requiredLevel > prev.level) m.set(q.competencyId, { level: q.requiredLevel, status: q.mappingStatus });
  }
  return m;
}

/** Tổng hợp kết quả một người được đánh giá — có bảo vệ ẩn danh nhóm Đồng nghiệp / Cấp dưới */
export async function computeResult(campaignId: string, employeeId: string) {
  const campaign = await prisma.assessmentCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  const participant = await prisma.assessmentParticipant.findUnique({
    where: { campaignId_employeeId: { campaignId, employeeId } },
    include: {
      employee: { select: { id: true, employeeCode: true, fullName: true, jobTitle: true, jobRoleCode: true, jobLevelCode: true } },
      raters: { include: { scores: true } },
    },
  });
  if (!participant) return null;
  const snap = (campaign.snapshot ?? []) as Snap;
  const minN = campaign.minRatersForAnonymity;
  const req = await roleRequirements(participant.employee.jobRoleCode);
  const submitted = participant.raters.filter((r) => r.status === 'SUBMITTED');
  const countBy = (rel: RaterRelation) => submitted.filter((r) => r.relation === rel).length;
  const hidden = {
    PEER: countBy('PEER') > 0 && countBy('PEER') < minN,
    DIRECT_REPORT: countBy('DIRECT_REPORT') > 0 && countBy('DIRECT_REPORT') < minN,
  };

  const competencies = snap.map((s) => {
    const by: Record<string, number[]> = { SELF: [], MANAGER: [], PEER: [], DIRECT_REPORT: [], OTHER: [] };
    for (const r of submitted) {
      const sc = r.scores.find((x) => x.competencyId === s.competencyId);
      if (sc?.level) by[r.relation].push(sc.level);
    }
    // "Người khác" = mọi nguồn trừ tự đánh giá; nhóm bị ẩn vẫn được tính vào trung bình chung (không lộ từng người)
    const others = [...by.MANAGER, ...by.PEER, ...by.DIRECT_REPORT, ...by.OTHER];
    const othersAvg = avg(others);
    const r = req.get(s.competencyId);
    return {
      code: s.code,
      name: s.name,
      category: s.category,
      self: avg(by.SELF),
      manager: avg(by.MANAGER),
      peer: hidden.PEER ? null : avg(by.PEER),
      directReport: hidden.DIRECT_REPORT ? null : avg(by.DIRECT_REPORT),
      others: othersAvg,
      othersCount: others.length,
      required: r?.level ?? null,
      requiredStatus: r?.status ?? null,
      gap: r && othersAvg !== null ? Math.round((r.level - othersAvg) * 100) / 100 : null,
      blindSpot: avg(by.SELF) !== null && othersAvg !== null ? Math.round((avg(by.SELF)! - othersAvg) * 100) / 100 : null,
    };
  });

  const catAvg = (cat: string) => avg(competencies.filter((c) => c.category === cat && c.others !== null).map((c) => c.others!));
  return {
    campaign: { id: campaign.id, code: campaign.code, name: campaign.name, status: campaign.status, minRatersForAnonymity: minN },
    employee: participant.employee,
    raters: {
      total: participant.raters.length,
      submitted: submitted.length,
      byRelation: (['SELF', 'MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER'] as RaterRelation[]).map((rel) => ({
        relation: rel,
        invited: participant.raters.filter((r) => r.relation === rel).length,
        submitted: countBy(rel),
      })),
      hiddenGroups: Object.entries(hidden).filter(([, v]) => v).map(([k]) => k),
    },
    summary: { core: catAvg('COR'), leadership: catAvg('LEA'), functional: catAvg('FUN') },
    competencies,
  };
}

/** Gợi ý trục Tiềm năng 9-Box từ điểm 360° nhóm Lãnh đạo. [PROPOSAL] ngưỡng 2,5 / 3,5 — HR hiệu chỉnh */
export function suggestPotential(leadershipAvg: number | null) {
  if (leadershipAvg === null) return null;
  return leadershipAvg >= 3.5 ? 3 : leadershipAvg >= 2.5 ? 2 : 1;
}

// ================================================================ CHIẾN DỊCH 360°

talentRouter.get('/campaigns', authenticate, requirePermission('assessment:manage', 'assessment:read_results'), async (_req, res) => {
  const list = await prisma.assessmentCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { participants: { include: { raters: { select: { status: true } } } } },
  });
  res.json({
    campaigns: list.map((c) => {
      const raters = c.participants.flatMap((p) => p.raters);
      return {
        id: c.id, code: c.code, name: c.name, description: c.description, status: c.status,
        startDate: c.startDate, endDate: c.endDate, competencyCodes: c.competencyCodes,
        minRatersForAnonymity: c.minRatersForAnonymity,
        participants: c.participants.length,
        raters: raters.length,
        submitted: raters.filter((r) => r.status === 'SUBMITTED').length,
      };
    }),
  });
});

const CampaignInput = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  competencyCodes: z.array(z.string()).optional(),
  minRatersForAnonymity: z.number().int().min(1).max(10).optional(),
});

talentRouter.post('/campaigns', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const body = CampaignInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  const codes = body.data.competencyCodes?.length ? body.data.competencyCodes : await defaultCompetencyCodes();
  const { problems } = await buildSnapshot(codes);
  if (problems.length) return res.status(400).json({ error: `Không dùng được: ${problems.join('; ')}` });
  const exists = await prisma.assessmentCampaign.findUnique({ where: { code: body.data.code } });
  if (exists) return res.status(409).json({ error: `Mã chiến dịch ${body.data.code} đã tồn tại` });
  const c = await prisma.assessmentCampaign.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      description: body.data.description ?? null,
      startDate: body.data.startDate ? new Date(body.data.startDate) : null,
      endDate: body.data.endDate ? new Date(body.data.endDate) : null,
      competencyCodes: codes,
      minRatersForAnonymity: body.data.minRatersForAnonymity ?? 3,
      createdByEmail: req.user!.email,
    },
  });
  await audit(req, 'CREATE', 'AssessmentCampaign', c.id, { entityName: c.code, newValues: { codes } });
  res.status(201).json(c);
});

talentRouter.get('/campaigns/:id', authenticate, requirePermission('assessment:manage', 'assessment:read_results'), async (req, res) => {
  const c = await prisma.assessmentCampaign.findUnique({
    where: { id: req.params.id },
    include: {
      participants: {
        include: {
          employee: { select: { id: true, employeeCode: true, fullName: true, jobTitle: true, orgUnit: { select: { code: true, name: true } } } },
          raters: {
            include: { raterEmployee: { select: { employeeCode: true, fullName: true } } },
            orderBy: { relation: 'asc' },
          },
        },
      },
    },
  });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  const visible = await visibleEmployeeIds(req.user!);
  const manage = isManage(req);
  const participants = c.participants
    .filter((p) => manage || visible === null || visible.has(p.employeeId))
    .map((p) => ({
      id: p.id,
      employee: p.employee,
      raters: p.raters.map((r) => ({
        id: r.id,
        relation: r.relation,
        status: r.status,
        source: r.source,
        submittedAt: r.submittedAt,
        // Người không quản trị chiến dịch không thấy danh tính người đánh giá nhóm Đồng nghiệp / Cấp dưới
        rater: manage || r.relation === 'SELF' || r.relation === 'MANAGER'
          ? r.raterEmployee ?? (r.raterLabel ? { employeeCode: '', fullName: r.raterLabel } : null)
          : null,
      })),
    }));
  res.json({ ...c, participants });
});

/**
 * Thêm người được đánh giá + tự sinh người đánh giá theo quan hệ báo cáo:
 * SELF, MANAGER (managerId), DIRECT_REPORT (người có managerId = họ), PEER (cùng quản lý, tối đa maxPeers).
 */
talentRouter.post('/campaigns/:id/participants', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const body = z
    .object({
      employeeCodes: z.array(z.string()).optional(),
      orgUnitCodes: z.array(z.string()).optional(),
      jobLevelCodes: z.array(z.string()).optional(),
      onlyManagers: z.boolean().optional(),
      maxPeers: z.number().int().min(0).max(10).optional(),
    })
    .safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  const c = await prisma.assessmentCampaign.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  if (c.status === 'CLOSED') return res.status(409).json({ error: 'Chiến dịch đã đóng' });

  const all = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, employeeCode: true, managerId: true, orgUnitId: true, jobLevelCode: true, orgUnit: { select: { code: true } } },
  });
  const reportsOf = new Map<string, string[]>();
  for (const e of all) if (e.managerId) reportsOf.set(e.managerId, [...(reportsOf.get(e.managerId) ?? []), e.id]);

  // phạm vi đơn vị: gồm cả đơn vị con
  let unitIds: Set<string> | null = null;
  if (body.data.orgUnitCodes?.length) {
    const units = await prisma.orgUnit.findMany({ select: { id: true, parentId: true, code: true } });
    const kids = new Map<string, string[]>();
    for (const u of units) if (u.parentId) kids.set(u.parentId, [...(kids.get(u.parentId) ?? []), u.id]);
    unitIds = new Set();
    const walk = (id: string) => { unitIds!.add(id); for (const k of kids.get(id) ?? []) walk(k); };
    for (const u of units.filter((x) => body.data.orgUnitCodes!.includes(x.code))) walk(u.id);
  }

  const targets = all.filter((e) =>
    (!body.data.employeeCodes?.length || body.data.employeeCodes.includes(e.employeeCode)) &&
    (!unitIds || (e.orgUnitId && unitIds.has(e.orgUnitId))) &&
    (!body.data.jobLevelCodes?.length || (e.jobLevelCode && body.data.jobLevelCodes.includes(e.jobLevelCode))) &&
    (!body.data.onlyManagers || (reportsOf.get(e.id)?.length ?? 0) > 0),
  );
  if (!targets.length) return res.status(400).json({ error: 'Không có nhân sự nào khớp điều kiện' });

  const maxPeers = body.data.maxPeers ?? 4;
  let addedParticipants = 0;
  let addedRaters = 0;
  await prisma.$transaction(async (tx) => {
    for (const e of targets) {
      const existing = await tx.assessmentParticipant.findUnique({
        where: { campaignId_employeeId: { campaignId: c.id, employeeId: e.id } },
      });
      if (existing) continue;
      const p = await tx.assessmentParticipant.create({ data: { campaignId: c.id, employeeId: e.id } });
      addedParticipants++;
      const raters: Prisma.AssessmentRaterCreateManyInput[] = [{ participantId: p.id, raterEmployeeId: e.id, relation: 'SELF' }];
      if (e.managerId) raters.push({ participantId: p.id, raterEmployeeId: e.managerId, relation: 'MANAGER' });
      for (const r of reportsOf.get(e.id) ?? []) raters.push({ participantId: p.id, raterEmployeeId: r, relation: 'DIRECT_REPORT' });
      const peers = e.managerId ? (reportsOf.get(e.managerId) ?? []).filter((x) => x !== e.id).slice(0, maxPeers) : [];
      for (const r of peers) raters.push({ participantId: p.id, raterEmployeeId: r, relation: 'PEER' });
      await tx.assessmentRater.createMany({ data: raters });
      addedRaters += raters.length;
    }
  });
  await audit(req, 'UPDATE', 'AssessmentCampaign', c.id, {
    entityName: c.code,
    newValues: { addedParticipants, addedRaters },
  });
  res.json({ addedParticipants, addedRaters, skipped: targets.length - addedParticipants });
});

talentRouter.post('/campaigns/:id/raters', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const body = z
    .object({ participantId: z.string(), raterEmployeeCode: z.string(), relation: z.enum(['SELF', 'MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER']) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const rater = await prisma.employee.findUnique({ where: { employeeCode: body.data.raterEmployeeCode } });
  if (!rater) return res.status(400).json({ error: `Không có nhân sự mã ${body.data.raterEmployeeCode}` });
  const p = await prisma.assessmentParticipant.findUnique({ where: { id: body.data.participantId } });
  if (!p || p.campaignId !== req.params.id) return res.status(404).json({ error: 'Không tìm thấy người được đánh giá' });
  const r = await prisma.assessmentRater.create({
    data: { participantId: p.id, raterEmployeeId: rater.id, relation: body.data.relation },
  });
  res.status(201).json(r);
});

talentRouter.delete('/raters/:id', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const r = await prisma.assessmentRater.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  if (r.status === 'SUBMITTED') return res.status(409).json({ error: 'Phiếu đã nộp — không xoá được' });
  await prisma.assessmentRater.delete({ where: { id: r.id } });
  res.json({ ok: true });
});

talentRouter.post('/campaigns/:id/open', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const c = await prisma.assessmentCampaign.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { participants: true } } },
  });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  if (c.status !== 'DRAFT') return res.status(409).json({ error: `Chiến dịch đang ${c.status}` });
  if (c._count.participants === 0) return res.status(400).json({ error: 'Chưa có người được đánh giá' });
  const { snap, problems } = await buildSnapshot(c.competencyCodes as string[]);
  if (problems.length) return res.status(400).json({ error: `Không mở được: ${problems.join('; ')}` });
  const after = await prisma.assessmentCampaign.update({
    where: { id: c.id },
    data: { status: 'OPEN', snapshot: snap as never, startDate: c.startDate ?? new Date() },
  });
  await audit(req, 'UPDATE', 'AssessmentCampaign', c.id, { entityName: c.code, newValues: { status: 'OPEN', competencies: snap.length } });
  res.json(after);
});

talentRouter.post('/campaigns/:id/close', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const c = await prisma.assessmentCampaign.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  if (c.status !== 'OPEN') return res.status(409).json({ error: `Chiến dịch đang ${c.status}` });
  const after = await prisma.assessmentCampaign.update({
    where: { id: c.id },
    data: { status: 'CLOSED', endDate: c.endDate ?? new Date() },
  });
  await audit(req, 'UPDATE', 'AssessmentCampaign', c.id, { entityName: c.code, newValues: { status: 'CLOSED' } });
  res.json(after);
});

// ================================================================ PHIẾU CỦA TÔI

talentRouter.get('/my/rater-tasks', authenticate, async (req, res) => {
  if (!req.user!.employeeId) return res.json({ linked: false, tasks: [] });
  const tasks = await prisma.assessmentRater.findMany({
    where: { raterEmployeeId: req.user!.employeeId, participant: { campaign: { status: 'OPEN' } } },
    include: {
      participant: {
        include: {
          campaign: { select: { id: true, code: true, name: true, endDate: true } },
          employee: { select: { employeeCode: true, fullName: true, jobTitle: true } },
        },
      },
      _count: { select: { scores: true } },
    },
    orderBy: { status: 'asc' },
  });
  res.json({
    linked: true,
    tasks: tasks.map((t) => ({
      id: t.id, relation: t.relation, status: t.status, submittedAt: t.submittedAt, answered: t._count.scores,
      campaign: t.participant.campaign, evaluatee: t.participant.employee,
    })),
  });
});

async function loadTask(req: Request, raterId: string) {
  const t = await prisma.assessmentRater.findUnique({
    where: { id: raterId },
    include: {
      scores: true,
      participant: { include: { campaign: true, employee: { select: { employeeCode: true, fullName: true, jobTitle: true } } } },
    },
  });
  if (!t) return fail(404, 'Không tìm thấy phiếu');
  const own = !!req.user!.employeeId && t.raterEmployeeId === req.user!.employeeId;
  if (!own && !isManage(req)) return fail(403, 'Phiếu này không phải của bạn');
  return { err: null, t, own };
}

talentRouter.get('/rater-tasks/:id', authenticate, async (req, res) => {
  const r = await loadTask(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const { t } = r;
  const snap = (t.participant.campaign.snapshot ?? []) as Snap;
  const versions = await prisma.competencyVersion.findMany({ where: { id: { in: snap.map((s) => s.versionId) } } });
  res.json({
    id: t.id,
    relation: t.relation,
    status: t.status,
    campaign: { id: t.participant.campaign.id, code: t.participant.campaign.code, name: t.participant.campaign.name, status: t.participant.campaign.status },
    evaluatee: t.participant.employee,
    competencies: snap.map((s) => {
      const v = versions.find((x) => x.id === s.versionId);
      const inds = ((v?.levels ?? {}) as { behavioralIndicators?: Ind[] }).behavioralIndicators ?? [];
      const sc = t.scores.find((x) => x.competencyId === s.competencyId);
      return {
        code: s.code, name: s.name, category: s.category, definition: v?.definition ?? '',
        anchors: [1, 2, 3, 4, 5].map((l) => ({ level: l, text: inds.find((b) => b.level === l)?.indicator ?? null })),
        level: sc?.level ?? null, evidence: sc?.evidence ?? null, answered: !!sc,
      };
    }),
  });
});

const ScoresInput = z.object({
  scores: z.array(z.object({ code: z.string(), level: z.number().int().min(1).max(5).nullable(), evidence: z.string().max(2000).optional() })),
  submit: z.boolean().optional(),
});

talentRouter.put('/rater-tasks/:id', authenticate, async (req, res) => {
  const body = ScoresInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  const r = await loadTask(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const { t } = r;
  if (t.participant.campaign.status !== 'OPEN') return res.status(409).json({ error: 'Chiến dịch không ở trạng thái mở' });
  if (t.status === 'SUBMITTED' && !isManage(req)) return res.status(409).json({ error: 'Phiếu đã nộp' });
  const snap = (t.participant.campaign.snapshot ?? []) as Snap;
  const byCode = new Map(snap.map((s) => [s.code, s]));
  const unknown = body.data.scores.filter((s) => !byCode.has(s.code)).map((s) => s.code);
  if (unknown.length) return res.status(400).json({ error: `Năng lực không thuộc chiến dịch: ${unknown.join(', ')}` });

  await prisma.$transaction(async (tx) => {
    for (const s of body.data.scores) {
      const meta = byCode.get(s.code)!;
      await tx.assessmentScore.upsert({
        where: { raterId_competencyId: { raterId: t.id, competencyId: meta.competencyId } },
        create: { raterId: t.id, competencyId: meta.competencyId, versionId: meta.versionId, level: s.level, evidence: s.evidence ?? null },
        update: { level: s.level, evidence: s.evidence ?? null, versionId: meta.versionId },
      });
    }
  });

  if (body.data.submit) {
    const answered = await prisma.assessmentScore.count({ where: { raterId: t.id } });
    if (answered < snap.length) {
      return res.status(400).json({ error: `Còn ${snap.length - answered} năng lực chưa trả lời (chọn mức hoặc "không đủ cơ sở")` });
    }
    await prisma.assessmentRater.update({
      where: { id: t.id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), source: r.own ? 'APP' : 'IMPORT', enteredByEmail: r.own ? null : req.user!.email },
    });
  }
  res.json({ ok: true, submitted: !!body.data.submit });
});

/**
 * HR nhập hộ phiếu 360° từ file (QĐ-07: người chưa có tài khoản — vd nhân viên đánh giá cấp trên).
 * Cột: ma_phieu, ma_nv_duoc_danh_gia, quan_he, ma_nv_nguoi_danh_gia (tuỳ chọn), ma_nang_luc, muc (1-5, trống = không đủ cơ sở), nhan_xet
 * ?commit=1 để ghi thật; mặc định chỉ kiểm tra.
 */
talentRouter.post('/campaigns/:id/import-responses', authenticate, requirePermission('assessment:manage'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn file CSV' });
  const commit = req.query.commit === '1';
  const c = await prisma.assessmentCampaign.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: 'Không tìm thấy chiến dịch' });
  if (c.status !== 'OPEN') return res.status(409).json({ error: 'Chỉ nhập phiếu khi chiến dịch đang mở' });
  const snap = (c.snapshot ?? []) as Snap;
  const byCode = new Map(snap.map((s) => [s.code, s]));

  const text = req.file.buffer.toString('utf-8').replace(/^﻿/, '');
  const rows = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
  const emps = new Map((await prisma.employee.findMany({ select: { id: true, employeeCode: true } })).map((e) => [e.employeeCode, e.id]));
  const parts = new Map(
    (await prisma.assessmentParticipant.findMany({ where: { campaignId: c.id }, select: { id: true, employeeId: true } })).map((p) => [p.employeeId, p.id]),
  );

  type Sheet = { key: string; participantId: string; raterEmployeeId: string | null; relation: RaterRelation; scores: Map<string, { level: number | null; evidence: string | null }> };
  const sheets = new Map<string, Sheet>();
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const sheetKey = (r.ma_phieu ?? '').trim();
    const evalId = emps.get((r.ma_nv_duoc_danh_gia ?? '').trim());
    const relation = RELATION_VI[(r.quan_he ?? '').trim().toUpperCase()];
    const raterCode = (r.ma_nv_nguoi_danh_gia ?? '').trim();
    const comp = byCode.get((r.ma_nang_luc ?? '').trim());
    const lvRaw = (r.muc ?? '').trim();
    const level = lvRaw === '' ? null : Number(lvRaw);
    if (!sheetKey) return errors.push(`Dòng ${line}: thiếu ma_phieu`);
    if (!evalId) return errors.push(`Dòng ${line}: không có nhân sự được đánh giá "${r.ma_nv_duoc_danh_gia}"`);
    const pid = parts.get(evalId);
    if (!pid) return errors.push(`Dòng ${line}: ${r.ma_nv_duoc_danh_gia} không thuộc chiến dịch`);
    if (!relation) return errors.push(`Dòng ${line}: quan_he "${r.quan_he}" không hợp lệ`);
    if (raterCode && !emps.get(raterCode)) return errors.push(`Dòng ${line}: không có người đánh giá "${raterCode}"`);
    if (!comp) return errors.push(`Dòng ${line}: năng lực "${r.ma_nang_luc}" không thuộc chiến dịch`);
    if (level !== null && !(Number.isInteger(level) && level >= 1 && level <= 5)) return errors.push(`Dòng ${line}: mức "${lvRaw}" phải là 1–5 hoặc để trống`);
    const s = sheets.get(sheetKey) ?? { key: sheetKey, participantId: pid, raterEmployeeId: raterCode ? emps.get(raterCode)! : null, relation, scores: new Map() };
    if (s.participantId !== pid || s.relation !== relation) return errors.push(`Dòng ${line}: phiếu ${sheetKey} lẫn người được đánh giá / quan hệ khác nhau`);
    s.scores.set(comp.code, { level, evidence: (r.nhan_xet ?? '').trim() || null });
    sheets.set(sheetKey, s);
  });
  for (const s of sheets.values()) {
    if (s.scores.size < snap.length) errors.push(`Phiếu ${s.key}: mới có ${s.scores.size}/${snap.length} năng lực`);
  }
  if (errors.length || !commit) {
    return res.status(errors.length ? 400 : 200).json({ ok: errors.length === 0, sheets: sheets.size, rows: rows.length, errors: errors.slice(0, 200), committed: false });
  }

  let n = 0;
  await prisma.$transaction(async (tx) => {
    for (const s of sheets.values()) {
      const existing = s.raterEmployeeId
        ? await tx.assessmentRater.findFirst({ where: { participantId: s.participantId, raterEmployeeId: s.raterEmployeeId, relation: s.relation } })
        : await tx.assessmentRater.findFirst({ where: { participantId: s.participantId, raterLabel: `Phiếu ${s.key}` } });
      const rater = existing
        ? await tx.assessmentRater.update({
            where: { id: existing.id },
            data: { status: 'SUBMITTED', submittedAt: new Date(), source: 'IMPORT', enteredByEmail: req.user!.email },
          })
        : await tx.assessmentRater.create({
            data: {
              participantId: s.participantId, raterEmployeeId: s.raterEmployeeId, raterLabel: s.raterEmployeeId ? null : `Phiếu ${s.key}`,
              relation: s.relation, status: 'SUBMITTED', submittedAt: new Date(), source: 'IMPORT', enteredByEmail: req.user!.email,
            },
          });
      for (const [code, v] of s.scores) {
        const meta = byCode.get(code)!;
        await tx.assessmentScore.upsert({
          where: { raterId_competencyId: { raterId: rater.id, competencyId: meta.competencyId } },
          create: { raterId: rater.id, competencyId: meta.competencyId, versionId: meta.versionId, level: v.level, evidence: v.evidence },
          update: { level: v.level, evidence: v.evidence, versionId: meta.versionId },
        });
      }
      n++;
    }
  });
  await audit(req, 'IMPORT', 'AssessmentCampaign', c.id, { entityName: `${c.code} — nhập hộ ${n} phiếu`, newValues: { sheets: n, file: req.file.originalname } });
  res.json({ ok: true, sheets: n, rows: rows.length, errors: [], committed: true });
});

// ================================================================ KẾT QUẢ

talentRouter.get('/campaigns/:id/results/:employeeId', authenticate, async (req, res) => {
  const self = req.user!.employeeId === req.params.employeeId;
  const allowed = self || (req.user!.permissions.some((p) => p === 'assessment:read_results' || p === 'assessment:manage') && (await canSee(req, req.params.employeeId)));
  if (!allowed) return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi của bạn' });
  const r = await computeResult(req.params.id, req.params.employeeId);
  if (!r) return res.status(404).json({ error: 'Không có kết quả' });
  res.json(r);
});

talentRouter.get('/campaigns/:id/summary', authenticate, requirePermission('assessment:read_results', 'assessment:manage'), async (req, res) => {
  const parts = await prisma.assessmentParticipant.findMany({ where: { campaignId: req.params.id }, select: { employeeId: true } });
  const visible = await visibleEmployeeIds(req.user!);
  const out = [];
  for (const p of parts) {
    if (visible !== null && !visible.has(p.employeeId)) continue;
    const r = await computeResult(req.params.id, p.employeeId);
    if (!r) continue;
    out.push({
      employee: r.employee,
      submitted: r.raters.submitted,
      total: r.raters.total,
      core: r.summary.core,
      leadership: r.summary.leadership,
      suggestedPotential: suggestPotential(r.summary.leadership),
      gaps: r.competencies.filter((c) => (c.gap ?? 0) > 0).length,
    });
  }
  res.json({ participants: out });
});

// ================================================================ 9-BOX

talentRouter.get('/talent-reviews', authenticate, requirePermission('talent:review'), async (req, res) => {
  const cycle = String(req.query.cycle ?? new Date().getFullYear());
  const visible = await visibleEmployeeIds(req.user!);
  const emps = await prisma.employee.findMany({
    where: { status: 'ACTIVE', ...(visible === null ? {} : { id: { in: [...visible] } }) },
    select: { id: true, employeeCode: true, fullName: true, jobTitle: true, jobLevelCode: true, orgUnit: { select: { code: true, name: true } } },
    orderBy: { employeeCode: 'asc' },
  });
  const reviews = await prisma.talentReview.findMany({ where: { cycle, employeeId: { in: emps.map((e) => e.id) } } });

  // Gợi ý tiềm năng từ chiến dịch 360° ĐÃ ĐÓNG gần nhất có người này
  const lastCampaign = await prisma.assessmentCampaign.findFirst({ where: { status: 'CLOSED' }, orderBy: { endDate: 'desc' } });
  const suggestions = new Map<string, { leadership: number | null; potential: number | null }>();
  if (lastCampaign) {
    const parts = await prisma.assessmentParticipant.findMany({ where: { campaignId: lastCampaign.id }, select: { employeeId: true } });
    for (const p of parts) {
      if (!emps.some((e) => e.id === p.employeeId)) continue;
      const r = await computeResult(lastCampaign.id, p.employeeId);
      if (r) suggestions.set(p.employeeId, { leadership: r.summary.leadership, potential: suggestPotential(r.summary.leadership) });
    }
  }
  res.json({
    cycle,
    sourceCampaign: lastCampaign ? { id: lastCampaign.id, code: lastCampaign.code, name: lastCampaign.name } : null,
    rule: 'Gợi ý Tiềm năng [PROPOSAL]: điểm 360° nhóm Lãnh đạo (người khác đánh giá) ≥ 3,5 → Cao; ≥ 2,5 → Trung bình; còn lại → Thấp. Hiệu suất lấy từ kết quả ĐGNS — nhập tay.',
    employees: emps.map((e) => ({ ...e, review: reviews.find((r) => r.employeeId === e.id) ?? null, suggestion: suggestions.get(e.id) ?? null })),
  });
});

talentRouter.put('/talent-reviews', authenticate, requirePermission('talent:review'), async (req, res) => {
  const body = z
    .object({
      cycle: z.string().min(4).max(20),
      employeeId: z.string(),
      performance: z.number().int().min(1).max(3),
      potential: z.number().int().min(1).max(3),
      notes: z.string().max(2000).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  if (!(await canSee(req, body.data.employeeId))) return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi của bạn' });
  const box = (body.data.potential - 1) * 3 + body.data.performance;
  const before = await prisma.talentReview.findUnique({ where: { cycle_employeeId: { cycle: body.data.cycle, employeeId: body.data.employeeId } } });
  const data = {
    performance: body.data.performance, potential: body.data.potential, box, notes: body.data.notes ?? null,
    reviewedByEmail: req.user!.email, calibrated: false,
  };
  const after = await prisma.talentReview.upsert({
    where: { cycle_employeeId: { cycle: body.data.cycle, employeeId: body.data.employeeId } },
    create: { cycle: body.data.cycle, employeeId: body.data.employeeId, ...data },
    update: data,
  });
  await audit(req, before ? 'UPDATE' : 'CREATE', 'TalentReview', after.id, {
    entityName: `9-Box ${body.data.cycle}`,
    oldValues: before ? { box: before.box } : undefined,
    newValues: { box },
  });
  res.json(after);
});

talentRouter.post('/talent-reviews/calibrate', authenticate, requirePermission('assessment:manage'), async (req, res) => {
  const body = z.object({ cycle: z.string(), employeeIds: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const r = await prisma.talentReview.updateMany({
    where: { cycle: body.data.cycle, employeeId: { in: body.data.employeeIds } },
    data: { calibrated: true },
  });
  await audit(req, 'UPDATE', 'TalentReview', body.data.cycle, { entityName: `Hiệu chỉnh 9-Box ${body.data.cycle}`, newValues: { count: r.count } });
  res.json({ calibrated: r.count });
});

// ================================================================ IDP

const planInclude = {
  employee: { select: { id: true, employeeCode: true, fullName: true, jobTitle: true, jobRoleCode: true, managerId: true } },
  goals: {
    include: { competency: { select: { code: true, name: true } }, actions: { orderBy: { dueDate: 'asc' as const } } },
  },
  checkIns: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.IdpPlanInclude;

function planWarnings(plan: Prisma.IdpPlanGetPayload<{ include: typeof planInclude }>) {
  const w: string[] = [];
  if (!plan.goals.length) w.push('Chưa có mục tiêu năng lực nào');
  if (plan.goals.length > 3) w.push(`Có ${plan.goals.length} mục tiêu — nên tập trung tối đa 3 năng lực mỗi chu kỳ`);
  for (const g of plan.goals) {
    if (!g.actions.length) w.push(`${g.competency.code}: chưa có hành động phát triển`);
    else if (!g.actions.some((a) => a.type === 'EXPERIENCE_70')) w.push(`${g.competency.code}: thiếu hành động học qua công việc (70)`);
  }
  const all = plan.goals.flatMap((g) => g.actions);
  const done = all.filter((a) => a.status === 'DONE').length;
  return { warnings: w, progress: all.length ? Math.round((done / all.length) * 100) : 0 };
}

async function loadPlan(req: Request, id: string) {
  const plan = await prisma.idpPlan.findUnique({ where: { id }, include: planInclude });
  if (!plan) return fail(404, 'Không tìm thấy IDP');
  const self = req.user!.employeeId === plan.employeeId;
  if (!self && !(await canSee(req, plan.employeeId))) return fail(403, 'IDP nằm ngoài phạm vi của bạn');
  return { err: null, plan, self };
}

const canManageIdp = (req: Request) => req.user!.permissions.includes('idp:manage');

talentRouter.get('/idp', authenticate, async (req, res) => {
  const visible = await visibleEmployeeIds(req.user!);
  const where: Prisma.IdpPlanWhereInput = {
    ...(req.query.cycle ? { cycle: String(req.query.cycle) } : {}),
    ...(req.query.employeeId ? { employeeId: String(req.query.employeeId) } : {}),
  };
  if (!canManageIdp(req)) where.employeeId = req.user!.employeeId ?? '__none__';
  else if (visible !== null) where.employeeId = { in: [...visible] };
  const plans = await prisma.idpPlan.findMany({ where, include: planInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ plans: plans.map((p) => ({ ...p, ...planWarnings(p) })) });
});

talentRouter.get('/idp/:id', authenticate, async (req, res) => {
  const r = await loadPlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  res.json({ ...r.plan, ...planWarnings(r.plan) });
});

/** Tạo IDP từ kết quả 360°: lấy tối đa 3 năng lực có khoảng cách lớn nhất so với yêu cầu vai trò (hoặc mức 3 nếu chưa có vai trò) */
talentRouter.post('/idp/from-assessment', authenticate, requirePermission('idp:manage'), async (req, res) => {
  const body = z.object({ employeeId: z.string(), campaignId: z.string(), cycle: z.string().min(4), maxGoals: z.number().int().min(1).max(5).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  if (!(await canSee(req, body.data.employeeId))) return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi của bạn' });
  const existing = await prisma.idpPlan.findUnique({ where: { employeeId_cycle: { employeeId: body.data.employeeId, cycle: body.data.cycle } } });
  if (existing) return res.status(409).json({ error: `Đã có IDP chu kỳ ${body.data.cycle}`, planId: existing.id });
  const result = await computeResult(body.data.campaignId, body.data.employeeId);
  if (!result) return res.status(404).json({ error: 'Không có kết quả 360° của nhân sự này' });
  if (result.campaign.status !== 'CLOSED') return res.status(409).json({ error: 'Chỉ lập IDP từ chiến dịch đã đóng' });
  if (currentWorkspace() && !result.competencies.some(c => c.requiredStatus === 'APPROVED')) {
    return res.status(422).json({ error: 'Cần gắn nhân sự với chức danh có yêu cầu năng lực đã duyệt phù hợp với chiến dịch trước khi lập IDP từ kết quả.' });
  }

  const candidates = result.competencies
    .filter((c) => c.others !== null && (!currentWorkspace() || c.requiredStatus === 'APPROVED'))
    .map((c) => {
      const target = c.required ?? 3;
      return { ...c, target, gapToTarget: Math.round((target - (c.others as number)) * 100) / 100 };
    })
    .filter((c) => c.gapToTarget > 0)
    .sort((a, b) => b.gapToTarget - a.gapToTarget)
    .slice(0, body.data.maxGoals ?? 3);
  const comps = await prisma.competency.findMany({ where: { code: { in: candidates.map((c) => c.code) } }, select: { id: true, code: true } });

  const plan = await prisma.idpPlan.create({
    data: {
      employeeId: body.data.employeeId,
      cycle: body.data.cycle,
      sourceCampaignId: body.data.campaignId,
      targetRoleCode: result.employee.jobRoleCode,
      createdByEmail: req.user!.email,
      notes: candidates.length ? null : 'Không có năng lực nào dưới mức yêu cầu — cân nhắc mục tiêu phát triển cho vai trò kế tiếp.',
      goals: {
        create: candidates.map((c) => ({
          competencyId: comps.find((x) => x.code === c.code)!.id,
          currentLevel: c.others,
          targetLevel: Math.min(5, Math.ceil(c.target)),
          source: 'GAP_360',
        })),
      },
    },
    include: planInclude,
  });
  await audit(req, 'CREATE', 'IdpPlan', plan.id, { entityName: `IDP ${result.employee.employeeCode} ${body.data.cycle}`, newValues: { goals: candidates.map((c) => c.code) } });
  res.status(201).json({ ...plan, ...planWarnings(plan) });
});

talentRouter.post('/idp', authenticate, requirePermission('idp:manage'), async (req, res) => {
  const body = z.object({ employeeId: z.string(), cycle: z.string().min(4), targetRoleCode: z.string().optional(), notes: z.string().max(2000).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  if (!(await canSee(req, body.data.employeeId))) return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi của bạn' });
  const existing = await prisma.idpPlan.findUnique({ where: { employeeId_cycle: { employeeId: body.data.employeeId, cycle: body.data.cycle } } });
  if (existing) return res.status(409).json({ error: `Đã có IDP chu kỳ ${body.data.cycle}`, planId: existing.id });
  const plan = await prisma.idpPlan.create({
    data: { ...body.data, targetRoleCode: body.data.targetRoleCode ?? null, notes: body.data.notes ?? null, createdByEmail: req.user!.email },
    include: planInclude,
  });
  await audit(req, 'CREATE', 'IdpPlan', plan.id, { entityName: `IDP ${body.data.cycle}` });
  res.status(201).json(plan);
});

/** Sửa nội dung chỉ được khi IDP ở DRAFT (hoặc người có quyền idp:manage đang điều chỉnh trong lúc thực hiện) */
async function editablePlan(req: Request, id: string) {
  const r = await loadPlan(req, id);
  if (r.err) return r;
  if (!canManageIdp(req) && !r.self) return fail(403, 'Không có quyền sửa IDP này');
  if (['COMPLETED', 'CANCELLED'].includes(r.plan.status)) return fail(409, `IDP đã ${r.plan.status}`);
  return r;
}

talentRouter.post('/idp/:id/goals', authenticate, async (req, res) => {
  const body = z.object({ competencyCode: z.string(), targetLevel: z.number().int().min(1).max(5), currentLevel: z.number().min(1).max(5).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const r = await editablePlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const comp = await prisma.competency.findUnique({ where: { code: body.data.competencyCode } });
  if (!comp) return res.status(400).json({ error: 'Mã năng lực không có trong Từ điển' });
  const g = await prisma.idpGoal.create({
    data: { planId: r.plan.id, competencyId: comp.id, targetLevel: body.data.targetLevel, currentLevel: body.data.currentLevel ?? null, source: 'MANUAL' },
  });
  res.status(201).json(g);
});

talentRouter.delete('/idp-goals/:id', authenticate, async (req, res) => {
  const g = await prisma.idpGoal.findUnique({ where: { id: req.params.id } });
  if (!g) return res.status(404).json({ error: 'Không tìm thấy' });
  const r = await editablePlan(req, g.planId);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  await prisma.idpGoal.delete({ where: { id: g.id } });
  res.json({ ok: true });
});

talentRouter.post('/idp-goals/:id/actions', authenticate, async (req, res) => {
  const body = z.object({
    type: z.enum(['EXPERIENCE_70', 'EXPOSURE_20', 'EDUCATION_10']),
    title: z.string().trim().min(5).max(500),
    dueDate: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ (tiêu đề tối thiểu 5 ký tự)' });
  const g = await prisma.idpGoal.findUnique({ where: { id: req.params.id } });
  if (!g) return res.status(404).json({ error: 'Không tìm thấy mục tiêu' });
  const r = await editablePlan(req, g.planId);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const a = await prisma.idpAction.create({
    data: { goalId: g.id, type: body.data.type, title: body.data.title, dueDate: body.data.dueDate ? new Date(body.data.dueDate) : null },
  });
  res.status(201).json(a);
});

talentRouter.patch('/idp-actions/:id', authenticate, async (req, res) => {
  const body = z.object({
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
    evidence: z.string().max(2000).optional(),
    title: z.string().trim().min(5).max(500).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  const a = await prisma.idpAction.findUnique({ where: { id: req.params.id }, include: { goal: true } });
  if (!a) return res.status(404).json({ error: 'Không tìm thấy' });
  const r = await editablePlan(req, a.goal.planId);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const after = await prisma.idpAction.update({ where: { id: a.id }, data: body.data });
  res.json(after);
});

talentRouter.post('/idp/:id/submit', authenticate, async (req, res) => {
  const r = await editablePlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  if (r.plan.status !== 'DRAFT') return res.status(409).json({ error: `IDP đang ${r.plan.status}` });
  const { warnings } = planWarnings(r.plan);
  const blocking = warnings.filter((w) => w.includes('Chưa có mục tiêu') || w.includes('chưa có hành động'));
  if (blocking.length) return res.status(400).json({ error: blocking.join('; ') });
  await prisma.idpPlan.update({ where: { id: r.plan.id }, data: { status: 'SUBMITTED' } });
  await audit(req, 'UPDATE', 'IdpPlan', r.plan.id, { entityName: 'IDP', newValues: { status: 'SUBMITTED' } });
  res.json({ ok: true, warnings });
});

/** Phê duyệt: quản lý trực tiếp của nhân sự, hoặc người có idp:approve với phạm vi toàn bộ (HR_LEAD) */
talentRouter.post('/idp/:id/approve', authenticate, requirePermission('idp:approve'), async (req, res) => {
  const r = await loadPlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  if (r.self) return res.status(403).json({ error: 'Không tự phê duyệt IDP của chính mình' });
  const isDirectManager = !!req.user!.employeeId && r.plan.employee.managerId === req.user!.employeeId;
  const isHr = req.user!.permissions.includes('org:read_all');
  if (!isDirectManager && !isHr) return res.status(403).json({ error: 'Chỉ quản lý trực tiếp hoặc Ban NS&QTHC được phê duyệt' });
  if (r.plan.status !== 'SUBMITTED') return res.status(409).json({ error: `IDP đang ${r.plan.status}, chưa gửi duyệt` });
  await prisma.idpPlan.update({
    where: { id: r.plan.id },
    data: { status: 'APPROVED', approvedByEmail: req.user!.email, approvedAt: new Date() },
  });
  await audit(req, 'UPDATE', 'IdpPlan', r.plan.id, { entityName: 'IDP', newValues: { status: 'APPROVED' } });
  res.json({ ok: true });
});

talentRouter.post('/idp/:id/status', authenticate, requirePermission('idp:manage'), async (req, res) => {
  const body = z.object({ status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DRAFT']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  const r = await loadPlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const allowed: Record<string, string[]> = {
    APPROVED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    SUBMITTED: ['DRAFT', 'CANCELLED'], DRAFT: ['CANCELLED'],
  };
  if (!(allowed[r.plan.status] ?? []).includes(body.data.status)) {
    return res.status(409).json({ error: `Không chuyển được từ ${r.plan.status} sang ${body.data.status}` });
  }
  await prisma.idpPlan.update({ where: { id: r.plan.id }, data: { status: body.data.status } });
  await audit(req, 'UPDATE', 'IdpPlan', r.plan.id, { entityName: 'IDP', oldValues: { status: r.plan.status }, newValues: { status: body.data.status } });
  res.json({ ok: true });
});

talentRouter.post('/idp/:id/check-ins', authenticate, async (req, res) => {
  const body = z.object({ content: z.string().trim().min(3).max(2000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Nội dung trao đổi quá ngắn' });
  const r = await loadPlan(req, req.params.id);
  if (r.err) return res.status(r.err.status).json({ error: r.err.message });
  const ci = await prisma.idpCheckIn.create({ data: { planId: r.plan.id, authorEmail: req.user!.email, content: body.data.content } });
  res.status(201).json(ci);
});
