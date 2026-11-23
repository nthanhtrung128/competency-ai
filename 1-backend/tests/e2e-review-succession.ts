import {
  Tester, api, assertSafeTarget, cleanup, createFixtures, health, emp, mail,
  prisma, provisionAccount, seedLogin,
} from './helpers.js';

/**
 * KỊCH BẢN 2 — Bàn duyệt → Kế thừa → Bảng điều khiển
 * (viết lại từ kịch bản 29/29 đã chạy trên PostgreSQL 16; bám mã nguồn hiện tại)
 *
 * Không ban hành thật bất kỳ phiên bản năng lực nào (ban hành không hoàn tác được) — chỉ thử phần
 * chặn (422), tạo bản nháp rồi trả lại. Bảng đối chiếu dùng vai trò thử TREV-R1, tự xoá khi xong.
 */
const P = 'TREV';
const CYCLE = '2099';
const t = new Tester('Kịch bản 2 · Bàn duyệt → Kế thừa → Bảng điều khiển');

async function main() {
  assertSafeTarget();
  if (!(await health())) {
    console.error('\n✖ Máy chủ chưa chạy hoặc chưa nối được CSDL. Chạy "npm run test" (tự bật máy chủ) hoặc "npm run dev" trước.\n');
    process.exit(2);
  }
  await cleanup(P);
  await dropDrafts();
  try {
    await run();
  } finally {
    await dropDrafts();
    await cleanup(P);
    await prisma.$disconnect();
  }
  process.exit(t.finish());
}

/** Bản nháp do kịch bản này tạo có changeNote đặc trưng — xoá nếu còn sót (không đụng bản nháp thật) */
async function dropDrafts() {
  const rows = await prisma.competencyVersion.findMany({ where: { status: 'DRAFT' } });
  const mine = rows.filter((v) => ((v.levels ?? {}) as { changeNote?: string }).changeNote === `${P} kiểm thử`);
  if (mine.length) await prisma.competencyVersion.deleteMany({ where: { id: { in: mine.map((v) => v.id) } } });
}

const dash = async (token: string) => (await api(`/api/dashboard?cycle=${CYCLE}`, { token })).body;

