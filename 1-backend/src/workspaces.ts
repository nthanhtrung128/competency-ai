import { z } from 'zod';

const config = z.array(z.object({
  code: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),
  databaseUrl: z.string().regex(/^postgres(?:ql)?:\/\//),
  activationKey: z.string().min(32).max(256).optional(),
})).min(1);

export function readWorkspaces() {
  if (process.env.WORKSPACES_JSON === undefined) return [];
  let workspaces;
  try {
    workspaces = config.parse(JSON.parse(process.env.WORKSPACES_JSON));
  } catch {
    throw new Error('WORKSPACES_JSON cần mã công ty, URL PostgreSQL và mã kích hoạt riêng tối thiểu 32 ký tự nếu có.');
  }
  const codes = workspaces.map(w => w.code);
  const keys = workspaces.flatMap(w => w.activationKey ? [w.activationKey] : []);
  if (new Set(codes).size !== codes.length || new Set(keys).size !== keys.length) {
    throw new Error('Mã công ty và mã kích hoạt phải riêng biệt.');
  }
  return workspaces;
}

export type Workspace = ReturnType<typeof readWorkspaces>[number];
