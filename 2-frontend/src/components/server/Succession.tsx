import React, { useState } from 'react';
import { Plus, Sparkles, Trash2, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { useServerData, useAction, Loading, ErrorBox, Empty, Pill, inputCls, fmt, IDP_STATUS } from './shared';

type Talent = { box: number | null; boxCycle: string | null; calibrated: boolean; leadership: number | null; idpStatus: string | null; idpProgress: number | null };
type Emp = { id: string; employeeCode: string; fullName: string; jobTitle: string | null; jobLevelCode: string | null };
type Cand = { id: string; readiness: string; riskOfLoss: string; notes: string | null; employee: Emp; talent: Talent | null };
type Plan = {
  id: string; positionTitle: string; criticality: string; vacancyRisk: string | null; notes: string | null; jobRoleCode: string | null;
  orgUnit: { code: string; name: string } | null; incumbent: Emp | null; candidates: Cand[];
  coverage: { readyNow: number; ready12: number; total: number };
};
type Payload = { items: Plan[]; metrics: { plans: number; withReadyNow: number; withoutCandidate: number; criticalUncovered: number; benchStrength: number }; rule: string };

const CRIT: Record<string, [string, 'red' | 'amber' | 'gray']> = { CRITICAL: ['Trọng yếu', 'red'], HIGH: ['Cao', 'amber'], MEDIUM: ['Trung bình', 'gray'] };
const READY: Record<string, [string, 'green' | 'blue' | 'gray']> = { READY_NOW: ['Sẵn sàng ngay', 'green'], READY_1_2Y: ['1–2 năm', 'blue'], READY_3Y: ['≥ 3 năm', 'gray'] };
const RISK: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao' };
const BOX: Record<number, string> = { 9: 'Ngôi sao', 8: 'Ngôi sao tương lai', 6: 'Đóng góp mạnh', 7: 'Viên ngọc thô', 5: 'Nòng cốt', 3: 'Chuyên gia tin cậy', 4: 'Cần xem xét', 2: 'Ổn định', 1: 'Rủi ro' };

const TalentLine: React.FC<{ t: Talent | null }> = ({ t }) => !t ? null : (
  <span className="text-[10.5px] text-[var(--muted)]">
    9-Box {t.box ? `ô ${t.box} · ${BOX[t.box]}${t.calibrated ? ' ✓' : ''}` : '—'} · 360° Lãnh đạo {fmt(t.leadership)}
    · IDP {t.idpStatus ? `${IDP_STATUS[t.idpStatus][0]} ${t.idpProgress ?? 0}%` : '—'}
  </span>
);

/** Kế hoạch kế thừa (QĐ-21): vị trí then chốt → ứng viên → mức sẵn sàng; liên thông 9-Box, 360°, IDP */
export const Succession: React.FC = () => {
  const { can, orgUnits, jobRoles } = useApp();
  const d = useServerData<Payload>('/succession');
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ positionTitle: '', orgUnitCode: '', jobRoleCode: '', incumbentEmployeeCode: '', criticality: 'HIGH', vacancyRisk: '' });

  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data) return null;
  const m = d.data.metrics;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run('POST', '/succession', {
      positionTitle: form.positionTitle, orgUnitCode: form.orgUnitCode || null, jobRoleCode: form.jobRoleCode || null,
      incumbentEmployeeCode: form.incumbentEmployeeCode || null, criticality: form.criticality, vacancyRisk: form.vacancyRisk || null,
    }, 'Đã thêm vị trí then chốt');
    if (r) { setCreating(false); setForm({ ...form, positionTitle: '', incumbentEmployeeCode: '' }); void d.reload(); }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="app-card"><div className="text-[11px] text-[var(--muted)]">Vị trí then chốt</div><div className="text-2xl font-extrabold">{m.plans}</div></div>
        <div className="app-card"><div className="text-[11px] text-[var(--muted)]">Bench strength</div><div className="text-2xl font-extrabold">{m.benchStrength}%</div><div className="text-[10.5px] text-[var(--muted)]">vị trí có người sẵn sàng ≤ 2 năm</div></div>
        <div className="app-card"><div className="text-[11px] text-[var(--muted)]">Chưa có ứng viên</div><div className="text-2xl font-extrabold">{m.withoutCandidate}</div></div>
        <div className="app-card"><div className="text-[11px] text-[var(--muted)]">Trọng yếu chưa có người thay ngay</div>
          <div className="text-2xl font-extrabold flex items-center gap-1">{m.criticalUncovered}{m.criticalUncovered > 0 && <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />}</div></div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--muted)]">{d.data.rule}</p>
        {can('talent:review') && <button onClick={() => setCreating((v) => !v)} className="btn btn-primary text-xs flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Vị trí then chốt</button>}
      </div>
      {creating && (
        <form onSubmit={create} className="app-card grid sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder="Tên vị trí (vd Trưởng Ban Đầu tư)" value={form.positionTitle} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })} required />
          <select className={inputCls} value={form.orgUnitCode} onChange={(e) => setForm({ ...form, orgUnitCode: e.target.value })}>
            <option value="">Đơn vị</option>{orgUnits.map((u) => <option key={u.id} value={u.code}>{u.code} · {u.name}</option>)}
          </select>
          <select className={inputCls} value={form.jobRoleCode} onChange={(e) => setForm({ ...form, jobRoleCode: e.target.value })}>
            <option value="">Vai trò (Job Role)</option>{jobRoles.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.titleVi}</option>)}
          </select>
          <input className={inputCls} placeholder="Mã NV người đang giữ vị trí" value={form.incumbentEmployeeCode} onChange={(e) => setForm({ ...form, incumbentEmployeeCode: e.target.value })} />
          <select className={inputCls} value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
            <option value="CRITICAL">Mức trọng yếu: Trọng yếu</option><option value="HIGH">Mức trọng yếu: Cao</option><option value="MEDIUM">Mức trọng yếu: Trung bình</option>
          </select>
          <select className={inputCls} value={form.vacancyRisk} onChange={(e) => setForm({ ...form, vacancyRisk: e.target.value })}>
            <option value="">Rủi ro trống vị trí 12 tháng</option><option value="LOW">Thấp</option><option value="MEDIUM">Trung bình</option><option value="HIGH">Cao</option>
          </select>
          <div className="sm:col-span-3 flex gap-2"><button disabled={busy} className="btn btn-primary text-xs">Thêm</button><button type="button" onClick={() => setCreating(false)} className="btn btn-secondary text-xs">Huỷ</button></div>
        </form>
      )}
      {!d.data.items.length ? <Empty>Chưa có vị trí then chốt nào.</Empty> : d.data.items.map((p) => <PlanCard key={p.id} p={p} onChanged={d.reload} />)}
    </div>
  );
};

