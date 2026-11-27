import { prisma } from './db.js';

/**
 * Kiểm tra cấu hình trước khi nhận yêu cầu. Ở môi trường production (NODE_ENV=production):
 *   - DỪNG khởi động nếu khoá JWT còn mặc định / quá ngắn, hoặc CORS_ORIGINS để trống / "*".
 *   - DỪNG khởi động nếu còn tài khoản mẫu đang hoạt động.
 */
export async function preflight(sameOrigin = false) {
  const prod = process.env.NODE_ENV === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[k] ?? '';
    if (!v || v.includes('doi-truoc-khi-deploy') || v.length < 32) problems.push(`${k} chưa đặt hoặc quá ngắn (cần ≥ 32 ký tự ngẫu nhiên)`);
  }
  if (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau');
  }
  const cors = (process.env.CORS_ORIGINS ?? '').trim();
  if ((!cors && !sameOrigin) || cors.split(',').map((s) => s.trim()).includes('*')) problems.push('CORS_ORIGINS phải ghi rõ địa chỉ giao diện, không để trống hoặc "*"');

  try {
    const demo = await prisma.user.findMany({
      where: { email: { in: ['admin@flamingo.vn', 'hrlead@flamingo.vn', 'hrbp@flamingo.vn', 'manager@flamingo.vn'] }, status: 'ACTIVE' },
      select: { email: true },
    });
    if (demo.length) {
      problems.push('Còn tài khoản mẫu hoạt động. Tạo quản trị viên riêng và khoá các tài khoản mẫu trước khi triển khai production.');
    }
  } catch {
    warnings.push('Chưa đọc được bảng tài khoản (cơ sở dữ liệu chưa sẵn sàng?)');
  }

  for (const w of warnings) console.warn(`⚠ [KIỂM TRA CẤU HÌNH] ${w}`);
  if (problems.length) {
    const msg = problems.map((p) => `  ✖ ${p}`).join('\n');
    if (prod) {
      console.error(`\n✖ KHÔNG KHỞI ĐỘNG: cấu hình production chưa an toàn\n${msg}\n`);
      process.exit(1);
    }
    console.warn(`⚠ [KIỂM TRA CẤU HÌNH — chỉ cảnh báo vì không phải production]\n${msg}`);
  }
}
