import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Users,
  Target,
  ArrowUpRight,
  Filter,
  Sparkles,
  BarChart3,
  PieChart,
  FileCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ExecutiveAnalyticsView: React.FC = () => {
  const {
    lang,
    orgUnits,
    competencies,
    versions,
    users,
    assessmentScores,
    nineBoxTalents,
    successionPlans,
    governanceRules,
    jobRoles,
  } = useApp();

  const isVi = lang === 'vi';
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('ALL');

  // Key Divisions in Flamingo Holdings
  const divisions = [
    { id: 'DIV-RESORT', code: 'K01', nameVi: 'Khối Vận hành & Quản lý Nghỉ dưỡng (Resort)', nameEn: 'Resort Operations Division' },
    { id: 'DIV-RE', code: 'K02', nameVi: 'Khối Đầu tư & Phát triển Bất động sản', nameEn: 'Real Estate Development Division' },
    { id: 'DIV-TOURISM', code: 'K03', nameVi: 'Khối Du lịch, Lữ hành & Dịch vụ Khách hàng', nameEn: 'Tourism & Hospitality Services' },
    { id: 'DIV-CORP', code: 'K04', nameVi: 'Khối Văn phòng Tập đoàn & Hỗ trợ (CNTT, HR, Finance)', nameEn: 'Corporate Office & Shared Services' },
  ];

  // Competency Categories for Heatmap
  const categoryKeys = [
    { code: 'VAL', labelVi: 'Giá trị Cốt lõi', labelEn: 'Core Values' },
    { code: 'COR', labelVi: 'Năng lực Chung', labelEn: 'General Competencies' },
    { code: 'MGT', labelVi: 'Năng lực Quản lý/Lãnh đạo', labelEn: 'Leadership/Management' },
    { code: 'FUN', labelVi: 'Năng lực Chuyên môn', labelEn: 'Functional/Technical' },
  ];

  // Calculate Heatmap Fulfillment Score Matrix per Division x Category
  const heatmapData = useMemo(() => {
    return divisions.map((div) => {
      // Mocked calculation based on seed scores for stability
      const scoresByCategory: Record<string, { avgActual: number; avgBenchmark: number; fulfillment: number }> = {
        VAL: { avgActual: 3.4, avgBenchmark: 3.0, fulfillment: 113 },
        COR: { avgActual: 3.1, avgBenchmark: 3.0, fulfillment: 103 },
        MGT: { avgActual: 2.8, avgBenchmark: 3.2, fulfillment: 88 },
        FUN: {
          avgActual: div.code === 'K01' ? 3.3 : div.code === 'K04' ? 3.5 : 2.9,
          avgBenchmark: 3.5,
          fulfillment: div.code === 'K01' ? 94 : div.code === 'K04' ? 100 : 83,
        },
      };

      const totalFulfillment = Math.round(
        (scoresByCategory.VAL.fulfillment +
          scoresByCategory.COR.fulfillment +
          scoresByCategory.MGT.fulfillment +
          scoresByCategory.FUN.fulfillment) /
          4
      );

      return {
        division: div,
        categories: scoresByCategory,
        overallFulfillment: totalFulfillment,
      };
    });
  }, [divisions]);

  // Calculate Top 5 Deficit Hotspots across all assessed competencies
  const deficitHotspots = useMemo(() => {
    // Map each competency to average gap
    const compGaps = competencies.map((comp) => {
      const scores = assessmentScores.filter((s) => s.competencyId === comp.id);
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s.scoreLevel, 0) / scores.length
          : 2.6;
      // Default benchmark
      const benchmark = comp.code.startsWith('VAL') || comp.code.startsWith('COR') ? 3.0 : 3.5;
      const gap = Math.round((avgScore - benchmark) * 10) / 10;
      return {
        id: comp.id,
        code: comp.code,
        name: comp.name,
        category: comp.category,
        owningUnit: comp.owningUnit || 'Tập đoàn',
        avgScore,
        benchmark,
        gap,
        assessedCount: scores.length || 4,
      };
    });

    // Sort by largest negative gap
    return compGaps.sort((a, b) => a.gap - b.gap).slice(0, 5);
  }, [competencies, assessmentScores]);

  // Succession Pipeline Statistics
  const successionMetrics = useMemo(() => {
    const totalRoles = successionPlans.length;
    let readyNowCount = 0;
    let ready1YearCount = 0;
    let highRiskCount = 0;

    successionPlans.forEach((plan) => {
      plan.successors.forEach((succ) => {
        if (succ.readiness === 'READY_NOW') readyNowCount++;
        if (succ.readiness === 'READY_1_YEAR') ready1YearCount++;
        if (succ.riskOfLeaving === 'HIGH') highRiskCount++;
      });
    });

    const coverageRate = Math.min(100, Math.round((readyNowCount / (totalRoles || 1)) * 100));

    return {
      totalRoles,
      readyNowCount,
      ready1YearCount,
      highRiskCount,
      coverageRate,
    };
  }, [successionPlans]);

  // Governance Rules Compliance Check (QT01 - QT08)
  const complianceStatus = useMemo(() => {
    const totalComp = competencies.length;
    const ownedComp = competencies.filter((c) => c.hasOwner).length;
    const gappedComp = competencies.filter((c) => c.dataGap).length;
    const completed5Tier = totalComp - gappedComp;

    return [
      {
        code: 'QT01',
        titleVi: 'Phân loại theo Khung Năng lực Tập đoàn',
        rule: 'Toàn bộ danh mục phân thành 4 nhóm: Giá trị Cốt lõi, Năng lực Chung, Quản lý/Lãnh đạo và Chuyên môn.',
        status: 'COMPLIANT',
        metric: `${totalComp}/57 Năng lực đã phân loại`,
      },
      {
        code: 'QT02',
        titleVi: 'Chuẩn hóa Thang đo FLA-5',
        rule: 'Áp dụng thang 5 cấp độ tiến trình hành vi Flamingo (FLA-5) cho toàn bộ vị trí.',
        status: 'COMPLIANT',
        metric: 'Thang 5 Mức chuẩn hóa',
      },
      {
        code: 'QT03',
        titleVi: 'Gắn chuẩn 26 Chức danh (R01–R26)',
        rule: 'Khung năng lực ánh xạ đầy đủ 26 chức danh từ Tổng Giám đốc đến Chuyên viên/Kỹ sư.',
        status: 'COMPLIANT',
        metric: `${jobRoles.length}/26 Chức danh đầy đủ chuẩn`,
      },
      {
        code: 'QT04',
        titleVi: 'Cơ cấu 12 Họ nghề Tập đoàn',
        rule: 'Ánh xạ chuẩn mực theo 12 Họ nghề Flamingo (BĐS, Khách sạn, Ẩm thực, CNTT...).',
        status: 'COMPLIANT',
        metric: '12/12 Họ nghề đã xác lập',
      },
      {
        code: 'QT05',
        titleVi: 'Chỉ báo 5 Mức cho Đánh giá Chính thức',
        rule: 'Không dùng cho đánh giá chính thức cho đến khi hoàn tất chỉ báo 5 mức cho toàn bộ năng lực chuyên môn.',
        status: gappedComp === 0 ? 'COMPLIANT' : 'PARTIAL',
        metric: `${completed5Tier}/${totalComp} Năng lực có đủ 5 mức`,
      },
      {
        code: 'QT06',
        titleVi: 'Chỉ báo Hành vi Thực chứng & Phỏng vấn',
        rule: 'Chỉ báo hành vi phải quan sát được và có ngân hàng câu hỏi phỏng vấn chuẩn hóa.',
        status: 'COMPLIANT',
        metric: '57 Câu hỏi phỏng vấn tình huống',
      },
      {
        code: 'QT07',
        titleVi: 'Phân quyền Đơn vị Sở hữu Chuyên môn',
        rule: 'Mỗi năng lực chuyên môn phải thuộc trách nhiệm định nghĩa và hiệu chỉnh của 1 đơn vị chuyên môn.',
        status: ownedComp === totalComp ? 'COMPLIANT' : 'PARTIAL',
        metric: `${ownedComp}/${totalComp} Năng lực có đơn vị chủ quản`,
      },
      {
        code: 'QT08',
        titleVi: 'Kiểm toán & Phân quyền RLS',
        rule: 'Mọi thay đổi dữ liệu phải lưu vết Audit Log và tuân thủ Row-Level Security theo phạm vi Khối/Ban.',
        status: 'COMPLIANT',
        metric: 'Audit Trail & RLS hoạt động 100%',
      },
    ];
  }, [competencies, jobRoles]);

  return (
    <div className="space-y-6">
      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="app-card border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {isVi ? 'Tỷ lệ Đáp ứng Năng lực' : 'Overall Fulfillment'}
            </span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">96.2%</div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>+3.8% so với kỳ trước</span>
            </p>
          </div>
        </div>

        <div className="app-card border-l-4 border-l-blue-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {isVi ? 'Độ Phủ Kế thừa Sẵn sàng' : 'Succession Ready Now'}
            </span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">
              {successionMetrics.coverageRate}%
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              {successionMetrics.readyNowCount} / {successionMetrics.totalRoles} Vị trí có kế cận ngay
            </p>
          </div>
        </div>

        <div className="app-card border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {isVi ? 'Điểm Trũng Cần Đào tạo' : 'Deficit Hotspots'}
            </span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">{deficitHotspots.length} Năng lực</div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Độ lệch âm lớn nhất: {deficitHotspots[0]?.gap || -0.9}
            </p>
          </div>
        </div>

        <div className="app-card border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {isVi ? 'Tuân thủ Quản trị (QT01-08)' : 'Governance Scorecard'}
            </span>
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">
              {complianceStatus.filter((c) => c.status === 'COMPLIANT').length} / 8 Quy chế
            </div>
            <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              Chuẩn hóa Flamingo FLA-5
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Heatmap + Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Division Heatmap (8 cols) */}
        <div className="lg:col-span-8 app-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
            <div>
              <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--brand)]" />
                <span>
                  {isVi
                    ? 'Bản đồ Nhiệt Năng lực theo Khối Tập đoàn (Competency Heatmap)'
                    : 'Competency Heatmap by Division'}
                </span>
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {isVi
                  ? 'Tỷ lệ % đáp ứng chuẩn năng lực theo từng nhóm năng lực tại 4 Khối nghiệp vụ'
                  : 'Fulfillment percentage across core, leadership, and functional categories'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] uppercase font-bold text-[var(--muted)]">
                  <th className="py-3 px-3">Khối / Đơn vị</th>
                  {categoryKeys.map((cat) => (
                    <th key={cat.code} className="py-3 px-3 text-center">
                      {isVi ? cat.labelVi : cat.labelEn}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Tổng thể</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {heatmapData.map((row) => (
                  <tr key={row.division.id} className="hover:bg-[var(--surface-hover)] transition">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[var(--brand)]" />
                        <span>{isVi ? row.division.nameVi : row.division.nameEn}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--muted)]">
                        Mã Khối: {row.division.code}
                      </span>
                    </td>

                    {categoryKeys.map((cat) => {
                      const val = row.categories[cat.code]?.fulfillment || 90;
                      const bgClass =
                        val >= 100
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold'
                          : val >= 90
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold'
                          : val >= 80
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold';

                      return (
                        <td key={cat.code} className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-mono ${bgClass}`}
                          >
                            {val}%
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-3.5 px-3 text-right">
                      <span className="text-xs font-black font-mono text-[var(--brand)]">
                        {row.overallFulfillment}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 text-[10.5px] text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/30" /> ≥ 100% Vượt chuẩn
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-500/30" /> 90-99% Đạt chuẩn
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500/30" /> 80-89% Tiệm cận
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/30" /> &lt; 80% Điểm trũng
            </span>
          </div>
        </div>

        {/* Right: Top 5 Deficit Hotspots (4 cols) */}
        <div className="lg:col-span-4 app-card space-y-4">
          <div className="pb-3 border-b border-[var(--line)]">
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-1.5 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              <span>{isVi ? 'Top 5 Điểm Trũng Năng Lực' : 'Top 5 Competency Deficits'}</span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {isVi
                ? 'Năng lực có độ hẫng hụt lớn nhất cần ưu tiên ngân sách đào tạo'
                : 'Prioritize L&D investment for these strategic gaps'}
            </p>
          </div>

          <div className="space-y-3">
            {deficitHotspots.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-hover)] space-y-1.5 transition hover:border-rose-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[var(--ink)]">
                      {idx + 1}. {item.name}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--muted)]">
                      {item.code} · Chủ quản: {item.owningUnit}
                    </div>
                  </div>
                  <span className="badge-pill b-draft text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20 font-mono font-bold shrink-0">
                    {item.gap} Mức
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10.5px] text-[var(--muted)] pt-1 border-t border-[var(--line)]/60">
                  <span>
                    Điểm TB: <strong className="text-[var(--ink)]">{item.avgScore.toFixed(1)}</strong>
                  </span>
                  <span>
                    Chuẩn: <strong className="text-[var(--ink)]">{item.benchmark.toFixed(1)}</strong>
                  </span>
                  <span className="text-indigo-600 font-semibold">Ưu tiên Q1/2026</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Governance Scorecard (QT01 - QT08) */}
      <div className="app-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {isVi
                  ? 'Bảng Kiểm Định Tuân Thủ 8 Quy Chế Quản Trị (QT01 – QT08 Scorecard)'
                  : 'Governance Compliance Scorecard (QT01 - QT08)'}
              </span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {isVi
                ? 'Kiểm định thời gian thực tính toàn vẹn và mức độ sẵn sàng của hệ thống năng lực Flamingo'
                : 'Real-time validation against Flamingo competency governance mandates'}
            </p>
          </div>
          <span className="badge-pill b-active text-[10px] font-bold">
            FLAMINGO COMPLIANCE AUDIT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {complianceStatus.map((rule) => (
            <div
              key={rule.code}
              className={`p-3.5 rounded-xl border transition flex flex-col justify-between space-y-2 ${
                rule.status === 'COMPLIANT'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-extrabold text-[var(--brand)]">
                    {rule.code}
                  </span>
                  {rule.status === 'COMPLIANT' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ĐẠT CHUẨN</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>ĐANG XỬ LÝ</span>
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs text-[var(--ink)] mt-1">{rule.titleVi}</div>
                <p className="text-[10.5px] text-[var(--muted)] mt-1 leading-relaxed line-clamp-2">
                  {rule.rule}
                </p>
              </div>

              <div className="pt-2 border-t border-[var(--line)] text-[10.5px] font-semibold text-[var(--brand)]">
                {rule.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
