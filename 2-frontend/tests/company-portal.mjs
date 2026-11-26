// Use a fresh, disposable company. The test activates it and creates synthetic records.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
import { exerciseRoleProfiles } from './role-profiles.mjs';

const origin = new URL(process.env.PORTAL_TEST_URL || 'http://127.0.0.1:55439');
const w = JSON.parse(process.env.WORKSPACES_JSON || '[]').find(x => x.code === process.env.BROWSER_TEST_COMPANY);
const local = url => ['localhost', '127.0.0.1'].includes(url.hostname);
assert(local(origin) && w && local(new URL(w.databaseUrl)), 'Cần công ty thử riêng trên PostgreSQL và HTTP cục bộ.');
const password = () => randomBytes(24).toString('hex') + 'A1';
const adminPassword = password();
const adminEmail = 'browser-admin@example.test';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const label = name => page.getByLabel(name, { exact: true });
  const button = name => page.getByRole('button', { name, exact: true });
  const heading = name => page.getByRole('heading', { name });
  const logout = async () => {
    await page.locator('#server-connect-btn').click();
    await button('Đăng xuất').click();
    await heading('Đăng nhập').waitFor();
  };
  await page.goto(origin.href);
  await button('Đăng ký doanh nghiệp').click();
  await label('Mã công ty').fill(w.code);
  await label('Tên doanh nghiệp').fill('Công ty kiểm thử');
  await label('Họ tên quản trị viên').fill('Quản trị viên thử');
  await label('Email công việc').fill(adminEmail);
  await label('Mật khẩu mới').fill(adminPassword);
  await label('Nhập lại mật khẩu mới').fill(adminPassword);
  await label('Mã kích hoạt').fill('invalid');
  await button('Đăng ký doanh nghiệp').click();
  await page.getByText('Mã kích hoạt doanh nghiệp không hợp lệ.').waitFor();
  await label('Mã kích hoạt').fill(w.activationKey);
  await button('Đăng ký doanh nghiệp').click();
  await page.getByText(/Đã tạo tài khoản quản trị/).waitFor();
  await label('Mật khẩu').fill(adminPassword);
  await button('Đăng nhập').click();
  await heading(/Bảng điều khiển/).waitFor();
  await page.reload();
  await heading(/Bảng điều khiển/).waitFor();
  await logout();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  await page.setViewportSize({ width: 1280, height: 800 });
  await label('Email công việc').fill(adminEmail);
  await label('Mật khẩu').fill(adminPassword);
  await button('Đăng nhập').click();
  await heading(/Bảng điều khiển/).waitFor();
  await exerciseRoleProfiles(page);
  await button('Nhập nhân sự').click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'staff.csv', mimeType: 'text/csv',
    buffer: Buffer.from('employee_code,full_name,org_unit_code\nE01,Test Manager,HQ'),
  });
  await button('Kiểm tra file').click();
  await page.getByText(/Sẽ tạo 1, cập nhật 0/).waitFor();
  await page.getByRole('checkbox').check();
  await button('Ghi hồ sơ nhân sự').click();
  await page.getByText('Đã tạo 1 hồ sơ và cập nhật 0 hồ sơ.').waitFor();
  await button('Danh sách nhân sự').click();
  await page.getByText('Test Manager', { exact: true }).waitFor();
  await label('Họ tên hoặc mã nhân viên').fill('missing');
  await button('Tìm kiếm').click();
  await page.getByText('Chưa có hồ sơ phù hợp.').waitFor();
  await label('Họ tên hoặc mã nhân viên').fill('E01');
  await button('Tìm kiếm').click();
  await page.getByText('Test Manager', { exact: true }).waitFor();
  await button('Thang năng lực').click();
  await page.getByRole('heading', { name: 'Thang năng lực', exact: true }).waitFor();
  await button('Quản lý tài khoản').click();
  const form = page.locator('form').filter({ has: button('Cấp tài khoản') });
  const memberEmail = 'browser-hr@example.test';
  await form.getByPlaceholder('Email', { exact: true }).fill(memberEmail);
  await form.getByPlaceholder('Họ tên').fill('HR thử');
  await form.getByPlaceholder(/Mã nhân sự/).fill('E01');
  assert.deepEqual(await form.locator('input').evaluateAll(inputs => inputs.filter(input => !input.validity.valid)
    .map(input => ({ field: input.placeholder, problem: input.validationMessage }))), []);
  assert.deepEqual(errors, []);
  const created = page.waitForResponse(response => response.url().endsWith('/api/users') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Cấp tài khoản' }).click();
  const createdResponse = await created.catch(async e => {
    if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: process.env.QA_SCREENSHOT_DIR + '/account-failure.png', fullPage: true, mask: [page.locator('input, td.font-mono')] });
    throw e;
  });
  assert.equal(createdResponse.status(), 201, createdResponse.ok() ? 'Created account' : await createdResponse.text());
  const row = page.locator('tr').filter({ hasText: memberEmail }).filter({ has: page.locator('td.font-mono') });
  const temporary = await row.locator('td.font-mono').innerText();
  await logout();
  await label('Email công việc').fill(memberEmail);
  await label('Mật khẩu').fill(temporary);
  await button('Đăng nhập').click();
  await heading('Đổi mật khẩu lần đầu').waitFor();
  await page.reload();
  await heading('Đổi mật khẩu lần đầu').waitFor();
  const replacement = password();
  await label('Mật khẩu tạm').fill(temporary);
  await label('Mật khẩu mới').fill(replacement);
  await label('Nhập lại mật khẩu mới').fill(replacement);
  await button('Lưu mật khẩu và đăng nhập').click();
  await heading(/Bảng điều khiển/).waitFor();
  assert.equal(await button('Quản lý tài khoản').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Đạt kiểm thử trình duyệt trên điện thoại và máy tính.');
} finally {
  await browser.close();
}
