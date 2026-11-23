import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Layers,
  FileText,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowRight,
  Shield,
  ChevronRight,
  Printer,
  Copy,
  Check,
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  HelpCircle,
  AlertTriangle,
  Building2,
  TrendingUp,
  Compass,
  BookOpen,
  Award,
  Users,
  Target,
  Info,
} from 'lucide-react';
import { Language } from '../data/i18n';
import {
  CompetencyModel,
  JobFamilyModel,
  JobLevelModel,
  JobRoleModel,
  JobRoleRequirement,
} from '../../packages/db/src/types';
import { useApp } from '../context/AppContext';

interface SuccessProfileViewProps {
  lang?: Language;
  jobFamilies?: JobFamilyModel[];
  competencies?: CompetencyModel[];
}

export const SuccessProfileView: React.FC<SuccessProfileViewProps> = ({
  lang: propLang,
  jobFamilies: propJobFamilies,
  competencies: propCompetencies,
}) => {
  const {
    lang: contextLang,
    jobFamilies: contextJobFamilies,
    jobLevels,
    jobRoles,
    competencies: contextCompetencies,
    versions,
    interviewQuestions,
    orgUnits,
    updateJobRole,
    addJobRole,
  } = useApp();

  const lang = propLang || contextLang || 'vi';
  const isVi = lang === 'vi';
  const currentJobFamilies = propJobFamilies && propJobFamilies.length > 0 ? propJobFamilies : contextJobFamilies;
  const currentCompetencies = propCompetencies && propCompetencies.length > 0 ? propCompetencies : contextCompetencies;

  /** Chỉ báo của đúng năng lực, đúng mức, lấy từ bản đang hiệu lực — không mượn của năng lực khác, không điền câu chung chung. */
  const anchorFor = (code: string, level: number) => {
    const comp = currentCompetencies.find((c) => c.code === code);
    if (!comp) return `[Chưa đối chiếu được sang mã Từ điển — nhãn gốc "${code}"]`;
    const ver =
      versions.find((v) => v.id === comp.currentVersionId) ||
      versions.find((v) => v.competencyId === comp.id && v.status === 'PUBLISHED');
    const a = [ver?.level1Anchor, ver?.level2Anchor, ver?.level3Anchor, ver?.level4Anchor, ver?.level5Anchor][level - 1];
    return a || `[Mức ${level} chưa có chỉ báo]`;
  };

  // Tabs for navigation
  const [activeTab, setActiveTab] = useState<'roles' | 'levels' | 'families'>('roles');

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFamilyFilter, setSelectedFamilyFilter] = useState<string>('ALL');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>(jobRoles[0]?.code || 'R01');

  // Modals & Edit States
  const [showJDModal, setShowJDModal] = useState<boolean>(false);
  const [copiedJD, setCopiedJD] = useState<boolean>(false);
  const [showEditRequirementsModal, setShowEditRequirementsModal] = useState<boolean>(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState<boolean>(false);

  // New Role Form State
  const [newRoleCode, setNewRoleCode] = useState<string>('');
  const [newRoleTitle, setNewRoleTitle] = useState<string>('');
  const [newRoleFamily, setNewRoleFamily] = useState<string>(currentJobFamilies[0]?.code || 'JF01');
  const [newRoleLevel, setNewRoleLevel] = useState<string>(jobLevels[0]?.code || 'L1');
  const [newRoleStream, setNewRoleStream] = useState<string>('Chuyên môn');

  // Edit Requirements Form State
  const [editingRequirements, setEditingRequirements] = useState<JobRoleRequirement[]>([]);
  const [addCompCode, setAddCompCode] = useState<string>('');
  const [addCompLevel, setAddCompLevel] = useState<number>(3);

  // Active Role Lookup
  const selectedRole = useMemo(() => {
    return jobRoles.find((r) => r.code === selectedRoleCode) || jobRoles[0];
  }, [jobRoles, selectedRoleCode]);

  // Active Role Family & Level Lookup
  const roleFamily = useMemo(() => {
    if (!selectedRole) return null;
    return currentJobFamilies.find(
      (f) => f.code.toUpperCase() === selectedRole.jobFamily.toUpperCase() || f.id === selectedRole.jobFamily
    );
  }, [currentJobFamilies, selectedRole]);

  const roleLevel = useMemo(() => {
    if (!selectedRole) return null;
    return jobLevels.find((l) => l.code === selectedRole.jobLevel);
  }, [jobLevels, selectedRole]);

  // Filtered Job Roles
  const filteredRoles = useMemo(() => {
    return jobRoles.filter((role) => {
      const matchSearch =
        role.titleVi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFamily =
        selectedFamilyFilter === 'ALL' || role.jobFamily === selectedFamilyFilter;
      const matchLevel =
        selectedLevelFilter === 'ALL' || role.jobLevel === selectedLevelFilter;
      return matchSearch && matchFamily && matchLevel;
    });
  }, [jobRoles, searchTerm, selectedFamilyFilter, selectedLevelFilter]);

  // Open Edit Requirements Modal
  const handleOpenEditRequirements = () => {
    if (selectedRole) {
      setEditingRequirements([...selectedRole.requirements]);
      setAddCompCode(currentCompetencies[0]?.code || '');
      setAddCompLevel(3);
      setShowEditRequirementsModal(true);
    }
  };

  // Save Requirements
  const handleSaveRequirements = () => {
    if (selectedRole) {
      updateJobRole(selectedRole.code, { requirements: editingRequirements });
      setShowEditRequirementsModal(false);
    }
  };

  // Add Competency to Role Requirements
  const handleAddRequirementItem = () => {
    if (!addCompCode) return;
    const exists = editingRequirements.some((r) => r.competency === addCompCode);
    if (exists) {
      setEditingRequirements((prev) =>
        prev.map((r) => (r.competency === addCompCode ? { ...r, requiredLevel: addCompLevel } : r))
      );
    } else {
      setEditingRequirements((prev) => [...prev, { competency: addCompCode, requiredLevel: addCompLevel }]);
    }
  };

  // Remove Competency from Role Requirements
  const handleRemoveRequirementItem = (code: string) => {
    setEditingRequirements((prev) => prev.filter((r) => r.competency !== code));
  };

  // Create New Role
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleCode.trim() || !newRoleTitle.trim()) return;

    // Pick 3 default competencies matching the level
    const defaultReqs: JobRoleRequirement[] = [
      { competency: 'CO01', requiredLevel: newRoleLevel === 'L1' || newRoleLevel === 'L2' ? 2 : 3 },
      { competency: 'CO03', requiredLevel: 3 },
    ];
    if (newRoleLevel === 'L4' || newRoleLevel === 'L5' || newRoleLevel === 'L6') {
      defaultReqs.push({ competency: 'LE01', requiredLevel: 4 });
    }

    const newRole: JobRoleModel = {
      code: newRoleCode.toUpperCase().trim(),
      titleVi: newRoleTitle.trim(),
      jobFamily: newRoleFamily,
      jobLevel: newRoleLevel,
      careerStream: newRoleStream,
      requirements: defaultReqs,
    };

    addJobRole(newRole);
    setSelectedRoleCode(newRole.code);
    setShowAddRoleModal(false);
    setNewRoleCode('');
    setNewRoleTitle('');
  };

  // Copy JD text to clipboard
  const handleCopyJD = () => {
    if (!selectedRole) return;
    const roleReqs = selectedRole.requirements.map((req, idx) => {
      const comp = currentCompetencies.find((c) => c.code === req.competency);
      const anchor = anchorFor(req.competency, req.requiredLevel);

      return `${idx + 1}. [${req.competency}] ${comp?.name || req.competency}\n   - Chuẩn mực yêu cầu: Mức ${req.requiredLevel}/5 (Thang Flamingo FLA-5)\n   - Tiêu chuẩn hành vi minh chứng:\n     "${anchor}"`;
    }).join('\n\n');

    const jdText = `TẬP ĐOÀN FLAMINGO - BẢN MÔ TẢ CÔNG VIỆC CHUẨN HÓA (JOB SUCCESS PROFILE)\n` +
      `=========================================================================\n` +
      `Vị trí chức danh: ${selectedRole.titleVi}\n` +
      `Mã chức danh: ${selectedRole.code}\n` +
      `Họ nghề nghiệp: [${selectedRole.jobFamily}] ${roleFamily?.name || ''}\n` +
      `Cấp bậc chuẩn: [${selectedRole.jobLevel}] ${roleLevel?.nameVi || ''} (Grade: ${roleLevel?.grade || ''})\n` +
      `Dòng nghề nghiệp: ${selectedRole.careerStream}\n` +
      `Khung năng lực bậc chuẩn: Cốt lõi: ${roleLevel?.requiredBand.core || ''} | Lãnh đạo: ${roleLevel?.requiredBand.leadership || ''} | Chuyên môn: ${roleLevel?.requiredBand.functional || ''}\n` +
      `Phạm vi ảnh hưởng: ${roleLevel?.scope || ''}\n\n` +
      `MA TRẬN NĂNG LỰC BẮT BUỘC (THANG ĐO FLAMINGO 5 MỨC - FLA-5):\n` +
      `-------------------------------------------------------------------------\n` +
      roleReqs + `\n\n` +
      `Ghi chú: Hồ sơ chức danh được ban hành theo quy chuẩn quản trị QT04 & QT05 của Tập đoàn Flamingo.`;

    navigator.clipboard.writeText(jdText);
    setCopiedJD(true);
    setTimeout(() => setCopiedJD(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="app-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {isVi ? 'Kiến trúc Nghề nghiệp & Hồ sơ Chức danh Flamingo' : 'Job Architecture & Role Success Profiles'}
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
              FLA-5 Synchronized
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {isVi
              ? 'Đồng bộ 26 vị trí chức danh (R01–R26), 6 cấp bậc chuẩn (L1–L6), 14 họ nghề và ma trận năng lực FLA-5.'
              : 'Synchronized 26 job roles, 6 corporate tiers, 14 job families, and 5-level behavioral standards.'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-add-role-modal"
            onClick={() => setShowAddRoleModal(true)}
            className="btn btn-secondary text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--brand)]" />
            <span>{isVi ? 'Thêm Chức danh' : 'Add Role'}</span>
          </button>
          <button
            id="btn-export-jd-modal"
            onClick={() => setShowJDModal(true)}
            className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>{isVi ? 'Xuất Bản JD Chuẩn' : 'Generate JD'}</span>
          </button>
        </div>
      </div>

      {/* Guidance Banner for User Contribution & Data Sync */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-transparent dark:from-indigo-950/20 dark:via-purple-950/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{isVi ? 'HƯỚNG DẪN ĐỒNG BỘ & ĐÓNG GÓP BỔ SUNG DỮ LIỆU CHỨC DANH' : 'ROLE DATA CONTRIBUTION GUIDELINES'}</span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            {jobRoles.length} {isVi ? 'Vị trí đã chuẩn hóa' : 'Roles Configured'}
          </span>
        </div>
        <p className="text-xs text-[var(--ink)] leading-relaxed">
          {isVi
            ? 'Hệ thống đã nạp sẵn 26 vị trí chức danh cốt lõi bao phủ từ Chuyên viên đến Lãnh đạo cấp cao. Để hoàn thiện dữ liệu thực tế cho từng Khối/Ban:'
            : 'The system has ingested 26 core job roles covering junior specialists to executives. To refine for your business units:'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <strong className="text-[var(--ink)] block font-semibold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[var(--brand)]" />
              1. Tinh chỉnh Điểm chuẩn
            </strong>
            <p className="text-[11px] text-[var(--muted)]">
              Bấm nút <strong>"Chỉnh sửa Năng lực"</strong> để điều chỉnh điểm mục tiêu (Mức 1 đến Mức 5) cho phù hợp với tiêu chuẩn thực tế của phòng ban bạn.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <strong className="text-[var(--ink)] block font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              2. Bổ sung Năng lực Chuyên môn
            </strong>
            <p className="text-[11px] text-[var(--muted)]">
              Bạn có thể gán thêm các năng lực chuyên ngành (FU01–FU45) còn lại vào chức danh để thiết lập ma trận kiểm tra năng lực toàn diện.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] space-y-1">
            <strong className="text-[var(--ink)] block font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              3. Thêm Vị trí Mới
            </strong>
            <p className="text-[11px] text-[var(--muted)]">
              Sử dụng nút <strong>"Thêm Chức danh"</strong> để tạo mới bất kỳ vị trí chức danh nào còn thiếu theo quyết định cơ cấu tổ chức mới nhất.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[var(--line)] gap-2">
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>{isVi ? `Hồ sơ 26 Chức danh (${jobRoles.length})` : `Job Role Profiles (${jobRoles.length})`}</span>
        </button>
        <button
          onClick={() => setActiveTab('levels')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'levels'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isVi ? `Ma trận 6 Cấp bậc (L1–L6)` : `Corporate 6-Tier Matrix`}</span>
        </button>
        <button
          onClick={() => setActiveTab('families')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'families'
              ? 'border-[var(--brand)] text-[var(--brand)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>{isVi ? `Danh mục 14 Họ nghề (${currentJobFamilies.length})` : `14 Job Families`}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 26 JOB ROLES & SUCCESS PROFILES                                     */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Role Directory & Filters (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="app-card space-y-3">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder={isVi ? 'Tìm kiếm chức danh, mã...' : 'Search roles, code...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-8 text-xs w-full"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    {isVi ? 'Họ nghề' : 'Family'}
                  </label>
                  <select
                    value={selectedFamilyFilter}
                    onChange={(e) => setSelectedFamilyFilter(e.target.value)}
                    className="input text-xs w-full py-1.5"
                  >
                    <option value="ALL">{isVi ? 'Tất cả họ nghề' : 'All Families'}</option>
                    {currentJobFamilies.map((jf) => (
                      <option key={jf.code} value={jf.code}>
                        {jf.code} - {jf.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    {isVi ? 'Cấp bậc' : 'Level'}
                  </label>
                  <select
                    value={selectedLevelFilter}
                    onChange={(e) => setSelectedLevelFilter(e.target.value)}
                    className="input text-xs w-full py-1.5"
                  >
                    <option value="ALL">{isVi ? 'Tất cả bậc' : 'All Levels'}</option>
                    {jobLevels.map((lvl) => (
                      <option key={lvl.code} value={lvl.code}>
                        {lvl.code} - {lvl.nameVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role List */}
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredRoles.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[var(--muted)]">
                    {isVi ? 'Không tìm thấy chức danh phù hợp' : 'No matching roles found'}
                  </div>
                ) : (
                  filteredRoles.map((role) => {
                    const isSelected = selectedRoleCode === role.code;
                    return (
                      <button
                        key={role.code}
                        onClick={() => setSelectedRoleCode(role.code)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition border flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--brand-50)] text-[var(--brand)] font-bold border-[var(--brand-100)] shadow-xs'
                            : 'hover:bg-[var(--line)]/50 text-[var(--ink)] border-transparent'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--brand)]">
                              {role.code}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--muted)]">
                              {role.jobLevel} · {role.jobFamily}
                            </span>
                          </div>
                          <div className="font-medium truncate max-w-[200px] sm:max-w-[240px]">
                            {role.titleVi}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]">
                            {role.requirements.length} {isVi ? 'năng lực' : 'comp'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Role Success Profile Detail (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedRole ? (
              <>
                {/* Role Header Banner */}
                <div className="app-card space-y-3 border-t-4 border-t-[var(--brand)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
                          {selectedRole.code}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                          {roleLevel?.nameVi || selectedRole.jobLevel} ({roleLevel?.grade})
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40">
                          {selectedRole.careerStream}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--ink)] mt-2">
                        {selectedRole.titleVi}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Họ nghề: <strong>{roleFamily ? `${roleFamily.code} - ${roleFamily.name}` : selectedRole.jobFamily}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenEditRequirements}
                        className="btn btn-secondary text-xs font-bold flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[var(--brand)]" />
                        <span>{isVi ? 'Chỉnh sửa Năng lực' : 'Edit Requirements'}</span>
                      </button>
                      <button
                        onClick={handleCopyJD}
                        className="btn btn-secondary text-xs font-bold flex items-center gap-1.5"
                      >
                        {copiedJD ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[var(--muted)]" />
                        )}
                        <span>{copiedJD ? (isVi ? 'Đã sao chép!' : 'Copied!') : (isVi ? 'Sao chép JD' : 'Copy JD')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Level & Contribution Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                        {isVi ? 'Mức độ đóng góp' : 'Contribution'}
                      </span>
                      <span className="font-semibold text-[var(--ink)] mt-0.5 block">
                        {roleLevel?.contribution || 'Độc lập thực hiện nhiệm vụ tiêu chuẩn.'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                        {isVi ? 'Phạm vi ảnh hưởng' : 'Scope of Impact'}
                      </span>
                      <span className="font-semibold text-[var(--ink)] mt-0.5 block">
                        {roleLevel?.scope || 'Bộ phận / Phòng ban trực thuộc.'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">
                        {isVi ? 'Khung chuẩn bậc' : 'Required Level Band'}
                      </span>
                      <span className="font-semibold text-[var(--brand)] font-mono mt-0.5 block">
                        {roleLevel
                          ? `Core: ${roleLevel.requiredBand.core} | Lead: ${roleLevel.requiredBand.leadership} | Func: ${roleLevel.requiredBand.functional}`
                          : 'Mức 3/5'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Required Competencies Table */}
                <div className="app-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                        {isVi
                          ? `Ma trận Năng lực Yêu cầu (${selectedRole.requirements.length} Năng lực)`
                          : `Role Competency Requirements (${selectedRole.requirements.length})`}
                      </h4>
                      <p className="text-[11px] text-[var(--muted)]">
                        {isVi
                          ? 'Được đối soát theo Thang thành thục Flamingo 5 mức (FLA-5)'
                          : 'Standardized against Flamingo 5-Level Proficiency Scale (FLA-5)'}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold">
                      Chuẩn đạt: FLA-5 Benchmark
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {selectedRole.requirements.map((req, idx) => {
                      const comp = currentCompetencies.find((c) => c.code === req.competency);
                      // Chỉ lấy bản ĐANG HIỆU LỰC của đúng năng lực — không mượn chỉ báo của năng lực khác
                      const ver = comp
                        ? versions.find((v) => v.id === comp.currentVersionId) ||
                          versions.find((v) => v.competencyId === comp.id && v.status === 'PUBLISHED')
                        : undefined;
                      const questions = interviewQuestions.filter((q) => q.competencyCode === req.competency);

                      const anchors = [ver?.level1Anchor, ver?.level2Anchor, ver?.level3Anchor, ver?.level4Anchor, ver?.level5Anchor];
                      const anchorText = !comp
                        ? `[Chưa đối chiếu được sang mã Từ điển — nhãn gốc Sổ tay "${req.competency}". Cần HR chọn mã CO/LE/FU tương ứng.]`
                        : anchors[req.requiredLevel - 1] || `[Mức ${req.requiredLevel} chưa có chỉ báo]`;

                      // Color coding by target level
                      const scoreColor =
                        req.requiredLevel >= 4
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : req.requiredLevel === 3
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';

                      return (
                        <div
                          key={req.competency}
                          className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand)] transition space-y-2.5"
                        >
                          {/* Top row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[var(--brand)]">
                                {req.competency}
                              </span>
                              <span className="font-bold text-xs text-[var(--ink)]">
                                {comp?.name || req.competency}
                              </span>
                              {comp && !comp.hasOwner && (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-semibold">
                                  ⚠️ Chưa có chủ quản
                                </span>
                              )}
                              {req.mappingStatus === 'PROPOSED' && (
                                <span
                                  title={`Đối chiếu từ mã Sổ tay: ${(req.sourceCodes ?? []).join(', ')} · độ tin cậy ${req.mappingConfidence ?? '?'} — chờ HR duyệt`}
                                  className="text-[9.5px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 font-semibold"
                                >
                                  ↔ {(req.sourceCodes ?? []).join(' + ')} · đề xuất
                                </span>
                              )}
                              {req.mappingStatus === 'UNMAPPED' && (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-semibold">
                                  ✖ Chưa có mã Từ điển
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-[var(--muted)]">
                                {isVi ? 'Yêu cầu tối thiểu:' : 'Target:'}
                              </span>
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
                                Mức {req.requiredLevel} / 5
                              </span>
                            </div>
                          </div>

                          {/* Progress bar representing FLA-5 scale */}
                          <div className="w-full bg-[var(--line)] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all bg-[var(--brand)]"
                              style={{ width: `${(req.requiredLevel / 5) * 100}%` }}
                            />
                          </div>

                          {/* Behavioral Anchor Text */}
                          <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--ink)] leading-relaxed">
                            <div className="text-[10px] font-bold uppercase text-[var(--muted)] mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Tiêu chuẩn hành vi minh chứng (Mức {req.requiredLevel}):</span>
                            </div>
                            <p className="italic text-[var(--ink)]">
                              "{anchorText}"
                            </p>
                          </div>

                          {/* Interview Question Sample */}
                          {questions.length > 0 && (
                            <div className="text-[11px] text-[var(--muted)] pt-1 flex items-start gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-[var(--ink)]">Câu hỏi phỏng vấn gợi ý: </span>
                                <span>{questions[0].question}</span>
                                {questions.some((q) => q.isCounterEvidence) && (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">
                                    ↳ Lưu ý phản chứng: {questions.find((q) => q.isCounterEvidence)?.question}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="app-card text-center py-12 text-xs text-[var(--muted)]">
                {isVi ? 'Chọn một vị trí chức danh bên trái để xem hồ sơ năng lực' : 'Select a role to inspect its success profile'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CORPORATE 6-TIER MATRIX (L1 - L6)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'levels' && (
        <div className="app-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isVi ? 'Khung 6 Cấp bậc Chuẩn Toàn Tập đoàn Flamingo (L1 – L6)' : 'Flamingo 6-Tier Corporate Job Level Framework'}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {isVi
                  ? 'Phân bổ chuẩn ngạch bậc từ Nhân viên đến Lãnh đạo cấp cao, định vị đóng góp và chuẩn dải điểm năng lực'
                  : 'Corporate grading, contribution definition, and required competency band per level'}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
              6 Cấp bậc (Grade B1–B7)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobLevels.map((lvl) => {
              const rolesInLevel = jobRoles.filter((r) => r.jobLevel === lvl.code);
              return (
                <div
                  key={lvl.code}
                  className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-3 shadow-xs hover:border-[var(--brand)] transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
                        {lvl.code}
                      </span>
                      <h4 className="font-bold text-xs text-[var(--ink)]">{lvl.nameVi}</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
                      {lvl.grade}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">Định vị đóng góp:</span>
                      <p className="text-[var(--ink)] text-[11.5px] mt-0.5 leading-relaxed">{lvl.contribution}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--muted)] block">Phạm vi ảnh hưởng:</span>
                      <p className="text-[var(--muted)] text-[11.5px] mt-0.5">{lvl.scope}</p>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--brand)] block">Khung điểm chuẩn (FLA-5):</span>
                      <div className="grid grid-cols-3 gap-1 pt-1 font-mono text-[10px]">
                        <div>
                          <span className="text-[var(--muted)] block">Cốt lõi:</span>
                          <strong className="text-[var(--ink)]">{lvl.requiredBand.core}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--muted)] block">Lãnh đạo:</span>
                          <strong className="text-[var(--ink)]">{lvl.requiredBand.leadership}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--muted)] block">Chuyên môn:</span>
                          <strong className="text-[var(--ink)]">{lvl.requiredBand.functional}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--muted)]">
                      {rolesInLevel.length} vị trí chức danh
                    </span>
                    <button
                      onClick={() => {
                        setSelectedLevelFilter(lvl.code);
                        setActiveTab('roles');
                      }}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
                    >
                      <span>Xem chức danh</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 14 JOB FAMILIES DIRECTORY                                         */}
      {/* ========================================================================= */}
      {activeTab === 'families' && (
        <div className="app-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isVi ? 'Danh mục 14 Họ nghề nghiệp Tập đoàn Flamingo (JF01 – JF14)' : '14 Flamingo Job Families'}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {isVi
                  ? 'Bao phủ chuỗi giá trị bất động sản, vận hành nghỉ dưỡng, tài chính, công nghệ và quản trị'
                  : 'Covering real estate, resort operations, finance, IT, and governance value chains'}
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
              14 Họ nghề (Job Families)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentJobFamilies.map((jf) => {
              const rolesInFamily = jobRoles.filter(
                (r) => r.jobFamily.toUpperCase() === jf.code.toUpperCase()
              );
              return (
                <div
                  key={jf.code}
                  className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] space-y-2.5 shadow-xs hover:border-[var(--brand)] transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--brand-50)] text-[var(--brand)] border border-[var(--brand-100)]">
                        {jf.code}
                      </span>
                      <h4 className="font-bold text-xs text-[var(--ink)]">{jf.name}</h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 font-semibold border border-purple-200 dark:border-purple-800/40">
                      {jf.careerStream || 'Chuyên môn & Quản lý'}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    {jf.description || 'Họ nghề cốt lõi trong chuỗi hoạt động của Tập đoàn.'}
                  </p>

                  <div className="text-[11px] text-[var(--ink)] p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between">
                    <span>Chuỗi giá trị: <strong>{jf.valueStages || 'Vận hành liên tục'}</strong></span>
                    <span className="font-mono text-[var(--brand)]">{rolesInFamily.length} Chức danh</span>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--muted)]">
                      Dòng: {jf.jobFunction || 'Chuyên môn'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedFamilyFilter(jf.code);
                        setActiveTab('roles');
                      }}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
                    >
                      <span>Lọc các vị trí</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ROLE REQUIREMENTS                                            */}
      {/* ========================================================================= */}
      {showEditRequirementsModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Chỉnh sửa Ma trận Năng lực Chức danh' : 'Edit Role Competency Matrix'}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {selectedRole.code} - {selectedRole.titleVi} ({selectedRole.jobLevel})
                </p>
              </div>
              <button
                onClick={() => setShowEditRequirementsModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Requirements List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--ink)] block">
                {isVi ? 'Danh sách năng lực yêu cầu hiện tại:' : 'Current Competency Requirements:'}
              </label>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editingRequirements.map((req) => {
                  const comp = currentCompetencies.find((c) => c.code === req.competency);
                  return (
                    <div
                      key={req.competency}
                      className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--brand)]">{req.competency}</span>
                        <span className="font-medium text-[var(--ink)]">{comp?.name || req.competency}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[var(--muted)]">Mức FLA-5:</span>
                          <select
                            value={req.requiredLevel}
                            onChange={(e) => {
                              const newLevel = Number(e.target.value);
                              setEditingRequirements((prev) =>
                                prev.map((r) =>
                                  r.competency === req.competency ? { ...r, requiredLevel: newLevel } : r
                                )
                              );
                            }}
                            className="input py-1 px-2 text-xs font-bold font-mono"
                          >
                            <option value={1}>Mức 1 (Nhận biết)</option>
                            <option value={2}>Mức 2 (Áp dụng)</option>
                            <option value={3}>Mức 3 (Thành thạo)</option>
                            <option value={4}>Mức 4 (Nâng cao)</option>
                            <option value={5}>Mức 5 (Chuyên gia)</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRequirementItem(req.competency)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add New Competency to Role */}
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-2">
              <label className="text-xs font-bold text-[var(--ink)] block">
                {isVi ? 'Thêm năng lực vào chức danh này:' : 'Add Competency to this Role:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-7">
                  <select
                    value={addCompCode}
                    onChange={(e) => setAddCompCode(e.target.value)}
                    className="input text-xs w-full py-1.5"
                  >
                    {currentCompetencies.map((comp) => (
                      <option key={comp.code} value={comp.code}>
                        [{comp.code}] {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={addCompLevel}
                    onChange={(e) => setAddCompLevel(Number(e.target.value))}
                    className="input text-xs w-full py-1.5"
                  >
                    <option value={1}>Mức 1 (1.0 - 1.99)</option>
                    <option value={2}>Mức 2 (2.0 - 2.99)</option>
                    <option value={3}>Mức 3 (3.0 - 3.99)</option>
                    <option value={4}>Mức 4 (4.0 - 4.99)</option>
                    <option value={5}>Mức 5 (5.0 Expert)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddRequirementItem}
                    className="btn btn-secondary text-xs font-bold w-full py-1.5"
                  >
                    {isVi ? 'Gán' : 'Add'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowEditRequirementsModal(false)}
                className="btn btn-secondary text-xs"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveRequirements}
                className="btn btn-primary text-xs font-bold"
              >
                {isVi ? 'Lưu Thay Đổi' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW JOB ROLE                                                  */}
      {/* ========================================================================= */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRole}
            className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Tạo Mới Vị trí Chức danh (Job Role)' : 'Create New Job Role'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    Mã chức danh (e.g. R27)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="R27"
                    value={newRoleCode}
                    onChange={(e) => setNewRoleCode(e.target.value)}
                    className="input text-xs w-full"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    Dòng nghề nghiệp
                  </label>
                  <select
                    value={newRoleStream}
                    onChange={(e) => setNewRoleStream(e.target.value)}
                    className="input text-xs w-full py-2"
                  >
                    <option value="Chuyên môn">Chuyên môn (Professional)</option>
                    <option value="Quản lý">Quản lý (Management)</option>
                    <option value="Vận hành">Vận hành (Operations)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                  Tên vị trí chức danh (Tiếng Việt)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chuyên viên Phân tích Dữ liệu Khách hàng"
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  className="input text-xs w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    Thuộc Họ nghề
                  </label>
                  <select
                    value={newRoleFamily}
                    onChange={(e) => setNewRoleFamily(e.target.value)}
                    className="input text-xs w-full py-2"
                  >
                    {currentJobFamilies.map((jf) => (
                      <option key={jf.code} value={jf.code}>
                        {jf.code} - {jf.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                    Cấp bậc chuẩn
                  </label>
                  <select
                    value={newRoleLevel}
                    onChange={(e) => setNewRoleLevel(e.target.value)}
                    className="input text-xs w-full py-2"
                  >
                    {jobLevels.map((lvl) => (
                      <option key={lvl.code} value={lvl.code}>
                        {lvl.code} - {lvl.nameVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="btn btn-secondary text-xs"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="btn btn-primary text-xs font-bold"
              >
                {isVi ? 'Tạo Chức danh' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: STANDARD JOB DESCRIPTION (JD) PREVIEW                             */}
      {/* ========================================================================= */}
      {showJDModal && selectedRole && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--brand)]" />
                <h3 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? 'Bản Mô Tả Công Việc Chuẩn Hóa (Standard Job Description)' : 'Standard Job Description'}
                </h3>
              </div>
              <button
                onClick={() => setShowJDModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] space-y-4 text-xs font-mono">
              <div>
                <div className="text-[10px] text-[var(--muted)] uppercase font-bold">VỊ TRÍ / CHỨC DANH</div>
                <div className="text-sm font-bold text-[var(--ink)]">
                  {selectedRole.titleVi} ({selectedRole.code})
                </div>
                <div className="text-[11px] text-[var(--brand)]">
                  Họ nghề: [{selectedRole.jobFamily}] {roleFamily?.name || ''} · Cấp bậc: [{selectedRole.jobLevel}] {roleLevel?.nameVi} ({roleLevel?.grade})
                </div>
                <div className="text-[10.5px] text-[var(--muted)] mt-1">
                  Phạm vi ảnh hưởng: {roleLevel?.scope} · Định vị đóng góp: {roleLevel?.contribution}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[var(--line)]">
                <div className="text-[10px] text-[var(--muted)] uppercase font-bold">
                  MA TRẬN NĂNG LỰC BẮT BUỘC (THANG ĐO FLAMINGO 5 MỨC - FLA-5)
                </div>
                {selectedRole.requirements.map((req, idx) => {
                  const comp = currentCompetencies.find((c) => c.code === req.competency);
                  const anchor = anchorFor(req.competency, req.requiredLevel);

                  return (
                    <div key={req.competency} className="space-y-1 bg-[var(--surface)] p-2.5 rounded border border-[var(--line)]">
                      <div className="font-bold text-[var(--brand)]">
                        {idx + 1}. [{req.competency}] {comp?.name || req.competency} — Chuẩn yêu cầu: Mức {req.requiredLevel}/5
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        Tiêu chuẩn hành vi minh chứng: "{anchor}"
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[var(--line)] text-[10px] text-[var(--muted)] italic">
                * Bản mô tả chức danh được lưu trữ và quản trị trên hệ thống CompetencyAI Flamingo.
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
              <span className="text-[11px] text-[var(--muted)] font-mono">
                {selectedRole.requirements.length} Tiêu chuẩn năng lực
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJD}
                  className="btn btn-secondary text-xs font-bold flex items-center gap-1.5"
                >
                  {copiedJD ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJD ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                </button>
                <button
                  onClick={() => setShowJDModal(false)}
                  className="btn btn-primary text-xs font-bold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
