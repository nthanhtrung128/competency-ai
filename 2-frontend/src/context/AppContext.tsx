import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  OrgUnitModel,
  UserModel,
  RoleModel,
  PermissionModel,
  RolePermissionModel,
  UserRoleModel,
  UserScopeModel,
  ProficiencyScaleModel,
  JobFamilyModel,
  CompetencyCategoryModel,
  CompetencyModel,
  CompetencyVersionModel,
  AuditLogModel,
  AuditAction,
  InterviewQuestionModel,
  JobLevelModel,
  JobRoleModel,
  GovernanceRuleModel,
  DataWarningModel,
} from '../../packages/db/src/types';
import {
  SEED_ORG_UNITS,
  SEED_USERS,
  SEED_ROLES,
  SEED_PERMISSIONS,
  SEED_ROLE_PERMISSIONS,
  SEED_USER_ROLES,
  SEED_USER_SCOPES,
  SEED_PROFICIENCY_SCALES,
  SEED_JOB_FAMILIES,
  SEED_CATEGORIES,
  SEED_COMPETENCIES,
  SEED_VERSIONS,
  SEED_AUDIT_LOGS,
  SEED_INTERVIEW_QUESTIONS,
  SEED_JOB_LEVELS,
  SEED_JOB_ROLES,
  SEED_GOVERNANCE_RULES,
  SEED_DATA_WARNINGS,
} from '../data/seedData';
import { Language, PERSONAS, PersonaOption } from '../data/i18n';
import { api, apiSend, clearSession, loadSession, login, normalizeUrl, wakeServer, ApiError } from '../api/client';
import {
  BootstrapPayload,
  ServerIdMaps,
  mapBootstrap,
  mapAuditLogs,
  anchorsToIndicators,
} from '../api/serverAdapter';

// ---------------------------------------------------------------- chế độ dữ liệu
export type DataSource = 'DEMO' | 'SERVER';
export interface ServerState {
  status: 'idle' | 'waking' | 'loading' | 'ready' | 'error' | 'needsPasswordChange';
  message?: string;
  wakeSeconds?: number;
  apiUrl?: string;
  user?: { email: string; name: string; roles: string[]; permissions: string[]; employeeId?: string | null };
  loadedAt?: Date;
}
export interface Notice {
  kind: 'ok' | 'error' | 'info';
  text: string;
}

export interface AssessmentRaterScore {
  id: string;
  campaignId: string;
  evaluateeId: string;
  evaluatorId: string;
  evaluatorRole: 'SELF' | 'MANAGER' | 'PEER';
  competencyId: string;
  scoreLevel: number; // 1 to 5
  comment?: string;
  updatedAt: string;
}

export interface Talent9BoxRecord {
  id: string;
  userId: string;
  performance: 1 | 2 | 3; // 1=Low, 2=Medium, 3=High
  potential: 1 | 2 | 3;   // 1=Low, 2=Medium, 3=High
  boxLabel: string;
  notes?: string;
  updatedAt: string;
}

export interface SuccessionPlan {
  id: string;
  keyRoleTitle: string;
  orgUnitId: string;
  currentHolderId?: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  successors: {
    userId: string;
    readiness: 'READY_NOW' | 'READY_1_YEAR' | 'READY_2_YEARS';
    riskOfLeaving: 'LOW' | 'MEDIUM' | 'HIGH';
    notes?: string;
  }[];
}

export interface IDPCheckInNote {
  id: string;
  date: string;
  authorName: string;
  authorRole: 'EMPLOYEE' | 'MANAGER';
  content: string;
}

export interface CareerAspirationRecord {
  targetRoleCode: string;
  targetRoleTitle: string;
  submittedAt: string;
  status: 'SUBMITTED' | 'HR_REVIEWED' | 'APPROVED';
  notes?: string;
}

export interface IDPPlan {
  id: string;
  userId: string;
  targetCompetencyCode: string;
  currentTier: number;
  targetTier: number;
  experiential70: string[];
  exposure20: string[];
  education10: string[];
  timeline: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PLANNED';
  generatedByAI: boolean;
  completedTasks?: string[];
  managerEndorsement?: {
    endorsedBy: string;
    endorsedAt: string;
    comments: string;
  };
  checkInNotes?: IDPCheckInNote[];
  careerAspiration?: CareerAspirationRecord;
}

// Initial 9-Box Seed Data
const INITIAL_9BOX: Talent9BoxRecord[] = [
  { id: '9b-1', userId: 'usr-cto', performance: 3, potential: 3, boxLabel: 'Star (High/High)', updatedAt: '2025-06-01' },
  { id: '9b-2', userId: 'usr-dev-lead', performance: 2, potential: 3, boxLabel: 'High Potential (Med/High)', updatedAt: '2025-06-01' },
  { id: '9b-3', userId: 'usr-head-eng', performance: 3, potential: 2, boxLabel: 'Core Performer (High/Med)', updatedAt: '2025-06-01' },
  { id: '9b-4', userId: 'usr-swe-1', performance: 2, potential: 2, boxLabel: 'Key Contributor (Med/Med)', updatedAt: '2025-06-01' },
  { id: '9b-5', userId: 'usr-hr-lead', performance: 2, potential: 3, boxLabel: 'High Potential (Med/High)', updatedAt: '2025-06-01' },
];

// Initial Succession Plans
const INITIAL_SUCCESSION: SuccessionPlan[] = [
  {
    id: 'succ-1',
    keyRoleTitle: 'Trưởng Ban Công nghệ thông tin & CĐS',
    orgUnitId: 'org-b13',
    currentHolderId: 'usr-cto',
    criticality: 'CRITICAL',
    successors: [
      { userId: 'usr-dev-lead', readiness: 'READY_NOW', riskOfLeaving: 'LOW', notes: 'Năng lực chuyên môn hạ tầng & an toàn thông tin xuất sắc.' },
      { userId: 'usr-head-eng', readiness: 'READY_1_YEAR', riskOfLeaving: 'MEDIUM', notes: 'Dẫn dắt các dự án ứng dụng doanh nghiệp & CĐS toàn Tập đoàn.' }
    ]
  },
  {
    id: 'succ-2',
    keyRoleTitle: 'Trưởng Phòng Ứng dụng doanh nghiệp & CĐS',
    orgUnitId: 'org-b13-p2',
    currentHolderId: 'usr-head-eng',
    criticality: 'HIGH',
    successors: [
      { userId: 'usr-swe-1', readiness: 'READY_1_YEAR', riskOfLeaving: 'LOW', notes: 'Đang mở rộng năng lực quản lý dự án và kiến trúc giải pháp.' }
    ]
  }
];

