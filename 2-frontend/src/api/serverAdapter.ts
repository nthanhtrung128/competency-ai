/**
 * Chuyển dữ liệu từ GET /api/bootstrap (máy chủ) sang đúng kiểu dữ liệu giao diện đang dùng.
 *
 * Mã định danh phía giao diện giữ NGUYÊN quy ước của bản Demo (comp-fu03, org-b01, cat-fun…)
 * để mọi màn hình chạy y hệt. Mã thật của máy chủ (uuid) được giữ trong `serverIds` để gọi API.
 */
import {
  CompetencyCategoryModel,
  CompetencyModel,
  CompetencyVersionModel,
  InterviewQuestionModel,
  JobFamilyModel,
  JobLevelModel,
  JobRoleModel,
  OrgUnitModel,
  ProficiencyScaleModel,
  AuditLogModel,
  AuditAction,
} from '../../packages/db/src/types';
import { consolidateRequirements, RawRequirement } from '../data/requirementMapping';

// ---------------------------------------------------------------- kiểu dữ liệu máy chủ

type Indicator = { level: number; indicator: string };
type ServerLevels = {
  behavioralIndicators?: Indicator[];
  positiveIndicators?: string[];
  negativeIndicators?: string[];
  overuseWarning?: string | null;
  interviewQuestions?: Array<{ question: string; isCounterEvidence: boolean }>;
  referenceLevel?: number | null;
  completeness?: string;
  changeNote?: string;
};

export interface BootstrapPayload {
  serverTime: string;
  me: {
    id: string; email: string; name: string; roles: string[]; permissions: string[]; scope: 'TOAN_BO' | string[];
    employeeId?: string | null; mustChangePassword?: boolean;
  };
  proficiencyScale: {
    id: string; code: string; name: string; levelCount: number;
    levels: Array<{ levelNumber: number; label: string; description: string | null }>;
  } | null;
  categories: Array<{ id: string; code: string; name: string; scored: boolean; note: string | null; displayOrder: number }>;
  competencies: Array<{
    id: string; code: string; name: string; nameEn: string | null; definition: string | null;
    derivedFrom: string | null; domainName: string | null; owningUnit: string | null; hasOwner: boolean;
    dataGap: string | null; categoryCode: string; scaleId: string | null; currentVersionId: string | null;
    versions: Array<{
      id: string; version: number; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; title: string; definition: string;
      levels: ServerLevels | null; publishedAt: string | null; archivedAt: string | null; createdAt: string;
    }>;
  }>;
  orgUnits: Array<{
    id: string; code: string; name: string; nameEn: string | null; type: string; tier: number;
    parentId: string | null; parentCode: string | null; note: string | null; headDisplay: string; employeeCount: number;
  }>;
  jobFamilies: Array<{
    id: string; code: string; name: string; jobFunction: string | null; careerStream: string | null;
    description: string | null; valueStages: string | null;
  }>;
  jobLevels: Array<{
    code: string; name: string; grade: string | null; careerLevel: string | null; contribution: string | null;
    scope: string | null; requiredBand: { core?: string; leadership?: string; functional?: string } | null;
  }>;
  jobRoles: Array<{
    code: string; title: string; titleEn: string | null; careerStream: string | null;
    jobFamily: string | null; jobLevel: string | null;
    requirements: Array<{
      id: string; sourceLabel: string; competency: string | null; requiredLevel: number;
      mappingStatus: 'APPROVED' | 'PROPOSED' | 'UNMAPPED'; mappingConfidence: string | null; note: string | null;
    }>;
  }>;
}

export interface ServerIdMaps {
  competency: Record<string, string>; // feId → uuid
  version: Record<string, string>;
  orgUnit: Record<string, string>;
  orgTier: Record<string, number>; // feId → tier máy chủ
}

export interface ServerDataset {
  proficiencyScales: ProficiencyScaleModel[];
  categories: CompetencyCategoryModel[];
  orgUnits: OrgUnitModel[];
  competencies: CompetencyModel[];
  versions: CompetencyVersionModel[];
  interviewQuestions: InterviewQuestionModel[];
  jobFamilies: JobFamilyModel[];
  jobLevels: JobLevelModel[];
  jobRoles: JobRoleModel[];
  serverIds: ServerIdMaps;
}

// ---------------------------------------------------------------- tiện ích

const slug = (code: string) => code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
export const feCompId = (code: string) => `comp-${slug(code)}`;
export const feVersionId = (code: string, v: number) => `ver-${slug(code)}-v${v}`;
export const feOrgId = (code: string) => `org-${slug(code)}`;
const d = (s: string | null | undefined) => (s ? new Date(s) : new Date());