const PlanCard: React.FC<{ p: Plan; onChanged: () => void }> = ({ p, onChanged }) => {
  const { can, setNotice } = useApp();
  const { run, busy } = useAction();
  const [sugg, setSugg] = useState<Array<{ employee: Emp; talent: Talent }> | null>(null);
  const [add, setAdd] = useState({ employeeCode: '', readiness: 'READY_1_2Y', riskOfLoss: 'MEDIUM' });
  const [crit, tone] = CRIT[p.criticality] ?? [p.criticality, 'gray'];
  const edit = can('talent:review');
  const addCand = async (body: Record<string, string>) => { if (await run('POST', `/succession/${p.id}/candidates`, body, 'Đã thêm ứng viên')) { setSugg(null); onChanged(); } };

  return (
    <div className="app-card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="text-sm text-[var(--ink)]">{p.positionTitle}</b>
          <span className="text-[var(--muted)]"> · {p.orgUnit?.name ?? '—'}{p.jobRoleCode ? ` · ${p.jobRoleCode}` : ''}</span>
          <div className="text-[11px] text-[var(--muted)]">Đang giữ: {p.incumbent ? `${p.incumbent.fullName} (${p.incumbent.employeeCode})` : 'trống / chưa ghi'}{p.vacancyRisk ? ` · rủi ro trống vị trí ${RISK[p.vacancyRisk]}` : ''}</div>
        </div>
        <div className="flex gap-1">
          <Pill tone={tone}>{crit}</Pill>
          {p.coverage.readyNow > 0 ? <Pill tone="green">{p.coverage.readyNow} sẵn sàng ngay</Pill> : <Pill tone="amber">chưa có người thay ngay</Pill>}
        </div>
      </div>
      {p.candidates.length > 0 && (
        <table className="w-full text-[11.5px]">
          <tbody>
            {p.candidates.map((c) => {
              const [rl, rt] = READY[c.readiness] ?? [c.readiness, 'gray'];
              return (
                <tr key={c.id} className="border-t border-[var(--line)] align-top">
                  <td className="py-1.5 pr-2"><b>{c.employee.fullName}</b> <span className="text-[var(--muted)]">{c.employee.employeeCode} · {c.employee.jobTitle}</span><div><TalentLine t={c.talent} /></div></td>
                  <td className="pr-2">
                    {edit ? (
                      <select className={`${inputCls} w-36`} value={c.readiness} onChange={async (e) => { if (await run('PATCH', `/succession-candidates/${c.id}`, { readiness: e.target.value }, 'Đã cập nhật mức sẵn sàng')) onChanged(); }}>
                        <option value="READY_NOW">Sẵn sàng ngay</option><option value="READY_1_2Y">1–2 năm</option><option value="READY_3Y">≥ 3 năm</option>
                      </select>
                    ) : <Pill tone={rt}>{rl}</Pill>}
                  </td>
                  <td className="pr-2">
                    {edit ? (
                      <select className={`${inputCls} w-36`} value={c.riskOfLoss} onChange={async (e) => { if (await run('PATCH', `/succession-candidates/${c.id}`, { riskOfLoss: e.target.value }, 'Đã cập nhật rủi ro')) onChanged(); }}>
                        <option value="LOW">Rủi ro mất: Thấp</option><option value="MEDIUM">Rủi ro mất: Trung bình</option><option value="HIGH">Rủi ro mất: Cao</option>
                      </select>
                    ) : `Rủi ro mất: ${RISK[c.riskOfLoss]}`}
                  </td>
                  <td>{edit && <button disabled={busy} title="Bỏ ứng viên" onClick={async () => { if (await run('DELETE', `/succession-candidates/${c.id}`, undefined, 'Đã bỏ ứng viên')) onChanged(); }}><Trash2 className="w-3.5 h-3.5 text-[var(--muted)]" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {edit && (
        <div className="flex flex-wrap gap-2 pt-1">
          <input className={`${inputCls} w-40`} placeholder="Mã NV ứng viên" value={add.employeeCode} onChange={(e) => setAdd({ ...add, employeeCode: e.target.value })} />
          <select className={`${inputCls} w-36`} value={add.readiness} onChange={(e) => setAdd({ ...add, readiness: e.target.value })}>
            <option value="READY_NOW">Sẵn sàng ngay</option><option value="READY_1_2Y">1–2 năm</option><option value="READY_3Y">≥ 3 năm</option>
          </select>
          <button disabled={busy || !add.employeeCode} className="btn btn-secondary text-xs" onClick={() => addCand({ employeeCode: add.employeeCode, readiness: add.readiness, riskOfLoss: add.riskOfLoss })}>Thêm ứng viên</button>
          <button disabled={busy} className="btn btn-secondary text-xs flex items-center gap-1" onClick={async () => {
            try {
              setSugg((await api<{ items: Array<{ employee: Emp; talent: Talent }> }>(`/succession/${p.id}/suggestions`)).items);
            } catch (e) {
              setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
            }
          }}><Sparkles className="w-3.5 h-3.5" /> Gợi ý từ 9-Box</button>
        </div>
      )}
      {sugg && (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-2 space-y-1">
          {!sugg.length ? <div className="text-[var(--muted)]">Không có ai ở ô 9, 8, 6 trong phạm vi — cần xếp ô 9-Box trước.</div> : sugg.map((s) => (
            <div key={s.employee.id} className="flex items-center justify-between gap-2">
              <span><b>{s.employee.fullName}</b> <span className="text-[var(--muted)]">{s.employee.employeeCode}</span> · <TalentLine t={s.talent} /></span>
              <button disabled={busy} className="text-[var(--brand)] font-bold" onClick={() => addCand({ employeeId: s.employee.id, readiness: 'READY_1_2Y' })}>Thêm</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
