import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { currentWorkspace, prisma } from './db.js';

// Local development gets an ephemeral signing key. Production requires a configured key at preflight.
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(48).toString('base64url');
const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 7;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  permissions: string[];
  roles: string[];
  /** Hồ sơ nhân sự gắn với tài khoản — cần để chấm phiếu 360°, xem nhân viên trực tiếp */
  employeeId: string | null;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ---------------------------------------------------------------- token

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId, workspace: currentWorkspace()?.code }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function refreshHash(raw: string) {
  const company = currentWorkspace();
  return crypto.createHash('sha256').update(company ? company.code + ':' + raw : raw).digest('hex');
}

export async function revokeRefreshToken(raw: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: refreshHash(raw), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(40).toString('hex');
  const tokenHash = refreshHash(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 864e5);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}

export async function rotateRefreshToken(raw: string) {
  const tokenHash = refreshHash(raw);
  return prisma.$transaction(async tx => {
    const claimed = await tx.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count) return null;
    const { userId } = await tx.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
    const next = crypto.randomBytes(40).toString('hex');
    await tx.refreshToken.create({ data: { userId, tokenHash: refreshHash(next), expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 864e5) } });
    return { userId, refreshToken: next };
  });
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

// ---------------------------------------------------------------- nạp user

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
  });
  if (!u || u.status !== 'ACTIVE') return null;

  const permissions = new Set<string>();
  const roles: string[] = [];
  for (const ur of u.userRoles) {
    roles.push(ur.role.code);
    for (const rp of ur.role.rolePermissions) permissions.add(rp.permission.code);
  }
  return {
    id: u.id, email: u.email, name: u.name, permissions: [...permissions], roles,
    employeeId: u.employeeId, mustChangePassword: u.mustChangePassword,
  };
}

// ---------------------------------------------------------------- middleware

const ALLOWED_BEFORE_PASSWORD_CHANGE = new Set(['/auth/me', '/auth/change-password']);

/** Mật khẩu tạm: 12 ký tự, đủ chữ hoa, chữ thường, số — đưa cho người dùng một lần */
export function tempPassword() {
  const pick = (set: string, n: number) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join('');
  const raw = pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 3) + pick('abcdefghijkmnpqrstuvwxyz', 5) + pick('23456789', 3) + '!';
  return raw.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

/** Chính sách mật khẩu tối thiểu */
export function passwordProblem(p: string): string | null {
  if (Buffer.byteLength(p, 'utf8') > 72) return 'Mật khẩu vượt giới hạn 72 byte';
  if (p.length < 10) return 'Mật khẩu tối thiểu 10 ký tự';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Mật khẩu phải có cả chữ và số';
  return null;
}

/** Danh sách id nhân sự mà user được xem: theo phạm vi đơn vị + cấp dưới trực tiếp/gián tiếp (theo managerId). null = toàn bộ */
export async function visibleEmployeeIds(user: AuthUser): Promise<Set<string> | null> {
  const scope = await resolveScope(user);
  if (scope === null) return null;
  const ids = new Set<string>();
  if (scope.length) {
    for (const e of await prisma.employee.findMany({ where: { orgUnitId: { in: scope } }, select: { id: true } })) ids.add(e.id);
  }
  if (user.employeeId) {
    ids.add(user.employeeId);
    const all = await prisma.employee.findMany({ select: { id: true, managerId: true } });
    const kids = new Map<string, string[]>();
    for (const e of all) if (e.managerId) kids.set(e.managerId, [...(kids.get(e.managerId) ?? []), e.id]);
    const walk = (id: string, depth: number) => {
      if (depth > 20) return;
      for (const k of kids.get(id) ?? []) { if (!ids.has(k)) { ids.add(k); walk(k, depth + 1); } }
    };
    walk(user.employeeId, 0);
  }
  return ids;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu access token' });
  }
  let payload: { sub: string; workspace?: string };
  try {
    payload = jwt.verify(header.slice(7), ACCESS_SECRET) as typeof payload;
    if (payload.workspace !== currentWorkspace()?.code) throw new Error('Sai công ty');
  } catch {
    return res.status(401).json({ error: 'Access token hết hạn hoặc không hợp lệ' });
  }
  let user: AuthUser | null;
  try {
    user = await loadAuthUser(payload.sub);
  } catch {
    // Lỗi cơ sở dữ liệu — không báo nhầm thành "hết phiên đăng nhập"
    return res.status(503).json({ error: 'Máy chủ tạm thời không kết nối được cơ sở dữ liệu. Thử lại sau ít phút.' });
  }
  if (!user) return res.status(401).json({ error: 'Tài khoản không hợp lệ hoặc đã bị khoá' });
  req.user = user;
  // QĐ-07: tài khoản phải đổi mật khẩu trước khi dùng bất kỳ chức năng nào khác
  if (user.mustChangePassword && !ALLOWED_BEFORE_PASSWORD_CHANGE.has(req.path)) {
    return res.status(428).json({ error: 'Bạn cần đổi mật khẩu trước khi tiếp tục', mustChangePassword: true });
  }
  next();
}

/// Chặn theo quyền. Đây chính là phần bản AI Studio còn thiếu — persona chỉ đổi nhãn, không chặn.
export function requirePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    const ok = codes.some((c) => req.user!.permissions.includes(c));
    if (!ok) {
      return res.status(403).json({
        error: 'Không đủ quyền',
        required: codes,
        yourPermissions: req.user.permissions,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------- phạm vi dữ liệu

/**
 * Trả về danh sách orgUnitId mà user được phép nhìn thấy.
 * null = không giới hạn (chỉ dành cho quyền org:read_all).
 * Có xử lý includeSubtree bằng cách duyệt cây xuống dưới.
 */
export async function resolveScope(user: AuthUser): Promise<string[] | null> {
  if (user.permissions.includes('org:read_all')) return null;

  const scopes = await prisma.userScope.findMany({
    where: {
      userId: user.id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (scopes.length === 0) return [];

  const all = await prisma.orgUnit.findMany({ select: { id: true, parentId: true } });
  const childMap = new Map<string, string[]>();
  for (const u of all) {
    if (!u.parentId) continue;
    const arr = childMap.get(u.parentId) ?? [];
    arr.push(u.id);
    childMap.set(u.parentId, arr);
  }

  const visible = new Set<string>();
  const walk = (id: string) => {
    if (visible.has(id)) return;
    visible.add(id);
    for (const c of childMap.get(id) ?? []) walk(c);
  };

  for (const s of scopes) {
    if (s.includeSubtree) walk(s.orgUnitId);
    else visible.add(s.orgUnitId);
  }
  return [...visible];
}

/// Ghi nhật ký — bắt buộc với mọi thao tác ghi
export async function audit(
  req: Request,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'PUBLISH' | 'ARCHIVE' | 'IMPORT' | 'EXPORT',
  entityType: string,
  entityId: string,
  data?: { entityName?: string; oldValues?: unknown; newValues?: unknown },
) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      entityName: data?.entityName ?? null,
      actorId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? null,
      oldValues: (data?.oldValues ?? null) as never,
      newValues: (data?.newValues ?? null) as never,
    },
  });
}
