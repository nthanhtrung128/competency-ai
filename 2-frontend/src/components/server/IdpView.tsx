import React, { useState } from 'react';
import { Plus, Send, CheckCircle2, ChevronLeft, MessageSquare, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useServerData, useAction, Loading, ErrorBox, Empty, Pill, IDP_STATUS, fmt, inputCls } from './shared';

type Action = { id: string; type: 'EXPERIENCE_70' | 'EXPOSURE_20' | 'EDUCATION_10'; title: string; dueDate: string | null; status: string; evidence: string | null };
type Plan = {
  id: string; cycle: string; status: string; targetRoleCode: string | null; notes: string | null; approvedByEmail: string | null;
  employee: { id: string; employeeCode: string; fullName: string; jobTitle: string | null; managerId: string | null };
  goals: Array<{ id: string; currentLevel: number | null; targetLevel: number; source: string; competency: { code: string; name: string }; actions: Action[] }>;
  checkIns: Array<{ id: string; authorEmail: string; content: string; createdAt: string }>;
  warnings: string[]; progress: number;
};
const TYPE: Record<Action['type'], [string, string]> = {
  EXPERIENCE_70: ['70 · Học qua công việc', 'Giao dự án, nhiệm vụ mở rộng, luân chuyển'],
  EXPOSURE_20: ['20 · Học qua người khác', 'Kèm cặp, shadowing, phản hồi'],
  EDUCATION_10: ['10 · Học chính quy', 'Khoá học, chứng chỉ, đọc tài liệu'],
};

