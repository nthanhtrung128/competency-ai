import React, { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useServerData, useAction, Loading, ErrorBox, Empty, Pill, fmt, inputCls } from './shared';

type Row = {
  id: string; employeeCode: string; fullName: string; jobTitle: string | null; jobLevelCode: string | null;
  orgUnit: { code: string; name: string } | null;
  review: { performance: number; potential: number; box: number; notes: string | null; calibrated: boolean } | null;
  suggestion: { leadership: number | null; potential: number | null } | null;
};
type Payload = { cycle: string; sourceCampaign: { code: string; name: string } | null; rule: string; employees: Row[] };

// Nhãn ô theo thông lệ 9-Box (box = (tiềm năng-1)*3 + hiệu suất)
const BOX: Record<number, [string, string]> = {
  7: ['Viên ngọc thô', 'bg-amber-100 dark:bg-amber-900/30'], 8: ['Ngôi sao tương lai', 'bg-emerald-100 dark:bg-emerald-900/30'], 9: ['Ngôi sao', 'bg-emerald-200 dark:bg-emerald-800/40'],
  4: ['Cần xem xét', 'bg-rose-50 dark:bg-rose-900/20'], 5: ['Nòng cốt', 'bg-sky-100 dark:bg-sky-900/30'], 6: ['Người đóng góp mạnh', 'bg-emerald-100 dark:bg-emerald-900/30'],
  1: ['Rủi ro', 'bg-rose-100 dark:bg-rose-900/30'], 2: ['Ổn định', 'bg-slate-100 dark:bg-slate-800'], 3: ['Chuyên gia tin cậy', 'bg-sky-100 dark:bg-sky-900/30'],
};
const LV = ['', 'Thấp', 'Trung bình', 'Cao'];

export const NineBox: React.FC = () => {
  const { can } = useApp();
  const [cycle, setCycle] = useState(String(new Date().getFullYear()));
  const d = useServerData<Payload>(`/talent-reviews?cycle=${encodeURIComponent(cycle)}`);
  const { run, busy } = useAction();
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ performance: 2, potential: 2, notes: '' });

  const placed = useMemo(() => {
    const m = new Map<number, Row[]>();
    for (const e of d.data?.employees ?? []) if (e.review) m.set(e.review.box, [...(m.get(e.review.box) ?? []), e]);
    return m;
  }, [d.data]);

  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data) return null;

  const startEdit = (e: Row) => {
    setEdit(e);
    setForm({
      performance: e.review?.performance ?? 2,
      potential: e.review?.potential ?? e.suggestion?.potential ?? 2,
      notes: e.review?.notes ?? '',
    });
  };
  const save = async () => {
    if (!edit) return;
    if (await run('PUT', '/talent-reviews', { cycle, employeeId: edit.id, ...form }, `Đã xếp ${edit.fullName} vào ô ${(form.potential - 1) * 3 + form.performance}`)) {
      setEdit(null);
      void d.reload();
    }
  };
  const uncalibrated = d.data.employees.filter((e) => e.review && !e.review.calibrated).map((e) => e.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold">Chu kỳ</label>
        <input className={`${inputCls} w-24`} value={cycle} onChange={(e) => setCycle(e.target.value)} />
        {can('assessment:manage') && uncalibrated.length > 0 && (
          <button disabled={busy} onClick={async () => { if (await run('POST', '/talent-reviews/calibrate', { cycle, employeeIds: uncalibrated }, 'Đã chốt hiệu chỉnh')) void d.reload(); }}
            className="btn btn-secondary text-xs flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Chốt hiệu chỉnh ({uncalibrated.length})</button>
        )}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        {d.data.rule} {d.data.sourceCampaign ? `Nguồn gợi ý: ${d.data.sourceCampaign.name}.` : 'Chưa có chiến dịch 360° đã đóng — chưa có gợi ý tiềm năng.'}
      </p>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="flex items-center"><span className="text-[10px] font-bold text-[var(--muted)] [writing-mode:vertical-rl] rotate-180">TIỀM NĂNG →</span></div>
        <div className="grid grid-cols-3 gap-1.5">
          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((b) => (
            <div key={b} className={`rounded-lg p-2 min-h-[88px] ${BOX[b][1]}`}>
              <div className="text-[10.5px] font-bold text-[var(--ink)]">{b} · {BOX[b][0]}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(placed.get(b) ?? []).map((e) => (
                  <button key={e.id} onClick={() => startEdit(e)} className="text-[10.5px] px-1.5 py-0.5 rounded bg-white/80 dark:bg-black/30 border border-[var(--line)]">
                    {e.fullName}{e.review?.calibrated ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div />
        <div className="text-center text-[10px] font-bold text-[var(--muted)]">HIỆU SUẤT (theo ĐGNS) →</div>
      </div>

      {edit && (
        <div className="app-card space-y-2 text-xs">
          <div className="font-bold">{edit.fullName} · {edit.employeeCode}</div>
          {edit.suggestion && (
            <div className="text-[11px] text-[var(--muted)]">360° nhóm Lãnh đạo: {fmt(edit.suggestion.leadership)} → gợi ý tiềm năng <b>{LV[edit.suggestion.potential ?? 0] || '—'}</b> (tham khảo)</div>
          )}
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="space-y-1"><span className="font-semibold">Hiệu suất</span>
              <select className={inputCls} value={form.performance} onChange={(e) => setForm({ ...form, performance: Number(e.target.value) })}>
                <option value={1}>1 · Thấp</option><option value={2}>2 · Đạt</option><option value={3}>3 · Cao</option>
              </select></label>
            <label className="space-y-1"><span className="font-semibold">Tiềm năng</span>
              <select className={inputCls} value={form.potential} onChange={(e) => setForm({ ...form, potential: Number(e.target.value) })}>
                <option value={1}>1 · Thấp</option><option value={2}>2 · Trung bình</option><option value={3}>3 · Cao</option>
              </select></label>
          </div>
          <textarea className={inputCls} rows={2} placeholder="Căn cứ / ghi chú hiệu chỉnh" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="btn btn-primary text-xs">Lưu → ô {(form.potential - 1) * 3 + form.performance}</button>
            <button onClick={() => setEdit(null)} className="btn btn-secondary text-xs">Huỷ</button>
          </div>
        </div>
      )}

      {!d.data.employees.length ? <Empty>Không có nhân sự trong phạm vi.</Empty> : (
        <div className="app-card overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
              <th className="py-1.5 pr-2">Nhân sự</th><th className="pr-2">Đơn vị</th><th className="pr-2">Cấp</th><th className="pr-2">Gợi ý tiềm năng</th><th className="pr-2">Ô hiện tại</th><th />
            </tr></thead>
            <tbody>
              {d.data.employees.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)]">
                  <td className="py-1.5 pr-2"><b>{e.fullName}</b> <span className="text-[var(--muted)]">{e.employeeCode}</span></td>
                  <td className="pr-2">{e.orgUnit?.code}</td>
                  <td className="pr-2">{e.jobLevelCode ?? '—'}</td>
                  <td className="pr-2">{e.suggestion?.potential ? LV[e.suggestion.potential] : '—'}</td>
                  <td className="pr-2">{e.review ? <Pill tone={e.review.calibrated ? 'green' : 'amber'}>{e.review.box} · {BOX[e.review.box][0]}{e.review.calibrated ? ' · đã chốt' : ''}</Pill> : '—'}</td>
                  <td><button onClick={() => startEdit(e)} className="text-[var(--brand)] font-bold">{e.review ? 'Sửa' : 'Xếp ô'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
