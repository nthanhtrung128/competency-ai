export type Language = 'vi' | 'en';

export interface TranslationDictionary {
  appName: string;
  appSubtitle: string;
  phaseBanner: string;
  themeToggle: string;
  aiAssistant: string;
  dashboard: string;
  organization: string;
  competencyDictionary: string;
  proficiencyScales: string;
  skillTaxonomy: string;
  jobArchitecture: string;
  successProfile: string;
  jobDescription: string;
  assessment360: string;
  competencyGap: string;
  calibration9box: string;
  successionIDP: string;
  dataScopes: string;
  rbacPermissions: string;
  auditLogs: string;
  prismaModels: string;
  schemaViewer: string;
  overviewCategory: string;
  foundationCategory: string;
  jobCategory: string;
  assessmentCategory: string;
  talentCategory: string;
  systemCategory: string;
}

export const I18N: Record<Language, TranslationDictionary> = {
  vi: {
    appName: 'CompetencyAI',
    appSubtitle: 'Trí tuệ Quản trị Nhân tài AI',
    phaseBanner: 'Bản mẫu giao diện GĐ0 — Chuẩn UI B.8: Thang FLA-5 (5 mức), Cơ cấu Tổ chức, UserScope RLS & Prisma ORM.',
    themeToggle: 'Chế độ',
    aiAssistant: 'Trợ lý AI',
    dashboard: 'Bảng điều khiển',
    organization: 'Cơ cấu tổ chức',
    competencyDictionary: 'Từ điển năng lực',
    proficiencyScales: 'Thang thành thục FLA-5 (5 mức)',
    skillTaxonomy: 'Skill Taxonomy',
    jobArchitecture: 'Họ nghề & Cấp bậc',
    successProfile: 'Hồ sơ năng lực',
    jobDescription: 'Bản mô tả công việc',
    assessment360: 'Chiến dịch 360°',
    competencyGap: 'Khoảng cách năng lực',
    calibration9box: 'Hiệu chuẩn 9-box',
    successionIDP: 'Kế thừa & IDP',
    dataScopes: 'Phân quyền dữ liệu (RLS)',
    rbacPermissions: 'Vai trò & Quyền hạn (RBAC)',
    auditLogs: 'Nhật ký kiểm toán',
    prismaModels: 'Mô hình Prisma (packages/db)',
    schemaViewer: 'Prisma Schema & FK',
    overviewCategory: 'Tổng quan',
    foundationCategory: 'Nền tảng',
    jobCategory: 'Kiến trúc nghề',
    assessmentCategory: 'Đánh giá',
    talentCategory: 'Nhân tài',
    systemCategory: 'Hệ thống DB',
  },
  en: {
    appName: 'CompetencyAI',
    appSubtitle: 'AI Talent Management Intelligence',
    phaseBanner: 'Phase-0 UI Prototype — B.8 Standard: FLA-5 5-Level Scale, Organization Hierarchy, UserScope RLS & Prisma ORM.',
    themeToggle: 'Theme',
    aiAssistant: 'AI Assistant',
    dashboard: 'Dashboard',
    organization: 'Organization Hierarchy',
    competencyDictionary: 'Competency Dictionary',
    proficiencyScales: 'FLA-5 Proficiency Scale (5 levels)',
    skillTaxonomy: 'Skill Taxonomy',
    jobArchitecture: 'Job Family & Levels',
    successProfile: 'Success Profile',
    jobDescription: 'Job Description',
    assessment360: '360 Campaign',
    competencyGap: 'Competency Gap Analysis',
    calibration9box: '9-Box Calibration',
    successionIDP: 'Succession & IDP',
    dataScopes: 'Data Scopes & RLS',
    rbacPermissions: 'Roles & RBAC',
    auditLogs: 'Audit Trail Logs',
    prismaModels: 'Prisma Models (packages/db)',
    schemaViewer: 'Prisma Schema & FK',
    overviewCategory: 'Overview',
    foundationCategory: 'Foundation',
    jobCategory: 'Job Architecture',
    assessmentCategory: 'Assessment',
    talentCategory: 'Talent Management',
    systemCategory: 'Database & System',
  }
};

export interface PersonaOption {
  id: string;
  nameVi: string;
  nameEn: string;
  roleCode: string;
  scopeDescVi: string;
  scopeDescEn: string;
  badgeColor: string;
}

export const PERSONAS: PersonaOption[] = [
  {
    id: 'hr_bp',
    nameVi: 'HR Business Partner',
    nameEn: 'HR Business Partner',
    roleCode: 'HR_LEAD',
    scopeDescVi: 'Toàn bộ Khối / Phòng ban trực thuộc theo Scope',
    scopeDescEn: 'All scoped divisions and assigned departments',
    badgeColor: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
  },
  {
    id: 'super_admin',
    nameVi: 'Super Administrator',
    nameEn: 'Super Administrator',
    roleCode: 'SUPER_ADMIN',
    scopeDescVi: 'Toàn quyền hệ thống & Quản trị dữ liệu toàn cầu',
    scopeDescEn: 'Global enterprise data governance & full system admin',
    badgeColor: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-400',
  },
  {
    id: 'unit_mgr',
    nameVi: 'Trưởng đơn vị (Unit Manager)',
    nameEn: 'Unit Manager',
    roleCode: 'UNIT_MANAGER',
    scopeDescVi: 'Quản lý nhân sự trong phòng ban và cây cấp dưới (Subtree)',
    scopeDescEn: 'Manage department team members and recursive subtrees',
    badgeColor: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400',
  },
  {
    id: 'employee',
    nameVi: 'Cán bộ Nhân viên (Employee)',
    nameEn: 'Employee Self-Service',
    roleCode: 'EMPLOYEE',
    scopeDescVi: 'Hồ sơ năng lực cá nhân, kết quả 360°, tiến độ IDP 70-20-10 & nguyện vọng',
    scopeDescEn: 'Personal competency passport, 360 result, IDP 70-20-10 & aspirations',
    badgeColor: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-400',
  },
  {
    id: 'auditor',
    nameVi: 'Kiểm toán & Tuân thủ',
    nameEn: 'Security & Compliance Auditor',
    roleCode: 'SECURITY_AUDITOR',
    scopeDescVi: 'Chỉ đọc AuditLog, RBAC & lịch sử phân quyền',
    scopeDescEn: 'Read-only access to AuditLog, RBAC & RLS trail',
    badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400',
  }
];
