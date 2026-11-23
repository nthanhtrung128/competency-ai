import React, { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Building2, FileCheck2, Download, CheckCircle2, Undo2, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useServerData, useAction, Loading, ErrorBox, Empty, Pill, inputCls, downloadAuthed } from './shared';

/**
 * BÀN DUYỆT HR — gỡ các quyết định đang chặn vận hành:
 *   Đối chiếu mã (QĐ-02) · Đơn vị chủ quản (QĐ-03) · Bản nháp chỉ báo (QĐ-04b)
 */
type Tab = 'crosswalk' | 'owners' | 'drafts';

export const ReviewDesk: React.FC = () => {
  const summary = useServerData<{ crosswalkPending: number; ownersMissing: number; drafts: number }>('/review/summary');
  const [tab, setTab] = useState<Tab>('crosswalk');
  const s = summary.data;
  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType; count?: number; qd: string }> = [
    { key: 'crosswalk', label: 'Đối chiếu mã năng lực', icon: GitCompareArrows, count: s?.crosswalkPending, qd: 'QĐ-02' },
    { key: 'owners', label: 'Đơn vị chủ quản', icon: Building2, count: s?.ownersMissing, qd: 'QĐ-03' },
    { key: 'drafts', label: 'Bản nháp chỉ báo', icon: FileCheck2, count: s?.drafts, qd: 'QĐ-04b' },
  ];
  return (
    <div className="space-y-4">
      <div className="app-card">
        <h2 className="text-base font-bold text-[var(--ink)]">Bàn duyệt của Ban NS&QTHC</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Ba việc đang chặn vận hành thật. Mỗi thao tác duyệt được ghi nhật ký kèm người duyệt và nội dung trước/sau.
        </p>
        <div className="flex flex-wrap gap-1 mt-3 border-b border-[var(--line)]">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition ${tab === t.key ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
              {t.count !== undefined && <Pill tone={t.count ? 'amber' : 'green'}>{t.count ? `${t.count} chờ` : 'xong'}</Pill>}
              <span className="text-[10px] font-mono text-[var(--muted)]">{t.qd}</span>
            </button>
          ))}
        </div>
      </div>
      {tab === 'crosswalk' && <Crosswalk onChanged={summary.reload} />}
      {tab === 'owners' && <Owners onChanged={summary.reload} />}
      {tab === 'drafts' && <Drafts onChanged={summary.reload} />}
    </div>
  );
};

// ================================================================ QĐ-02

type XwItem = {
  sourceLabel: string; competency: { code: string; name: string } | null; confidence: string | null; note: string | null;
  status: 'APPROVED' | 'PROPOSED' | 'UNMAPPED'; uses: number; roles: Array<{ code: string; title: string; requiredLevel: number }>;
};
const CONF: Record<string, ['green' | 'blue' | 'amber' | 'red' | 'gray', string]> = {
  CAO: ['green', 'Cao'], TRUNG_BINH: ['blue', 'Trung bình'], THAP: ['amber', 'Thấp'], KHONG_CO: ['red', 'Không có'], HR: ['green', 'HR đã duyệt'],
};

