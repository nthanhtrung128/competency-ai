import {
  Tester, api, assertSafeTarget, cleanup, createFixtures, csvForm, health, loginRaw, mail, emp,
  NEW_PASSWORD, prisma, provisionAccount, seedLogin,
} from './helpers.js';

/**
 * KỊCH BẢN 1 — Tài khoản → Chiến dịch 360° → 9-Box → IDP
 * (viết lại từ kịch bản 46/46 đã chạy trên PostgreSQL 16; nội dung kiểm tra bám đúng mã nguồn hiện tại)
 *
 * Nhân sự thử (đơn vị B01): D1 → M1 → E1, E2, E3.
 * Người được đánh giá: M1 (cấp dưới 3 người → đủ ngưỡng ẩn danh) và E1 (đồng nghiệp chỉ 2 → bị ẩn).
 */
const P = 'T360';
const CYCLE = '2099';
const t = new Tester('Kịch bản 1 · Tài khoản → 360° → 9-Box → IDP');

async function main() {
  assertSafeTarget();
  if (!(await health())) {
    console.error('\n✖ Máy chủ chưa chạy hoặc chưa nối được CSDL. Chạy "npm run test" (tự bật máy chủ) hoặc "npm run dev" trước.\n');
    process.exit(2);
  }
  await cleanup(P);
  try {
    await run();
  } finally {
    await cleanup(P);
    await prisma.$disconnect();
  }
  process.exit(t.finish());
}

