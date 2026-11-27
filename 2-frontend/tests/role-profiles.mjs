import assert from 'node:assert/strict';

export async function exerciseRoleProfiles(page) {
  // Seed a synthetic published competency; exercise the actual profile UI below.
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('competencyai_server_session')));
  async function api(path, method = 'GET', data) {
    const response = await page.request.fetch(session.apiUrl + '/api' + path, {
      method, headers: { Authorization: 'Bearer ' + session.accessToken }, data,
    });
    assert(response.ok(), `${method} ${path}: ${response.status()}`); return response.json();
  }
  await api('/competencies', 'POST', { code: 'BROWSER-01', name: 'Năng lực kiểm thử', definition: 'Nội dung thử',
    categoryCode: 'FUN', owningUnit: null, levels: { behavioralIndicators: [1, 2, 3, 4, 5].map(level => ({ level, indicator: 'Hành vi thử mức ' + level })) } });
  const bootstrap = await api('/bootstrap');
  await api('/competency-versions/' + bootstrap.competencies.find(c => c.code === 'BROWSER-01').versions[0].id + '/publish', 'POST', {});
  const label = name => page.getByLabel(name, { exact: true });
  const button = name => page.getByRole('button', { name, exact: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Hồ sơ chức danh').click();
  await label('Mã chức danh').fill('browser-role');
  await label('Tên chức danh').fill('Chuyên viên kiểm thử');
  await button('Tạo chức danh').click();
  await page.getByText('Chưa có bộ yêu cầu đã duyệt.', { exact: true }).waitFor();
  await button('Thêm năng lực').click();
  await label('Năng lực 1').selectOption('BROWSER-01');
  await label('Mức yêu cầu 1').selectOption('3');
  assert(await button('Duyệt bộ yêu cầu').isDisabled());
  await button('Lưu bản nháp').click();
  await page.getByText('Đã lưu bản nháp. Bộ yêu cầu đang áp dụng vẫn được giữ nguyên.', { exact: true }).waitFor();
  await button('Duyệt bộ yêu cầu').click();
  await page.getByText('Đã duyệt bộ yêu cầu năng lực.', { exact: true }).waitFor();
  await page.getByText('Mức 3', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/role-profile-mobile.png', fullPage: true });
  await button('Đánh giá và phát triển').click();
  await button('Kế thừa').click();
  await button('Vị trí then chốt').click();
  await page.locator('select').filter({ has: page.locator('option[value="BROWSER-ROLE"]') }).selectOption('BROWSER-ROLE');
  await page.reload();
  await button('Hồ sơ chức danh').click();
  await page.getByText('Mức 3', { exact: true }).waitFor();
  await page.setViewportSize({ width: 1280, height: 800 });
  await label('Mức yêu cầu 1').selectOption('5');
  await button('Lưu bản nháp').click();
  await page.getByText('Đã lưu bản nháp. Bộ yêu cầu đang áp dụng vẫn được giữ nguyên.', { exact: true }).waitFor();
  await page.getByText('Mức 3', { exact: true }).waitFor();
  assert.equal(await label('Mức yêu cầu 1').inputValue(), '5');
  if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/role-profile-desktop.png', fullPage: true });
}
