import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

/**
 * Phần thuần (không chạm CSDL) của lệnh import:indicators — tách ra để kiểm thử được.
 *
 * File mẫu (QĐ-04 — "AI soạn nháp, chuyên gia sửa"):
 *   Sheet 01_Nhap_chi_bao : 5 cột Mức 1..5. Ô nháp AI bắt đầu bằng nhãn [DỰ THẢO AI…].
 *                           Chuyên gia sửa nội dung VÀ xoá nhãn = xác nhận đã duyệt ô đó.
 *   Sheet 02_Ban_goc_AI   : bản gốc AI (khoá) — dùng để phát hiện ô "chấp nhận nguyên văn AI".
 */

export type Row = {
  rowNumber: number;
  code: string;
  levels: Record<number, string>;
  author: string;
  status: string;
};
export type Checked = Row & {
  result: 'OK' | 'WARNING' | 'ERROR' | 'SKIP';
  messages: string[];
  /** Các mức thực sự thay đổi so với bản hiện hành → sẽ ghi vào bản nháp */
  changed: number[];
  /** Các mức chuyên gia giữ nguyên văn bản AI (chỉ xoá nhãn) — lưu vết */
  aiVerbatim: number[];
};

export const LEVELS = [1, 2, 3, 4, 5] as const;
export const AI_TAG_RE = /\[DỰ THẢO (AI|TỰ SINH)[^\]]*\]/i;
const MIN_LEN = 15;
const MAX_LEN = 600;
const BANNED = [AI_TAG_RE, /\[Mức \d chưa có/i, /lorem ipsum/i];

export const norm = (t: string) => t.replace(AI_TAG_RE, '').replace(/\s+/g, ' ').trim().toLowerCase();

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join('').trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim();
  return '';
}

export type ReadResult = { rows: Row[]; aiOriginal: Map<string, Record<number, string>> };

export async function readXlsx(path: string): Promise<ReadResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet('01_Nhap_chi_bao');
  if (!ws) throw new Error('Không thấy sheet "01_Nhap_chi_bao". Hãy dùng đúng file mẫu, không đổi tên sheet.');

  const findCols = (sheet: ExcelJS.Worksheet, headerRow: number) => {
    const col: Record<string, number> = {};
    sheet.getRow(headerRow).eachCell((cell, n) => {
      const t = cellText(cell.value);
      if (t === 'Mã NL') col.code = n;
      for (const l of LEVELS) if (t.startsWith(`Mức ${l}`)) col[`l${l}`] = n;
      if (t === 'Người soạn') col.author = n;
      if (t === 'Trạng thái') col.status = n;
    });
    return col;
  };

  const col = findCols(ws, 4);
  const missing = ['code', 'l1', 'l2', 'l3', 'l4', 'l5'].filter((k) => !col[k]);
  if (missing.length) throw new Error(`Thiếu cột ở dòng 4: ${missing.join(', ')}. Không được đổi tiêu đề cột.`);

  const rows: Row[] = [];
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = cellText(row.getCell(col.code).value);
    if (!code) continue;
    const levels: Record<number, string> = {};
    for (const l of LEVELS) levels[l] = cellText(row.getCell(col[`l${l}`]).value);
    rows.push({
      rowNumber: r,
      code,
      levels,
      author: col.author ? cellText(row.getCell(col.author).value) : '',
      status: col.status ? cellText(row.getCell(col.status).value) : '',
    });
  }

  const aiOriginal = new Map<string, Record<number, string>>();
  const base = wb.getWorksheet('02_Ban_goc_AI');
  if (base) {
    const bc = findCols(base, 1);
    if (bc.code) {
      for (let r = 2; r <= base.rowCount; r++) {
        const row = base.getRow(r);
        const code = cellText(row.getCell(bc.code).value);
        if (!code) continue;
        const lv: Record<number, string> = {};
        for (const l of LEVELS) if (bc[`l${l}`]) lv[l] = cellText(row.getCell(bc[`l${l}`]).value);
        aiOriginal.set(code, lv);
      }
    }
  }
  return { rows, aiOriginal };
}

export function readCsv(path: string): ReadResult {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return {
    rows: parsed.data.map((r, i) => ({
      rowNumber: i + 2,
      code: (r.ma_nang_luc ?? '').trim(),
      levels: Object.fromEntries(LEVELS.map((l) => [l, (r[`muc_${l}`] ?? '').trim()])),
      author: (r.nguoi_soan ?? '').trim(),
      status: (r.trang_thai ?? '').trim(),
    })),
    aiOriginal: new Map(),
  };
}

