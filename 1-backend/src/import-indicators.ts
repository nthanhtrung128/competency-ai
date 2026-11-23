import 'dotenv/config';
import { resolve, extname } from 'node:path';
import { prisma } from './db.js';

/**
 * Nạp chỉ báo hành vi do chuyên gia sửa từ bản nháp AI (file Mau_ChiBao_ChuyenMon_Muc1-5.xlsx — QĐ-04).
 *
 *   npm run import:indicators -- ./templates/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx            ← CHẠY THỬ, không ghi gì
 *   npm run import:indicators -- ./templates/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx --commit   ← ghi thật
 *
 * Nguyên tắc:
 *   - KHÔNG BAO GIỜ sửa phiên bản đang PUBLISHED. Mỗi năng lực được ghi vào một BẢN NHÁP (DRAFT):
 *       có sẵn bản nháp → bổ sung vào bản nháp đó; chưa có → tạo bản nháp mới từ bản đang hiệu lực.
 *   - Bản nháp chỉ có hiệu lực khi HR bấm "Ban hành" (POST /api/competency-versions/:id/publish).
 *   - Dòng có Trạng thái "Đang viết" (hoặc trống) bị bỏ qua.
 *   - Ô còn nhãn [DỰ THẢO AI…] bị TỪ CHỐI. Ô giữ nguyên văn AI (chỉ xoá nhãn) được ghi vết aiAcceptedVerbatim.
 *   - Chỉ ghi các mức THỰC SỰ thay đổi so với bản làm gốc.
 *   - Chấp nhận cả file .csv với cột: ma_nang_luc, muc_1..muc_5, nguoi_soan, trang_thai
 */

import { AI_TAG_RE, readXlsx, readCsv, checkRows, type Checked, type LevelsJson } from './lib/indicators.js';

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Cách dùng: npm run import:indicators -- <đường-dẫn-file.xlsx> [--commit]');
    process.exit(1);
  }
  const full = resolve(process.cwd(), file);
  console.log(`▸ Đọc: ${full}`);
  console.log(commit ? '▸ CHẾ ĐỘ GHI THẬT (--commit)' : '▸ CHẠY THỬ — không ghi gì vào CSDL. Thêm --commit để ghi.');

  const { rows, aiOriginal } = extname(full).toLowerCase() === '.csv' ? readCsv(full) : await readXlsx(full);

  const comps = await prisma.competency.findMany({
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  const byCode = new Map(comps.map((c) => [c.code, c]));

  const checked: Checked[] = checkRows(rows, comps, aiOriginal);

  const count = (k: Checked['result']) => checked.filter((c) => c.result === k).length;
  console.log(`\n▸ Kết quả kiểm tra: ${rows.length} dòng · OK ${count('OK')} · Cảnh báo ${count('WARNING')} · Lỗi ${count('ERROR')} · Bỏ qua ${count('SKIP')}`);
  for (const c of checked.filter((x) => x.result !== 'OK' && x.result !== 'SKIP')) {
    console.log(`  Dòng ${c.rowNumber} · ${c.code}: ${c.messages.join(' | ')}`);
  }

  if (count('ERROR') > 0) {
    console.log('\n✖ Còn lỗi — KHÔNG ghi gì. Sửa file rồi chạy lại.');
    process.exit(2);
  }
  const toWrite = checked.filter((c) => c.result === 'OK' || c.result === 'WARNING');
  if (!commit) {
    console.log(`\n▸ Sẵn sàng tạo/bổ sung ${toWrite.length} bản nháp. Chạy lại với --commit để ghi.`);
    return;
  }

  let created = 0;
  let merged = 0;
  for (const c of toWrite) {
    const comp = byCode.get(c.code)!;
    const draft = comp.versions.find((v) => v.status === 'DRAFT');
    const base = draft ?? comp.versions.find((v) => v.id === comp.currentVersionId) ?? comp.versions[0];
    const lv = { ...((base.levels ?? {}) as LevelsJson) };
    const map = new Map((lv.behavioralIndicators ?? []).map((b) => [b.level, b.indicator]));
    for (const l of c.changed) map.set(l, c.levels[l]);
    lv.behavioralIndicators = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([level, indicator]) => ({ level, indicator }));
    const stillTagged = lv.behavioralIndicators.some((b) => AI_TAG_RE.test(b.indicator));
    lv.completeness = map.size === 5 && !stillTagged ? 'FULL' : 'PARTIAL';
    lv.authoredBy = c.author || null;
    lv.aiAcceptedVerbatim = [...new Set([...(((lv.aiAcceptedVerbatim as number[]) ?? [])), ...c.aiVerbatim])].sort();
    lv.importedFrom = full.split(/[\\/]/).pop();

    await prisma.$transaction(async (tx) => {
      const v = draft
        ? await tx.competencyVersion.update({ where: { id: draft.id }, data: { levels: lv as never } })
        : await tx.competencyVersion.create({
            data: {
              competencyId: comp.id,
              version: (comp.versions[0]?.version ?? 0) + 1,
              status: 'DRAFT',
              title: base.title,
              definition: base.definition,
              levels: lv as never,
            },
          });
      await tx.auditLog.create({
        data: {
          action: 'IMPORT',
          entityType: 'CompetencyVersion',
          entityId: v.id,
          entityName: `${comp.code} v${v.version} (chỉ báo mức ${c.changed.join(',')})`,
          actorEmail: 'cli:import-indicators',
          newValues: { author: c.author, levels: c.changed, aiAcceptedVerbatim: c.aiVerbatim } as never,
        },
      });
    });
    if (draft) merged++; else created++;
  }
  console.log(`\n✔ Đã ghi: tạo mới ${created} bản nháp · bổ sung ${merged} bản nháp có sẵn.`);
  console.log('▸ Bước tiếp: HR mở app → Từ điển năng lực → chọn phiên bản DRAFT → rà soát → "Ban hành".');
}

main()
  .catch((e) => { console.error('✖', (e as Error).message); process.exit(1); })
  .finally(() => prisma.$disconnect());
