import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Compass,
  GraduationCap,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  MessageSquare,
  Send,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Eye,
  FileText,
  Check,
  Users,
  ArrowUpRight,
  Building2,
  HelpCircle,
  ThumbsUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SelfServiceHubView: React.FC = () => {
  const {
    lang,
    users,
    jobRoles,
    competencies,
    versions,
    assessmentScores,
    idpPlans,
    toggleIDPTask,
    addIDPCheckInNote,
    endorseIDPPlan,
    submitCareerAspiration,
    activePersona,
    orgUnits,
  } = useApp();

  const isVi = lang === 'vi';

  // Mode: Employee Self-Service (Cá nhân) vs Manager Hub (Quản lý đội ngũ)
  const defaultMode = activePersona.roleCode === 'UNIT_MANAGER' ? 'manager' : 'employee';
  const [hubMode, setHubMode] = useState<'employee' | 'manager'>(defaultMode);

  // Selected employee for Employee Mode
  // If activePersona is employee, default to usr-swe-1 (David Kim) or first employee
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (activePersona.roleCode === 'UNIT_MANAGER') {
      return 'usr-dev-lead'; // Elena Rostova
    }
    return 'usr-swe-1'; // David Kim
  });

  // Selected manager for Manager Mode
  const [selectedManagerId, setSelectedManagerId] = useState<string>('usr-head-eng'); // Marcus Vance

  // New Check-in note input state
  const [checkInText, setCheckInText] = useState('');
  const [checkInAuthorRole, setCheckInAuthorRole] = useState<'EMPLOYEE' | 'MANAGER'>(
    hubMode === 'manager' ? 'MANAGER' : 'EMPLOYEE'
  );

  // Career Aspiration Modal / Form State
  const [aspirationRoleCode, setAspirationRoleCode] = useState<string>('R14');
  const [aspirationNotes, setAspirationNotes] = useState('');
  const [aspirationSuccessMsg, setAspirationSuccessMsg] = useState(false);

  // Manager Endorsement modal state
  const [endorsingIdpId, setEndorsingIdpId] = useState<string | null>(null);
  const [endorsementComment, setEndorsementComment] = useState('');

  // 1. Current Selected User Details
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || users[0];
  }, [users, selectedUserId]);

  // Current Manager Details
  const currentManager = useMemo(() => {
    return users.find((u) => u.id === selectedManagerId) || users[2];
  }, [users, selectedManagerId]);

  // Find user's Job Role
  const currentUserRole = useMemo(() => {
    // Match by title or standard mapped role
    if (currentUser.id === 'usr-swe-1') {
      return jobRoles.find((r) => r.code === 'R21') || jobRoles[0];
    }
    if (currentUser.id === 'usr-dev-lead') {
      return jobRoles.find((r) => r.code === 'R17') || jobRoles[0];
    }
    return (
      jobRoles.find((r) => r.titleVi.toLowerCase() === currentUser.title.toLowerCase()) ||
      jobRoles[0]
    );
  }, [currentUser, jobRoles]);

  // User's IDP Plans
  const userIdpPlans = useMemo(() => {
    return idpPlans.filter((p) => p.userId === currentUser.id);
  }, [idpPlans, currentUser.id]);

  const activeIDP = userIdpPlans[0] || null;

  // Competency benchmark comparison for currentUser
  const competencyBenchmark = useMemo(() => {
    if (!currentUserRole || !currentUserRole.requirements) return [];

    return currentUserRole.requirements.map((req) => {
      const comp = competencies.find((c) => c.code === req.competency);
      const userScores = assessmentScores.filter(
        (s) => s.evaluateeId === currentUser.id && s.competencyId === comp?.id
      );

      let actualScore = 0;
      if (userScores.length > 0) {
        const sum = userScores.reduce((acc, curr) => acc + curr.scoreLevel, 0);
        actualScore = Math.round((sum / userScores.length) * 10) / 10;
      } else {
        // reasonable fallback demo score
        actualScore = Math.max(1, req.requiredLevel - (req.competency === 'FU39' ? 1 : 0));
      }

      const diff = Math.round((actualScore - req.requiredLevel) * 10) / 10;
      let status: 'exceeded' | 'met' | 'gap' = 'met';
      if (diff > 0) status = 'exceeded';
      else if (diff < 0) status = 'gap';

      return {
        code: req.competency,
        name: comp?.name || req.competency,
        category: (typeof comp?.category === 'string' ? comp.category : comp?.category?.name) || 'Chuyên môn',
        requiredLevel: req.requiredLevel,
        actualScore,
        diff,
        status,
      };
    });
  }, [currentUserRole, competencies, assessmentScores, currentUser.id]);

  // Calculate Overall Fulfillment %
  const overallFulfillment = useMemo(() => {
    if (competencyBenchmark.length === 0) return 100;
    const metCount = competencyBenchmark.filter((b) => b.diff >= 0).length;
    return Math.round((metCount / competencyBenchmark.length) * 100);
  }, [competencyBenchmark]);

  // Calculate Active IDP Progress %
  const idpProgress = useMemo(() => {
    if (!activeIDP) return 0;
    const total =
      activeIDP.experiential70.length +
      activeIDP.exposure20.length +
      activeIDP.education10.length;
    if (total === 0) return 0;
    const completed = activeIDP.completedTasks?.length || 0;
    return Math.min(100, Math.round((completed / total) * 100));
  }, [activeIDP]);

  // Target role for career aspiration preview
  const aspirationTargetRole = useMemo(() => {
    return jobRoles.find((r) => r.code === aspirationRoleCode) || jobRoles[0];
  }, [jobRoles, aspirationRoleCode]);

  // Aspiration Readiness Score
  const aspirationReadiness = useMemo(() => {
    if (!aspirationTargetRole || !aspirationTargetRole.requirements) return 75;
    let met = 0;
    aspirationTargetRole.requirements.forEach((req) => {
      const existing = competencyBenchmark.find((b) => b.code === req.competency);
      if (existing && existing.actualScore >= req.requiredLevel) {
        met++;
      }
    });
    return Math.round((met / aspirationTargetRole.requirements.length) * 100);
  }, [aspirationTargetRole, competencyBenchmark]);

  // Team Members for Manager Hub
  const teamMembers = useMemo(() => {
    // Return subordinates in CNTT / CĐS or related units
    return users.filter((u) => u.id !== currentManager.id);
  }, [users, currentManager.id]);

  // Handler: Add Check-in note
  const handleAddNote = (idpId: string) => {
    if (!checkInText.trim()) return;
    const authorName =
      checkInAuthorRole === 'EMPLOYEE' ? currentUser.name : currentManager.name;

    addIDPCheckInNote(idpId, {
      authorName,
      authorRole: checkInAuthorRole,
      content: checkInText.trim(),
    });
    setCheckInText('');
  };

  // Handler: Submit Aspiration
  const handleSubmitAspiration = () => {
    if (!aspirationTargetRole) return;
    submitCareerAspiration(
      currentUser.id,
      aspirationTargetRole.code,
      isVi ? aspirationTargetRole.titleVi : aspirationTargetRole.titleEn,
      aspirationNotes
    );
    setAspirationSuccessMsg(true);
    setTimeout(() => setAspirationSuccessMsg(false), 4000);
  };

  // Handler: Manager Endorsement
  const handleConfirmEndorsement = () => {
    if (!endorsingIdpId) return;
    endorseIDPPlan(endorsingIdpId, {
      endorsedBy: currentManager.name,
      comments:
        endorsementComment.trim() ||
        'Đã kiểm tra minh chứng thực tế và xác nhận đạt yêu cầu bậc năng lực.',
    });
    setEndorsingIdpId(null);
    setEndorsementComment('');
  };

  return (
    <div className="space-y-6">
      {/* HEADER WITH MODE TOGGLER */}
      <div className="bg-gradient-to-r from-[var(--brand)] to-indigo-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/5 skew-x-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm mb-2">
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {isVi
                  ? 'Cổng Tự Phục Vụ Nhân Viên & Quản Lý Trực Tiếp'
                  : 'Employee & Manager Self-Service Hub'}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              {hubMode === 'employee'
                ? isVi
                  ? 'Hồ Sơ Năng Lực Cá Nhân & Lộ Trình Phát Triển'
                  : 'Personal Talent Passport & Growth Tracker'
                : isVi
                ? 'Bàn Làm Việc Quản Lý Trực Tiếp & Phê Duyệt IDP'
                : 'Manager Team Hub & IDP Endorsement'}
            </h1>
            <p className="text-white/80 text-sm mt-1 max-w-2xl">
              {hubMode === 'employee'
                ? isVi
                  ? 'Theo dõi chuẩn chức danh Flamingo, cập nhật tiến độ IDP 70-20-10 và chủ động đề xuất nguyện vọng phát triển sự nghiệp.'
                  : 'Track your Flamingo role benchmark, complete 70-20-10 milestones, and submit career aspirations.'
                : isVi
                ? 'Giám sát tiến độ đánh giá 360°, ghi nhận phản hồi định kỳ 1-on-1 và bảo trợ kế hoạch phát triển của các thành viên trong đội ngũ.'
                : 'Supervise 360 assessments, log 1-on-1 coaching check-ins, and officially endorse team IDP plans.'}
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-white/10 p-1 rounded-lg border border-white/20 backdrop-blur-md shrink-0">
            <button
              onClick={() => {
                setHubMode('employee');
                setCheckInAuthorRole('EMPLOYEE');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition ${
                hubMode === 'employee'
                  ? 'bg-white text-[var(--brand)] shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{isVi ? 'Góc Cán bộ Nhân viên' : 'My Talent Passport'}</span>
            </button>
            <button
              onClick={() => {
                setHubMode('manager');
                setCheckInAuthorRole('MANAGER');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition ${
                hubMode === 'manager'
                  ? 'bg-white text-[var(--brand)] shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isVi ? 'Bàn làm việc Quản lý' : 'Manager Team Hub'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: EMPLOYEE SELF-SERVICE VIEW */}
      {/* ========================================================================= */}
      {hubMode === 'employee' && (
        <div className="space-y-6">
          {/* USER SELECTOR STRIP (FOR TESTING / MULTI-USER ROLES) */}
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-50)] text-[var(--brand)] font-black text-sm flex items-center justify-center border border-[var(--brand)]/20">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] font-medium">
                  {isVi ? 'Đang xem hồ sơ nhân sự:' : 'Viewing talent profile:'}
                </div>
                <div className="font-bold text-base text-[var(--ink)] flex items-center gap-2">
                  <span>{currentUser.name}</span>
                  <span className="text-xs font-normal text-[var(--muted)]">({currentUser.title})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted)] font-semibold whitespace-nowrap">
                {isVi ? 'Chuyển CBNV:' : 'Switch User:'}
              </span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                aria-label="Chọn cán bộ nhân viên"
                className="text-xs font-medium bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TOP OVERVIEW STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Chức danh chuẩn' : 'Target Role'}
                </span>
                <Briefcase className="w-4 h-4 text-[var(--brand)]" />
              </div>
              <div className="text-lg font-bold text-[var(--ink)] mt-2">
                [{currentUserRole?.code}] {isVi ? currentUserRole?.titleVi : currentUserRole?.titleEn}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {isVi ? 'Cấp bậc:' : 'Job Level:'} Bậc {currentUserRole?.jobLevel}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Tỷ lệ Đáp ứng Chuẩn' : 'Benchmark Fit'}
                </span>
                <Target className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {overallFulfillment}%
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {competencyBenchmark.filter((b) => b.diff >= 0).length} / {competencyBenchmark.length}{' '}
                {isVi ? 'năng lực đạt hoặc vượt' : 'competencies met'}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Tiến độ IDP 70-20-10' : 'IDP Progress'}
                </span>
                <GraduationCap className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-indigo-600 mt-2">
                {idpProgress}%
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {activeIDP?.completedTasks?.length || 0} /{' '}
                {(activeIDP?.experiential70.length || 0) +
                  (activeIDP?.exposure20.length || 0) +
                  (activeIDP?.education10.length || 0)}{' '}
                {isVi ? 'nhiệm vụ hoàn thành' : 'tasks completed'}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Bảo trợ Quản lý' : 'Manager Endorsement'}
                </span>
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-base font-bold text-[var(--ink)] mt-2">
                {activeIDP?.managerEndorsement ? (
                  <span className="text-emerald-600 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    {isVi ? 'Đã xác nhận bảo trợ' : 'Endorsed'}
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1.5 text-sm">
                    <Clock className="w-4 h-4" />
                    {isVi ? 'Đang thực hiện / Chưa ký' : 'Pending Sign-off'}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {activeIDP?.managerEndorsement
                  ? `${activeIDP.managerEndorsement.endorsedBy} (${activeIDP.managerEndorsement.endorsedAt})`
                  : isVi
                  ? 'Cần hoàn thành các mốc 70-20-10'
                  : 'Complete tasks to request review'}
              </div>
            </div>
          </div>

          {/* TWO COLUMNS: LEFT = IDP TRACKER (MAIN INTERACTIVE), RIGHT = BENCHMARK RADAR & ASPIRATIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: INTERACTIVE IDP TRACKER & CHECK-IN NOTES (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              {activeIDP ? (
                <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--brand-50)] text-[var(--brand)]">
                          IDP: {activeIDP.targetCompetencyCode}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold">
                          {activeIDP.timeline}
                        </span>
                      </div>
                      <h2 className="text-lg font-black text-[var(--ink)] mt-1">
                        {isVi
                          ? `Lộ Trình Bồi Dưỡng: Nâng từ Mức ${activeIDP.currentTier} lên Mức ${activeIDP.targetTier}`
                          : `Growth Plan: Advance from Level ${activeIDP.currentTier} to Level ${activeIDP.targetTier}`}
                      </h2>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-[var(--muted)]">{isVi ? 'Tiến độ thực hiện' : 'Progress'}</div>
                      <div className="text-xl font-black text-[var(--brand)]">{idpProgress}%</div>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-[var(--line)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--brand)] to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${idpProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-[var(--muted)]">
                      <span>{isVi ? 'Khởi động' : 'Initiated'}</span>
                      <span>{isVi ? 'Đang thực chiến (In Progress)' : 'In Progress'}</span>
                      <span>{isVi ? 'Hoàn tất & Đánh giá lại' : 'Completed'}</span>
                    </div>
                  </div>

                  {/* 70% EXPERIENTIAL (ON-THE-JOB) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                        70%
                      </span>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {isVi ? 'Trải nghiệm Thực chiến (Experiential / On-the-job Projects)' : 'Experiential Projects (70%)'}
                      </h3>
                    </div>

                    <div className="space-y-2 pl-8">
                      {activeIDP.experiential70.map((task, idx) => {
                        const isDone = activeIDP.completedTasks?.includes(task);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleIDPTask(activeIDP.id, task)}
                            className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3 ${
                              isDone
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--brand)]'
                            }`}
                          >
                            <button className="mt-0.5 shrink-0 text-emerald-600">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 fill-emerald-600 text-white" />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--muted)]" />
                              )}
                            </button>
                            <div className="text-xs leading-relaxed text-[var(--ink)]">
                              <span className={isDone ? 'line-through text-[var(--muted)] font-medium' : 'font-medium'}>
                                {task}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 20% EXPOSURE (MENTORING & SHADOWING) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center">
                        20%
                      </span>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {isVi ? 'Học hỏi từ Cố vấn & Quan sát (Social & Mentoring)' : 'Exposure & Mentoring (20%)'}
                      </h3>
                    </div>

                    <div className="space-y-2 pl-8">
                      {activeIDP.exposure20.map((task, idx) => {
                        const isDone = activeIDP.completedTasks?.includes(task);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleIDPTask(activeIDP.id, task)}
                            className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3 ${
                              isDone
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--brand)]'
                            }`}
                          >
                            <button className="mt-0.5 shrink-0 text-emerald-600">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 fill-emerald-600 text-white" />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--muted)]" />
                              )}
                            </button>
                            <div className="text-xs leading-relaxed text-[var(--ink)]">
                              <span className={isDone ? 'line-through text-[var(--muted)] font-medium' : 'font-medium'}>
                                {task}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 10% FORMAL EDUCATION */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                        10%
                      </span>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {isVi ? 'Đào tạo & Chứng chỉ Chuyên môn (Formal Education)' : 'Education & Certification (10%)'}
                      </h3>
                    </div>

                    <div className="space-y-2 pl-8">
                      {activeIDP.education10.map((task, idx) => {
                        const isDone = activeIDP.completedTasks?.includes(task);
                        return (
                          <div
                            key={idx}
                            onClick={() => toggleIDPTask(activeIDP.id, task)}
                            className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-3 ${
                              isDone
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--brand)]'
                            }`}
                          >
                            <button className="mt-0.5 shrink-0 text-emerald-600">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 fill-emerald-600 text-white" />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--muted)]" />
                              )}
                            </button>
                            <div className="text-xs leading-relaxed text-[var(--ink)]">
                              <span className={isDone ? 'line-through text-[var(--muted)] font-medium' : 'font-medium'}>
                                {task}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1-ON-1 COACHING & CHECK-IN NOTES LOG */}
                  <div className="pt-4 border-t border-[var(--line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                        <MessageSquare className="w-4 h-4 text-[var(--brand)]" />
                        <span>{isVi ? 'Nhật Ký Trao Đổi Định Kỳ 1-on-1' : '1-on-1 Check-In Log'}</span>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {activeIDP.checkInNotes?.length || 0} {isVi ? 'ghi nhận' : 'entries'}
                      </span>
                    </div>

                    {/* Check-in notes list */}
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {activeIDP.checkInNotes && activeIDP.checkInNotes.length > 0 ? (
                        activeIDP.checkInNotes.map((note) => (
                          <div
                            key={note.id}
                            className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    note.authorRole === 'MANAGER'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                  }`}
                                >
                                  {note.authorRole === 'MANAGER' ? 'Quản lý' : 'CBNV'}
                                </span>
                                <span>{note.authorName}</span>
                              </span>
                              <span className="text-[10px] text-[var(--muted)] font-mono">{note.date}</span>
                            </div>
                            <p className="text-[var(--ink)] leading-relaxed pl-1">{note.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-xs text-[var(--muted)] bg-[var(--bg)] rounded-lg border border-dashed border-[var(--line)]">
                          {isVi
                            ? 'Chưa có ghi chú 1-on-1 nào. Hãy gửi phản hồi hoặc đề xuất trao đổi với Quản lý.'
                            : 'No check-in notes yet. Add your reflections below.'}
                        </div>
                      )}
                    </div>

                    {/* Add note box */}
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={checkInText}
                        onChange={(e) => setCheckInText(e.target.value)}
                        placeholder={
                          isVi
                            ? 'Ghi nhận tiến độ nhiệm vụ thực tế hoặc đặt câu hỏi cho Quản lý...'
                            : 'Log milestone progress or leave notes for your manager...'
                        }
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddNote(activeIDP.id);
                        }}
                      />
                      <button
                        onClick={() => handleAddNote(activeIDP.id)}
                        className="px-3 py-2 rounded-lg bg-[var(--brand)] text-white text-xs font-bold hover:bg-[var(--brand-dark)] transition flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Ghi nhận' : 'Log'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-8 text-center space-y-3">
                  <GraduationCap className="w-12 h-12 text-[var(--muted)] mx-auto opacity-50" />
                  <h3 className="font-bold text-base text-[var(--ink)]">
                    {isVi ? 'Chưa có kế hoạch IDP kích hoạt' : 'No Active IDP Found'}
                  </h3>
                  <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
                    {isVi
                      ? 'Nhân sự chưa có lộ trình IDP 70-20-10 cho kỳ hiện tại. Bạn có thể sử dụng Trợ lý AI IDP trong phân hệ Đánh giá để tạo lộ trình chuẩn hóa.'
                      : 'Create a customized IDP in the Assessment tab.'}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: BENCHMARK SCORECARD & CAREER ASPIRATIONS (5 COLS) */}
            <div className="lg:col-span-5 space-y-6">
              {/* COMPETENCY BENCHMARK COMPACT TABLE */}
              <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>{isVi ? 'Đối Soát Chuẩn Chức Danh' : 'Role Benchmark Benchmark'}</span>
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      {isVi
                        ? `Vị trí: [${currentUserRole?.code}] Bậc ${currentUserRole?.jobLevel}`
                        : `Role: [${currentUserRole?.code}] Level ${currentUserRole?.jobLevel}`}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {overallFulfillment}% {isVi ? 'Đáp ứng' : 'Fit'}
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {competencyBenchmark.map((item) => (
                    <div
                      key={item.code}
                      className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--ink)] truncate">
                          [{item.code}] {item.name}
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">{item.category}</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-bold text-[var(--ink)]">
                            {item.actualScore} / {item.requiredLevel}
                          </div>
                          <div className="text-[10px] text-[var(--muted)]">Thực tế / Chuẩn</div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.diff > 0
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                              : item.diff === 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          {item.diff > 0 ? `+${item.diff}` : item.diff === 0 ? 'Đạt' : `${item.diff}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CAREER ASPIRATION REGISTRATION (NGUYỆN VỌNG PHÁT TRIỂN) */}
              <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold text-[var(--ink)]">
                      {isVi ? 'Nguyện Vọng Phát Triển Sự Nghiệp' : 'Career Aspirations'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    2025 - 2027
                  </span>
                </div>

                {activeIDP?.careerAspiration ? (
                  <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {isVi ? 'Chức danh mục tiêu phấn đấu:' : 'Target Role Aspiration:'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {activeIDP.careerAspiration.status === 'APPROVED'
                          ? isVi
                            ? 'HR Đã Tiếp Nhận & Quy Hoạch'
                            : 'Approved'
                          : isVi
                          ? 'Đã Nộp Lên Ban Nhân Sự'
                          : 'Submitted'}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[var(--ink)]">
                      [{activeIDP.careerAspiration.targetRoleCode}] {activeIDP.careerAspiration.targetRoleTitle}
                    </div>
                    {activeIDP.careerAspiration.notes && (
                      <p className="text-xs text-[var(--muted)] italic">
                        "{activeIDP.careerAspiration.notes}"
                      </p>
                    )}
                    <div className="text-[10px] text-[var(--muted)] font-mono pt-1">
                      {isVi ? 'Ngày đăng ký:' : 'Date:'} {activeIDP.careerAspiration.submittedAt}
                    </div>
                  </div>
                ) : null}

                {/* FORM TO REGISTER OR UPDATE ASPIRATION */}
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {isVi ? 'Chọn Chức Danh Muốn Phấn Đấu (1-2 năm tới):' : 'Select Target Role:'}
                    </label>
                    <select
                      value={aspirationRoleCode}
                      onChange={(e) => setAspirationRoleCode(e.target.value)}
                      className="w-full text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--ink)] font-medium focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    >
                      {jobRoles.map((r) => (
                        <option key={r.code} value={r.code}>
                          [{r.code}] {isVi ? r.titleVi : r.titleEn} (Bậc {r.jobLevel})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preview Readiness for chosen target role */}
                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {isVi ? 'Độ sẵn sàng hiện tại' : 'Current Readiness Fit'}
                      </div>
                      <div className="font-bold text-[var(--ink)]">
                        {aspirationReadiness}% {isVi ? 'đáp ứng yêu cầu' : 'fit'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        aspirationReadiness >= 80
                          ? 'bg-emerald-100 text-emerald-700'
                          : aspirationReadiness >= 65
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {aspirationReadiness >= 80
                        ? isVi
                          ? 'Tiềm năng cao'
                          : 'High'
                        : isVi
                        ? 'Cần 9-12 tháng bồi dưỡng'
                        : 'Needs training'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--ink)]">
                      {isVi ? 'Ghi chú / Cam kết cá nhân:' : 'Personal Notes / Commitment:'}
                    </label>
                    <textarea
                      rows={2}
                      value={aspirationNotes}
                      onChange={(e) => setAspirationNotes(e.target.value)}
                      placeholder={
                        isVi
                          ? 'Ví dụ: Sẵn sàng nhận dự án chuyển đổi số toàn diện hoặc luân chuyển công tác theo sự điều động của Tập đoàn...'
                          : 'Your commitments and learning interests...'
                      }
                      className="w-full text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    />
                  </div>

                  <button
                    onClick={handleSubmitAspiration}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Gửi Nguyện Vọng Lên Ban Nhân Sự' : 'Submit Aspiration to HR'}</span>
                  </button>

                  {aspirationSuccessMsg && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs text-center font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{isVi ? 'Đã gửi nguyện vọng thành công lên Ban Nhân sự!' : 'Submitted to HR!'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MANAGER TEAM HUB & ENDORSEMENT */}
      {/* ========================================================================= */}
      {hubMode === 'manager' && (
        <div className="space-y-6">
          {/* MANAGER CONTEXT STRIP */}
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-black text-sm flex items-center justify-center border border-purple-300">
                {currentManager.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] font-medium">
                  {isVi ? 'Vai trò Quản lý trực tiếp:' : 'Active Manager Role:'}
                </div>
                <div className="font-bold text-base text-[var(--ink)] flex items-center gap-2">
                  <span>{currentManager.name}</span>
                  <span className="text-xs font-normal text-[var(--muted)]">({currentManager.title})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--muted)] font-semibold whitespace-nowrap">
                {isVi ? 'Đổi tài khoản Quản lý:' : 'Switch Manager:'}
              </span>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                aria-label="Chọn tài khoản quản lý"
                className="text-xs font-medium bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-2 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              >
                {users
                  .filter((u) => u.title.includes('Trưởng') || u.title.includes('Giám đốc'))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* TEAM OVERVIEW STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Nhân sự Đội ngũ' : 'Direct Team'}
                </span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-[var(--ink)] mt-2">
                {teamMembers.length} {isVi ? 'CBNV' : 'Members'}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {isVi ? 'Trực thuộc phạm vi RLS phụ trách' : 'Within direct scope'}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Tiến độ Đánh giá 360°' : '360 Assessment'}
                </span>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2">85%</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {isVi ? '3/4 nhân sự đã hoàn tất tự đánh giá' : '3/4 completed self-ratings'}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Kế hoạch IDP Cần Duyệt' : 'IDP Pending Approval'}
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-2">
                {idpPlans.filter((p) => !p.managerEndorsement).length}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {isVi ? 'Cần Quản lý ký xác nhận bảo trợ' : 'Awaiting manager sign-off'}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase">
                  {isVi ? 'Nguyện vọng Bổ nhiệm' : 'Mobility Aspirations'}
                </span>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-600 mt-2">
                {idpPlans.filter((p) => p.careerAspiration).length}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {isVi ? 'CBNV đã đăng ký mục tiêu chức danh' : 'Registered aspirations'}
              </div>
            </div>
          </div>

          {/* ROSTER TABLE: TEAM MEMBERS WITH 360 STATUS & IDP ACTIONS */}
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[var(--ink)]">
                  {isVi ? 'Danh Sách Nhân Sự & Tiến Độ Bồi Dưỡng IDP' : 'Team Members & IDP Oversight'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Giám sát chỉ số hoàn thành nhiệm vụ thực chiến và ký duyệt bảo trợ IDP cho nhân sự'
                    : 'Track on-the-job progress and endorse IDPs'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg)] border-b border-[var(--line)] text-[var(--muted)] uppercase font-semibold">
                  <tr>
                    <th className="p-3.5">{isVi ? 'Cán bộ Nhân viên' : 'Employee'}</th>
                    <th className="p-3.5">{isVi ? 'Chức danh & Đơn vị' : 'Title & Unit'}</th>
                    <th className="p-3.5">{isVi ? 'Đánh giá 360°' : '360 Status'}</th>
                    <th className="p-3.5">{isVi ? 'Năng lực Mục tiêu IDP' : 'IDP Target'}</th>
                    <th className="p-3.5">{isVi ? 'Tiến độ Nhiệm vụ' : 'Progress'}</th>
                    <th className="p-3.5">{isVi ? 'Bảo trợ Quản lý' : 'Endorsement'}</th>
                    <th className="p-3.5 text-right">{isVi ? 'Thao tác' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {teamMembers.map((member) => {
                    const memberIdp = idpPlans.find((p) => p.userId === member.id);
                    const completedCount = memberIdp?.completedTasks?.length || 0;
                    const totalCount =
                      (memberIdp?.experiential70.length || 0) +
                      (memberIdp?.exposure20.length || 0) +
                      (memberIdp?.education10.length || 0);
                    const memberProgress =
                      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <tr key={member.id} className="hover:bg-[var(--brand-50)]/30 transition">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--brand-50)] text-[var(--brand)] font-black text-xs flex items-center justify-center">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[var(--ink)]">{member.name}</div>
                              <div className="text-[11px] text-[var(--muted)]">{member.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold text-[var(--ink)]">{member.title}</div>
                          <div className="text-[11px] text-[var(--muted)]">
                            {member.orgUnit?.name || 'Ban CNTT & Chuyển đổi số'}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            {isVi ? 'Đã hoàn tất 360°' : 'Complete'}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {memberIdp ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 rounded bg-[var(--brand-50)] text-[var(--brand)]">
                                {memberIdp.targetCompetencyCode}
                              </span>
                              <div className="text-[11px] text-[var(--muted)]">
                                Mức {memberIdp.currentTier} ➔ Mức {memberIdp.targetTier}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)] italic text-[11px]">
                              {isVi ? 'Chưa lập IDP' : 'No IDP'}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {memberIdp ? (
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-bold text-[var(--ink)]">{memberProgress}%</span>
                                <span className="text-[var(--muted)]">
                                  {completedCount}/{totalCount}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-[var(--line)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${memberProgress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {memberIdp?.managerEndorsement ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {memberIdp.managerEndorsement.endorsedBy}
                            </span>
                          ) : memberIdp ? (
                            <span className="text-amber-600 font-semibold text-[11px] flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {isVi ? 'Chờ duyệt' : 'Pending'}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">-</span>
                          )}
                        </td>

                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUserId(member.id);
                              setHubMode('employee');
                            }}
                            className="px-2.5 py-1 rounded bg-[var(--brand-50)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white font-bold text-[11px] transition inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isVi ? 'Xem Hồ Sơ' : 'View'}</span>
                          </button>

                          {memberIdp && !memberIdp.managerEndorsement && (
                            <button
                              onClick={() => {
                                setEndorsingIdpId(memberIdp.id);
                                setEndorsementComment(
                                  `Đã thẩm định các nhiệm vụ thực chiến của ${member.name} và xác nhận đạt yêu cầu mức ${memberIdp.targetTier}.`
                                );
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>{isVi ? 'Ký Bảo Trợ' : 'Endorse'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MANAGER 1-ON-1 COACHING LOG MODAL (IF TRIGGERED) */}
          {endorsingIdpId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-black text-base text-[var(--ink)]">
                      {isVi ? 'Xác Nhận Bảo Trợ & Ký Duyệt IDP' : 'Sign-Off & Endorse IDP'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setEndorsingIdpId(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)] text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {isVi
                    ? 'Với tư cách là Quản lý trực tiếp, việc ký duyệt khẳng định nhân sự đã hoàn tất các mốc trải nghiệm thực tế (70%), được cố vấn (20%) và hoàn thành khóa đào tạo (10%) theo chuẩn Flamingo.'
                    : 'As the direct manager, this endorses the completed 70-20-10 milestones.'}
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--ink)]">
                    {isVi ? 'Ý kiến nhận xét của Quản lý trực tiếp:' : 'Manager Evaluation Notes:'}
                  </label>
                  <textarea
                    rows={3}
                    value={endorsementComment}
                    onChange={(e) => setEndorsementComment(e.target.value)}
                    className="w-full text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEndorsingIdpId(null)}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-[var(--muted)] hover:bg-[var(--line)] transition"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleConfirmEndorsement}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Xác Nhận Ký Bảo Trợ' : 'Confirm Endorsement'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
