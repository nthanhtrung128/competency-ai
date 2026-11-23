import 'dotenv/config';

/**
 * Kiểm tra toàn hệ thống bằng một lệnh: npm run smoke
 * Không cần biết curl. Chạy được cả với máy chủ local lẫn Render.
 *
 *   npm run smoke                          → kiểm tra http://localhost:8080
 *   npm run smoke -- https://x.onrender.com → kiểm tra máy chủ đã deploy
 */

const BASE = (process.argv[2] ?? process.env.API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const PASSWORD = process.env.SEED_PASSWORD ?? 'Flamingo@2026';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, detail = '') {
  pass++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
}
function no(name: string, reason: string) {
  fail++;
  failures.push(`${name}: ${reason}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}\n      \x1b[31m${reason}\x1b[0m`);
}

async function req(path: string, opts: RequestInit = {}, token?: string) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await r.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: r.status, body };
}

async function login(email: string) {
  const r = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return r.status === 200 ? (r.body.accessToken as string) : null;
}

async function main() {
  console.log(`\n\x1b[1mKiểm tra hệ thống CompetencyAI\x1b[0m`);
  console.log(`Máy chủ: ${BASE}\n`);

  // ---------------------------------------------------------- 1. Máy chủ sống
  console.log('\x1b[1m1 · Máy chủ và cơ sở dữ liệu\x1b[0m');
  try {
    const h = await req('/health');
    if (h.status !== 200) no('Máy chủ phản hồi', `HTTP ${h.status}`);
    else if (h.body.db !== 'connected') no('Kết nối CSDL', 'Máy chủ chạy nhưng không tới được database');
    else ok('Máy chủ và CSDL', 'sẵn sàng');
  } catch (e) {
    no('Máy chủ phản hồi', `Không kết nối được: ${(e as Error).message}`);
    console.log('\n\x1b[33mDừng kiểm tra — máy chủ chưa chạy. Chạy "npm run dev" trước.\x1b[0m\n');
    process.exit(1);
  }

  // ---------------------------------------------------------- 2. Đăng nhập
  console.log('\n\x1b[1m2 · Đăng nhập và cấp token\x1b[0m');
  const wrong = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@flamingo.vn', password: 'sai-mat-khau' }),
  });
  if (wrong.status === 401) ok('Từ chối mật khẩu sai');
  else no('Từ chối mật khẩu sai', `Trả về ${wrong.status}, đáng lẽ 401`);

  const admin = await login('admin@flamingo.vn');
  const hrbp = await login('hrbp@flamingo.vn');
  const employee = await login('manager@flamingo.vn');

  if (admin) ok('Đăng nhập Quản trị hệ thống');
  else no('Đăng nhập Quản trị hệ thống', 'Không lấy được token. Đã chạy "npm run seed" chưa?');

  if (hrbp) ok('Đăng nhập HRBP');
  else no('Đăng nhập HRBP', 'Không lấy được token');

  if (!admin) {
    console.log('\n\x1b[33mDừng — chưa có tài khoản. Chạy "npm run seed".\x1b[0m\n');
    process.exit(1);
  }

  // ---------------------------------------------------------- 3. Chặn khi không có token
  console.log('\n\x1b[1m3 · Chặn truy cập không có token\x1b[0m');
  const anon = await req('/api/org-units');
  if (anon.status === 401) ok('Chặn request không đăng nhập');
  else no('Chặn request không đăng nhập', `Trả về ${anon.status}, đáng lẽ 401 — DỮ LIỆU ĐANG BỊ LỘ`);

  // ---------------------------------------------------------- 4. Phạm vi dữ liệu
  console.log('\n\x1b[1m4 · Phạm vi dữ liệu (điểm bản AI Studio còn thiếu)\x1b[0m');
  const adminUnits = await req('/api/org-units', {}, admin);
  const adminCount = (adminUnits.body.count as number) ?? 0;
  if (adminCount > 0) ok('Quản trị xem được toàn bộ đơn vị', `${adminCount} đơn vị`);
  else no('Quản trị xem đơn vị', 'Không thấy đơn vị nào. Đã seed chưa?');

  if (hrbp) {
    const hrbpUnits = await req('/api/org-units', {}, hrbp);
    const hrbpCount = (hrbpUnits.body.count as number) ?? 0;
    const scoped = hrbpUnits.body.scopeApplied === true;

    if (scoped && hrbpCount < adminCount && hrbpCount > 0) {
      ok('HRBP bị giới hạn phạm vi', `${hrbpCount}/${adminCount} đơn vị — đúng như thiết kế`);
    } else if (hrbpCount >= adminCount) {
      no(
        'HRBP bị giới hạn phạm vi',
        `HRBP thấy ${hrbpCount} đơn vị, bằng Quản trị (${adminCount}). Phân quyền KHÔNG chặn dữ liệu.`,
      );
    } else {
      no('HRBP bị giới hạn phạm vi', `Thấy ${hrbpCount} đơn vị, scopeApplied=${scoped}`);
    }

    const units = (hrbpUnits.body.units ?? []) as Array<{ code: string }>;
    const codes = units.map((u) => u.code);
    if (codes.length && !codes.includes('K1') && !codes.includes('K3')) {
      ok('HRBP không thấy Khối ngoài phạm vi', 'không có K1, K3');
    } else if (codes.includes('K1') || codes.includes('K3')) {
      no('HRBP không thấy Khối ngoài phạm vi', `Vẫn thấy: ${codes.filter((c) => c === 'K1' || c === 'K3').join(', ')}`);
    }
  }

  // ---------------------------------------------------------- 5. Chặn theo quyền
  console.log('\n\x1b[1m5 · Chặn theo quyền\x1b[0m');
  if (employee) {
    const r = await req('/api/audit-logs', {}, employee);
    if (r.status === 403) ok('Quản lý trực tiếp không xem được nhật ký', 'bị chặn 403');
    else if (r.status === 200) no('Chặn nhật ký', 'Tài khoản không đủ quyền vẫn xem được nhật ký hệ thống');
    else no('Chặn nhật ký', `Trả về ${r.status}`);
  }
  const auditAdmin = await req('/api/audit-logs', {}, admin);
  if (auditAdmin.status === 200) ok('Quản trị xem được nhật ký', `${(auditAdmin.body.count as number) ?? 0} bản ghi`);
  else no('Quản trị xem nhật ký', `Trả về ${auditAdmin.status}`);

  // ---------------------------------------------------------- 6. Ràng buộc tier
  console.log('\n\x1b[1m6 · Ràng buộc cây tổ chức\x1b[0m');
  const tree = await req('/api/org-units/tree', {}, admin);
  if (tree.status === 200 && Array.isArray(tree.body.tree)) ok('Lấy được cây tổ chức');
  else no('Lấy cây tổ chức', `Trả về ${tree.status}`);

  const all = (adminUnits.body.units ?? []) as Array<{ id: string; tier: number; code: string }>;
  const parent = all.find((u) => u.code === 'K1');
  if (parent) {
    const bad = await req(
      '/api/org-units',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'TEST_TIER_' + Date.now(),
          name: 'Đơn vị kiểm thử tier sai',
          tier: parent.tier, // cố tình bằng tier cha → phải bị từ chối
          parentId: parent.id,
        }),
      },
      admin,
    );
    if (bad.status === 400) ok('Từ chối tier con ≤ tier cha', 'ràng buộc hoạt động');
    else no('Từ chối tier con ≤ tier cha', `Trả về ${bad.status} — ràng buộc KHÔNG hoạt động, cây tổ chức có thể sai`);
  }

  // ---------------------------------------------------------- 7. Từ điển năng lực
  console.log('\n\x1b[1m7 · Từ điển năng lực\x1b[0m');
  const comps = await req('/api/competencies', {}, admin);
  const n = (comps.body.count as number) ?? 0;
  if (n > 0) {
    ok('Đọc được từ điển', `${n} năng lực`);
    const orphan = (comps.body.khongCoChuSoHuu as number) ?? 0;
    if (orphan > 0) {
      console.log(`      \x1b[33m⚠ ${orphan} năng lực chưa có đơn vị chủ quản — cần chốt quyết định cơ cấu\x1b[0m`);
    }
  } else {
    console.log('      \x1b[33m⚠ Chưa có năng lực nào. Chạy: npm run seed:competencies -- ./data/flamingo_seed_data.json\x1b[0m');
  }

  // ---------------------------------------------------------- 8. Giao diện & Job Architecture
  console.log('\n\x1b[1m8 · Dữ liệu cho giao diện (bootstrap) & Job Architecture\x1b[0m');
  const boot = await req('/api/bootstrap', {}, admin);
  if (boot.status === 200) {
    const roles = (boot.body.jobRoles as Array<{ requirements: Array<{ mappingStatus: string }> }>) ?? [];
    const units = (boot.body.orgUnits as unknown[]) ?? [];
    ok('GET /api/bootstrap', `${units.length} đơn vị · ${(boot.body.competencies as unknown[])?.length ?? 0} năng lực · ${roles.length} vai trò`);
    if (roles.length === 0) {
      console.log('      \x1b[33m⚠ Chưa có Job Role. Chạy: npm run seed:job-architecture\x1b[0m');
    } else {
      const all = roles.flatMap((r) => r.requirements);
      const c = (k: string) => all.filter((q) => q.mappingStatus === k).length;
      console.log(`      Yêu cầu năng lực: đã duyệt ${c('APPROVED')} · đề xuất ${c('PROPOSED')} · chưa đối chiếu ${c('UNMAPPED')}`);
    }
  } else {
    no('GET /api/bootstrap', `Trả về ${boot.status} — giao diện sẽ không kết nối được`);
  }

  // Bản đã ban hành KHÔNG được sửa trực tiếp
  const compsFull = (comps.body.competencies as Array<{ versions: Array<{ id: string }> }>) ?? [];
  const pubId = compsFull.find((c) => c.versions.length > 0)?.versions[0]?.id;
  if (pubId) {
    const edit = await req(`/api/competency-versions/${pubId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'thử sửa bản đã ban hành' }),
    }, admin);
    if (edit.status === 409) ok('Chặn sửa trực tiếp bản đã ban hành', 'phải tạo bản nháp');
    else no('Chặn sửa trực tiếp bản đã ban hành', `Trả về ${edit.status} — versioning bị phá vỡ`);
  }

  // ---------------------------------------------------------- 9. 360° / 9-Box / IDP / Tài khoản (chỉ đọc)
  console.log('\n\x1b[1m9 · Đánh giá 360°, 9-Box, IDP, tài khoản\x1b[0m');
  const camps = await req('/api/campaigns', {}, admin);
  if (camps.status === 200) ok('Đọc danh sách chiến dịch 360°', `${(camps.body.campaigns as unknown[]).length} chiến dịch`);
  else no('Đọc danh sách chiến dịch 360°', `Trả về ${camps.status}`);
  const nine = await req('/api/talent-reviews?cycle=2026', {}, admin);
  if (nine.status === 200) ok('Đọc 9-Box', `${(nine.body.employees as unknown[]).length} nhân sự trong phạm vi`);
  else no('Đọc 9-Box', `Trả về ${nine.status}`);
  const idps = await req('/api/idp', {}, admin);
  if (idps.status === 200) ok('Đọc IDP', `${(idps.body.plans as unknown[]).length} kế hoạch`);
  else no('Đọc IDP', `Trả về ${idps.status}`);
  const mgrUsers = await req('/api/users', {}, employee ?? undefined);
  if (mgrUsers.status === 403) ok('Quản lý không quản trị được tài khoản', 'bị chặn 403');
  else no('Quản lý không quản trị được tài khoản', `Trả về ${mgrUsers.status}`);

  // ---------------------------------------------------------- Tổng kết
  console.log('\n' + '─'.repeat(58));
  if (fail === 0) {
    console.log(`\x1b[32m\x1b[1m  ĐẠT — ${pass}/${pass} mục kiểm tra thành công\x1b[0m`);
    console.log('  Hệ thống sẵn sàng. Mở web/import-console.html để nhập nhân sự.\n');
  } else {
    console.log(`\x1b[31m\x1b[1m  CHƯA ĐẠT — ${pass} đạt, ${fail} lỗi\x1b[0m\n`);
    for (const f of failures) console.log(`  • ${f}`);
    console.log('');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n\x1b[31mLỗi khi chạy kiểm tra:\x1b[0m', e.message);
  process.exit(1);
});