/** Mức chưa có chỉ báo → ghi rõ là chưa có, KHÔNG điền câu chữ chung chung. */
const missing = (lv: number) => `[Mức ${lv} chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]`;
const isMissing = (t?: string) => !t || /^\[Mức \d chưa có chỉ báo/i.test(t);

/** Chuyển 5 ô mô tả mức của giao diện → JSON levels gửi lên máy chủ (bỏ các ô giữ chỗ). */
export function anchorsToIndicators(v: Partial<CompetencyVersionModel>): Indicator[] {
  const out: Indicator[] = [];
  const all = [v.level1Anchor, v.level2Anchor, v.level3Anchor, v.level4Anchor, v.level5Anchor];
  all.forEach((t, i) => {
    if (!isMissing(t)) out.push({ level: i + 1, indicator: String(t).trim() });
  });
  return out;
}

const ORG_TYPE: Record<string, OrgUnitModel['type']> = {
  GROUP: 'COMPANY', GOVERNANCE: 'COMPANY', SUBSIDIARY: 'COMPANY',
  BLOCK: 'DIVISION', EXECUTIVE: 'DIVISION',
  DEPARTMENT: 'DEPARTMENT', DIVISION: 'TEAM', TEAM: 'TEAM', SUPPORT: 'UNIT',
};

// ---------------------------------------------------------------- ánh xạ

export function mapBootstrap(p: BootstrapPayload): ServerDataset {
  const ids: ServerIdMaps = { competency: {}, version: {}, orgUnit: {}, orgTier: {} };

  // 1. Thang thành thục (gốc + 5 mức con) — cùng cấu trúc bản Demo
  const scales: ProficiencyScaleModel[] = [];
  if (p.proficiencyScale) {
    const s = p.proficiencyScale;
    const rootId = `scale-${slug(s.code)}`;
    scales.push({
      id: rootId, code: s.code, name: s.name, description: `${s.name} — ${s.levelCount} mức (nguồn: máy chủ)`,
      type: 'STANDARD', level: null, label: null, scoreMin: 1, scoreMax: s.levelCount, behavioralAnchor: null,
      parentId: null, isDefault: true, isActive: true, displayOrder: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    for (const l of s.levels) {
      scales.push({
        id: `scale-fla-l${l.levelNumber}`, code: `FLA_L${l.levelNumber}`, name: `Mức ${l.levelNumber}: ${l.label}`,
        description: l.description, type: 'LEVEL', level: l.levelNumber, label: l.label,
        scoreMin: l.levelNumber, scoreMax: l.levelNumber === s.levelCount ? l.levelNumber : l.levelNumber + 0.99,
        behavioralAnchor: l.description, parentId: rootId, isDefault: false, isActive: true,
        displayOrder: l.levelNumber, createdAt: new Date(), updatedAt: new Date(),
      });
    }
  }
  const rootScaleId = scales[0]?.id ?? null;

  // 2. Nhóm năng lực
  const categories: CompetencyCategoryModel[] = p.categories.map((c) => ({
    id: `cat-${slug(c.code)}`, code: c.code, name: c.name, description: c.note, scored: c.scored,
    displayOrder: c.displayOrder, createdAt: new Date(), updatedAt: new Date(),
  }));

  // 3. Đơn vị
  const byServerId = new Map(p.orgUnits.map((u) => [u.id, u]));
  const orgUnits: OrgUnitModel[] = [];
  const pathOf = (u: BootstrapPayload['orgUnits'][number]): string => {
    const parent = u.parentId ? byServerId.get(u.parentId) : undefined;
    return parent ? `${pathOf(parent)}/${u.code}` : `/${u.code}`;
  };
  for (const u of p.orgUnits) {
    const id = feOrgId(u.code);
    ids.orgUnit[id] = u.id;
    ids.orgTier[id] = u.tier;
    // Đơn vị cha nằm ngoài phạm vi được xem → hiển thị như gốc của cây con
    const parentVisible = u.parentId ? byServerId.has(u.parentId) : false;
    orgUnits.push({
      id, code: u.code, name: u.name,
      description: [u.nameEn, u.note].filter(Boolean).join(' — ') || null,
      type: ORG_TYPE[u.type] ?? 'DEPARTMENT',
      parentId: parentVisible && u.parentCode ? feOrgId(u.parentCode) : null,
      level: u.tier + 1, path: pathOf(u), isActive: true,
      metadata: {
        rawTier: u.tier, unitType: u.type, note: u.note, isGap: /\[GAP\]/.test(u.note ?? ''),
        headDisplay: u.headDisplay, employeeCount: u.employeeCount, source: 'SERVER',
      },
      createdAt: new Date(), updatedAt: new Date(),
    });
  }

  // 4. Năng lực + phiên bản
  const competencies: CompetencyModel[] = [];
  const versions: CompetencyVersionModel[] = [];
  const interviewQuestions: InterviewQuestionModel[] = [];

  for (const c of p.competencies) {
    const compId = feCompId(c.code);
    ids.competency[compId] = c.id;
    const current = c.versions.find((v) => v.id === c.currentVersionId) ?? c.versions.find((v) => v.status === 'PUBLISHED');
    const curLevels = (current?.levels ?? {}) as ServerLevels;
    const qs = (curLevels.interviewQuestions ?? []).map((q) => ({ competencyCode: c.code, ...q }));
    interviewQuestions.push(...qs);

    const isScored = !!c.scaleId;
    competencies.push({
      id: compId, code: c.code, name: c.name, description: c.definition ?? c.nameEn ?? '',
      categoryId: `cat-${slug(c.categoryCode)}`, scaleId: isScored ? rootScaleId : null,
      currentVersionId: current ? feVersionId(c.code, current.version) : null,
      domainName: c.domainName, owningUnit: c.owningUnit, hasOwner: c.hasOwner, dataGap: c.dataGap,
      referenceLevel: curLevels.referenceLevel ?? null, scored: isScored,
      positiveIndicators: curLevels.positiveIndicators ?? [], negativeIndicators: curLevels.negativeIndicators ?? [],
      overuseWarning: curLevels.overuseWarning ?? null, derivedFrom: c.derivedFrom, interviewQuestions: qs,
      isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });

    for (const v of c.versions) {
      const vid = feVersionId(c.code, v.version);
      ids.version[vid] = v.id;
      const ind = new Map(((v.levels ?? {}) as ServerLevels).behavioralIndicators?.map((b) => [b.level, b.indicator]) ?? []);
      versions.push({
        id: vid, competencyId: compId, scaleId: isScored ? rootScaleId : null, version: v.version, status: v.status,
        title: v.title, definition: v.definition,
        level1Anchor: ind.get(1) || missing(1), level2Anchor: ind.get(2) || missing(2),
        level3Anchor: ind.get(3) || missing(3), level4Anchor: ind.get(4) || missing(4),
        level5Anchor: ind.get(5) || missing(5),
        changeLog: ((v.levels ?? {}) as ServerLevels).changeNote ?? null,
        publishedAt: v.publishedAt ? d(v.publishedAt) : null, archivedAt: v.archivedAt ? d(v.archivedAt) : null,
        effectiveFrom: v.publishedAt ? d(v.publishedAt) : null,
        createdAt: d(v.createdAt), updatedAt: d(v.createdAt),
      });
    }
  }

  // 5. Job Architecture
  const jobFamilies: JobFamilyModel[] = p.jobFamilies.map((f) => ({
    id: `jf-${slug(f.code)}`, code: f.code, name: f.name, description: f.description,
    jobFunction: f.jobFunction ?? undefined, careerStream: f.careerStream ?? undefined,
    valueStages: f.valueStages ?? undefined, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  }));
  const jobLevels: JobLevelModel[] = p.jobLevels.map((l) => ({
    code: l.code, nameVi: l.name, grade: l.grade ?? '', careerLevel: l.careerLevel ?? '',
    contribution: l.contribution ?? '', scope: l.scope ?? '',
    requiredBand: {
      core: l.requiredBand?.core ?? '', leadership: l.requiredBand?.leadership ?? '', functional: l.requiredBand?.functional ?? '',
    },
  }));
  const jobRoles: JobRoleModel[] = p.jobRoles.map((r) => ({
    code: r.code, titleVi: r.title, titleEn: r.titleEn ?? undefined,
    jobFamily: r.jobFamily ?? '', jobLevel: r.jobLevel ?? '', careerStream: r.careerStream ?? '',
    requirements: consolidateRequirements(
      r.requirements.map<RawRequirement>((q) => ({
        sourceLabel: q.sourceLabel, competency: q.competency, requiredLevel: q.requiredLevel,
        mappingStatus: q.mappingStatus, mappingConfidence: q.mappingConfidence, note: q.note,
      })),
    ),
  }));

  return { proficiencyScales: scales, categories, orgUnits, competencies, versions, interviewQuestions, jobFamilies, jobLevels, jobRoles, serverIds: ids };
}

// ---------------------------------------------------------------- nhật ký

const AUDIT_ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PUBLISH', 'ARCHIVE', 'IMPORT', 'EXPORT'];

export function mapAuditLogs(
  logs: Array<{
    id: string; action: string; entityType: string; entityId: string; entityName: string | null;
    actorId: string | null; actorEmail: string | null; oldValues: unknown; newValues: unknown; timestamp: string;
  }>,
): AuditLogModel[] {
  return logs.map((l) => ({
    id: l.id,
    action: (AUDIT_ACTIONS.includes(l.action as AuditAction) ? l.action : 'UPDATE') as AuditAction,
    entityType: l.entityType, entityId: l.entityId, entityName: l.entityName,
    actorId: l.actorId, actorEmail: l.actorEmail,
    oldValues: (l.oldValues ?? null) as Record<string, unknown> | null,
    newValues: (l.newValues ?? null) as Record<string, unknown> | null,
    status: 'SUCCESS', timestamp: new Date(l.timestamp),
  }));
}
