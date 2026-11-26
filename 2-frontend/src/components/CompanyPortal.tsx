import { useState, type FormEvent } from 'react';
import { ArrowRight, Layers3, Loader2 } from 'lucide-react';
import { companyApiUrl, lastApiUrl, registerCompany } from '../api/client';
import { useApp } from '../context/AppContext';

const input = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#176451] focus:outline-2 focus:outline-[#a2cfbe]';
const codeFormat = '[a-z0-9][a-z0-9\\-]{1,39}';

export function CompanyPortal() {
  const { server, connectServer, changePassword } = useApp();
  const [registering, setRegistering] = useState(false);
  const [code, setCode] = useState(() => {
    try { return new URL(lastApiUrl()).pathname.match(/^\/w\/([a-z0-9-]+)$/)?.[1] ?? ''; }
    catch { return ''; }
  });
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState('');
  const changing = server.status === 'needsPasswordChange';
  const busy = pending || server.status === 'loading' || server.status === 'waking';
  const title = changing ? 'Đổi mật khẩu lần đầu' : registering ? 'Đăng ký doanh nghiệp' : 'Đăng nhập';

  function switchForm() {
    setRegistering(!registering);
    setFeedback('');
    setSuccess('');
    setCurrent('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? '');
    const password = field('password');
    setFeedback('');
    setSuccess('');
    if ((registering || changing) && password !== field('confirmation')) {
      setFeedback('Hai lần nhập mật khẩu mới chưa khớp.');
      return;
    }
    setPending(true);
    try {
      if (changing) {
        await changePassword(current, password);
      } else if (registering) {
        await registerCompany(companyApiUrl(code), {
          companyName: field('companyName'), name: field('name'), email,
          activationKey: field('activationKey').trim(), password,
        });
        setRegistering(false);
        setCurrent('');
        setSuccess('Đã tạo tài khoản quản trị. Bạn có thể đăng nhập bằng mật khẩu vừa đặt.');
      } else {
        await connectServer(companyApiUrl(code), email, current);
      }
    } catch (error) {
      setFeedback(error instanceof TypeError ? 'Chưa kết nối được máy chủ. Vui lòng thử lại.' : error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f1] px-4 py-6 sm:grid sm:place-items-center sm:p-8 text-slate-900">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[#cdd7cd] bg-white shadow-lg md:grid md:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between gap-6 bg-[#173d37] p-6 text-white md:p-9">
          <div className="flex items-center gap-2.5 text-lg font-semibold"><Layers3 aria-hidden="true" /> CompetencyAI</div>
          <div className="md:pb-4">
            <p className="max-w-xs text-2xl font-semibold leading-tight md:text-4xl">Quản trị năng lực doanh nghiệp</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#c7ded4]">Xây dựng từ điển năng lực, tổ chức đánh giá 360° và theo dõi kế hoạch phát triển nhân sự.</p>
          </div>
        </section>
        <section className="p-6 sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{changing ? 'Dùng mật khẩu tạm đã nhận để đặt mật khẩu cá nhân.' : registering
            ? 'Dành cho quản trị viên đầu tiên. Dùng mã công ty và mã kích hoạt do người triển khai cung cấp.'
            : 'Nhập mã công ty và tài khoản do doanh nghiệp cấp.'}</p>
          <form key={title} onSubmit={submit} className="mt-6 space-y-4 text-sm font-medium">
            <fieldset disabled={busy} className="space-y-4">
              {!changing && <>
                <label className="block">Mã công ty<input className={input} value={code} required maxLength={40} pattern={codeFormat}
                  autoCapitalize="none" spellCheck={false} placeholder="ví dụ: an-phu" onChange={e => setCode(e.target.value.toLowerCase().trim())} /></label>
                {registering && <>
                  <label className="block">Tên doanh nghiệp<input className={input} name="companyName" autoComplete="organization" minLength={2} maxLength={150} required /></label>
                  <label className="block">Họ tên quản trị viên<input className={input} name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
                  <label className="block">Mã kích hoạt<input className={input} type="password" name="activationKey" autoComplete="off" maxLength={256} required /></label>
                </>}
                <label className="block">Email công việc<input className={input} type="email" autoComplete="username" value={email}
                  onChange={e => setEmail(e.target.value)} maxLength={254} required /></label>
              </>}
              {(!registering || changing) && <label className="block">{changing ? 'Mật khẩu tạm' : 'Mật khẩu'}
                <input className={input} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></label>}
              {(registering || changing) && <>
                <label className="block">Mật khẩu mới<input className={input} type="password" name="password" autoComplete="new-password" minLength={10} required aria-describedby="password-hint" /></label>
                <p id="password-hint" className="text-xs font-normal text-slate-600">Ít nhất 10 ký tự, gồm cả chữ và số.</p>
                <label className="block">Nhập lại mật khẩu mới<input className={input} type="password" name="confirmation" autoComplete="new-password" required /></label>
              </>}
            </fieldset>
            {success && <p role="status" className="text-emerald-800">{success}</p>}
            {(feedback || (!registering && !success && server.message)) && <p role="status" className="text-sm text-[#84341d]">{feedback || server.message}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#176451] px-4 py-3 font-semibold text-white hover:bg-[#124e40] disabled:opacity-60">
              {busy ? <><Loader2 className="size-4 animate-spin" /> Đang kết nối…</> : <>{changing ? 'Lưu mật khẩu và đăng nhập' : title}<ArrowRight className="size-4" /></>}
            </button>
          </form>
          {!changing && <button disabled={busy} onClick={switchForm} className="mt-5 text-sm font-semibold text-[#176451] underline underline-offset-4">
            {registering ? 'Quay lại đăng nhập' : 'Đăng ký doanh nghiệp'}
          </button>}
        </section>
      </div>
    </main>
  );
}
