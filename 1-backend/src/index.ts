import 'dotenv/config';
import express from 'express';
// Express 4 không tự bắt lỗi trong hàm async → một lỗi có thể làm sập cả máy chủ. Gói này chuyển lỗi về middleware xử lý lỗi.
import 'express-async-errors';
import cors from 'cors';
import { apiRouter } from './routes/api.js';
import { importRouter } from './routes/import.js';
import { frameworkRouter } from './routes/framework.js';
import { talentRouter } from './routes/talent.js';
import { usersRouter } from './routes/users.js';
import { reviewRouter } from './routes/review.js';
import { successionRouter } from './routes/succession.js';
import { dashboardRouter } from './routes/dashboard.js';
import { prisma } from './db.js';
import { preflight } from './preflight.js';

const app = express();

// CORS_ORIGINS: danh sách địa chỉ giao diện được phép, cách nhau bằng dấu phẩy.
// Bỏ trống hoặc "*" = cho phép mọi nguồn (chỉ dùng khi chạy thử trên máy; khi deploy PHẢI ghi rõ địa chỉ).
const corsList = (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: corsList.length === 0 || corsList.includes('*') ? true : corsList,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

// Render gọi endpoint này để biết dịch vụ còn sống.
// Cũng dùng để "đánh thức" dịch vụ sau khi ngủ 15 phút.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});

app.use('/api', apiRouter);
app.use('/api', frameworkRouter);
app.use('/api', talentRouter);
app.use('/api', usersRouter);
app.use('/api', reviewRouter);
app.use('/api', successionRouter);
app.use('/api', dashboardRouter);
app.use('/api/import', importRouter);

app.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[LỖI]', err);
  res.status(500).json({ error: 'Lỗi hệ thống', detail: err.message });
});

const port = Number(process.env.PORT ?? 8080);
await preflight();
app.listen(port, '0.0.0.0', () => {
  console.log(`CompetencyAI API đang chạy tại cổng ${port}`);
});
