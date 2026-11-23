import React, { useState, useMemo } from 'react';
import {
  Users,
  Briefcase,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileText,
  Award,
  BookOpen,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TalentMobilitySimulator: React.FC = () => {
  const {
    lang,
    users,
    jobRoles,
    competencies,
    assessmentScores,
    addIDPPlan,
  } = useApp();

  const isVi = lang === 'vi';

  // Default selection
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || 'usr-swe-1');
  const [targetRoleCode, setTargetRoleCode] = useState<string>('R14'); // Deputy Head of Tech
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [idpSuccessMessage, setIdpSuccessMessage] = useState<string | null>(null);

  // Selected User & Target Role
  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId), [users, selectedUserId]);
  const targetRole = useMemo(() => jobRoles.find((r) => r.code === targetRoleCode), [jobRoles, targetRoleCode]);

  // Current Role
  const currentRole = useMemo(() => {
    if (!selectedUser) return null;
    return (
      jobRoles.find((r) => r.titleVi.toLowerCase().includes(selectedUser.title.toLowerCase())) ||
      jobRoles.find((r) => r.code === 'R21') ||
      jobRoles[0]
    );
  }, [selectedUser, jobRoles]);

  // Evaluatee actual scores
  const userScores = useMemo(() => {
    return assessmentScores.filter((s) => s.evaluateeId === selectedUserId);
  }, [assessmentScores, selectedUserId]);

  // Fit Score & Gap Breakdown
  const simulationResults = useMemo(() => {
    if (!targetRole || !targetRole.requirements || targetRole.requirements.length === 0) {
      return {
        fitScore: 82,
        requirementsCount: 0,
        metCount: 0,
        gapCount: 0,
        details: [],
        readinessLevel: 'DEVELOPING',
      };
    }

    let totalRequiredWeight = 0;
    let totalAchievedWeight = 0;
    let metCount = 0;
    let gapCount = 0;

    const details = targetRole.requirements.map((req) => {
      const comp = competencies.find((c) => c.code === req.competency);
      const compScores = userScores.filter((s) => s.competencyId === comp?.id);
      
      const actualScore =
        compScores.length > 0
          ? compScores.reduce((sum, s) => sum + s.scoreLevel, 0) / compScores.length
          : 2.8; // Default baseline if not scored

      const requiredLevel = req.requiredLevel;
      const gap = Math.round((actualScore - requiredLevel) * 10) / 10;
      const isMet = gap >= 0;

      if (isMet) metCount++;
      else gapCount++;

      totalRequiredWeight += requiredLevel;
      totalAchievedWeight += Math.min(actualScore, requiredLevel);

      return {
        competencyCode: req.competency,
        competencyName: comp ? comp.name : req.competency,
        category: comp?.category,
        actualScore: Math.round(actualScore * 10) / 10,
        requiredLevel,
        gap,
        isMet,
      };
    });

    const fitScore = Math.round((totalAchievedWeight / (totalRequiredWeight || 1)) * 100);

    let readinessLevel: 'READY_NOW' | 'FAST_TRACK' | 'LONG_TERM' = 'LONG_TERM';
    if (fitScore >= 88) readinessLevel = 'READY_NOW';
    else if (fitScore >= 72) readinessLevel = 'FAST_TRACK';

    return {
      fitScore,
      requirementsCount: targetRole.requirements.length,
      metCount,
      gapCount,
      details,
      readinessLevel,
    };
  }, [targetRole, userScores, competencies]);

  // Handle 1-Click IDP generation for gaps
  const handleGenerateMobilityIDP = () => {
    if (!selectedUser || !targetRole) return;

    const firstGap = simulationResults.details.find((d) => !d.isMet);
    const targetCompCode = firstGap ? firstGap.competencyCode : 'COR-01';
    const targetCompName = firstGap ? firstGap.competencyName : 'Năng lực Mục tiêu';

    addIDPPlan({
      userId: selectedUser.id,
      targetCompetencyCode: targetCompCode,
      currentTier: 2,
      targetTier: firstGap ? firstGap.requiredLevel : 3,
      experiential70: [
        `Giao quyền thử nghiệm quyền hạn cấp phó điều hành một phần nhiệm vụ của vị trí [${targetRole.code}] ${targetRole.titleVi}.`,
        `Chủ trì đồ án tái cấu trúc quy trình nghiệp vụ liên quan đến ${targetCompName} trong 90 ngày tới.`,
      ],
      exposure20: [
        `Phân công Lãnh đạo Ban đương nhiệm trực tiếp bảo trợ và cố vấn lộ trình chuyển đổi chức danh.`,
        `Tham gia các phiên báo cáo và giải trình trước Hội đồng Nhân sự Tập đoàn.`,
      ],
      education10: [
        `Hoàn thành chứng chỉ Quản trị & Lãnh đạo Chiến lược Flamingo Leadership Academy.`,
        `Nghiên cứu chuẩn vị trí và khung thẩm quyền phê duyệt của ngạch chức danh ${targetRole.code}.`,
      ],
      timeline: '90 Ngày Chuyển đổi (Fast-track Readiness)',
      status: 'IN_PROGRESS',
      generatedByAI: true,
    });

    setIdpSuccessMessage(
      isVi
        ? `Đã tạo thành công Kế hoạch IDP bổ trợ chuẩn chức danh [${targetRole.code}] cho nhân sự ${selectedUser.name}!`
        : `Successfully generated fast-track transition IDP for ${selectedUser.name} targeting role ${targetRole.code}!`
    );

    setTimeout(() => {
      setIdpSuccessMessage(null);
    }, 4500);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {idpSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{idpSuccessMessage}</span>
          </div>
          <button
            onClick={() => setIdpSuccessMessage(null)}
            className="text-xs hover:opacity-75 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Simulator Control Header */}
      <div className="app-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand)]" />
              <span>
                {isVi
                  ? 'Mô Phỏng Đề Bạt & Luân Chuyển Chức Danh (Talent Mobility Simulator)'
                  : 'Talent Mobility & Role Fit Simulator'}
              </span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {isVi
                ? 'Đối chiếu hồ sơ năng lực 360° của nhân sự với chuẩn yêu cầu của 26 chức danh mục tiêu trong Tập đoàn.'
                : 'Simulate promotion readiness against official Flamingo 26 Job Role benchmarks.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMemoModalOpen(true)}
              className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isVi ? 'Xem Dự thảo Tờ trình' : 'Draft Memo'}</span>
            </button>
            <button
              onClick={handleGenerateMobilityIDP}
              className="btn btn-primary text-xs flex items-center gap-1.5 font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isVi ? '⚡ Tạo IDP Chuyển đổi' : '⚡ Generate IDP'}</span>
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pick Employee */}
          <div>
            <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
              {isVi ? '1. Chọn Nhân sự đề xuất:' : '1. Select Nominee:'}
            </label>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--brand-50)] text-[var(--brand)]">
                <Users className="w-4 h-4" />
              </div>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.title} ({u.orgUnit?.name || 'Flamingo Group'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pick Target Job Role */}
          <div>
            <label className="block text-xs font-bold text-[var(--muted)] mb-1.5">
              {isVi ? '2. Chọn Chức danh Mục tiêu (26 Job Roles):' : '2. Target Job Role (26 Roles):'}
            </label>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Briefcase className="w-4 h-4" />
              </div>
              <select
                value={targetRoleCode}
                onChange={(e) => setTargetRoleCode(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
              >
                {jobRoles.map((r) => (
                  <option key={r.code} value={r.code}>
                    [{r.code}] {isVi ? r.titleVi : (r.titleEn || r.titleVi)} (Bậc {r.jobLevel})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Fit Score KPI & Transition Path Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Card: Fit Score Gauge */}
        <div className="lg:col-span-4 app-card flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                {isVi ? 'Chỉ số Phù hợp (Role Fit)' : 'Role Fit Score'}
              </span>
              <span className="badge-pill b-active text-[10px] font-mono font-bold">
                {simulationResults.readinessLevel}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black font-mono text-[var(--brand)]">
                {simulationResults.fitScore}%
              </span>
              <span className="text-xs text-[var(--muted)]">
                ({simulationResults.metCount}/{simulationResults.requirementsCount} Năng lực đạt chuẩn)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[var(--line)] h-2.5 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-500 ${
                  simulationResults.fitScore >= 88
                    ? 'bg-emerald-500'
                    : simulationResults.fitScore >= 72
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${simulationResults.fitScore}%` }}
              />
            </div>
          </div>

          {/* Verdict Box */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
              simulationResults.readinessLevel === 'READY_NOW'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                : simulationResults.readinessLevel === 'FAST_TRACK'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="font-extrabold flex items-center gap-1.5">
              {simulationResults.readinessLevel === 'READY_NOW' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>SẴN SÀNG BỔ NHIỆM NGAY (READY NOW)</span>
                </>
              ) : simulationResults.readinessLevel === 'FAST_TRACK' ? (
                <>
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>ĐỀ XUẤT BỔ NHIỆM CÓ ĐIỀU KIỆN (FAST-TRACK 90 NGÀY)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>CẦN LỘ TRÌNH TÍCH LŨY DÀI HẠN (1-2 NĂM)</span>
                </>
              )}
            </div>
            <p className="text-[11px] opacity-90">
              {simulationResults.readinessLevel === 'READY_NOW'
                ? 'Nhân sự đã vượt hoặc đạt hầu hết các tiêu chuẩn năng lực cốt lõi và chuyên môn của vị trí mục tiêu.'
                : simulationResults.readinessLevel === 'FAST_TRACK'
                ? 'Hồ sơ năng lực tiệm cận chuẩn. Cần kích hoạt lộ trình IDP 70-20-10 để hoàn thiện các khoảng cách còn lại.'
                : 'Khoảng cách năng lực còn đáng kể đối với ngạch chức danh cao cấp này. Khuyến nghị bổ nhiệm tạm thời hoặc giao phụ trách.'}
            </p>
          </div>
        </div>

        {/* Right Card: Transition Vector */}
        <div className="lg:col-span-8 app-card space-y-4">
          <div className="pb-3 border-b border-[var(--line)]">
            <h3 className="font-bold text-sm text-[var(--ink)]">
              {isVi ? 'Lộ Trình Luân Chuyển Đề Xuất' : 'Proposed Career Vector'}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              So sánh cấp bậc và chức danh hiện tại với vị trí đích
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-3 p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--line)]">
            {/* Current Position (5 cols) */}
            <div className="sm:col-span-5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Vị Trí Hiện Tại
              </span>
              <div className="font-bold text-sm text-[var(--ink)]">{selectedUser?.title}</div>
              <div className="text-xs text-[var(--muted)]">
                {selectedUser?.orgUnit?.name || 'Flamingo Holdings'}
              </div>
              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--line)] font-bold">
                Bậc: {currentRole?.jobLevel || 'B2'}
              </span>
            </div>

            {/* Vector Arrow (1 col) */}
            <div className="sm:col-span-1 flex justify-center py-2 sm:py-0">
              <div className="w-8 h-8 rounded-full bg-[var(--brand-50)] text-[var(--brand)] flex items-center justify-center font-bold">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Target Position (5 cols) */}
            <div className="sm:col-span-5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand)]">
                Vị Trí Mục Tiêu Đề Bạt
              </span>
              <div className="font-bold text-sm text-[var(--brand)]">
                [{targetRole?.code}] {isVi ? targetRole?.titleVi : targetRole?.titleEn}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Họ nghề: {targetRole?.jobFamily || 'Bảo mật / Công nghệ'}
              </div>
              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-bold">
                Bậc mục tiêu: {targetRole?.jobLevel || 'B5'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-center">
              <div className="text-[10px] text-[var(--muted)] font-bold">Yêu cầu Vị trí</div>
              <div className="text-base font-black text-[var(--ink)]">
                {simulationResults.requirementsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
              <div className="text-[10px] text-emerald-600 font-bold">Đạt Chuẩn (≥)</div>
              <div className="text-base font-black text-emerald-700">
                {simulationResults.metCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-center">
              <div className="text-[10px] text-rose-600 font-bold">Còn Hẫng Hụt (&lt;)</div>
              <div className="text-base font-black text-rose-700">
                {simulationResults.gapCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-center">
              <div className="text-[10px] text-blue-600 font-bold">Thời gian IDP</div>
              <div className="text-base font-black text-blue-700">90 Ngày</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Requirements Comparison Table */}
      <div className="app-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)]">
              {isVi
                ? `Đối Soát Chi Tiết Chuẩn Năng Lực [${targetRole?.code}]`
                : `Target Role Competency Gap Breakdown [${targetRole?.code}]`}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              So sánh điểm thực tế hiện tại của {selectedUser?.name} với yêu cầu tối thiểu
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-[10px] uppercase font-bold text-[var(--muted)]">
                <th className="py-2.5 px-3">Mã &amp; Tên Năng Lực</th>
                <th className="py-2.5 px-3 text-center">Điểm Hiện Tại</th>
                <th className="py-2.5 px-3 text-center">Chuẩn Vị Trí Mới</th>
                <th className="py-2.5 px-3 text-center">Độ Lệch (Gap)</th>
                <th className="py-2.5 px-3 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {simulationResults.details.map((item) => (
                <tr key={item.competencyCode} className="hover:bg-[var(--surface-hover)] transition">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[var(--ink)]">{item.competencyName}</div>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {item.competencyCode}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-[var(--ink)]">
                    {item.actualScore.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-[var(--brand)]">
                    Mức {item.requiredLevel}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold">
                    <span className={item.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {item.gap >= 0 ? `+${item.gap}` : item.gap}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {item.isMet ? (
                      <span className="badge-pill b-active text-[10px] font-bold">
                        ĐẠT CHUẨN
                      </span>
                    ) : (
                      <span className="badge-pill b-draft text-[10px] font-bold bg-rose-500/10 text-rose-600 border-rose-500/20">
                        CẦN BỔ TRỢ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAFT PROMOTION MEMO MODAL */}
      {memoModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--brand)]" />
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi
                    ? 'Dự Thảo Tờ Trình Bổ Nhiệm / Điều Chuyển Cán Bộ'
                    : 'Draft Executive Appointment Proposal Memo'}
                </h3>
              </div>
              <button
                onClick={() => setMemoModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Document Body */}
            <div className="space-y-4 text-xs leading-relaxed text-[var(--ink)] bg-[var(--surface-hover)] p-5 rounded-xl border border-[var(--line)] font-serif">
              <div className="text-center space-y-1 pb-3 border-b border-[var(--line)]">
                <div className="font-bold uppercase tracking-widest text-[11px] text-[var(--muted)]">
                  TẬP ĐOÀN FLAMINGO HOLDINGS · HỘI ĐỒNG NHÂN SỰ
                </div>
                <div className="text-base font-bold text-[var(--brand)] font-sans">
                  TỜ TRÌNH VỀ VIỆC BỔ NHIỆM CÁN BỘ QUẢN LÝ
                </div>
                <div className="text-[10px] text-[var(--muted)] italic">
                  Căn cứ Kết quả Đánh giá Năng lực 360° &amp; Ma trận Đối soát Chức danh Chuẩn Flamingo
                </div>
              </div>

              <div className="space-y-2">
                <p>
                  <strong>Kính gửi:</strong> - Ban Tổng Giám đốc Tập đoàn Flamingo
                  <br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Ban Nhân sự &amp; Quản trị Hành chính (B11)
                </p>

                <p>
                  Hội đồng Nhân sự trân trọng đệ trình phương án kiện toàn nhân sự đối với:
                </p>

                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>
                    <strong>Nhân sự đề xuất:</strong> {selectedUser?.name} ({selectedUser?.email})
                  </li>
                  <li>
                    <strong>Vị trí hiện tại:</strong> {selectedUser?.title} — {selectedUser?.orgUnit?.name || 'Flamingo Holdings'}
                  </li>
                  <li>
                    <strong>Chức danh mục tiêu đề bạt:</strong> [{targetRole?.code}] {targetRole?.titleVi}
                  </li>
                  <li>
                    <strong>Tỷ lệ phù hợp năng lực (Role Fit Score):</strong>{' '}
                    <span className="font-bold text-[var(--brand)] font-mono">
                      {simulationResults.fitScore}%
                    </span>{' '}
                    ({simulationResults.metCount}/{simulationResults.requirementsCount} năng lực đạt chuẩn)
                  </li>
                  <li>
                    <strong>Đánh giá mức độ sẵn sàng:</strong>{' '}
                    <strong>{simulationResults.readinessLevel}</strong>
                  </li>
                </ul>

                <p>
                  <strong>Kế hoạch bồi dưỡng kèm theo (IDP 70-20-10):</strong> Đã lập lộ trình 90 ngày nhằm
                  hoàn thiện {simulationResults.gapCount} tiêu chí năng lực còn hẫng hụt, bảo trợ bởi Lãnh
                  đạo Khối đương nhiệm.
                </p>
              </div>

              <div className="pt-4 flex justify-between text-[11px] font-sans">
                <div className="text-center">
                  <div className="font-bold">NGƯỜI ĐỀ XUẤT</div>
                  <div className="text-[10px] text-[var(--muted)] mt-8">(Ký và ghi rõ họ tên)</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">BAN TỔNG GIÁM ĐỐC PHÊ DUYỆT</div>
                  <div className="text-[10px] text-[var(--muted)] mt-8">(Ký duyệt và ban hành quyết định)</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMemoModalOpen(false)}
                className="btn btn-secondary text-xs font-bold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="btn btn-primary text-xs font-bold flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>In / Xuất PDF Tờ trình</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
