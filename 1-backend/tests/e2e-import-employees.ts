import {
  Tester, api, assertSafeTarget, cleanup, createFixtures, health, emp, mail,
  prisma, provisionAccount, seedLogin,
} from './helpers.js';

/**
 * KỊCH BẢN 3 — Nhập nhân sự 2 bước (src/routes/import.ts)
 *   POST /api/import/employees/validate  → vùng đệm, KHÔNG ghi bảng employees
 *   POST /api/import/employees/:id/commit → ghi thật (transaction)
 *   POST /api/import/employees/:id/cancel
 *
 * Lưu ý: endpoint chỉ nhận **CSV** (UTF-8, có/không BOM) — Excel dùng "Save As → CSV UTF-8".
 * Kịch bản thử cả việc tải nhầm file .xlsx thật: phải không tạo được nhân sự nào.
 *
 * Dữ liệu thử: nhân sự mã TIMP-…, email …@test.invalid, đơn vị TIMP-U2/TIMP-EMPTY, lô nhập tên file TIMP-….csv.
 */
const P = 'TIMP';
const t = new Tester('Kịch bản 3 · Nhập nhân sự từ file (2 bước)');

const HEAD = 'employee_code,full_name,email,phone,org_unit_code,job_title,job_role_code,job_level_code,grade_code,manager_code,hire_date,status';
const csv = (...lines: string[]) => [HEAD, ...lines].join('\n');
const code = (n: string) => emp(P, n);
const em = (n: string) => mail(P, n);

function form(text: string | Uint8Array, filename: string, type = 'text/csv') {
  const fd = new FormData();
  fd.append('file', new Blob([text as BlobPart], { type }), filename);
  return fd;
}

async function main() {
  assertSafeTarget();
  if (!(await health())) {
    console.error('\n✖ Máy chủ chưa chạy hoặc chưa nối được CSDL. Chạy "npm test" (tự bật máy chủ) hoặc "npm run dev" trước.\n');
    process.exit(2);
  }
  await wipe();
  try {
    await run();
  } finally {
    await wipe();
    await prisma.$disconnect();
  }
  process.exit(t.finish());
}

/** Xoá toàn bộ dữ liệu thử. Thứ tự: lô nhập (cascade dòng đệm) → nhật ký → nhân sự (cascade lịch sử điều chuyển) → đơn vị */
async function wipe() {
  const batches = await prisma.importBatch.findMany({ where: { fileName: { startsWith: `${P}-` } }, select: { id: true } });
  const ids = batches.map((b) => b.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'ImportBatch', entityId: { in: ids } } });
    await prisma.importBatch.deleteMany({ where: { id: { in: ids } } });
  }
  await cleanup(P);
}

const count = () => prisma.employee.count({ where: { employeeCode: { startsWith: `${P}-` } } });
const batchRow = (id: string) => prisma.importBatch.findUniqueOrThrow({ where: { id } });
const dbEmp = (n: string) => prisma.employee.findUnique({ where: { employeeCode: code(n) }, include: { assignments: { orderBy: { effectiveFrom: 'asc' } } } });

async function validate(token: string, text: string | Uint8Array, name: string, type?: string) {
  return api('/api/import/employees/validate', { token, form: form(text, `${P}-${name}`, type) });
}
const commit = (token: string, id: string) => api(`/api/import/employees/${id}/commit`, { token, method: 'POST' });

