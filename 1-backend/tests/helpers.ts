import 'dotenv/config';
import { prisma } from '../src/db.js';

/**
 * Phần dùng chung cho các kịch bản kiểm thử đầu-cuối (tests/e2e-*.ts).
 *
 * AN TOÀN: kịch bản GHI dữ liệu thử vào cơ sở dữ liệu (nhân sự mã TESTxxx-…, chiến dịch, IDP…) rồi dọn lại.
 * Vì vậy chỉ chạy trên máy chủ + CSDL cục bộ. Muốn chạy với CSDL từ xa (vd nhánh Neon dành riêng cho thử nghiệm)
 * phải đặt ALLOW_REMOTE_TEST_DB=1 — KHÔNG BAO GIỜ trỏ vào CSDL thật đang có nhân sự thật.
 */

export { prisma };

export const BASE = (process.env.API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Flamingo@2026';
export const NEW_PASSWORD = 'KiemThu@2026x';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function assertSafeTarget() {
  const api = new URL(BASE);
  let dbHost = '';
  try {
    dbHost = new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    /* để trống → báo lỗi bên dưới */
  }
  const remoteOk = process.env.ALLOW_REMOTE_TEST_DB === '1';
  if (!LOCAL.test(api.hostname) && !remoteOk) {
    console.error(`\n✖ Từ chối chạy: API_URL (${api.hostname}) không phải máy cục bộ. Kịch bản kiểm thử ghi dữ liệu thử.\n`);
    process.exit(2);
  }
  if (!LOCAL.test(dbHost) && !remoteOk) {
    console.error(
      `\n✖ Từ chối chạy: DATABASE_URL trỏ tới "${dbHost || '(trống)'}", không phải máy cục bộ.\n` +
        '  Kịch bản kiểm thử ghi rồi xoá dữ liệu thử — không chạy trên CSDL thật.\n' +
        '  Dùng Postgres cục bộ/Docker (xem tests/README.md). Nếu đây là CSDL RIÊNG cho thử nghiệm: đặt ALLOW_REMOTE_TEST_DB=1.\n',
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------- báo cáo kết quả

export class Tester {
  pass = 0;
  fail = 0;
  failures: string[] = [];
  constructor(public title: string) {
    console.log(`\n\x1b[1m${title}\x1b[0m`);
    console.log(`Máy chủ: ${BASE}`);
  }
  section(name: string) {
    console.log(`\n\x1b[1m${name}\x1b[0m`);
  }
  check(name: string, cond: unknown, detail = '') {
    if (cond) {
      this.pass++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } else {
      this.fail++;
      this.failures.push(`${name}${detail ? ' — ' + detail : ''}`);
      console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? `\n      \x1b[31m${detail}\x1b[0m` : ''}`);
    }
    return !!cond;
  }
  /** So sánh bằng, tự in giá trị thực tế khi sai */
  eq(name: string, actual: unknown, expected: unknown) {
    return this.check(name, JSON.stringify(actual) === JSON.stringify(expected), `thực tế ${JSON.stringify(actual)}, kỳ vọng ${JSON.stringify(expected)}`);
  }
  /** Kiểm tra mã HTTP, in kèm phần thân lỗi khi sai */
  status(name: string, r: Res, expected: number) {
    return this.check(name, r.status === expected, `HTTP ${r.status}, kỳ vọng ${expected} — ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  near(name: string, actual: unknown, expected: number, tol = 0.011) {
    return this.check(name, typeof actual === 'number' && Math.abs(actual - expected) <= tol, `thực tế ${JSON.stringify(actual)}, kỳ vọng ≈ ${expected}`);
  }
  finish() {
    console.log('\n' + '─'.repeat(58));
    if (this.fail === 0) {
      console.log(`\x1b[32m\x1b[1m  ĐẠT — ${this.pass}/${this.pass}\x1b[0m  (${this.title})\n`);
      return 0;
    }
    console.log(`\x1b[31m\x1b[1m  CHƯA ĐẠT — ${this.pass} đạt, ${this.fail} lỗi\x1b[0m  (${this.title})\n`);
    for (const f of this.failures) console.log(`  • ${f}`);
    console.log('');
    return 1;
  }
}

// ---------------------------------------------------------------- gọi API

export type Res = { status: number; body: any; text: string };

export async function api(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; token?: string | null } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const r = await fetch(BASE + path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  const text = await r.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: r.status, body: parsed, text };
}

export async function loginRaw(email: string, password: string) {
  return api('/api/auth/login', { body: { email, password } });
}

/** Đăng nhập tài khoản mẫu (seed). Dừng cả kịch bản nếu không được — các bước sau vô nghĩa. */
export async function seedLogin(email: string) {
  const r = await loginRaw(email, SEED_PASSWORD);
  if (r.status !== 200) {
    console.error(`\n✖ Không đăng nhập được ${email} (HTTP ${r.status}). Đã chạy "npm run seed:all" chưa? Mật khẩu mẫu có bị đổi không?\n`);
    process.exit(2);
  }
  return r.body.accessToken as string;
}

export async function health() {
  try {
    const h = await api('/health');
    return h.status === 200 && h.body.db === 'connected';
  } catch {
    return false;
  }
}

export function csvForm(lines: string[][], filename = 'phieu.csv') {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = lines.map((l) => l.map(esc).join(',')).join('\n');
  const fd = new FormData();
  fd.append('file', new Blob([csv], { type: 'text/csv' }), filename);
  return fd;
}

// ---------------------------------------------------------------- dữ liệu thử

/** Tiền tố riêng cho mỗi kịch bản để hai kịch bản không đụng nhau và dọn được chính xác */
export const emp = (p: string, n: string) => `${p}-${n}`;
export const mail = (p: string, n: string) => `${p.toLowerCase()}-${n.toLowerCase()}@test.invalid`;

/**
 * Cây nhân sự thử, đặt trong đơn vị B01:
 *   D1 (không có quản lý)
 *    └─ M1
 *        ├─ E1, E2, E3
 * kèm một đơn vị rỗng `${p}-EMPTY` để thử phạm vi dữ liệu (tài khoản gắn vào đây thấy 0 nhân sự).
 */
export async function createFixtures(p: string, names: string[] = ['D1', 'M1', 'E1', 'E2', 'E3'], managers: Record<string, string | null> = { D1: null, M1: 'D1', E1: 'M1', E2: 'M1', E3: 'M1' }) {
  const unit = await prisma.orgUnit.findUnique({ where: { code: 'B01' } });
  if (!unit) {
    console.error('\n✖ Không có đơn vị B01 trong CSDL. Chạy "npm run seed:all" trước.\n');
    process.exit(2);
  }
  await prisma.orgUnit.create({ data: { code: `${p}-EMPTY`, name: `Đơn vị rỗng ${p}`, tier: 9 } });
  const ids: Record<string, string> = {};
  for (const n of names) {
    const e = await prisma.employee.create({
      data: {
        employeeCode: emp(p, n),
        fullName: `Nhân sự thử ${p} ${n}`,
        email: mail(p, n),
        jobTitle: 'Nhân sự thử nghiệm',
        orgUnitId: unit.id,
        managerId: managers[n] ? ids[managers[n]!] : null,
      },
    });
    ids[n] = e.id;
  }
  return { ids, unitId: unit.id };
}

/** Xoá toàn bộ dữ liệu thử của một tiền tố. Chạy ở đầu (dọn lần chạy hỏng trước) và ở cuối. */
export async function cleanup(p: string) {
  const code = `${p}-`;
  await prisma.user.deleteMany({ where: { email: { startsWith: `${p.toLowerCase()}-` } } });
  await prisma.assessmentCampaign.deleteMany({ where: { code: { startsWith: code } } });
  await prisma.successionPlan.deleteMany({ where: { positionTitle: { startsWith: `[${p}]` } } });
  await prisma.jobRole.deleteMany({ where: { code: { startsWith: code } } });
  await prisma.employee.deleteMany({ where: { employeeCode: { startsWith: code } } });
  await prisma.orgUnit.deleteMany({ where: { code: { startsWith: code } } });
}

/** Cấp tài khoản qua API như HR thật làm, rồi đổi mật khẩu tạm để dùng được. Trả về token. */
export async function provisionAccount(
  admin: string,
  t: Tester,
  a: { email: string; name: string; role: 'HRBP' | 'LINE_MANAGER' | 'HR_LEAD'; employeeCode?: string; scopeOrgUnitCode?: string },
) {
  const c = await api('/api/users', { token: admin, body: a });
  t.status(`Cấp tài khoản ${a.role} ${a.email}`, c, 201);
  const temp = c.body.temporaryPassword as string;
  const first = await loginRaw(a.email, temp);
  const tok = first.body.accessToken as string;
  const ch = await api('/api/auth/change-password', { token: tok, body: { currentPassword: temp, newPassword: NEW_PASSWORD } });
  t.status(`Đổi mật khẩu tạm ${a.email}`, ch, 200);
  const again = await loginRaw(a.email, NEW_PASSWORD);
  return { token: again.body.accessToken as string, userId: c.body.id as string };
}