// Initial Assessment Scores (1 to 5 scale)
const INITIAL_SCORES: AssessmentRaterScore[] = [
  { id: 'sc-1', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-swe-1', evaluatorRole: 'SELF', competencyId: 'comp-co1', scoreLevel: 3, comment: 'Đạt chuẩn tinh thần trách nhiệm và làm chủ công việc', updatedAt: '2025-06-15' },
  { id: 'sc-2', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-dev-lead', evaluatorRole: 'MANAGER', competencyId: 'comp-co1', scoreLevel: 4, comment: 'Chủ động vượt yêu cầu công việc được giao', updatedAt: '2025-06-16' },
  { id: 'sc-3', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-head-eng', evaluatorRole: 'PEER', competencyId: 'comp-co1', scoreLevel: 4, comment: 'Hợp tác hiệu quả trong các dự án liên phòng ban', updatedAt: '2025-06-17' },

  { id: 'sc-4', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-swe-1', evaluatorRole: 'SELF', competencyId: 'comp-fu39', scoreLevel: 3, comment: 'Thiết kế kiến trúc hệ thống độc lập', updatedAt: '2025-06-15' },
  { id: 'sc-5', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-dev-lead', evaluatorRole: 'MANAGER', competencyId: 'comp-fu39', scoreLevel: 3, comment: 'Đạt yêu cầu Mức 3; cần rèn luyện thiết kế toàn tập đoàn cho Mức 4', updatedAt: '2025-06-16' },

  { id: 'sc-6', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-swe-1', evaluatorRole: 'SELF', competencyId: 'comp-co3', scoreLevel: 3, comment: 'Hợp tác hiệu quả', updatedAt: '2025-06-15' },
  { id: 'sc-7', campaignId: 'camp-2025-h1', evaluateeId: 'usr-swe-1', evaluatorId: 'usr-dev-lead', evaluatorRole: 'MANAGER', competencyId: 'comp-co3', scoreLevel: 3, comment: 'Đóng góp tích cực vào mục tiêu chung của Ban', updatedAt: '2025-06-16' },
];

interface AppContextType {
  // Nguồn dữ liệu: DEMO (trình duyệt) hoặc SERVER (máy chủ thật)
  dataSource: DataSource;
  server: ServerState;
  connectServer: (apiUrl: string, email: string, password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  refreshFromServer: () => Promise<void>;
  disconnectServer: () => void;
  notice: Notice | null;
  setNotice: (n: Notice | null) => void;
  /** Ở chế độ SERVER: kiểm tra quyền thật của tài khoản. Ở DEMO luôn true. */
  can: (permission: string) => boolean;

  // Localization & Persona
  lang: Language;
  setLang: (l: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  activePersona: PersonaOption;
  setActivePersona: (p: PersonaOption) => void;

  // Enterprise Core Datasets
  orgUnits: OrgUnitModel[];
  users: UserModel[];
  roles: RoleModel[];
  permissions: PermissionModel[];
  rolePermissions: RolePermissionModel[];
  userRoles: UserRoleModel[];
  userScopes: UserScopeModel[];
  proficiencyScales: ProficiencyScaleModel[];
  jobFamilies: JobFamilyModel[];
  categories: CompetencyCategoryModel[];
  competencies: CompetencyModel[];
  versions: CompetencyVersionModel[];
  auditLogs: AuditLogModel[];

  // Flamingo Extensions
  interviewQuestions: InterviewQuestionModel[];
  jobLevels: JobLevelModel[];
  jobRoles: JobRoleModel[];
  governanceRules: GovernanceRuleModel[];
  dataWarnings: DataWarningModel[];

  // Assessment & Talent Datasets
  assessmentScores: AssessmentRaterScore[];
  nineBoxTalents: Talent9BoxRecord[];
  successionPlans: SuccessionPlan[];
  idpPlans: IDPPlan[];

  // Mutators & Operations
  addOrgUnit: (unit: Partial<OrgUnitModel>) => void;
  updateOrgUnit: (id: string, updates: Partial<OrgUnitModel>) => void;
  deleteOrgUnit: (id: string) => { success: boolean; error?: string };
  addUserScope: (scope: Omit<UserScopeModel, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteUserScope: (id: string) => void;
  addCompetency: (comp: Partial<CompetencyModel>, version: Partial<CompetencyVersionModel>) => void;
  updateCompetencyVersion: (versionId: string, updates: Partial<CompetencyVersionModel>) => void;
  publishCompetencyVersion: (versionId: string) => void;
  recordAssessmentScore: (score: Omit<AssessmentRaterScore, 'id' | 'updatedAt'>) => void;
  update9BoxPlacement: (userId: string, performance: 1 | 2 | 3, potential: 1 | 2 | 3, boxLabel: string) => void;
  addSuccessor: (planId: string, successor: { userId: string; readiness: 'READY_NOW' | 'READY_1_YEAR' | 'READY_2_YEARS'; riskOfLeaving: 'LOW' | 'MEDIUM' | 'HIGH'; notes?: string }) => void;
  addIDPPlan: (plan: Omit<IDPPlan, 'id'>) => void;
  updateIDPPlan: (id: string, updates: Partial<IDPPlan>) => void;
  toggleIDPTask: (idpId: string, taskTitle: string) => void;
  addIDPCheckInNote: (idpId: string, note: Omit<IDPCheckInNote, 'id' | 'date'>) => void;
  endorseIDPPlan: (idpId: string, endorsement: { endorsedBy: string; comments: string }) => void;
  submitCareerAspiration: (userId: string, targetRoleCode: string, targetRoleTitle: string, notes?: string) => void;
  updateJobRole: (roleCode: string, updates: Partial<JobRoleModel>) => void;
  addJobRole: (role: JobRoleModel) => void;
  assignCompetencyOwner: (competencyId: string, owningUnit: string) => void;
  batchAssignRecommendedOwners: () => { count: number; updatedCodes: string[] };
  batchRemediateAllDataGaps: () => { count: number; updatedCodes: string[] };

  // Data Hub Import / Export / Reset
  importEnterpriseDataset: (data: any) => { success: boolean; message: string; count?: number };
  exportEnterpriseDataset: () => string;
  resetToSeedData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'competency_ai_flamingo_v3';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('vi');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activePersona, setActivePersona] = useState<PersonaOption>(PERSONAS[0]);

  // ------------------------------------------------------------ chế độ máy chủ
  const [dataSource, setDataSource] = useState<DataSource>('DEMO');
  const dataSourceRef = useRef<DataSource>('DEMO');
  const [server, setServer] = useState<ServerState>({ status: 'idle' });
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const serverIds = useRef<ServerIdMaps>({ competency: {}, version: {}, orgUnit: {}, orgTier: {} });
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setNotice = useCallback((n: Notice | null) => {
    setNoticeState(n);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (n) noticeTimer.current = setTimeout(() => setNoticeState(null), n.kind === 'error' ? 9000 : 5000);
  }, []);

  /** Ghi localStorage CHỈ ở chế độ Demo — dữ liệu máy chủ không bao giờ ghi đè dữ liệu Demo. */
  const persist = (key: string, value: string) => {
    if (dataSourceRef.current === 'SERVER') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* trình duyệt chặn lưu trữ — bỏ qua */
    }
  };

  // Core Entity State
  const [orgUnits, setOrgUnits] = useState<OrgUnitModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_orgUnits`);
    return saved ? JSON.parse(saved) : SEED_ORG_UNITS;
  });

  const [users, setUsers] = useState<UserModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
    return saved ? JSON.parse(saved) : SEED_USERS;
  });

  const [roles] = useState<RoleModel[]>(SEED_ROLES);
  const [permissions] = useState<PermissionModel[]>(SEED_PERMISSIONS);
  const [rolePermissions] = useState<RolePermissionModel[]>(SEED_ROLE_PERMISSIONS);
  const [userRoles] = useState<UserRoleModel[]>(SEED_USER_ROLES);

  const [userScopes, setUserScopes] = useState<UserScopeModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_userScopes`);
    return saved ? JSON.parse(saved) : SEED_USER_SCOPES;
  });

  const [proficiencyScales, setProficiencyScales] = useState<ProficiencyScaleModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_scales`);
    return saved ? JSON.parse(saved) : SEED_PROFICIENCY_SCALES;
  });

  const [jobFamilies, setJobFamilies] = useState<JobFamilyModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_jobFamilies`);
    return saved ? JSON.parse(saved) : SEED_JOB_FAMILIES;
  });

  const [categories, setCategories] = useState<CompetencyCategoryModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_categories`);
    return saved ? JSON.parse(saved) : SEED_CATEGORIES;
  });

  const [competencies, setCompetencies] = useState<CompetencyModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_competencies`);
    return saved ? JSON.parse(saved) : SEED_COMPETENCIES;
  });

  const [versions, setVersions] = useState<CompetencyVersionModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_versions`);
    return saved ? JSON.parse(saved) : SEED_VERSIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_auditLogs`);
    return saved ? JSON.parse(saved) : SEED_AUDIT_LOGS;
  });

  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestionModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_interviewQuestions`);
    return saved ? JSON.parse(saved) : SEED_INTERVIEW_QUESTIONS;
  });

  const [jobLevels, setJobLevels] = useState<JobLevelModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_jobLevels`);
    return saved ? JSON.parse(saved) : SEED_JOB_LEVELS;
  });

  const [jobRoles, setJobRoles] = useState<JobRoleModel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_jobRoles`);
    return saved ? JSON.parse(saved) : SEED_JOB_ROLES;
  });

  const [governanceRules] = useState<GovernanceRuleModel[]>(SEED_GOVERNANCE_RULES);
  const [dataWarnings] = useState<DataWarningModel[]>(SEED_DATA_WARNINGS);

  const [assessmentScores, setAssessmentScores] = useState<AssessmentRaterScore[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_scores`);
    return saved ? JSON.parse(saved) : INITIAL_SCORES;
  });

  const [nineBoxTalents, setNineBoxTalents] = useState<Talent9BoxRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_9box`);
    return saved ? JSON.parse(saved) : INITIAL_9BOX;
  });

  const [successionPlans, setSuccessionPlans] = useState<SuccessionPlan[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_succession`);
    return saved ? JSON.parse(saved) : INITIAL_SUCCESSION;
  });

  const [idpPlans, setIdpPlans] = useState<IDPPlan[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_idp`);
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'idp-1',
            userId: 'usr-swe-1',
            targetCompetencyCode: 'FU39',
            currentTier: 3,
            targetTier: 4,
            experiential70: [
              'Chủ trì thiết kế kiến trúc hệ thống dữ liệu phân tán cho Ban CNTT & CĐS.',
              'Tham gia hiệu chuẩn hạ tầng và kiểm thử tải cho giải pháp CĐS cấp Tập đoàn.',
            ],
            exposure20: [
              'Shadowing trực tiếp với Trưởng phòng Ứng dụng & CĐS trong các phiên phản biện kiến trúc.',
              'Tham gia tổ thẩm định kỹ thuật công nghệ thông tin cùng Ban Tổng Giám đốc.',
            ],
            education10: [
              'Hoàn thành chứng chỉ Kiến trúc sư Hệ thống Đám mây / Cloud Solutions Architect.',
              'Đọc tài liệu chuẩn hóa Kiến trúc TOGAF và Khung quản trị dữ liệu DAMA-DMBOK.',
            ],
            timeline: 'Q3-Q4 / 2025',
            status: 'IN_PROGRESS',
            generatedByAI: true,
            completedTasks: [
              'Chủ trì thiết kế kiến trúc hệ thống dữ liệu phân tán cho Ban CNTT & CĐS.',
              'Hoàn thành chứng chỉ Kiến trúc sư Hệ thống Đám mây / Cloud Solutions Architect.',
            ],
            checkInNotes: [
              {
                id: 'note-1',
                date: '2025-05-10',
                authorName: 'David Kim',
                authorRole: 'EMPLOYEE',
                content: 'Đã hoàn tất chứng chỉ Cloud Solutions Architect và đang tổng hợp tài liệu kiến trúc cho Ban.',
              },
              {
                id: 'note-2',
                date: '2025-05-20',
                authorName: 'Marcus Vance',
                authorRole: 'MANAGER',
                content: 'Ghi nhận nỗ lực xuất sắc. Đề xuất tham gia tổ thẩm định kỹ thuật trong quý tiếp theo để đạt mức 4.',
              },
            ],
            careerAspiration: {
              targetRoleCode: 'R14',
              targetRoleTitle: 'Phó Ban Công nghệ thông tin & CĐS',
              submittedAt: '2025-05-01',
              status: 'HR_REVIEWED',
              notes: 'Mục tiêu phấn đấu lên cấp Quản lý trong 12-18 tháng tới.',
            },
          },
          {
            id: 'idp-2',
            userId: 'usr-dev-lead',
            targetCompetencyCode: 'LD03',
            currentTier: 3,
            targetTier: 4,
            experiential70: [
              'Chủ trì điều phối dự án liên phòng ban về an ninh mạng và chuyển đổi số toàn diện.',
              'Thiết lập chỉ số SLA vận hành và huấn luyện đội ngũ kỹ sư trực ca 24/7.',
            ],
            exposure20: [
              'Tham gia các phiên họp chiến lược điều hành cùng Ban Tổng Giám đốc và Trưởng Ban CNTT.',
              'Kèm cặp 2 kỹ sư cấp phó nâng cao kỹ năng phản ứng sự cố.',
            ],
            education10: [
              'Tham gia khóa đào tạo Quản trị Lãnh đạo cấp Trung — Mini MBA Flamingo.',
              'Cập nhật tiêu chuẩn ISO 27001:2022 Lead Implementer.',
            ],
            timeline: 'Q3/2025 - Q1/2026',
            status: 'IN_PROGRESS',
            generatedByAI: true,
            completedTasks: [
              'Tham gia khóa đào tạo Quản trị Lãnh đạo cấp Trung — Mini MBA Flamingo.',
            ],
            checkInNotes: [
              {
                id: 'note-201',
                date: '2025-05-15',
                authorName: 'Elena Rostova',
                authorRole: 'EMPLOYEE',
                content: 'Đã hoàn thành module Mini MBA và đang áp dụng vào việc xây dựng SLA phòng ban.',
              },
            ],
            careerAspiration: {
              targetRoleCode: 'R10',
              targetRoleTitle: 'Trưởng Ban Công nghệ thông tin & CĐS',
              submittedAt: '2025-04-20',
              status: 'APPROVED',
              notes: 'Nhân sự quy hoạch kế thừa Trưởng Ban CNTT & CĐS theo kế hoạch Kế thừa 2025-2026.',
            },
          },
        ];
  });

  // Sync to localStorage
  useEffect(() => {
    persist(`${STORAGE_KEY}_orgUnits`, JSON.stringify(orgUnits));
  }, [orgUnits]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_users`, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_userScopes`, JSON.stringify(userScopes));
  }, [userScopes]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_scales`, JSON.stringify(proficiencyScales));
  }, [proficiencyScales]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_categories`, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_competencies`, JSON.stringify(competencies));
  }, [competencies]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_versions`, JSON.stringify(versions));
  }, [versions]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_auditLogs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_jobFamilies`, JSON.stringify(jobFamilies));
  }, [jobFamilies]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_jobLevels`, JSON.stringify(jobLevels));
  }, [jobLevels]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_jobRoles`, JSON.stringify(jobRoles));
  }, [jobRoles]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_interviewQuestions`, JSON.stringify(interviewQuestions));
  }, [interviewQuestions]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_scores`, JSON.stringify(assessmentScores));
  }, [assessmentScores]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_9box`, JSON.stringify(nineBoxTalents));
  }, [nineBoxTalents]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_succession`, JSON.stringify(successionPlans));
  }, [successionPlans]);

  useEffect(() => {
    persist(`${STORAGE_KEY}_idp`, JSON.stringify(idpPlans));
  }, [idpPlans]);

  // Helper: Append Audit Log
  const addAuditLog = (
    action: AuditAction,
    entityType: string,
    entityId: string,
    diff?: any,
    metadata?: any
  ) => {
    const newLog: AuditLogModel = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      entityType,
      entityId,
      actorId: activePersona.id,
      actorEmail: `${activePersona.id}@flamingo.vn`,
      actorIp: '10.0.1.5',
      userAgent: 'Flamingo Enterprise WebApp',
      diff: diff || null,
      metadata: metadata || null,
      status: 'SUCCESS',
      timestamp: new Date(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // ================================================================ MÁY CHỦ
  const can = useCallback(
    (perm: string) => dataSource !== 'SERVER' || !!server.user?.permissions.includes(perm),
    [dataSource, server.user],
  );

  const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /** Tải toàn bộ dữ liệu từ máy chủ và thay dữ liệu đang hiển thị. */
  const loadFromServer = async () => {
    const payload = await api<BootstrapPayload>('/bootstrap');
    const ds = mapBootstrap(payload);
    serverIds.current = ds.serverIds;
    dataSourceRef.current = 'SERVER';
    setDataSource('SERVER');
    setProficiencyScales(ds.proficiencyScales);
    setCategories(ds.categories);
    setOrgUnits(ds.orgUnits);
    setCompetencies(ds.competencies);
    setVersions(ds.versions);
    setInterviewQuestions(ds.interviewQuestions);
    setJobFamilies(ds.jobFamilies);
    setJobLevels(ds.jobLevels);
    setJobRoles(ds.jobRoles);
    if (payload.me.permissions.includes('audit:read')) {
      try {
        const res = await api<{ logs: Parameters<typeof mapAuditLogs>[0] }>('/audit-logs?take=300');
        setAuditLogs(mapAuditLogs(res.logs));
      } catch {
        setAuditLogs([]);
      }
    } else {
      setAuditLogs([]);
    }
    setServer((prev) => ({
      ...prev,
      status: 'ready',
      message: undefined,
      user: {
        email: payload.me.email, name: payload.me.name, roles: payload.me.roles,
        permissions: payload.me.permissions, employeeId: payload.me.employeeId ?? null,
      },
      loadedAt: new Date(),
    }));
    return payload;
  };

  const connectServer = async (apiUrl: string, email: string, password: string) => {
    const url = normalizeUrl(apiUrl);
    if (!url) {
      setServer({ status: 'error', message: 'Chưa nhập địa chỉ máy chủ' });
      return false;
    }
    try {
      setServer({ status: 'waking', apiUrl: url, wakeSeconds: 0 });
      await wakeServer(url, (sec) => setServer((p) => ({ ...p, wakeSeconds: sec })));
      setServer((p) => ({ ...p, status: 'loading' }));
      const session = await login(url, email, password);
      if (session.mustChangePassword) {
        // QĐ-07: tài khoản mới / vừa đặt lại → đổi mật khẩu trước khi vào
        setServer({ status: 'needsPasswordChange', apiUrl: url, message: 'Tài khoản mới hoặc vừa được đặt lại — hãy đặt mật khẩu của riêng bạn.' });
        return false;
      }
      const payload = await loadFromServer();
      setNotice({
        kind: 'ok',
        text: `Đã kết nối máy chủ — ${payload.competencies.length} năng lực, ${payload.orgUnits.length} đơn vị, ${payload.jobRoles.length} vai trò.`,
      });
      return true;
    } catch (e) {
      clearSession();
      setServer({ status: 'error', apiUrl: url, message: errText(e) });
      return false;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await apiSend('POST', '/auth/change-password', { currentPassword, newPassword });
      setServer((p) => ({ ...p, status: 'loading', message: undefined }));
      await loadFromServer();
      setNotice({ kind: 'ok', text: 'Đã đổi mật khẩu và kết nối máy chủ.' });
      return true;
    } catch (e) {
      setServer((p) => ({ ...p, status: 'needsPasswordChange', message: errText(e) }));
      return false;
    }
  };

  const refreshFromServer = async () => {
    if (dataSourceRef.current !== 'SERVER') return;
    try {
      setServer((p) => ({ ...p, status: 'loading' }));
      await loadFromServer();
    } catch (e) {
      setServer((p) => ({ ...p, status: 'error', message: errText(e) }));
      if (e instanceof ApiError && e.status === 401) {
        setNotice({ kind: 'error', text: 'Phiên đăng nhập đã hết hạn — vui lòng kết nối lại.' });
      }
    }
  };

  const disconnectServer = () => {
    clearSession();
    dataSourceRef.current = 'DEMO';
    // Tải lại trang để khôi phục nguyên trạng dữ liệu Demo đã lưu trong trình duyệt
    window.location.reload();
  };

  // Mở lại tab trong cùng phiên trình duyệt → tự kết nối lại bằng refresh token
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setServer({ status: 'loading', apiUrl: s.apiUrl });
    loadFromServer().catch((e) => {
      clearSession();
      setServer({ status: 'error', apiUrl: s.apiUrl, message: `Không tự kết nối lại được: ${errText(e)}` });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Chạy một thao tác ghi trên máy chủ → tải lại dữ liệu → thông báo. */
  const runOnServer = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      await loadFromServer();
      setNotice({ kind: 'ok', text: label });
      return true;
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) });
      return false;
    }
  };

  const blockOnServer = (what: string) => {
    setNotice({
      kind: 'info',
      text: `${what}: máy chủ chưa hỗ trợ thao tác này ở giai đoạn hiện tại — xem Sổ quyết định (4-tai-lieu/QUYET_DINH_HOAN_THIEN.md).`,
    });
  };

  const levelsPayload = (v: Partial<CompetencyVersionModel>) => ({ behavioralIndicators: anchorsToIndicators(v) });

  // Mutator: Add Org Unit
  const addOrgUnit = (unitData: Partial<OrgUnitModel>) => {
    if (dataSourceRef.current === 'SERVER') {
      const parentServerId = unitData.parentId ? serverIds.current.orgUnit[unitData.parentId] : null;
      const parentTier = unitData.parentId ? serverIds.current.orgTier[unitData.parentId] ?? 0 : -1;
      const typeMap: Record<string, string> = { COMPANY: 'SUBSIDIARY', DIVISION: 'BLOCK', DEPARTMENT: 'DEPARTMENT', TEAM: 'DIVISION', UNIT: 'SUPPORT' };
      void runOnServer(`Đã tạo đơn vị ${unitData.code} trên máy chủ`, () =>
        apiSend('POST', '/org-units', {
          code: unitData.code,
          name: unitData.name,
          type: typeMap[unitData.type ?? 'DEPARTMENT'] ?? 'DEPARTMENT',
          tier: parentTier + 1,
          parentId: parentServerId,
        }),
      );
      return;
    }
    const parent = unitData.parentId ? orgUnits.find((u) => u.id === unitData.parentId) : null;
    const path = parent ? `${parent.path}/${unitData.code}` : `/${unitData.code}`;
    const level = parent ? parent.level + 1 : 1;

    const newUnit: OrgUnitModel = {
      id: `org-${Date.now()}`,
      code: unitData.code || `UNIT-${Date.now()}`,
      name: unitData.name || 'New Organizational Unit',
      description: unitData.description || null,
      type: unitData.type || 'DEPARTMENT',
      parentId: unitData.parentId || null,
      managerId: unitData.managerId || null,
      level,
      path,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setOrgUnits((prev) => [...prev, newUnit]);
    addAuditLog('CREATE', 'OrgUnit', newUnit.id, { created: newUnit });
  };

  // Mutator: Update Org Unit
  const updateOrgUnit = (id: string, updates: Partial<OrgUnitModel>) => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Sửa đơn vị');
    setOrgUnits((prev) =>
      prev.map((unit) => {
        if (unit.id !== id) return unit;
        return {
          ...unit,
          ...updates,
          updatedAt: new Date(),
        };
      })
    );
    addAuditLog('UPDATE', 'OrgUnit', id, { updates });
  };

  // Mutator: Delete Org Unit
  const deleteOrgUnit = (id: string): { success: boolean; error?: string } => {
    if (dataSourceRef.current === 'SERVER') {
      return { success: false, error: 'Xóa đơn vị trên máy chủ chưa được hỗ trợ — đơn vị nên được ngừng hiệu lực (isActive) thay vì xóa, để giữ lịch sử.' };
    }
    const hasChildren = orgUnits.some((u) => u.parentId === id);
    if (hasChildren) {
      return {
        success: false,
        error: lang === 'vi'
          ? 'Không thể xóa đơn vị này vì vẫn còn phòng ban/đơn vị cấp dưới. Hãy điều chuyển đơn vị con trước.'
          : 'Cannot delete unit because it contains subordinate units. Please reassign child units first.',
      };
    }

    const hasUsers = users.some((u) => u.orgUnitId === id);
    if (hasUsers) {
      return {
        success: false,
        error: lang === 'vi'
          ? 'Không thể xóa đơn vị vì vẫn còn nhân sự trực thuộc. Hãy điều chuyển nhân sự trước.'
          : 'Cannot delete unit because users are assigned to it.',
      };
    }

    setOrgUnits((prev) => prev.filter((u) => u.id !== id));
    addAuditLog('DELETE', 'OrgUnit', id, { deletedId: id });
    return { success: true };
  };

  // Mutator: Add User Scope
  const addUserScope = (scopeData: Omit<UserScopeModel, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Cấp phạm vi dữ liệu');
    const newScope: UserScopeModel = {
      ...scopeData,
      id: `scope-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setUserScopes((prev) => [...prev, newScope]);
    addAuditLog('SCOPE_GRANTED', 'UserScope', newScope.id, { scope: newScope });
  };

  // Mutator: Delete User Scope
  const deleteUserScope = (id: string) => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Thu hồi phạm vi dữ liệu');
    setUserScopes((prev) => prev.filter((s) => s.id !== id));
    addAuditLog('SCOPE_REVOKED', 'UserScope', id, { revokedId: id });
  };

  // Mutator: Add Competency
  const addCompetency = (
    compData: Partial<CompetencyModel>,
    versionData: Partial<CompetencyVersionModel>
  ) => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Thêm năng lực mới (cần quyết định QĐ-01 về cấu trúc Từ điển)');
    const compId = `comp-${Date.now()}`;
    const versionId = `ver-${compId}-v1`;

    const newComp: CompetencyModel = {
      id: compId,
      code: compData.code || `COMP-${Date.now()}`,
      name: compData.name || 'New Competency',
      description: compData.description || null,
      categoryId: compData.categoryId || categories[0]?.id || 'cat-cor',
      scaleId: compData.scaleId || 'scale-fla-5',
      currentVersionId: null, // chưa có bản ban hành
      hasOwner: compData.hasOwner !== false,
      owningUnit: compData.owningUnit || null,
      dataGap: compData.dataGap || null,
      scored: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newVersion: CompetencyVersionModel = {
      id: versionId,
      competencyId: compId,
      scaleId: compData.scaleId || 'scale-fla-5',
      version: 1,
      // Năng lực mới luôn bắt đầu là BẢN NHÁP — phải qua duyệt mới được ban hành (QT01)
      status: 'DRAFT',
      title: `${newComp.name} (v1.0)`,
      definition: compData.description || `${newComp.name} chuẩn năng lực.`,
      level1Anchor: versionData.level1Anchor || '[Mức 1 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      level2Anchor: versionData.level2Anchor || '[Mức 2 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      level3Anchor: versionData.level3Anchor || '[Mức 3 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      level4Anchor: versionData.level4Anchor || '[Mức 4 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      level5Anchor: versionData.level5Anchor || '[Mức 5 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      authorId: activePersona.id,
      effectiveFrom: null,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setCompetencies((prev) => [newComp, ...prev]);
    setVersions((prev) => [newVersion, ...prev]);

    addAuditLog('CREATE', 'Competency', compId, { competency: newComp, version: newVersion });
  };

  // Mutator: Update Competency Version
  const updateCompetencyVersion = (
    versionId: string,
    updates: Partial<CompetencyVersionModel>
  ) => {
    const existing = versions.find((v) => v.id === versionId);

    if (dataSourceRef.current === 'SERVER') {
      if (!existing) {
        // Giao diện gọi hàm này với id mới khi bấm "Tạo bản nháp"
        const compServerId = updates.competencyId ? serverIds.current.competency[updates.competencyId] : undefined;
        if (!compServerId) return setNotice({ kind: 'error', text: 'Không xác định được năng lực trên máy chủ' });
        void runOnServer('Đã tạo bản nháp trên máy chủ', () =>
          apiSend('POST', `/competencies/${compServerId}/versions`, { levels: levelsPayload(updates) }),
        );
        return;
      }
      if (existing.status !== 'DRAFT') {
        return setNotice({ kind: 'error', text: `Phiên bản v${existing.version} đang ${existing.status} — không sửa trực tiếp. Hãy tạo bản nháp.` });
      }
      const merged = { ...existing, ...updates };
      void runOnServer('Đã lưu bản nháp', () =>
        apiSend('PATCH', `/competency-versions/${serverIds.current.version[versionId]}`, {
          title: merged.title,
          definition: merged.definition,
          levels: levelsPayload(merged),
        }),
      );
      return;
    }

    // Chế độ Demo: cũng không cho sửa trực tiếp bản đã ban hành / lưu trữ
    if (existing && existing.status !== 'DRAFT') {
      setNotice({ kind: 'error', text: `Phiên bản v${existing.version} đang ${existing.status} — không sửa trực tiếp. Hãy tạo bản nháp.` });
      return;
    }
    setVersions((prev) =>
      existing
        ? prev.map((v) => (v.id === versionId ? { ...v, ...updates, updatedAt: new Date() } : v))
        : [...prev, { ...(updates as CompetencyVersionModel), id: versionId, updatedAt: new Date() }]
    );
    addAuditLog('UPDATE', 'CompetencyVersion', versionId, { updates });
  };

  // Mutator: Publish Competency Version
  // SỬA LỖI: phải lưu trữ bản PUBLISHED cũ và cập nhật currentVersionId,
  // không được để hai phiên bản cùng PUBLISHED (nguyên tắc versioning B.5 số 4).
  const publishCompetencyVersion = (versionId: string) => {
    const target = versions.find((v) => v.id === versionId);
    if (!target) return;
    const anchors = [target.level1Anchor, target.level2Anchor, target.level3Anchor, target.level4Anchor, target.level5Anchor];
    if (anchors.some((a) => /\[DỰ THẢO (AI|TỰ SINH)|\[Mức \d chưa có/i.test(a ?? ''))) {
      setNotice({ kind: 'error', text: 'Không ban hành được: bản nháp còn mức chưa có chỉ báo hoặc còn nhãn dự thảo AI chưa được chuyên gia sửa.' });
      return;
    }
    if (dataSourceRef.current === 'SERVER') {
      void runOnServer(`Đã ban hành v${target.version}; bản cũ chuyển sang ARCHIVED`, () =>
        apiSend('POST', `/competency-versions/${serverIds.current.version[versionId]}/publish`),
      );
      return;
    }
    let archivedCount = 0;

    setVersions((prev) =>
      prev.map((v) => {
        if (v.id === versionId) {
          return { ...v, status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() };
        }
        // lưu trữ mọi phiên bản PUBLISHED khác của CÙNG năng lực
        if (v.competencyId === target.competencyId && v.status === 'PUBLISHED') {
          archivedCount++;
          return { ...v, status: 'ARCHIVED', archivedAt: new Date(), updatedAt: new Date() };
        }
        return v;
      })
    );

    // cập nhật con trỏ phiên bản hiện hành
    setCompetencies((prev) =>
      prev.map((c) =>
        c.id === target.competencyId ? { ...c, currentVersionId: versionId } : c
      )
    );

    addAuditLog('PUBLISH', 'CompetencyVersion', versionId, {
      published: true,
      archivedPrevious: archivedCount,
    });
  };

  // Mutator: Record 360 Assessment Score
  const recordAssessmentScore = (score: Omit<AssessmentRaterScore, 'id' | 'updatedAt'>) => {
    const newScore: AssessmentRaterScore = {
      ...score,
      id: `score-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setAssessmentScores((prev) => [newScore, ...prev]);
    addAuditLog('CREATE', 'AssessmentScore', newScore.id, { score: newScore });
  };

  // Mutator: Update 9-Box Placement
  const update9BoxPlacement = (
    userId: string,
    performance: 1 | 2 | 3,
    potential: 1 | 2 | 3,
    boxLabel: string
  ) => {
    setNineBoxTalents((prev) => {
      const existing = prev.find((r) => r.userId === userId);
      if (existing) {
        return prev.map((r) =>
          r.userId === userId
            ? { ...r, performance, potential, boxLabel, updatedAt: new Date().toISOString().split('T')[0] }
            : r
        );
      }
      return [
        ...prev,
        {
          id: `9b-${Date.now()}`,
          userId,
          performance,
          potential,
          boxLabel,
          updatedAt: new Date().toISOString().split('T')[0],
        },
      ];
    });
    addAuditLog('UPDATE', 'Talent9BoxRecord', userId, { performance, potential, boxLabel });
  };

  // Mutator: Add Successor to Plan
  const addSuccessor = (
    planId: string,
    successor: {
      userId: string;
      readiness: 'READY_NOW' | 'READY_1_YEAR' | 'READY_2_YEARS';
      riskOfLeaving: 'LOW' | 'MEDIUM' | 'HIGH';
      notes?: string;
    }
  ) => {
    setSuccessionPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) return plan;
        const exists = plan.successors.some((s) => s.userId === successor.userId);
        const newSuccessors = exists
          ? plan.successors.map((s) => (s.userId === successor.userId ? successor : s))
          : [...plan.successors, successor];
        return { ...plan, successors: newSuccessors };
      })
    );
    addAuditLog('UPDATE', 'SuccessionPlan', planId, { successor });
  };

  // Mutator: Add IDP
  const addIDPPlan = (plan: Omit<IDPPlan, 'id'>) => {
    const newPlan: IDPPlan = {
      ...plan,
      id: `idp-${Date.now()}`,
    };
    setIdpPlans((prev) => [newPlan, ...prev]);
    addAuditLog('CREATE', 'IDPPlan', newPlan.id, { newPlan });
  };

  // Mutator: Update IDP
  const updateIDPPlan = (id: string, updates: Partial<IDPPlan>) => {
    setIdpPlans((prev) =>
      prev.map((plan) => (plan.id === id ? { ...plan, ...updates } : plan))
    );
    addAuditLog('UPDATE', 'IDPPlan', id, { updates });
  };

  // Mutator: Toggle IDP Task Completion
  const toggleIDPTask = (idpId: string, taskTitle: string) => {
    setIdpPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== idpId) return plan;
        const currentTasks = plan.completedTasks || [];
        const isCompleted = currentTasks.includes(taskTitle);
        const newCompleted = isCompleted
          ? currentTasks.filter((t) => t !== taskTitle)
          : [...currentTasks, taskTitle];

        const totalTasks =
          plan.experiential70.length + plan.exposure20.length + plan.education10.length;
        const newStatus =
          newCompleted.length === totalTasks && totalTasks > 0 ? 'COMPLETED' : 'IN_PROGRESS';

        return {
          ...plan,
          completedTasks: newCompleted,
          status: newStatus,
        };
      })
    );
    addAuditLog('UPDATE', 'IDPPlan', idpId, { action: 'TOGGLE_TASK', taskTitle });
  };

  // Mutator: Add IDP Check-In Note
  const addIDPCheckInNote = (
    idpId: string,
    note: Omit<IDPCheckInNote, 'id' | 'date'>
  ) => {
    const newNote: IDPCheckInNote = {
      ...note,
      id: `note-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
    };
    setIdpPlans((prev) =>
      prev.map((plan) =>
        plan.id === idpId
          ? { ...plan, checkInNotes: [...(plan.checkInNotes || []), newNote] }
          : plan
      )
    );
    addAuditLog('UPDATE', 'IDPPlan', idpId, { action: 'ADD_CHECK_IN', newNote });
  };

  // Mutator: Manager Endorse IDP
  const endorseIDPPlan = (
    idpId: string,
    endorsement: { endorsedBy: string; comments: string }
  ) => {
    setIdpPlans((prev) =>
      prev.map((plan) =>
        plan.id === idpId
          ? {
              ...plan,
              managerEndorsement: {
                ...endorsement,
                endorsedAt: new Date().toISOString().slice(0, 10),
              },
            }
          : plan
      )
    );
    addAuditLog('UPDATE', 'IDPPlan', idpId, { action: 'MANAGER_ENDORSEMENT', endorsement });
  };

  // Mutator: Submit Career Aspiration
  const submitCareerAspiration = (
    userId: string,
    targetRoleCode: string,
    targetRoleTitle: string,
    notes?: string
  ) => {
    const record: CareerAspirationRecord = {
      targetRoleCode,
      targetRoleTitle,
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'SUBMITTED',
      notes,
    };
    setIdpPlans((prev) => {
      const userPlans = prev.filter((p) => p.userId === userId);
      if (userPlans.length > 0) {
        return prev.map((p) =>
          p.userId === userId ? { ...p, careerAspiration: record } : p
        );
      } else {
        const newPlan: IDPPlan = {
          id: `idp-${Date.now()}`,
          userId,
          targetCompetencyCode: 'LD01',
          currentTier: 2,
          targetTier: 3,
          experiential70: [
            'Đảm nhận vai trò phụ trách các dự án trọng điểm theo chuẩn chức danh mục tiêu.',
          ],
          exposure20: ['Được kèm cặp bởi cán bộ quản lý phụ trách đơn vị.'],
          education10: [
            `Hoàn thành các khóa bồi dưỡng năng lực chức danh ${targetRoleTitle}`,
          ],
          timeline: '2025 - 2026',
          status: 'PLANNED',
          generatedByAI: false,
          careerAspiration: record,
        };
        return [newPlan, ...prev];
      }
    });
    addAuditLog('CREATE', 'CareerAspiration', userId, { record });
  };

  // Mutator: Update Job Role Requirements or Metadata
  const updateJobRole = (roleCode: string, updates: Partial<JobRoleModel>) => {
    if (dataSourceRef.current === 'SERVER') {
      if (!updates.requirements) return blockOnServer('Sửa thông tin vai trò');
      const known = new Set(competencies.map((c) => c.code));
      const unmapped = updates.requirements.filter((r) => !known.has(r.competency)).map((r) => r.competency);
      if (unmapped.length) {
        setNotice({
          kind: 'error',
          text: `Chưa lưu: ${unmapped.length} yêu cầu chưa có mã Từ điển (${unmapped.join(', ')}). Hãy thay bằng mã CO/LE/FU hoặc xóa dòng đó.`,
        });
        return;
      }
      void runOnServer(`Đã duyệt yêu cầu năng lực cho ${roleCode}`, () =>
        apiSend('PUT', `/job-roles/${encodeURIComponent(roleCode)}/requirements`, {
          requirements: updates.requirements!.map((r) => ({ competency: r.competency, requiredLevel: r.requiredLevel })),
        }),
      );
      return;
    }
    setJobRoles((prev) =>
      prev.map((r) => (r.code === roleCode ? { ...r, ...updates } : r))
    );
    addAuditLog('UPDATE', 'JobRole', roleCode, { updates });
  };

  // Mutator: Add New Job Role
  const addJobRole = (role: JobRoleModel) => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Thêm vai trò mới');
    setJobRoles((prev) => [...prev, role]);
    addAuditLog('CREATE', 'JobRole', role.code, { role });
  };

  // Mutator: Assign Competency Owning Unit (Resolves hasOwner: false)
  const assignCompetencyOwner = (competencyId: string, owningUnit: string) => {
    if (dataSourceRef.current === 'SERVER') {
      const sid = serverIds.current.competency[competencyId];
      void runOnServer(`Đã gán đơn vị chủ quản: ${owningUnit}`, () =>
        apiSend('PATCH', `/competencies/${sid}/owner`, { owningUnit }),
      );
      return;
    }
    setCompetencies((prev) =>
      prev.map((c) =>
        c.id === competencyId
          ? { ...c, owningUnit, hasOwner: true, updatedAt: new Date() }
          : c
      )
    );
    addAuditLog('UPDATE', 'CompetencyGovernance', competencyId, {
      action: 'ASSIGN_OWNER',
      owningUnit,
      governanceRule: 'QT05',
    });
  };

  // Batch: ĐỀ XUẤT đơn vị chủ quản cho 6 năng lực chưa có chủ (FU02, FU16, FU23, FU29, FU43, FU45)
  // KHÔNG tự gán chính thức: chỉ ghi phương án đề xuất, hasOwner vẫn = false cho tới khi có quyết định (QĐ-03).
  const batchAssignRecommendedOwners = () => {
    if (dataSourceRef.current === 'SERVER') {
      blockOnServer('Gán hàng loạt đơn vị chủ quản (phải quyết định từng năng lực — QĐ-03)');
      return { count: 0, updatedCodes: [] as string[] };
    }
    const proposalMap: Record<string, string> = {
      FU02: '[ĐỀ XUẤT – chờ duyệt] Ban Tổng Giám đốc (BTGD) tạm giữ',
      FU16: '[ĐỀ XUẤT – chờ duyệt] Ban Kinh doanh Vận hành (B06)',
      FU23: '[ĐỀ XUẤT – chờ duyệt] Ban Kinh doanh Vận hành (B06)',
      FU29: '[ĐỀ XUẤT – chờ duyệt] Ban Đầu tư (B01) chủ trì, Ban TCKT (B10) phối hợp',
      FU43: '[ĐỀ XUẤT – chờ duyệt] Ban Kinh doanh BĐS (B05)',
      FU45: '[ĐỀ XUẤT – chờ duyệt] Ban PC&KSNB (B12) chủ trì, Ban TT&TH (B07) phối hợp',
    };

    const updatedCodes: string[] = [];
    setCompetencies((prev) =>
      prev.map((c) => {
        const proposal = proposalMap[c.code];
        if (!c.hasOwner && proposal) {
          updatedCodes.push(c.code);
          return { ...c, owningUnit: proposal, hasOwner: false, updatedAt: new Date() };
        }
        return c;
      })
    );

    addAuditLog('UPDATE', 'CompetencyGovernance', 'MULTIPLE', {
      action: 'PROPOSE_OWNERS',
      updatedCodes,
      governanceRule: 'QT01 / QT05',
    });

    return { count: updatedCodes.length, updatedCodes };
  };

  // Batch: tạo BẢN NHÁP gợi ý Mức 1, 2, 4, 5 cho năng lực còn thiếu (chỉ chế độ Demo).
  // - KHÔNG sửa bản đang ban hành, KHÔNG xóa cảnh báo dataGap.
  // - Mọi câu chữ tự sinh đều gắn nhãn [DỰ THẢO TỰ SINH – CHƯA DUYỆT]; lệnh nạp chỉ báo trên máy chủ sẽ từ chối nhãn này.
  const batchRemediateAllDataGaps = () => {
    if (dataSourceRef.current === 'SERVER') {
      blockOnServer('Tự sinh chỉ báo (máy chủ chỉ nhận chỉ báo do chuyên gia viết qua file mẫu)');
      return { count: 0, updatedCodes: [] as string[] };
    }
    const TAG = '[DỰ THẢO TỰ SINH – CHƯA DUYỆT] ';
    const updatedCodes: string[] = [];
    const newDrafts: CompetencyVersionModel[] = [];

    for (const comp of competencies) {
      if (!comp.dataGap) continue;
      const compVersions = versions.filter((v) => v.competencyId === comp.id);
      if (compVersions.some((v) => v.status === 'DRAFT')) continue; // đã có bản nháp
      const base = compVersions.find((v) => v.id === comp.currentVersionId) ?? compVersions[0];
      if (!base) continue;
      const n = comp.name.toLowerCase();
      const nextVer = Math.max(...compVersions.map((v) => v.version)) + 1;
      updatedCodes.push(comp.code);
      newDrafts.push({
        ...base,
        id: `ver-${comp.code.toLowerCase()}-v${nextVer}`,
        version: nextVer,
        status: 'DRAFT',
        level1Anchor: `${TAG}Nắm khái niệm, quy chuẩn cơ bản về ${n}; thực hiện tác nghiệp theo quy trình dưới hướng dẫn trực tiếp.`,
        level2Anchor: `${TAG}Áp dụng quy trình tiêu chuẩn về ${n}; tự xử lý tình huống thông thường.`,
        level4Anchor: `${TAG}Tối ưu quy trình, thiết kế giải pháp về ${n}; tư vấn chuyên môn cho đơn vị khác.`,
        level5Anchor: `${TAG}Định hình chuẩn mực về ${n} cấp Tập đoàn; dẫn dắt đổi mới và chuyển giao tri thức.`,
        changeLog: 'Bản nháp tự sinh để chuyên gia sửa — KHÔNG được ban hành nguyên trạng.',
        publishedAt: null,
        archivedAt: null,
        effectiveFrom: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    setVersions((prev) => [...prev, ...newDrafts]);

    addAuditLog('CREATE', 'CompetencyVersion', 'ALL_DATA_GAPS', {
      action: 'GENERATE_DRAFT_SUGGESTIONS',
      count: updatedCodes.length,
      governanceRule: 'QT05',
    });

    return { count: updatedCodes.length, updatedCodes };
  };

  // Data Hub: Import Enterprise Dataset (JSON)
  const importEnterpriseDataset = (data: any): { success: boolean; message: string; count?: number } => {
    if (dataSourceRef.current === 'SERVER') {
      return { success: false, message: 'Đang kết nối máy chủ: nhập dữ liệu nhân sự dùng trang Import Console của máy chủ (/import-console.html); nhập chỉ báo dùng lệnh import:indicators.' };
    }
    try {
      let importedCount = 0;
      if (data.proficiencyScales && Array.isArray(data.proficiencyScales)) {
        setProficiencyScales(data.proficiencyScales);
        importedCount += data.proficiencyScales.length;
      }
      if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories);
        importedCount += data.categories.length;
      }
      if (data.orgUnits && Array.isArray(data.orgUnits)) {
        setOrgUnits(data.orgUnits);
        importedCount += data.orgUnits.length;
      }
      if (data.users && Array.isArray(data.users)) {
        setUsers(data.users);
        importedCount += data.users.length;
      }
      if (data.competencies && Array.isArray(data.competencies)) {
        setCompetencies(data.competencies);
        importedCount += data.competencies.length;
      }
      if (data.versions && Array.isArray(data.versions)) {
        setVersions(data.versions);
        importedCount += data.versions.length;
      }
      if (data.interviewQuestions && Array.isArray(data.interviewQuestions)) {
        setInterviewQuestions(data.interviewQuestions);
        importedCount += data.interviewQuestions.length;
      }
      if (data.jobFamilies && Array.isArray(data.jobFamilies)) {
        setJobFamilies(data.jobFamilies);
        importedCount += data.jobFamilies.length;
      }
      if (data.jobLevels && Array.isArray(data.jobLevels)) {
        setJobLevels(data.jobLevels);
        importedCount += data.jobLevels.length;
      }
      if (data.jobRoles && Array.isArray(data.jobRoles)) {
        setJobRoles(data.jobRoles);
        importedCount += data.jobRoles.length;
      }
      if (data.userScopes && Array.isArray(data.userScopes)) {
        setUserScopes(data.userScopes);
        importedCount += data.userScopes.length;
      }
      if (data.assessmentScores && Array.isArray(data.assessmentScores)) {
        setAssessmentScores(data.assessmentScores);
        importedCount += data.assessmentScores.length;
      }
      if (data.nineBoxTalents && Array.isArray(data.nineBoxTalents)) {
        setNineBoxTalents(data.nineBoxTalents);
        importedCount += data.nineBoxTalents.length;
      }
      if (data.successionPlans && Array.isArray(data.successionPlans)) {
        setSuccessionPlans(data.successionPlans);
        importedCount += data.successionPlans.length;
      }
      if (data.idpPlans && Array.isArray(data.idpPlans)) {
        setIdpPlans(data.idpPlans);
        importedCount += data.idpPlans.length;
      }

      addAuditLog('IMPORT', 'EnterpriseDataHub', 'global', { recordsImported: importedCount });
      return { success: true, message: `Successfully imported ${importedCount} records into Flamingo CompetencyAI database.`, count: importedCount };
    } catch (err: any) {
      return { success: false, message: `Failed to import dataset: ${err.message}` };
    }
  };

  // Data Hub: Export Enterprise Dataset
  const exportEnterpriseDataset = (): string => {
    const fullSnapshot = {
      version: '3.0.0-flamingo',
      exportedAt: new Date().toISOString(),
      platform: 'Flamingo Holdings CompetencyAI Prisma Enterprise',
      proficiencyScales,
      categories,
      orgUnits,
      users,
      userScopes,
      competencies,
      versions,
      interviewQuestions,
      jobFamilies,
      jobLevels,
      jobRoles,
      governanceRules,
      dataWarnings,
      assessmentScores,
      nineBoxTalents,
      successionPlans,
      idpPlans,
      auditLogs,
    };
    return JSON.stringify(fullSnapshot, null, 2);
  };

  // Data Hub: Reset to Seed Data
  const resetToSeedData = () => {
    if (dataSourceRef.current === 'SERVER') return blockOnServer('Khôi phục dữ liệu mẫu (chỉ áp dụng ở chế độ Demo)');
    localStorage.clear();
    setProficiencyScales(SEED_PROFICIENCY_SCALES);
    setCategories(SEED_CATEGORIES);
    setOrgUnits(SEED_ORG_UNITS);
    setUsers(SEED_USERS);
    setUserScopes(SEED_USER_SCOPES);
    setCompetencies(SEED_COMPETENCIES);
    setVersions(SEED_VERSIONS);
    setInterviewQuestions(SEED_INTERVIEW_QUESTIONS);
    setJobFamilies(SEED_JOB_FAMILIES);
    setJobLevels(SEED_JOB_LEVELS);
    setJobRoles(SEED_JOB_ROLES);
    setAuditLogs(SEED_AUDIT_LOGS);
    setAssessmentScores(INITIAL_SCORES);
    setNineBoxTalents(INITIAL_9BOX);
    setSuccessionPlans(INITIAL_SUCCESSION);
    setIdpPlans([
      {
        id: 'idp-1',
        userId: 'usr-swe-1',
        targetCompetencyCode: 'FU39',
        currentTier: 3,
        targetTier: 4,
        experiential70: [
          'Chủ trì thiết kế kiến trúc hệ thống dữ liệu phân tán cho Ban CNTT & CĐS.',
          'Tham gia hiệu chuẩn hạ tầng và kiểm thử tải cho giải pháp CĐS cấp Tập đoàn.'
        ],
        exposure20: [
          'Shadowing trực tiếp với Trưởng phòng Ứng dụng & CĐS trong các phiên phản biện kiến trúc.',
          'Tham gia tổ thẩm định kỹ thuật công nghệ thông tin cùng Ban Tổng Giám đốc.'
        ],
        education10: [
          'Hoàn thành chứng chỉ Kiến trúc sư Hệ thống Đám mây / Cloud Solutions Architect.',
          'Đọc tài liệu chuẩn hóa Kiến trúc TOGAF và Khung quản trị dữ liệu DAMA-DMBOK.'
        ],
        timeline: 'Q3-Q4 / 2025',
        status: 'IN_PROGRESS',
        generatedByAI: true,
      }
    ]);
  };

  const value = useMemo(
    () => ({
      dataSource,
      server,
      connectServer,
      changePassword,
      refreshFromServer,
      disconnectServer,
      notice,
      setNotice,
      can,
      lang,
      setLang,
      theme,
      setTheme,
      activePersona,
      setActivePersona,
      orgUnits,
      users,
      roles,
      permissions,
      rolePermissions,
      userRoles,
      userScopes,
      proficiencyScales,
      jobFamilies,
      categories,
      competencies,
      versions,
      auditLogs,
      interviewQuestions,
      jobLevels,
      jobRoles,
      governanceRules,
      dataWarnings,
      assessmentScores,
      nineBoxTalents,
      successionPlans,
      idpPlans,
      addOrgUnit,
      updateOrgUnit,
      deleteOrgUnit,
      addUserScope,
      deleteUserScope,
      addCompetency,
      updateCompetencyVersion,
      publishCompetencyVersion,
      recordAssessmentScore,
      update9BoxPlacement,
      addSuccessor,
      addIDPPlan,
      updateIDPPlan,
      toggleIDPTask,
      addIDPCheckInNote,
      endorseIDPPlan,
      submitCareerAspiration,
      updateJobRole,
      addJobRole,
      assignCompetencyOwner,
      batchAssignRecommendedOwners,
      batchRemediateAllDataGaps,
      importEnterpriseDataset,
      exportEnterpriseDataset,
      resetToSeedData,
    }),
    [
      dataSource,
      server,
      notice,
      can,
      lang,
      theme,
      activePersona,
      orgUnits,
      users,
      roles,
      permissions,
      rolePermissions,
      userRoles,
      userScopes,
      proficiencyScales,
      jobFamilies,
      categories,
      competencies,
      versions,
      auditLogs,
      interviewQuestions,
      jobLevels,
      jobRoles,
      governanceRules,
      dataWarnings,
      assessmentScores,
      nineBoxTalents,
      successionPlans,
      idpPlans,
      updateJobRole,
      addJobRole,
      assignCompetencyOwner,
      batchAssignRecommendedOwners,
      batchRemediateAllDataGaps,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
