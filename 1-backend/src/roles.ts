import type { Prisma } from '@prisma/client';

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

export async function provisionRoles(prisma: Prisma.TransactionClient) {
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
}
