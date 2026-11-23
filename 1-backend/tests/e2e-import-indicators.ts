import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { Tester, api, assertSafeTarget, health, prisma, seedLogin } from './helpers.js';

/**
 * KỊCH BẢN 4 — Nhập chỉ báo hành vi từ Excel (QĐ-04)  ·  src/import-indicators.ts + src/lib/indicators.ts
 *
 * Đây là công cụ dòng lệnh (`npm run import:indicators -- <file.xlsx|csv> [--commit]`), không phải API,
 * nên kịch bản chạy đúng lệnh đó bằng tiến trình con rồi kiểm tra CSDL.
 *
 * Không ban hành thật, không sửa bản PUBLISHED. Công cụ chỉ tạo/bổ sung bản NHÁP của 3 năng lực được chọn;
 * kịch bản ghi lại trạng thái các phiên bản trước khi chạy và trả về đúng như cũ khi xong
 * (xoá bản nháp do mình tạo, xoá nhật ký `cli:import-indicators` của các bản đó).
 */
const t = new Tester('Kịch bản 4 · Nhập chỉ báo hành vi từ Excel');
const ROOT = resolve(fileURLToPath(import.meta.url), '../..'); // 1-backend
const dir = mkdtempSync(join(tmpdir(), 'timpind-'));
const AUTHOR = 'TIMP Chuyên gia thử';

type Snap = { id: string; code: string; versions: Array<{ id: string; version: number; status: string; levelsJson: string }>; currentVersionId: string | null };
let snaps: Snap[] = [];
const startedAt = new Date();

function cli(file: string, commit = false) {
  const args = ['--import', 'tsx', 'src/import-indicators.ts', file, ...(commit ? ['--commit'] : [])];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env: process.env, encoding: 'utf-8', timeout: 90_000 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// ---------------------------------------------------------------- tạo file Excel mẫu
type Line = { code: string; levels: Array<string | undefined>; author?: string; status?: string };

async function makeXlsx(name: string, lines: Line[], opts: { aiOriginal?: Record<string, string[]>; noLevel5Col?: boolean; sheetName?: string } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName ?? '01_Nhap_chi_bao');
  ws.addRow(['BIỂU MẪU NHẬP CHỈ BÁO (file thử)']);
  ws.addRow([]);
  ws.addRow([]);
  const head = ['Mã NL', 'Mức 1 — Nhận biết', 'Mức 2 — Cơ bản', 'Mức 3 — Thành thạo', 'Mức 4 — Nâng cao', 'Mức 5 — Chuyên gia', 'Người soạn', 'Trạng thái'];
  if (opts.noLevel5Col) head.splice(5, 1);
  ws.addRow(head); // dòng 4 = tiêu đề
  for (const l of lines) {
    const cells = [l.code, ...[0, 1, 2, 3, 4].map((i) => l.levels[i] ?? ''), l.author ?? AUTHOR, l.status ?? 'Đã nộp'];
    if (opts.noLevel5Col) cells.splice(5, 1);
    ws.addRow(cells);
  }
  if (opts.aiOriginal) {
    const b = wb.addWorksheet('02_Ban_goc_AI');
    b.addRow(['Mã NL', 'Mức 1', 'Mức 2', 'Mức 3', 'Mức 4', 'Mức 5']);
    for (const [c, lv] of Object.entries(opts.aiOriginal)) b.addRow([c, ...lv]);
  }
  const p = join(dir, name);
  await wb.xlsx.writeFile(p);
  return p;
}

const levelsOf = (v: { levels: unknown }) =>
  new Map((((v.levels ?? {}) as { behavioralIndicators?: Array<{ level: number; indicator: string }> }).behavioralIndicators ?? []).map((b) => [b.level, b.indicator]));
const dbComp = (id: string) => prisma.competency.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { version: 'asc' } } } });
const drafts = async (id: string) => (await dbComp(id)).versions.filter((v) => v.status === 'DRAFT');
const totalVersions = async () => prisma.competencyVersion.count({ where: { competencyId: { in: snaps.map((s) => s.id) } } });

