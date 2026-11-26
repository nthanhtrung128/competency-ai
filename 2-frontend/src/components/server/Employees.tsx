import { useEffect, useState, type FormEvent } from 'react';
import { apiGet } from '../../api/client';
import { ErrorBox, Loading } from './shared';

type Employee = {
  id: string; employeeCode: string; fullName: string; jobTitle: string | null; status: string;
  orgUnit: { name: string; code: string } | null;
};
type Result = { employees: Employee[]; total: number };
const statusLabel: Record<string, string> = { ACTIVE: 'Đang làm việc', ON_LEAVE: 'Tạm nghỉ', TERMINATED: 'Đã nghỉ việc' };

export function Employees() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState({ q: '', skip: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setResult(null);
    setError('');
    const params = new URLSearchParams({ q: query.q, skip: String(query.skip), take: '25' });
    apiGet<Result>('/employees?' + params).then(data => {
      if (current) setResult(data);
    }).catch(e => {
      if (current) setError(e instanceof Error ? e.message : 'Chưa tải được danh sách.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query]);
  function search(e: FormEvent) {
    e.preventDefault();
    setQuery({ q: input.trim(), skip: 0 });
  }
  return <section className="app-card space-y-4">
    <h1 className="text-xl font-bold">Danh sách nhân sự</h1>
    <p className="text-sm text-[var(--muted)]">Tra cứu các hồ sơ trong phạm vi được cấp.</p>
    <form onSubmit={search} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-48 text-sm">Họ tên hoặc mã nhân viên
        <input className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2" value={input}
          onChange={e => setInput(e.target.value)} maxLength={200} />
      </label>
      <button className="btn btn-primary" type="submit">Tìm kiếm</button>
      <button className="btn btn-secondary" type="button" onClick={() => setQuery({ ...query })}>Tải lại</button>
    </form>
    {loading && <Loading />}
    {error && <ErrorBox text={error} />}
    {result && <>
      <p role="status" className="text-sm">Tìm thấy {result.total} hồ sơ.</p>
      {result.employees.length === 0 ? <p>Chưa có hồ sơ phù hợp.</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr>{['Mã nhân viên', 'Họ tên', 'Đơn vị', 'Chức danh', 'Trạng thái'].map(label =>
            <th key={label} scope="col" className="border-b border-[var(--line)] p-2">{label}</th>)}</tr></thead>
          <tbody>{result.employees.map(employee => <tr key={employee.id}>
            <td className="p-2">{employee.employeeCode}</td><td className="p-2">{employee.fullName}</td>
            <td className="p-2">{employee.orgUnit?.name ?? 'Chưa gán'}</td><td className="p-2">{employee.jobTitle ?? '—'}</td>
            <td className="p-2 whitespace-nowrap">{statusLabel[employee.status] ?? employee.status}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="flex items-center gap-3 text-sm">
        <button className="btn btn-secondary" disabled={query.skip === 0} onClick={() => setQuery({ ...query, skip: Math.max(0, query.skip - 25) })}>Trang trước</button>
        <span>Trang {Math.floor(query.skip / 25) + 1}</span>
        <button className="btn btn-secondary" disabled={query.skip + 25 >= result.total} onClick={() => setQuery({ ...query, skip: query.skip + 25 })}>Trang sau</button>
      </div>
    </>}
  </section>;
}
