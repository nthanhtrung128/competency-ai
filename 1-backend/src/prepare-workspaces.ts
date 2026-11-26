import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { readWorkspaces } from './workspaces.js';

const workspaces = readWorkspaces();
if (!workspaces.length) throw new Error('Cần cấu hình WORKSPACES_JSON.');
for (const workspace of workspaces) {
  const env = { ...process.env, DATABASE_URL: workspace.databaseUrl };
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env, stdio: 'inherit' });
  if (migration.status !== 0) throw new Error('Không tạo được bảng cho ' + workspace.code);
  const client = new PrismaClient({ datasourceUrl: workspace.databaseUrl });
  try {
    const identity = await client.workspaceIdentity.upsert({
      where: { id: 1 }, create: { id: 1, code: workspace.code }, update: {},
    });
    if (identity.code !== workspace.code) throw new Error('Cơ sở dữ liệu đã gắn với mã công ty khác.');
  } finally {
    await client.$disconnect();
  }
}
