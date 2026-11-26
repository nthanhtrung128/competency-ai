import 'dotenv/config';
import express from 'express';
// Express 4 không tự bắt lỗi trong hàm async → một lỗi có thể làm sập cả máy chủ. Gói này chuyển lỗi về middleware xử lý lỗi.
import 'express-async-errors';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { apiRouter } from './routes/api.js';
import { importRouter } from './routes/import.js';
import { frameworkRouter } from './routes/framework.js';
import { talentRouter } from './routes/talent.js';
import { usersRouter } from './routes/users.js';
import { reviewRouter } from './routes/review.js';
import { successionRouter } from './routes/succession.js';
import { dashboardRouter } from './routes/dashboard.js';
import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';
import { withWorkspace, prisma } from './db.js';
import { readWorkspaces } from './workspaces.js';
import { registrationRouter } from './routes/registration.js';
import { preflight } from './preflight.js';

const app = express();
const workspaces = readWorkspaces();
const hosted = workspaces.length > 0;
const service = express.Router();
app.disable('x-powered-by');

// CORS_ORIGINS: danh sách địa chỉ giao diện được phép, cách nhau bằng dấu phẩy.
// Bỏ trống hoặc "*" = cho phép mọi nguồn (chỉ dùng khi chạy thử trên máy; khi deploy PHẢI ghi rõ địa chỉ).
const corsList = (process.env.CORS_ORIGINS ?? (hosted ? '' : '*')).split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: corsList.includes('*') ? true : corsList,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

// Render gọi endpoint này để biết dịch vụ còn sống.
// Cũng dùng để "đánh thức" dịch vụ sau khi ngủ 15 phút.
service.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});

if (hosted) {
  if (process.env.RENDER === 'true') app.set('trust proxy', 1);
  service.use(['/api/auth/login', '/api/auth/register'], rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
  }));
}
service.use('/api', apiRouter);
service.use('/api', frameworkRouter);
service.use('/api', talentRouter);
service.use('/api', usersRouter);
service.use('/api', reviewRouter);
service.use('/api', successionRouter);
service.use('/api', dashboardRouter);
service.use('/api/import', importRouter);

if (hosted) {
  service.use('/api', registrationRouter);
  const connections = new Map(workspaces.map(workspace => [
    workspace.code, { workspace, client: new PrismaClient({ datasourceUrl: workspace.databaseUrl }) },
  ]));
  for (const connection of connections.values()) {
    const identity = await connection.client.workspaceIdentity.findUnique({ where: { id: 1 } });
    if (identity?.code !== connection.workspace.code) throw new Error('Cơ sở dữ liệu chưa gắn đúng mã công ty.');
    await withWorkspace(connection, () => preflight(true));
  }
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/w/:code', (req, res, next) => {
    const connection = connections.get(req.params.code);
    if (!connection) return res.status(404).json({ error: 'Không tìm thấy mã công ty.' });
    withWorkspace(connection, next);
  }, service);
  app.use(express.static(resolve('../2-frontend/dist')));
} else {
  await preflight();
  app.use(service);
}

app.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy endpoint' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[LỖI]', err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, '0.0.0.0', () => {
  console.log(`CompetencyAI API đang chạy tại cổng ${port}`);
});
