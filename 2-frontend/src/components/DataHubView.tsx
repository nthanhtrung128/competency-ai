import React, { useState } from 'react';
import {
  Database,
  Upload,
  Download,
  RotateCcw,
  FileCheck2,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  FileCode2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import rawFlamingoData from '../data/flamingo_seed_data.json';

export const DataHubView: React.FC = () => {
  const {
    lang,
    orgUnits,
    users,
    competencies,
    versions,
    dataWarnings,
    jobFamilies,
    jobLevels,
    jobRoles,
    interviewQuestions,
    assessmentScores,
    importEnterpriseDataset,
    exportEnterpriseDataset,
    resetToSeedData,
  } = useApp();

  const isVi = lang === 'vi';
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [activeTab, setActiveTab] = useState<'guide' | 'import' | 'export' | 'warnings'>('warnings');

  // Handle JSON Import
  const handleImport = () => {
    if (!jsonInput.trim()) {
      setImportStatus({
        type: 'error',
        message: isVi ? 'Vui lòng dán nội dung JSON hợp lệ.' : 'Please paste valid JSON payload.',
      });
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      const res = importEnterpriseDataset(parsed);
      if (res.success) {
        setImportStatus({ type: 'success', message: res.message });
        setJsonInput('');
      } else {
        setImportStatus({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: isVi
          ? `Lỗi cú pháp JSON: ${err.message}`
          : `Invalid JSON syntax: ${err.message}`,
      });
    }
  };

  // Download JSON Snapshot
  const handleDownloadSnapshot = () => {
    const jsonStr = exportEnterpriseDataset();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flamingo_enterprise_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load Flamingo Raw Data directly into importer
  const loadFlamingoSeedData = () => {
    setJsonInput(JSON.stringify(rawFlamingoData, null, 2));
    setImportStatus({
      type: 'idle',
      message: isVi
        ? 'Đã tải toàn bộ tập tin flamingo_seed_data.json vào khung nhập. Nhấn "Thực thi Nhập Dữ Liệu" để nạp theo thứ tự quy chuẩn.'
        : 'Loaded flamingo_seed_data.json into editor. Click Execute Dataset Import to apply.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="app-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {isVi ? 'Trung tâm Quản trị & Nhập / Xuất Dữ liệu Doanh nghiệp' : 'Enterprise Data Hub & Migration Center'}
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {isVi
              ? 'Kiểm định chất lượng dữ liệu gốc Flamingo, đối chiếu thang thành thục và quản lý nạp dữ liệu chuẩn hóa.'
              : 'Audit raw Flamingo dataset warnings, proficiency scale alignment, and standardized data ingestion.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--brand-50)] border border-[var(--brand-100)]">
          <button
            onClick={() => setActiveTab('warnings')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'warnings'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isVi ? 'Cảnh báo Dữ liệu Gốc' : 'Data Warnings'} ({dataWarnings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{isVi ? 'Lộ trình Nạp Dữ liệu' : 'Ingestion Roadmap'}</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isVi ? 'Nhập Dữ liệu (Import)' : 'Import'}</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isVi ? 'Sao lưu & Xuất' : 'Backup & Export'}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Đơn vị tổ chức' : 'Org Units'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">{orgUnits.length}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Tập đoàn, Khối, Ban, Cụm</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Tổng Năng lực' : 'Competencies'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">{competencies.length}</div>
          <div className="text-[10px] text-[var(--brand)] font-medium">6 Core, 6 Lead, 45 Fun</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Thang thành thục' : 'Proficiency Scale'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">FLA-5</div>
          <div className="text-[10px] text-indigo-600 font-medium">5 Mức chuẩn hóa</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Họ nghề (Families)' : 'Job Families'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">{jobFamilies.length}</div>
          <div className="text-[10px] text-slate-500 font-medium">{jobRoles.length} Chức danh</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Cấp bậc nghề' : 'Job Levels'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">{jobLevels.length}</div>
          <div className="text-[10px] text-amber-600 font-medium">B1 - B7 (Chuyên gia & QL)</div>
        </div>
        <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="text-[11px] text-[var(--muted)] font-semibold">{isVi ? 'Câu hỏi Phỏng vấn' : 'Interview Qs'}</div>
          <div className="text-xl font-bold text-[var(--ink)] mt-0.5">{interviewQuestions.length}</div>
          <div className="text-[10px] text-purple-600 font-medium">Kèm bằng chứng ngược</div>
        </div>
      </div>

      {/* TAB: DATA WARNINGS */}
      {activeTab === 'warnings' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-[var(--ink)]">
                {isVi
                  ? 'Báo cáo Kiểm định Dữ liệu Gốc (Audited Data Warnings từ flamingo_seed_data.json)'
                  : 'Audited Data Quality Warnings'}
              </h4>
              <p className="text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Dưới đây là các điểm cần lưu ý và hành động quản trị đối với tập dữ liệu gốc đã được hệ thống phân tích và xử lý an toàn theo sự đồng thuận của bạn:'
                  : 'Critical data governance issues detected in raw payload and harmonized by the system:'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="app-card space-y-3 border-l-4 border-l-amber-500"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    CẢNH BÁO #{idx + 1}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    warning.severity === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    Mức độ: {warning.severity}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[var(--ink)]">
                    Khu vực: <code className="text-indigo-600 dark:text-indigo-400">{warning.area}</code>
                  </h4>
                  <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                    {warning.issue}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--ink)] leading-relaxed">
                  <strong className="text-emerald-600 block mb-0.5">Khuyến nghị & Giải pháp đã thực thi:</strong>
                  {warning.action}
                </div>
              </div>
            ))}
          </div>

          {/* Special Action Callout */}
          <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-xs text-[var(--ink)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{isVi ? 'Thứ tự nạp đã được thiết lập đúng chuẩn:' : 'Ingestion sequence strictly maintained:'}</span>
              </div>
              <p className="text-xs text-[var(--muted)] font-mono">
                proficiencyScale (FLA-5) ➔ competencyCategories ➔ orgUnits (tier tăng dần) ➔ competencies ➔ interviewQuestions ➔ jobFamilies ➔ jobLevels ➔ jobRoles
              </p>
            </div>
            <button
              onClick={() => setActiveTab('import')}
              className="btn btn-primary text-xs font-bold shrink-0 flex items-center gap-1.5"
            >
              <span>{isVi ? 'Xem Khung Nạp Dữ Liệu' : 'View Import Studio'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB: INGESTION ROADMAP */}
      {activeTab === 'guide' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-[var(--ink)]">
                {isVi
                  ? 'Quy trình Nạp Dữ liệu 8 Bước theo Phân cấp Quản trị Tập đoàn Flamingo'
                  : 'Flamingo 8-Step Enterprise Ingestion Sequence'}
              </h4>
              <p className="text-[var(--muted)] leading-relaxed">
                {isVi
                  ? 'Để đảm bảo toàn vẹn tham chiếu khóa ngoại (Foreign Keys) và phân cấp tổ chức (Nested Path & Parent-Child), dữ liệu được xử lý tuần tự theo đúng chỉ đạo của bạn.'
                  : 'Ensures foreign key consistency and recursive hierarchy integrity.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="app-card space-y-2 border-t-2 border-t-[var(--brand)]">
              <span className="text-[10px] font-bold text-[var(--brand)]">BƯỚC 1</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">proficiencyScale</h4>
              <p className="text-[11px] text-[var(--muted)]">Thang đo Flamingo 5 mức (FLA-5) làm gốc chuẩn hóa.</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-indigo-500">
              <span className="text-[10px] font-bold text-indigo-600">BƯỚC 2</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">competencyCategories</h4>
              <p className="text-[11px] text-[var(--muted)]">Nhóm năng lực: Core (VAL/COR), Leadership (LEA), Functional (FUN).</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-emerald-500">
              <span className="text-[10px] font-bold text-emerald-600">BƯỚC 3</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">orgUnits (theo tier)</h4>
              <p className="text-[11px] text-[var(--muted)]">Nạp theo tier 1 (Tập đoàn) ➔ tier 2 (Khối) ➔ tier 3 (Ban/Phòng/Cụm).</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-amber-500">
              <span className="text-[10px] font-bold text-amber-600">BƯỚC 4</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">competencies</h4>
              <p className="text-[11px] text-[var(--muted)]">57 Năng lực, cắm mốc tiêu chuẩn Mức 3 và cảnh báo hasOwner.</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-purple-500">
              <span className="text-[10px] font-bold text-purple-600">BƯỚC 5</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">interviewQuestions</h4>
              <p className="text-[11px] text-[var(--muted)]">Ngân hàng phỏng vấn & bằng chứng ngược đối ứng.</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-rose-500">
              <span className="text-[10px] font-bold text-rose-600">BƯỚC 6</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">jobFamilies</h4>
              <p className="text-[11px] text-[var(--muted)]">12 Họ nghề theo chuỗi giá trị bất động sản & nghỉ dưỡng.</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-cyan-500">
              <span className="text-[10px] font-bold text-cyan-600">BƯỚC 7</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">jobLevels</h4>
              <p className="text-[11px] text-[var(--muted)]">Khung bậc B1 - B7 (Nhân viên ➔ Chuyên gia ➔ TGĐ).</p>
            </div>
            <div className="app-card space-y-2 border-t-2 border-t-teal-500">
              <span className="text-[10px] font-bold text-teal-600">BƯỚC 8</span>
              <h4 className="text-xs font-bold text-[var(--ink)]">jobRoles</h4>
              <p className="text-[11px] text-[var(--muted)]">Ma trận chức danh, gán phòng ban và năng lực bắt buộc.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: IMPORT STUDIO */}
      {activeTab === 'import' && (
        <div className="space-y-5">
          <div className="app-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Nạp Dữ liệu JSON Doanh nghiệp (Enterprise Import)' : 'Enterprise JSON Dataset Importer'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Dán JSON hoặc bấm "Nạp flamingo_seed_data.json" để nạp trực tiếp bộ dữ liệu gốc Tập đoàn Flamingo.'
                    : 'Paste JSON or load flamingo_seed_data.json directly.'}
                </p>
              </div>
              <button
                onClick={loadFlamingoSeedData}
                className="btn btn-secondary text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isVi ? 'Tải flamingo_seed_data.json' : 'Load Flamingo JSON'}</span>
              </button>
            </div>

            {/* JSON Code Input Area */}
            <div className="space-y-2">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={
                  isVi
                    ? '{\n  "proficiencyScale": {...},\n  "competencyCategories": [...],\n  "orgUnits": [...],\n  "competencies": [...]\n}'
                    : '{\n  "proficiencyScale": {...},\n  "competencyCategories": [...],\n  "orgUnits": [...],\n  "competencies": [...]\n}'
                }
                rows={12}
                className="w-full font-mono text-xs p-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)] transition"
              />
            </div>

            {/* Status Alert */}
            {importStatus.type === 'success' && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importStatus.message}</span>
              </div>
            )}
            {importStatus.type === 'error' && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importStatus.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[var(--muted)]">
                {isVi ? 'Dữ liệu được nạp theo đúng thứ tự 8 bước quy chuẩn và lưu trong localStorage.' : 'Ingested in 8-step strict sequence and cached locally.'}
              </span>
              <button
                onClick={handleImport}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isVi ? 'Thực thi Nhập Dữ Liệu' : 'Execute Dataset Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BACKUP & EXPORT */}
      {activeTab === 'export' && (
        <div className="space-y-5">
          <div className="app-card space-y-4">
            <div className="pb-3 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Xuất Snapshot & Sao lưu Hệ thống' : 'Export Snapshot & System Backup'}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                {isVi
                  ? 'Tải toàn bộ trạng thái dữ liệu hiện tại (bao gồm cả kiến trúc nghề, câu hỏi phỏng vấn, hồ sơ năng lực) về máy tính.'
                  : 'Download complete state of all models to JSON.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
                  <Download className="w-4 h-4 text-[var(--brand)]" />
                  <span>{isVi ? 'Xuất Toàn bộ Dữ liệu Flamingo (JSON)' : 'Full Enterprise JSON Backup'}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Bao gồm Cơ cấu tổ chức, Từ điển 57 năng lực, 12 Họ nghề, Cấp bậc B1-B7, Phân quyền RLS và Điểm 360°.'
                    : 'Includes OrgUnits, 57 Competencies, 12 Job Families, B1-B7 Levels, RLS Scopes, and 360 Scores.'}
                </p>
                <button
                  onClick={handleDownloadSnapshot}
                  className="btn btn-primary w-full text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Tải Snapshot JSON (.json)' : 'Download JSON Snapshot'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
                  <RotateCcw className="w-4 h-4" />
                  <span>{isVi ? 'Khôi phục Dữ liệu Flamingo Gốc' : 'Restore Flamingo Seed Data'}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Nạp lại toàn bộ tập dữ liệu flamingo_seed_data.json với thang 5 mức và cấu trúc tổ chức nguyên bản.'
                    : 'Restores flamingo_seed_data.json with 5-level scale and full organizational hierarchy.'}
                </p>
                <button
                  onClick={() => {
                    if (window.confirm(isVi ? 'Bạn có chắc chắn muốn khôi phục về dữ liệu Flamingo ban đầu?' : 'Reset to default Flamingo seed data?')) {
                      resetToSeedData();
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-rose-500/30 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Khôi phục về Flamingo Seed Data' : 'Reset to Flamingo Defaults'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
