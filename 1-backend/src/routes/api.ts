import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  authenticate,
  requirePermission,
  resolveScope,
  audit,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  verifyPassword,
  hashPassword,
  passwordProblem,
} from '../auth.js';

export const apiRouter = Router();

// ================================================================ AUTH

apiRouter.post('/auth/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });

  const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }
  const ok = await verifyPassword(body.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

  const accessToken = signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);

  await prisma.auditLog.create({
    data: { action: 'LOGIN', entityType: 'User', entityId: user.id, actorId: user.id, actorEmail: user.email },
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
    mustChangePassword: user.mustChangePassword,
  });
});

apiRouter.post('/auth/refresh', async (req, res) => {
  const token = String(req.body?.refreshToken ?? '');
  if (!token) return res.status(400).json({ error: 'Thiếu refresh token' });
  const result = await rotateRefreshToken(token);
  if (!result) return res.status(401).json({ error: 'Refresh token hết hạn hoặc đã dùng' });
  res.json({ accessToken: signAccessToken(result.userId), refreshToken: result.refreshToken });
});

apiRouter.post('/auth/change-password', authenticate, async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
  const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!u || !(await verifyPassword(body.data.currentPassword, u.passwordHash))) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  const problem = passwordProblem(body.data.newPassword);
  if (problem) return res.status(400).json({ error: problem });
  if (body.data.newPassword === body.data.currentPassword) {
    return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu cũ' });
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(body.data.newPassword), mustChangePassword: false },
  });
  await audit(req, 'UPDATE', 'User', u.id, { entityName: `PASSWORD:${u.email}` });
  res.json({ ok: true });
});

apiRouter.get('/auth/me', authenticate, async (req, res) => {
  const scope = await resolveScope(req.user!);
  res.json({
    ...req.user,
    scope: scope === null ? 'TOAN_BO' : scope,
    scopeCount: scope === null ? null : scope.length,
  });
});

// ================================================================ ĐƠN VỊ

apiRouter.get('/org-units', authenticate, requirePermission('org:read', 'org:read_all'), async (req, res) => {
  const scope = await resolveScope(req.user!);
  const units = await prisma.orgUnit.findMany({
    where: scope === null ? {} : { id: { in: scope } },
    orderBy: [{ tier: 'asc' }, { code: 'asc' }],
    include: { headEmployee: { select: { id: true, fullName: true, employeeCode: true } } },
  });
  res.json({
    count: units.length,
    scopeApplied: scope !== null,
    units: units.map((u) => ({
      ...u,
      headDisplay: u.headEmployee ? u.headEmployee.fullName : 'Chưa bổ nhiệm',
    })),
  });
});

apiRouter.get('/org-units/tree', authenticate, requirePermission('org:read', 'org:read_all'), async (req, res) => {
  const scope = await resolveScope(req.user!);
  const all = await prisma.orgUnit.findMany({
    where: scope === null ? {} : { id: { in: scope } },
    orderBy: [{ tier: 'asc' }, { code: 'asc' }],
    include: {
      headEmployee: { select: { fullName: true } },
      _count: { select: { employees: true } },
    },
  });

  type Node = (typeof all)[number] & { children: Node[]; headDisplay: string };
  const map = new Map<string, Node>();
  for (const u of all) map.set(u.id, { ...u, children: [], headDisplay: u.headEmployee?.fullName ?? 'Chưa bổ nhiệm' });

  const roots: Node[] = [];
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  res.json({ tree: roots });
});

const OrgUnitInput = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  nameEn: z.string().trim().optional(),
  type: z.string().optional(),
  tier: z.number().int().min(0),
  parentId: z.string().optional().nullable(),
  headEmployeeId: z.string().optional().nullable(),
});

apiRouter.post('/org-units', authenticate, requirePermission('org:manage'), async (req, res) => {
  const body = OrgUnitInput.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });

  // Ràng buộc: tier con phải LỚN HƠN tier cha
  if (body.data.parentId) {
    const parent = await prisma.orgUnit.findUnique({ where: { id: body.data.parentId } });
    if (!parent) return res.status(400).json({ error: 'Đơn vị cha không tồn tại' });
    if (body.data.tier <= parent.tier) {
      return res.status(400).json({
        error: `tier của đơn vị con (${body.data.tier}) phải lớn hơn tier của đơn vị cha (${parent.tier})`,
      });
    }
  }

  const created = await prisma.orgUnit.create({ data: body.data as never });
  await audit(req, 'CREATE', 'OrgUnit', created.id, { entityName: created.name, newValues: created });
  res.status(201).json(created);
});

apiRouter.patch('/org-units/:id/head', authenticate, requirePermission('org:manage'), async (req, res) => {
  const employeeId = req.body?.employeeId ?? null; // null = gỡ bổ nhiệm
  const before = await prisma.orgUnit.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Không tìm thấy đơn vị' });

  const after = await prisma.orgUnit.update({
    where: { id: req.params.id },
    data: { headEmployeeId: employeeId },
  });
  await audit(req, 'UPDATE', 'OrgUnit', after.id, {
    entityName: after.name,
    oldValues: { headEmployeeId: before.headEmployeeId },
    newValues: { headEmployeeId: after.headEmployeeId },
  });
  res.json({ ...after, headDisplay: employeeId ? undefined : 'Chưa bổ nhiệm' });
});

