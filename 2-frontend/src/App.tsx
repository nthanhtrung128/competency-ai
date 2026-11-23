/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Network,
  BookOpen,
  Sliders,
  Lock,
  Briefcase,
  Layers,
  Award,
  TrendingUp,
  Shield,
  History,
  FileCode,
  Database,
  Sparkles,
  Sun,
  Moon,
  ChevronDown,
  UserCheck,
  Check,
  BarChart3,
  Compass,
  FileCheck2,
} from 'lucide-react';
import { I18N, Language, PERSONAS, PersonaOption } from './data/i18n';
import { DashboardView } from './components/DashboardView';
import { OrgHierarchyTree } from './components/OrgHierarchyTree';
import { ProficiencyScaleExplorer } from './components/ProficiencyScaleExplorer';
import { CompetencyVersionMatrix } from './components/CompetencyVersionMatrix';
import { UserScopeMatrix } from './components/UserScopeMatrix';
import { SuccessProfileView } from './components/SuccessProfileView';
import { AssessmentAndTalentView } from './components/AssessmentAndTalentView';
import { RBACExplorer } from './components/RBACExplorer';
import { AuditLogViewer } from './components/AuditLogViewer';
import { ModelExplorer } from './components/ModelExplorer';
import { PrismaSchemaViewer } from './components/PrismaSchemaViewer';
import { DataHubView } from './components/DataHubView';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AppProvider, useApp } from './context/AppContext';
import { ServerConnectButton, ServerConnectModal, NoticeToast, ServerModeBanner } from './components/ServerConnectPanel';
import { TalentHub } from './components/server/TalentHub';
import { ReviewDesk } from './components/server/ReviewDesk';
import { ServerDashboard } from './components/server/ServerDashboard';

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
} from './data/seedData';

type TabKey =
  | 'dashboard'
  | 'review'
  | 'hierarchy'
  | 'competencies'
  | 'scales'
  | 'scopes'
  | 'jobArchitecture'
  | 'successProfiles'
  | 'assessment360'
  | 'talent9box'
  | 'executiveAnalytics'
  | 'talentMobility'
  | 'rbac'
  | 'audit'
  | 'dataHub'
  | 'models'
  | 'schema';