async function run() {
  const admin = await seedLogin('admin@flamingo.vn');

  t.section('1 · Chuẩn bị & phân quyền');
  const { ids } = await createFixtures(P, ['X1'], { X1: null }); // X1 giữ email em('X1') để thử trùng email
  void ids;
  await prisma.orgUnit.create({ data: { code: `${P}-U2`, name: 'Đơn vị thử 2', tier: 9 } });
  const lm = await provisionAccount(admin, t, { email: mail(P, 'lm'), name: 'Quản lý không có quyền nhập', role: 'LINE_MANAGER', employeeCode: code('X1') });

  const file0 = csv(`${code('Z1')},Thử quyền,,,B01,,,,,,,`);
  t.status('Không đăng nhập → 401', await api('/api/import/employees/validate', { form: form(file0, `${P}-quyen.csv`) }), 401);
  t.status('LINE_MANAGER (không có employee:import) → 403', await validate(lm.token, file0, 'quyen.csv'), 403);
  t.status('Không đính kèm file → 400', await api('/api/import/employees/validate', { token: admin, method: 'POST', body: {} }), 400);
  t.eq('Không có gì bị ghi sau các lần bị chặn', await count(), 1); // chỉ X1

  // ------------------------------------------------------------ 2. file hợp lệ
  t.section('2 · Ca hợp lệ: kiểm tra (chưa ghi) → ghi thật');
  const BOM = '﻿';
  const good =
    BOM +
    csv(
      // E1 đứng TRƯỚC quản lý M1 → phải gán được nhờ vòng 2
      `${code('E1')},Nhân viên Một,${em('E1')},0901000001,B01,Chuyên viên,R02,L2,Ngạch 5,${code('M1')},02/06/2021,Đang làm việc`,
      `${code('M1')},Quản lý Một,${em('M1')},,B01,Trưởng nhóm,R01,L4,Ngạch 3,,15/03/2019,active`,
      `${code('E2')},Nhân viên Hai,${em('E2')},,B01,,,,,${code('M1')},2022-01-10,Nghỉ phép`,
      `${code('E3')},Nhân viên Ba,,,B01,,,,,,,Đã nghỉ việc`,
      `${code('E4').toLowerCase()},Mã viết thường,${em('E4').toUpperCase()},,b01,,,,,,,`,
    );
  const r1 = await validate(admin, good, 'hople.csv');
  t.status('Validate file hợp lệ (có BOM)', r1, 200);
  t.eq('Tổng 5 dòng, 0 lỗi, 0 cảnh báo', [r1.body.summary?.tong, r1.body.summary?.loi, r1.body.summary?.canhBao, r1.body.summary?.hopLe], [5, 0, 0, 5]);
  t.eq('Sẽ tạo 5, cập nhật 0', [r1.body.summary?.seTao, r1.body.summary?.seCapNhat], [5, 0]);
  t.eq('Bước 1 chưa ghi nhân sự nào (chỉ X1 có sẵn)', await count(), 1);
  const b1 = await batchRow(r1.body.batchId);
  t.eq('Lô ở trạng thái VALIDATED, chưa ghi', [b1.status, b1.createdRows, b1.entityType], ['VALIDATED', 0, 'EMPLOYEE']);
  const rows1 = await api(`/api/import/employees/${r1.body.batchId}/rows`, { token: admin });
  t.eq('Xem dòng đệm: 5 dòng, số dòng bắt đầu từ 2', [rows1.body.count, rows1.body.rows?.[0]?.rowNumber], [5, 2]);
  t.check('Mã viết thường được chuẩn hoá thành chữ hoa trong vùng đệm', rows1.body.rows?.some((r: any) => r.normalized?.employeeCode === code('E4') && r.normalized?.email === em('E4')));

  const c1 = await commit(admin, r1.body.batchId);
  t.status('Commit lô hợp lệ', c1, 200);
  t.eq('Đã tạo 5, cập nhật 0', [c1.body.daTao, c1.body.daCapNhat], [5, 0]);
  t.eq('Có 6 nhân sự TIMP- (5 mới + X1)', await count(), 6);

  const [E1, M1, E2, E3, E4] = await Promise.all(['E1', 'M1', 'E2', 'E3', 'E4'].map(dbEmp));
  t.check('Quản lý gán đúng dù dòng quản lý nằm sau (vòng 2)', E1?.managerId === M1?.id && E2?.managerId === M1?.id && M1?.managerId === null);
  t.eq('Ngày dd/mm/yyyy đọc đúng (2/6/2021)', E1?.hireDate && [E1.hireDate.getFullYear(), E1.hireDate.getMonth() + 1, E1.hireDate.getDate()], [2021, 6, 2]);
  t.eq('Ngày yyyy-mm-dd đọc đúng (10/1/2022)', E2?.hireDate && [E2.hireDate.getFullYear(), E2.hireDate.getMonth() + 1, E2.hireDate.getDate()], [2022, 1, 10]);
  t.eq('Trạng thái: "Đang làm việc"/"active" → ACTIVE, "Nghỉ phép" → ON_LEAVE, "Đã nghỉ việc" → TERMINATED', [E1?.status, M1?.status, E2?.status, E3?.status], ['ACTIVE', 'ACTIVE', 'ON_LEAVE', 'TERMINATED']);
  t.eq('Trạng thái trống → ACTIVE (mặc định)', E4?.status, 'ACTIVE');
  t.eq('Trường phụ lưu đúng (chức danh, vai trò, cấp, ngạch)', [E1?.jobTitle, E1?.jobRoleCode, E1?.jobLevelCode, E1?.gradeCode], ['Chuyên viên', 'R02', 'L2', 'Ngạch 5']);
  t.eq('Email chuẩn hoá chữ thường', E4?.email, em('E4'));
  t.check('Mỗi nhân sự có đúng 1 bản ghi điều chuyển, nguồn IMPORT:<lô>, còn hiệu lực',
    [E1, M1, E2, E3, E4].every((e) => e?.assignments.length === 1 && e.assignments[0].source === `IMPORT:${r1.body.batchId}` && e.assignments[0].effectiveTo === null));
  const b1c = await batchRow(r1.body.batchId);
  t.eq('Lô COMMITTED, createdRows=5', [b1c.status, b1c.createdRows, b1c.updatedRows], ['COMMITTED', 5, 0]);
  const rowsLinked = await prisma.importRow.count({ where: { batchId: r1.body.batchId, employeeId: { not: null } } });
  t.eq('Mọi dòng đệm gắn với nhân sự đã ghi', rowsLinked, 5);
  const aud = await prisma.auditLog.findMany({ where: { entityType: 'ImportBatch', entityId: r1.body.batchId } });
  t.eq('Nhật ký: 1 dòng kiểm tra + 1 dòng ghi thật', aud.length, 2);

  // ------------------------------------------------------------ 3. nhập lại — không nhân đôi
  t.section('3 · Nhập lại cùng file — không nhân đôi');
  t.status('Commit lô đã ghi lần hai → 409', await commit(admin, r1.body.batchId), 409);
  t.eq('Vẫn 6 nhân sự', await count(), 6);
  t.status('Huỷ lô đã ghi → 409', await api(`/api/import/employees/${r1.body.batchId}/cancel`, { token: admin, method: 'POST' }), 409);

  const r2 = await validate(admin, good, 'hople-lan2.csv');
  t.status('Validate lại cùng nội dung (lô mới)', r2, 200);
  t.eq('Lần này: tạo 0, cập nhật 5', [r2.body.summary?.seTao, r2.body.summary?.seCapNhat], [0, 5]);
  t.eq('Không có lỗi email "thuộc nhân viên khác" khi email là của chính mình', r2.body.summary?.loi, 0);
  const c2 = await commit(admin, r2.body.batchId);
  t.eq('Commit lại: tạo 0, cập nhật 5', [c2.body.daTao, c2.body.daCapNhat], [0, 5]);
  t.eq('Vẫn 6 nhân sự (không nhân đôi)', await count(), 6);
  const E1b = await dbEmp('E1');
  t.eq('Không sinh thêm bản ghi điều chuyển khi đơn vị không đổi', E1b?.assignments.length, 1);
  t.eq('Id nhân sự giữ nguyên', E1b?.id, E1?.id);

  // ------------------------------------------------------------ 4. cập nhật + đổi đơn vị
  t.section('4 · Cập nhật dữ liệu và đổi đơn vị (lịch sử điều chuyển)');
  const upd = csv(
    `${code('E1')},Nhân viên Một (đã đổi tên),${em('E1')},0909999999,${P}-U2,Chuyên viên cao cấp,R02,L3,Ngạch 4,${code('M1')},02/06/2021,Đang làm việc`,
    `${code('M1')},Quản lý Một,${em('M1')},,B01,Trưởng nhóm,R01,L4,Ngạch 3,,15/03/2019,Đang làm việc`,
  );
  const r3 = await validate(admin, upd, 'capnhat.csv');
  t.eq('Validate cập nhật: 2 cập nhật', [r3.body.summary?.seTao, r3.body.summary?.seCapNhat, r3.body.summary?.loi], [0, 2, 0]);
  await commit(admin, r3.body.batchId);
  const E1c = await dbEmp('E1');
  t.eq('Họ tên, SĐT, chức danh cập nhật', [E1c?.fullName, E1c?.phone, E1c?.jobTitle], ['Nhân viên Một (đã đổi tên)', '0909999999', 'Chuyên viên cao cấp']);
  t.eq('Lịch sử điều chuyển: 2 bản ghi, bản cũ đã đóng, bản mới còn hiệu lực', [E1c?.assignments.length, E1c?.assignments[0].effectiveTo !== null, E1c?.assignments[1]?.effectiveTo ?? null], [2, true, null]);
  const u2 = await prisma.orgUnit.findUniqueOrThrow({ where: { code: `${P}-U2` } });
  t.eq('Đơn vị hiện tại là TIMP-U2', E1c?.orgUnitId, u2.id);
  t.eq('Dòng không có trong file (E2) không bị đụng', (await dbEmp('E2'))?.fullName, 'Nhân viên Hai');

  // ------------------------------------------------------------ 5. dòng lỗi / cảnh báo
  t.section('5 · File có lỗi & cảnh báo — chỉ dòng không lỗi được ghi');
  const before = await count();
  const dirty = csv(
    `${code('G1')},Dòng tốt,${em('G1')},,B01,,,,,,,`, // OK
    `${code('G2')},Dòng cảnh báo,${em('G2')},,B01,,,,,${code('NOBODY')},31/02/2020x,tình trạng lạ`, // 3 cảnh báo
    `${code('G1')},Trùng mã trong file,${em('G9')},,B01,,,,,,,`, // lỗi: lặp mã
    `${code('G3')},,${em('G3')},,B01,,,,,,,`, // lỗi: thiếu họ tên
    `${code('G4')},Email hỏng,không-phải-email,,B01,,,,,,,`, // lỗi: email
    `${code('G5')},Đơn vị lạ,${em('G5')},,KHONG-CO-DON-VI,,,,,,,`, // lỗi: đơn vị
    `${code('G6')},Trùng email người khác,${em('X1')},,B01,,,,,,,`, // lỗi: email thuộc X1
    `${code('G7')},Tự quản lý mình,${em('G7')},,B01,,,,,${code('G7')},,`, // lỗi
    `,Thiếu mã,${em('G8')},,B01,,,,,,,`, // lỗi: thiếu mã
    `${code('G10')},Thiếu đơn vị,${em('G10')},,,,,,,,,`, // lỗi: thiếu đơn vị
  );
  const r4 = await validate(admin, dirty, 'loi.csv');
  t.status('Validate trả 200 kèm báo cáo lỗi', r4, 200);
  t.eq('Tổng 10; hợp lệ 1; cảnh báo 1; lỗi 8', [r4.body.summary?.tong, r4.body.summary?.hopLe, r4.body.summary?.canhBao, r4.body.summary?.loi], [10, 1, 1, 8]);
  t.check('Thông báo nói rõ CHƯA ghi gì', /CHƯA/.test(r4.body.message ?? ''));
  t.eq('Validate không ghi nhân sự', await count(), before);
  const errRows = await api(`/api/import/employees/${r4.body.batchId}/rows?status=ERROR`, { token: admin });
  const warnRows = await api(`/api/import/employees/${r4.body.batchId}/rows?status=WARNING`, { token: admin });
  const msg = (rn: number) => JSON.stringify((errRows.body.rows as any[]).find((r) => r.rowNumber === rn)?.messages ?? '');
  t.eq('Lọc ?status=ERROR trả 8 dòng, WARNING trả 1', [errRows.body.count, warnRows.body.count], [8, 1]);
  t.check('Dòng 4 (lặp mã) báo "bị lặp trong file"', /bị lặp trong file/.test(msg(4)));
  t.check('Dòng 5 (thiếu họ tên) báo thiếu họ tên', /Thiếu họ tên/.test(msg(5)));
  t.check('Dòng 6 báo email không hợp lệ', /Email không hợp lệ/.test(msg(6)));
  t.check('Dòng 7 báo mã đơn vị không có trong hệ thống', /không có trong hệ thống/.test(msg(7)));
  t.check('Dòng 8 báo email đã thuộc nhân viên khác', new RegExp(`đã thuộc về nhân viên ${code('X1')}`).test(msg(8)));
  t.check('Dòng 9 báo không thể tự quản lý chính mình', /không thể là quản lý của chính mình/.test(msg(9)));
  t.check('Dòng 10 báo thiếu mã nhân viên', /Thiếu mã nhân viên/.test(msg(10)));
  t.check('Dòng 11 báo thiếu mã đơn vị', /Thiếu mã đơn vị/.test(msg(11)));
  const w = JSON.stringify(warnRows.body.rows?.[0]?.messages ?? '');
  t.check('Dòng cảnh báo: quản lý không tồn tại, ngày không đọc được, trạng thái lạ', /Mã quản lý/.test(w) && /Không đọc được ngày/.test(w) && /không nhận diện được/.test(w));

  const c4 = await commit(admin, r4.body.batchId);
  t.status('Commit lô còn lỗi (chỉ ghi dòng sạch)', c4, 200);
  t.eq('Chỉ ghi 2 dòng (OK + cảnh báo)', [c4.body.daTao, c4.body.daCapNhat], [2, 0]);
  t.eq('Tổng nhân sự tăng đúng 2', await count(), before + 2);
  const G1 = await dbEmp('G1'), G2 = await dbEmp('G2');
  t.check('G1, G2 có mặt; dòng lỗi (G1 lặp, G3–G10) không tạo', !!G1 && !!G2 && !(await dbEmp('G3')) && !(await dbEmp('G5')) && !(await dbEmp('G7')) && !(await dbEmp('G10')));
  t.eq('Dòng lặp mã không đè dòng đầu: tên G1 vẫn là "Dòng tốt"', G1?.fullName, 'Dòng tốt');
  t.eq('Cảnh báo: quản lý bỏ trống, ngày bỏ trống, trạng thái mặc định ACTIVE', [G2?.managerId, G2?.hireDate, G2?.status], [null, null, 'ACTIVE']);
  t.eq('X1 (email bị đòi) vẫn giữ nguyên dữ liệu', (await dbEmp('X1'))?.fullName, 'Nhân sự thử TIMP X1');

  // ------------------------------------------------------------ 6. file hỏng / thiếu cột
  t.section('6 · File thiếu cột / sai định dạng');
  const countBefore = await count();
  const noCol = 'ma,ten\nTIMP-N1,Không có cột chuẩn\nTIMP-N2,Cũng không';
  const r5 = await validate(admin, noCol, 'thieucot.csv');
  t.status('Thiếu cột bắt buộc: validate vẫn trả báo cáo', r5, 200);
  t.eq('Mọi dòng đều lỗi, không dòng nào hợp lệ', [r5.body.summary?.tong, r5.body.summary?.loi, r5.body.summary?.hopLe, r5.body.summary?.seTao], [2, 2, 0, 0]);
  const c5 = await commit(admin, r5.body.batchId);
  t.eq('Commit lô toàn lỗi: tạo 0, cập nhật 0', [c5.body.daTao, c5.body.daCapNhat], [0, 0]);
  t.eq('Không nhân sự nào được thêm', await count(), countBefore);

  const missingUnitCol = 'employee_code,full_name\nTIMP-N3,Thiếu cột đơn vị';
  const r6 = await validate(admin, missingUnitCol, 'thieudonvi.csv');
  t.eq('Thiếu riêng cột org_unit_code → dòng lỗi', [r6.body.summary?.loi, r6.body.summary?.seTao], [1, 0]);

  const hdrCase = 'Employee Code, Full Name ,ORG_UNIT_CODE\n' + `${code('H1')},Tiêu đề viết hoa có khoảng trắng,B01`;
  const r7 = await validate(admin, hdrCase, 'tieude.csv');
  t.eq('Tiêu đề cột không phân biệt hoa/thường, "Employee Code" → employee_code', [r7.body.summary?.loi, r7.body.summary?.seTao], [0, 1]);
  await commit(admin, r7.body.batchId);
  t.check('Nhân sự H1 được tạo từ file tiêu đề viết hoa', !!(await dbEmp('H1')));

  const r8 = await validate(admin, HEAD + '\n', 'trong.csv');
  t.status('File chỉ có dòng tiêu đề', r8, 200);
  t.eq('File rỗng dữ liệu: tổng 0', r8.body.summary?.tong, 0);

  // Tải nhầm file .xlsx thật (nhị phân) lên endpoint CSV
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('NhanSu');
  ws.addRow(HEAD.split(','));
  ws.addRow([code('XL1'), 'Từ Excel thật', em('XL1'), '', 'B01']);
  const xbuf = new Uint8Array(await wb.xlsx.writeBuffer());
  const countX = await count();
  const rx = await validate(admin, xbuf, 'nham.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const hopLe = rx.status === 200 ? (rx.body.summary?.hopLe ?? 0) + (rx.body.summary?.canhBao ?? 0) : 0;
  t.check('Tải nhầm .xlsx lên endpoint CSV: bị từ chối hoặc không có dòng hợp lệ', rx.status >= 400 || hopLe === 0, `HTTP ${rx.status} ${JSON.stringify(rx.body).slice(0, 200)}`);
  if (rx.status === 200) await commit(admin, rx.body.batchId);
  t.eq('Không nhân sự nào được tạo từ file .xlsx', await count(), countX);

  // ------------------------------------------------------------ 7. vòng đời lô
  t.section('7 · Vòng đời lô: huỷ, commit sai trạng thái, lô không tồn tại');
  const r9 = await validate(admin, csv(`${code('C1')},Sẽ bị huỷ,${em('C1')},,B01,,,,,,,`), 'huy.csv');
  const cx = await api(`/api/import/employees/${r9.body.batchId}/cancel`, { token: admin, method: 'POST' });
  t.status('Huỷ lô đã validate', cx, 200);
  t.eq('Lô CANCELLED', (await batchRow(r9.body.batchId)).status, 'CANCELLED');
  t.status('Commit lô đã huỷ → 400', await commit(admin, r9.body.batchId), 400);
  t.check('Nhân sự C1 không được tạo', !(await dbEmp('C1')));
  t.status('Commit lô không tồn tại → 404', await commit(admin, '00000000-0000-0000-0000-000000000000'), 404);
  t.status('Huỷ lô không tồn tại → 404', await api('/api/import/employees/00000000-0000-0000-0000-000000000000/cancel', { token: admin, method: 'POST' }), 404);
  t.status('LINE_MANAGER không commit/huỷ/xem được lô', await commit(lm.token, r9.body.batchId), 403);
  t.status('LINE_MANAGER không xem được dòng đệm', await api(`/api/import/employees/${r9.body.batchId}/rows`, { token: lm.token }), 403);
}

main();