async function run() {
  const admin = await seedLogin('admin@flamingo.vn');
  const hrlead = await seedLogin('hrlead@flamingo.vn');

  t.section('1 · Chuẩn bị');
  const comps = await api('/api/competencies', { token: admin });
  const published = (comps.body.competencies as any[]).filter((c) => c.currentVersionId);
  if (!t.check('Từ điển có năng lực đã ban hành', published.length >= 2, 'Chạy "npm run seed:all" trước')) return;
  const d0 = await dash(admin);
  await createFixtures(P, ['D1', 'A1', 'A2', 'A3'], { D1: null, A1: 'D1', A2: 'D1', A3: 'D1' });
  const hrbp = await provisionAccount(admin, t, { email: mail(P, 'hrbp'), name: 'HRBP phạm vi rỗng', role: 'HRBP', scopeOrgUnitCode: `${P}-EMPTY` });
  const idOf = async (n: string) => (await prisma.employee.findUniqueOrThrow({ where: { employeeCode: emp(P, n) } })).id;
  const [D1, A1, A2, A3] = [await idOf('D1'), await idOf('A1'), await idOf('A2'), await idOf('A3')];

  // ------------------------------------------------------------ 2. QĐ-02 đối chiếu mã
  t.section('2 · Bàn duyệt · QĐ-02 đối chiếu mã Sổ tay → Từ điển');
  const role = await prisma.jobRole.create({ data: { code: `${P}-R1`, title: 'Vai trò thử bảng đối chiếu' } });
  await prisma.jobRoleRequirement.createMany({
    data: [
      { jobRoleId: role.id, sourceLabel: `${P}-NHAN-1`, competencyId: null, requiredLevel: 3, mappingStatus: 'UNMAPPED' },
      { jobRoleId: role.id, sourceLabel: `${P}-NHAN-2`, competencyId: published[0].id, requiredLevel: 4, mappingStatus: 'PROPOSED', mappingConfidence: 'MEDIUM' },
    ],
  });
  const d1 = await dash(admin);
  t.eq('Bảng điều khiển đếm thêm 1 yêu cầu UNMAPPED và 1 PROPOSED',
    [(d1.framework.requirements.UNMAPPED ?? 0) - (d0.framework.requirements.UNMAPPED ?? 0), (d1.framework.requirements.PROPOSED ?? 0) - (d0.framework.requirements.PROPOSED ?? 0)], [1, 1]);

  const xw = await api('/api/review/crosswalk', { token: admin });
  const find = (label: string) => (xw.body.items as any[]).find((i) => i.sourceLabel === label);
  t.check('Bàn duyệt liệt kê nhãn chưa đối chiếu và nhãn đề xuất', find(`${P}-NHAN-1`)?.status === 'UNMAPPED' && find(`${P}-NHAN-2`)?.status === 'PROPOSED');
  const sum0 = await api('/api/review/summary', { token: admin });
  t.check('Tổng quan có số nhãn chờ duyệt ≥ 2', sum0.status === 200 && sum0.body.crosswalkPending >= 2);

  t.status('Mã Từ điển không tồn tại → 400', await api('/api/review/crosswalk/approve', { token: admin, body: { items: [{ sourceLabel: `${P}-NHAN-1`, competencyCode: 'ZZ99' }] } }), 400);
  t.eq('…và không có gì bị đổi', (await prisma.jobRoleRequirement.findFirstOrThrow({ where: { sourceLabel: `${P}-NHAN-1` } })).mappingStatus, 'UNMAPPED');
  t.status('HRBP (không có quyền ban hành) duyệt đối chiếu → 403', await api('/api/review/crosswalk/approve', { token: hrbp.token, body: { items: [{ sourceLabel: `${P}-NHAN-1`, competencyCode: published[0].code }] } }), 403);

  const ap = await api('/api/review/crosswalk/approve', {
    token: hrlead,
    body: { items: [{ sourceLabel: `${P}-NHAN-1`, competencyCode: published[0].code }, { sourceLabel: `${P}-NHAN-2`, competencyCode: published[1].code }] },
  });
  t.check('Trưởng Ban NS duyệt 2 nhãn → cập nhật 2 yêu cầu', ap.status === 200 && ap.body.labels === 2 && ap.body.requirementsUpdated === 2);
  const after = await prisma.jobRoleRequirement.findMany({ where: { sourceLabel: { startsWith: `${P}-NHAN` } }, orderBy: { sourceLabel: 'asc' } });
  t.check('Ghi nhận APPROVED, độ tin cậy HR, ghi chú "Duyệt đối chiếu trên app bởi …"',
    after.every((r) => r.mappingStatus === 'APPROVED' && r.mappingConfidence === 'HR' && (r.note ?? '').startsWith('Duyệt đối chiếu trên app bởi hrlead@flamingo.vn')));
  t.eq('Nhãn 2 đổi sang mã Từ điển do HR chọn (không giữ đề xuất cũ)', after[1].competencyId, published[1].id);
  const d2 = await dash(admin);
  t.eq('Bảng điều khiển: APPROVED +2, UNMAPPED −1, PROPOSED −1',
    [(d2.framework.requirements.APPROVED ?? 0) - (d1.framework.requirements.APPROVED ?? 0), (d2.framework.requirements.UNMAPPED ?? 0) - (d1.framework.requirements.UNMAPPED ?? 0), (d2.framework.requirements.PROPOSED ?? 0) - (d1.framework.requirements.PROPOSED ?? 0)],
    [2, -1, -1]);
  const csv = await api('/api/review/crosswalk.csv', { token: admin });
  t.check('Xuất CSV đúng định dạng doi_chieu_ma_nang_luc.csv và có trạng thái DA_DUYET',
    csv.status === 200 && csv.text.replace(/^\ufeff/, '').startsWith('ma_so_tay,ten_so_tay,ma_tu_dien') && csv.text.includes(`"${P}-NHAN-1"`) && csv.text.includes('"DA_DUYET"'));

  // ------------------------------------------------------------ 3. QĐ-03 chủ quản
  t.section('3 · Bàn duyệt · QĐ-03 đơn vị chủ quản');
  const owners = await api('/api/review/owners', { token: admin });
  const sumNow = await api('/api/review/summary', { token: admin });
  t.check('Danh sách năng lực chưa có chủ khớp số trên tổng quan', owners.status === 200 && owners.body.items.length === sumNow.body.ownersMissing);
  const badProposal = (owners.body.items as any[]).filter((i) => i.proposal && !i.proposal.name);
  t.eq('Mọi phương án đề xuất trỏ tới đơn vị có thật trong cây tổ chức', badProposal.map((i) => i.code), []);

  // ------------------------------------------------------------ 4. QĐ-04b bản nháp
  t.section('4 · Bàn duyệt · QĐ-04b rà soát bản nháp chỉ báo');
  const withDraft = new Set((await prisma.competencyVersion.findMany({ where: { status: 'DRAFT' }, select: { competencyId: true } })).map((v) => v.competencyId));
  const target = published.find((c) => !withDraft.has(c.id));
  if (t.check('Có một năng lực chưa có bản nháp để thử', !!target)) {
    const levelsOf = (txt: (n: number) => string) => ({ behavioralIndicators: [1, 2, 3, 4, 5].map((n) => ({ level: n, indicator: txt(n) })) });
    const tagged = await api(`/api/competencies/${target.id}/versions`, {
      token: admin,
      body: { changeNote: `${P} kiểm thử`, levels: levelsOf((n) => (n === 2 ? '[DỰ THẢO AI] Nội dung thử chưa duyệt' : `Chỉ báo thử mức ${n} (${P})`)) },
    });
    t.status('Tạo bản nháp có một mức còn nhãn [DỰ THẢO AI]', tagged, 201);
    const list = await api('/api/review/drafts', { token: admin });
    const item = (list.body.items as any[]).find((i) => i.versionId === tagged.body.id);
    t.check('Bàn duyệt thấy bản nháp: 1 mức còn nhãn, CHƯA sẵn sàng ban hành', !!item && item.taggedCount === 1 && item.readyToPublish === false);
    const pub = await api(`/api/competency-versions/${tagged.body.id}/publish`, { token: admin, body: {} });
    t.status('Ban hành bản còn nhãn dự thảo → máy chủ chặn 422', pub, 422);
    t.eq('…con trỏ phiên bản hiện hành không đổi', (await prisma.competency.findUniqueOrThrow({ where: { id: target.id } })).currentVersionId, target.currentVersionId);
    t.status('Trả lại không ghi lý do → 400', await api(`/api/competency-versions/${tagged.body.id}/reject`, { token: admin, body: { reason: 'ab' } }), 400);
    t.status('HRBP không có quyền trả lại → 403', await api(`/api/competency-versions/${tagged.body.id}/reject`, { token: hrbp.token, body: { reason: 'Không đủ quyền' } }), 403);
    t.status('Trả lại bản nháp có lý do', await api(`/api/competency-versions/${tagged.body.id}/reject`, { token: admin, body: { reason: 'Chỉ báo mức 2 chưa được chuyên gia duyệt' } }), 200);
    t.eq('Bản nháp đã xoá khỏi CSDL', await prisma.competencyVersion.count({ where: { id: tagged.body.id } }), 0);
    const trail = await prisma.auditLog.findFirst({ where: { entityType: 'CompetencyVersion', entityId: tagged.body.id, action: 'DELETE' } });
    t.check('Nội dung bản nháp được lưu nguyên vào nhật ký để không mất', !!trail && JSON.stringify(trail.oldValues).includes('Nội dung thử chưa duyệt') && (trail.entityName ?? '').includes('TRẢ LẠI'));

    const clean = await api(`/api/competencies/${target.id}/versions`, { token: admin, body: { changeNote: `${P} kiểm thử`, levels: levelsOf((n) => `Chỉ báo sạch mức ${n} (${P})`) } });
    t.status('Tạo bản nháp sạch 5 mức', clean, 201);
    const list2 = await api('/api/review/drafts', { token: admin });
    const item2 = (list2.body.items as any[]).find((i) => i.versionId === clean.body.id);
    t.check('Bản nháp sạch: sẵn sàng ban hành (không nhãn, có mức thay đổi)', !!item2 && item2.taggedCount === 0 && item2.readyToPublish === true);
    t.status('Ban hành lại bản đã ban hành → 409', await api(`/api/competency-versions/${target.currentVersionId}/publish`, { token: admin, body: {} }), 409);
    t.status('Trả lại bản ĐÃ ban hành → 409', await api(`/api/competency-versions/${target.currentVersionId}/reject`, { token: admin, body: { reason: 'Thử trả lại bản đã ban hành' } }), 409);
    t.status('Dọn bản nháp sạch (không ban hành thật)', await api(`/api/competency-versions/${clean.body.id}/reject`, { token: admin, body: { reason: 'Kiểm thử xong, trả lại' } }), 200);
  }

  // ------------------------------------------------------------ 5. Kế thừa
  t.section('5 · Kế hoạch kế thừa (QĐ-21)');
  const s0 = (await dash(admin)).succession;
  const plan = await api('/api/succession', {
    token: admin,
    body: { positionTitle: `[${P}] Giám đốc khối thử`, orgUnitCode: 'B01', incumbentEmployeeCode: emp(P, 'D1'), criticality: 'CRITICAL', vacancyRisk: 'HIGH' },
  });
  t.status('Tạo kế hoạch cho vị trí CRITICAL', plan, 201);
  t.status('Đơn vị không tồn tại → 400', await api('/api/succession', { token: admin, body: { positionTitle: `[${P}] Sai đơn vị`, orgUnitCode: 'KHONG-CO' } }), 400);
  t.status('Mức trọng yếu không hợp lệ → 400', await api('/api/succession', { token: admin, body: { positionTitle: `[${P}] Sai mức`, criticality: 'SIEU' } }), 400);
  const pid = plan.body.id as string;
  const s1 = (await dash(admin)).succession;
  t.eq('Bảng điều khiển: +1 kế hoạch, +1 CRITICAL, +1 CRITICAL chưa có người sẵn sàng, +1 chưa có ứng viên',
    [s1.plans - s0.plans, s1.critical - s0.critical, s1.criticalUncovered - s0.criticalUncovered, s1.withoutCandidate - s0.withoutCandidate], [1, 1, 1, 1]);

  // Liên thông 9-Box → gợi ý ứng viên
  const put = (employeeId: string, performance: number, potential: number) =>
    api('/api/talent-reviews', { token: admin, method: 'PUT', body: { cycle: CYCLE, employeeId, performance, potential } });
  t.eq('A1 → ô 8', (await put(A1, 2, 3)).body.box, 8);
  t.eq('A2 → ô 9', (await put(A2, 3, 3)).body.box, 9);
  t.eq('A3 → ô 1', (await put(A3, 1, 1)).body.box, 1);
  t.eq('D1 (người đang giữ vị trí) → ô 9', (await put(D1, 3, 3)).body.box, 9);
  const sg = await api(`/api/succession/${pid}/suggestions`, { token: admin });
  const sgCodes = (sg.body.items as any[]).map((i) => i.employee.employeeCode);
  t.check('Gợi ý ứng viên: có A1 (ô 8) và A2 (ô 9); không có A3 (ô 1) và không có người đang giữ vị trí',
    sgCodes.includes(emp(P, 'A1')) && sgCodes.includes(emp(P, 'A2')) && !sgCodes.includes(emp(P, 'A3')) && !sgCodes.includes(emp(P, 'D1')));
  t.check('Gợi ý xếp ô cao trước: A2 (9) đứng trước A1 (8)', sgCodes.indexOf(emp(P, 'A2')) < sgCodes.indexOf(emp(P, 'A1')));
  t.status('HRBP phạm vi rỗng xem gợi ý → không lộ nhân sự ngoài phạm vi',
    { ...(await api(`/api/succession/${pid}/suggestions`, { token: hrbp.token })), }, 200);
  const sgH = await api(`/api/succession/${pid}/suggestions`, { token: hrbp.token });
  t.check('…danh sách gợi ý của HRBP không có nhân sự thử', sgH.body.items.every((i: any) => !i.employee.employeeCode.startsWith(`${P}-`)));

  // Ứng viên
  const c1 = await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: emp(P, 'A1'), readiness: 'READY_NOW', riskOfLoss: 'LOW' } });
  t.status('Thêm A1 sẵn sàng ngay', c1, 201);
  t.status('Thêm trùng → 409', await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: emp(P, 'A1'), readiness: 'READY_NOW' } }), 409);
  t.status('Người đang giữ vị trí không thể là ứng viên → 400', await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: emp(P, 'D1'), readiness: 'READY_3Y' } }), 400);
  t.status('Mã nhân sự không có → 400', await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: 'KHONG-CO', readiness: 'READY_3Y' } }), 400);
  t.status('Mức sẵn sàng không hợp lệ → 400', await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: emp(P, 'A2'), readiness: 'NGAY_LAP_TUC' } }), 400);
  t.status('HRBP phạm vi rỗng thêm A2 làm ứng viên → 403 (ngoài phạm vi)', await api(`/api/succession/${pid}/candidates`, { token: hrbp.token, body: { employeeCode: emp(P, 'A2'), readiness: 'READY_1_2Y' } }), 403);
  const c2 = await api(`/api/succession/${pid}/candidates`, { token: admin, body: { employeeCode: emp(P, 'A2'), readiness: 'READY_1_2Y' } });
  t.status('Thêm A2 sẵn sàng trong 1–2 năm', c2, 201);

  const s2 = (await dash(admin)).succession;
  t.eq('Bảng điều khiển: vị trí CRITICAL đã có người sẵn sàng ngay → hết "chưa được phủ"; +1 có ứng viên sẵn sàng ngay; hết "chưa có ứng viên"',
    [s2.criticalUncovered - s0.criticalUncovered, s2.withReadyNow - s0.withReadyNow, s2.withoutCandidate - s0.withoutCandidate], [0, 1, 0]);

  // Liên thông 9-Box + IDP trong hồ sơ ứng viên
  const idp = await api('/api/idp', { token: admin, body: { employeeId: A1, cycle: CYCLE } });
  t.status('Lập IDP cho A1', idp, 201);
  const list = await api('/api/succession', { token: admin });
  const mine = (list.body.items as any[]).find((i) => i.id === pid);
  const cand = mine.candidates.find((c: any) => c.employee.employeeCode === emp(P, 'A1'));
  t.check('Hồ sơ ứng viên liên thông: 9-Box ô 8 (chu kỳ 2099), IDP DRAFT tiến độ 0%',
    cand.talent.box === 8 && cand.talent.boxCycle === CYCLE && cand.talent.idpStatus === 'DRAFT' && cand.talent.idpProgress === 0);
  t.check('Ứng viên sắp theo mức sẵn sàng: A1 (ngay) trước A2 (1–2 năm)', mine.candidates[0].employee.employeeCode === emp(P, 'A1'));
  t.eq('Độ phủ: 1 sẵn sàng ngay, 1 trong 1–2 năm, tổng 2', [mine.coverage.readyNow, mine.coverage.ready12, mine.coverage.total], [1, 1, 2]);
  const listH = await api('/api/succession', { token: hrbp.token });
  t.check('HRBP phạm vi rỗng không thấy kế hoạch của B01', listH.status === 200 && !listH.body.items.some((i: any) => i.positionTitle.startsWith(`[${P}]`)));

  // Đổi mức sẵn sàng
  t.status('Mức rủi ro mất người không hợp lệ → 400', await api(`/api/succession-candidates/${c1.body.id}`, { token: admin, method: 'PATCH', body: { riskOfLoss: 'CUC_CAO' } }), 400);
  t.status('Hạ A1 xuống sẵn sàng sau 3 năm', await api(`/api/succession-candidates/${c1.body.id}`, { token: admin, method: 'PATCH', body: { readiness: 'READY_3Y' } }), 200);
  const s3 = (await dash(admin)).succession;
  t.eq('Bảng điều khiển: vị trí CRITICAL lại "chưa được phủ"', s3.criticalUncovered - s0.criticalUncovered, 1);
  t.check('Nhật ký ghi giá trị cũ → mới của mức sẵn sàng', !!(await prisma.auditLog.findFirst({ where: { entityType: 'SuccessionCandidate', entityId: c1.body.id, action: 'UPDATE' } }))?.oldValues);

  t.status('HRBP (không có assessment:manage) xoá kế hoạch → 403', await api(`/api/succession/${pid}`, { token: hrbp.token, method: 'DELETE' }), 403);
  t.status('Xoá ứng viên', await api(`/api/succession-candidates/${c2.body.id}`, { token: admin, method: 'DELETE' }), 200);
  t.status('Xoá kế hoạch', await api(`/api/succession/${pid}`, { token: admin, method: 'DELETE' }), 200);
  t.eq('Xoá kế hoạch kéo theo ứng viên', await prisma.successionCandidate.count({ where: { planId: pid } }), 0);
  const s4 = (await dash(admin)).succession;
  t.eq('Bảng điều khiển trở về số liệu ban đầu', [s4.plans, s4.critical, s4.criticalUncovered, s4.withoutCandidate], [s0.plans, s0.critical, s0.criticalUncovered, s0.withoutCandidate]);

  // ------------------------------------------------------------ 6. Bảng điều khiển
  t.section('6 · Bảng điều khiển: đủ khối với quản trị, lọc theo phạm vi với người khác');
  const da = await dash(admin);
  t.check('Quản trị thấy đủ các khối', ['framework', 'org', 'assessment', 'talent', 'idp', 'succession'].every((k) => da[k] !== null && da[k] !== undefined) && da.org.accounts !== null);
  t.eq('Khung năng lực: 3 nhóm Cốt lõi / Lãnh đạo / Chuyên môn', da.framework.byCategory.map((c: any) => c.category), ['COR', 'LEA', 'FUN']);
  t.check('Khung năng lực: đã ban hành ≤ tổng, đủ 5 mức ≤ đã ban hành', da.framework.published <= da.framework.competencies && da.framework.fullFiveLevels <= da.framework.scored);
  t.eq('9-Box chu kỳ 2099: đã xếp 4 người, ô 9 có 2 (A2, D1) so với trước khi thử',
    [da.talent.reviewed - d0.talent.reviewed, da.talent.boxes[9] - d0.talent.boxes[9]], [4, 2]);
  const dh = await api(`/api/dashboard?cycle=${CYCLE}`, { token: hrbp.token });
  t.status('HRBP phạm vi rỗng đọc bảng điều khiển', dh, 200);
  t.eq('…chỉ thấy 0 nhân sự và 0 người đã xếp 9-Box trong phạm vi', [dh.body.org.employees, dh.body.talent.reviewed], [0, 0]);
  t.eq('…không thấy khối tài khoản (không có quyền user:manage)', [dh.body.org.accounts, dh.body.org.pendingPasswordChange], [null, null]);
  t.eq('…và 0 IDP trong phạm vi', dh.body.idp.plans, 0);
}

main().catch(async (e) => {
  console.error('\n\x1b[31mLỗi khi chạy kịch bản:\x1b[0m', e);
  try {
    await dropDrafts();
    await cleanup(P);
  } catch {
    /* bỏ qua */
  }
  process.exit(1);
});
