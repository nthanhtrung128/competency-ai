import React, { useState } from 'react';
import { Database, Shield, Building2, Users, BookOpen, Layers, Briefcase, Key, History, GitFork, Lock, Sliders } from 'lucide-react';

interface ModelField {
  name: string;
  type: string;
  isId?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;
  isRelation?: boolean;
  relationDetails?: string;
  description: string;
}

interface ModelDefinition {
  name: string;
  icon: React.ElementType;
  description: string;
  tableMap: string;
  fields: ModelField[];
}

const MODELS: ModelDefinition[] = [
  {
    name: 'ProficiencyScale',
    icon: Sliders,
    tableMap: 'proficiency_scales',
    description: 'Scale framework supporting FLA-5 5-level standards, custom rating steps, and recursive self-referencing parent/child scale tiers.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key identity' },
      { name: 'code', type: 'String', isUnique: true, description: 'Unique scale code (e.g. KF_4LEVEL_STD, TECH_ARCH_SCALE)' },
      { name: 'name', type: 'String', description: 'Scale framework title or level name' },
      { name: 'description', type: 'String?', isNullable: true, description: 'Scope and behavioral overview' },
      { name: 'type', type: 'ScaleType (Enum)', description: 'STANDARD | CUSTOM | LEVEL | BENCHMARK' },
      { name: 'level', type: 'Int?', isNullable: true, description: 'Numeric level tier: 1, 2, 3, 4' },
      { name: 'label', type: 'String?', isNullable: true, description: 'FLA-5 label (e.g. Basic, Proficient, Advanced, Expert)' },
      { name: 'scoreMin', type: 'Float?', isNullable: true, description: 'Minimum calibration score threshold' },
      { name: 'scoreMax', type: 'Float?', isNullable: true, description: 'Maximum calibration score threshold' },
      { name: 'behavioralAnchor', type: 'Text?', isNullable: true, description: 'Observable standard behavioral definition' },
      { name: 'parentId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'Self-referencing ProficiencyScale.id with onDelete: Restrict', description: 'Parent scale or standard framework' },
      { name: 'children', type: 'ProficiencyScale[]', isRelation: true, description: 'Child level nodes or custom scale derivations' },
      { name: 'competencies', type: 'Competency[]', isRelation: true, description: 'Competencies using this scale' },
      { name: 'competencyVersions', type: 'CompetencyVersion[]', isRelation: true, description: 'Version snapshots bound to this scale' },
      { name: 'isDefault', type: 'Boolean', description: 'Flag marking standard global scale default' },
      { name: 'isActive', type: 'Boolean', description: 'Operational status flag' },
      { name: 'displayOrder', type: 'Int', description: 'Display and progression sorting order' },
    ]
  },
  {
    name: 'UserScope',
    icon: Lock,
    tableMap: 'user_scopes',
    description: 'Row-Level Security (RLS) policy model granting users scoped access to specific OrgUnits with recursive subtree inheritance.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key identity' },
      { name: 'userId', type: 'String', isRelation: true, relationDetails: 'User.id with onDelete: Cascade', description: 'Foreign key to User' },
      { name: 'orgUnitId', type: 'String', isRelation: true, relationDetails: 'OrgUnit.id with onDelete: Cascade', description: 'Target scoped organizational unit foreign key' },
      { name: 'accessLevel', type: 'ScopeAccessLevel (Enum)', description: 'READ | WRITE | APPROVE | ADMIN' },
      { name: 'includeSubtree', type: 'Boolean', description: 'When true, recursively cascades access down the OrgUnit hierarchy tree' },
      { name: 'grantedAt', type: 'DateTime', description: 'Timestamp when scope was assigned' },
      { name: 'grantedById', type: 'String?', isNullable: true, description: 'User ID of the granting administrator' },
      { name: 'expiresAt', type: 'DateTime?', isNullable: true, description: 'Optional delegation expiration date' },
      { name: 'createdAt', type: 'DateTime', description: 'Creation timestamp' },
      { name: 'updatedAt', type: 'DateTime', description: 'Last update timestamp' },
    ]
  },
  {
    name: 'User',
    icon: Users,
    tableMap: 'users',
    description: 'System identity holding account credentials, primary & multi-role authorization, row-level scopes, and org unit membership.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key identity' },
      { name: 'email', type: 'String', isUnique: true, description: 'Unique user email address' },
      { name: 'name', type: 'String', description: 'Full legal/display name' },
      { name: 'avatarUrl', type: 'String?', isNullable: true, description: 'Profile avatar image URL' },
      { name: 'status', type: 'UserStatus (Enum)', description: 'ACTIVE | INACTIVE | SUSPENDED' },
      { name: 'primaryRoleId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'Role.id with onDelete: SetNull', description: 'Fast RBAC primary role resolution' },
      { name: 'userRoles', type: 'UserRole[]', isRelation: true, description: 'Multi-role assignments via join table' },
      { name: 'scopes', type: 'UserScope[]', isRelation: true, description: 'Row-Level Security OrgUnit scopes assigned to this user' },
      { name: 'orgUnitId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'OrgUnit.id with onDelete: SetNull', description: 'Assigned home organizational unit' },
      { name: 'managedOrgUnits', type: 'OrgUnit[]', isRelation: true, description: 'Units where user is designated manager' },
      { name: 'jobFamilyId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'JobFamily.id with onDelete: SetNull', description: 'Assigned job family discipline' },
      { name: 'auditLogsInitiated', type: 'AuditLog[]', isRelation: true, description: 'Audit trail events initiated by this user' },
    ]
  },
  {
    name: 'OrgUnit',
    icon: Building2,
    tableMap: 'org_units',
    description: 'Hierarchical organizational unit supporting multi-level divisions, self-referencing tree links, and row-level security user scopes.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key identity' },
      { name: 'code', type: 'String', isUnique: true, description: 'Unique enterprise identifier (e.g. DIV-TECH)' },
      { name: 'name', type: 'String', description: 'Display name of unit' },
      { name: 'type', type: 'OrgUnitType (Enum)', description: 'COMPANY | DIVISION | DEPARTMENT | TEAM | UNIT' },
      { name: 'parentId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'Self-referencing OrgUnit.id with onDelete: Restrict', description: 'Foreign key to parent unit' },
      { name: 'children', type: 'OrgUnit[]', isRelation: true, description: 'Subordinate organizational child units' },
      { name: 'managerId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'User.id with onDelete: SetNull', description: 'Unit leader / manager foreign key' },
      { name: 'members', type: 'User[]', isRelation: true, description: 'Staff members assigned to this unit' },
      { name: 'userScopes', type: 'UserScope[]', isRelation: true, description: 'Row-Level Security scopes granting access to this unit' },
      { name: 'level', type: 'Int', description: 'Depth level in hierarchy tree (1=Root)' },
      { name: 'path', type: 'String?', isNullable: true, description: 'Materialized path for rapid branch querying' },
      { name: 'isActive', type: 'Boolean', description: 'Operational status flag' },
    ]
  },
  {
    name: 'Role',
    icon: Shield,
    tableMap: 'roles',
    description: 'Role entity granting modular capabilities, multi-user assignment, and system role preservation.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'code', type: 'String', isUnique: true, description: 'Unique role code (e.g. SUPER_ADMIN, HR_LEAD)' },
      { name: 'name', type: 'String', description: 'Role display title' },
      { name: 'description', type: 'String?', isNullable: true, description: 'Role scope and responsibilities' },
      { name: 'isSystem', type: 'Boolean', description: 'Protects core system roles from deletion' },
      { name: 'rolePermissions', type: 'RolePermission[]', isRelation: true, description: 'Granular permissions granted to this role' },
      { name: 'userRoles', type: 'UserRole[]', isRelation: true, description: 'Users bearing this role' },
      { name: 'primaryUsers', type: 'User[]', isRelation: true, description: 'Users having this as primary role' },
    ]
  },
  {
    name: 'Permission',
    icon: Key,
    tableMap: 'permissions',
    description: 'Granular authorization token specifying permitted actions on system modules.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'code', type: 'String', isUnique: true, description: 'Unique permission code (e.g. users:create, org:manage)' },
      { name: 'name', type: 'String', description: 'Human readable permission name' },
      { name: 'description', type: 'String?', isNullable: true, description: 'Scope and authorization rules' },
      { name: 'module', type: 'String', description: 'Module cluster (USERS, ROLES, ORG_UNITS, COMPETENCIES, AUDIT)' },
      { name: 'action', type: 'String', description: 'Action verb (CREATE, READ, UPDATE, DELETE, PUBLISH, MANAGE)' },
      { name: 'rolePermissions', type: 'RolePermission[]', isRelation: true, description: 'Roles granted this permission' },
    ]
  },
  {
    name: 'RolePermission',
    icon: GitFork,
    tableMap: 'role_permissions',
    description: 'Explicit join model connecting Roles to Permissions with composite uniqueness @@unique([roleId, permissionId]).',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'roleId', type: 'String', isRelation: true, relationDetails: 'Role.id with onDelete: Cascade', description: 'Foreign key to Role' },
      { name: 'permissionId', type: 'String', isRelation: true, relationDetails: 'Permission.id with onDelete: Cascade', description: 'Foreign key to Permission' },
      { name: 'grantedAt', type: 'DateTime', description: 'Timestamp when permission was granted' },
      { name: 'grantedById', type: 'String?', isNullable: true, description: 'Actor ID who authorized grant' },
    ]
  },
  {
    name: 'UserRole',
    icon: Users,
    tableMap: 'user_roles',
    description: 'Explicit join model enabling Multi-Role assignment with isPrimary designation.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'userId', type: 'String', isRelation: true, relationDetails: 'User.id with onDelete: Cascade', description: 'Foreign key to User' },
      { name: 'roleId', type: 'String', isRelation: true, relationDetails: 'Role.id with onDelete: Cascade', description: 'Foreign key to Role' },
      { name: 'isPrimary', type: 'Boolean', description: 'Flag distinguishing primary role from secondary roles' },
      { name: 'assignedAt', type: 'DateTime', description: 'Assignment timestamp' },
      { name: 'assignedById', type: 'String?', isNullable: true, description: 'Administrator who assigned the role' },
    ]
  },
  {
    name: 'AuditLog',
    icon: History,
    tableMap: 'audit_logs',
    description: 'Tamper-evident audit trail capturing security mutations, role modifications, and entity state diffs.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'action', type: 'AuditAction (Enum)', description: 'CREATE | UPDATE | DELETE | ROLE_ASSIGNED | SCOPE_GRANTED | SCALE_CREATED ...' },
      { name: 'entityType', type: 'String', description: 'Target entity classification (USER, ROLE, ORG_UNIT, PROFICIENCY_SCALE, etc.)' },
      { name: 'entityId', type: 'String', description: 'Unique target entity ID' },
      { name: 'entityName', type: 'String?', isNullable: true, description: 'Human-readable snapshot title' },
      { name: 'actorId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'User.id with onDelete: SetNull', description: 'Actor user foreign key' },
      { name: 'actorEmail', type: 'String?', isNullable: true, description: 'Immutable actor email preservation' },
      { name: 'actorIp', type: 'String?', isNullable: true, description: 'Client IP address' },
      { name: 'oldValues', type: 'Json?', isNullable: true, description: 'Pre-mutation payload snapshot' },
      { name: 'newValues', type: 'Json?', isNullable: true, description: 'Post-mutation payload snapshot' },
      { name: 'diff', type: 'Json?', isNullable: true, description: 'Field-level mutation delta' },
      { name: 'status', type: 'LogStatus (Enum)', description: 'SUCCESS | FAILURE | WARNING' },
      { name: 'timestamp', type: 'DateTime', description: 'Immutable event timestamp' },
    ]
  },
  {
    name: 'Competency',
    icon: BookOpen,
    tableMap: 'competencies',
    description: 'Core skill or behavioral competence standard linking to versioned specifications and FLA-5 scales.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'code', type: 'String', isUnique: true, description: 'Standardized competence identifier (e.g. ENG-ARCH-01)' },
      { name: 'name', type: 'String', description: 'Competence title' },
      { name: 'categoryId', type: 'String', isRelation: true, relationDetails: 'CompetencyCategory.id with onDelete: Restrict', description: 'Foreign key to parent category' },
      { name: 'scaleId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'ProficiencyScale.id with onDelete: SetNull', description: 'Default linked proficiency scale (e.g. FLA-5 5-Level)' },
      { name: 'jobFamilies', type: 'JobFamily[]', isRelation: true, description: 'Associated job families' },
      { name: 'versions', type: 'CompetencyVersion[]', isRelation: true, description: 'Historical & active version snapshots' },
      { name: 'currentVersionId', type: 'String?', isNullable: true, description: 'Active published version reference' },
    ]
  },
  {
    name: 'CompetencyVersion',
    icon: Database,
    tableMap: 'competency_versions',
    description: 'Immutable version snapshot of a competency containing multi-level behavioral indicators and criteria.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'competencyId', type: 'String', isRelation: true, relationDetails: 'Competency.id with onDelete: Cascade', description: 'Foreign key to parent competency' },
      { name: 'scaleId', type: 'String?', isNullable: true, isRelation: true, relationDetails: 'ProficiencyScale.id with onDelete: SetNull', description: 'Associated proficiency scale snapshot' },
      { name: 'version', type: 'Int', description: 'Sequential version number (1, 2, 3...)' },
      { name: 'status', type: 'VersionStatus (Enum)', description: 'DRAFT | PUBLISHED | ARCHIVED | DEPRECATED' },
      { name: 'title', type: 'String', description: 'Versioned title string' },
      { name: 'definition', type: 'Text', description: 'In-depth competency definition' },
      { name: 'levels', type: 'Json (Array)', description: 'Array of proficiency levels (FLA-5 1..5) with behavioral indicators' },
      { name: 'changeLog', type: 'Text?', isNullable: true, description: 'Release notes or change summary' },
      { name: 'effectiveDate', type: 'DateTime?', isNullable: true, description: 'Valid-from activation timestamp' },
    ]
  },
  {
    name: 'CompetencyCategory',
    icon: Layers,
    tableMap: 'competency_categories',
    description: 'Top-level thematic grouping for organizational competencies.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'code', type: 'String', isUnique: true, description: 'Category code (e.g. CORE_VAL, TECH_EXP)' },
      { name: 'name', type: 'String', description: 'Category name' },
      { name: 'displayOrder', type: 'Int', description: 'Sorting order for assessment views' },
      { name: 'competencies', type: 'Competency[]', isRelation: true, description: 'Child competencies in this category' },
    ]
  },
  {
    name: 'JobFamily',
    icon: Briefcase,
    tableMap: 'job_families',
    description: 'Professional discipline cluster linking job roles with requisite competency frameworks.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, description: 'Primary key' },
      { name: 'code', type: 'String', isUnique: true, description: 'Family code (e.g. ENG, PROD, HR_OPS)' },
      { name: 'name', type: 'String', description: 'Family display name' },
      { name: 'users', type: 'User[]', isRelation: true, description: 'Members classified under this job family' },
      { name: 'competencies', type: 'Competency[]', isRelation: true, description: 'Competencies assigned to this job family' },
    ]
  }
];

