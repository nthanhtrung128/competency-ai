import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requirePermission, audit, hashPassword, tempPassword } from '../auth.js';

/**
 * QĐ-07 — Giai đoạn thí điểm chỉ cấp tài khoản cho HR và quản lý.
 *  - Mọi tài khoản cấp mới / đặt lại mật khẩu đều phải đổi mật khẩu ở lần đăng nhập đầu.
 *  - Mật khẩu tạm chỉ trả về MỘT LẦN trong phản hồi; không lưu dạng đọc được.
 *  - Nhân viên không có tài khoản: HR nhập hộ phiếu 360° (POST /api/campaigns/:id/import-responses).
 */
export const usersRouter = Router();

const ROLE_CODES = ['ADMIN', 'HR_LEAD', 'HRBP', 'LINE_MANAGER'] as const; // EMPLOYEE chưa cấp ở thí điểm

usersRouter.get('/users', authenticate, requirePermission('user:manage'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: {
      userRoles: { include: { role: { select: { code: true, name: true } } } },
      scopes: { include: { orgUnit: { select: { code: true, name: true } } } },
      employee: { select: { employeeCode: true, fullName: true } },
    },
  });
  res.json({
    users: users.map((u) => ({
      id: u.id, email: u.email, name: u.name, status: u.status, mustChangePassword: u.mustChangePassword,
      roles: u.userRoles.map((r) => r.role.code),
      scopes: u.scopes.map((s) => ({ orgUnit: s.orgUnit.code, name: s.orgUnit.name, includeSubtree: s.includeSubtree })),
      employee: u.employee,
    })),
  });
});

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2),
  role: z.enum(ROLE_CODES),
  employeeCode: z.string().trim().optional(),
  scopeOrgUnitCode: z.string().trim().optional(),
});

usersRouter.post('/users', authenticate, requirePermission('user:manage'), async (req, res) => {
  const body = CreateUser.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  if (body.data.role === 'ADMIN' && !req.user!.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Chỉ ADMIN được cấp tài khoản ADMIN' });
  }
  const email = body.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Email đã có tài khoản' });

  let employeeId: string | null = null;
  if (body.data.employeeCode) {
    const e = await prisma.employee.findUnique({ where: { employeeCode: body.data.employeeCode }, include: { user: true } });
    if (!e) return res.status(400).json({ error: `Không có nhân sự mã ${body.data.employeeCode}` });
    if (e.user) return res.status(409).json({ error: `Nhân sự ${e.employeeCode} đã gắn với tài khoản ${e.user.email}` });
    employeeId = e.id;
  }
  const unit = body.data.scopeOrgUnitCode ? await prisma.orgUnit.findUnique({ where: { code: body.data.scopeOrgUnitCode } }) : null;
  if (body.data.scopeOrgUnitCode && !unit) return res.status(400).json({ error: `Không có đơn vị ${body.data.scopeOrgUnitCode}` });
  if (['HRBP', 'LINE_MANAGER'].includes(body.data.role) && !unit && !employeeId) {
    return res.status(400).json({ error: 'HRBP / quản lý cần phạm vi đơn vị hoặc hồ sơ nhân sự để giới hạn dữ liệu được xem' });
  }

  const role = await prisma.role.findUnique({ where: { code: body.data.role } });
  if (!role) return res.status(500).json({ error: 'Chưa nạp vai trò — chạy npm run seed' });
  const pwd = tempPassword();
  const user = await prisma.user.create({
    data: {
      email, name: body.data.name, employeeId, mustChangePassword: true,
      passwordHash: await hashPassword(pwd),
      userRoles: { create: { roleId: role.id } },
      ...(unit ? { scopes: { create: { orgUnitId: unit.id, accessLevel: 'READ', includeSubtree: true } } } : {}),
    },
  });
  await audit(req, 'CREATE', 'User', user.id, { entityName: email, newValues: { role: body.data.role, scope: unit?.code ?? null } });
  res.status(201).json({ id: user.id, email, role: body.data.role, temporaryPassword: pwd, note: 'Mật khẩu tạm chỉ hiện MỘT LẦN — gửi riêng cho người dùng.' });
});

