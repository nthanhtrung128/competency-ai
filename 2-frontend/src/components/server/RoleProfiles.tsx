import { useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiSend } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { ErrorBox, Loading } from './shared';

type Requirement = { competency: string; requiredLevel: number };
type Profile = {
  id: string; code: string; title: string; revision: number; approvedAt: string | null;
  pendingRequirements: Requirement[] | null;
  requirements: { sourceLabel: string; requiredLevel: number; competency: { code: string; name: string } | null }[];
};
type Data = { roles: Profile[]; competencies: { code: string; name: string; currentVersionId: string | null }[] };
const field = 'mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2';
const message = (e: unknown) => e instanceof Error ? e.message : 'Chưa thực hiện được thao tác. Vui lòng thử lại.';

export function RoleProfiles() {
  const { can, refreshFromServer } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    apiGet<Data>('/role-profiles').then(value => { if (current) setData(value); })
      .catch(e => { if (current) setError(message(e)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [refresh]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true); setError(''); setNotice('');
    try {
      const role = await apiSend<Profile>('POST', '/role-profiles', { code, title });
      setSelected(role.code); setCode(''); setTitle('');
      setNotice('Đã tạo chức danh. Hãy thêm yêu cầu năng lực vào bản nháp.');
      setRefresh(n => n + 1);
      void refreshFromServer();
    } catch (e) { setError(message(e)); }
    finally { setCreating(false); }
  }
  const role = data?.roles.find(r => r.code === selected) ?? data?.roles[0];
  return <section className="space-y-4">
    <div className="app-card space-y-3">
      <h1 className="text-xl font-bold">Hồ sơ chức danh</h1>
      <p className="text-sm text-[var(--muted)]">Xác định mức năng lực cần có cho từng chức danh. Bộ yêu cầu đã duyệt được dùng để tính khoảng cách năng lực và gợi ý kế hoạch phát triển.</p>
      <p className="text-sm">Khi nhập nhân sự bằng CSV, điền mã chức danh vào cột <code>job_role_code</code> để liên kết hồ sơ.</p>
      {can('competency:author') && <form onSubmit={create} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <label className="text-sm">Mã chức danh<input className={field} value={code} onChange={e => setCode(e.target.value)} required maxLength={40} pattern="[A-Za-z0-9_-]+" disabled={creating} /></label>
        <label className="text-sm">Tên chức danh<input className={field} value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} disabled={creating} /></label>
        <button type="submit" className="btn btn-primary" disabled={creating || loading}>{creating ? 'Đang tạo…' : 'Tạo chức danh'}</button>
      </form>}
      {error && <ErrorBox text={error} />}
      {notice && <p role="status" className="text-sm text-[var(--brand)]">{notice}</p>}
      {loading && <Loading />}
      {!loading && !data && <button className="btn btn-secondary" onClick={() => setRefresh(n => n + 1)}>Thử tải lại</button>}
    </div>
    {!loading && data && (data.roles.length ? <>
      <label className="block text-sm">Chọn chức danh<select className={field} value={role?.code ?? ''} onChange={e => { setSelected(e.target.value); setNotice(''); }}>
        {data.roles.map(r => <option key={r.code} value={r.code}>{r.code} · {r.title}</option>)}
      </select></label>
      {role && <ProfileEditor key={`${role.id}:${role.revision}`} role={role} competencies={data.competencies}
        canAuthor={can('competency:author')} canApprove={can('competency:publish')}
        reload={() => setRefresh(n => n + 1)} done={text => { setNotice(text); setRefresh(n => n + 1); void refreshFromServer(); }} />}
    </> : <p className="app-card">Chưa có chức danh. Người có quyền soạn thảo có thể tạo hồ sơ đầu tiên.</p>)}
  </section>;
}

