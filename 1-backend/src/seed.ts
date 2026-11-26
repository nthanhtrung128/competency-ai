import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './db.js';
import { hashPassword } from './auth.js';

/**
 * Seed idempotent — chạy lại nhiều lần không nhân bản dữ liệu.
 * KHÔNG tạo nhân sự giả. Nhân sự thật nhập bằng luồng /api/import/employees.
 */

import { provisionRoles } from './roles.js';

/**
 * Cây tổ chức nạp từ data/flamingo_seed_data.json (34 đơn vị — CCTC cập nhật:
 * Ban Pháp chế và Kiểm soát nội bộ đã gộp; Hội đồng Đầu tư đã bỏ).
 * Sửa cây tổ chức → sửa file JSON rồi chạy lại `npm run seed`.
 */
type SeedUnit = {
  code: string;
  tier: number;
  parent: string | null;
  unitType: string;
  name: { vi: string; en?: string };
  note?: string;
};
const SEED_FILE = resolve(process.cwd(), process.env.SEED_FILE ?? './data/flamingo_seed_data.json');
const ORG_UNITS: SeedUnit[] = JSON.parse(readFileSync(SEED_FILE, 'utf-8')).orgUnits;

async function main() {
  const demoPassword = process.env.SEED_PASSWORD;
  if (!demoPassword) throw new Error('Đặt SEED_PASSWORD trước khi nạp tài khoản mẫu.');
  await provisionRoles(prisma);
  console.log('▸ Nạp cây tổ chức...');
  const idByCode = new Map<string, string>();
  for (const u of [...ORG_UNITS].sort((a, b) => a.tier - b.tier)) {
    const parentId = u.parent ? idByCode.get(u.parent) ?? null : null;
    if (u.parent && !parentId) {
      console.warn(`  ⚠ ${u.code}: không tìm thấy đơn vị cha "${u.parent}" — bỏ qua`);
      continue;
    }
    const data = {
      name: u.name.vi,
      nameEn: u.name.en ?? null,
      tier: u.tier,
      type: u.unitType as never,
      parentId,
      note: u.note ?? null,
    };
    const unit = await prisma.orgUnit.upsert({
      where: { code: u.code },
      create: { code: u.code, ...data },
      update: data,
    });
    idByCode.set(u.code, unit.id);
  }

  console.log('▸ Nạp tài khoản mẫu...');
  const accounts = [
    { email: 'admin@flamingo.vn', name: 'Quản trị hệ thống', role: 'ADMIN', scope: null },
    { email: 'hrlead@flamingo.vn', name: 'Trưởng Ban Nhân sự', role: 'HR_LEAD', scope: null },
    { email: 'hrbp@flamingo.vn', name: 'HRBP Khối Kinh doanh', role: 'HRBP', scope: 'K2' },
    { email: 'manager@flamingo.vn', name: 'Trưởng Ban Đầu tư', role: 'LINE_MANAGER', scope: 'B01' },
  ];

  for (const a of accounts) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      create: { email: a.email, name: a.name, passwordHash: await hashPassword(demoPassword) },
      update: { name: a.name },
    });
    const role = await prisma.role.findUnique({ where: { code: a.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
    if (a.scope) {
      const unitId = idByCode.get(a.scope);
      if (unitId) {
        await prisma.userScope.upsert({
          where: {
            userId_orgUnitId_accessLevel: { userId: user.id, orgUnitId: unitId, accessLevel: 'READ' },
          },
          create: { userId: user.id, orgUnitId: unitId, accessLevel: 'READ', includeSubtree: true },
          update: {},
        });
      }
    }
  }

  const counts = {
    quyen: await prisma.permission.count(),
    vaiTro: await prisma.role.count(),
    donVi: await prisma.orgUnit.count(),
    taiKhoan: await prisma.user.count(),
    nhanSu: await prisma.employee.count(),
  };
  console.log('▸ Xong:', counts);
  console.log('▸ Nhân sự thật: nhập bằng POST /api/import/employees/validate');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
