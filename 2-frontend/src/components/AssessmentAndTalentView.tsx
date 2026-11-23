import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sliders,
  Sparkles,
  ArrowRight,
  Filter,
  UserCheck,
  Plus,
  Send,
  HelpCircle,
  Compass,
  Star,
  Target,
  ShieldCheck,
  Layers,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ExecutiveAnalyticsView } from './ExecutiveAnalyticsView';
import { TalentMobilitySimulator } from './TalentMobilitySimulator';
import { SelfServiceHubView } from './SelfServiceHubView';

interface AssessmentAndTalentViewProps {
  initialSubTab?: '360' | 'gap' | '9box' | 'succession' | 'idp' | 'analytics' | 'mobility' | 'selfservice';
}

export const AssessmentAndTalentView: React.FC<AssessmentAndTalentViewProps> = ({
  initialSubTab = '360',
}) => {
  const {
    lang,
    users,
    competencies,
    versions,
    assessmentScores,
    nineBoxTalents,
    successionPlans,
    idpPlans,
    jobRoles,
    recordAssessmentScore,
    update9BoxPlacement,
    addSuccessor,
    addIDPPlan,
  } = useApp();

  const isVi = lang === 'vi';
  const [activeSubTab, setActiveSubTab] = useState<
    '360' | 'gap' | '9box' | 'succession' | 'idp' | 'analytics' | 'mobility' | 'selfservice'
  >(initialSubTab);

  // 360 Form State
  const [selectedEvaluateeId, setSelectedEvaluateeId] = useState<string>(users[3]?.id || users[0]?.id || '');
  const [evaluatorRole, setEvaluatorRole] = useState<'SELF' | 'MANAGER' | 'PEER'>('SELF');
  const [activeCompForScoring, setActiveCompForScoring] = useState<string>(competencies[0]?.id || '');
  const [scoreLevel, setScoreLevel] = useState<number>(3);
  const [scoreComment, setScoreComment] = useState<string>('');
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Gap Analysis Target Role Selection (R01 - R26)
  const [selectedTargetRoleCode, setSelectedTargetRoleCode] = useState<string>('R14');

  // 9-Box Edit / Reassign State
  const [nineBoxFilterOrg, setNineBoxFilterOrg] = useState<string>('ALL');

  // AI IDP Generator State
  const [aiTargetUser, setAiTargetUser] = useState<string>(users[3]?.id || users[0]?.id || '');
  const [aiTargetComp, setAiTargetComp] = useState<string>(competencies[1]?.code || 'SEC-RLS-01');
  const [isGeneratingIDP, setIsGeneratingIDP] = useState(false);
  const [idpGeneratedSuccess, setIdpGeneratedSuccess] = useState(false);

  // Succession Add Successor State
  const [succModalOpen, setSuccModalOpen] = useState(false);
  const [succPlanId, setSuccPlanId] = useState<string>(successionPlans[0]?.id || '');
  const [succUserId, setSuccUserId] = useState<string>(users[1]?.id || '');
  const [succReadiness, setSuccReadiness] = useState<'READY_NOW' | 'READY_1_YEAR' | 'READY_2_YEARS'>('READY_NOW');
  const [succRisk, setSuccRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [succNotes, setSuccNotes] = useState<string>('');

  const selectedEvaluatee = users.find((u) => u.id === selectedEvaluateeId);
  const selectedRole = useMemo(() => {
    return jobRoles.find((r) => r.code === selectedTargetRoleCode) || jobRoles[0];
  }, [jobRoles, selectedTargetRoleCode]);

  const activeCompObj = competencies.find((c) => c.id === activeCompForScoring);
  const activeCompVersion = versions.find((v) => v.competencyId === activeCompForScoring);
  const activeAnchorText = activeCompVersion
    ? scoreLevel === 1
      ? activeCompVersion.level1Anchor
      : scoreLevel === 2
      ? activeCompVersion.level2Anchor
      : scoreLevel === 3
      ? activeCompVersion.level3Anchor
      : scoreLevel === 4
      ? activeCompVersion.level4Anchor
      : activeCompVersion.level5Anchor
    : '';

  // Trigger IDP creation directly from Gap Table
  const triggerCreateIDPFromGap = (compCode: string, currentScore: number, targetScore: number) => {
    setAiTargetUser(selectedEvaluateeId);
    setAiTargetComp(compCode);
    setActiveSubTab('idp');

    const targetC = competencies.find((c) => c.code === compCode || c.id === compCode);
    const compName = targetC ? targetC.name : compCode;
    const currentTier = Math.max(1, Math.floor(currentScore));
    const targetTier = Math.min(5, Math.max(currentTier + 1, Math.round(targetScore)));

    addIDPPlan({
      userId: selectedEvaluateeId,
      targetCompetencyCode: compCode,
      currentTier,
      targetTier,
      experiential70: [
        `Trực tiếp chủ trì nhiệm vụ tác nghiệp và xử lý các tình huống thực tế về ${compName.toLowerCase()} theo quy chuẩn Flamingo.`,
        `Thực hiện phân tích nguyên nhân gốc (RCA) và đề xuất phương án cải tiến quy trình trong quý.`
      ],
      exposure20: [
        `Tham gia phiên cố vấn chuyên môn (1-on-1 Mentoring) định kỳ 2 tuần/lần với Trưởng đơn vị hoặc Chuyên gia SME.`,
        `Tham gia dự thính và phản biện trong các buổi rà soát chuyên môn liên phòng ban cấp Khối.`
      ],
      education10: [
        `Hoàn tất chứng chỉ đào tạo chuyên sâu về ${compName} trên hệ thống Flamingo Learning Hub.`,
        `Nghiên cứu tài liệu tiêu chuẩn vận hành và hoàn thành bài kiểm tra trắc nghiệm tình huống nghiệp vụ.`
      ],
      timeline: '6 Tháng (Q1 - Q2/2026)',
      status: 'IN_PROGRESS',
      generatedByAI: true,
    });
    setIdpGeneratedSuccess(true);
  };

  // Handle Score Submit
  const handleScoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvaluatee) return;

    recordAssessmentScore({
      campaignId: 'camp-2026-h1',
      evaluateeId: selectedEvaluatee.id,
      evaluatorId: evaluatorRole === 'SELF' ? selectedEvaluatee.id : users[0].id,
      evaluatorRole,
      competencyId: activeCompForScoring,
      scoreLevel,
      comment: scoreComment,
    });

    setSubmitFeedback(isVi ? 'Đã ghi nhận điểm đánh giá 360° thành công!' : 'Score recorded successfully!');
    setScoreComment('');
    setTimeout(() => setSubmitFeedback(null), 2500);
  };

  // Compute Gap Analysis for Selected Evaluatee against Selected Job Role Requirements
  const computedGaps = useMemo(() => {
    return competencies.map((comp) => {
      const evaluateeScores = assessmentScores.filter(
        (s) => s.evaluateeId === selectedEvaluateeId && s.competencyId === comp.id
      );

      const selfScoreObj = evaluateeScores.find((s) => s.evaluatorRole === 'SELF');
      const mgrScoreObj = evaluateeScores.find((s) => s.evaluatorRole === 'MANAGER');
      const peerScores = evaluateeScores.filter((s) => s.evaluatorRole === 'PEER');

      const selfScore = selfScoreObj ? selfScoreObj.scoreLevel : 3;
      const mgrScore = mgrScoreObj ? mgrScoreObj.scoreLevel : 2.5;
      const peerAvg =
        peerScores.length > 0
          ? peerScores.reduce((acc, curr) => acc + curr.scoreLevel, 0) / peerScores.length
          : 3;

      // Benchmark required level from Job Role requirements
      const roleReq = selectedRole?.requirements?.find((r) => r.competency === comp.code);
      const catCode = comp.category?.code || (comp.code.startsWith('VAL') ? 'VAL' : comp.code.startsWith('COR') ? 'COR' : 'FUN');
      const benchmark = roleReq
        ? roleReq.requiredLevel
        : catCode === 'VAL' || catCode === 'COR'
        ? 3
        : 2;

      const actualWeighted = selfScore * 0.2 + mgrScore * 0.5 + peerAvg * 0.3;
      const gap = actualWeighted - benchmark;

      return {
        id: comp.id,
        code: comp.code,
        name: comp.name,
        category: comp.category,
        isRoleRequired: !!roleReq,
        selfScore,
        mgrScore,
        peerAvg,
        actualWeighted: Math.round(actualWeighted * 10) / 10,
        benchmark,
        gap: Math.round(gap * 10) / 10,
        status: gap >= 0 ? 'MATCHED_OR_EXCEEDED' : 'GAP_IDENTIFIED',
      };
    });
  }, [competencies, assessmentScores, selectedEvaluateeId, selectedRole]);

  // AI IDP Generator Logic
  const generateAIIDP = () => {
    setIsGeneratingIDP(true);
    setIdpGeneratedSuccess(false);

    setTimeout(() => {
      const targetC = competencies.find((c) => c.code === aiTargetComp || c.id === aiTargetComp);
      const compName = targetC ? targetC.name : 'Target Competency';

      addIDPPlan({
        userId: aiTargetUser,
        targetCompetencyCode: targetC ? targetC.code : aiTargetComp,
        currentTier: 2,
        targetTier: 3,
        experiential70: [
          `Lead sprint refactoring on ${compName} architecture and write production documentation.`,
          `Own root cause analysis (RCA) and mitigation strategy for team incidents related to ${compName}.`
        ],
        exposure20: [
          `Weekly 1-on-1 technical coaching with domain lead.`,
          `Facilitate cross-functional architecture reviews with senior engineering committee.`
        ],
        education10: [
          `Complete certified FLA-5 5-level mastery module on ${compName}.`,
          `Publish a technical whitepaper / blog post internally for peer knowledge transfer.`
        ],
        timeline: 'H2 2026 (90 Days Fast-Track)',
        status: 'IN_PROGRESS',
        generatedByAI: true,
      });

      setIsGeneratingIDP(false);
      setIdpGeneratedSuccess(true);
    }, 900);
  };

  // 9-Box Grid Coordinates
  const nineBoxMatrix = [
    // Potential 3 (High)
    {
      x: 1, y: 3, key: 'rough_diamond', titleVi: 'Kim cương thô (High Pot / Low Perf)', titleEn: 'Rough Diamond', color: 'bg-indigo-50 border-indigo-200 text-indigo-700'
    },
    {
      x: 2, y: 3, key: 'high_potential', titleVi: 'Tiềm năng cao (High Pot / Med Perf)', titleEn: 'High Potential', color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      x: 3, y: 3, key: 'star', titleVi: 'Ngôi sao (High Pot / High Perf)', titleEn: 'Star Talent', color: 'bg-emerald-50 border-emerald-300 text-emerald-800'
    },
    // Potential 2 (Medium)
    {
      x: 1, y: 2, key: 'inconsistent', titleVi: 'Chưa ổn định (Med Pot / Low Perf)', titleEn: 'Inconsistent', color: 'bg-amber-50 border-amber-200 text-amber-700'
    },
    {
      x: 2, y: 2, key: 'key_contributor', titleVi: 'Nhân tố cốt lõi (Med Pot / Med Perf)', titleEn: 'Key Contributor', color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      x: 3, y: 2, key: 'high_performer', titleVi: 'Hiệu suất cao (Med Pot / High Perf)', titleEn: 'High Performer', color: 'bg-emerald-50 border-emerald-200 text-emerald-700'
    },
    // Potential 1 (Low)
    {
      x: 1, y: 1, key: 'talent_risk', titleVi: 'Cần cải thiện (Low Pot / Low Perf)', titleEn: 'Talent Risk', color: 'bg-rose-50 border-rose-200 text-rose-700'
    },
    {
      x: 2, y: 1, key: 'effective', titleVi: 'Hiệu quả (Low Pot / Med Perf)', titleEn: 'Solid Performer', color: 'bg-slate-100 border-slate-200 text-slate-700'
    },
    {
      x: 3, y: 1, key: 'master', titleVi: 'Chuyên gia ổn định (Low Pot / High Perf)', titleEn: 'Trusted Professional', color: 'bg-slate-100 border-slate-200 text-slate-700'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="app-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {isVi ? 'Đánh giá 360°, Hiệu chuẩn 9-Box & Kế hoạch Kế thừa (GĐ3 & GĐ4)' : '360° Assessment, 9-Box Calibration & Succession (GĐ3 & GĐ4)'}
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {isVi
              ? 'Chiến dịch đánh giá đa chiều, đối soát khoảng cách năng lực, ma trận 9 ô nhân tài và lộ trình AI IDP.'
              : 'Multi-rater evaluation, competency gap analysis, 9-box calibration matrix, and AI-powered IDP.'}
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[var(--brand-50)] border border-[var(--brand-100)]">
          <button
            onClick={() => setActiveSubTab('360')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === '360'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '1. Đánh giá 360°' : '1. 360° Assessment'}
          </button>
          <button
            onClick={() => setActiveSubTab('gap')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'gap'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '2. Khoảng cách (Gap Radar)' : '2. Gap Radar'}
          </button>
          <button
            onClick={() => setActiveSubTab('9box')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === '9box'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '3. Ma trận 9-Box' : '3. 9-Box Calibration'}
          </button>
          <button
            onClick={() => setActiveSubTab('succession')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'succession'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '4. Kế hoạch Kế thừa' : '4. Succession'}
          </button>
          <button
            onClick={() => setActiveSubTab('idp')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              activeSubTab === 'idp'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>{isVi ? '5. Trợ lý AI IDP' : '5. AI IDP'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'analytics'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '6. Bản đồ Nhiệt Lãnh đạo' : '6. Heatmap'}
          </button>
          <button
            onClick={() => setActiveSubTab('mobility')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'mobility'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {isVi ? '7. Mô phỏng Bổ nhiệm' : '7. Mobility'}
          </button>
          <button
            onClick={() => setActiveSubTab('selfservice')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              activeSubTab === 'selfservice'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <UserCheck className="w-3 h-3 text-teal-300" />
            <span>{isVi ? '8. Cổng Nhân viên & Quản lý' : '8. Self-Service Hub'}</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: 360 ASSESSMENT SCORING FORM */}
      {activeSubTab === '360' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Evaluatee & Evaluator Setup */}
          <div className="lg:col-span-5 app-card space-y-4">
            <div className="pb-3 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Chiến dịch Đánh giá 2026-H1' : 'Assessment Campaign 2026-H1'}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {isVi ? 'Chọn nhân sự và vai trò đánh giá' : 'Select evaluatee and rater perspective'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Nhân sự Được Đánh giá (Evaluatee)' : 'Evaluatee'}
                </label>
                <select
                  value={selectedEvaluateeId}
                  onChange={(e) => setSelectedEvaluateeId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-semibold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Góc nhìn Người Đánh giá (Rater Role)' : 'Rater Role'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SELF', 'MANAGER', 'PEER'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setEvaluatorRole(role)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                        evaluatorRole === role
                          ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                          : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {role === 'SELF' ? (isVi ? 'Tự ĐG' : 'Self') : role === 'MANAGER' ? (isVi ? 'Quản lý' : 'Manager') : (isVi ? 'Đồng nghiệp' : 'Peer')}
                    </button>
                  ))}
                </div>
              </div>

              {selectedEvaluatee && (
                <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {isVi ? 'Hồ sơ Nhân sự' : 'Employee Profile'}
                  </div>
                  <div className="font-bold text-[var(--ink)]">{selectedEvaluatee.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">{selectedEvaluatee.email}</div>
                  <div className="text-[11px] text-[var(--brand)] font-medium">{selectedEvaluatee.title}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Scoring Form with FLA-5 Rubrics */}
          <div className="lg:col-span-7 app-card space-y-4">
            <div className="pb-3 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Phiếu Đánh giá Năng lực theo Tiêu chuẩn Flamingo (FLA-5)' : 'Competency Scoring Rubric (FLA-5 Scale)'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi ? 'Chấm điểm 5 cấp độ thành thục hành vi chuẩn hóa Tập đoàn' : 'Rate against standardized 5-level behavioral progression'}
                </p>
              </div>
              <span className="badge-pill b-active text-[10px]">
                {evaluatorRole} RATING
              </span>
            </div>

            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Chọn Năng lực Cần Đánh giá' : 'Competency Item'}
                </label>
                <select
                  value={activeCompForScoring}
                  onChange={(e) => setActiveCompForScoring(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
                >
                  {competencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.name} {c.owningUnit ? `(${c.owningUnit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Flamingo 5-Level Selector */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-2">
                  {isVi ? 'Mức Điểm Đạt Được (Thang Flamingo FLA-5: Mức 1 - Mức 5)' : 'Score Level (FLA-5 Scale: 1 - 5)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { level: 1, name: 'Mức 1', labelVi: 'Nhận biết (Aware)', color: 'border-slate-300' },
                    { level: 2, name: 'Mức 2', labelVi: 'Áp dụng (Applied)', color: 'border-blue-400' },
                    { level: 3, name: 'Mức 3', labelVi: 'Thành thạo (Proficient)', color: 'border-emerald-500' },
                    { level: 4, name: 'Mức 4', labelVi: 'Nâng cao (Advanced)', color: 'border-indigo-500' },
                    { level: 5, name: 'Mức 5', labelVi: 'Chuyên gia (Master)', color: 'border-amber-500' },
                  ].map((tier) => (
                    <button
                      key={tier.level}
                      type="button"
                      onClick={() => setScoreLevel(tier.level)}
                      className={`p-2.5 rounded-lg border text-left transition ${
                        scoreLevel === tier.level
                          ? 'bg-[var(--brand-50)] border-[var(--brand)] text-[var(--brand)] shadow-sm font-bold ring-1 ring-[var(--brand)]'
                          : 'bg-[var(--surface)] border-[var(--line)] hover:bg-[var(--surface-hover)] text-[var(--ink)]'
                      }`}
                    >
                      <div className="text-xs font-bold">{tier.name}</div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">{tier.labelVi}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observable Behavioral Indicator Anchor for Selected Level */}
              {activeAnchorText && (
                <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{isVi ? `Chỉ báo Hành vi Quan sát được: Mức ${scoreLevel} [${activeCompObj?.code}]` : `Behavioral Anchor: Level ${scoreLevel}`}</span>
                  </div>
                  <p className="text-xs text-[var(--ink)] leading-relaxed italic">
                    "{activeAnchorText}"
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Nhận xét & Dẫn chứng Hành vi Thực tế' : 'Evidence & Behavioral Comments'}
                </label>
                <textarea
                  value={scoreComment}
                  onChange={(e) => setScoreComment(e.target.value)}
                  placeholder={
                    isVi
                      ? 'Nêu các dẫn chứng cụ thể trong kỳ công tác (dự án, giải pháp, code review)...'
                      : 'Provide concrete work examples demonstrating this proficiency level...'
                  }
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  rows={3}
                />
              </div>

              {submitFeedback && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{submitFeedback}</span>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button type="submit" className="btn btn-primary text-xs font-bold flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Lưu Phiếu Đánh Giá 360°' : 'Submit 360 Evaluation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 2: GAP ANALYSIS & RADAR RADIAL COMPARISON */}
      {activeSubTab === 'gap' && (
        <div className="space-y-5">
          <div className="app-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi
                    ? `Ma trận Khoảng cách Năng lực: ${selectedEvaluatee?.name}`
                    : `Competency Gap Matrix: ${selectedEvaluatee?.name}`}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? `So sánh điểm Trọng số Thực tế (Tự ĐG 20% + Quản lý 50% + Đồng nghiệp 30%) với Chuẩn Chức danh [${selectedRole.code}] ${selectedRole.titleVi}`
                    : `Weighted Actual Score vs Role Benchmark [${selectedRole.code}] ${selectedRole.titleEn || selectedRole.titleVi}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Nhân sự Đánh giá:' : 'Evaluatee:'}
                  </label>
                  <select
                    value={selectedEvaluateeId}
                    onChange={(e) => setSelectedEvaluateeId(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Đối soát theo Khung Chức danh:' : 'Benchmark Job Role:'}
                  </label>
                  <select
                    value={selectedTargetRoleCode}
                    onChange={(e) => setSelectedTargetRoleCode(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold max-w-[240px]"
                  >
                    {jobRoles.map((r) => (
                      <option key={r.code} value={r.code}>
                        [{r.code}] {isVi ? r.titleVi : (r.titleEn || r.titleVi)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Gap Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] uppercase font-bold text-[var(--muted)]">
                    <th className="py-2.5 px-3">Mã &amp; Tên Năng Lực</th>
                    <th className="py-2.5 px-3">Tự ĐG (20%)</th>
                    <th className="py-2.5 px-3">Quản lý (50%)</th>
                    <th className="py-2.5 px-3">Đồng nghiệp (30%)</th>
                    <th className="py-2.5 px-3 font-bold text-[var(--ink)]">Điểm Thực Tế</th>
                    <th className="py-2.5 px-3">Chuẩn Vị Trí</th>
                    <th className="py-2.5 px-3">Chênh lệch (Gap)</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Kế hoạch IDP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {computedGaps.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--surface-hover)] transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.isRoleRequired && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 font-bold">
                              Bắt buộc
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--muted)]">{item.code}</span>
                      </td>
                      <td className="py-3 px-3 font-mono">{item.selfScore.toFixed(1)}</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{item.mgrScore.toFixed(1)}</td>
                      <td className="py-3 px-3 font-mono">{item.peerAvg.toFixed(1)}</td>
                      <td className="py-3 px-3 font-mono font-extrabold text-[var(--brand)] text-sm">
                        {item.actualWeighted.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">{item.benchmark}.0</td>
                      <td className="py-3 px-3 font-mono font-bold">
                        {item.gap >= 0 ? (
                          <span className="text-emerald-600">+{item.gap.toFixed(1)}</span>
                        ) : (
                          <span className="text-rose-600">{item.gap.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.gap >= 0 ? (
                          <span className="badge-pill b-active text-[9.5px]">ĐẠT CHUẨN</span>
                        ) : (
                          <span className="badge-pill b-draft text-[9.5px] bg-rose-500/10 text-rose-600 border-rose-500/20">
                            CẦN ĐÀO TẠO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {item.gap < 0 ? (
                          <button
                            onClick={() => triggerCreateIDPFromGap(item.code, item.actualWeighted, item.benchmark)}
                            className="btn py-1 px-2.5 text-[10.5px] font-bold bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-md inline-flex items-center gap-1 shadow-xs transition whitespace-nowrap"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>{isVi ? 'Tạo IDP 70-20-10' : 'Create IDP'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isVi ? 'Đạt kỳ vọng' : 'Met'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: 9-BOX TALENT CALIBRATION GRID */}
      {activeSubTab === '9box' && (
        <div className="space-y-5">
          <div className="app-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Ma trận Hiệu chuẩn Nhân tài 9-Box (Performance x Potential)' : '9-Box Talent Calibration Matrix'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Phân loại tài năng chiến lược phục vụ quy hoạch kế thừa và phát triển nhân sự chủ chốt'
                    : 'Strategic talent classification for succession pipelines and executive reviews'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--muted)]">Khối:</span>
                <select
                  value={nineBoxFilterOrg}
                  onChange={(e) => setNineBoxFilterOrg(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
                >
                  <option value="ALL">Tất cả Khối &amp; Ban</option>
                  <option value="TECH">Technology Division</option>
                  <option value="PROD">Product Division</option>
                </select>
              </div>
            </div>

            {/* 9-BOX VISUAL GRID */}
            <div className="grid grid-cols-3 gap-3">
              {nineBoxMatrix.map((cell) => {
                const occupants = nineBoxTalents.filter(
                  (t) => t.performance === cell.x && t.potential === cell.y
                );

                return (
                  <div
                    key={cell.key}
                    className={`p-3.5 rounded-xl border min-h-[140px] flex flex-col justify-between ${cell.color}`}
                  >
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-tight">
                        {isVi ? cell.titleVi : cell.titleEn}
                      </div>
                      <div className="text-[9.5px] opacity-75 font-mono">
                        X:{cell.x} (Perf) · Y:{cell.y} (Pot)
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      {occupants.map((occ) => {
                        const u = users.find((user) => user.id === occ.userId);
                        return (
                          <div
                            key={occ.id}
                            className="p-1.5 rounded-lg bg-white/80 shadow-xs border border-black/5 text-[11px] flex items-center justify-between gap-1 text-[var(--ink)]"
                          >
                            <span className="font-bold truncate">{u?.name || occ.userId}</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 bg-black/5 rounded text-[var(--muted)]">
                              {u?.title?.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                      {occupants.length === 0 && (
                        <div className="text-[10px] text-center opacity-60 italic py-2">
                          {isVi ? 'Trống' : 'Empty'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SUCCESSION PLANNING PIPELINE */}
      {activeSubTab === 'succession' && (
        <div className="space-y-5">
          <div className="app-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Bản đồ Kế thừa & Vị trí Trọng yếu (Succession Pipeline)' : 'Succession Pipeline & Bench Strength'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Theo dõi nguồn nhân sự kế cận, mức độ sẵn sàng và rủi ro rời bỏ tổ chức'
                    : 'Track critical key role successors, readiness timelines, and flight risk index'}
                </p>
              </div>

              <button
                onClick={() => setSuccModalOpen(true)}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Bổ sung Kế cận' : 'Add Successor'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {successionPlans.map((plan) => {
                const holder = users.find((u) => u.id === plan.currentHolderId);
                return (
                  <div
                    key={plan.id}
                    className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        {plan.criticality} ROLE
                      </span>
                      <span className="text-xs font-bold text-[var(--muted)]">
                        {plan.successors.length} {isVi ? 'nhân sự kế cận' : 'successors'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[var(--ink)]">{plan.keyRoleTitle}</h4>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {isVi ? 'Đang nắm giữ:' : 'Current Holder:'} <b>{holder?.name || 'Chưa bổ nhiệm'}</b>
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                        {isVi ? 'Danh sách Kế cận & Sẵn sàng' : 'Bench Successors'}
                      </div>
                      {plan.successors.map((succ, idx) => {
                        const succUser = users.find((u) => u.id === succ.userId);
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-[var(--ink)]">{succUser?.name}</div>
                              <div className="text-[10px] text-[var(--muted)]">{succ.notes}</div>
                            </div>
                            <span
                              className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                succ.readiness === 'READY_NOW'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}
                            >
                              {succ.readiness === 'READY_NOW' ? 'Sẵn sàng ngay' : 'Trong 1 năm'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: AI IDP (INDIVIDUAL DEVELOPMENT PLAN) GENERATOR */}
      {activeSubTab === 'idp' && (
        <div className="space-y-5">
          {/* AI Generator Control Box */}
          <div className="app-card space-y-4 border-2 border-[var(--brand)] bg-[var(--brand-50)]/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--brand)]" />
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Trợ lý AI Sinh Kế hoạch Phát triển Cá nhân (AI IDP Engine)' : 'AI-Powered Individual Development Plan (IDP) Studio'}
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {isVi
                ? 'AI tự động phân tích khoảng cách năng lực từ kỳ đánh giá 360° để sinh lộ trình 70-20-10 (70% Trải nghiệm thực tế + 20% Học hỏi qua tương tác/Mentorship + 10% Khóa học chuẩn).'
                : 'AI analyzes 360 competency gaps and generates tailored 70-20-10 actionable development plans (70% Experiential + 20% Mentorship + 10% Education).'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Nhân sự Cần Lập IDP' : 'Target Employee'}
                </label>
                <select
                  value={aiTargetUser}
                  onChange={(e) => setAiTargetUser(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-bold"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.title})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Năng lực Mục tiêu Cần Nâng Cấp' : 'Target Competency Gap'}
                </label>
                <select
                  value={aiTargetComp}
                  onChange={(e) => setAiTargetComp(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-bold"
                >
                  {competencies.map((c) => (
                    <option key={c.id} value={c.code}>
                      [{c.code}] {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[var(--muted)]">
                {isVi ? 'Khung chuẩn hóa: FLA-5 5-Level & Chuẩn 70-20-10' : 'Standards: FLA-5 5-Level & 70-20-10 Framework'}
              </span>
              <button
                onClick={generateAIIDP}
                disabled={isGeneratingIDP}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingIDP ? (isVi ? 'AI Đang Xây dựng Lộ trình...' : 'AI Generating Plan...') : (isVi ? 'Sinh Lộ trình Phát triển AI IDP' : 'Generate AI IDP')}</span>
              </button>
            </div>

            {idpGeneratedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{isVi ? 'Đã sinh kế hoạch IDP thành công và ghi nhận vào cơ sở dữ liệu!' : 'AI IDP successfully created and recorded!'}</span>
              </div>
            )}
          </div>

          {/* Render Active IDP Plans */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--ink)]">
              {isVi ? 'Danh sách Lộ trình Phát triển Đang Thực thi' : 'Active Development Plans (IDP)'}
            </h4>

            <div className="space-y-4">
              {idpPlans.map((plan) => {
                const u = users.find((user) => user.id === plan.userId);
                return (
                  <div
                    key={plan.id}
                    className="app-card space-y-4 border-l-4 border-l-[var(--brand)]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--line)]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--ink)]">{u?.name}</span>
                          <span className="text-xs text-[var(--muted)]">({u?.title})</span>
                          {plan.generatedByAI && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>AI Generated</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-[var(--brand)] mt-0.5">
                          Mục tiêu: {plan.targetCompetencyCode} (Nâng từ Cấp {plan.currentTier} ➔ Cấp {plan.targetTier})
                        </div>
                      </div>

                      <div className="text-xs font-semibold text-[var(--muted)]">
                        Thời hạn: <span className="font-bold text-[var(--ink)]">{plan.timeline}</span>
                      </div>
                    </div>

                    {/* 70-20-10 Action Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* 70% Experiential */}
                      <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-2">
                        <div className="text-[11px] font-extrabold uppercase text-blue-600">
                          70% Trải nghiệm Thực tế (Experiential)
                        </div>
                        <ul className="text-xs text-[var(--ink)] space-y-1.5 list-disc list-inside">
                          {plan.experiential70.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 20% Exposure & Mentorship */}
                      <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-2">
                        <div className="text-[11px] font-extrabold uppercase text-purple-600">
                          20% Học hỏi &amp; Cố vấn (Mentorship)
                        </div>
                        <ul className="text-xs text-[var(--ink)] space-y-1.5 list-disc list-inside">
                          {plan.exposure20.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>

                      {/* 10% Education & Courses */}
                      <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="text-[11px] font-extrabold uppercase text-emerald-600">
                          10% Đào tạo Chuẩn hóa (Education)
                        </div>
                        <ul className="text-xs text-[var(--ink)] space-y-1.5 list-disc list-inside">
                          {plan.education10.map((item, idx) => (
                            <li key={idx} className="leading-relaxed">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: EXECUTIVE ANALYTICS & HEATMAP */}
      {activeSubTab === 'analytics' && <ExecutiveAnalyticsView />}

      {/* SUBTAB 7: TALENT MOBILITY & ROLE FIT SIMULATOR */}
      {activeSubTab === 'mobility' && <TalentMobilitySimulator />}

      {/* SUBTAB 8: EMPLOYEE & MANAGER SELF-SERVICE HUB */}
      {activeSubTab === 'selfservice' && <SelfServiceHubView />}

      {/* SUCCESSION ADD MODAL */}
      {succModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Bổ sung Nhân sự Kế cận' : 'Add Key Role Successor'}
              </h3>
              <button
                onClick={() => setSuccModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSuccessor(succPlanId, {
                  userId: succUserId,
                  readiness: succReadiness,
                  riskOfLeaving: succRisk,
                  notes: succNotes || 'Identified via talent calibration review',
                });
                setSuccModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Vị trí Trọng yếu' : 'Key Role'}
                </label>
                <select
                  value={succPlanId}
                  onChange={(e) => setSuccPlanId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                >
                  {successionPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.keyRoleTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Chọn Nhân sự Kế cận' : 'Successor Employee'}
                </label>
                <select
                  value={succUserId}
                  onChange={(e) => setSuccUserId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.title})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Mức Sẵn Sàng' : 'Readiness'}
                  </label>
                  <select
                    value={succReadiness}
                    onChange={(e) => setSuccReadiness(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  >
                    <option value="READY_NOW">Sẵn sàng ngay (Ready Now)</option>
                    <option value="READY_1_YEAR">Trong 1 năm (1 Year)</option>
                    <option value="READY_2_YEARS">Trong 2 năm (2 Years)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Rủi ro Rời bỏ' : 'Flight Risk'}
                  </label>
                  <select
                    value={succRisk}
                    onChange={(e) => setSuccRisk(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  >
                    <option value="LOW">Thấp (Low)</option>
                    <option value="MEDIUM">Trung bình (Medium)</option>
                    <option value="HIGH">Cao (High)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Ghi chú & Đánh giá Tiềm năng' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={succNotes}
                  onChange={(e) => setSuccNotes(e.target.value)}
                  placeholder="e.g. Strong architecture acumen, ready for leadership."
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSuccModalOpen(false)}
                  className="btn btn-secondary text-xs font-bold"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
                  {isVi ? 'Lưu Kế Cận' : 'Save Successor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