export const ModelExplorer: React.FC = () => {
  const [activeModel, setActiveModel] = useState<ModelDefinition>(MODELS[0]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Model Selection Tabs */}
      <div id="model-nav-panel" className="lg:col-span-4 bg-slate-900/40 rounded-xl border border-slate-800 p-3 space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Extended Prisma Models ({MODELS.length})
        </div>
        {MODELS.map((model) => {
          const Icon = model.icon;
          const isSelected = activeModel.name === model.name;
          return (
            <button
              key={model.name}
              id={`model-tab-${model.name.toLowerCase()}`}
              onClick={() => setActiveModel(model)}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition border ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500/40 text-white shadow-sm'
                  : 'hover:bg-slate-900/80 border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{model.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">@@map("{model.tableMap}")</div>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                {model.fields.length} cols
              </span>
            </button>
          );
        })}
      </div>

      {/* Model Field Table */}
      <div id="model-detail-panel" className="lg:col-span-8 bg-slate-900/40 rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <activeModel.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{activeModel.name}</h3>
                <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  table: {activeModel.tableMap}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeModel.description}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Field</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Attributes &amp; Constraints</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {activeModel.fields.map((field) => (
                <tr key={field.name} className="hover:bg-slate-900/50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-200">
                    {field.name}
                  </td>
                  <td className="py-2.5 px-3 text-indigo-300">
                    {field.type}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <div className="flex flex-wrap gap-1">
                      {field.isId && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                          @id (PK)
                        </span>
                      )}
                      {field.isUnique && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-mono">
                          @unique
                        </span>
                      )}
                      {field.isNullable && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                          nullable
                        </span>
                      )}
                      {field.isRelation && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                          @relation
                        </span>
                      )}
                    </div>
                    {field.relationDetails && (
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {field.relationDetails}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-400">
                    {field.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