async function restore() {
  if (!snaps.length) return;
  const ids = snaps.map((s) => s.id);
  const known = new Set(snaps.flatMap((s) => s.versions.map((v) => v.id)));
  const now = await prisma.competencyVersion.findMany({ where: { competencyId: { in: ids } } });
  const mine = now.filter((v) => !known.has(v.id)).map((v) => v.id);
  await prisma.auditLog.deleteMany({
    where: { actorEmail: 'cli:import-indicators', entityType: 'CompetencyVersion', entityId: { in: now.map((v) => v.id) }, timestamp: { gte: startedAt } },
  });
  if (mine.length) await prisma.competencyVersion.deleteMany({ where: { id: { in: mine } } });
  for (const s of snaps) {
    for (const v of s.versions) {
      const cur = now.find((x) => x.id === v.id);
      if (cur && JSON.stringify(cur.levels) !== v.levelsJson) await prisma.competencyVersion.update({ where: { id: v.id }, data: { levels: JSON.parse(v.levelsJson) } });
    }
  }
}

async function main() {
  assertSafeTarget();
  if (!(await health())) {
    console.error('\n✖ Máy chủ chưa chạy hoặc chưa nối được CSDL. Chạy "npm test" (tự bật máy chủ) hoặc "npm run dev" trước.\n');
    process.exit(2);
  }
  try {
    await run();
  } finally {
    await restore();
    rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
  process.exit(t.finish());
}

async function run() {
  const admin = await seedLogin('admin@flamingo.vn');

  t.section('1 · Chuẩn bị: chọn 3 năng lực đã ban hành, chưa có bản nháp');
  const all = await prisma.competency.findMany({ where: { currentVersionId: { not: null } }, include: { versions: true }, orderBy: { code: 'asc' } });
  const pick = all.filter((c) => c.versions.every((v) => v.status !== 'DRAFT') && levelsOf(c.versions.find((v) => v.id === c.currentVersionId)!).size >= 3).slice(0, 3);
  if (!t.check('Có ≥ 3 năng lực đã ban hành, chưa có bản nháp, có chỉ báo', pick.length === 3, 'Chạy "npm run seed:all"; nếu mọi năng lực đã có bản nháp thật, dùng CSDL thử trống')) return;
  snaps = pick.map((c) => ({
    id: c.id, code: c.code, currentVersionId: c.currentVersionId,
    versions: c.versions.map((v) => ({ id: v.id, version: v.version, status: v.status, levelsJson: JSON.stringify(v.levels) })),
  }));
  const [A, B, C] = pick;
  const curA = A.versions.find((v) => v.id === A.currentVersionId)!;
  const baseA = levelsOf(curA);
  const v0 = await totalVersions();

  const A2 = 'Chủ động phân tích dữ liệu để đề xuất phương án cải tiến quy trình trong phạm vi nhóm (TIMP).';
  const A4 = 'Dẫn dắt nhiều bộ phận cùng áp dụng một tiêu chuẩn chung và theo dõi kết quả theo quý (TIMP).';
  const B1 = 'Nắm được mục đích của công việc và hỏi khi chưa rõ yêu cầu (TIMP).';

  // ------------------------------------------------------------ 2. chạy thử
  t.section('2 · Chạy thử (không --commit) không ghi gì');
  const f1 = await makeXlsx('hople.xlsx', [
    { code: A.code, levels: [undefined, A2, undefined, A4] },
    { code: B.code, levels: [B1] },
  ]);
  const d1 = cli(f1);
  t.eq('Thoát mã 0', d1.code, 0);
  t.check('Báo "CHẠY THỬ" và "Sẵn sàng tạo/bổ sung 2 bản nháp"', /CHẠY THỬ/.test(d1.out) && /Sẵn sàng tạo\/bổ sung 2 bản nháp/.test(d1.out), d1.out.slice(-400));
  t.eq('CSDL không đổi (số phiên bản)', await totalVersions(), v0);

  // ------------------------------------------------------------ 3. ghi thật
  t.section('3 · Ghi thật (--commit): tạo bản NHÁP, không đụng bản đã ban hành');
  const c1 = cli(f1, true);
  t.eq('Thoát mã 0', c1.code, 0);
  t.check('Báo tạo mới 2 bản nháp', /tạo mới 2 bản nháp/.test(c1.out), c1.out.slice(-300));
  const dA = (await drafts(A.id))[0];
  const dB = (await drafts(B.id))[0];
  t.check('A và B mỗi năng lực có đúng 1 bản nháp', !!dA && !!dB && (await drafts(A.id)).length === 1 && (await drafts(B.id)).length === 1);
  t.eq('Số phiên bản tăng đúng 2', await totalVersions(), v0 + 2);
  t.eq('Bản nháp A đánh số = bản lớn nhất + 1', dA.version, Math.max(...A.versions.map((v) => v.version)) + 1);
  const lvA = levelsOf(dA);
  t.eq('Mức 2 và 4 lấy từ file', [lvA.get(2), lvA.get(4)], [A2, A4]);
  t.check('Mức không đổi (1, 3, 5…) giữ nguyên từ bản đang hiệu lực', [1, 3, 5].every((l) => lvA.get(l) === baseA.get(l)));
  const metaA = dA.levels as Record<string, unknown>;
  t.eq('Ghi vết người soạn và tên file nguồn', [metaA.authoredBy, metaA.importedFrom], [AUTHOR, 'hople.xlsx']);
  t.eq('Tiêu đề/định nghĩa nháp lấy từ bản gốc', [dA.title, dA.definition], [curA.title, curA.definition]);
  const afterA = await dbComp(A.id);
  t.eq('Bản đang hiệu lực không đổi (currentVersionId)', afterA.currentVersionId, A.currentVersionId);
  t.eq('Nội dung bản PUBLISHED giữ nguyên từng chữ', JSON.stringify(afterA.versions.find((v) => v.id === curA.id)!.levels), JSON.stringify(curA.levels));
  t.eq('Bản ban hành vẫn là PUBLISHED', afterA.versions.find((v) => v.id === curA.id)!.status, curA.status);
  t.eq('Bản nháp B: mức 1 từ file', levelsOf(dB).get(1), B1);
  const auds = await prisma.auditLog.findMany({ where: { actorEmail: 'cli:import-indicators', entityId: { in: [dA.id, dB.id] } } });
  t.eq('Nhật ký: mỗi bản nháp 1 dòng IMPORT', [auds.length, auds.every((a) => a.action === 'IMPORT' && a.entityType === 'CompetencyVersion')], [2, true]);
  const viaApi = await api('/api/competencies', { token: admin });
  const apiA = (viaApi.body.competencies as any[]).find((c) => c.id === A.id);
  t.eq('API vẫn trả bản đang hiệu lực cho năng lực A (bản nháp chưa có hiệu lực)', apiA?.currentVersionId, A.currentVersionId);

  // ------------------------------------------------------------ 4. nhập lại
  t.section('4 · Nhập lại cùng file — không nhân đôi');
  const c2 = cli(f1, true);
  t.eq('Thoát mã 0', c2.code, 0);
  t.check('Mọi dòng bị bỏ qua vì "không có mức nào thay đổi"', /Bỏ qua 2/.test(c2.out) && /tạo mới 0 bản nháp · bổ sung 0/.test(c2.out), c2.out.slice(-300));
  t.eq('Số phiên bản không đổi', await totalVersions(), v0 + 2);
  t.eq('Nội dung bản nháp A không đổi', JSON.stringify((await drafts(A.id))[0].levels), JSON.stringify(dA.levels));
  t.eq('Không thêm nhật ký', await prisma.auditLog.count({ where: { actorEmail: 'cli:import-indicators', entityId: { in: [dA.id, dB.id] } } }), 2);

  // ------------------------------------------------------------ 5. bổ sung vào nháp có sẵn
  t.section('5 · Bổ sung vào bản nháp đang mở (không tạo bản mới)');
  const A5 = 'Xây dựng và truyền thông tầm nhìn chuyên môn, được các đơn vị khác tham vấn thường xuyên (TIMP).';
  const f2 = await makeXlsx('bosung.xlsx', [{ code: A.code, levels: [undefined, A2, undefined, undefined, A5], author: 'TIMP Người soạn 2' }]);
  const c3 = cli(f2, true);
  t.eq('Thoát mã 0', c3.code, 0);
  t.check('Báo bổ sung 1 bản nháp có sẵn', /bổ sung 1 bản nháp có sẵn/.test(c3.out), c3.out.slice(-300));
  const dA2 = await drafts(A.id);
  t.eq('Vẫn đúng 1 bản nháp, cùng id', [dA2.length, dA2[0]?.id], [1, dA.id]);
  const lvA2 = levelsOf(dA2[0]);
  t.eq('Gộp: mức 2 & 4 cũ còn, mức 5 mới thêm', [lvA2.get(2), lvA2.get(4), lvA2.get(5)], [A2, A4, A5]);
  t.eq('Người soạn cập nhật theo lần nhập sau', (dA2[0].levels as any).authoredBy, 'TIMP Người soạn 2');
  t.eq('Tổng số phiên bản vẫn +2', await totalVersions(), v0 + 2);

  // ------------------------------------------------------------ 6. trạng thái, CSV, nguyên văn AI
  t.section('6 · Bỏ qua dòng "Đang viết"; định dạng CSV; ghi vết nguyên văn AI');
  const Cbase = levelsOf(C.versions.find((v) => v.id === C.currentVersionId)!);
  const C3 = 'Tự lên kế hoạch, theo dõi tiến độ và báo cáo kết quả công việc đúng hạn (TIMP).';
  const f3 = await makeXlsx('dangviet.xlsx', [
    { code: C.code, levels: [undefined, undefined, C3], status: 'Đang viết' },
    { code: C.code, levels: [undefined, undefined, C3], status: '' },
  ]);
  const c4 = cli(f3, true);
  t.eq('Dòng "Đang viết"/trống: thoát 0, bỏ qua', [c4.code, /Bỏ qua 2/.test(c4.out)], [0, true]);
  t.eq('Không tạo bản nháp C', (await drafts(C.id)).length, 0);

  const csvPath = join(dir, 'chibao.csv');
  const C2 = 'Hoàn thành công việc được giao đúng chất lượng và chủ động báo cáo vướng mắc (TIMP).';
  writeFileSync(csvPath, `﻿ma_nang_luc,muc_1,muc_2,muc_3,muc_4,muc_5,nguoi_soan,trang_thai\n${C.code},,"${C2}",,,,TIMP CSV,Đã nộp\n`);
  const c5 = cli(csvPath, true);
  t.eq('CSV (có BOM): thoát 0', c5.code, 0);
  const dC = (await drafts(C.id))[0];
  t.eq('CSV tạo bản nháp C, mức 2 từ file', [!!dC, dC && levelsOf(dC).get(2)], [true, C2]);
  t.check('Mức không có trong CSV giữ nguyên từ bản hiệu lực', dC && [1, 3, 4, 5].every((l) => levelsOf(dC).get(l) === Cbase.get(l)));

  const aiText = 'Nhân viên chủ động chia sẻ kiến thức với đồng nghiệp trong nhóm (văn bản AI đề xuất).';
  const f4 = await makeXlsx('nguyenvan.xlsx', [{ code: C.code, levels: [undefined, undefined, undefined, undefined, aiText] }], { aiOriginal: { [C.code]: ['', '', '', '', `[DỰ THẢO AI] ${aiText}`] } });
  const c6 = cli(f4, true);
  t.eq('Giữ nguyên văn AI (chỉ xoá nhãn): vẫn ghi, có cảnh báo', [c6.code, /nguyên văn bản AI ở mức 5/.test(c6.out)], [0, true]);
  const dC2 = (await drafts(C.id))[0];
  t.eq('Ghi vết aiAcceptedVerbatim = [5]', (dC2.levels as any).aiAcceptedVerbatim, [5]);
  t.eq('Bản nháp C vẫn chỉ 1 (gộp)', (await drafts(C.id)).length, 1);

  // ------------------------------------------------------------ 7. file lỗi
  t.section('7 · File lỗi: không ghi gì (kể cả dòng tốt cùng file)');
  const vBefore = await totalVersions();
  const snapAll = JSON.stringify((await prisma.competencyVersion.findMany({ where: { competencyId: { in: snaps.map((s) => s.id) } }, orderBy: { id: 'asc' } })).map((v) => [v.id, v.levels]));
  const GOOD = 'Đề xuất giải pháp mới và được nhóm áp dụng trong công việc hằng ngày (TIMP).';
  const fresh = pick.find((c) => c.id === B.id)!; // B còn bản nháp mức 1 → thêm mức 3 thì hợp lệ
  const cases: Array<[string, Line[], RegExp]> = [
    ['còn nhãn [DỰ THẢO AI]', [{ code: fresh.code, levels: [undefined, undefined, GOOD] }, { code: A.code, levels: [undefined, `[DỰ THẢO AI] ${A2} khác`] }], /vẫn còn nhãn dự thảo AI/],
    ['còn giữ chỗ "[Mức 4 chưa có…]"', [{ code: A.code, levels: [undefined, undefined, undefined, '[Mức 4 chưa có chỉ báo]'] }], /vẫn còn nhãn dự thảo AI\/giữ chỗ/],
    ['quá ngắn (< 15 ký tự)', [{ code: A.code, levels: [undefined, 'Quá ngắn'] }], /quá ngắn/],
    ['mã năng lực không tồn tại', [{ code: 'KHONG-CO-MA', levels: [GOOD] }], /không có trong CSDL/],
    ['lặp mã trong file', [{ code: A.code, levels: [undefined, undefined, GOOD] }, { code: A.code, levels: [undefined, undefined, undefined, GOOD + ' khác'] }], /xuất hiện hai lần/],
  ];
  for (const [name, lines, re] of cases) {
    const f = await makeXlsx(`loi-${name.length}.xlsx`, lines);
    const r = cli(f, true);
    t.check(`Lỗi "${name}": thoát mã 2, báo đúng lý do, không ghi`, r.code === 2 && re.test(r.out) && /KHÔNG ghi gì/.test(r.out), `mã ${r.code}: ${r.out.slice(-300)}`);
  }
  t.eq('Sau mọi file lỗi: số phiên bản không đổi', await totalVersions(), vBefore);
  t.eq('Sau mọi file lỗi: nội dung các phiên bản không đổi', JSON.stringify((await prisma.competencyVersion.findMany({ where: { competencyId: { in: snaps.map((s) => s.id) } }, orderBy: { id: 'asc' } })).map((v) => [v.id, v.levels])), snapAll);

  // ------------------------------------------------------------ 8. file hỏng / thiếu cột
  t.section('8 · File hỏng: thiếu cột, sai tên sheet, không tồn tại');
  const fNoCol = await makeXlsx('thieucot.xlsx', [{ code: A.code, levels: [undefined, GOOD] }], { noLevel5Col: true });
  const rNoCol = cli(fNoCol, true);
  t.check('Thiếu cột "Mức 5": thoát mã 1, báo thiếu cột l5', rNoCol.code === 1 && /Thiếu cột ở dòng 4: l5/.test(rNoCol.out), `mã ${rNoCol.code}: ${rNoCol.out.slice(-250)}`);
  const fSheet = await makeXlsx('saisheet.xlsx', [{ code: A.code, levels: [undefined, GOOD] }], { sheetName: 'Sheet1' });
  const rSheet = cli(fSheet, true);
  t.check('Sai tên sheet: thoát mã 1, báo "01_Nhap_chi_bao"', rSheet.code === 1 && /01_Nhap_chi_bao/.test(rSheet.out), `mã ${rSheet.code}: ${rSheet.out.slice(-250)}`);
  const rMissing = cli(join(dir, 'khong-ton-tai.xlsx'), true);
  t.eq('File không tồn tại: thoát mã 1', rMissing.code, 1);
  const bad = join(dir, 'hong.xlsx');
  writeFileSync(bad, 'đây không phải file xlsx');
  t.eq('File .xlsx hỏng (không phải zip): thoát mã 1', cli(bad, true).code, 1);
  const noArg = spawnSync(process.execPath, ['--import', 'tsx', 'src/import-indicators.ts'], { cwd: ROOT, env: process.env, encoding: 'utf-8', timeout: 60_000 });
  t.check('Không truyền file: thoát mã 1, in cách dùng', noArg.status === 1 && /Cách dùng/.test(`${noArg.stderr}${noArg.stdout}`));
  t.eq('Sau file hỏng: số phiên bản không đổi', await totalVersions(), vBefore);

  // ------------------------------------------------------------ 9. dọn
  t.section('9 · Dọn dữ liệu thử');
  await restore();
  t.eq('Đã xoá mọi bản nháp do kịch bản tạo (số phiên bản về như ban đầu)', await totalVersions(), v0);
  const same = await Promise.all(snaps.map(async (s) => JSON.stringify((await dbComp(s.id)).versions.map((v) => [v.id, v.status, v.levels])) === JSON.stringify(s.versions.map((v) => [v.id, v.status, JSON.parse(v.levelsJson)]))));
  t.check('Ba năng lực thử trở về đúng trạng thái trước khi chạy', same.every(Boolean));
  t.eq('Không còn nhật ký cli:import-indicators của lần chạy này', await prisma.auditLog.count({ where: { actorEmail: 'cli:import-indicators', timestamp: { gte: startedAt } } }), 0);
}

main();
