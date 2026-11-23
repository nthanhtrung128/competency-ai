import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { api, apiSend, loadSession } from '../../api/client';
import { useApp } from '../../context/AppContext';

/** Tải dữ liệu từ máy chủ, có trạng thái đang tải / lỗi và hàm tải lại */
export function useServerData<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Gọi thao tác ghi, hiện thông báo, trả về kết quả (null nếu lỗi) */
export function useAction() {
  const { setNotice } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    okText?: string,
  ): Promise<T | null> => {
    setBusy(true);
    try {
      const r = await apiSend<T>(method, path, body);
      if (okText) setNotice({ kind: 'ok', text: okText });
      return r;
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

/** Tải file lên (multipart) — dùng cho nhập hộ phiếu 360° */
export async function uploadFile<T>(path: string, file: File): Promise<{ status: number; body: T }> {
  const s = loadSession();
  if (!s) throw new Error('Chưa đăng nhập máy chủ');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${s.apiUrl}/api${path}`, { method: 'POST', headers: { Authorization: `Bearer ${s.accessToken}` }, body: fd });
  return { status: res.status, body: (await res.json()) as T };
}

export const Loading: React.FC<{ text?: string }> = ({ text }) => (
  <div className="flex items-center gap-2 text-xs text-[var(--muted)] p-4">
    <Loader2 className="w-4 h-4 animate-spin" /> {text ?? 'Đang tải…'}
  </div>
);

export const ErrorBox: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex gap-2">
    <AlertTriangle className="w-4 h-4 shrink-0" /> {text}
  </div>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 text-center text-xs text-[var(--muted)] border border-dashed border-[var(--line)] rounded-xl">{children}</div>
);

export const Pill: React.FC<{ tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray'; children: React.ReactNode }> = ({ tone = 'gray', children }) => {
  const c = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[tone];
  return <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${c}`}>{children}</span>;
};

export const RELATION_VI: Record<string, string> = {
  SELF: 'Tự đánh giá', MANAGER: 'Quản lý', PEER: 'Đồng nghiệp', DIRECT_REPORT: 'Cấp dưới', OTHER: 'Khác',
};
export const CAMPAIGN_STATUS: Record<string, [string, 'gray' | 'green' | 'blue']> = {
  DRAFT: ['Đang chuẩn bị', 'gray'], OPEN: ['Đang thu phiếu', 'green'], CLOSED: ['Đã đóng', 'blue'],
};
export const IDP_STATUS: Record<string, [string, 'gray' | 'amber' | 'green' | 'blue' | 'red']> = {
  DRAFT: ['Nháp', 'gray'], SUBMITTED: ['Chờ duyệt', 'amber'], APPROVED: ['Đã duyệt', 'green'],
  IN_PROGRESS: ['Đang thực hiện', 'blue'], COMPLETED: ['Hoàn thành', 'green'], CANCELLED: ['Huỷ', 'red'],
};
export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ','));

export const inputCls = 'w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] text-xs';

/** Tải xuống CSV (dùng cho danh sách mật khẩu tạm) */
export function downloadCsv(name: string, rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return;
  const head = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = '﻿' + [head.join(','), ...rows.map((r) => head.map((h) => esc(r[h])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Tải file từ máy chủ có kèm token (vd CSV bảng đối chiếu) */
export async function downloadAuthed(path: string, filename: string) {
  const s = loadSession();
  if (!s) throw new Error('Chưa đăng nhập máy chủ');
  const res = await fetch(`${s.apiUrl}/api${path}`, { headers: { Authorization: `Bearer ${s.accessToken}` } });
  if (!res.ok) throw new Error(`Không tải được file (${res.status})`);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
