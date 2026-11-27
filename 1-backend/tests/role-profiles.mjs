// Run after company-portal.mjs, against its disposable local companies only.
import assert from 'node:assert/strict';
import test from 'node:test';
const origin = new URL(process.env.PORTAL_TEST_URL || 'http://127.0.0.1:55439');
const local = url => ['127.0.0.1', 'localhost'].includes(url.hostname);
const workspaces = JSON.parse(process.env.WORKSPACES_JSON || '[]');
assert(local(origin) && workspaces.length === 2 && workspaces.every(w => local(new URL(w.databaseUrl))));
assert(process.env.PORTAL_TEST_PASSWORD, 'Use the same randomly generated password as company-portal.mjs.');
const [a, b] = workspaces;
async function call(w, path, method = 'GET', data, token) {
  const res = await fetch(new URL('/w/' + w.code + '/api' + path, origin), {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: res.status, data: await res.json() };
}
async function login(w, email) {
  const r = await call(w, '/auth/login', 'POST', { email, password: process.env.PORTAL_TEST_PASSWORD });
  assert.equal(r.status, 200); return r.data.accessToken;
}

test('Company role profiles, approvals and assessment targets', async t => {
  const admin = await login(a, 'admin@example.test');
  const other = await login(b, 'admin@example.test');
  const author = await login(a, 'hr@example.test');
  const request = (path, method, data, token = admin) => call(a, path, method, data, token);
  const path = '/role-profiles/QA-ROLE';
  const rows = level => [{ competency: 'QA-PROFILE', requiredLevel: level }];
  let version, employeeId, campaignId;
  const profile = async () => (await request('/role-profiles')).data.roles.find(r => r.code === 'QA-ROLE');
  await t.test('create once, company isolation and strict input', async () => {
    assert.equal((await call(a, '/role-profiles')).status, 401);
    const create = () => request('/role-profiles', 'POST', { code: 'qa-role', title: 'Test specialist' }, author);
    const race = await Promise.all([create(), create()]);
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
    assert.equal((await call(b, '/role-profiles')).status, 401);
    assert.deepEqual((await call(b, '/role-profiles', 'GET', undefined, other)).data.roles, []);
    assert.equal((await call(b, path + '/draft', 'PUT', { revision: 0, requirements: [] }, other)).status, 404);
    assert.equal((await request('/role-profiles', 'POST', { code: 'bad code', title: '' })).status, 400);
    assert.equal((await request(path + '/draft', 'PUT', { revision: 0, requirements: [{ competency: 'missing', requiredLevel: 3 }] })).status, 422);
    assert.equal((await request(path + '/draft', 'PUT', { revision: 0, requirements: [...rows(3), ...rows(4)] })).status, 400);
    assert.equal((await request(path + '/draft', 'PUT', { revision: 0, requirements: rows(6) })).status, 400);
    assert.equal((await request(path + '/approve', 'POST', { revision: 0 })).status, 422);
  });
  await t.test('unpublished competencies stay in draft; HR author cannot approve', async () => {
    assert.equal((await request('/competencies', 'POST', { code: 'QA-PROFILE', name: 'Example competency', categoryCode: 'FUN', owningUnit: null,
      definition: 'Test definition', levels: { behavioralIndicators: [1, 2, 3, 4, 5].map(level => ({ level, indicator: 'Example behavior ' + level })) } })).status, 201);
    version = (await request('/bootstrap')).data.competencies.find(c => c.code === 'QA-PROFILE').versions[0];
    assert.equal((await request(path + '/draft', 'PUT', { revision: 0, requirements: rows(3) }, author)).status, 200);
    assert.equal((await request(path + '/approve', 'POST', { revision: 1 }, author)).status, 403);
    assert.equal((await request(path + '/approve', 'POST', { revision: 1 })).status, 422);
    assert.equal((await profile()).requirements.length, 0);
    assert.equal((await request('/competency-versions/' + version.id + '/publish', 'POST', {})).status, 200);
    assert.equal((await request('/job-roles/QA-ROLE/requirements', 'PUT', { requirements: rows(5) })).status, 409);
  });
  await t.test('import validates role codes and assessment has no draft target', async () => {
    async function validate(csv) {
      const form = new FormData(); form.append('file', new Blob([csv]), 'roles.csv');
      const r = await fetch(new URL('/w/' + a.code + '/api/import/employees/validate', origin), {
        method: 'POST', headers: { Authorization: 'Bearer ' + admin }, body: form,
      });
      assert.equal(r.status, 200); return r.json();
    }
    const invalid = await validate('employee_code,full_name,org_unit_code,job_role_code\nBAD01,Test Invalid,HQ,unknown');
    assert.equal(invalid.summary.seTao, 0);
    const skipped = await request('/import/employees/' + invalid.batchId + '/commit', 'POST', {});
    assert.equal(skipped.status, 200); assert.equal(skipped.data.daTao, 0);
    assert.equal((await request('/employees?q=BAD01')).data.total, 0);
    const valid = await validate('employee_code,full_name,org_unit_code,job_role_code,manager_code\nPROFILE01,Test Specialist,HQ,qa-role,PROFILE02\nPROFILE02,Test Supervisor,HQ,,');
    assert.equal(valid.summary.seTao, 2);
    assert.equal((await request('/import/employees/' + valid.batchId + '/commit', 'POST', {})).status, 200);
    employeeId = (await request('/employees?q=PROFILE01')).data.employees[0].id;
    const created = await request('/campaigns', 'POST', { code: 'QA-ROLE-CYCLE', name: 'Test cycle', competencyCodes: ['QA-PROFILE'] });
    assert.equal(created.status, 201); campaignId = created.data.id;
    assert.equal((await request(`/campaigns/${campaignId}/participants`, 'POST', { employeeCodes: ['PROFILE01'] })).status, 200);
    assert.equal((await request(`/campaigns/${campaignId}/open`, 'POST', {})).status, 200);
    const participant = (await request(`/campaigns/${campaignId}`)).data.participants[0];
    const manager = participant.raters.find(r => r.relation === 'MANAGER');
    assert(manager);
    assert.equal((await request('/rater-tasks/' + manager.id, 'PUT', { scores: [{ code: 'QA-PROFILE', level: 2 }], submit: true })).status, 200);
    const result = (await request(`/campaigns/${campaignId}/results/${employeeId}`)).data;
    assert.equal(result.employee.jobRoleCode, 'QA-ROLE');
    assert.equal(result.competencies[0].required, null);
    assert.equal(result.competencies[0].gap, null);
    assert.equal((await request(`/campaigns/${campaignId}/close`, 'POST', {})).status, 200);
    assert.equal((await request('/idp/from-assessment', 'POST', { employeeId, campaignId, cycle: '2099' })).status, 422);
  });
  await t.test('approval is atomic; stale saves cannot replace approved requirements', async () => {
    const race = await Promise.all([1, 2].map(() => request(path + '/approve', 'POST', { revision: 1 })));
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
    let p = await profile();
    assert.equal(p.pendingRequirements, null); assert.equal(p.revision, 2);
    assert.deepEqual(p.requirements.map(q => [q.sourceLabel, q.requiredLevel, q.mappingStatus]), [['QA-PROFILE', 3, 'APPROVED']]);
    assert.equal((await request(path + '/draft', 'PUT', { revision: 1, requirements: rows(5) })).status, 409);
    const saves = await Promise.all([4, 5].map(level => request(path + '/draft', 'PUT', { revision: 2, requirements: rows(level) }, author)));
    assert.deepEqual(saves.map(r => r.status).sort(), [200, 409]);
    p = await profile();
    assert.equal(p.revision, 3); assert.equal(p.requirements[0].requiredLevel, 3);
    assert([4, 5].includes(p.pendingRequirements[0].requiredLevel));
    assert.equal((await request(path + '/approve', 'POST', { revision: 2 })).status, 409);
  });
  await t.test('approved target feeds results and IDP while edits remain pending', async () => {
    // The first cycle captured no approved target; later approval must not rewrite its history.
    const old = (await request(`/campaigns/${campaignId}/results/${employeeId}`)).data;
    assert.equal(old.competencies[0].required, null);
    assert.equal(old.requirementBasis.status, 'FROZEN');
    assert.equal((await request('/idp/from-assessment', 'POST', { employeeId, campaignId, cycle: '2099' })).status, 422);
    campaignId = (await request('/campaigns', 'POST', { code: 'QA-ROLE-AFTER', name: 'Cycle after approval', competencyCodes: ['QA-PROFILE'] })).data.id;
    assert.equal((await request(`/campaigns/${campaignId}/participants`, 'POST', { employeeCodes: ['PROFILE01'] })).status, 200);
    assert.equal((await request(`/campaigns/${campaignId}/open`, 'POST', {})).status, 200);
    const manager = (await request(`/campaigns/${campaignId}`)).data.participants[0].raters.find(r => r.relation === 'MANAGER');
    assert.equal((await request('/rater-tasks/' + manager.id, 'PUT', { scores: [{ code: 'QA-PROFILE', level: 2 }], submit: true })).status, 200);
    assert.equal((await request(`/campaigns/${campaignId}/close`, 'POST', {})).status, 200);
    const result = (await request(`/campaigns/${campaignId}/results/${employeeId}`)).data;
    assert.equal(result.competencies[0].required, 3);
    assert.equal(result.competencies[0].requiredStatus, 'APPROVED');
    assert.equal(result.competencies[0].gap, 1);
    const plan = await request('/idp/from-assessment', 'POST', { employeeId, campaignId, cycle: '2099' });
    assert.equal(plan.status, 201);
    assert.equal(plan.data.targetRoleCode, 'QA-ROLE');
    assert.equal(plan.data.goals[0].targetLevel, 3);
    assert.equal(plan.data.goals[0].currentLevel, 2);
    assert.equal((await call(b, '/idp/' + plan.data.id, 'GET', undefined, other)).status, 404);
  });
  await t.test('readers see approved requirements and cannot edit or approve', async () => {
    const account = await request('/users', 'POST', { email: 'reader@example.test', name: 'Test reader', role: 'LINE_MANAGER', employeeCode: 'PROFILE02' });
    assert.equal(account.status, 201);
    const signed = await call(a, '/auth/login', 'POST', { email: 'reader@example.test', password: account.data.temporaryPassword });
    const token = signed.data.accessToken;
    assert.equal((await request('/auth/change-password', 'POST', { currentPassword: account.data.temporaryPassword, newPassword: process.env.PORTAL_TEST_PASSWORD }, token)).status, 200);
    for (const endpoint of ['/role-profiles', '/job-roles']) {
      const viewed = await request(endpoint, 'GET', undefined, token);
      assert.equal(viewed.status, 200);
      const r = viewed.data.roles.find(r => r.code === 'QA-ROLE');
      assert.equal(r.pendingRequirements, null); assert.equal(r.requirements[0].requiredLevel, 3);
    }
    assert.equal((await request(path + '/draft', 'PUT', { revision: 3, requirements: rows(5) }, token)).status, 403);
    assert.equal((await request(path + '/approve', 'POST', { revision: 3 }, token)).status, 403);
    const logs = (await request('/audit-logs?take=100')).data;
    const entries = logs.logs ?? logs;
    assert.equal(entries.filter(e => e.entityType === 'JobRole' && e.entityName === 'QA-ROLE' && e.action === 'PUBLISH').length, 1);
  });
});
