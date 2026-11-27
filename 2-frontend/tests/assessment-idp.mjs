import assert from 'node:assert/strict';

// Called by the portal browser test after its synthetic role and E01 employee exist.
export async function exerciseAssessmentIdp(page) {
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('competencyai_server_session')));
  async function api(path, method = 'GET', data) {
    const r = await page.request.fetch(session.apiUrl + '/api' + path, { method, headers: { Authorization: 'Bearer ' + session.accessToken }, data });
    assert(r.ok(), `${method} ${path}: ${r.status()}`); return r.json();
  }
  const validated = await page.request.post(session.apiUrl + '/api/import/employees/validate', {
    headers: { Authorization: 'Bearer ' + session.accessToken }, multipart: { file: { name: 'idp-staff.csv', mimeType: 'text/csv',
      buffer: Buffer.from('employee_code,full_name,org_unit_code,job_role_code,manager_code\nE01,Test Manager,HQ,BROWSER-ROLE,E02\nE02,Test Supervisor,HQ,,') } },
  });
  assert(validated.ok()); await api('/import/employees/' + (await validated.json()).batchId + '/commit', 'POST', {});
  const button = name => page.getByRole('button', { name, exact: true });
  const label = name => page.getByLabel(name, { exact: true });
  await button('Đánh giá và phát triển').click();
  await button('Chiến dịch 360°').click();
  await button('Chiến dịch mới').click();
  await label('Mã chiến dịch').fill('BROWSER-CYCLE'); await label('Tên').fill('Kỳ đánh giá kiểm thử');
  await label('BROWSER-01 · Năng lực kiểm thử').check();
  await button('Tạo').click();
  await page.getByRole('heading', { name: /Kỳ đánh giá kiểm thử/ }).waitFor();
  await label('Chỉ người có cấp dưới').uncheck(); await button('Thêm').click();
  await page.getByText(/Đã thêm 2 người được đánh giá/).waitFor();
  await button('Mở thu phiếu').click(); await button('Đóng chiến dịch').waitFor();
  await page.locator('input[type=file]').setInputFiles({ name: 'ratings.csv', mimeType: 'text/csv',
    buffer: Buffer.from('ma_phieu,ma_nv_duoc_danh_gia,quan_he,ma_nv_nguoi_danh_gia,ma_nang_luc,muc,nhan_xet\nB01,E01,Quản lý,E02,BROWSER-01,2,Minh chứng thử') });
  await button('Kiểm tra').click(); await page.getByText(/✔ Hợp lệ: 1 phiếu/).waitFor();
  await button('Ghi thật').click(); await page.getByText(/✔ Đã ghi 1 phiếu/).waitFor();
  const campaign = (await api('/campaigns')).campaigns.find(c => c.code === 'BROWSER-CYCLE');
  const employee = (await api('/employees?q=E01')).employees[0];
  const role = (await api('/role-profiles')).roles.find(r => r.code === 'BROWSER-ROLE');
  // The pending draft raises the live target to 5; the cycle must retain its captured target of 3.
  await api('/role-profiles/BROWSER-ROLE/approve', 'POST', { revision: role.revision });
  const result = await api(`/campaigns/${campaign.id}/results/${employee.id}`);
  assert.equal(result.requirementBasis.status, 'FROZEN'); assert.equal(result.competencies[0].required, 3);
  assert.equal(result.competencies[0].gap, 1);
  await button('Đóng chiến dịch').click();
  await page.getByText('Đã đóng', { exact: true }).waitFor();
  await page.locator('tr').filter({ hasText: 'Test Manager' }).getByRole('button', { name: 'Kết quả', exact: true }).click();
  await page.getByText(/Yêu cầu đã chốt ngày/).waitFor();
  await button('IDP').click(); await button('Lập IDP từ 360°').click();
  await label('Chiến dịch').selectOption(campaign.id); await label('Nhân sự').selectOption(employee.id);
  await label('Chu kỳ').fill('BROWSER-2099'); await button('Lập IDP').click();
  await page.getByRole('heading', { name: /IDP BROWSER-2099/ }).waitFor();
  await page.getByText(/hiện tại 2,0+ → mục tiêu 3/).waitFor();
  const action = 'Thực hiện nhiệm vụ kiểm thử cùng quản lý';
  await label('Hành động phát triển').fill(action); await button('Thêm hành động').click();
  await page.getByText(action, { exact: true }).waitFor();
  await button('Gửi duyệt').click(); await button('Phê duyệt').click(); await button('Bắt đầu thực hiện').click();
  await label(action).click(); await page.getByText(/Tiến độ 100%/).waitFor();
  assert(await label(action).isChecked());
  await page.getByPlaceholder('Ghi nhận tiến độ, phản hồi…').fill('Đã hoàn thành nhiệm vụ kiểm thử và trao đổi kết quả.');
  await button('Gửi').click(); await page.getByText('Đã hoàn thành nhiệm vụ kiểm thử và trao đổi kết quả.', { exact: true }).waitFor();
  await button('Đánh dấu hoàn thành').click(); await page.getByText('Hoàn thành', { exact: true }).waitFor();
  assert(await label(action).isDisabled());
  const plan = (await api('/idp')).plans.find(p => p.cycle === 'BROWSER-2099');
  assert.equal(plan.status, 'COMPLETED'); assert.equal(plan.goals[0].targetLevel, 3); assert.equal(plan.progress, 100);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/idp-completed-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log('Đạt vòng giao diện chiến dịch → yêu cầu đã chốt → IDP → hoàn thành.');
}
