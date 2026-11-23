import React, { useState } from 'react';
import {
  ProficiencyScaleModel,
  CompetencyModel,
  CompetencyVersionModel,
} from '../../packages/db/src/types';
import {
  Sliders,
  Layers,
  Award,
  GitFork,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Info,
  Shield,
} from 'lucide-react';

interface ProficiencyScaleExplorerProps {
  scales: ProficiencyScaleModel[];
  competencies: CompetencyModel[];
  versions: CompetencyVersionModel[];
}

export const ProficiencyScaleExplorer: React.FC<ProficiencyScaleExplorerProps> = ({
  scales,
  competencies,
  versions,
}) => {
  // Find root scales (where parentId === null or parent scale is standard)
  const rootScales = scales.filter(s => !s.parentId || s.type === 'STANDARD' || s.type === 'CUSTOM');
  const [selectedScaleId, setSelectedScaleId] = useState<string>(rootScales[0]?.id || scales[0]?.id || '');

  const selectedScale = scales.find(s => s.id === selectedScaleId) || rootScales[0] || scales[0];

  // Get child levels or child sub-scales for selected scale
  const childLevels = scales.filter(s => s.parentId === selectedScale?.id && s.type === 'LEVEL')
    .sort((a, b) => (a.level || 0) - (b.level || 0));

  // Competencies using this scale
  const linkedCompetencies = competencies.filter(c => c.scaleId === selectedScale?.id);

  const getLevelColor = (levelNum: number | null | undefined) => {
    switch (levelNum) {
      case 1:
        return {
          badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
          indicator: 'bg-slate-500',
          card: 'border-slate-500/20 bg-slate-950/20',
        };
      case 2:
        return {
          badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          indicator: 'bg-blue-500',
          card: 'border-blue-500/20 bg-blue-950/15',
        };
      case 3:
        return {
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          indicator: 'bg-indigo-500',
          card: 'border-indigo-500/30 bg-indigo-950/25',
        };
      case 4:
        return {
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          indicator: 'bg-emerald-500',
          card: 'border-emerald-500/20 bg-emerald-950/15',
        };
      case 5:
        return {
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          indicator: 'bg-purple-500',
          card: 'border-purple-500/30 bg-purple-950/25',
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          indicator: 'bg-slate-500',
          card: 'border-slate-800 bg-slate-900/30',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Thang đo Năng lực Flamingo 5 Cấp độ (Flamingo 5-Level Scale · FLA-5)
            </h3>
            <p className="text-xs text-slate-400">
              Thang chuẩn hóa 5 cấp độ thành thục tích hợp 5 chiều chuẩn: Độ phức tạp, Tự chủ, Phạm vi, Tác động, Tương tác.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            Scale Code: <strong className="text-amber-400">FLA-5</strong>
          </span>
          <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            5 Cấp: <strong className="text-emerald-400">Nhận biết • Áp dụng • Thành thạo • Nâng cao • Chuyên gia</strong>
          </span>
        </div>
      </div>

      {/* Scale Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rootScales.map((scale) => {
          const isSelected = scale.id === selectedScale.id;
          const levels = scales.filter(s => s.parentId === scale.id && s.type === 'LEVEL');
          const isDerived = !!scale.parentId;
          const parentScale = isDerived ? scales.find(s => s.id === scale.parentId) : null;

          return (
            <div
              key={scale.id}
              id={`scale-card-${scale.id}`}
              onClick={() => setSelectedScaleId(scale.id)}
              className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-3 ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg'
                  : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{scale.name}</h4>
                    {scale.isDefault && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                        Default Standard (Chuẩn Tập đoàn)
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-indigo-300">{scale.code}</p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  {scale.type}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {scale.description}
              </p>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  {levels.length} Cấp bậc thành thục (Mức 1..{levels.length})
                </span>
                {parentScale && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <GitFork className="w-3.5 h-3.5" />
                    Kế thừa từ {parentScale.code}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Level Progression Matrix (5-Level Standard) */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {selectedScale.name} — Ma trận Phân bổ 5 Mức &amp; Tiêu chuẩn Hành vi
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phân cấp thành thục lũy tiến chuẩn hóa điểm số từ 1.0 đến 5.0 phục vụ đánh giá 360° và xây dựng hồ sơ năng lực.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
              Thang đo: <strong className="text-emerald-400">{selectedScale.code}</strong>
            </span>
          </div>
        </div>

        {/* 5-Level Visualizer Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {childLevels.map((levelNode) => {
            const colors = getLevelColor(levelNode.level);

            return (
              <div
                key={levelNode.id}
                id={`kf-level-card-${levelNode.level}`}
                className={`p-3.5 rounded-xl border ${colors.card} flex flex-col justify-between space-y-3`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${colors.badge}`}>
                      Mức {levelNode.level}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800">
                      {levelNode.scoreMin?.toFixed(1)} - {levelNode.scoreMax?.toFixed(1)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white leading-snug">{levelNode.label}</h4>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{levelNode.code}</p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {levelNode.description}
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" />
                    Chỉ báo Hành vi
                  </div>
                  <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 leading-snug">
                    "{levelNode.behavioralAnchor}"
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Linked Competencies Banner */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <div>
              <h5 className="text-xs font-bold text-white">
                Năng lực áp dụng Thang đo này ({linkedCompetencies.length})
              </h5>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 line-clamp-2">
                {linkedCompetencies.map(c => `${c.name} [${c.code}]`).join(' • ') || 'Chưa liên kết năng lực nào.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 shrink-0 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
            scale_id: {selectedScale.id}
          </span>
        </div>

        {/* 5-Dimension Explanatory Matrix */}
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-indigo-300">
            <GitFork className="w-4 h-4" />
            <span>5 Chiều Chuẩn hóa Hành vi Flamingo (5 Behavioral Dimensions):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1 text-slate-300">
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <strong className="text-white block">1. Độ phức tạp</strong>
              <span className="text-[11px] text-slate-400">Từ quy trình lặp lại đến bài toán chiến lược đa biến số.</span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <strong className="text-white block">2. Mức tự chủ</strong>
              <span className="text-[11px] text-slate-400">Từ có giám sát trực tiếp đến hoàn toàn chịu trách nhiệm tối cao.</span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <strong className="text-white block">3. Phạm vi</strong>
              <span className="text-[11px] text-slate-400">Từ nhiệm vụ cá nhân, cấp phòng, cấp khối đến toàn Tập đoàn.</span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <strong className="text-white block">4. Mức tác động</strong>
              <span className="text-[11px] text-slate-400">Từ công việc ngắn hạn đến hiệu quả kinh doanh dài hạn.</span>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
              <strong className="text-white block">5. Tương tác</strong>
              <span className="text-[11px] text-slate-400">Từ trao đổi thông tin nội bộ đến đàm phán cấp cao và định hình ngành.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
