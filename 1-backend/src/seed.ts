import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './db.js';
import { hashPassword } from './auth.js';

/**
 * Seed idempotent — chạy lại nhiều lần không nhân bản dữ liệu.
 * KHÔNG tạo nhân sự giả. Nhân sự thật nhập bằng luồng /api/import/employees.
 */

const PERMISSIONS = [
  ['org:read', 'ORG', 'READ', 'Xem đơn vị trong phạm vi được cấp'],
  ['org:read_all', 'ORG', 'READ', 'Xem toàn bộ đơn vị, bỏ qua phạm vi'],
  ['org:manage', 'ORG', 'MANAGE', 'Tạo, sửa đơn vị và bổ nhiệm trưởng đơn vị'],
  ['employee:read', 'EMPLOYEE', 'READ', 'Xem nhân sự trong phạm vi'],
  ['employee:manage', 'EMPLOYEE', 'MANAGE', 'Sửa hồ sơ nhân sự'],
  ['employee:import', 'EMPLOYEE', 'IMPORT', 'Nhập dữ liệu nhân sự từ file'],
  ['competency:read', 'COMPETENCY', 'READ', 'Xem từ điển năng lực'],
  ['competency:author', 'COMPETENCY', 'CREATE', 'Soạn thảo năng lực'],
  ['competency:publish', 'COMPETENCY', 'PUBLISH', 'Xuất bản phiên bản năng lực'],
  ['audit:read', 'AUDIT', 'READ', 'Xem nhật ký hệ thống'],
  ['assessment:manage', 'ASSESSMENT', 'MANAGE', 'Tạo, mở, đóng chiến dịch 360°; nhập hộ phiếu'],
  ['assessment:read_results', 'ASSESSMENT', 'READ', 'Xem kết quả 360° của nhân sự trong phạm vi'],
  ['talent:review', 'TALENT', 'MANAGE', 'Xếp ô 9-Box và hiệu chỉnh'],
  ['idp:manage', 'IDP', 'MANAGE', 'Lập, sửa IDP cho nhân sự trong phạm vi'],
  ['idp:approve', 'IDP', 'APPROVE', 'Phê duyệt IDP'],
  ['user:manage', 'USER', 'MANAGE', 'Cấp tài khoản, đặt lại mật khẩu'],
] as const;

const ROLES: Array<{ code: string; name: string; perms: string[] }> = [
  {
    code: 'ADMIN',
    name: 'Quản trị hệ thống',
    perms: PERMISSIONS.map((p) => p[0]),
  },
  {
    code: 'HR_LEAD',
    name: 'Trưởng Ban Nhân sự',
    perms: ['org:read_all', 'org:manage', 'employee:read', 'employee:manage', 'employee:import',
            'competency:read', 'competency:author', 'competency:publish', 'audit:read',
            'assessment:manage', 'assessment:read_results', 'talent:review', 'idp:manage', 'idp:approve', 'user:manage'],
  },
  {
    code: 'HRBP',
    name: 'HR Business Partner',
    perms: ['org:read', 'employee:read', 'competency:read', 'competency:author',
            'assessment:read_results', 'talent:review', 'idp:manage'],
  },
  {
    code: 'LINE_MANAGER',
    name: 'Quản lý trực tiếp',
    perms: ['org:read', 'employee:read', 'competency:read', 'assessment:read_results', 'idp:manage', 'idp:approve'],
  },
  {
    code: 'EMPLOYEE',
    name: 'Nhân viên',
    perms: ['competency:read'],
  },
];

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
  console.log('▸ Nạp quyền...');
  for (const [code, module_, action, name] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name, module: module_, action },
      update: { name, module: module_, action },
    });
  }

  console.log('▸ Nạp vai trò...');
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, isSystem: true },
      update: { name: r.name },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({ where: { code: { in: r.perms } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

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
  const demoPassword = process.env.SEED_PASSWORD ?? 'Flamingo@2026';
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
  console.log(`▸ Mật khẩu các tài khoản mẫu: ${demoPassword}`);
  console.log('▸ Nhân sự thật: nhập bằng POST /api/import/employees/validate');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
