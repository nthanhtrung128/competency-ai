import { useState } from 'react';
import { apiGet, apiSend } from '../../api/client';
import { downloadCsv, ErrorBox, uploadFile } from './shared';

type Preview = {
  batchId: string;
  summary: { tong: number; seTao: number; seCapNhat: number; canhBao: number; loi: number };
};
type Row = { rowNumber: number; messages: Array<{ text: string }> };

export function EmployeeImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issues, setIssues] = useState<Row[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function validate() {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    setConfirm(false);
    setResult('');
    setError('');
    setIssues([]);
    try {
      const r = await uploadFile<Preview & { error?: string }>('/import/employees/validate', file);
      if (r.status !== 200) throw new Error(r.body.error || 'Chưa kiểm tra được file.');
      setPreview(r.body);
      const { loi, canhBao } = r.body.summary;
      if (loi || canhBao) {
        const statuses = [loi && 'ERROR', canhBao && 'WARNING'].filter(Boolean);
        const details = await Promise.all(statuses.map(status =>
          apiGet<{ rows: Row[] }>(`/import/employees/${r.body.batchId}/rows?status=${status}`)));
        setIssues(details.flatMap(detail => detail.rows).sort((a, b) => a.rowNumber - b.rowNumber));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa kiểm tra được file.');
    } finally { setBusy(false); }
  }

  async function commit() {
    if (!preview || !confirm) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiSend<{ daTao: number; daCapNhat: number }>('POST', `/import/employees/${preview.batchId}/commit`);
      setResult(`Đã tạo ${r.daTao} hồ sơ và cập nhật ${r.daCapNhat} hồ sơ.`);
      setPreview(null);
      setIssues([]);
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa ghi được hồ sơ.');
    } finally { setBusy(false); }
  }

  return <section className="app-card max-w-3xl space-y-4">
    <h1 className="text-lg font-bold">Nhập danh sách nhân sự</h1>
    <p className="text-sm text-[var(--muted)]">Chọn file CSV UTF-8 có mã nhân viên, họ tên và mã đơn vị đã tạo. Kiểm tra kết quả trước khi ghi hồ sơ.</p>
    <button className="btn btn-secondary" onClick={() => downloadCsv('mau_nhan_su.csv', [{
      employee_code: '', full_name: '', email: '', phone: '', org_unit_code: '', job_title: '', job_role_code: '', job_level_code: '',
      grade_code: '', manager_code: '', hire_date: '', status: '',
    }])}>Tải mẫu CSV</button>
    <label className="block font-medium">File nhân sự (tối đa 5 MB)
      <input className="mt-1 block w-full text-sm" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => {
        const selected = e.target.files?.[0] ?? null;
        const tooLarge = !!selected && selected.size > 5 * 1024 * 1024;
        setFile(tooLarge ? null : selected);
        setError(tooLarge ? 'File vượt quá 5 MB.' : '');
        setPreview(null); setConfirm(false); setIssues([]); setResult('');
      }} />
    </label>
    <button className="btn btn-secondary" disabled={busy || !file} onClick={validate}>Kiểm tra file</button>
    {preview && <div className="space-y-3 border-t border-[var(--line)] pt-3">
      <p role="status">Có {preview.summary.tong} dòng. Sẽ tạo {preview.summary.seTao}, cập nhật {preview.summary.seCapNhat}. Có {preview.summary.canhBao} dòng cảnh báo và {preview.summary.loi} dòng lỗi.</p>
      {issues.length > 0 && <ul className="max-h-40 overflow-y-auto text-xs">{issues.map(row => <li key={row.rowNumber}>
        Dòng {row.rowNumber} · {row.messages.map(m => m.text).join(' ')}
      </li>)}</ul>}
      {preview.summary.loi > 0 ? <p>Sửa các dòng lỗi rồi chọn lại file để kiểm tra.</p> : preview.summary.tong > 0 && <>
        <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} disabled={busy} onChange={e => setConfirm(e.target.checked)} />Tôi đã kiểm tra các hồ sơ sẽ tạo hoặc cập nhật.</label>
        <button className="btn btn-primary" disabled={!confirm || busy} onClick={commit}>Ghi hồ sơ nhân sự</button>
      </>}
    </div>}
    {busy && <p role="status">Đang xử lý…</p>}
    {error && <ErrorBox text={error} />}
    {result && <p role="status" className="text-emerald-700">{result}</p>}
  </section>;
}