export const IdpView: React.FC = () => {
  const { can } = useApp();
  const list = useServerData<{ plans: Plan[] }>('/idp');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (openId) return <PlanDetail id={openId} onBack={() => { setOpenId(null); void list.reload(); }} />;
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox text={list.error} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          IDP lập từ khoảng cách 360°: tối đa 3 năng lực dưới mức yêu cầu của vai trò (chưa có vai trò thì lấy mức 3). Mỗi mục tiêu cần ít nhất một hành động học qua công việc (70).
        </p>
        {can('idp:manage') && (
          <button onClick={() => setCreating((v) => !v)} className="btn btn-primary text-xs flex items-center gap-1 shrink-0"><Sparkles className="w-3.5 h-3.5" /> Lập IDP từ 360°</button>
        )}
      </div>
      {creating && <CreateFromAssessment onDone={(id) => { setCreating(false); void list.reload(); if (id) setOpenId(id); }} />}
      {!list.data?.plans.length ? <Empty>Chưa có IDP nào trong phạm vi của bạn.</Empty> : (
        <div className="grid gap-2">
          {list.data.plans.map((p) => {
            const [label, tone] = IDP_STATUS[p.status];
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="app-card text-left hover:border-[var(--brand)] transition space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[var(--ink)]">{p.employee.fullName} <span className="text-[var(--muted)] font-normal">· {p.employee.employeeCode} · chu kỳ {p.cycle}</span></div>
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div className="text-[11px] text-[var(--muted)]">{p.goals.map((g) => g.competency.code).join(', ') || 'chưa có mục tiêu'} · tiến độ {p.progress}%</div>
                {p.warnings.length > 0 && <div className="text-[10.5px] text-amber-700 dark:text-amber-300">⚠ {p.warnings[0]}{p.warnings.length > 1 ? ` (+${p.warnings.length - 1})` : ''}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CreateFromAssessment: React.FC<{ onDone: (id?: string) => void }> = ({ onDone }) => {
  const camps = useServerData<{ campaigns: Array<{ id: string; name: string; status: string }> }>('/campaigns');
  const closed = camps.data?.campaigns.filter((c) => c.status === 'CLOSED') ?? [];
  const [campaignId, setCampaignId] = useState('');
  const cid = campaignId || closed[0]?.id || '';
  const people = useServerData<{ participants: Array<{ employee: { id: string; employeeCode: string; fullName: string }; gaps: number }> }>(cid ? `/campaigns/${cid}/summary` : null);
  const [employeeId, setEmployeeId] = useState('');
  const [cycle, setCycle] = useState(String(new Date().getFullYear()));
  const { run, busy } = useAction();
  if (camps.loading && !camps.data) return <Loading />;
  if (!closed.length) return <Empty>Cần một chiến dịch 360° đã đóng để lập IDP từ kết quả.</Empty>;
  const submit = async () => {
    const r = await run<{ id: string }>('POST', '/idp/from-assessment', { campaignId: cid, employeeId, cycle }, 'Đã lập IDP nháp từ kết quả 360°');
    if (r) onDone(r.id);
  };
  return (
    <div className="app-card grid sm:grid-cols-4 gap-2 text-xs items-end">
      <label className="space-y-1"><span className="font-semibold">Chiến dịch</span>
        <select className={inputCls} value={cid} onChange={(e) => { setCampaignId(e.target.value); setEmployeeId(''); }}>
          {closed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <label className="space-y-1"><span className="font-semibold">Nhân sự</span>
        <select className={inputCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— chọn —</option>
          {people.data?.participants.map((p) => <option key={p.employee.id} value={p.employee.id}>{p.employee.fullName} ({p.gaps} khoảng cách)</option>)}
        </select></label>
      <label className="space-y-1"><span className="font-semibold">Chu kỳ</span><input className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value)} /></label>
      <div className="flex gap-2">
        <button disabled={busy || !employeeId} onClick={submit} className="btn btn-primary text-xs">Lập IDP</button>
        <button onClick={() => onDone()} className="btn btn-secondary text-xs">Huỷ</button>
      </div>
    </div>
  );
};

const PlanDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const { can, server, competencies } = useApp();
  const p = useServerData<Plan>(`/idp/${id}`);
  const [goal, setGoal] = useState({ code: '', target: 3 });
  const { run, busy } = useAction();
  const [newAction, setNewAction] = useState<Record<string, { type: Action['type']; title: string; dueDate: string }>>({});
  const [note, setNote] = useState('');
  if (p.loading && !p.data) return <Loading />;
  if (p.error) return <ErrorBox text={p.error} />;
  if (!p.data) return null;
  const plan = p.data;
  const [label, tone] = IDP_STATUS[plan.status];
  const editable = !['COMPLETED', 'CANCELLED'].includes(plan.status);
  const isOwner = server.user?.employeeId === plan.employee.id;
  const act = async (method: 'POST' | 'PATCH', path: string, body: unknown, ok: string) => { if (await run(method, path, body, ok)) void p.reload(); };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-[var(--brand)] font-bold flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Danh sách IDP</button>
      <div className="app-card space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--ink)]">IDP {plan.cycle} — {plan.employee.fullName} <span className="text-xs text-[var(--muted)]">· {plan.employee.jobTitle} · vai trò {plan.targetRoleCode ?? '—'}</span></h3>
          <Pill tone={tone}>{label}</Pill>
        </div>
        <div className="h-1.5 rounded bg-[var(--line)] overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${plan.progress}%` }} /></div>
        <div className="text-[11px] text-[var(--muted)]">Tiến độ {plan.progress}%{plan.approvedByEmail ? ` · duyệt bởi ${plan.approvedByEmail}` : ''}{plan.notes ? ` · ${plan.notes}` : ''}</div>
        {plan.warnings.map((w) => <div key={w} className="text-[11px] text-amber-700 dark:text-amber-300">⚠ {w}</div>)}
        <div className="flex flex-wrap gap-2 pt-1">
          {plan.status === 'DRAFT' && (isOwner || can('idp:manage')) && (
            <button disabled={busy} onClick={() => act('POST', `/idp/${id}/submit`, undefined, 'Đã gửi duyệt')} className="btn btn-primary text-xs flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Gửi duyệt</button>
          )}
          {plan.status === 'SUBMITTED' && can('idp:approve') && !isOwner && (
            <button disabled={busy} onClick={() => act('POST', `/idp/${id}/approve`, undefined, 'Đã phê duyệt IDP')} className="btn btn-primary text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Phê duyệt</button>
          )}
          {plan.status === 'APPROVED' && can('idp:manage') && (
            <button disabled={busy} onClick={() => act('POST', `/idp/${id}/status`, { status: 'IN_PROGRESS' }, 'Bắt đầu thực hiện')} className="btn btn-secondary text-xs">Bắt đầu thực hiện</button>
          )}
          {plan.status === 'IN_PROGRESS' && can('idp:manage') && (
            <button disabled={busy} onClick={() => act('POST', `/idp/${id}/status`, { status: 'COMPLETED' }, 'Đã hoàn thành IDP')} className="btn btn-secondary text-xs">Đánh dấu hoàn thành</button>
          )}
        </div>
      </div>

      {plan.goals.map((g) => {
        const na = newAction[g.id] ?? { type: 'EXPERIENCE_70' as const, title: '', dueDate: '' };
        return (
          <div key={g.id} className="app-card space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold text-[var(--brand)]">{g.competency.code}</span>
              <b className="text-[var(--ink)]">{g.competency.name}</b>
              <Pill tone="blue">hiện tại {fmt(g.currentLevel)} → mục tiêu {g.targetLevel}</Pill>
              {g.source === 'GAP_360' && <Pill>từ 360°</Pill>}
            </div>
            {(['EXPERIENCE_70', 'EXPOSURE_20', 'EDUCATION_10'] as const).map((t) => {
              const items = g.actions.filter((a) => a.type === t);
              return (
                <div key={t} className="text-[11.5px]">
                  <div className="font-semibold text-[var(--muted)]">{TYPE[t][0]}</div>
                  {!items.length && <div className="text-[var(--muted)] italic">— chưa có —</div>}
                  {items.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 py-0.5">
                      <input type="checkbox" disabled={!editable || busy} checked={a.status === 'DONE'}
                        onChange={(e) => act('PATCH', `/idp-actions/${a.id}`, { status: e.target.checked ? 'DONE' : 'IN_PROGRESS' }, e.target.checked ? 'Đã đánh dấu hoàn thành' : 'Đã mở lại')} />
                      <span className={a.status === 'DONE' ? 'line-through text-[var(--muted)]' : ''}>{a.title}</span>
                      {a.dueDate && <span className="text-[var(--muted)]">· hạn {new Date(a.dueDate).toLocaleDateString('vi-VN')}</span>}
                    </label>
                  ))}
                </div>
              );
            })}
            {editable && (
              <div className="grid sm:grid-cols-[180px_1fr_140px_auto] gap-2 pt-1">
                <select className={inputCls} value={na.type} onChange={(e) => setNewAction({ ...newAction, [g.id]: { ...na, type: e.target.value as Action['type'] } })}>
                  {(Object.keys(TYPE) as Action['type'][]).map((t) => <option key={t} value={t}>{TYPE[t][0]}</option>)}
                </select>
                <input className={inputCls} placeholder={TYPE[na.type][1]} value={na.title} onChange={(e) => setNewAction({ ...newAction, [g.id]: { ...na, title: e.target.value } })} />
                <input type="date" className={inputCls} value={na.dueDate} onChange={(e) => setNewAction({ ...newAction, [g.id]: { ...na, dueDate: e.target.value } })} />
                <button disabled={busy || na.title.trim().length < 5} className="btn btn-secondary text-xs flex items-center gap-1"
                  onClick={async () => {
                    if (await run('POST', `/idp-goals/${g.id}/actions`, { type: na.type, title: na.title, dueDate: na.dueDate || undefined }, 'Đã thêm hành động')) {
                      setNewAction({ ...newAction, [g.id]: { type: na.type, title: '', dueDate: '' } });
                      void p.reload();
                    }
                  }}><Plus className="w-3.5 h-3.5" /> Thêm</button>
              </div>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="app-card grid sm:grid-cols-[1fr_140px_auto] gap-2 text-xs items-end">
          <label className="space-y-1"><span className="font-semibold">Thêm mục tiêu năng lực (tối đa 3 mỗi chu kỳ)</span>
            <select className={inputCls} value={goal.code} onChange={(e) => setGoal({ ...goal, code: e.target.value })}>
              <option value="">— chọn năng lực —</option>
              {competencies.filter((c) => c.scored !== false && c.currentVersionId && !plan.goals.some((g) => g.competency.code === c.code))
                .map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select></label>
          <label className="space-y-1"><span className="font-semibold">Mức mục tiêu</span>
            <select className={inputCls} value={goal.target} onChange={(e) => setGoal({ ...goal, target: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Mức {l}</option>)}
            </select></label>
          <button disabled={busy || !goal.code} className="btn btn-secondary text-xs"
            onClick={async () => { if (await run('POST', `/idp/${id}/goals`, { competencyCode: goal.code, targetLevel: goal.target }, 'Đã thêm mục tiêu')) { setGoal({ code: '', target: 3 }); void p.reload(); } }}>
            <Plus className="w-3.5 h-3.5" /> Thêm</button>
        </div>
      )}

      <div className="app-card space-y-2 text-xs">
        <div className="font-bold flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Trao đổi định kỳ</div>
        {plan.checkIns.map((c) => (
          <div key={c.id} className="p-2 rounded bg-[var(--bg)] border border-[var(--line)]">
            <div className="text-[10.5px] text-[var(--muted)]">{c.authorEmail} · {new Date(c.createdAt).toLocaleString('vi-VN')}</div>
            <div>{c.content}</div>
          </div>
        ))}
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Ghi nhận tiến độ, phản hồi…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button disabled={busy || note.trim().length < 3} className="btn btn-secondary text-xs"
            onClick={async () => { if (await run('POST', `/idp/${id}/check-ins`, { content: note }, 'Đã ghi trao đổi')) { setNote(''); void p.reload(); } }}>Gửi</button>
        </div>
      </div>
    </div>
  );
};