export type LevelsJson = { behavioralIndicators?: Array<{ level: number; indicator: string }>; [k: string]: unknown };

export type CompLite = {
  code: string;
  currentVersionId: string | null;
  versions: Array<{ id: string; status: string; levels: unknown }>;
};

/** Bản làm gốc để so sánh: bản nháp đang mở, nếu không có thì bản đang hiệu lực. */
export function baseIndicators(comp: CompLite): Map<number, string> {
  const draft = comp.versions.find((v) => v.status === 'DRAFT');
  const cur = draft ?? comp.versions.find((v) => v.id === comp.currentVersionId) ?? comp.versions[0];
  return new Map(((cur?.levels ?? {}) as LevelsJson).behavioralIndicators?.map((b) => [b.level, b.indicator]) ?? []);
}

export function checkRows(rows: Row[], comps: CompLite[], aiOriginal = new Map<string, Record<number, string>>()): Checked[] {
  const byCode = new Map(comps.map((c) => [c.code, c]));
  const seen = new Set<string>();
  return rows.map((r): Checked => {
    const m: string[] = [];
    let result = 'OK' as Checked['result'];
    const err = (s: string) => { m.push(`✖ ${s}`); result = 'ERROR'; };
    const warn = (s: string) => { m.push(`⚠ ${s}`); if (result === 'OK') result = 'WARNING'; };
    const skip = (s: string): Checked => ({ ...r, result: 'SKIP', messages: [s], changed: [], aiVerbatim: [] });

    if (/^đang viết$/i.test(r.status) || !r.status) return skip('Trạng thái "Đang viết" hoặc trống — chưa nộp');

    const comp = byCode.get(r.code);
    if (!comp) return { ...r, result: 'ERROR', messages: [`✖ Mã ${r.code} không có trong CSDL (đã chạy seed:all chưa?)`], changed: [], aiVerbatim: [] };
    if (seen.has(r.code)) err(`Mã ${r.code} xuất hiện hai lần trong file`);
    seen.add(r.code);

    const base = baseIndicators(comp);
    const ai = aiOriginal.get(r.code) ?? {};
    const changed: number[] = [];
    const aiVerbatim: number[] = [];

    for (const l of LEVELS) {
      const t = r.levels[l];
      if (!t) continue;
      if (BANNED.some((b) => b.test(t))) {
        err(`Mức ${l} vẫn còn nhãn dự thảo AI/giữ chỗ — chuyên gia sửa xong thì xoá nhãn`);
        continue;
      }
      if (base.get(l) && norm(base.get(l)!) === norm(t)) continue; // không đổi
      if (t.length < MIN_LEN) err(`Mức ${l} quá ngắn (${t.length} ký tự, tối thiểu ${MIN_LEN})`);
      if (t.length > MAX_LEN) warn(`Mức ${l} dài ${t.length} ký tự — nên rút gọn còn 1–2 câu`);
      if (ai[l] && norm(ai[l]) === norm(t)) aiVerbatim.push(l);
      changed.push(l);
    }

    if (changed.length === 0 && result !== 'ERROR') return skip('Không có mức nào thay đổi so với bản hiện hành');

    const texts = LEVELS.filter((l) => r.levels[l]).map((l) => norm(r.levels[l]));
    if (new Set(texts).size < texts.length) warn('Có hai mức trùng nội dung');
    if (changed.includes(3) && base.get(3) && !AI_TAG_RE.test(base.get(3)!)) warn('Đổi Mức 3 — mốc chuẩn của Từ điển; cần HR xác nhận');
    if (aiVerbatim.length) warn(`Giữ nguyên văn bản AI ở mức ${aiVerbatim.join(', ')} (chỉ xoá nhãn) — sẽ ghi vết "chấp nhận nguyên văn AI"`);
    const missing = LEVELS.filter((l) => !r.levels[l] && !base.get(l));
    if (missing.length) warn(`Còn thiếu mức ${missing.join(', ')} — bản nháp ở trạng thái PARTIAL`);
    if (!r.author) warn('Chưa ghi Người soạn');
    return { ...r, result, messages: m, changed, aiVerbatim };
  });
}
