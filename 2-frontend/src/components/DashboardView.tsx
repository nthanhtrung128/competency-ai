import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Building2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Sliders,
  CheckCircle2,
  Lock,
  ChevronRight,
  Database,
  UploadCloud,
} from 'lucide-react';
import { Language } from '../data/i18n';
import { useApp } from '../context/AppContext';

interface DashboardViewProps {
  lang: Language;
  onNavigate: (tabKey: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ lang, onNavigate }) => {
  const isVi = lang === 'vi';
  const { orgUnits, competencies, versions, assessmentScores, users, successionPlans } = useApp();

  const unitsWithoutHead = orgUnits.filter((u) => !u.headUserId).length;
  const publishedVersions = versions.filter((v) => v.status === 'PUBLISHED');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-head flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
            {isVi ? 'Bảng điều khiển Tổng quan Doanh nghiệp' : 'Enterprise Executive Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] max-w-3xl mt-1">
            {isVi
              ? 'Hệ thống Quản trị Năng lực Toàn diện (GĐ0 ➔ GĐ4): thang FLA-5 (5 mức), RLS UserScope, 360° & Kế thừa.'
              : 'End-to-End Competency Management (Phase 0 ➔ 4): FLA-5 5-Level, RLS UserScope, 360° & Succession.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('dataHub')}
          className="btn btn-secondary text-xs font-bold flex items-center gap-2 self-start md:self-auto border-[var(--brand)] text-[var(--brand)] bg-[var(--brand-50)]"
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isVi ? 'Trung tâm Dữ liệu (Updata & Roadmap)' : 'Data Hub & Roadmap'}</span>
        </button>
      </div>

      {/* KPI Cards Grid (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Profile Coverage */}
        <div
          id="kpi-card-profile-coverage"
          className="app-card cursor-pointer hover:border-[var(--brand)] transition group"
          onClick={() => onNavigate('successProfiles')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--ink)]">
              {isVi ? 'Độ bao phủ hồ sơ' : 'Profile Coverage'}
            </h3>
            <span className="text-[10px] font-mono text-[var(--ok)] bg-[var(--ok-bg)] px-2 py-0.5 rounded-full font-bold">
              100%
            </span>
          </div>
          <div className="kpi-text text-[var(--ink)]">100%</div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {isVi ? `${competencies.length} năng lực đã chuẩn hóa` : `${competencies.length} competencies standardized`}
          </div>
          <div className="gauge-bar">
            <span className="gauge-bar-fill ok" style={{ width: '100%' }}></span>
          </div>
        </div>

        {/* Card 2: Active Competencies */}
        <div
          id="kpi-card-active-competencies"
          className="app-card cursor-pointer hover:border-[var(--brand)] transition group"
          onClick={() => onNavigate('scales')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--ink)]">
              {isVi ? 'Năng lực đang hiệu lực' : 'Active Competencies'}
            </h3>
            <span className="text-[10px] font-mono text-[var(--ok)] bg-[var(--ok-bg)] px-2 py-0.5 rounded-full font-bold">
              KF-4L
            </span>
          </div>
          <div className="kpi-text text-[var(--ink)]">{competencies.length}</div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {isVi
              ? `${publishedVersions.length} phiên bản đã ban hành chính thức`
              : `${publishedVersions.length} published versions`}
          </div>
          <div className="gauge-bar">
            <span className="gauge-bar-fill ok" style={{ width: '100%' }}></span>
          </div>
        </div>

        {/* Card 3: Units Without Head */}
        <div
          id="kpi-card-units-without-head"
          className="app-card cursor-pointer hover:border-[var(--brand)] transition group"
          onClick={() => onNavigate('hierarchy')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--ink)]">
              {isVi ? 'Đơn vị chưa bổ nhiệm trưởng' : 'Units Without Head'}
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${unitsWithoutHead > 0 ? 'text-[var(--warn)] bg-[var(--warn-bg)]' : 'text-[var(--ok)] bg-[var(--ok-bg)]'}`}>
              {unitsWithoutHead > 0 ? 'Alert' : 'OK'}
            </span>
          </div>
          <div className={`kpi-text ${unitsWithoutHead > 0 ? 'text-[var(--warn)]' : 'text-[var(--ink)]'}`}>{unitsWithoutHead}</div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {isVi ? `trên tổng ${orgUnits.length} đơn vị tổ chức` : `out of ${orgUnits.length} organizational units`}
          </div>
          <div className="gauge-bar">
            <span className={`gauge-bar-fill ${unitsWithoutHead > 0 ? 'warn' : 'ok'}`} style={{ width: `${Math.min(unitsWithoutHead * 10, 100)}%` }}></span>
          </div>
        </div>

        {/* Card 4: Open Campaign */}
        <div
          id="kpi-card-open-campaign"
          className="app-card cursor-pointer hover:border-[var(--brand)] transition group"
          onClick={() => onNavigate('assessment360')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--ink)]">
              {isVi ? 'Phiếu Đánh giá 360° Đã Nộp' : 'Submitted 360 Forms'}
            </h3>
            <span className="text-[10px] font-mono text-[var(--ok)] bg-[var(--ok-bg)] px-2 py-0.5 rounded-full font-bold">
              ACTIVE
            </span>
          </div>
          <div className="kpi-text text-[var(--ok)]">{assessmentScores.length}</div>
          <div className="text-[11.5px] text-[var(--muted)]">
            {isVi ? `${users.length} nhân sự tham gia đánh giá` : `${users.length} enrolled employees`}
          </div>
          <div className="gauge-bar">
            <span className="gauge-bar-fill" style={{ width: '85%' }}></span>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Competency Versions Table + Org Tree Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Competency Dictionary - Recent Versions */}
        <div className="lg:col-span-7 app-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isVi
                  ? 'Từ điển năng lực — phiên bản gần nhất'
                  : 'Competency Dictionary — Recent Versions'}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {isVi
                  ? 'Chỉ báo hành vi gắn theo phiên bản (v1, v2, v3), không ghi đè lịch sử'
                  : 'Behavioral indicators are version-scoped; history is never overwritten'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('competencies')}
              className="text-xs text-[var(--brand)] font-semibold hover:underline flex items-center gap-1"
            >
              {isVi ? 'Xem tất cả' : 'View all'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">{isVi ? 'Mã' : 'Code'}</th>
                  <th className="py-2.5 px-3">{isVi ? 'Năng lực' : 'Competency'}</th>
                  <th className="py-2.5 px-3">{isVi ? 'Vai trò' : 'Role'}</th>
                  <th className="py-2.5 px-3">Ver</th>
                  <th className="py-2.5 px-3">{isVi ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                <tr className="hover:bg-[var(--brand-50)] transition cursor-pointer">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">CO1</td>
                  <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                    {isVi ? 'Chính trực & Tuân thủ' : 'Integrity & Compliance'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-core">CORE</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">v2</td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-active">ACTIVE</span>
                  </td>
                </tr>
                <tr className="hover:bg-[var(--brand-50)] transition cursor-pointer">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">CO4</td>
                  <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                    {isVi ? 'Trách nhiệm An toàn' : 'Safety Accountability'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-core">CORE</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">v1</td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-active">ACTIVE</span>
                  </td>
                </tr>
                <tr className="hover:bg-[var(--brand-50)] transition cursor-pointer">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">LE2</td>
                  <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                    {isVi ? 'Ra quyết định khi không chắc chắn' : 'Decision under Uncertainty'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-lead">MGMT</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">v3</td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-draft">DRAFT</span>
                  </td>
                </tr>
                <tr className="hover:bg-[var(--brand-50)] transition cursor-pointer">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">FU23</td>
                  <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                    {isVi ? 'Quản trị Doanh thu & Chi phí' : 'Revenue Management'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-func">FUNC</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">v1</td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-active">ACTIVE</span>
                  </td>
                </tr>
                <tr className="hover:bg-[var(--brand-50)] transition cursor-pointer">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ink)]">ENG-01</td>
                  <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                    {isVi ? 'Kiến trúc Cơ sở dữ liệu & Prisma ORM' : 'Relational Database Architecture'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-func">TECH</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">v2</td>
                  <td className="py-2.5 px-3">
                    <span className="badge-pill b-active">ACTIVE</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Organization Tree Preview */}
        <div className="lg:col-span-5 app-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isVi ? 'Cây cơ cấu tổ chức' : 'Organization Tree'}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {isVi ? 'tier linh hoạt · trưởng đơn vị tuỳ chọn' : 'flexible tiers · optional unit head'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('hierarchy')}
              className="text-xs text-[var(--brand)] font-semibold hover:underline flex items-center gap-1"
            >
              {isVi ? 'Toàn cảnh cây' : 'Full tree'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1 text-xs font-sans">
            {/* T0 Node */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T0
              </span>
              <strong className="text-[var(--ink)]">Flamingo Group / Enterprise Global</strong>
            </div>

            {/* T1 Node */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-6">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T1
              </span>
              <span className="text-[var(--ink)]">
                {isVi ? 'Khối Đầu tư – Xây dựng' : 'Investment & Construction Block'}
              </span>
            </div>

            {/* T2 Nodes */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-12">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T2
              </span>
              <span className="text-[var(--ink)]">{isVi ? 'Ban Đầu tư' : 'Investment Dept'}</span>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-12">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T2
              </span>
              <span className="text-[var(--ink)]">
                {isVi ? 'Ban Quy hoạch Kiến trúc' : 'Planning & Architecture'}
              </span>
              <span className="text-[10px] text-[var(--warn)] italic font-semibold">
                {isVi ? '· Chưa bổ nhiệm' : '· Not appointed'}
              </span>
            </div>

            {/* T1 Node */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-6">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T1
              </span>
              <span className="text-[var(--ink)]">
                {isVi ? 'Khối Công nghệ & Sản phẩm' : 'Technology & Innovation Division'}
              </span>
            </div>

            {/* T2 & T3 Nodes */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-12">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T2
              </span>
              <span className="text-[var(--ink)]">
                {isVi ? 'Ban Kỹ thuật Phần mềm (SWE)' : 'Software Engineering Dept'}
              </span>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--brand-50)] cursor-pointer pl-16">
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-100)] text-[var(--brand)]">
                T3
              </span>
              <span className="text-[var(--ink)]">
                {isVi ? 'Phòng Nền tảng & Cơ sở dữ liệu' : 'Platform & Database Core'}
              </span>
              <span className="badge-pill b-draft text-[9px] ml-1">NEW</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launchpad to Project Modules */}
      <div className="app-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--brand)]" />
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {isVi ? 'Khởi động nhanh các cấu phần hệ thống' : 'System Module Launchpad'}
            </h3>
          </div>
          <span className="text-xs text-[var(--muted)]">
            {isVi ? 'FLA-5 5-Level • UserScope RLS • Prisma ORM' : 'FLA-5 5-Level • UserScope RLS • Prisma ORM'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <button
            onClick={() => onNavigate('scales')}
            className="p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] bg-[var(--surface)] text-left space-y-1 transition group"
          >
            <div className="flex items-center justify-between">
              <Sliders className="w-4 h-4 text-amber-500" />
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--brand)]" />
            </div>
            <div className="font-bold text-xs text-[var(--ink)]">
              {isVi ? 'Thang đo FLA-5 (5 mức)' : 'FLA-5 5-Level Scales'}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              {isVi ? 'Nhận biết · Áp dụng cơ bản · Thành thạo · Nâng cao · Chuyên gia' : 'Aware · Basic · Proficient · Advanced · Expert'}
            </p>
          </button>

          <button
            onClick={() => onNavigate('scopes')}
            className="p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] bg-[var(--surface)] text-left space-y-1 transition group"
          >
            <div className="flex items-center justify-between">
              <Lock className="w-4 h-4 text-emerald-500" />
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--brand)]" />
            </div>
            <div className="font-bold text-xs text-[var(--ink)]">
              {isVi ? 'Phân quyền Dữ liệu (UserScope)' : 'Data Scopes & RLS'}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              {isVi ? 'Row-level security với kế thừa cây đơn vị' : 'Row-level security with tree inheritance'}
            </p>
          </button>

          <button
            onClick={() => onNavigate('assessment360')}
            className="p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] bg-[var(--surface)] text-left space-y-1 transition group"
          >
            <div className="flex items-center justify-between">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--brand)]" />
            </div>
            <div className="font-bold text-xs text-[var(--ink)]">
              {isVi ? 'Đánh giá 360° & 9-Box' : '360° Assessment & 9-Box'}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              {isVi ? 'Kỳ 2026-H1 & Ma trận hiệu chuẩn 9 ô' : 'Campaign 2026-H1 & 9-box matrix'}
            </p>
          </button>

          <button
            onClick={() => onNavigate('models')}
            className="p-3 rounded-lg border border-[var(--line)] hover:border-[var(--brand)] bg-[var(--surface)] text-left space-y-1 transition group"
          >
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--brand)]" />
            </div>
            <div className="font-bold text-xs text-[var(--ink)]">
              {isVi ? 'Mô hình Prisma (12 Models)' : 'Prisma Models (12 Models)'}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              {isVi ? 'packages/db/prisma/schema.prisma' : 'packages/db/prisma/schema.prisma'}
            </p>
          </button>
        </div>
      </div>

      {/* Phase 0 Acceptance Note matching User Prototype */}
      <div className="p-4 rounded-lg bg-[var(--brand-50)] border-l-4 border-[var(--brand)] text-xs text-[var(--muted)] leading-relaxed">
        <b className="text-[var(--brand-600)] dark:text-blue-400">
          {isVi ? 'Ghi chú nghiệm thu GĐ0:' : 'Phase-0 Acceptance Note:'}
        </b>{' '}
        {isVi
          ? 'Bản mẫu này đã tích hợp đầy đủ chuẩn giao diện B.8 — tông xanh dương #2563eb trên nền tint nhạt, sidebar phân nhóm uppercase eyebrow, topbar tích hợp chip persona & trợ lý AI, chuyển ngữ tức thì VI/EN, chế độ sáng/tối và hệ thống badge mã hóa loại. Toàn bộ cơ sở dữ liệu packages/db với mô hình ProficiencyScale (FLA-5 (5 levels)), UserScope (RLS), OrgUnit (Self-Ref FK) và AuditLog đã sẵn sàng cho các giai đoạn tiếp theo.'
          : 'This prototype fully adopts the B.8 UI standard — #2563eb blue theme on light tint, uppercase eyebrow sidebar categories, persona chip and AI Assistant in the topbar, instant VI/EN language switching, light/dark modes, and type-coded badge tags. The entire packages/db data layer with ProficiencyScale (FLA-5 (5 levels)), UserScope (RLS), OrgUnit (Self-Ref FK), and AuditLog is ready for subsequent phases.'}
      </div>
    </div>
  );
};
