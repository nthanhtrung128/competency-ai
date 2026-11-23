import React, { useState } from 'react';
import { UserPlus, Users, KeyRound, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useServerData, useAction, Loading, ErrorBox, Pill, inputCls, downloadCsv } from './shared';

type User = {
  id: string; email: string; name: string; status: string; mustChangePassword: boolean; roles: string[];
  scopes: Array<{ orgUnit: string; name: string }>; employee: { employeeCode: string; fullName: string } | null;
};
type Created = { employeeCode?: string; fullName?: string; email: string; temporaryPassword: string };

const ROLE_VI: Record<string, string> = { ADMIN: 'Quản trị hệ thống', HR_LEAD: 'Trưởng Ban NS', HRBP: 'HRBP', LINE_MANAGER: 'Quản lý', EMPLOYEE: 'Nhân viên' };

/** QĐ-07: cấp tài khoản cho HR và quản lý; mật khẩu tạm hiện MỘT lần */
export const Accounts: React.FC = () => {
  const { orgUnits, server } = useApp();
  const list = useServerData<{ users: User[] }>('/users');
  const { run, busy } = useAction();
  const [form, setForm] = useState({ email: '', name: '', role: 'HRBP', employeeCode: '', scopeOrgUnitCode: '' });
  const [preview, setPreview] = useState<{ willCreate: Array<{ employeeCode: string; fullName: string; email: string; orgUnit: string | null; reports: number }>; noEmail: Array<{ employeeCode: string; fullName: string }> } | null>(null);
  const [secrets, setSecrets] = useState<Created[]>([]);

  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBox text={list.error} />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run<Created & { role: string }>('POST', '/users', {
      email: form.email, name: form.name, role: form.role,
      employeeCode: form.employeeCode || undefined, scopeOrgUnitCode: form.scopeOrgUnitCode || undefined,
    }, 'Đã cấp tài khoản');
    if (r) { setSecrets([r]); setForm({ ...form, email: '', name: '', employeeCode: '' }); void list.reload(); }
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-[var(--muted)]">
        Giai đoạn thí điểm (QĐ-07) chỉ cấp tài khoản cho HR và quản lý. Người nhận đăng nhập bằng mật khẩu tạm và <b>bắt buộc đổi mật khẩu</b> ở lần đầu.
        Mật khẩu tạm chỉ hiện một lần: hãy gửi riêng cho từng người, không gửi chung nhóm.
      </p>

      {secrets.length > 0 && (
        <div className="app-card border-amber-300 space-y-2">
          <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300"><KeyRound className="w-3.5 h-3.5" /> Mật khẩu tạm — chỉ hiện lần này</div>
          <table className="w-full text-[11.5px]"><tbody>
            {secrets.map((s) => <tr key={s.email} className="border-b border-[var(--line)]"><td className="py-1 pr-2">{s.fullName ?? ''}</td><td className="pr-2">{s.email}</td><td className="font-mono">{s.temporaryPassword}</td></tr>)}
          </tbody></table>
          <div className="flex gap-2">
            <button onClick={() => downloadCsv('mat_khau_tam.csv', secrets.map((s) => ({ ho_ten: s.fullName ?? '', email: s.email, mat_khau_tam: s.temporaryPassword })))}
              className="btn btn-secondary text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Tải CSV</button>
            <button onClick={() => setSecrets([])} className="btn btn-secondary text-xs">Đã lưu — ẩn đi</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        <form onSubmit={create} className="app-card space-y-2">
          <div className="font-bold flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Cấp một tài khoản</div>
          <input className={inputCls} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputCls} placeholder="Họ tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {['HR_LEAD', 'HRBP', 'LINE_MANAGER', ...(server.user?.roles.includes('ADMIN') ? ['ADMIN'] : [])].map((r) => <option key={r} value={r}>{ROLE_VI[r]}</option>)}
          </select>
          <input className={inputCls} placeholder="Mã nhân sự để gắn hồ sơ (cần để chấm phiếu 360°)" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
          <select className={inputCls} value={form.scopeOrgUnitCode} onChange={(e) => setForm({ ...form, scopeOrgUnitCode: e.target.value })}>
            <option value="">Phạm vi dữ liệu: (không giới hạn đơn vị / theo cấp dưới)</option>
            {orgUnits.map((u) => <option key={u.id} value={u.code}>{u.code} · {u.name}</option>)}
          </select>
          <button disabled={busy} className="btn btn-primary text-xs">Cấp tài khoản</button>
        </form>

        <div className="app-card space-y-2">
          <div className="font-bold flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Cấp hàng loạt cho quản lý</div>
          <p className="text-[11px] text-[var(--muted)]">Chọn nhân sự đang làm việc, có cấp dưới hoặc là trưởng đơn vị, có email và chưa có tài khoản. Phạm vi dữ liệu = đơn vị của họ (gồm đơn vị con).</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={async () => setPreview(await run('POST', '/users/provision-managers', {}))} className="btn btn-secondary text-xs">Xem trước</button>
            <button disabled={busy || !preview?.willCreate.length} onClick={async () => {
              const r = await run<{ created: Created[] }>('POST', '/users/provision-managers', { commit: true }, 'Đã cấp tài khoản quản lý');
              if (r) { setSecrets(r.created); setPreview(null); void list.reload(); }
            }} className="btn btn-primary text-xs">Cấp {preview?.willCreate.length ?? ''} tài khoản</button>
          </div>
          {preview && (
            <div className="text-[11px] space-y-1">
              <div>Sẽ cấp: {preview.willCreate.map((w) => `${w.fullName} (${w.email})`).join(', ') || 'không có'}</div>
              {preview.noEmail.length > 0 && <div className="text-amber-700 dark:text-amber-300">Thiếu email, chưa cấp được: {preview.noEmail.map((n) => n.fullName).join(', ')}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="app-card overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
            <th className="py-1.5 pr-2">Tài khoản</th><th className="pr-2">Vai trò</th><th className="pr-2">Hồ sơ nhân sự</th><th className="pr-2">Phạm vi</th><th className="pr-2">Trạng thái</th><th />
          </tr></thead>
          <tbody>
            {list.data?.users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)]">
                <td className="py-1.5 pr-2"><b>{u.name}</b><div className="text-[var(--muted)]">{u.email}</div></td>
                <td className="pr-2">{u.roles.map((r) => ROLE_VI[r] ?? r).join(', ')}</td>
                <td className="pr-2">{u.employee ? `${u.employee.employeeCode}` : '—'}</td>
                <td className="pr-2">{u.scopes.map((s) => s.orgUnit).join(', ') || '—'}</td>
                <td className="pr-2">
                  <Pill tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khoá'}</Pill>
                  {u.mustChangePassword && <> <Pill tone="amber">chờ đổi MK</Pill></>}
                </td>
                <td className="whitespace-nowrap">
                  <button disabled={busy} className="text-[var(--brand)] font-bold mr-2" onClick={async () => {
                    const r = await run<{ email: string; temporaryPassword: string }>('POST', `/users/${u.id}/reset-password`, undefined, 'Đã đặt lại mật khẩu');
                    if (r) { setSecrets([{ email: r.email, fullName: u.name, temporaryPassword: r.temporaryPassword }]); void list.reload(); }
                  }}>Đặt lại MK</button>
                  <button disabled={busy} className="text-rose-600 font-bold" onClick={async () => {
                    if (await run('PATCH', `/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, u.status === 'ACTIVE' ? 'Đã khoá' : 'Đã mở khoá')) void list.reload();
                  }}>{u.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