/**
 * Cấp tài khoản hàng loạt cho QUẢN LÝ: nhân sự đang làm việc, có ít nhất 1 người báo cáo trực tiếp
 * hoặc là trưởng đơn vị, có email, chưa có tài khoản. Phạm vi = đơn vị của họ (gồm đơn vị con).
 */
usersRouter.post('/users/provision-managers', authenticate, requirePermission('user:manage'), async (req, res) => {
  const commit = req.body?.commit === true;
  const emps = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true, _count: { select: { reports: true, headOfUnits: true } }, orgUnit: { select: { id: true, code: true } } },
  });
  const candidates = emps.filter((e) => (e._count.reports > 0 || e._count.headOfUnits > 0) && !e.user);
  const ready = candidates.filter((e) => e.email);
  const noEmail = candidates.filter((e) => !e.email).map((e) => ({ employeeCode: e.employeeCode, fullName: e.fullName }));
  const existingEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map((u) => u.email));
  const clash = ready.filter((e) => existingEmails.has(e.email!.toLowerCase()));
  const toCreate = ready.filter((e) => !existingEmails.has(e.email!.toLowerCase()));

  if (!commit) {
    return res.json({
      dryRun: true,
      willCreate: toCreate.map((e) => ({ employeeCode: e.employeeCode, fullName: e.fullName, email: e.email, orgUnit: e.orgUnit?.code ?? null, reports: e._count.reports })),
      noEmail,
      emailAlreadyUsed: clash.map((e) => ({ employeeCode: e.employeeCode, email: e.email })),
    });
  }
  const role = await prisma.role.findUnique({ where: { code: 'LINE_MANAGER' } });
  if (!role) return res.status(500).json({ error: 'Chưa nạp vai trò — chạy npm run seed' });
  const created: Array<{ employeeCode: string; fullName: string; email: string; temporaryPassword: string }> = [];
  for (const e of toCreate) {
    const pwd = tempPassword();
    await prisma.user.create({
      data: {
        email: e.email!.toLowerCase(), name: e.fullName, employeeId: e.id, mustChangePassword: true,
        passwordHash: await hashPassword(pwd),
        userRoles: { create: { roleId: role.id } },
        ...(e.orgUnit ? { scopes: { create: { orgUnitId: e.orgUnit.id, accessLevel: 'READ', includeSubtree: true } } } : {}),
      },
    });
    created.push({ employeeCode: e.employeeCode, fullName: e.fullName, email: e.email!.toLowerCase(), temporaryPassword: pwd });
  }
  await audit(req, 'CREATE', 'User', 'BULK', { entityName: `Cấp ${created.length} tài khoản quản lý`, newValues: { emails: created.map((c) => c.email) } });
  res.json({ dryRun: false, created, noEmail, emailAlreadyUsed: clash.map((e) => ({ employeeCode: e.employeeCode, email: e.email })) });
});

usersRouter.post('/users/:id/reset-password', authenticate, requirePermission('user:manage'), async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { userRoles: { include: { role: true } } } });
  if (!u) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  if (u.userRoles.some((r) => r.role.code === 'ADMIN') && !req.user!.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Chỉ ADMIN được đặt lại mật khẩu ADMIN' });
  }
  const pwd = tempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pwd), mustChangePassword: true } }),
    prisma.refreshToken.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(req, 'UPDATE', 'User', u.id, { entityName: `RESET:${u.email}` });
  res.json({ email: u.email, temporaryPassword: pwd });
});

usersRouter.patch('/users/:id', authenticate, requirePermission('user:manage'), async (req, res) => {
  const body = z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  if (req.params.id === req.user!.id) return res.status(400).json({ error: 'Không tự khoá tài khoản của mình' });
  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
  const after = await prisma.user.update({ where: { id: before.id }, data: { status: body.data.status } });
  if (body.data.status !== 'ACTIVE') {
    await prisma.refreshToken.updateMany({ where: { userId: before.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await audit(req, 'UPDATE', 'User', before.id, { entityName: before.email, oldValues: { status: before.status }, newValues: { status: after.status } });
  res.json({ id: after.id, status: after.status });
});
