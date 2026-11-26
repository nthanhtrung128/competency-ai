import React, { useState } from 'react';
import { Server, PlugZap, LogOut, RefreshCw, X, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COMPANY_PORTAL, lastApiUrl } from '../api/client';

/** Nút trên thanh tiêu đề: cho biết đang dùng dữ liệu DEMO hay MÁY CHỦ, mở hộp thoại kết nối. */
export const ServerConnectButton: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { dataSource, server } = useApp();
  const busy = server.status === 'waking' || server.status === 'loading';
  const isServer = dataSource === 'SERVER';
  return (
    <button
      id="server-connect-btn"
      onClick={onOpen}
      title={isServer ? `Máy chủ: ${server.apiUrl}` : 'Đang dùng dữ liệu minh họa lưu trong trình duyệt'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        isServer
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
      <span className="hidden md:inline">{isServer ? `Máy chủ · ${server.user?.email ?? ''}` : 'Đăng nhập'}</span>
      <span className="md:hidden">{isServer ? 'Máy chủ' : 'Đăng nhập'}</span>
    </button>
  );
};

/** Hộp thoại kết nối máy chủ thật (1-backend). */
export const ServerConnectModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { dataSource, server, connectServer, changePassword, refreshFromServer, disconnectServer } = useApp();
  const [apiUrl, setApiUrl] = useState(server.apiUrl || lastApiUrl());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);
  if (!open) return null;

  const busy = server.status === 'waking' || server.status === 'loading';
  const isServer = dataSource === 'SERVER';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await connectServer(apiUrl, email, password);
    if (ok) {
      setPassword('');
      onClose();
    }
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (newPwd !== newPwd2) return setLocalErr('Hai lần nhập mật khẩu mới không khớp');
    if (newPwd.length < 10 || !/[a-zA-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
      return setLocalErr('Mật khẩu mới tối thiểu 10 ký tự, có cả chữ và số');
    }
    const ok = await changePassword(password, newPwd);
    if (ok) {
      setPassword('');
      setNewPwd('');
      setNewPwd2('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlugZap className="w-4 h-4 text-[var(--brand)]" />
            <h3 className="text-sm font-bold text-[var(--ink)]">Kết nối máy chủ CompetencyAI</h3>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        {server.status === 'needsPasswordChange' ? (
          <form onSubmit={submitNewPassword} className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
              {server.message}
            </div>
            <label className="block space-y-1">
              <span className="font-semibold text-[var(--ink)]">Mật khẩu mới (≥ 10 ký tự, có chữ và số)</span>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password"
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]" required />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-[var(--ink)]">Nhập lại mật khẩu mới</span>
              <input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} autoComplete="new-password"
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]" required />
            </label>
            {localErr && <div className="text-rose-600">{localErr}</div>}
            <button type="submit" className="btn btn-primary w-full text-xs font-bold">Đổi mật khẩu và vào hệ thống</button>
          </form>
        ) : isServer ? (
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đang dùng dữ liệu thật trên máy chủ
              </div>
              <div className="text-[var(--ink)]">{server.apiUrl}</div>
              <div className="text-[var(--muted)]">
                {server.user?.name} · {server.user?.email} · vai trò: {server.user?.roles.join(', ')}
              </div>
              {server.loadedAt && (
                <div className="text-[var(--muted)]">Tải lúc {server.loadedAt.toLocaleTimeString('vi-VN')}</div>
              )}
            </div>
            {!COMPANY_PORTAL && <ScopeNote />}
            <div className="flex gap-2">
              <button
                onClick={() => refreshFromServer()}
                disabled={busy}
                className="btn btn-secondary text-xs flex items-center gap-1 flex-1 justify-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Tải lại dữ liệu
              </button>
              <button
                onClick={disconnectServer}
                className="btn text-xs flex items-center gap-1 flex-1 justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" /> Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 text-xs">
            <p className="text-[var(--muted)]">
              Đang dùng <b>dữ liệu minh họa</b> lưu trong trình duyệt. Kết nối để dùng dữ liệu thật, có phân quyền và nhật ký.
            </p>
            <label className="block space-y-1">
              <span className="font-semibold text-[var(--ink)]">Địa chỉ máy chủ</span>
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://competencyai-api.onrender.com"
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-[var(--ink)]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-[var(--ink)]">Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                required
              />
            </label>

            {server.status === 'waking' && (
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 flex items-start gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />
                <span>
                  Đang đánh thức máy chủ… {server.wakeSeconds ?? 0}s. Bản miễn phí ngủ sau 15 phút không dùng, lần đầu mất
                  khoảng 30–60 giây.
                </span>
              </div>
            )}
            {server.status === 'loading' && (
              <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang đăng nhập và tải dữ liệu…
              </div>
            )}
            {server.status === 'error' && server.message && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{server.message}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary w-full text-xs font-bold flex items-center justify-center gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
              Kết nối
            </button>
            <p className="text-[10.5px] text-[var(--muted)]">
              Phiên đăng nhập chỉ lưu trong tab này — đóng tab là phải đăng nhập lại. Dữ liệu Demo trong trình duyệt được giữ
              nguyên, không bị ghi đè.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

/** Ghi chú phạm vi: phân hệ nào đã chạy trên máy chủ, phân hệ nào vẫn là minh họa. */
export const ScopeNote: React.FC = () => (
  <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[11px] space-y-1">
    <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
      <Info className="w-3.5 h-3.5" /> Phạm vi dữ liệu thật ở giai đoạn này
    </div>
    <div className="text-emerald-700 dark:text-emerald-300">
      ✔ Bảng điều khiển · Bàn duyệt · Tổ chức · Từ điển & phiên bản · Job Architecture · 360° · 9-Box · Kế thừa · IDP · Tài khoản · Nhật ký
    </div>
    <div className="text-amber-700 dark:text-amber-300">
      ◐ Mô phỏng luân chuyển, Trợ lý AI — vẫn là minh họa
    </div>
  </div>
);

/** Thông báo nổi góc màn hình. */
export const NoticeToast: React.FC = () => {
  const { notice, setNotice } = useApp();
  if (!notice) return null;
  const tone =
    notice.kind === 'ok'
      ? 'bg-emerald-600'
      : notice.kind === 'error'
      ? 'bg-rose-600'
      : 'bg-slate-700';
  return (
    <div className={`fixed bottom-4 right-4 z-[60] max-w-sm text-white text-xs rounded-xl shadow-xl px-4 py-3 flex gap-2 ${tone}`}>
      <span className="flex-1">{notice.text}</span>
      <button onClick={() => setNotice(null)} aria-label="Đóng" className="opacity-80 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** Dải cảnh báo dưới thanh tiêu đề khi đang ở chế độ máy chủ. */
export const ServerModeBanner: React.FC = () => {
  const { dataSource } = useApp();
  if (dataSource !== 'SERVER') return null;
  return (
    <div className="bg-emerald-600 text-white text-[11px] px-4 py-1.5 text-center">
      Đang dùng <b>dữ liệu thật trên máy chủ</b>. Riêng Mô phỏng luân chuyển và Trợ lý AI vẫn là minh họa.
    </div>
  );
};