async function run() {
  const admin = await seedLogin('admin@flamingo.vn');
  const hrlead = await seedLogin('hrlead@flamingo.vn');

  // ------------------------------------------------------------ 1. Chọn năng lực & dựng nhân sự
  t.section('1 · Chuẩn bị: năng lực đã ban hành + nhân sự thử');
  const comps = await api('/api/competencies', { token: admin });
  const usable = (comps.body.competencies as any[]).filter((c) => c.currentVersionId && c.scaleId);
  const cor = usable.filter((c) => c.category.code === 'COR').slice(0, 2).map((c) => c.code as string);
  const lea = usable.filter((c) => c.category.code === 'LEA').slice(0, 2).map((c) => c.code as string);
  if (!t.check('Có ≥ 2 năng lực Cốt lõi và ≥ 2 Lãnh đạo đã ban hành, có thang điểm', cor.length === 2 && lea.length === 2, `Cốt lõi: ${cor}; Lãnh đạo: ${lea}. Đã chạy "npm run seed:all" chưa?`)) return;
  const codes = [...cor, ...lea];
  await createFixtures(P);
  t.check('Tạo 5 nhân sự thử + 1 đơn vị rỗng', true);

  // ------------------------------------------------------------ 2. Tài khoản
  t.section('2 · Tài khoản: cấp, đổi mật khẩu bắt buộc, đặt lại, khoá');
  const m1Email = mail(P, 'M1');
  const bad = await api('/api/users', { token: admin, body: { email: mail(P, 'x1'), name: 'Thiếu phạm vi', role: 'HRBP' } });
  t.status('HRBP không có phạm vi / hồ sơ → bị từ chối', bad, 400);

  const created = await api('/api/users', { token: admin, body: { email: m1Email, name: 'Quản lý thử M1', role: 'LINE_MANAGER', employeeCode: emp(P, 'M1') } });
  t.status('Cấp tài khoản LINE_MANAGER gắn hồ sơ M1', created, 201);
  const temp1 = created.body.temporaryPassword as string;
  t.check('Mật khẩu tạm có trong phản hồi (chỉ một lần)', typeof temp1 === 'string' && temp1.length >= 10);

  t.status('Cấp trùng email → 409', await api('/api/users', { token: admin, body: { email: m1Email, name: 'Trùng', role: 'LINE_MANAGER', employeeCode: emp(P, 'E1') } }), 409);
  t.status('Hồ sơ M1 đã có tài khoản → 409', await api('/api/users', { token: admin, body: { email: mail(P, 'm1b'), name: 'Trùng hồ sơ', role: 'LINE_MANAGER', employeeCode: emp(P, 'M1') } }), 409);
  t.status('Trưởng Ban NS không cấp được tài khoản ADMIN → 403', await api('/api/users', { token: hrlead, body: { email: mail(P, 'adm'), name: 'Thử ADMIN', role: 'ADMIN' } }), 403);

  const l1 = await loginRaw(m1Email, temp1);
  t.status('Đăng nhập bằng mật khẩu tạm', l1, 200);
  t.check('Cờ mustChangePassword = true', l1.body.mustChangePassword === true);
  const oldRefresh = l1.body.refreshToken as string;
  let m1 = l1.body.accessToken as string;

  const blocked = await api('/api/competencies', { token: m1 });
  t.status('Chưa đổi mật khẩu → mọi API trả 428', blocked, 428);
  t.status('Vẫn gọi được /auth/me để biết mình phải đổi', await api('/api/auth/me', { token: m1 }), 200);
  t.status('Mật khẩu hiện tại sai → 400', await api('/api/auth/change-password', { token: m1, body: { currentPassword: 'sai-roi', newPassword: NEW_PASSWORD } }), 400);
  t.status('Mật khẩu mới quá yếu → 400', await api('/api/auth/change-password', { token: m1, body: { currentPassword: temp1, newPassword: 'abc123' } }), 400);
  t.status('Mật khẩu mới trùng mật khẩu cũ → 400', await api('/api/auth/change-password', { token: m1, body: { currentPassword: temp1, newPassword: temp1 } }), 400);
  t.status('Đổi mật khẩu hợp lệ', await api('/api/auth/change-password', { token: m1, body: { currentPassword: temp1, newPassword: NEW_PASSWORD } }), 200);
  t.status('Sau khi đổi → dùng API bình thường', await api('/api/competencies', { token: m1 }), 200);

  const reset = await api(`/api/users/${created.body.id}/reset-password`, { token: admin, body: {} });
  t.status('Quản trị đặt lại mật khẩu', reset, 200);
  t.status('Mật khẩu cũ không còn đăng nhập được', await loginRaw(m1Email, NEW_PASSWORD), 401);
  t.status('Refresh token cũ bị thu hồi khi đặt lại mật khẩu', await api('/api/auth/refresh', { body: { refreshToken: oldRefresh } }), 401);
  const l2 = await loginRaw(m1Email, reset.body.temporaryPassword);
  t.check('Sau đặt lại → bị buộc đổi mật khẩu lần nữa', l2.status === 200 && l2.body.mustChangePassword === true);
  await api('/api/auth/change-password', { token: l2.body.accessToken, body: { currentPassword: reset.body.temporaryPassword, newPassword: NEW_PASSWORD } });
  m1 = (await loginRaw(m1Email, NEW_PASSWORD)).body.accessToken;

  t.status('Quản lý không xem được danh sách tài khoản → 403', await api('/api/users', { token: m1 }), 403);
  t.status('Quản lý không xem được nhật ký hệ thống → 403', await api('/api/audit-logs', { token: m1 }), 403);

  const me = await api('/api/auth/me', { token: admin });
  t.status('Không tự khoá chính mình → 400', await api(`/api/users/${me.body.id}`, { token: admin, method: 'PATCH', body: { status: 'INACTIVE' } }), 400);
  t.status('Khoá tài khoản M1', await api(`/api/users/${created.body.id}`, { token: admin, method: 'PATCH', body: { status: 'INACTIVE' } }), 200);
  t.status('Tài khoản bị khoá không đăng nhập được', await loginRaw(m1Email, NEW_PASSWORD), 401);
  t.status('Token cũ của tài khoản bị khoá bị từ chối', await api('/api/competencies', { token: m1 }), 401);
  t.status('Mở khoá lại', await api(`/api/users/${created.body.id}`, { token: admin, method: 'PATCH', body: { status: 'ACTIVE' } }), 200);
  m1 = (await loginRaw(m1Email, NEW_PASSWORD)).body.accessToken;

  const prov = await api('/api/users/provision-managers', { token: admin, body: {} });
  t.check('Cấp hàng loạt cho quản lý: chạy thử (dry-run) liệt kê D1, chưa tạo gì',
    prov.status === 200 && prov.body.dryRun === true && (prov.body.willCreate as any[]).some((w) => w.email === mail(P, 'D1')));
  t.eq('…và quả thật chưa tạo tài khoản D1', await prisma.user.count({ where: { email: mail(P, 'D1') } }), 0);

  const hrbp = await provisionAccount(admin, t, { email: mail(P, 'hrbp'), name: 'HRBP phạm vi rỗng', role: 'HRBP', scopeOrgUnitCode: `${P}-EMPTY` });

  // ------------------------------------------------------------ 3. Chiến dịch
  t.section('3 · Chiến dịch 360°: tạo, thêm người, mở (chốt phiên bản)');
  const camp = await api('/api/campaigns', { token: admin, body: { code: `${P}-C1`, name: 'Chiến dịch thử 360°', competencyCodes: codes } });
  t.status('Tạo chiến dịch', camp, 201);
  const cid = camp.body.id as string;
  t.status('Mã chiến dịch trùng → 409', await api('/api/campaigns', { token: admin, body: { code: `${P}-C1`, name: 'Trùng mã', competencyCodes: codes } }), 409);
  t.status('Mã năng lực không có trong Từ điển → 400', await api('/api/campaigns', { token: admin, body: { code: `${P}-C2`, name: 'Sai mã', competencyCodes: ['ZZ99'] } }), 400);
  t.status('HRBP không tạo được chiến dịch → 403', await api('/api/campaigns', { token: hrbp.token, body: { code: `${P}-C3`, name: 'Không quyền', competencyCodes: codes } }), 403);

  const empty = await api('/api/campaigns', { token: admin, body: { code: `${P}-C0`, name: 'Chiến dịch rỗng', competencyCodes: codes } });
  t.status('Mở chiến dịch chưa có người được đánh giá → 400', await api(`/api/campaigns/${empty.body.id}/open`, { token: admin, body: {} }), 400);

  const add = await api(`/api/campaigns/${cid}/participants`, { token: admin, body: { employeeCodes: [emp(P, 'M1'), emp(P, 'E1')] } });
  t.status('Thêm M1, E1 làm người được đánh giá', add, 200);
  t.eq('Tự sinh người đánh giá: M1 có 5 (tự, quản lý, 3 cấp dưới) + E1 có 4 (tự, quản lý, 2 đồng nghiệp) = 9', [add.body.addedParticipants, add.body.addedRaters], [2, 9]);
  const again = await api(`/api/campaigns/${cid}/participants`, { token: admin, body: { employeeCodes: [emp(P, 'M1')] } });
  t.eq('Thêm lại người đã có → bỏ qua, không nhân đôi', [again.body.addedParticipants, again.body.skipped], [0, 1]);

  const open = await api(`/api/campaigns/${cid}/open`, { token: admin, body: {} });
  t.status('Mở chiến dịch', open, 200);
  t.check('Chốt snapshot đúng 4 năng lực, mỗi năng lực gắn versionId', Array.isArray(open.body.snapshot) && open.body.snapshot.length === 4 && open.body.snapshot.every((s: any) => s.versionId));
  t.status('Mở lần hai → 409', await api(`/api/campaigns/${cid}/open`, { token: admin, body: {} }), 409);

  // ------------------------------------------------------------ 4. Phiếu đánh giá
  t.section('4 · Phiếu đánh giá: trên app (người có tài khoản) và HR nhập hộ (QĐ-07)');
  const tasks = await api('/api/my/rater-tasks', { token: m1 });
  t.eq('M1 có 2 phiếu cần làm: tự đánh giá + đánh giá E1 (quản lý)', (tasks.body.tasks as any[]).map((x) => x.relation).sort(), ['MANAGER', 'SELF']);
  const selfTask = (tasks.body.tasks as any[]).find((x) => x.relation === 'SELF');
  const mgrTask = (tasks.body.tasks as any[]).find((x) => x.relation === 'MANAGER');
  const detail = await api(`/api/rater-tasks/${selfTask.id}`, { token: m1 });
  t.check('Phiếu hiện đủ 4 năng lực, mỗi năng lực có thang neo 5 mức', detail.status === 200 && detail.body.competencies.length === 4 && detail.body.competencies.every((c: any) => c.anchors.length === 5));
  t.status('Người khác (HRBP) không mở được phiếu của M1 → 403', await api(`/api/rater-tasks/${selfTask.id}`, { token: hrbp.token }), 403);
  const adminTasks = await api('/api/my/rater-tasks', { token: admin });
  t.check('Tài khoản không gắn hồ sơ nhân sự → linked=false', adminTasks.body.linked === false);

  const fill = (levels: number[]) => codes.map((c, i) => ({ code: c, level: levels[i] }));
  t.status('Nộp thiếu năng lực → 400', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: fill([4, 4, 4, 4]).slice(0, 2), submit: true } }), 400);
  t.status('Năng lực ngoài chiến dịch → 400', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: [{ code: 'ZZ99', level: 3 }] } }), 400);
  t.status('Mức ngoài 1–5 → 400', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: [{ code: codes[0], level: 6 }] } }), 400);
  t.status('M1 tự đánh giá (4,4,5,5) và nộp', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: fill([4, 4, 5, 5]), submit: true } }), 200);
  t.status('Sửa phiếu đã nộp → 409', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: fill([1, 1, 1, 1]) } }), 409);
  t.status('M1 chấm E1 với tư cách quản lý (2,2,2,2) và nộp', await api(`/api/rater-tasks/${mgrTask.id}`, { token: m1, method: 'PUT', body: { scores: fill([2, 2, 2, 2]), submit: true } }), 200);

  // Phiếu nhập hộ: ma_phieu, được đánh giá, quan hệ, người đánh giá, năng lực, mức, nhận xét
  const rows: Array<[string, string, string, string, number[]]> = [
    ['M1-D1', 'M1', 'MANAGER', 'D1', [4, 4, 5, 5]],
    ['M1-E1', 'M1', 'DIRECT_REPORT', 'E1', [3, 3, 4, 4]],
    ['M1-E2', 'M1', 'DIRECT_REPORT', 'E2', [3, 3, 4, 4]],
    ['M1-E3', 'M1', 'DIRECT_REPORT', 'E3', [3, 3, 4, 4]],
    ['E1-SELF', 'E1', 'SELF', 'E1', [4, 4, 4, 4]],
    ['E1-P2', 'E1', 'PEER', 'E2', [2, 2, 2, 2]],
    ['E1-P3', 'E1', 'PEER', 'E3', [3, 3, 3, 3]],
  ];
  const header = ['ma_phieu', 'ma_nv_duoc_danh_gia', 'quan_he', 'ma_nv_nguoi_danh_gia', 'ma_nang_luc', 'muc', 'nhan_xet'];
  const lines = (rs: typeof rows) => [header, ...rs.flatMap(([sheet, who, rel, by, lv]) => codes.map((c, i) => [sheet, emp(P, who), rel, emp(P, by), c, String(lv[i]), 'Nhận xét thử']))];

  const badLines = lines(rows).map((l) => [...l]);
  badLines[1][5] = '9';
  const dryBad = await api(`/api/campaigns/${cid}/import-responses`, { token: admin, form: csvForm(badLines) });
  t.check('File có mức 9 → bị từ chối, nêu rõ dòng lỗi', dryBad.status === 400 && dryBad.body.errors.some((e: string) => e.includes('Dòng 2')));
  const partial = lines(rows).filter((l, i) => !(i === 1)); // thiếu 1 năng lực của một phiếu
  const dryPartial = await api(`/api/campaigns/${cid}/import-responses`, { token: admin, form: csvForm(partial) });
  t.check('Phiếu thiếu năng lực → bị từ chối', dryPartial.status === 400 && dryPartial.body.errors.some((e: string) => e.includes('mới có 3/4')));
  const dry = await api(`/api/campaigns/${cid}/import-responses`, { token: admin, form: csvForm(lines(rows)) });
  t.check('File đúng → kiểm tra thử OK, 7 phiếu, chưa ghi', dry.status === 200 && dry.body.ok === true && dry.body.sheets === 7 && dry.body.committed === false);
  const stat0 = (await api('/api/campaigns', { token: admin })).body.campaigns.find((c: any) => c.id === cid);
  t.eq('Kiểm tra thử không ghi gì: mới nộp 2/9 (hai phiếu làm trên app)', [stat0.submitted, stat0.raters], [2, 9]);
  t.status('HRBP không nhập hộ được → 403', await api(`/api/campaigns/${cid}/import-responses?commit=1`, { token: hrbp.token, form: csvForm(lines(rows)) }), 403);
  const commit = await api(`/api/campaigns/${cid}/import-responses?commit=1`, { token: admin, form: csvForm(lines(rows)) });
  t.check('Nhập thật 7 phiếu', commit.status === 200 && commit.body.committed === true && commit.body.sheets === 7);
  const stat1 = (await api('/api/campaigns', { token: admin })).body.campaigns.find((c: any) => c.id === cid);
  t.eq('Đủ 9/9 phiếu (không tạo người đánh giá trùng)', [stat1.submitted, stat1.raters], [9, 9]);

  // ------------------------------------------------------------ 5. Kết quả & ẩn danh
  t.section('5 · Kết quả 360° và bảo vệ ẩn danh');
  const idOf = async (code: string) => (await prisma.employee.findUniqueOrThrow({ where: { employeeCode: emp(P, code) } })).id;
  const eM1 = await idOf('M1');
  const eE1 = await idOf('E1');
  const rM1 = await api(`/api/campaigns/${cid}/results/${eM1}`, { token: admin });
  t.status('Admin đọc kết quả M1', rM1, 200);
  const c0 = rM1.body.competencies[0];
  const l0 = rM1.body.competencies[2];
  t.near('M1 · Cốt lõi: trung bình người khác = (4+3+3+3)/4 = 3,25', c0.others, 3.25);
  t.near('M1 · Lãnh đạo: trung bình người khác = (5+4+4+4)/4 = 4,25', l0.others, 4.25);
  t.near('M1 · điểm tự đánh giá Lãnh đạo = 5; điểm mù = 0,75', l0.blindSpot, 0.75);
  t.eq('M1 · cấp dưới trả lời 3 người ≥ ngưỡng 3 → KHÔNG ẩn', rM1.body.raters.hiddenGroups, []);
  t.near('M1 · nhóm Cấp dưới hiện điểm (4) vì đủ ngưỡng', l0.directReport, 4);
  t.near('M1 · tổng hợp nhóm Lãnh đạo = 4,25', rM1.body.summary.leadership, 4.25);

  const rE1 = await api(`/api/campaigns/${cid}/results/${eE1}`, { token: admin });
  t.eq('E1 · đồng nghiệp trả lời 2 người < ngưỡng 3 → nhóm PEER bị ẩn', rE1.body.raters.hiddenGroups, ['PEER']);
  t.eq('E1 · điểm riêng nhóm Đồng nghiệp trả về null', rE1.body.competencies.every((c: any) => c.peer === null), true);
  t.near('E1 · điểm người khác vẫn tính gộp = (2+2+3)/3 = 2,33', rE1.body.competencies[0].others, 2.33);
  t.near('E1 · điểm quản lý (M1 chấm trên app) = 2', rE1.body.competencies[0].manager, 2);
  t.eq('E1 · không có yêu cầu vai trò → gap = null', rE1.body.competencies[0].gap, null);

  const viaSelf = await api(`/api/campaigns/${cid}/results/${eM1}`, { token: m1 });
  t.status('M1 xem được kết quả của chính mình', viaSelf, 200);
  t.status('HRBP phạm vi rỗng KHÔNG xem được kết quả M1 → 403', await api(`/api/campaigns/${cid}/results/${eM1}`, { token: hrbp.token }), 403);
  const dTree = await api(`/api/campaigns/${cid}`, { token: hrbp.token });
  t.check('Người không quản trị chiến dịch không thấy danh tính người đánh giá nhóm Đồng nghiệp/Cấp dưới',
    dTree.status === 200 && dTree.body.participants.length === 0);
  const dAdmin = await api(`/api/campaigns/${cid}`, { token: admin });
  const peerRaters = dAdmin.body.participants.flatMap((p: any) => p.raters).filter((r: any) => r.relation === 'PEER');
  t.check('Quản trị chiến dịch thấy danh tính người đánh giá', peerRaters.length === 2 && peerRaters.every((r: any) => r.rater?.employeeCode));
  const m1Detail = await api(`/api/campaigns/${cid}`, { token: m1 });
  const hiddenIdentity = m1Detail.status === 200 ? m1Detail.body.participants.flatMap((p: any) => p.raters).filter((r: any) => r.relation === 'DIRECT_REPORT' || r.relation === 'PEER') : [];
  t.check('Quản lý thường: danh tính nhóm Cấp dưới/Đồng nghiệp bị ẩn (rater = null)',
    m1Detail.status === 403 || hiddenIdentity.every((r: any) => r.rater === null));

  // ------------------------------------------------------------ 6. Đóng chiến dịch
  t.section('6 · Đóng chiến dịch');
  t.status('Xoá phiếu đã nộp → 409',
    await api(`/api/raters/${(await prisma.assessmentRater.findFirstOrThrow({ where: { participant: { campaignId: cid }, status: 'SUBMITTED' } })).id}`, { token: admin, method: 'DELETE' }), 409);
  t.status('Đóng chiến dịch', await api(`/api/campaigns/${cid}/close`, { token: admin, body: {} }), 200);
  t.status('Đóng lần hai → 409', await api(`/api/campaigns/${cid}/close`, { token: admin, body: {} }), 409);
  t.status('Sau khi đóng: nhập phiếu bị chặn → 409', await api(`/api/campaigns/${cid}/import-responses?commit=1`, { token: admin, form: csvForm(lines(rows)) }), 409);
  t.status('Sau khi đóng: thêm người được đánh giá bị chặn → 409', await api(`/api/campaigns/${cid}/participants`, { token: admin, body: { employeeCodes: [emp(P, 'E2')] } }), 409);
  t.status('Sau khi đóng: sửa phiếu bị chặn → 409', await api(`/api/rater-tasks/${selfTask.id}`, { token: m1, method: 'PUT', body: { scores: fill([1, 1, 1, 1]) } }), 409);

  const sum = await api(`/api/campaigns/${cid}/summary`, { token: admin });
  const sM1 = sum.body.participants.find((x: any) => x.employee.employeeCode === emp(P, 'M1'));
  const sE1 = sum.body.participants.find((x: any) => x.employee.employeeCode === emp(P, 'E1'));
  t.eq('Gợi ý Tiềm năng [PROPOSAL]: M1 Lãnh đạo 4,25 → Cao (3)', sM1.suggestedPotential, 3);
  t.eq('Gợi ý Tiềm năng [PROPOSAL]: E1 Lãnh đạo 2,33 → Thấp (1)', sE1.suggestedPotential, 1);

  // ------------------------------------------------------------ 7. 9-Box
  t.section('7 · 9-Box (liên thông từ 360°)');
  const nb = await api(`/api/talent-reviews?cycle=${CYCLE}`, { token: admin });
  const nbM1 = nb.body.employees.find((e: any) => e.employeeCode === emp(P, 'M1'));
  t.check('9-Box lấy gợi ý từ chiến dịch đã đóng gần nhất', nb.body.sourceCampaign?.code === `${P}-C1` && nbM1?.suggestion?.potential === 3);
  t.status('Hiệu suất ngoài 1–3 → 400', await api('/api/talent-reviews', { token: admin, method: 'PUT', body: { cycle: CYCLE, employeeId: eM1, performance: 4, potential: 3 } }), 400);
  const putM1 = await api('/api/talent-reviews', { token: admin, method: 'PUT', body: { cycle: CYCLE, employeeId: eM1, performance: 3, potential: 3 } });
  t.eq('M1: hiệu suất 3 × tiềm năng 3 → ô 9', putM1.body.box, 9);
  const putE1 = await api('/api/talent-reviews', { token: admin, method: 'PUT', body: { cycle: CYCLE, employeeId: eE1, performance: 2, potential: 1 } });
  t.eq('E1: hiệu suất 2 × tiềm năng 1 → ô 2', putE1.body.box, 2);
  t.status('HRBP phạm vi rỗng xếp 9-Box cho M1 → 403', await api('/api/talent-reviews', { token: hrbp.token, method: 'PUT', body: { cycle: CYCLE, employeeId: eM1, performance: 3, potential: 3 } }), 403);
  const nbH = await api(`/api/talent-reviews?cycle=${CYCLE}`, { token: hrbp.token });
  t.check('HRBP phạm vi rỗng không thấy nhân sự thử trong danh sách 9-Box', nbH.status === 200 && !nbH.body.employees.some((e: any) => e.employeeCode.startsWith(`${P}-`)));
  t.status('Quản lý (không có quyền 9-Box) → 403', await api(`/api/talent-reviews?cycle=${CYCLE}`, { token: m1 }), 403);
  const cal = await api('/api/talent-reviews/calibrate', { token: admin, body: { cycle: CYCLE, employeeIds: [eM1, eE1] } });
  t.eq('Hiệu chỉnh 2 người', cal.body.calibrated, 2);
  const reput = await api('/api/talent-reviews', { token: admin, method: 'PUT', body: { cycle: CYCLE, employeeId: eM1, performance: 3, potential: 2 } });
  t.check('Sửa ô sau hiệu chỉnh → mất cờ đã hiệu chỉnh, ô mới = 6', reput.body.calibrated === false && reput.body.box === 6);

  // ------------------------------------------------------------ 8. IDP
  t.section('8 · IDP (liên thông từ khoảng cách 360°)');
  t.status('HRBP phạm vi rỗng lập IDP cho E1 → 403', await api('/api/idp/from-assessment', { token: hrbp.token, body: { employeeId: eE1, campaignId: cid, cycle: CYCLE } }), 403);
  const idpE1 = await api('/api/idp/from-assessment', { token: admin, body: { employeeId: eE1, campaignId: cid, cycle: CYCLE } });
  t.status('Lập IDP cho E1 từ kết quả 360°', idpE1, 201);
  t.eq('E1 có 4 năng lực dưới mức 3 → lấy tối đa 3 mục tiêu', idpE1.body.goals.length, 3);
  t.check('Mục tiêu nguồn GAP_360, hiện tại ≈ 2,33, mục tiêu = 3',
    idpE1.body.goals.every((g: any) => g.source === 'GAP_360' && g.targetLevel === 3 && Math.abs(g.currentLevel - 2.33) < 0.011));
  t.status('Lập trùng chu kỳ → 409', await api('/api/idp/from-assessment', { token: admin, body: { employeeId: eE1, campaignId: cid, cycle: CYCLE } }), 409);
  const idpM1 = await api('/api/idp/from-assessment', { token: admin, body: { employeeId: eM1, campaignId: cid, cycle: CYCLE } });
  t.check('M1 không có năng lực nào dưới mức → IDP trống kèm ghi chú', idpM1.status === 201 && idpM1.body.goals.length === 0 && !!idpM1.body.notes);

  const pid = idpE1.body.id as string;
  const goals = idpE1.body.goals as any[];
  const w0 = await api(`/api/idp/${pid}`, { token: admin });
  t.check('Cảnh báo: 3 mục tiêu đều chưa có hành động', w0.body.warnings.filter((w: string) => w.includes('chưa có hành động')).length === 3);
  const sub0 = await api(`/api/idp/${pid}/submit`, { token: admin, body: {} });
  t.status('Gửi duyệt khi chưa có hành động → 400', sub0, 400);
  t.status('Hành động tiêu đề quá ngắn → 400', await api(`/api/idp-goals/${goals[0].id}/actions`, { token: admin, body: { type: 'EXPERIENCE_70', title: 'ab' } }), 400);

  const mk = (gid: string, type: string, title: string) => api(`/api/idp-goals/${gid}/actions`, { token: admin, body: { type, title } });
  const a1 = await mk(goals[0].id, 'EXPERIENCE_70', 'Dẫn dắt một dự án cải tiến quy trình');
  const a2 = await mk(goals[0].id, 'EXPOSURE_20', 'Được quản lý kèm cặp hằng tháng');
  const a3 = await mk(goals[0].id, 'EDUCATION_10', 'Hoàn thành khoá học nội bộ');
  await mk(goals[1].id, 'EXPERIENCE_70', 'Nhận thêm đầu việc liên phòng ban');
  const a5 = await mk(goals[2].id, 'EXPERIENCE_70', 'Chủ trì buổi họp tổng kết quý');
  t.check('Thêm 5 hành động 70-20-10', [a1, a2, a3, a5].every((a) => a.status === 201));

  const extra = codes.find((c) => !goals.some((g) => g.competency.code === c))!;
  const g4 = await api(`/api/idp/${pid}/goals`, { token: admin, body: { competencyCode: extra, targetLevel: 3 } });
  t.status('Thêm mục tiêu thứ 4 thủ công', g4, 201);
  const w4 = await api(`/api/idp/${pid}`, { token: admin });
  t.check('Cảnh báo: nên tập trung tối đa 3 năng lực', w4.body.warnings.some((w: string) => w.includes('Có 4 mục tiêu')));
  t.status('Xoá mục tiêu thủ công', await api(`/api/idp-goals/${g4.body.id}`, { token: admin, method: 'DELETE' }), 200);

  t.status('Gửi duyệt IDP của E1', await api(`/api/idp/${pid}/submit`, { token: admin, body: {} }), 200);
  t.status('Gửi duyệt lần hai → 409', await api(`/api/idp/${pid}/submit`, { token: admin, body: {} }), 409);
  t.status('HRBP (không có quyền duyệt) → 403', await api(`/api/idp/${pid}/approve`, { token: hrbp.token, body: {} }), 403);
  t.status('M1 là quản lý trực tiếp của E1 → phê duyệt được', await api(`/api/idp/${pid}/approve`, { token: m1, body: {} }), 200);
  t.eq('IDP của E1 đã APPROVED', (await prisma.idpPlan.findUniqueOrThrow({ where: { id: pid } })).status, 'APPROVED');

  // IDP của M1: tự lập mục tiêu, gửi duyệt, KHÔNG được tự duyệt
  const m1Plan = idpM1.body.id as string;
  const m1Goal = await api(`/api/idp/${m1Plan}/goals`, { token: m1, body: { competencyCode: codes[2], targetLevel: 5 } });
  t.status('M1 tự thêm mục tiêu vào IDP của mình', m1Goal, 201);
  t.status('M1 thêm hành động', await api(`/api/idp-goals/${m1Goal.body.id}/actions`, { token: m1, body: { type: 'EXPERIENCE_70', title: 'Dẫn dắt chương trình kế thừa' } }), 201);
  t.status('M1 gửi duyệt IDP của mình', await api(`/api/idp/${m1Plan}/submit`, { token: m1, body: {} }), 200);
  t.status('M1 KHÔNG được tự phê duyệt IDP của chính mình → 403', await api(`/api/idp/${m1Plan}/approve`, { token: m1, body: {} }), 403);
  t.status('Trưởng Ban NS phê duyệt được', await api(`/api/idp/${m1Plan}/approve`, { token: hrlead, body: {} }), 200);
  const dPlan = await api('/api/idp', { token: admin, body: { employeeId: await idOf('E2'), cycle: CYCLE } });
  t.status('Lập IDP thủ công cho E2', dPlan, 201);
  t.status('Duyệt IDP chưa gửi → 409', await api(`/api/idp/${dPlan.body.id}/approve`, { token: hrlead, body: {} }), 409);

  // Thực hiện & hoàn thành
  t.status('APPROVED → COMPLETED trực tiếp bị chặn → 409', await api(`/api/idp/${pid}/status`, { token: admin, body: { status: 'COMPLETED' } }), 409);
  t.status('APPROVED → IN_PROGRESS', await api(`/api/idp/${pid}/status`, { token: admin, body: { status: 'IN_PROGRESS' } }), 200);
  t.status('Đánh dấu hành động 1 hoàn thành', await api(`/api/idp-actions/${a1.body.id}`, { token: admin, method: 'PATCH', body: { status: 'DONE', evidence: 'Biên bản nghiệm thu dự án' } }), 200);
  t.status('Đánh dấu hành động 2 hoàn thành', await api(`/api/idp-actions/${a2.body.id}`, { token: admin, method: 'PATCH', body: { status: 'DONE' } }), 200);
  const prog = await api(`/api/idp/${pid}`, { token: admin });
  t.eq('Tiến độ = 2/5 hành động = 40%', prog.body.progress, 40);
  t.status('Ghi trao đổi (check-in)', await api(`/api/idp/${pid}/check-ins`, { token: m1, body: { content: 'Đã hoàn thành dự án cải tiến, tiếp tục mục tiêu 2.' } }), 201);
  t.status('Check-in quá ngắn → 400', await api(`/api/idp/${pid}/check-ins`, { token: m1, body: { content: 'ok' } }), 400);
  t.status('IN_PROGRESS → COMPLETED', await api(`/api/idp/${pid}/status`, { token: admin, body: { status: 'COMPLETED' } }), 200);
  t.status('IDP đã hoàn thành không sửa được → 409', await api(`/api/idp/${pid}/goals`, { token: admin, body: { competencyCode: extra, targetLevel: 3 } }), 409);

  // Phạm vi IDP
  t.status('HRBP phạm vi rỗng không đọc được IDP của E1 → 403', await api(`/api/idp/${pid}`, { token: hrbp.token }), 403);
  const listH = await api('/api/idp', { token: hrbp.token });
  t.check('HRBP phạm vi rỗng: danh sách IDP trống', listH.status === 200 && listH.body.plans.length === 0);
  const listM = await api(`/api/idp?cycle=${CYCLE}`, { token: m1 });
  t.check('M1 thấy IDP của mình và của cấp dưới (E1, E2), không thấy ngoài cây báo cáo', listM.status === 200 && listM.body.plans.length === 3);

  // ------------------------------------------------------------ 9. Nhật ký
  t.section('9 · Nhật ký: mọi thao tác ghi đều có dấu vết');
  const auditCamp = await prisma.auditLog.count({ where: { entityType: 'AssessmentCampaign', entityId: cid } });
  t.check('Chiến dịch có nhật ký tạo / thêm người / mở / nhập phiếu / đóng (≥ 5)', auditCamp >= 5, `chỉ có ${auditCamp}`);
  t.check('IDP có nhật ký gửi duyệt và phê duyệt', (await prisma.auditLog.count({ where: { entityType: 'IdpPlan', entityId: pid } })) >= 3);
  t.check('Tài khoản có nhật ký cấp, đặt lại mật khẩu, khoá', (await prisma.auditLog.count({ where: { entityType: 'User', entityId: created.body.id } })) >= 4);
}

main().catch(async (e) => {
  console.error('\n\x1b[31mLỗi khi chạy kịch bản:\x1b[0m', e);
  try {
    await cleanup(P);
  } catch {
    /* bỏ qua */
  }
  process.exit(1);
});