// ================================================================ NHÂN SỰ

apiRouter.get('/employees', authenticate, requirePermission('employee:read'), async (req, res) => {
  const scope = await resolveScope(req.user!);
  const q = String(req.query.q ?? '').trim();
  const take = Math.min(Number(req.query.take ?? 50), 200);
  const skip = Number(req.query.skip ?? 0);

  const where = {
    ...(scope === null ? {} : { orgUnitId: { in: scope } }),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { employeeCode: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      take,
      skip,
      orderBy: { employeeCode: 'asc' },
      include: {
        orgUnit: { select: { code: true, name: true } },
        manager: { select: { employeeCode: true, fullName: true } },
      },
    }),
  ]);

  res.json({ total, take, skip, scopeApplied: scope !== null, employees });
});

apiRouter.get('/employees/:id', authenticate, requirePermission('employee:read'), async (req, res) => {
  const scope = await resolveScope(req.user!);
  const emp = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      orgUnit: true,
      manager: { select: { employeeCode: true, fullName: true } },
      assignments: { orderBy: { effectiveFrom: 'desc' }, include: { orgUnit: { select: { name: true } } } },
    },
  });
  if (!emp) return res.status(404).json({ error: 'Không tìm thấy nhân sự' });

  // chặn theo phạm vi — không để lọt dữ liệu ngoài quyền
  if (scope !== null && (!emp.orgUnitId || !scope.includes(emp.orgUnitId))) {
    return res.status(403).json({ error: 'Nhân sự này nằm ngoài phạm vi dữ liệu của bạn' });
  }
  res.json(emp);
});

// ================================================================ NĂNG LỰC

apiRouter.get('/competencies', authenticate, requirePermission('competency:read'), async (_req, res) => {
  const comps = await prisma.competency.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    include: {
      category: { select: { code: true, name: true, scored: true } },
      versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  res.json({
    count: comps.length,
    khongCoChuSoHuu: comps.filter((c) => !c.hasOwner).length,
    competencies: comps,
  });
});

/**
 * Xuất bản một phiên bản năng lực.
 * ĐÂY LÀ CHỖ BẢN AI STUDIO LÀM SAI: phải chuyển bản cũ sang ARCHIVED
 * và cập nhật currentVersionId, không chỉ đổi status bản mới.
 */
apiRouter.post(
  '/competency-versions/:id/publish',
  authenticate,
  requirePermission('competency:publish'),
  async (req, res) => {
    const version = await prisma.competencyVersion.findUnique({ where: { id: req.params.id } });
    if (!version) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });
    if (version.status === 'PUBLISHED') {
      return res.status(409).json({ error: 'Phiên bản này đã được xuất bản' });
    }
    // QĐ-04: không ban hành nội dung còn nhãn dự thảo AI / giữ chỗ
    const inds = ((version.levels ?? {}) as { behavioralIndicators?: Array<{ level: number; indicator: string }> })
      .behavioralIndicators ?? [];
    const tagged = inds.filter((b) => /\[DỰ THẢO (AI|TỰ SINH)|\[Mức \d chưa có/i.test(b.indicator)).map((b) => b.level);
    if (tagged.length) {
      return res.status(422).json({
        error: `Chưa ban hành được: mức ${tagged.join(', ')} vẫn là dự thảo AI chưa được chuyên gia duyệt.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. lưu trữ mọi phiên bản đang PUBLISHED của cùng năng lực
      const archived = await tx.competencyVersion.updateMany({
        where: { competencyId: version.competencyId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });

      // 2. xuất bản phiên bản mới
      const published = await tx.competencyVersion.update({
        where: { id: version.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });

      // 3. cập nhật con trỏ hiện hành
      await tx.competency.update({
        where: { id: version.competencyId },
        data: { currentVersionId: published.id },
      });

      return { published, archivedCount: archived.count };
    });

    await audit(req, 'PUBLISH', 'CompetencyVersion', version.id, {
      entityName: version.title,
      newValues: { status: 'PUBLISHED', archivedPrevious: result.archivedCount },
    });

    res.json({
      ...result.published,
      daLuuTruBanCu: result.archivedCount,
      message: `Đã xuất bản. ${result.archivedCount} phiên bản cũ chuyển sang ARCHIVED.`,
    });
  },
);

// ================================================================ NHẬT KÝ

apiRouter.get('/audit-logs', authenticate, requirePermission('audit:read'), async (req, res) => {
  const take = Math.min(Number(req.query.take ?? 100), 500);
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take,
    include: { actor: { select: { email: true, name: true } } },
  });
  res.json({ count: logs.length, logs });
});