function AppContent() {
  const {
    lang,
    setLang,
    theme,
    setTheme,
    activePersona,
    setActivePersona,
    proficiencyScales,
    competencies,
    versions,
    jobFamilies,
    auditLogs,
    dataSource,
  } = useApp();
  const isServer = dataSource === 'SERVER';
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Sync theme with body data-theme attribute
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-lang', lang);
  }, [theme, lang]);

  const t = I18N[lang];
  const isVi = lang === 'vi';

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div
      id="competency-ai-app"
      className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col antialiased selection:bg-[var(--brand)] selection:text-white"
    >
      {/* ---------- TOPBAR ---------- */}
      <header
        id="app-topbar"
        className="h-16 bg-[var(--surface)] border-b border-[var(--line)] sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors"
      >
        {/* Logo and App Title */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveTab('dashboard')}
            className="cursor-pointer w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--violet)] flex items-center justify-center text-white font-extrabold text-sm shadow-md"
          >
            CA
          </div>
          <div className="cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="flex items-center gap-2">
              <b className="text-sm tracking-tight text-[var(--ink)] font-bold">
                {t.appName}
              </b>
              <span className="hidden sm:inline text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
                B.8 UI Standard · GĐ0
              </span>
            </div>
            <span className="block text-[10.5px] text-[var(--muted)]">
              {t.appSubtitle}
            </span>
          </div>
        </div>

        {/* Topbar Actions */}
        <div className="flex items-center gap-2.5">
          <ServerConnectButton onOpen={() => setServerModalOpen(true)} />
          {/* Persona mô phỏng chỉ có ý nghĩa ở chế độ Demo — ở chế độ Máy chủ, vai trò là của tài khoản thật */}
          {!isServer && (
          <>
          {/* Persona Switcher Dropdown */}
          <div className="relative">
            <button
              id="persona-switcher-btn"
              onClick={() => setPersonaMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[var(--brand-100)] transition"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
              <span>{isVi ? activePersona.nameVi : activePersona.nameEn}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {personaMenuOpen && (
              <div
                id="persona-dropdown-menu"
                className="absolute right-0 mt-2 w-72 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)] mb-1">
                  {isVi ? 'Chọn vai trò / Persona mô phỏng:' : 'Switch Persona Context:'}
                </div>
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePersona(p);
                      setPersonaMenuOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition flex items-center justify-between ${
                      activePersona.id === p.id
                        ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                        : 'text-[var(--ink)] hover:bg-[var(--line)]/40'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{isVi ? p.nameVi : p.nameEn}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {isVi ? p.scopeDescVi : p.scopeDescEn}
                      </div>
                    </div>
                    {activePersona.id === p.id && (
                      <Check className="w-3.5 h-3.5 text-[var(--brand)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
          )}

          {/* Segmented Language Switcher */}
          <div className="flex border border-[var(--line)] rounded-lg overflow-hidden bg-[var(--surface)] text-xs font-bold">
            <button
              onClick={() => setLang('vi')}
              className={`px-2.5 py-1.5 transition ${
                lang === 'vi'
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              VI
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1.5 transition ${
                lang === 'en'
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              EN
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs font-semibold hover:border-[var(--brand)] hover:text-[var(--brand)] transition"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isVi ? 'Tối' : 'Dark'}</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{isVi ? 'Sáng' : 'Light'}</span>
              </>
            )}
          </button>

          {/* AI Assistant Button */}
          <button
            id="ai-copilot-btn"
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-600)] text-white text-xs font-bold shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.aiAssistant}</span>
          </button>
        </div>
      </header>
      <ServerModeBanner />
      <ServerConnectModal open={serverModalOpen} onClose={() => setServerModalOpen(false)} />
      <NoticeToast />

      {/* ---------- MAIN LAYOUT SHELL ---------- */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
        {/* ---------- SIDEBAR NAVIGATION ---------- */}
        <aside
          id="app-sidebar"
          className="w-full md:w-64 bg-[var(--surface)] border-r border-[var(--line)] p-4 flex flex-col shrink-0 overflow-y-auto space-y-4"
        >
          {/* Section: Overview */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] px-2 pb-1.5">
              {t.overviewCategory}
            </div>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'dashboard'
                  ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                  : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 opacity-80" />
              <span>{t.dashboard}</span>
            </button>
          </div>

          {/* Section: Foundation */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] px-2 pb-1.5">
              {t.foundationCategory}
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab('hierarchy')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'hierarchy'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Network className="w-4 h-4 opacity-80" />
                <span>{t.organization}</span>
              </button>

              {isServer && (
                <button
                  onClick={() => setActiveTab('review')}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                    activeTab === 'review' ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold' : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileCheck2 className="w-4 h-4 opacity-80" />
                    <span>Bàn duyệt (HR)</span>
                  </div>
                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--warn-bg)] text-[var(--warn)]">QĐ</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('competencies')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'competencies'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 opacity-80" />
                  <span>{t.competencyDictionary}</span>
                </div>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--warn-bg)] text-[var(--warn)]">
                  v2
                </span>
              </button>

              <button
                onClick={() => setActiveTab('scales')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'scales'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-4 h-4 text-amber-500 opacity-80" />
                  <span>{t.proficiencyScales}</span>
                </div>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--ok-bg)] text-[var(--ok)]">
                  5 mức
                </span>
              </button>

              <button
                onClick={() => setActiveTab('scopes')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'scopes'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Lock className="w-4 h-4 text-emerald-500 opacity-80" />
                <span>{t.dataScopes}</span>
              </button>
            </div>
          </div>

          {/* Section: Job Architecture */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] px-2 pb-1.5">
              {t.jobCategory}
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab('jobArchitecture')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'jobArchitecture'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Briefcase className="w-4 h-4 opacity-80" />
                <span>{t.jobArchitecture}</span>
              </button>

              <button
                onClick={() => setActiveTab('successProfiles')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'successProfiles'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Layers className="w-4 h-4 opacity-80" />
                <span>{t.successProfile}</span>
              </button>
            </div>
          </div>

          {/* Section: Assessment & Talent */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] px-2 pb-1.5">
              {t.assessmentCategory} &amp; {t.talentCategory}
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab('assessment360')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'assessment360'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 opacity-80" />
                  <span>{t.assessment360}</span>
                </div>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--ok-bg)] text-[var(--ok)]">
                  Active
                </span>
              </button>

              <button
                onClick={() => setActiveTab('talent9box')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'talent9box'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Award className="w-4 h-4 opacity-80" />
                <span>{t.calibration9box}</span>
              </button>

              <button
                onClick={() => setActiveTab('executiveAnalytics')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'executiveAnalytics'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-indigo-500 opacity-80" />
                  <span>{isVi ? 'Bản đồ Nhiệt Lãnh đạo' : 'Executive Heatmap'}</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  QT01-08
                </span>
              </button>

              <button
                onClick={() => setActiveTab('talentMobility')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'talentMobility'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-500 opacity-80" />
                <span>{isVi ? 'Mô phỏng Bổ nhiệm & Luân chuyển' : 'Talent Mobility'}</span>
              </button>
            </div>
          </div>

          {/* Section: Database & System Architecture */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] px-2 pb-1.5">
              {t.systemCategory}
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTab('rbac')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'rbac'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Shield className="w-4 h-4 opacity-80" />
                <span>{t.rbacPermissions}</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'audit'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <History className="w-4 h-4 opacity-80" />
                <span>{t.auditLogs}</span>
              </button>

              <button
                onClick={() => setActiveTab('dataHub')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'dataHub'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-sky-500 opacity-80" />
                  <span>{isVi ? 'Trung tâm Dữ liệu & Import' : 'Data Hub & Import'}</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  Hub
                </span>
              </button>

              <button
                onClick={() => setActiveTab('models')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'models'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <Database className="w-4 h-4 opacity-80" />
                <span>{t.prismaModels}</span>
              </button>

              <button
                onClick={() => setActiveTab('schema')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                  activeTab === 'schema'
                    ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'text-[var(--ink)] hover:bg-[var(--brand-50)]'
                }`}
              >
                <FileCode className="w-4 h-4 opacity-80" />
                <span>{t.schemaViewer}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ---------- MAIN CONTENT ROUTER ---------- */}
        <main
          id="app-main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6"
        >
          {activeTab === 'dashboard' && (isServer
            ? <ServerDashboard onNavigate={(tab) => setActiveTab(tab as TabKey)} />
            : <DashboardView lang={lang} onNavigate={(tab) => setActiveTab(tab as TabKey)} />)}

          {activeTab === 'review' && isServer && <ReviewDesk />}

          {activeTab === 'hierarchy' && (
            <OrgHierarchyTree />
          )}

          {activeTab === 'competencies' && (
            <CompetencyVersionMatrix />
          )}

          {activeTab === 'scales' && (
            <ProficiencyScaleExplorer
              scales={proficiencyScales}
              competencies={competencies}
              versions={versions}
            />
          )}

          {activeTab === 'scopes' && (isServer ? <TalentHub key="accounts" initial="accounts" /> : <UserScopeMatrix />)}

          {activeTab === 'jobArchitecture' && (
            <SuccessProfileView
              lang={lang}
              jobFamilies={jobFamilies}
              competencies={competencies}
            />
          )}

          {activeTab === 'successProfiles' && (
            <SuccessProfileView
              lang={lang}
              jobFamilies={jobFamilies}
              competencies={competencies}
            />
          )}

          {/* QĐ-06: ở chế độ Máy chủ, 360° / 9-Box / IDP chạy trên dữ liệu thật */}
          {activeTab === 'assessment360' && (isServer ? <TalentHub key="tasks" initial="tasks" /> : <AssessmentAndTalentView initialSubTab="360" />)}

          {activeTab === 'talent9box' && (isServer ? <TalentHub key="9box" initial="9box" /> : <AssessmentAndTalentView initialSubTab="9box" />)}

          {activeTab === 'executiveAnalytics' && (isServer ? <TalentHub key="results" initial="results" /> : <AssessmentAndTalentView initialSubTab="analytics" />)}

          {/* Mô phỏng luân chuyển vẫn là minh họa; IDP thật nằm trong tab IDP của TalentHub */}
          {activeTab === 'talentMobility' && <AssessmentAndTalentView initialSubTab="mobility" />}

          {activeTab === 'rbac' && (
            <RBACExplorer
              roles={SEED_ROLES}
              permissions={SEED_PERMISSIONS}
              rolePermissions={SEED_ROLE_PERMISSIONS}
              users={SEED_USERS}
              userRoles={SEED_USER_ROLES}
            />
          )}

          {activeTab === 'audit' && <AuditLogViewer logs={auditLogs} />}

          {activeTab === 'dataHub' && <DataHubView />}

          {activeTab === 'models' && <ModelExplorer />}

          {activeTab === 'schema' && <PrismaSchemaViewer />}
        </main>
      </div>

      {/* ---------- MULTI-PHASE ROADMAP ADVISOR (STEP-BY-STEP GUIDANCE) ---------- */}
{!isServer && (
      <section
        id="phase-roadmap-advisor"
        className="border-t border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6 lg:px-8 py-5"
      >
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                {isVi
                  ? 'Gợi ý Lộ trình Triển khai Chi tiết từng Giai đoạn (GĐ0 ➔ GĐ4)'
                  : 'Step-by-Step Multi-Phase Implementation Roadmap (GĐ0 ➔ GĐ4)'}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[var(--muted)]">
              CompetencyAI Engineering Architecture
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {/* Phase 0 */}
            <div className="p-3 rounded-lg border-2 border-[var(--brand)] bg-[var(--brand-50)] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--brand)]">GĐ0: UI B.8 &amp; Schema</span>
                <span className="badge-pill b-active text-[9px]">HIỆN TẠI</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Nghiệm thu chuẩn UI B.8, Prisma ORM 12 Models, FLA-5 5-Level & UserScope RLS.'
                  : 'Sign off B.8 UI, Prisma ORM 12 Models, FLA-5 (5 levels) & UserScope RLS.'}
              </p>
            </div>

            {/* Phase 1 */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--ink)]">GĐ1: Foundation API</span>
                <span className="badge-pill b-draft text-[9px]">GĐ TIẾP THEO</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Viết API Cơ cấu tổ chức (OrgUnit CRUD, Self-Ref Tree), User & RBAC middleware.'
                  : 'OrgUnit CRUD APIs, recursive tree traversal, User & RBAC auth middleware.'}
              </p>
            </div>

            {/* Phase 2 */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--ink)]">GĐ2: Competency Core</span>
                <span className="badge-pill b-core text-[9px]">KẾ HOẠCH</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Quản lý phiên bản từ điển năng lực (Draft/Publish), mapping Job Family & Success Profile.'
                  : 'Competency versioning lifecycle, Job Family mapping & Success Profile benchmarks.'}
              </p>
            </div>

            {/* Phase 3 */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--ink)]">GĐ3: 360 &amp; Gap Engine</span>
                <span className="badge-pill b-func text-[9px]">KẾ HOẠCH</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Chiến dịch đánh giá 360°, tính điểm theo thang FLA-5, biểu đồ Radar khoảng cách.'
                  : '360 multi-rater campaign, FLA-5 score aggregations & competency gap radar.'}
              </p>
            </div>

            {/* Phase 4 */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--ink)]">GĐ4: 9-Box &amp; AI Copilot</span>
                <span className="badge-pill b-lead text-[9px]">TƯƠNG LAI</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Hiệu chuẩn nhân tài 9-Box, kế hoạch kế thừa và Trợ lý AI tự động sinh IDP.'
                  : '9-Box talent calibration, succession readiness pipelines & AI IDP generator.'}
              </p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ---------- AI ASSISTANT MODAL ---------- */}
      <AIAssistantModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
