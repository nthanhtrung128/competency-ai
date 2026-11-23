import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, requirePermission, resolveScope, visibleEmployeeIds } from '../auth.js';

/**
 * BẢNG ĐIỀU KHIỂN — số liệu thật, lọc theo phạm vi của người xem.
 * Khối nào người xem không có quyền thì trả null (giao diện ẩn khối đó).
 */
export const dashboardRouter = Router();

type Levels = { completeness?: string; behavioralIndicators?: Array<{ level: number; indicator: string }> };

dashboardRouter.get('/dashboard', authenticate, requirePermission('competency:read'), async (req, res) => {
  const perms = req.user!.permissions;
  const has = (...p: string[]) => p.some((x) => perms.includes(x));
  const cycle = String(req.query.cycle ?? new Date().getFullYear());
  const scope = await resolveScope(req.user!);
  const visible = await visibleEmployeeIds(req.user!);
  const empWhere = visible === null ? {} : { id: { in: [...visible] } };

  // ---------------- Khung năng lực
  const comps = await prisma.competency.findMany({
    where: { isActive: true },
    select: { code: true, hasOwner: true, scaleId: true, currentVersionId: true, category: { select: { code: true } } },
  });
  const currentVersions = await prisma.competencyVersion.findMany({
    where: { id: { in: comps.map((c) => c.currentVersionId).filter((x): x is string => !!x) } },
    select: { id: true, levels: true },
  });
  const fullIds = new Set(
    currentVersions
      .filter((v) => new Set(((v.levels ?? {}) as Levels).behavioralIndicators?.filter((b) => b.indicator?.trim()).map((b) => b.level)).size === 5)
      .map((v) => v.id),
  );
  const scored = comps.filter((c) => c.scaleId);
  const byCategory = ['COR', 'LEA', 'FUN'].map((cat) => {
    const list = scored.filter((c) => c.category.code === cat);
    return {
      category: cat,
      total: list.length,
      published: list.filter((c) => c.currentVersionId).length,
      full: list.filter((c) => c.currentVersionId && fullIds.has(c.currentVersionId)).length,
    };
  });
  const reqRows = await prisma.jobRoleRequirement.groupBy({ by: ['mappingStatus'], _count: true });
  const framework = {
    competencies: comps.length,
    published: comps.filter((c) => c.currentVersionId).length,
    draftOnly: comps.filter((c) => !c.currentVersionId).length,
    fullFiveLevels: scored.filter((c) => c.currentVersionId && fullIds.has(c.currentVersionId)).length,
    scored: scored.length,
    byCategory,
    ownersMissing: comps.filter((c) => !c.hasOwner).length,
    pendingDrafts: await prisma.competencyVersion.count({ where: { status: 'DRAFT' } }),
    requirements: Object.fromEntries(reqRows.map((r) => [r.mappingStatus, r._count])) as Record<string, number>,
  };

  // ---------------- Tổ chức & tài khoản
  const org = {
    units: await prisma.orgUnit.count({ where: scope === null ? { isActive: true } : { isActive: true, id: { in: scope } } }),
    employees: await prisma.employee.count({ where: { ...empWhere, status: 'ACTIVE' } }),
    accounts: has('user:manage') ? await prisma.user.count({ where: { status: 'ACTIVE' } }) : null,
    pendingPasswordChange: has('user:manage') ? await prisma.user.count({ where: { status: 'ACTIVE', mustChangePassword: true } }) : null,
  };

  // ---------------- 360°
  let assessment = null;
  if (has('assessment:manage', 'assessment:read_results')) {
    const campaigns = await prisma.assessmentCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { participants: { select: { employeeId: true, raters: { select: { status: true } } } } },
    });
    const byStatus = { DRAFT: 0, OPEN: 0, CLOSED: 0 } as Record<string, number>;
    for (const c of campaigns) byStatus[c.status]++;
    const latest = campaigns.find((c) => c.status === 'OPEN') ?? campaigns[0];
    let latestInfo = null;
    if (latest) {
      const parts = latest.participants.filter((p) => visible === null || visible.has(p.employeeId));
      const raters = parts.flatMap((p) => p.raters);
      const done = raters.filter((r) => r.status === 'SUBMITTED').length;
      latestInfo = {
        id: latest.id, code: latest.code, name: latest.name, status: latest.status, endDate: latest.endDate,
        participants: parts.length, raters: raters.length, submitted: done,
        rate: raters.length ? Math.round((done / raters.length) * 100) : 0,
        participantsComplete: parts.filter((p) => p.raters.length && p.raters.every((r) => r.status === 'SUBMITTED')).length,
      };
    }
    assessment = { byStatus, latest: latestInfo };
  }

  // ---------------- 9-Box
  let talent = null;
  if (has('talent:review', 'assessment:manage')) {
    const reviews = await prisma.talentReview.findMany({ where: { cycle, ...(visible === null ? {} : { employeeId: { in: [...visible] } }) }, select: { box: true, calibrated: true } });
    const boxes = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 0])) as Record<number, number>;
    for (const r of reviews) boxes[r.box]++;
    talent = { cycle, reviewed: reviews.length, calibrated: reviews.filter((r) => r.calibrated).length, boxes };
  }

  // ---------------- IDP
  let idp = null;
  if (has('idp:manage')) {
    const plans = await prisma.idpPlan.findMany({
      where: visible === null ? {} : { employeeId: { in: [...visible] } },
      include: { goals: { include: { actions: { select: { status: true, dueDate: true } } } } },
    });
    const byStatus: Record<string, number> = {};
    let overdue = 0;
    const progress: number[] = [];
    for (const p of plans) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      const acts = p.goals.flatMap((g) => g.actions);
      if (acts.length) progress.push(acts.filter((a) => a.status === 'DONE').length / acts.length);
      overdue += acts.filter((a) => a.dueDate && a.dueDate < new Date() && !['DONE', 'CANCELLED'].includes(a.status)).length;
    }
    idp = {
      plans: plans.length, byStatus, overdueActions: overdue,
      avgProgress: progress.length ? Math.round((progress.reduce((a, b) => a + b, 0) / progress.length) * 100) : 0,
    };
  }

  // ---------------- Kế thừa
  let succession = null;
  if (has('talent:review', 'assessment:manage')) {
    const plans = await prisma.successionPlan.findMany({
      where: scope === null ? {} : { OR: [{ orgUnitId: { in: scope } }, { orgUnitId: null }] },
      include: { candidates: { select: { readiness: true } } },
    });
    succession = {
      plans: plans.length,
      critical: plans.filter((p) => p.criticality === 'CRITICAL').length,
      withReadyNow: plans.filter((p) => p.candidates.some((c) => c.readiness === 'READY_NOW')).length,
      criticalUncovered: plans.filter((p) => p.criticality === 'CRITICAL' && !p.candidates.some((c) => c.readiness === 'READY_NOW')).length,
      withoutCandidate: plans.filter((p) => !p.candidates.length).length,
    };
  }

  res.json({ generatedAt: new Date().toISOString(), framework, org, assessment, talent, idp, succession });
});
