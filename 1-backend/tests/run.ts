import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { assertSafeTarget } from './helpers.js';

/**
 * Chạy toàn bộ kịch bản đầu-cuối bằng một lệnh: npm test
 *  - Tự bật máy chủ thử ở cổng 8099 (không đụng máy chủ "npm run dev" đang chạy ở 8080), chạy xong tự tắt.
 *  - Muốn thử trên máy chủ đã bật sẵn: đặt API_URL=http://localhost:8080 — khi đó không tự bật máy chủ.
 *  - Các kịch bản ghi rồi xoá dữ liệu thử → chỉ chạy với CSDL cục bộ (xem tests/README.md).
 */
const SCENARIOS = [
  'tests/e2e-360-idp.ts',
  'tests/e2e-review-succession.ts',
  'tests/e2e-import-employees.ts',
  'tests/e2e-import-indicators.ts',
];
const own = !process.env.API_URL;
const port = process.env.TEST_PORT ?? '8099';
if (own) process.env.API_URL = `http://localhost:${port}`;
assertSafeTarget();

const node = process.execPath;
let server: ChildProcess | null = null;

async function waitHealthy(ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(process.env.API_URL + '/health');
      if (r.ok) return true;
    } catch {
      /* chưa lên */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function runScenario(file: string) {
  return new Promise<number>((resolve) => {
    const p = spawn(node, ['--import', 'tsx', file], { stdio: 'inherit', env: process.env });
    p.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  if (own) {
    // Cổng khác 8080 và khoá JWT riêng cho thử nghiệm; NODE_ENV không phải production để preflight chỉ cảnh báo
    server = spawn(node, ['--import', 'tsx', 'src/index.ts'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: port, NODE_ENV: 'test', CORS_ORIGINS: process.env.CORS_ORIGINS ?? '*' },
    });
    let log = '';
    server.stdout?.on('data', (d) => (log += d));
    server.stderr?.on('data', (d) => (log += d));
    if (!(await waitHealthy())) {
      console.error('\n✖ Máy chủ thử không lên được (kiểm tra DATABASE_URL, đã chạy "npx prisma db push" và "npm run seed:all" chưa?). Nhật ký máy chủ:\n' + log.slice(-2000));
      server.kill();
      process.exit(2);
    }
  }
  let failed = 0;
  for (const s of SCENARIOS) {
    const code = await runScenario(s);
    if (code !== 0) failed++;
  }
  server?.kill();
  console.log(failed === 0 ? '\x1b[32m\x1b[1mTẤT CẢ KỊCH BẢN ĐẠT\x1b[0m\n' : `\x1b[31m\x1b[1m${failed} kịch bản chưa đạt\x1b[0m\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
