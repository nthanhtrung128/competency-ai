// Run against a freshly prepared LOCAL portal with two disposable company databases.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';

const origin = new URL(process.env.PORTAL_TEST_URL || 'http://127.0.0.1:55439');
const workspaces = JSON.parse(process.env.WORKSPACES_JSON || '[]');
assert(['127.0.0.1', 'localhost'].includes(origin.hostname));
assert.equal(workspaces.length, 2);
for (const w of workspaces) assert(['localhost', '127.0.0.1'].includes(new URL(w.databaseUrl).hostname));
const [a, b] = workspaces;
const email = 'admin@example.test';
const password = process.env.PORTAL_TEST_PASSWORD || randomBytes(24).toString('hex') + 'A1';
const body = w => ({ companyName: 'Company ' + w.code, name: 'Admin', email, password, activationKey: w.activationKey });

async function call(w, path, method = 'GET', data, token) {
  const res = await fetch(new URL('/w/' + w.code + '/api' + path, origin), {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

test('Register once, provision roles, isolate companies, and revoke sessions', async () => {
  assert.equal((await fetch(new URL('/api/bootstrap', origin))).status, 404);
  assert.equal((await call({ code: 'unknown' }, '/bootstrap')).status, 404);
  assert.equal((await call(a, '/bootstrap')).status, 401);
  assert.equal((await call(a, '/auth/register', 'POST', { ...body(a), activationKey: b.activationKey })).status, 403);
  assert.equal((await call(a, '/auth/register', 'POST', { ...body(a), password: 'weak' })).status, 400);
  const race = await Promise.all([1, 2].map(() => call(a, '/auth/register', 'POST', body(a))));
  assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
  assert.equal((await call(b, '/auth/register', 'POST', body(b))).status, 201);
  const sessions = await Promise.all([a, b].map(async w => {
    const res = await call(w, '/auth/login', 'POST', { email, password });
    assert.equal(res.status, 200);
    return res.data;
  }));
  const [alice, bob] = sessions;
  await Promise.all([a, b].map(async (w, i) => {
    const home = await call(w, '/bootstrap', 'GET', undefined, sessions[i].accessToken);
    assert.equal(home.status, 200);
    assert.deepEqual(home.data.orgUnits.map(u => u.name), ['Company ' + w.code]);
    assert.equal(home.data.competencies.length, 0);
    assert(home.data.me.roles.includes('ADMIN'));
  }));
  assert.equal((await call(b, '/bootstrap', 'GET', undefined, alice.accessToken)).status, 401);
  assert.equal((await call(b, '/auth/refresh', 'POST', { refreshToken: alice.refreshToken })).status, 401);
  const draft = { code: 'QA-01', name: 'Example', definition: 'Example definition', categoryCode: 'FUN', owningUnit: null, levels: {} };
  assert.equal((await call(a, '/competencies', 'POST', draft, alice.accessToken)).status, 201);
  assert.equal((await call(a, '/competencies', 'POST', draft, alice.accessToken)).status, 409);
  assert.equal((await call(b, '/bootstrap', 'GET', undefined, bob.accessToken)).data.competencies.length, 0);
  const before = await call(a, '/bootstrap', 'GET', undefined, alice.accessToken);
  const version = before.data.competencies[0].versions[0];
  assert.equal(version.status, 'DRAFT');
  assert.equal((await call(a, '/competency-versions/' + version.id + '/publish', 'POST', {}, alice.accessToken)).status, 422);
  const member = await call(a, '/users', 'POST', { email: 'hr@example.test', name: 'HR Manager', role: 'HRBP', scopeOrgUnitCode: 'HQ' }, alice.accessToken);
  assert.equal(member.status, 201);
  const temporary = member.data.temporaryPassword;
  const first = await call(a, '/auth/login', 'POST', { email: 'hr@example.test', password: temporary });
  assert(first.data.mustChangePassword);
  assert.equal((await call(a, '/bootstrap', 'GET', undefined, first.data.accessToken)).status, 428);
  assert.equal((await call(a, '/auth/change-password', 'POST', { currentPassword: temporary, newPassword: password }, first.data.accessToken)).status, 200);
  assert.equal((await call(a, '/users', 'GET', undefined, first.data.accessToken)).status, 403);
  const file = new FormData();
  file.append('file', new Blob(['employee_code,full_name,org_unit_code\nTEST01,Test Employee,HQ']), 'staff.csv');
  const validated = await fetch(new URL('/w/' + a.code + '/api/import/employees/validate', origin), {
    method: 'POST', headers: { Authorization: 'Bearer ' + alice.accessToken }, body: file,
  });
  assert.equal(validated.status, 200);
  const { batchId, summary } = await validated.json();
  assert.equal(summary.seTao, 1);
  const batchPath = '/import/employees/' + batchId + '/commit';
  assert.equal((await call(b, batchPath, 'POST', {}, bob.accessToken)).status, 404);
  const commits = await Promise.all([1, 2].map(() => call(a, batchPath, 'POST', {}, alice.accessToken)));
  assert.deepEqual(commits.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call(a, '/dashboard', 'GET', undefined, alice.accessToken)).data.org.employees, 1);
  assert.equal((await call(b, '/dashboard', 'GET', undefined, bob.accessToken)).data.org.employees, 0);
  const directory = await call(a, '/employees?q=TEST01&take=25&skip=0', 'GET', undefined, alice.accessToken);
  assert.equal(directory.status, 200);
  assert.equal(directory.data.total, 1);
  assert.equal(directory.data.employees[0].employeeCode, 'TEST01');
  assert.equal((await call(b, '/employees', 'GET', undefined, bob.accessToken)).data.total, 0);
  for (const query of ['take=-1', 'take=abc', 'skip=-1', 'skip=1.5']) {
    assert.equal((await call(a, '/employees?' + query, 'GET', undefined, alice.accessToken)).status, 400);
  }
  const rotation = await Promise.all([1, 2].map(() => call(a, '/auth/refresh', 'POST', { refreshToken: alice.refreshToken })));
  assert.deepEqual(rotation.map(r => r.status).sort(), [200, 401]);
  const token = rotation.find(r => r.status === 200).data.refreshToken;
  assert.equal((await call(a, '/auth/logout', 'POST', { refreshToken: token })).status, 204);
  assert.equal((await call(a, '/auth/refresh', 'POST', { refreshToken: token })).status, 401);
});
