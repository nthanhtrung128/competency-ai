/**
 * Lớp gọi API tới máy chủ CompetencyAI (1-backend).
 *
 * - Địa chỉ máy chủ: biến môi trường VITE_API_URL lúc build, hoặc nhập trên màn hình "Kết nối máy chủ".
 * - Token: access token 15 phút + refresh token 7 ngày (xoay vòng). Lưu trong sessionStorage
 *   → đóng tab là phải đăng nhập lại (an toàn hơn localStorage với dữ liệu nhân sự).
 * - Tự làm mới access token một lần khi gặp 401.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  apiUrl: string;
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

const SESSION_KEY = 'competencyai_server_session';
const LAST_URL_KEY = 'competencyai_last_api_url';

export const DEFAULT_API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

// ---------------------------------------------------------------- lưu phiên

let session: Session | null = null;

function safeGet(store: Storage, key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
function safeSet(store: Storage, key: string, value: string | null) {
  try { value === null ? store.removeItem(key) : store.setItem(key, value); } catch { /* bỏ qua */ }
}

export function loadSession(): Session | null {
  if (session) return session;
  const raw = safeGet(sessionStorage, SESSION_KEY);
  if (!raw) return null;
  try { session = JSON.parse(raw) as Session; } catch { session = null; }
  return session;
}

function saveSession(s: Session | null) {
  session = s;
  safeSet(sessionStorage, SESSION_KEY, s ? JSON.stringify(s) : null);
}

export function clearSession() {
  saveSession(null);
}

export function lastApiUrl(): string {
  return safeGet(localStorage, LAST_URL_KEY) || DEFAULT_API_URL;
}

export function normalizeUrl(url: string) {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/api$/i, '');
}

// ---------------------------------------------------------------- gọi mạng

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function messageOf(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body) return String((body as { error: unknown }).error);
  return fallback;
}

/**
 * Đánh thức máy chủ (Render bản miễn phí ngủ sau 15 phút, mất ~30–60 giây để dậy).
 * Gọi /health lặp lại tới khi trả 200 hoặc hết thời gian.
 */
export async function wakeServer(apiUrl: string, onTick?: (seconds: number) => void, maxSeconds = 90) {
  const started = Date.now();
  for (;;) {
    const elapsed = Math.round((Date.now() - started) / 1000);
    onTick?.(elapsed);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${apiUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      const body = (await readBody(res)) as { db?: string } | null;
      if (res.ok) return body;
      if (res.status === 503) throw new ApiError(503, 'Máy chủ chạy nhưng không kết nối được cơ sở dữ liệu (kiểm tra DATABASE_URL).');
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    if (elapsed >= maxSeconds) {
      throw new ApiError(0, `Không liên lạc được máy chủ sau ${maxSeconds} giây. Kiểm tra địa chỉ và CORS_ORIGINS.`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function login(apiUrl: string, email: string, password: string): Promise<Session & { mustChangePassword: boolean }> {
  const url = normalizeUrl(apiUrl);
  const res = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const body = (await readBody(res)) as { accessToken: string; refreshToken: string; user: SessionUser; mustChangePassword?: boolean } | null;
  if (!res.ok || !body) throw new ApiError(res.status, messageOf(body, 'Đăng nhập thất bại'), body);
  const s: Session = { apiUrl: url, accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user };
  saveSession(s);
  safeSet(localStorage, LAST_URL_KEY, url);
  return { ...s, mustChangePassword: !!body.mustChangePassword };
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const s = loadSession();
  if (!s) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${s.apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: s.refreshToken }),
        });
        if (!res.ok) { clearSession(); return false; }
        const body = (await res.json()) as { accessToken: string; refreshToken: string };
        saveSession({ ...s, accessToken: body.accessToken, refreshToken: body.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const s = loadSession();
  if (!s) throw new ApiError(401, 'Chưa đăng nhập máy chủ');
  const res = await fetch(`${s.apiUrl}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${s.accessToken}`,
    },
  });
  if (res.status === 401 && retry && (await refreshTokens())) return api<T>(path, init, false);
  const body = await readBody(res);
  if (!res.ok) {
    const msg =
      res.status === 403
        ? `Tài khoản của bạn không đủ quyền cho thao tác này. ${messageOf(body, '')}`.trim()
        : messageOf(body, `Lỗi máy chủ (${res.status})`);
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiSend = <T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: unknown) =>
  api<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });
