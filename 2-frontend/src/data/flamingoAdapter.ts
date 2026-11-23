import rawData from './flamingo_seed_data.json';
import {
  ProficiencyScaleModel,
  CompetencyCategoryModel,
  OrgUnitModel,
  CompetencyModel,
  CompetencyVersionModel,
  InterviewQuestionModel,
  JobFamilyModel,
  JobLevelModel,
  JobRoleModel,
  GovernanceRuleModel,
  DataWarningModel,
} from '../../packages/db/src/types';
import { mapLegacyRequirement, consolidateRequirements } from './requirementMapping';

export interface FlamingoDataset {
  proficiencyScales: ProficiencyScaleModel[];
  categories: CompetencyCategoryModel[];
  orgUnits: OrgUnitModel[];
  competencies: CompetencyModel[];
  versions: CompetencyVersionModel[];
  interviewQuestions: InterviewQuestionModel[];
  jobFamilies: JobFamilyModel[];
  jobLevels: JobLevelModel[];
  jobRoles: JobRoleModel[];
  governanceRules: GovernanceRuleModel[];
  dataWarnings: DataWarningModel[];
  metadata: {
    source: string;
    orgChartVersion: string;
    counts: Record<string, number>;
    notForProduction: string;
  };
}

/**
 * Parses and maps flamingo_seed_data.json following the strict loading sequence:
 * 1. proficiencyScale (FLA-5)
 * 2. competencyCategories (VAL, COR, LEA, FUN, MET)
 * 3. orgUnits (sorted by tier ascending, materialized path computed)
 * 4. competencies & published versions (5 levels, hasOwner flags, dataGaps)
 * 5. interviewQuestions (36 questions with counter-evidence)
 * 6. jobFamilies (14 job families)
 * 7. jobLevels (6 tiers L1-L6)
 * 8. jobRoles (26 roles with mapped requirements)
 */
export function buildFlamingoDataset(): FlamingoDataset {
  // -------------------------------------------------------------
  // 1. Proficiency Scale (FLA-5 with 5 levels and dimensions)
  // -------------------------------------------------------------
  const rawScale = rawData.proficiencyScale;
  const rootScaleId = 'scale-fla-5';

  const rootScale: ProficiencyScaleModel = {
    id: rootScaleId,
    code: rawScale.code,
    name: rawScale.name.vi,
    description: `${rawScale.name.vi} (${rawScale.name.en}) - Thang đo 5 mức độ thành thục chuẩn hóa cho toàn Tập đoàn Flamingo.`,
    type: 'STANDARD',
    level: null,
    label: null,
    scoreMin: 1.0,
    scoreMax: 5.0,
    behavioralAnchor: 'Thang đo 5 chiều chuẩn: Độ phức tạp, Mức tự chủ, Phạm vi, Mức tác động, Tương tác.',
    parentId: null,
    isDefault: true,
    isActive: true,
    displayOrder: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const scaleLevels: ProficiencyScaleModel[] = rawScale.levels.map((lvl) => {
    const dim = rawScale.dimensions.find((d) => d.level === lvl.level);
    const dimDesc = dim
      ? ` | Độ phức tạp: ${dim.complexity}; Tự chủ: ${dim.autonomy}; Phạm vi: ${dim.scope}; Tác động: ${dim.impact}; Tương tác: ${dim.interaction}`
      : '';
    return {
      id: `scale-fla-l${lvl.level}`,
      code: `FLA_L${lvl.level}`,
      name: `Mức ${lvl.level}: ${lvl.label.vi} (${lvl.label.en})`,
      description: `${lvl.desc.vi}${dimDesc}`,
      type: 'LEVEL',
      level: lvl.level,
      label: lvl.label.vi,
      scoreMin: lvl.level,
      scoreMax: lvl.level === 5 ? 5.0 : lvl.level + 0.99,
      behavioralAnchor: lvl.desc.vi,
      parentId: rootScaleId,
      isDefault: false,
      isActive: true,
      displayOrder: lvl.level,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };
  });

  const allScales = [rootScale, ...scaleLevels];

  // -------------------------------------------------------------
  // 2. Competency Categories (VAL, COR, LEA, FUN, MET)
  // -------------------------------------------------------------
  const categories: CompetencyCategoryModel[] = rawData.competencyCategories.map((cat, idx) => ({
    id: `cat-${cat.code.toLowerCase()}`,
    code: cat.code,
    name: cat.name.vi,
    type: cat.role,
    description: cat.note,
    framework: cat.framework,
    role: cat.role,
    scored: cat.scored,
    displayOrder: idx + 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }));

  // -------------------------------------------------------------
  // 3. Org Units (sorted by tier ascending, compute materialized path)
  // -------------------------------------------------------------
  const rawUnitsSorted = [...rawData.orgUnits].sort((a, b) => a.tier - b.tier);

  const orgUnitsMap = new Map<string, OrgUnitModel>();
  const orgUnits: OrgUnitModel[] = [];

  for (const u of rawUnitsSorted) {
    const id = `org-${u.code.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
    const parentId = u.parent ? `org-${u.parent.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}` : null;
    const parentUnit = parentId ? orgUnitsMap.get(parentId) : null;
    const path = parentUnit ? `${parentUnit.path}/${u.code}` : `/${u.code}`;

    let type: OrgUnitModel['type'] = 'DEPARTMENT';
    if (u.unitType === 'GROUP' || u.unitType === 'GOVERNANCE') type = 'COMPANY';
    else if (u.unitType === 'BLOCK' || u.unitType === 'EXECUTIVE') type = 'DIVISION';
    else if (u.unitType === 'DIVISION') type = 'TEAM';
    else if (u.unitType === 'SUPPORT') type = 'UNIT';

    const unitModel: OrgUnitModel = {
      id,
      code: u.code,
      name: u.name.vi,
      description: u.name.en ? `${u.name.en}${(u as any).note ? ` — ${(u as any).note}` : ''}` : (u as any).note || null,
      type,
      parentId,
      level: u.tier + 1,
      path,
      isActive: true,
      metadata: {
        rawTier: u.tier,
        unitType: u.unitType,
        note: (u as any).note || null,
        isGap: (u as any).note?.includes('[GAP]') || false,
      },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    orgUnitsMap.set(id, unitModel);
    orgUnits.push(unitModel);
  }

  // -------------------------------------------------------------
  // 5. Interview Questions lookup map by competencyCode
  // -------------------------------------------------------------
  const interviewQuestions: InterviewQuestionModel[] = rawData.interviewQuestions.map((q) => ({
    competencyCode: q.competencyCode,
    question: q.question,
    isCounterEvidence: q.isCounterEvidence,
  }));

  const questionsByCompCode = new Map<string, InterviewQuestionModel[]>();
  for (const q of interviewQuestions) {
    const list = questionsByCompCode.get(q.competencyCode) || [];
    list.push(q);
    questionsByCompCode.set(q.competencyCode, list);
  }

  // -------------------------------------------------------------
  // 4. Competencies & Versions (5 levels, hasOwner flags, dataGaps)
  // -------------------------------------------------------------
  const competencies: CompetencyModel[] = [];
  const versions: CompetencyVersionModel[] = [];

  rawData.competencies.forEach((rawComp, idx) => {
    const compId = `comp-${rawComp.code.toLowerCase()}`;
    const versionId = `ver-${rawComp.code.toLowerCase()}-v1`;
    const categoryId = `cat-${rawComp.category.toLowerCase()}`;

    // Extract anchor strings for levels 1 to 5
    const indMap = new Map<number, string>();
    if (rawComp.behavioralIndicators) {
      for (const bi of rawComp.behavioralIndicators) {
        indMap.set(bi.level, bi.indicator);
      }
    }

    const dataGapNotice = (rawComp as any).dataGap || null;

    // Không tự điền câu chữ chung chung cho mức còn thiếu — ghi rõ là chưa có (nguyên tắc không bịa dữ liệu)
    const missing = (lv: number) => `[Mức ${lv} chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]`;
    const level1Anchor = indMap.get(1) || missing(1);
    const level2Anchor = indMap.get(2) || missing(2);
    const level3Anchor = indMap.get(3) || missing(3);
    const level4Anchor = indMap.get(4) || missing(4);
    const level5Anchor = indMap.get(5) || missing(5);

    const compQuestions = questionsByCompCode.get(rawComp.code) || [];

    const compModel: CompetencyModel = {
      id: compId,
      code: rawComp.code,
      name: rawComp.name.vi,
      description: (rawComp as any).definition?.vi || rawComp.name.en || '',
      categoryId,
      scaleId: rootScaleId,
      // Năng lực mới chưa duyệt (draft: true) → chưa có bản hiệu lực
      currentVersionId: (rawComp as any).draft ? null : versionId,
      domain: (rawComp as any).domain || null,
      domainName: (rawComp as any).domainName || null,
      owningUnit: (rawComp as any).owningUnit || null,
      hasOwner: (rawComp as any).hasOwner !== false,
      dataGap: dataGapNotice,
      referenceLevel: (rawComp as any).referenceLevel || (rawComp.category === 'COR' ? 3 : 4),
      scored: (rawComp as any).scored !== false,
      positiveIndicators: (rawComp as any).positiveIndicators || [],
      negativeIndicators: (rawComp as any).negativeIndicators || [],
      overuseWarning: (rawComp as any).overuseWarning || null,
      derivedFrom: (rawComp as any).derivedFrom || null,
      interviewQuestions: compQuestions,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    const versionModel: CompetencyVersionModel = {
      id: versionId,
      competencyId: compId,
      scaleId: rootScaleId,
      version: 1,
      status: (rawComp as any).draft ? 'DRAFT' : 'PUBLISHED',
      title: `${rawComp.name.vi} (Flamingo 5-Level Scale)`,
      definition: (rawComp as any).definition?.vi || `${rawComp.name.vi} - Tiêu chuẩn hành vi chuẩn hóa theo Thang thành thục Flamingo 5 mức.`,
      level1Anchor,
      level2Anchor,
      level3Anchor,
      level4Anchor,
      level5Anchor,
      changeLog: 'Chuẩn hóa theo Từ điển năng lực Flamingo 5 mức (FLA-5).',
      effectiveFrom: (rawComp as any).draft ? null : new Date('2025-01-01'),
      publishedAt: (rawComp as any).draft ? null : new Date('2025-01-01'),
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    competencies.push(compModel);
    versions.push(versionModel);
  });

  // -------------------------------------------------------------
  // 6. Job Families (14 Job Families)
  // -------------------------------------------------------------
  const jobFamilies: JobFamilyModel[] = rawData.jobFamilies.map((jf) => ({
    id: `jf-${jf.code.toLowerCase()}`,
    code: jf.code,
    name: jf.name.vi,
    description: jf.description,
    jobFunction: jf.jobFunction,
    careerStream: jf.careerStream,
    valueStages: jf.valueStages,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }));

  // -------------------------------------------------------------
  // 7. Job Levels (6 tiers L1-L6)
  // -------------------------------------------------------------
  const jobLevels: JobLevelModel[] = rawData.jobLevels.map((lvl) => ({
    code: lvl.code,
    nameVi: lvl.name.vi,
    grade: lvl.grade,
    careerLevel: lvl.careerLevel,
    contribution: lvl.contribution,
    scope: lvl.scope,
    requiredBand: lvl.requiredBand,
  }));

  // -------------------------------------------------------------
  // 8. Job Roles (26 roles R01 - R26)
  // -------------------------------------------------------------
  const jobRoles: JobRoleModel[] = rawData.jobRoles.map((r) => ({
    code: r.code,
    titleVi: r.title.vi,
    jobFamily: r.jobFamily,
    jobLevel: r.jobLevel,
    careerStream: r.careerStream,
    // Sổ tay dùng mã cũ (VAL/COR/LEA + tên chuyên môn) → đối chiếu sang mã Từ điển (đề xuất, chờ duyệt)
    requirements: consolidateRequirements(
      r.requirements.map((req) => mapLegacyRequirement(req.competency, req.requiredLevel)),
    ),
  }));

  // -------------------------------------------------------------
  // 9. Governance Rules (8 rules QT01-QT08)
  // -------------------------------------------------------------
  const governanceRules: GovernanceRuleModel[] = rawData.governanceRules.map((gr) => ({
    code: gr.code,
    rule: gr.rule,
  }));

  // -------------------------------------------------------------
  // 10. Data Warnings (6 warnings)
  // -------------------------------------------------------------
  const dataWarnings: DataWarningModel[] = rawData.dataWarnings.map((dw) => ({
    severity: dw.severity as 'HIGH' | 'MEDIUM' | 'LOW',
    area: dw.area,
    issue: dw.issue,
    action: dw.action,
  }));

  return {
    proficiencyScales: allScales,
    categories,
    orgUnits,
    competencies,
    versions,
    interviewQuestions,
    jobFamilies,
    jobLevels,
    jobRoles,
    governanceRules,
    dataWarnings,
    metadata: rawData._meta,
  };
}

export const FLAMINGO_DATASET = buildFlamingoDataset();
