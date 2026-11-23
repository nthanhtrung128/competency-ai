import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Client = typeof import('../src/api/client');
let c: Client;
let fetchMock: ReturnType<typeof vi.fn>;
const API = 'https://api.test.invalid';

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('sessionStorage', new MemStore());
  vi.stubGlobal('localStorage', new MemStore());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  c = await import('../src/api/client');
});
afterEach(() => vi.unstubAllGlobals());

async function loggedIn() {
  fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'A1', refreshToken: 'R1', user: { id: 'u', email: 'e', name: 'n' }, mustChangePassword: true }));
  return c.login(`${API}/api/`, ' Foo@Test.Invalid ', 'pw');
}

describe('normalizeUrl', () => {
  it('thêm https, bỏ dấu / và đuôi /api', () => {
    expect(c.normalizeUrl(' api.x.vn/api/ ')).toBe('https://api.x.vn');
    expect(c.normalizeUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });
});

describe('login', () => {
  it('gửi email chữ thường, lưu phiên, trả mustChangePassword', async () => {
    const s = await loggedIn();
    expect(s.mustChangePassword).toBe(true);
    expect(s.apiUrl).toBe(API);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/auth/login`);
    expect(JSON.parse(init.body)).toEqual({ email: 'foo@test.invalid', password: 'pw' });
    expect(c.loadSession()?.accessToken).toBe('A1');
    expect(c.lastApiUrl()).toBe(API);
  });

  it('sai mật khẩu → ApiError 401 mang thông điệp của máy chủ, không lưu phiên', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'Sai thông tin' }));
    await expect(c.login(API, 'a@b.c', 'x')).rejects.toMatchObject({ status: 401, message: 'Sai thông tin' });
    expect(c.loadSession()).toBeNull();
  });
});

describe('api()', () => {
  it('chưa đăng nhập → ApiError 401, không gọi mạng', async () => {
    await expect(c.apiGet('/bootstrap')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gắn Bearer token và trả JSON', async () => {
    await loggedIn();
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    expect(await c.apiGet('/bootstrap')).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${API}/api/bootstrap`);
    expect(init.headers.Authorization).toBe('Bearer A1');
  });

  it('401 → làm mới token một lần rồi gọi lại với token mới', async () => {
    await loggedIn();
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'hết hạn' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'A2', refreshToken: 'R2' }))
      .mockResolvedValueOnce(json(200, { data: 'ok' }));
    expect(await c.apiGet('/x')).toEqual({ data: 'ok' });
    expect(fetchMock.mock.calls[2][0]).toBe(`${API}/api/auth/refresh`);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ refreshToken: 'R1' });
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer A2');
    expect(c.loadSession()?.refreshToken).toBe('R2');
  });

  it('401 và refresh cũng bị từ chối → xoá phiên, ném ApiError 401', async () => {
    await loggedIn();
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'hết hạn' }))
      .mockResolvedValueOnce(json(401, { error: 'refresh hỏng' }));
    await expect(c.apiGet('/x')).rejects.toMatchObject({ status: 401 });
    expect(c.loadSession()).toBeNull();
  });

  it('chỉ thử lại một lần (không lặp vô hạn khi vẫn 401 sau refresh)', async () => {
    await loggedIn();
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { accessToken: 'A2', refreshToken: 'R2' }))
      .mockResolvedValueOnce(json(401, { error: 'vẫn 401' }));
    await expect(c.apiGet('/x')).rejects.toMatchObject({ status: 401, message: 'vẫn 401' });
    expect(fetchMock).toHaveBeenCalledTimes(4); // login + gọi + refresh + gọi lại
  });

  it('403 → thông báo không đủ quyền', async () => {
    await loggedIn();
    fetchMock.mockResolvedValueOnce(json(403, { error: 'Thiếu quyền X' }));
    await expect(c.apiGet('/x')).rejects.toMatchObject({ status: 403, message: expect.stringContaining('không đủ quyền') });
  });

  it('428 (bắt buộc đổi mật khẩu) và 422 (chặn ban hành) giữ nguyên status + body', async () => {
    await loggedIn();
    fetchMock.mockResolvedValueOnce(json(428, { error: 'Phải đổi mật khẩu' }));
    await expect(c.apiGet('/x')).rejects.toMatchObject({ status: 428, message: 'Phải đổi mật khẩu' });
    fetchMock.mockResolvedValueOnce(json(422, { error: 'Còn nhãn DỰ THẢO AI', details: [1] }));
    await expect(c.apiSend('POST', '/y', {})).rejects.toMatchObject({ status: 422, body: { error: 'Còn nhãn DỰ THẢO AI', details: [1] } });
  });

  it('lỗi 500 không có body → thông điệp dự phòng có mã trạng thái', async () => {
    await loggedIn();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(c.apiGet('/x')).rejects.toMatchObject({ status: 500, message: 'Lỗi máy chủ (500)' });
  });

  it('apiSend gửi đúng method và JSON body', async () => {
    await loggedIn();
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await c.apiSend('PATCH', '/z', { a: 1 });
    const init = fetchMock.mock.calls[1][1];
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"a":1}');
  });

  it('kết quả 360°: điểm nhóm bị máy chủ ẩn (null) + hiddenGroups được chuyển nguyên vẹn, không bị giao diện "điền" lại', async () => {
    await loggedIn();
    const result = {
      campaign: { minRatersForAnonymity: 3 },
      raters: { hiddenGroups: ['PEER', 'DIRECT_REPORT'] },
      competencies: [{ code: 'CO1', self: 4, manager: 3, peer: null, directReport: null, others: 3.5, othersCount: 2 }],
    };
    fetchMock.mockResolvedValueOnce(json(200, result));
    const got = await c.apiGet<typeof result>('/campaigns/c1/results/e1');
    expect(got.raters.hiddenGroups).toEqual(['PEER', 'DIRECT_REPORT']);
    expect(got.competencies[0].peer).toBeNull();
    expect(got.competencies[0].directReport).toBeNull();
  });
});

describe('wakeServer', () => {
  it('trả body khi /health 200', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { db: 'ok' }));
    expect(await c.wakeServer(API)).toEqual({ db: 'ok' });
  });
  it('503 → ApiError nói rõ lỗi cơ sở dữ liệu', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { db: 'down' }));
    await expect(c.wakeServer(API)).rejects.toMatchObject({ status: 503 });
  });
});
