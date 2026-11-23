import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requirePermission, audit } from '../auth.js';

/**
 * BÀN DUYỆT HR — gỡ các quyết định đang chặn vận hành:
 *   QĐ-02  duyệt bảng đối chiếu mã Sổ tay → mã Từ điển (theo NHÃN, áp cho mọi vai trò dùng nhãn đó)
 *   QĐ-03  gán đơn vị chủ quản cho năng lực chưa có chủ (dùng PATCH /competencies/:id/owner sẵn có)
 *   QĐ-04b rà soát bản nháp chỉ báo: so từng mức với bản đang hiệu lực, ban hành hoặc trả lại
 */
export const reviewRouter = Router();

const CAN_VIEW = ['competency:author', 'competency:publish'];
const APP_ROLE_NOTE = 'Duyệt trên app bởi'; // vai trò được duyệt nguyên khối qua PUT /job-roles/:code/requirements
const APP_XW_NOTE = 'Duyệt đối chiếu trên app';
// Lưu ý: NOT(note LIKE ..) loại luôn các dòng note = NULL trong SQL → phải gộp điều kiện note IS NULL
const NOT_ROLE_APPROVED = { OR: [{ note: null }, { NOT: { note: { startsWith: APP_ROLE_NOTE } } }] };

/** Phương án đơn vị chủ quản [PROPOSAL] — đồng bộ với Sổ quyết định mục 3.1 */
export const OWNER_PROPOSALS: Record<string, { proposal: string; alternative: string; basis: string }> = {
  FU02: { proposal: 'BTGD', alternative: 'VPCT', basis: '[SOURCE] Sổ tay sheet 07: chưa có đơn vị chủ quản rõ ràng — Ban TGĐ tạm giữ' },
  FU16: { proposal: 'B06', alternative: 'FRT', basis: '[INFERENCE] Chuẩn dịch vụ tự xây, dùng chung khách sạn và lữ hành' },
  FU23: { proposal: 'B06', alternative: 'FRT', basis: '[INFERENCE] Đi cùng FU24 do B06 chủ trì' },
  FU29: { proposal: 'B01', alternative: 'B10', basis: '[SOURCE] Tài sản giữ ở cấp Tập đoàn; B11-P4 không quản tài sản khai thác' },
  FU43: { proposal: 'B05', alternative: '(lập đơn vị quản lý vận hành)', basis: '[INFERENCE] Nối tiếp bàn giao FU42' },
  FU45: { proposal: 'B12', alternative: 'BTGD', basis: '[INFERENCE] Gần tuân thủ và quản trị rủi ro; B07 phối hợp' },
};

