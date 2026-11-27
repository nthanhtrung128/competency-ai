import type { AuditLogModel, CompetencyCategoryModel, CompetencyModel, CompetencyVersionModel, DataWarningModel, GovernanceRuleModel, InterviewQuestionModel, JobFamilyModel, JobLevelModel, JobRoleModel, OrgUnitModel, PermissionModel, ProficiencyScaleModel, RoleModel, RolePermissionModel, UserModel, UserRoleModel, UserScopeModel } from '../../packages/db/src/types';

// Hosted companies receive their initial data exclusively from the authenticated API.
export const SEED_PERMISSIONS: PermissionModel[] = [];
export const SEED_ROLES: RoleModel[] = [];
export const SEED_ROLE_PERMISSIONS: RolePermissionModel[] = [];
export const SEED_USERS: UserModel[] = [];
export const SEED_USER_ROLES: UserRoleModel[] = [];
export const SEED_USER_SCOPES: UserScopeModel[] = [];
export const SEED_PROFICIENCY_SCALES: ProficiencyScaleModel[] = [];
export const SEED_CATEGORIES: CompetencyCategoryModel[] = [];
export const SEED_ORG_UNITS: OrgUnitModel[] = [];
export const SEED_COMPETENCIES: CompetencyModel[] = [];
export const SEED_VERSIONS: CompetencyVersionModel[] = [];
export const SEED_JOB_FAMILIES: JobFamilyModel[] = [];
export const SEED_INTERVIEW_QUESTIONS: InterviewQuestionModel[] = [];
export const SEED_JOB_LEVELS: JobLevelModel[] = [];
export const SEED_JOB_ROLES: JobRoleModel[] = [];
export const SEED_GOVERNANCE_RULES: GovernanceRuleModel[] = [];
export const SEED_DATA_WARNINGS: DataWarningModel[] = [];
export const SEED_AUDIT_LOGS: AuditLogModel[] = [];
