// Run after company-portal.mjs and role-profiles.mjs on their disposable local databases.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, PrismaClient } from '@prisma/client';
const origin = new URL(process.env.PORTAL_TEST_URL || 'http://127.0.0.1:55439');
const local = url => ['localhost', '127.0.0.1'].includes(url.hostname);
const [a, b] = JSON.parse(process.env.WORKSPACES_JSON || '[]');
assert(local(origin) && a && b && [a, b].every(w => local(new URL(w.databaseUrl))) && process.env.PORTAL_TEST_PASSWORD);
async function call(w, token, path, method = 'GET', body) {
  const r = await fetch(new URL('/w/' + w.code + '/api' + path, origin), { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}
test('Frozen requirements preserve historical assessment and IDP targets', async t => {
  const login = async w => (await call(w, null, '/auth/login', 'POST', { email: 'admin@example.test', password: process.env.PORTAL_TEST_PASSWORD })).data.accessToken;
  const token = await login(a), other = await login(b);
  const request = (path, method, data) => call(a, token, path, method, data);
  async function ok(path, method, body, expected = 200) {
    const r = await request(path, method, body); assert.equal(r.status, expected, JSON.stringify(r.data)); return r.data;
  }
  const requirements = level => [{ competency: 'QA-PROFILE', requiredLevel: level }];
  async function importStaff(lines) {
    const form = new FormData(); form.append('file', new Blob(['employee_code,full_name,org_unit_code,job_role_code,manager_code\n' + lines]), 'snapshot-staff.csv');
    const r = await fetch(new URL('/w/' + a.code + '/api/import/employees/validate', origin), { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
    assert.equal(r.status, 200); const data = await r.json();
    return ok('/import/employees/' + data.batchId + '/commit', 'POST', {});
  }
  async function campaign(code, people) {
    const c = await ok('/campaigns', 'POST', { code, name: code, competencyCodes: ['QA-PROFILE'] }, 201);
    await ok(`/campaigns/${c.id}/participants`, 'POST', { employeeCodes: people }); return c.id;
  }
  for (const [code, level] of [['SNAP-A', 3], ['SNAP-B', 5]]) {
    await ok('/role-profiles', 'POST', { code, title: 'Test role ' + code }, 201);
    await ok(`/role-profiles/${code}/draft`, 'PUT', { revision: 0, requirements: requirements(level) });
    await ok(`/role-profiles/${code}/approve`, 'POST', { revision: 1 });
  }
  await importStaff('SNAP01,Snapshot Employee,HQ,SNAP-A,SNAP02\nSNAP02,Snapshot Manager,HQ,,\nSNAP03,Late Participant,HQ,SNAP-A,SNAP02\nSNAP04,No Role,HQ,,SNAP02');
  const employees = (await ok('/employees?q=SNAP')).employees;
  const id = code => employees.find(e => e.employeeCode === code).id;
  let cid, initial;
  await t.test('opening is atomic and each participant receives a frozen basis', async () => {
    cid = await campaign('SNAP-FIRST', ['SNAP01', 'SNAP04']);
    const race = await Promise.all([1, 2].map(() => request(`/campaigns/${cid}/open`, 'POST', {})));
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
    initial = await ok(`/campaigns/${cid}/results/${id('SNAP01')}`);
    assert.equal(initial.requirementBasis.status, 'FROZEN');
    assert.equal(initial.requirementBasis.jobRoleCode, 'SNAP-A');
    assert.equal(initial.requirementBasis.roleRevision, 2);
    assert.equal(initial.competencies[0].required, 3);
    const empty = await ok(`/campaigns/${cid}/results/${id('SNAP04')}`);
    assert.equal(empty.requirementBasis.status, 'FROZEN'); assert.equal(empty.requirementBasis.requirementsCount, 0);
  });
  await t.test('role approval and employee reassignment cannot change the old basis', async () => {
    await ok('/role-profiles/SNAP-A/draft', 'PUT', { revision: 2, requirements: requirements(4) });
    await ok('/role-profiles/SNAP-A/approve', 'POST', { revision: 3 });
    await importStaff('SNAP01,Snapshot Employee,HQ,SNAP-B,SNAP02\nSNAP04,No Role,HQ,SNAP-A,SNAP02');
    const after = await ok(`/campaigns/${cid}/results/${id('SNAP01')}`);
    assert.equal(after.employee.jobRoleCode, 'SNAP-B');
    assert.deepEqual(after.requirementBasis, initial.requirementBasis);
    assert.equal(after.competencies[0].required, 3);
    assert.equal((await ok(`/campaigns/${cid}/results/${id('SNAP04')}`)).competencies[0].required, null);
  });
  await t.test('late arrivals freeze once; repeated and concurrent adds do not overwrite', async () => {
    const adds = await Promise.all([1, 2].map(() => request(`/campaigns/${cid}/participants`, 'POST', { employeeCodes: ['SNAP03'] })));
    assert(adds.every(r => r.status === 200));
    assert.equal(adds.reduce((n, r) => n + r.data.addedParticipants, 0), 1);
    assert.equal((await ok(`/campaigns/${cid}/results/${id('SNAP03')}`)).competencies[0].required, 4);
    await ok(`/campaigns/${cid}/participants`, 'POST', { employeeCodes: ['SNAP01'] });
    assert.deepEqual((await ok(`/campaigns/${cid}/results/${id('SNAP01')}`)).requirementBasis, initial.requirementBasis);
    const detail = await ok(`/campaigns/${cid}`);
    const rater = detail.participants.find(p => p.employee.id === id('SNAP01')).raters.find(r => r.relation === 'MANAGER');
    await ok('/rater-tasks/' + rater.id, 'PUT', { scores: [{ code: 'QA-PROFILE', level: 2 }], submit: true });
    await ok(`/campaigns/${cid}/close`, 'POST', {});
    assert.equal((await request(`/campaigns/${cid}/open`, 'POST', {})).status, 409);
    const plan = await ok('/idp/from-assessment', 'POST', { campaignId: cid, employeeId: id('SNAP01'), cycle: 'SNAP-2099' }, 201);
    assert.equal(plan.targetRoleCode, 'SNAP-A'); assert.equal(plan.goals[0].targetLevel, 3);
    assert.equal((await call(b, other, `/campaigns/${cid}/results/${id('SNAP01')}`)).status, 404);
  });
  await t.test('new cycles capture new roles; close/add races leave no unfrozen arrivals', async () => {
    const next = await campaign('SNAP-SECOND', ['SNAP01']);
    await ok(`/campaigns/${next}/open`, 'POST', {});
    const result = await ok(`/campaigns/${next}/results/${id('SNAP01')}`);
    assert.equal(result.requirementBasis.jobRoleCode, 'SNAP-B'); assert.equal(result.competencies[0].required, 5);
    const race = await Promise.all([request(`/campaigns/${next}/close`, 'POST', {}), request(`/campaigns/${next}/participants`, 'POST', { employeeCodes: ['SNAP03'] })]);
    assert.equal(race[0].status, 200); assert([200, 409].includes(race[1].status));
    const detail = await ok(`/campaigns/${next}`); assert.equal(detail.status, 'CLOSED');
    for (const p of detail.participants) assert.equal((await ok(`/campaigns/${next}/results/${p.employee.id}`)).requirementBasis.status, 'FROZEN');
  });
  await t.test('historical records without a snapshot keep scores and never use current requirements', async () => {
    const db = new PrismaClient({ datasourceUrl: a.databaseUrl });
    try {
      await db.assessmentParticipant.update({ where: { campaignId_employeeId: { campaignId: cid, employeeId: id('SNAP01') } }, data: { requirementSnapshot: Prisma.DbNull } });
    } finally { await db.$disconnect(); }
    const historical = await ok(`/campaigns/${cid}/results/${id('SNAP01')}`);
    assert.equal(historical.requirementBasis.status, 'MISSING');
    assert.equal(historical.competencies[0].others, 2); assert.equal(historical.competencies[0].required, null); assert.equal(historical.competencies[0].gap, null);
    const summary = await ok(`/campaigns/${cid}/summary`);
    assert.equal(summary.participants.find(p => p.employee.id === id('SNAP01')).requirementBasis.requirementsCount, 0);
    assert.equal((await request('/idp/from-assessment', 'POST', { campaignId: cid, employeeId: id('SNAP01'), cycle: 'SNAP-2100' })).status, 422);
  });
});
