/**
 * Core Type Definitions for Competency & Organizational Architecture System
 * Includes RBAC, Row-Level Security (UserScope), ProficiencyScale (Flamingo FLA-5, 5 mức), and AuditLog tracking.
 */

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type OrgUnitType = 'COMPANY' | 'DIVISION' | 'DEPARTMENT' | 'TEAM' | 'UNIT';

export type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DEPRECATED';

export type ScopeAccessLevel = 'READ' | 'WRITE' | 'APPROVE' | 'ADMIN';

export type ScaleType = 'STANDARD' | 'CUSTOM' | 'LEVEL' | 'BENCHMARK';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'SCOPE_GRANTED'
  | 'SCOPE_REVOKED'
  | 'SCALE_CREATED'
  | 'SCALE_UPDATED'
  | 'STATUS_CHANGE'
  | 'PUBLISH'
  | 'ARCHIVE'
  | 'EVALUATE'
  | 'CALIBRATE'
  | 'IMPORT'
  | 'RESTORE'
  | 'SYNC'
  | 'EXPORT';

export type LogStatus = 'SUCCESS' | 'FAILURE' | 'WARNING';

export interface PermissionModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  module: string;
  action: string;
  rolePermissions?: RolePermissionModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissionModel {
  id: string;
  roleId: string;
  role?: RoleModel;
  permissionId: string;
  permission?: PermissionModel;
  grantedAt: Date;
  grantedById?: string | null;
}

export interface UserRoleModel {
  id: string;
  userId: string;
  user?: UserModel;
  roleId: string;
  role?: RoleModel;
  isPrimary: boolean;
  assignedAt: Date;
  assignedById?: string | null;
}

export interface UserScopeModel {
  id: string;
  userId: string;
  user?: UserModel;
  orgUnitId: string;
  orgUnit?: OrgUnitModel;
  accessLevel: ScopeAccessLevel;
  includeSubtree: boolean;
  grantedAt?: Date;
  grantedById?: string | null;
  grantedBy?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  rolePermissions?: RolePermissionModel[];
  userRoles?: UserRoleModel[];
  primaryUsers?: UserModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserModel {
  id: string;
  email: string;
  name: string;
  title?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  primaryRoleId?: string | null;
  primaryRole?: RoleModel | null;
  userRoles?: UserRoleModel[];
  scopes?: UserScopeModel[];
  orgUnitId?: string | null;
  orgUnit?: OrgUnitModel | null;
  managedOrgUnits?: OrgUnitModel[];
  jobFamilyId?: string | null;
  jobFamily?: JobFamilyModel | null;
  auditLogsInitiated?: AuditLogModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogModel {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  actorId?: string | null;
  actor?: UserModel | null;
  actorEmail?: string | null;
  actorIp?: string | null;
  userAgent?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  diff?: Record<string, { old: any; new: any }> | null;
  metadata?: Record<string, any> | null;
  status: LogStatus;
  failureReason?: string | null;
  timestamp: Date;
}

export interface BehavioralIndicator {
  id: string;
  description: string;
  exampleScenario?: string;
  observableAction: string;
}

export interface CompetencyLevel {
  levelNumber: number; // 1 (Nhận biết) .. 5 (Chuyên gia) — thang FLA-5
  name: string;
  description: string;
  scoreRange?: string;
  indicators: BehavioralIndicator[];
}

export interface ProficiencyScaleModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: ScaleType;
  level?: number | null;
  label?: string | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
  behavioralAnchor?: string | null;
  parentId?: string | null;
  parent?: ProficiencyScaleModel | null;
  children?: ProficiencyScaleModel[];
  competencies?: CompetencyModel[];
  competencyVersions?: CompetencyVersionModel[];
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgUnitModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: OrgUnitType;
  parentId?: string | null;
  parent?: OrgUnitModel | null;
  children?: OrgUnitModel[];
  managerId?: string | null;
  headUserId?: string | null;
  manager?: UserModel | null;
  members?: UserModel[];
  userScopes?: UserScopeModel[];
  level: number;
  path?: string | null;
  metadata?: Record<string, any> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobFamilyModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  jobFunction?: string;
  careerStream?: string;
  valueStages?: string;
  users?: UserModel[];
  competencies?: CompetencyModel[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetencyCategoryModel {
  id: string;
  code: string;
  name: string;
  type?: string | null;
  description?: string | null;
  framework?: string;
  role?: string;
  scored?: boolean;
  displayOrder: number;
  competencies?: CompetencyModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewQuestionModel {
  competencyCode: string;
  question: string;
  isCounterEvidence: boolean;
}

export interface JobLevelModel {
  code: string;
  nameVi: string;
  nameEn?: string;
  grade: string;
  careerLevel: string;
  contribution: string;
  scope: string;
  requiredBand: {
    core: string;
    leadership: string;
    functional: string;
  };
}

export interface JobRoleRequirement {
  /** Mã Từ điển (CO1, LE2, FU03…) — hoặc nhãn gốc Sổ tay nếu chưa đối chiếu được */
  competency: string;
  requiredLevel: number;
  /** Mã/nhãn gốc trong Sổ tay (VAL01, COR02, "Thẩm định đầu tư"…) — để truy vết */
  sourceCodes?: string[];
  /** APPROVED = HR đã duyệt · PROPOSED = đối chiếu theo tên, chờ duyệt · UNMAPPED = chưa có mã Từ điển */
  mappingStatus?: 'APPROVED' | 'PROPOSED' | 'UNMAPPED';
  mappingConfidence?: string | null;
}

export interface JobRoleModel {
  code: string;
  titleVi: string;
  titleEn?: string;
  jobFamily: string;
  jobLevel: string;
  careerStream: string;
  requirements: JobRoleRequirement[];
}

export interface GovernanceRuleModel {
  code: string;
  rule: string;
}

export interface DataWarningModel {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  area: string;
  issue: string;
  action: string;
}

export interface CompetencyModel {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryId: string;
  category?: CompetencyCategoryModel;
  scaleId?: string | null;
  proficiencyScaleId?: string | null;
  scale?: ProficiencyScaleModel | null;
  jobFamilies?: JobFamilyModel[];
  versions?: CompetencyVersionModel[];
  currentVersionId?: string | null;
  domain?: string | null;
  domainName?: string | null;
  owningUnit?: string | null;
  hasOwner?: boolean;
  dataGap?: string | null;
  referenceLevel?: number | null;
  scored?: boolean;
  positiveIndicators?: string[];
  negativeIndicators?: string[];
  overuseWarning?: string | null;
  derivedFrom?: string | null;
  interviewQuestions?: InterviewQuestionModel[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetencyVersionModel {
  id: string;
  competencyId: string;
  competency?: CompetencyModel;
  scaleId?: string | null;
  scale?: ProficiencyScaleModel | null;
  version: number;
  status: VersionStatus;
  title: string;
  definition: string;
  levels?: CompetencyLevel[];
  level1Anchor?: string;
  level2Anchor?: string;
  level3Anchor?: string;
  level4Anchor?: string;
  level5Anchor?: string;
  changeLog?: string | null;
  effectiveDate?: Date | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  authorId?: string | null;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