function ProfileEditor({ role, competencies, canAuthor, canApprove, reload, done }: {
  role: Profile; competencies: Data['competencies']; canAuthor: boolean; canApprove: boolean;
  reload: () => void; done: (message: string) => void;
}) {
  const initial = role.pendingRequirements ?? role.requirements.map(q => ({ competency: q.competency?.code ?? q.sourceLabel, requiredLevel: q.requiredLevel }));
  const [rows, setRows] = useState<Requirement[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const invalid = rows.some(row => !row.competency) || new Set(rows.map(row => row.competency)).size !== rows.length;
  const unready = rows.some(row => !competencies.find(c => c.code === row.competency)?.currentVersionId);
  async function save(approve: boolean) {
    setBusy(true); setError('');
    try {
      await apiSend(approve ? 'POST' : 'PUT', `/role-profiles/${encodeURIComponent(role.code)}/${approve ? 'approve' : 'draft'}`,
        { revision: role.revision, ...(!approve ? { requirements: rows } : {}) });
      done(approve ? 'Đã duyệt bộ yêu cầu năng lực.' : 'Đã lưu bản nháp. Bộ yêu cầu đang áp dụng vẫn được giữ nguyên.');
    } catch (e) { setError(message(e)); setBusy(false); }
  }
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="app-card space-y-3">
      <h2 className="font-semibold">Bộ yêu cầu đang áp dụng</h2>
      {role.approvedAt && <p className="text-sm text-[var(--muted)]">Duyệt ngày {new Date(role.approvedAt).toLocaleDateString('vi-VN')}</p>}
      {!role.requirements.length ? <p className="text-sm">Chưa có bộ yêu cầu đã duyệt.</p> : <ul className="space-y-2">
        {role.requirements.map(q => <li key={q.sourceLabel} className="flex justify-between gap-3 border-b border-[var(--line)] pb-2 text-sm">
          <span>{q.sourceLabel} · {q.competency?.name ?? 'Năng lực không còn trong từ điển'}</span><b className="shrink-0">Mức {q.requiredLevel}</b>
        </li>)}
      </ul>}
    </section>
    {(canAuthor || canApprove) && <section className="app-card space-y-3">
      <h2 className="font-semibold">Bản nháp yêu cầu năng lực</h2>
      <p className="text-sm text-[var(--muted)]">Lưu bản nháp trước khi duyệt. Chỉ được duyệt khi mọi năng lực đã ban hành. Bộ mới áp dụng cho lần chốt đánh giá tiếp theo; yêu cầu đã chốt trong kỳ cũ được giữ nguyên.</p>
      {!competencies.length && <p className="text-sm">Hãy tạo năng lực trong Từ điển năng lực trước.</p>}
      <fieldset disabled={busy || !canAuthor} className="space-y-3">
        {rows.map((row, i) => <div key={i} className="grid gap-2 rounded-lg border border-[var(--line)] p-3 sm:grid-cols-[minmax(0,1fr)_5rem_auto] sm:items-end">
          <label className="min-w-0 text-sm">Năng lực {i + 1}<select aria-label={`Năng lực ${i + 1}`} className={field} value={row.competency} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, competency: e.target.value } : r))}>
            <option value="">Chọn năng lực</option>
            {row.competency && !competencies.some(c => c.code === row.competency) && <option value={row.competency}>{row.competency} · Không còn sử dụng</option>}
            {competencies.map(c => <option key={c.code} value={c.code} disabled={rows.some((r, n) => n !== i && r.competency === c.code)}>{c.code} · {c.name}{c.currentVersionId ? '' : ' (chưa ban hành)'}</option>)}
          </select></label>
          <label className="text-sm">Mức yêu cầu {i + 1}<select aria-label={`Mức yêu cầu ${i + 1}`} className={field} value={row.requiredLevel} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, requiredLevel: Number(e.target.value) } : r))}>
            {[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level}</option>)}
          </select></label>
          <button type="button" className="btn btn-secondary" aria-label={`Xóa năng lực ${i + 1}`} onClick={() => setRows(rows.filter((_, n) => n !== i))}>Xóa</button>
        </div>)}
        {canAuthor && <button className="btn btn-secondary" disabled={!competencies.length || rows.length >= 40} onClick={() => setRows([...rows, { competency: '', requiredLevel: 1 }])}>Thêm năng lực</button>}
      </fieldset>
      {dirty && <p role="status" className="text-sm">Có thay đổi chưa lưu.</p>}
      {unready && <p className="text-sm">Có năng lực chưa ban hành hoặc không còn sử dụng. Bạn có thể lưu bản nháp để hoàn thiện sau.</p>}
      {error && <ErrorBox text={error} />}
      <div className="flex flex-wrap gap-2">
        {canAuthor && <button className="btn btn-secondary" disabled={busy || invalid || (!dirty && role.pendingRequirements !== null)} onClick={() => save(false)}>Lưu bản nháp</button>}
        {canApprove && <button className="btn btn-primary" disabled={busy || dirty || invalid || unready || !rows.length || role.pendingRequirements === null} onClick={() => save(true)}>Duyệt bộ yêu cầu</button>}
        <button className="btn btn-secondary" disabled={busy} onClick={reload}>{dirty ? 'Bỏ thay đổi và tải lại' : 'Tải lại hồ sơ'}</button>
      </div>
    </section>}
  </div>;
}
