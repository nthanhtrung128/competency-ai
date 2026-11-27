import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import type { Workspace } from './workspaces.js';

type Connection = { workspace: Workspace; client: PrismaClient };
const context = new AsyncLocalStorage<Connection>();
const legacyClient = new PrismaClient();
export const currentWorkspace = () => context.getStore()?.workspace;

export function withWorkspace<T>(connection: Connection, run: () => T) {
  return context.run(connection, run);
}

// Resolve the client at call time so concurrent HTTP requests and transactions use
// the same company database throughout the existing route and permission helpers.
export const prisma = new Proxy(legacyClient, {
  get(_target, key) {
    const active = context.getStore();
    if (!active && process.env.WORKSPACES_JSON !== undefined) throw new Error('Thiếu ngữ cảnh công ty');
    const client = active?.client ?? legacyClient;
    const value = Reflect.get(client, key, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