type Ind = { level: number; indicator: string };
type Levels = { behavioralIndicators?: Ind[]; aiAcceptedVerbatim?: number[]; authoredBy?: string | null; importedFrom?: string; completeness?: string };
const TAG_RE = /\[DỰ THẢO (AI|TỰ SINH)|\[Mức \d chưa có/i;

// ================================================================ TỔNG QUAN

reviewRouter.get('/review/summary', authenticate, requirePermission(...CAN_VIEW), async (_req, res) => {
  const [pendingXw, ownersMissing, drafts] = await Promise.all([
    prisma.jobRoleRequirement.findMany({
      where: { mappingStatus: { not: 'APPROVED' } },
      select: { sourceLabel: true },
      distinct: ['sourceLabel'],
    }),
    prisma.competency.count({ where: { isActive: true, hasOwner: false } }),
    prisma.competencyVersion.count({ where: { status: 'DRAFT' } }),
  ]);
  res.json({ crosswalkPending: pendingXw.length, ownersMissing, drafts });
});

// ================================================================ QĐ-02 ĐỐI CHIẾU

async function crosswalkRows() {
  const rows = await prisma.jobRoleRequirement.findMany({
    where: NOT_ROLE_APPROVED,
    include: { competency: { select: { code: true, name: true } }, jobRole: { select: { code: true, title: true } } },
    orderBy: { sourceLabel: 'asc' },
  });
  const byLabel = new Map<string, typeof rows>();
  for (const r of rows) byLabel.set(r.sourceLabel, [...(byLabel.get(r.sourceLabel) ?? []), r]);
  return [...byLabel.entries()].map(([label, list]) => {
    const approved = list.filter((x) => x.mappingStatus === 'APPROVED').length;
    const first = list[0];
    return {
      sourceLabel: label,
      competency: first.competency,
      confidence: first.mappingConfidence,
      note: first.note,
      status: approved === list.length ? 'APPROVED' : first.competencyId ? 'PROPOSED' : 'UNMAPPED',
      uses: list.length,
      roles: list.map((x) => ({ code: x.jobRole.code, title: x.jobRole.title, requiredLevel: x.requiredLevel })),
    };
  });
}

reviewRouter.get('/review/crosswalk', authenticate, requirePermission(...CAN_VIEW), async (_req, res) => {
  const items = await crosswalkRows();
  const roleApproved = await prisma.jobRole.count({ where: { requirements: { some: { note: { startsWith: APP_ROLE_NOTE } } } } });
  res.json({
    items,
    counts: {
      total: items.length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
      proposed: items.filter((i) => i.status === 'PROPOSED').length,
      unmapped: items.filter((i) => i.status === 'UNMAPPED').length,
      rolesApprovedWhole: roleApproved,
    },
  });
});

reviewRouter.post('/review/crosswalk/approve', authenticate, requirePermission('competency:publish'), async (req, res) => {
  const body = z
    .object({ items: z.array(z.object({ sourceLabel: z.string().min(1), competencyCode: z.string().min(1) })).min(1).max(100) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });
  const codes = [...new Set(body.data.items.map((i) => i.competencyCode))];
  const comps = await prisma.competency.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const idByCode = new Map(comps.map((c) => [c.code, c.id]));
  const unknown = codes.filter((c) => !idByCode.has(c));
  if (unknown.length) return res.status(400).json({ error: `Mã không có trong Từ điển: ${unknown.join(', ')}` });

  const note = `${APP_XW_NOTE} bởi ${req.user!.email} ngày ${new Date().toLocaleDateString('vi-VN')}`;
  let updated = 0;
  const changes: Array<{ sourceLabel: string; from: string | null; to: string }> = [];
  await prisma.$transaction(async (tx) => {
    for (const it of body.data.items) {
      const before = await tx.jobRoleRequirement.findFirst({
        where: { sourceLabel: it.sourceLabel, ...NOT_ROLE_APPROVED },
        include: { competency: { select: { code: true } } },
      });
      const r = await tx.jobRoleRequirement.updateMany({
        where: { sourceLabel: it.sourceLabel, ...NOT_ROLE_APPROVED },
        data: { competencyId: idByCode.get(it.competencyCode)!, mappingStatus: 'APPROVED', mappingConfidence: 'HR', note },
      });
      updated += r.count;
      changes.push({ sourceLabel: it.sourceLabel, from: before?.competency?.code ?? null, to: it.competencyCode });
    }
  });
  await audit(req, 'UPDATE', 'Crosswalk', 'BATCH', { entityName: `Duyệt đối chiếu ${body.data.items.length} nhãn`, newValues: changes });
  res.json({ ok: true, labels: body.data.items.length, requirementsUpdated: updated });
});

/** Xuất bảng đối chiếu hiện hành ra CSV đúng định dạng doi_chieu_ma_nang_luc.csv — để cập nhật file nguồn */
reviewRouter.get('/review/crosswalk.csv', authenticate, requirePermission(...CAN_VIEW), async (_req, res) => {
  const items = await crosswalkRows();
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    'ma_so_tay,ten_so_tay,ma_tu_dien,ten_tu_dien,do_tin_cay,so_lan_dung_trong_vai_tro,trang_thai,ghi_chu',
    ...items.map((i) =>
      [i.sourceLabel, i.sourceLabel, i.competency?.code ?? '', i.competency?.name ?? '', i.confidence ?? '', i.uses,
        i.status === 'APPROVED' ? 'DA_DUYET' : 'DE_XUAT', i.note ?? ''].map(esc).join(','),
    ),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="doi_chieu_ma_nang_luc.csv"');
  res.send('﻿' + lines.join('\n'));
});

// ================================================================ QĐ-03 CHỦ QUẢN

reviewRouter.get('/review/owners', authenticate, requirePermission(...CAN_VIEW), async (_req, res) => {
  const comps = await prisma.competency.findMany({
    where: { isActive: true, hasOwner: false },
    select: { id: true, code: true, name: true, domainName: true, owningUnit: true },
    orderBy: { code: 'asc' },
  });
  const units = await prisma.orgUnit.findMany({ select: { code: true, name: true } });
  const nameOf = (code: string) => units.find((u) => u.code === code)?.name ?? null;
  res.json({
    items: comps.map((c) => {
      const p = OWNER_PROPOSALS[c.code];
      return {
        ...c,
        proposal: p ? { code: p.proposal, name: nameOf(p.proposal), alternative: p.alternative, alternativeName: nameOf(p.alternative), basis: p.basis } : null,
      };
    }),
  });
});

// ================================================================ QĐ-04b BẢN NHÁP

reviewRouter.get('/review/drafts', authenticate, requirePermission(...CAN_VIEW), async (_req, res) => {
  const drafts = await prisma.competencyVersion.findMany({
    where: { status: 'DRAFT' },
    include: {
      competency: {
        select: { code: true, name: true, owningUnit: true, currentVersionId: true, category: { select: { code: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const currentIds = drafts.map((d) => d.competency.currentVersionId).filter((x): x is string => !!x);
  const currents = await prisma.competencyVersion.findMany({ where: { id: { in: currentIds } } });
  res.json({
    items: drafts
      .map((d) => {
        const lv = (d.levels ?? {}) as Levels;
        const cur = currents.find((c) => c.id === d.competency.currentVersionId);
        const curLv = ((cur?.levels ?? {}) as Levels).behavioralIndicators ?? [];
        const levels = [1, 2, 3, 4, 5].map((n) => {
          const draft = lv.behavioralIndicators?.find((b) => b.level === n)?.indicator ?? null;
          const current = curLv.find((b) => b.level === n)?.indicator ?? null;
          return {
            level: n, current, draft,
            changed: (draft ?? '') !== (current ?? ''),
            tagged: !!draft && TAG_RE.test(draft),
            aiVerbatim: (lv.aiAcceptedVerbatim ?? []).includes(n),
          };
        });
        return {
          versionId: d.id,
          version: d.version,
          createdAt: d.createdAt,
          competency: { code: d.competency.code, name: d.competency.name, owningUnit: d.competency.owningUnit, category: d.competency.category.code },
          currentVersion: cur?.version ?? null,
          authoredBy: lv.authoredBy ?? null,
          importedFrom: lv.importedFrom ?? null,
          levels,
          readyToPublish: levels.every((l) => !l.tagged) && levels.some((l) => l.changed),
          taggedCount: levels.filter((l) => l.tagged).length,
          aiVerbatimCount: levels.filter((l) => l.aiVerbatim).length,
        };
      })
      .sort((a, b) => Number(b.readyToPublish) - Number(a.readyToPublish) || a.competency.code.localeCompare(b.competency.code)),
  });
});

/** Trả lại (xoá) bản nháp — chỉ DRAFT. Nội dung bản nháp được lưu nguyên vào nhật ký để không mất. */
reviewRouter.post('/competency-versions/:id/reject', authenticate, requirePermission('competency:publish'), async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(5).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Cần ghi lý do trả lại (tối thiểu 5 ký tự)' });
  const v = await prisma.competencyVersion.findUnique({ where: { id: req.params.id }, include: { competency: { select: { code: true } } } });
  if (!v) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });
  if (v.status !== 'DRAFT') return res.status(409).json({ error: 'Chỉ trả lại được bản nháp' });
  await prisma.competencyVersion.delete({ where: { id: v.id } });
  await audit(req, 'DELETE', 'CompetencyVersion', v.id, {
    entityName: `TRẢ LẠI ${v.competency.code} v${v.version}: ${body.data.reason}`,
    oldValues: { title: v.title, definition: v.definition, levels: v.levels },
  });
  res.json({ ok: true });
});