const Crosswalk: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { competencies, can, setNotice, refreshFromServer } = useApp();
  const d = useServerData<{ items: XwItem[]; counts: Record<string, number> }>('/review/crosswalk');
  const { run, busy } = useAction();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    if (d.data) setPick(Object.fromEntries(d.data.items.map((i) => [i.sourceLabel, i.competency?.code ?? ''])));
  }, [d.data]);
  const options = useMemo(() => competencies.filter((c) => c.scored !== false).map((c) => ({ code: c.code, name: c.name, draft: !c.currentVersionId })), [competencies]);

  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data) return null;
  const items = d.data.items.filter((i) => filter === 'all' || i.status !== 'APPROVED');
  const toggle = (l: string) => setSel((p) => { const n = new Set(p); n.has(l) ? n.delete(l) : n.add(l); return n; });
  const approve = async () => {
    const list = [...sel].filter((l) => pick[l]).map((l) => ({ sourceLabel: l, competencyCode: pick[l] }));
    const missing = [...sel].filter((l) => !pick[l]);
    if (missing.length) return setNotice({ kind: 'error', text: `Chưa chọn mã Từ điển cho: ${missing.join(', ')}` });
    const r = await run<{ requirementsUpdated: number }>('POST', '/review/crosswalk/approve', { items: list });
    if (r) {
      setNotice({ kind: 'ok', text: `Đã duyệt ${list.length} nhãn → ${r.requirementsUpdated} yêu cầu năng lực chuyển sang ĐÃ DUYỆT` });
      setSel(new Set());
      void d.reload(); onChanged(); void refreshFromServer();
    }
  };
  const c = d.data.counts;

  return (
    <div className="space-y-3 text-xs">
      <div className="app-card flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <Pill tone="green">Đã duyệt {c.approved}</Pill><Pill tone="blue">Đề xuất {c.proposed}</Pill><Pill tone="red">Chưa có mã {c.unmapped}</Pill>
          {c.rolesApprovedWhole > 0 && <Pill>{c.rolesApprovedWhole} vai trò duyệt nguyên khối ở Hồ sơ năng lực</Pill>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={`${inputCls} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}>
            <option value="pending">Chỉ dòng chờ duyệt</option><option value="all">Tất cả</option>
          </select>
          <button className="btn btn-secondary text-xs" onClick={() => setSel(new Set(items.filter((i) => i.confidence === 'CAO' && i.status !== 'APPROVED').map((i) => i.sourceLabel)))}>Chọn các dòng tin cậy CAO</button>
          <button className="btn btn-secondary text-xs flex items-center gap-1"
            onClick={() => downloadAuthed('/review/crosswalk.csv', 'doi_chieu_ma_nang_luc.csv').catch((e) => setNotice({ kind: 'error', text: String(e.message ?? e) }))}>
            <Download className="w-3.5 h-3.5" /> Xuất CSV (cập nhật file nguồn)</button>
          {can('competency:publish') && (
            <button disabled={busy || !sel.size} onClick={approve} className="btn btn-primary text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt {sel.size || ''} dòng đã chọn</button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        Mỗi dòng là một <b>nhãn gốc trong Sổ tay</b>. Duyệt một dòng là áp mã Từ điển cho <b>mọi vai trò</b> đang dùng nhãn đó.
        Có thể đổi mã trước khi duyệt. Năng lực đánh dấu (nháp) chưa ban hành.
      </p>
      {!items.length ? <Empty>Không còn dòng nào chờ duyệt.</Empty> : (
        <div className="app-card overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
              <th className="py-1.5 pr-2 w-6" /><th className="pr-2">Nhãn Sổ tay</th><th className="pr-2">Dùng ở</th><th className="pr-2">Mã Từ điển</th>
              <th className="pr-2">Độ tin cậy</th><th className="pr-2">Ghi chú</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {items.map((i) => {
                const [tone, label] = CONF[i.confidence ?? ''] ?? ['gray', i.confidence ?? '—'];
                return (
                  <tr key={i.sourceLabel} className="border-b border-[var(--line)] align-top">
                    <td className="py-1.5 pr-2"><input type="checkbox" checked={sel.has(i.sourceLabel)} onChange={() => toggle(i.sourceLabel)} disabled={!can('competency:publish')} /></td>
                    <td className="pr-2 font-semibold">{i.sourceLabel}</td>
                    <td className="pr-2" title={i.roles.map((r) => `${r.code} ${r.title} · mức ${r.requiredLevel}`).join('\n')}>{i.uses} vai trò</td>
                    <td className="pr-2 min-w-[220px]">
                      <select className={inputCls} value={pick[i.sourceLabel] ?? ''} onChange={(e) => setPick({ ...pick, [i.sourceLabel]: e.target.value })}>
                        <option value="">— chưa chọn —</option>
                        {options.map((o) => <option key={o.code} value={o.code}>{o.code} · {o.name}{o.draft ? ' (nháp)' : ''}</option>)}
                      </select>
                    </td>
                    <td className="pr-2"><Pill tone={tone}>{label}</Pill></td>
                    <td className="pr-2 text-[var(--muted)] max-w-[280px]">{i.note}</td>
                    <td>{i.status === 'APPROVED' ? <Pill tone="green">Đã duyệt</Pill> : i.status === 'PROPOSED' ? <Pill tone="blue">Đề xuất</Pill> : <Pill tone="red">Chưa có mã</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ================================================================ QĐ-03

type OwnerItem = {
  id: string; code: string; name: string; domainName: string | null; owningUnit: string | null;
  proposal: { code: string; name: string | null; alternative: string; alternativeName: string | null; basis: string } | null;
};

const Owners: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { orgUnits, can, refreshFromServer } = useApp();
  const d = useServerData<{ items: OwnerItem[] }>('/review/owners');
  const { run, busy } = useAction();
  const [pick, setPick] = useState<Record<string, string>>({});
  useEffect(() => {
    if (d.data) setPick(Object.fromEntries(d.data.items.map((i) => [i.id, i.proposal?.code ?? ''])));
  }, [d.data]);
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data?.items.length) return <Empty>Mọi năng lực đã có đơn vị chủ quản.</Empty>;
  const unitName = (code: string) => orgUnits.find((u) => u.code === code)?.name ?? code;
  return (
    <div className="space-y-2 text-xs">
      <p className="text-[11px] text-[var(--muted)]">
        Ô chọn được điền sẵn theo phương án <b>[PROPOSAL]</b> trong Sổ quyết định mục 3.1. Bấm "Gán" là quyết định chính thức: năng lực chuyển sang "có chủ quản" và
        lần nạp lại dữ liệu sau không ghi đè.
      </p>
      {d.data.items.map((i) => (
        <div key={i.id} className="app-card grid lg:grid-cols-[1fr_1.2fr_auto] gap-3 items-center">
          <div>
            <div><span className="font-mono font-bold text-[var(--brand)]">{i.code}</span> <b>{i.name}</b></div>
            <div className="text-[11px] text-[var(--muted)]">{i.domainName} · hiện ghi: {i.owningUnit ?? '—'}</div>
          </div>
          <div className="text-[11px]">
            {i.proposal ? (
              <>
                <div>Đề xuất: <b>{i.proposal.name ?? i.proposal.code}</b> · thay thế: {i.proposal.alternativeName ?? i.proposal.alternative}</div>
                <div className="text-[var(--muted)]">{i.proposal.basis}</div>
              </>
            ) : <span className="text-[var(--muted)]">Chưa có phương án đề xuất</span>}
          </div>
          {can('competency:publish') && (
            <div className="flex gap-2">
              <select className={`${inputCls} w-56`} value={pick[i.id] ?? ''} onChange={(e) => setPick({ ...pick, [i.id]: e.target.value })}>
                <option value="">— chọn đơn vị —</option>
                {orgUnits.map((u) => <option key={u.id} value={u.code}>{u.code} · {u.name}</option>)}
              </select>
              <button disabled={busy || !pick[i.id]} className="btn btn-primary text-xs" onClick={async () => {
                const code = pick[i.id];
                if (await run('PATCH', `/competencies/${i.id}/owner`, { owningUnit: `${unitName(code)} (${code})` }, `Đã gán ${i.code} cho ${unitName(code)}`)) {
                  void d.reload(); onChanged(); void refreshFromServer();
                }
              }}>Gán</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ================================================================ QĐ-04b

type DraftItem = {
  versionId: string; version: number; createdAt: string; currentVersion: number | null;
  competency: { code: string; name: string; owningUnit: string | null; category: string };
  authoredBy: string | null; importedFrom: string | null;
  levels: Array<{ level: number; current: string | null; draft: string | null; changed: boolean; tagged: boolean; aiVerbatim: boolean }>;
  readyToPublish: boolean; taggedCount: number; aiVerbatimCount: number;
};

const Drafts: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { can, refreshFromServer } = useApp();
  const d = useServerData<{ items: DraftItem[] }>('/review/drafts');
  const { run, busy } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'tagged'>('all');
  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data?.items.length) return <Empty>Không có bản nháp nào chờ duyệt.</Empty>;
  const items = d.data.items.filter((i) => filter === 'all' || (filter === 'ready' ? i.readyToPublish : i.taggedCount > 0));
  const after = () => { void d.reload(); onChanged(); void refreshFromServer(); };
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Tất cả bản nháp ({d.data.items.length})</option>
          <option value="ready">Sẵn sàng ban hành ({d.data.items.filter((i) => i.readyToPublish).length})</option>
          <option value="tagged">Còn ô dự thảo AI ({d.data.items.filter((i) => i.taggedCount).length})</option>
        </select>
        <span className="text-[11px] text-[var(--muted)]">Ô "giữ nguyên văn AI" = chuyên gia chỉ xoá nhãn, không sửa chữ — cần HR đọc kỹ trước khi ban hành.</span>
      </div>
      {items.map((i) => {
        const isOpen = open === i.versionId;
        return (
          <div key={i.versionId} className="app-card space-y-2">
            <button onClick={() => { setOpen(isOpen ? null : i.versionId); setReason(''); }} className="w-full flex items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="font-mono font-bold text-[var(--brand)]">{i.competency.code}</span>
                <b>{i.competency.name}</b>
                <span className="text-[var(--muted)]">v{i.version}{i.currentVersion ? ` (đang hiệu lực v${i.currentVersion})` : ' · năng lực mới'}</span>
              </div>
              <div className="flex gap-1">
                {i.readyToPublish ? <Pill tone="green">Sẵn sàng ban hành</Pill> : <Pill tone="amber">{i.taggedCount} ô còn dự thảo AI</Pill>}
                {i.aiVerbatimCount > 0 && <Pill tone="blue">{i.aiVerbatimCount} ô giữ nguyên văn AI</Pill>}
              </div>
            </button>
            {isOpen && (
              <>
                <div className="text-[11px] text-[var(--muted)]">Chủ quản: {i.competency.owningUnit ?? '—'} · người soạn: {i.authoredBy ?? '—'} · nguồn: {i.importedFrom ?? 'tạo trên app'}</div>
                <table className="w-full text-[11.5px]">
                  <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]"><th className="py-1 pr-2 w-14">Mức</th><th className="pr-2">Đang hiệu lực</th><th>Bản nháp</th></tr></thead>
                  <tbody>
                    {i.levels.map((l) => (
                      <tr key={l.level} className="border-b border-[var(--line)] align-top">
                        <td className="py-1.5 pr-2 font-bold">Mức {l.level}</td>
                        <td className="pr-2 text-[var(--muted)]">{l.current ?? '—'}</td>
                        <td className={l.changed ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                          {l.draft ?? '—'}
                          <div className="flex gap-1 mt-0.5">
                            {l.tagged && <Pill tone="red">còn nhãn dự thảo</Pill>}
                            {l.aiVerbatim && <Pill tone="blue">giữ nguyên văn AI</Pill>}
                            {!l.changed && l.draft && <Pill>không đổi</Pill>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {can('competency:publish') && (
                  <div className="flex flex-wrap items-start gap-2">
                    <button disabled={busy || !i.readyToPublish} className="btn btn-primary text-xs flex items-center gap-1"
                      onClick={async () => { if (await run('POST', `/competency-versions/${i.versionId}/publish`, undefined, `Đã ban hành ${i.competency.code} v${i.version}`)) after(); }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ban hành</button>
                    <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="Lý do trả lại (bắt buộc khi trả lại)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <button disabled={busy || reason.trim().length < 5} className="btn btn-secondary text-xs flex items-center gap-1"
                      onClick={async () => { if (await run('POST', `/competency-versions/${i.versionId}/reject`, { reason }, `Đã trả lại bản nháp ${i.competency.code}`)) after(); }}>
                      <Undo2 className="w-3.5 h-3.5" /> Trả lại</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
