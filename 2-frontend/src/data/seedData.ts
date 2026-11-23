import {
  OrgUnitModel,
  RoleModel,
  UserModel,
  JobFamilyModel,
  CompetencyCategoryModel,
  CompetencyModel,
  CompetencyVersionModel,
  ProficiencyScaleModel,
  PermissionModel,
  RolePermissionModel,
  UserRoleModel,
  UserScopeModel,
  AuditLogModel,
  InterviewQuestionModel,
  JobLevelModel,
  JobRoleModel,
  GovernanceRuleModel,
  DataWarningModel,
} from '../../packages/db/src/types';
import { FLAMINGO_DATASET } from './flamingoAdapter';

export const SEED_PERMISSIONS: PermissionModel[] = [
  // User Management Permissions
  { id: 'perm-user-read', code: 'users:read', name: 'Read Users', description: 'View user profiles, memberships, and directory', module: 'USERS', action: 'READ', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-user-create', code: 'users:create', name: 'Create Users', description: 'Provision new employee accounts', module: 'USERS', action: 'CREATE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-user-update', code: 'users:update', name: 'Update Users', description: 'Modify user details and status', module: 'USERS', action: 'UPDATE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-user-delete', code: 'users:delete', name: 'Delete Users', description: 'Deactivate or remove user records', module: 'USERS', action: 'DELETE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-user-role', code: 'users:assign_role', name: 'Assign User Roles', description: 'Grant or revoke roles for users', module: 'USERS', action: 'MANAGE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },

  // Role & RBAC Permissions
  { id: 'perm-role-read', code: 'roles:read', name: 'Read Roles', description: 'View roles and permission matrices', module: 'ROLES', action: 'READ', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-role-manage', code: 'roles:manage', name: 'Manage Roles', description: 'Create, update roles and configure permission grants', module: 'ROLES', action: 'MANAGE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },

  // Org Unit Permissions
  { id: 'perm-org-read', code: 'org:read', name: 'Read Org Units', description: 'View organizational chart and hierarchy', module: 'ORG_UNITS', action: 'READ', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-org-manage', code: 'org:manage', name: 'Manage Org Hierarchy', description: 'Create and restructure divisions, departments, and teams', module: 'ORG_UNITS', action: 'MANAGE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-org-scope', code: 'org:assign_scope', name: 'Grant Data Scopes (RLS)', description: 'Assign organizational unit access scopes to users', module: 'ORG_UNITS', action: 'MANAGE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },

  // Competency & Scale Framework Permissions
  { id: 'perm-comp-read', code: 'competencies:read', name: 'Read Competencies & Scales', description: 'View competency standards, Flamingo 5-level scale, and behavioral indicators', module: 'COMPETENCIES', action: 'READ', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-comp-author', code: 'competencies:author', name: 'Author Competencies & Scales', description: 'Create and draft competency categories, custom scales, and versions', module: 'COMPETENCIES', action: 'CREATE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-comp-publish', code: 'competencies:publish', name: 'Publish Competencies', description: 'Approve and publish competency version revisions', module: 'COMPETENCIES', action: 'PUBLISH', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },

  // Audit Log Permissions
  { id: 'perm-audit-read', code: 'audit:read', name: 'Read Audit Logs', description: 'Inspect security and system change history logs', module: 'AUDIT', action: 'READ', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
  { id: 'perm-audit-export', code: 'audit:export', name: 'Export Audit Logs', description: 'Download compliance audit trails', module: 'AUDIT', action: 'MANAGE', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
];

export const SEED_ROLES: RoleModel[] = [
  {
    id: 'role-superadmin',
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Toàn quyền điều hành hệ thống, kiểm toán an ninh và quản trị cấu trúc Tập đoàn Flamingo.',
    isSystem: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-mgr',
    code: 'UNIT_MANAGER',
    name: 'Org Unit Manager',
    description: 'Quản lý cơ cấu phòng ban, đánh giá năng lực nhân viên và ánh xạ họ nghề trong phạm vi được phân quyền.',
    isSystem: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-hr',
    code: 'HR_LEAD',
    name: 'Competency Framework Lead',
    description: 'Chủ quản từ điển năng lực Flamingo (Ban Nhân sự & QTHC), hiệu chuẩn thang đo 5 mức và công bố tiêu chuẩn hành vi.',
    isSystem: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-emp',
    code: 'EMPLOYEE',
    name: 'Standard Employee',
    description: 'Xem sơ đồ tổ chức, từ điển năng lực và theo dõi lộ trình phát triển cá nhân (IDP).',
    isSystem: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'role-auditor',
    code: 'SECURITY_AUDITOR',
    name: 'Security & Compliance Auditor',
    description: 'Quyền xem nhật ký kiểm toán (Audit Logs), ma trận phân quyền và vết truy cập dữ liệu.',
    isSystem: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }
];

export const SEED_ROLE_PERMISSIONS: RolePermissionModel[] = [
  // Super Admin gets all permissions
  ...SEED_PERMISSIONS.map((p, idx) => ({
    id: `rp-admin-${idx}`,
    roleId: 'role-superadmin',
    permissionId: p.id,
    grantedAt: new Date('2025-01-01'),
  })),

  // Unit Manager
  { id: 'rp-mgr-1', roleId: 'role-mgr', permissionId: 'perm-user-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-mgr-2', roleId: 'role-mgr', permissionId: 'perm-org-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-mgr-3', roleId: 'role-mgr', permissionId: 'perm-comp-read', grantedAt: new Date('2025-01-01') },

  // HR Lead
  { id: 'rp-hr-1', roleId: 'role-hr', permissionId: 'perm-user-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-hr-2', roleId: 'role-hr', permissionId: 'perm-org-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-hr-3', roleId: 'role-hr', permissionId: 'perm-comp-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-hr-4', roleId: 'role-hr', permissionId: 'perm-comp-author', grantedAt: new Date('2025-01-01') },
  { id: 'rp-hr-5', roleId: 'role-hr', permissionId: 'perm-comp-publish', grantedAt: new Date('2025-01-01') },
  { id: 'rp-hr-6', roleId: 'role-hr', permissionId: 'perm-org-scope', grantedAt: new Date('2025-01-01') },

  // Employee
  { id: 'rp-emp-1', roleId: 'role-emp', permissionId: 'perm-user-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-emp-2', roleId: 'role-emp', permissionId: 'perm-org-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-emp-3', roleId: 'role-emp', permissionId: 'perm-comp-read', grantedAt: new Date('2025-01-01') },

  // Security Auditor
  { id: 'rp-aud-1', roleId: 'role-auditor', permissionId: 'perm-audit-read', grantedAt: new Date('2025-01-01') },
  { id: 'rp-aud-2', roleId: 'role-auditor', permissionId: 'perm-audit-export', grantedAt: new Date('2025-01-01') },
  { id: 'rp-aud-3', roleId: 'role-auditor', permissionId: 'perm-role-read', grantedAt: new Date('2025-01-01') },
];

export const SEED_USERS: UserModel[] = [
  {
    id: 'usr-ceo',
    email: 'alex.morgan@flamingo.vn',
    name: 'Alex Morgan',
    title: 'Tổng Giám đốc Tập đoàn',
    status: 'ACTIVE',
    primaryRoleId: 'role-superadmin',
    orgUnitId: 'org-fla',
    jobFamilyId: 'jf-jf01',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'usr-cto',
    email: 'sarah.chen@flamingo.vn',
    name: 'Sarah Chen',
    title: 'Trưởng Ban CNTT & CĐS',
    status: 'ACTIVE',
    primaryRoleId: 'role-mgr',
    orgUnitId: 'org-b13',
    jobFamilyId: 'jf-jf13',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'usr-head-eng',
    email: 'marcus.vance@flamingo.vn',
    name: 'Marcus Vance',
    title: 'Trưởng Phòng Ứng dụng doanh nghiệp & CĐS',
    status: 'ACTIVE',
    primaryRoleId: 'role-mgr',
    orgUnitId: 'org-b13-p2',
    jobFamilyId: 'jf-jf13',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'usr-hr-lead',
    email: 'hannah.abbott@flamingo.vn',
    name: 'Hannah Abbott',
    title: 'Trưởng Ban Nhân sự & Quản trị Hành chính',
    status: 'ACTIVE',
    primaryRoleId: 'role-hr',
    orgUnitId: 'org-b11',
    jobFamilyId: 'jf-jf11',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'usr-dev-lead',
    email: 'elena.rostova@flamingo.vn',
    name: 'Elena Rostova',
    title: 'Trưởng Phòng Hạ tầng CNTT & ATTT',
    status: 'ACTIVE',
    primaryRoleId: 'role-emp',
    orgUnitId: 'org-b13-p1',
    jobFamilyId: 'jf-jf13',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'usr-swe-1',
    email: 'david.kim@flamingo.vn',
    name: 'David Kim',
    title: 'Chuyên viên Dữ liệu & Công nghệ số',
    status: 'ACTIVE',
    primaryRoleId: 'role-emp',
    orgUnitId: 'org-b13-p3',
    jobFamilyId: 'jf-jf13',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2025-01-01'),
  }
];

export const SEED_USER_ROLES: UserRoleModel[] = [
  { id: 'ur-1', userId: 'usr-ceo', roleId: 'role-superadmin', isPrimary: true, assignedAt: new Date('2024-01-01') },
  { id: 'ur-2', userId: 'usr-cto', roleId: 'role-mgr', isPrimary: true, assignedAt: new Date('2024-01-15') },
  { id: 'ur-3', userId: 'usr-head-eng', roleId: 'role-mgr', isPrimary: true, assignedAt: new Date('2024-02-01') },
  { id: 'ur-4', userId: 'usr-hr-lead', roleId: 'role-hr', isPrimary: true, assignedAt: new Date('2024-02-10') },
  { id: 'ur-5', userId: 'usr-dev-lead', roleId: 'role-emp', isPrimary: true, assignedAt: new Date('2024-03-01') },
  { id: 'ur-6', userId: 'usr-swe-1', roleId: 'role-emp', isPrimary: true, assignedAt: new Date('2024-04-15') },
  { id: 'ur-7', userId: 'usr-hr-lead', roleId: 'role-auditor', isPrimary: false, assignedAt: new Date('2025-01-20'), assignedById: 'usr-ceo' },
];

export const SEED_USER_SCOPES: UserScopeModel[] = [
  {
    id: 'scope-1',
    userId: 'usr-ceo',
    orgUnitId: 'org-fla',
    accessLevel: 'ADMIN',
    includeSubtree: true,
    grantedAt: new Date('2024-01-01'),
    grantedById: 'usr-ceo',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'scope-2',
    userId: 'usr-cto',
    orgUnitId: 'org-b13',
    accessLevel: 'ADMIN',
    includeSubtree: true,
    grantedAt: new Date('2024-01-15'),
    grantedById: 'usr-ceo',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'scope-3',
    userId: 'usr-head-eng',
    orgUnitId: 'org-b13-p2',
    accessLevel: 'APPROVE',
    includeSubtree: true,
    grantedAt: new Date('2024-02-01'),
    grantedById: 'usr-cto',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'scope-4',
    userId: 'usr-hr-lead',
    orgUnitId: 'org-b11',
    accessLevel: 'ADMIN',
    includeSubtree: true,
    grantedAt: new Date('2024-02-10'),
    grantedById: 'usr-ceo',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-10'),
  },
  {
    id: 'scope-5',
    userId: 'usr-dev-lead',
    orgUnitId: 'org-b13-p1',
    accessLevel: 'APPROVE',
    includeSubtree: false,
    grantedAt: new Date('2024-03-01'),
    grantedById: 'usr-head-eng',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: 'scope-6',
    userId: 'usr-swe-1',
    orgUnitId: 'org-b13-p3',
    accessLevel: 'READ',
    includeSubtree: false,
    grantedAt: new Date('2024-04-15'),
    grantedById: 'usr-dev-lead',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-04-15'),
  },
  {
    id: 'scope-7',
    userId: 'usr-hr-lead',
    orgUnitId: 'org-b13',
    accessLevel: 'READ',
    includeSubtree: true,
    grantedAt: new Date('2025-01-20'),
    grantedById: 'usr-cto',
    expiresAt: new Date('2026-01-01'),
    createdAt: new Date('2025-01-20'),
    updatedAt: new Date('2025-01-20'),
  }
];

// Re-export core Flamingo entities
export const SEED_PROFICIENCY_SCALES: ProficiencyScaleModel[] = FLAMINGO_DATASET.proficiencyScales;
export const SEED_CATEGORIES: CompetencyCategoryModel[] = FLAMINGO_DATASET.categories;
export const SEED_ORG_UNITS: OrgUnitModel[] = FLAMINGO_DATASET.orgUnits;
export const SEED_COMPETENCIES: CompetencyModel[] = FLAMINGO_DATASET.competencies;
export const SEED_VERSIONS: CompetencyVersionModel[] = FLAMINGO_DATASET.versions;
export const SEED_JOB_FAMILIES: JobFamilyModel[] = FLAMINGO_DATASET.jobFamilies;
export const SEED_INTERVIEW_QUESTIONS: InterviewQuestionModel[] = FLAMINGO_DATASET.interviewQuestions;
export const SEED_JOB_LEVELS: JobLevelModel[] = FLAMINGO_DATASET.jobLevels;
export const SEED_JOB_ROLES: JobRoleModel[] = FLAMINGO_DATASET.jobRoles;
export const SEED_GOVERNANCE_RULES: GovernanceRuleModel[] = FLAMINGO_DATASET.governanceRules;
export const SEED_DATA_WARNINGS: DataWarningModel[] = FLAMINGO_DATASET.dataWarnings;

export const SEED_AUDIT_LOGS: AuditLogModel[] = [
  {
    id: 'log-flam-1',
    action: 'PUBLISH',
    entityType: 'PROFICIENCY_SCALE',
    entityId: 'scale-fla-5',
    entityName: 'Thang thành thục Flamingo 5 mức (FLA-5)',
    actorId: 'usr-hr-lead',
    actorEmail: 'hannah.abbott@flamingo.vn',
    actorIp: '10.0.1.1',
    userAgent: 'Flamingo Internal Portal (Chrome 128)',
    oldValues: null,
    newValues: { code: 'FLA-5', levelCount: 5, status: 'ACTIVE' },
    diff: { scale: { old: 'KF_4LEVEL_STD', new: 'FLA-5' } },
    metadata: { governanceRule: 'QT01', approvedBy: 'Ban Tổng Giám đốc Tập đoàn' },
    status: 'SUCCESS',
    timestamp: new Date('2025-01-01T08:00:00Z'),
  },
  {
    id: 'log-flam-2',
    action: 'CREATE',
    entityType: 'COMPETENCY_DICTIONARY',
    entityId: 'dict-flam-57',
    entityName: 'Nạp Từ điển năng lực Flamingo (57 Năng lực, 14 Họ nghề, 34 Đơn vị)',
    actorId: 'usr-ceo',
    actorEmail: 'alex.morgan@flamingo.vn',
    actorIp: '10.0.1.2',
    userAgent: 'Flamingo System Orchestrator',
    oldValues: null,
    newValues: { countOrgUnits: 34, countCompetencies: 57, countJobFamilies: 14, countJobRoles: 26 },
    diff: null,
    metadata: { orgChartVersion: 'CCTC_PA3 cập nhật' },
    status: 'SUCCESS',
    timestamp: new Date('2025-01-01T08:30:00Z'),
  },
  {
    id: 'log-flam-3',
    action: 'ROLE_ASSIGNED',
    entityType: 'USER_ROLE',
    entityId: 'ur-4',
    entityName: 'Hannah Abbott ➔ Competency Framework Lead (Ban Nhân sự & QTHC)',
    actorId: 'usr-ceo',
    actorEmail: 'alex.morgan@flamingo.vn',
    actorIp: '10.0.1.2',
    userAgent: 'Flamingo RBAC Guard',
    oldValues: null,
    newValues: { userId: 'usr-hr-lead', roleId: 'role-hr', isPrimary: true },
    diff: null,
    metadata: { roleCode: 'HR_LEAD', scope: 'org-b11' },
    status: 'SUCCESS',
    timestamp: new Date('2025-01-01T09:00:00Z'),
  },
];
