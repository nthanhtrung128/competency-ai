import React, { useMemo, useState } from 'react';
import { Plus, Play, Lock, Upload, ChevronLeft, Users, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { COMPANY_PORTAL } from '../../api/client';
import {
  useServerData, useAction, uploadFile, Loading, ErrorBox, Empty, Pill, RELATION_VI, CAMPAIGN_STATUS, inputCls,
} from './shared';

type CampaignRow = {
  id: string; code: string; name: string; status: string; participants: number; raters: number; submitted: number;
  competencyCodes: string[]; minRatersForAnonymity: number; startDate: string | null; endDate: string | null;
};
type Detail = {
  id: string; code: string; name: string; status: string; description: string | null; competencyCodes: string[];
  minRatersForAnonymity: number;
  participants: Array<{
    id: string;
    employee: { id: string; employeeCode: string; fullName: string; jobTitle: string | null; orgUnit: { code: string; name: string } | null };
    raters: Array<{ id: string; relation: string; status: string; source: string; rater: { employeeCode: string; fullName: string } | null }>;
  }>;
};

export const Campaigns: React.FC<{ onViewResult: (campaignId: string, employeeId: string) => void }> = ({ onViewResult }) => {
  const { can } = useApp();
  const list = useServerData<{ campaigns: CampaignRow[] }>('/campaigns');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (openId) return <CampaignDetail id={openId} onBack={() => { setOpenId(null); void list.reload(); }} onViewResult={onViewResult} />;
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox text={list.error} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          Chọn năng lực đã ban hành cho từng kỳ. Khi mở thu phiếu, hệ thống chốt nội dung chỉ báo{COMPANY_PORTAL ? ' và yêu cầu chức danh của từng người' : ''}.
        </p>
        {can('assessment:manage') && (
          <button onClick={() => setCreating((v) => !v)} className="btn btn-primary text-xs flex items-center gap-1 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Chiến dịch mới
          </button>
        )}
      </div>
      {creating && <CreateCampaign onDone={(id) => { setCreating(false); void list.reload(); if (id) setOpenId(id); }} />}
      {!list.data?.campaigns.length ? (
        <Empty>Chưa có chiến dịch 360° nào.</Empty>
      ) : (
        <div className="grid gap-2">
          {list.data.campaigns.map((c) => {
            const [label, tone] = CAMPAIGN_STATUS[c.status];
            const pct = c.raters ? Math.round((c.submitted / c.raters) * 100) : 0;
            return (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="app-card text-left hover:border-[var(--brand)] transition space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[var(--ink)]">{c.name} <span className="font-mono text-[var(--muted)]">· {c.code}</span></div>
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  {c.participants} người được đánh giá · {c.competencyCodes.length} năng lực · {c.submitted}/{c.raters} phiếu đã nộp ({pct}%)
                </div>
                <div className="h-1.5 rounded bg-[var(--line)] overflow-hidden"><div className="h-full bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CreateCampaign: React.FC<{ onDone: (id?: string) => void }> = ({ onDone }) => {
  const { run, busy } = useAction();
  const { competencies } = useApp();
  const available = competencies.filter(c => c.scored !== false && c.currentVersionId);
  const [selected, setSelected] = useState<string[]>(() => available.map(c => c.code));
  const year = new Date().getFullYear();
  const [f, setF] = useState({ code: `360-QL-${year}`, name: `Đánh giá 360° cấp quản lý ${year}`, endDate: '', minRaters: 3 });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run<{ id: string }>('POST', '/campaigns', {
      code: f.code, name: f.name, endDate: f.endDate || undefined, minRatersForAnonymity: f.minRaters,
      competencyCodes: selected,
    }, 'Đã tạo chiến dịch');
    if (r) onDone(r.id);
  };
  return (
    <form onSubmit={submit} className="app-card grid sm:grid-cols-2 gap-3 text-xs">
      <label className="space-y-1"><span className="font-semibold">Mã chiến dịch</span>
        <input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required /></label>
      <label className="space-y-1"><span className="font-semibold">Tên</span>
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
      <label className="space-y-1"><span className="font-semibold">Hạn nộp phiếu</span>
        <input type="date" className={inputCls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
      <label className="space-y-1"><span className="font-semibold">Số người tối thiểu để hiện điểm nhóm (ẩn danh)</span>
        <input type="number" min={1} max={10} className={inputCls} value={f.minRaters} onChange={(e) => setF({ ...f, minRaters: Number(e.target.value) })} /></label>
      <fieldset className="sm:col-span-2 space-y-2" disabled={busy}>
        <legend className="font-semibold">Năng lực đánh giá</legend>
        {!available.length && <p>Chưa có năng lực đã ban hành. Hãy hoàn thiện Từ điển năng lực trước.</p>}
        <div className="grid gap-2 sm:grid-cols-2">{available.map(c => <label key={c.code} className="flex items-start gap-2">
          <input type="checkbox" checked={selected.includes(c.code)} onChange={e => setSelected(e.target.checked ? [...selected, c.code] : selected.filter(code => code !== c.code))} />
          <span>{c.code} · {c.name}</span>
        </label>)}</div>
      </fieldset>
      <div className="sm:col-span-2 flex gap-2">
        <button disabled={busy || !selected.length} className="btn btn-primary text-xs">Tạo</button>
        <button type="button" onClick={() => onDone()} className="btn btn-secondary text-xs">Huỷ</button>
      </div>
    </form>
  );
};

const CampaignDetail: React.FC<{ id: string; onBack: () => void; onViewResult: (c: string, e: string) => void }> = ({ id, onBack, onViewResult }) => {
  const { can, orgUnits, setNotice } = useApp();
  const d = useServerData<Detail>(`/campaigns/${id}`);
  const { run, busy } = useAction();
  const [scope, setScope] = useState({ onlyManagers: true, orgUnitCode: '', jobLevels: '' });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const manage = can('assessment:manage');

  const totals = useMemo(() => {
    const r = d.data?.participants.flatMap((p) => p.raters) ?? [];
    return { all: r.length, done: r.filter((x) => x.status === 'SUBMITTED').length };
  }, [d.data]);

  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data) return null;
  const c = d.data;
  const [label, tone] = CAMPAIGN_STATUS[c.status];

  const addParticipants = async () => {
    const r = await run<{ addedParticipants: number; addedRaters: number }>('POST', `/campaigns/${id}/participants`, {
      onlyManagers: scope.onlyManagers,
      orgUnitCodes: scope.orgUnitCode ? [scope.orgUnitCode] : undefined,
      jobLevelCodes: scope.jobLevels ? scope.jobLevels.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
    });
    if (r) {
      setNotice({ kind: 'ok', text: `Đã thêm ${r.addedParticipants} người được đánh giá, ${r.addedRaters} phiếu` });
      void d.reload();
    }
  };
  const doImport = async (commit: boolean) => {
    if (!file) return;
    try {
      const r = await uploadFile<{ ok: boolean; sheets: number; rows: number; errors: string[]; committed: boolean; error?: string }>(
        `/campaigns/${id}/import-responses${commit ? '?commit=1' : ''}`, file);
      if (r.body.error) return setImportMsg(`✖ ${r.body.error}`);
      setImportMsg(r.body.errors.length
        ? `✖ ${r.body.errors.length} lỗi:\n${r.body.errors.slice(0, 15).join('\n')}`
        : r.body.committed ? `✔ Đã ghi ${r.body.sheets} phiếu (${r.body.rows} dòng).` : `✔ Hợp lệ: ${r.body.sheets} phiếu, ${r.body.rows} dòng. Bấm "Ghi thật".`);
      if (r.body.committed) void d.reload();
    } catch (e) {
      setImportMsg(`✖ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-[var(--brand)] font-bold flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Danh sách chiến dịch</button>
      <div className="app-card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--ink)]">{c.name} <span className="font-mono text-xs text-[var(--muted)]">· {c.code}</span></h3>
          <Pill tone={tone}>{label}</Pill>
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          Năng lực: {c.competencyCodes.join(', ')} · Ẩn danh khi nhóm dưới {c.minRatersForAnonymity} người · {totals.done}/{totals.all} phiếu đã nộp
        </div>
        {COMPANY_PORTAL && <p className="text-xs text-[var(--muted)]">Hoàn thiện chức danh và duyệt mức yêu cầu trước khi mở thu phiếu. Người bổ sung sau sẽ được chốt theo bộ yêu cầu tại lúc tham gia. Nếu thiếu yêu cầu, vẫn thu được điểm nhưng không tự lập IDP từ khoảng cách.</p>}
        {manage && (
          <div className="flex flex-wrap gap-2 pt-1">
            {c.status === 'DRAFT' && (
              <button disabled={busy} onClick={async () => { if (await run('POST', `/campaigns/${id}/open`, undefined, 'Đã mở chiến dịch — phiên bản năng lực đã được chốt')) void d.reload(); }}
                className="btn btn-primary text-xs flex items-center gap-1"><Play className="w-3.5 h-3.5" /> Mở thu phiếu</button>
            )}
            {c.status === 'OPEN' && (
              <button disabled={busy} onClick={async () => { if (await run('POST', `/campaigns/${id}/close`, undefined, 'Đã đóng chiến dịch')) void d.reload(); }}
                className="btn btn-secondary text-xs flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Đóng chiến dịch</button>
            )}
          </div>
        )}
      </div>

      {manage && c.status !== 'CLOSED' && (
        <div className="app-card space-y-2 text-xs">
          <div className="font-bold flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Thêm người được đánh giá</div>
          <p className="text-[11px] text-[var(--muted)]">
            Hệ thống tự sinh phiếu theo quan hệ báo cáo trong hồ sơ nhân sự: tự đánh giá, quản lý trực tiếp, cấp dưới trực tiếp, tối đa 4 đồng nghiệp cùng quản lý.
          </p>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={scope.onlyManagers} onChange={(e) => setScope({ ...scope, onlyManagers: e.target.checked })} /> Chỉ người có cấp dưới</label>
            <select className={inputCls} value={scope.orgUnitCode} onChange={(e) => setScope({ ...scope, orgUnitCode: e.target.value })}>
              <option value="">Toàn bộ đơn vị trong phạm vi</option>
              {orgUnits.map((u) => <option key={u.id} value={u.code}>{u.code} · {u.name}</option>)}
            </select>
            <input className={inputCls} placeholder="Cấp (vd L4,L5,L6)" value={scope.jobLevels} onChange={(e) => setScope({ ...scope, jobLevels: e.target.value })} />
          </div>
          <button disabled={busy} onClick={addParticipants} className="btn btn-primary text-xs">Thêm</button>
        </div>
      )}

      {manage && c.status === 'OPEN' && (
        <div className="app-card space-y-2 text-xs">
          <div className="font-bold flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Nhập hộ phiếu (người chưa có tài khoản)</div>
          <p className="text-[11px] text-[var(--muted)]">
            File CSV UTF-8, cột: <code>ma_phieu, ma_nv_duoc_danh_gia, quan_he, ma_nv_nguoi_danh_gia, ma_nang_luc, muc, nhan_xet</code>. Mỗi phiếu nhiều dòng, một dòng một năng lực.
            <code> quan_he</code>: Tự đánh giá / Quản lý / Đồng nghiệp / Cấp dưới. <code>muc</code> để trống = không đủ cơ sở. Phiếu cấp dưới có thể bỏ trống người đánh giá (ẩn danh).
          </p>
          <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setImportMsg(null); }} />
          <div className="flex gap-2">
            <button disabled={!file} onClick={() => doImport(false)} className="btn btn-secondary text-xs">Kiểm tra</button>
            <button disabled={!file || !importMsg?.startsWith('✔ Hợp lệ')} onClick={() => doImport(true)} className="btn btn-primary text-xs">Ghi thật</button>
          </div>
          {importMsg && <pre className="whitespace-pre-wrap text-[11px] p-2 rounded bg-[var(--bg)] border border-[var(--line)]">{importMsg}</pre>}
        </div>
      )}

      {!c.participants.length ? <Empty>Chưa có người được đánh giá.</Empty> : (
        <div className="app-card overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
              <th className="py-1.5 pr-2">Người được đánh giá</th><th className="pr-2">Đơn vị</th><th className="pr-2">Phiếu theo nhóm</th><th className="pr-2">Tiến độ</th><th />
            </tr></thead>
            <tbody>
              {c.participants.map((p) => {
                const done = p.raters.filter((r) => r.status === 'SUBMITTED').length;
                const groups = Object.entries(p.raters.reduce<Record<string, [number, number]>>((acc, r) => {
                  const x = acc[r.relation] ?? [0, 0]; x[1]++; if (r.status === 'SUBMITTED') x[0]++; acc[r.relation] = x; return acc;
                }, {}));
                return (
                  <tr key={p.id} className="border-b border-[var(--line)] align-top">
                    <td className="py-1.5 pr-2"><b>{p.employee.fullName}</b><div className="text-[var(--muted)]">{p.employee.employeeCode} · {p.employee.jobTitle}</div></td>
                    <td className="pr-2">{p.employee.orgUnit?.code}</td>
                    <td className="pr-2">{groups.map(([rel, [d1, t1]]) => <div key={rel}>{RELATION_VI[rel]}: {d1}/{t1}</div>)}</td>
                    <td className="pr-2">{done}/{p.raters.length}</td>
                    <td><button onClick={() => onViewResult(c.id, p.employee.id)} className="text-[var(--brand)] font-bold flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Kết quả</button></td>
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
