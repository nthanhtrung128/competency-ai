import React, { useState, useMemo, useEffect } from 'react';
import {
  CompetencyCategoryModel,
  CompetencyModel,
  CompetencyVersionModel,
} from '../../packages/db/src/types';
import {
  BookOpen,
  CheckCircle2,
  History,
  Layers,
  Sparkles,
  Plus,
  Edit3,
  Send,
  Sliders,
  Check,
  AlertCircle,
  AlertTriangle,
  Building2,
  HelpCircle,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Info,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { COMPANY_PORTAL } from '../api/client';
import { feVersionId } from '../api/serverAdapter';

export const CompetencyVersionMatrix: React.FC = () => {
  const {
    categories,
    competencies,
    versions,
    orgUnits,
    lang,
    addCompetency,
    can,
    updateCompetencyVersion,
    publishCompetencyVersion,
    assignCompetencyOwner,
    batchAssignRecommendedOwners,
    batchRemediateAllDataGaps,
    dataSource,
  } = useApp();
  const DRAFT_TAG = '[DỰ THẢO TỰ SINH – CHƯA DUYỆT] ';

  const isVi = lang === 'vi';
  const [selectedCompId, setSelectedCompId] = useState<string>(competencies[0]?.id || '');
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    competencies[0]?.currentVersionId || versions[0]?.id || ''
  );
  const [selectedAssignUnit, setSelectedAssignUnit] = useState<string>('');
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterDomain, setFilterDomain] = useState<string>('ALL');
  const [filterOwnerGapOnly, setFilterOwnerGapOnly] = useState<boolean>(false);

  // Modals / Edit states
  const [createCompModal, setCreateCompModal] = useState(false);
  const [newCompData, setNewCompData] = useState({
    code: COMPANY_PORTAL ? '' : `FU${Math.floor(10 + Math.random() * 90)}`,
    name: '',
    description: '',
    categoryId: categories[0]?.id || 'cat-fun',
    owningUnit: '',
    hasOwner: true,
    level1Anchor: COMPANY_PORTAL ? '' : 'Nhận biết khái niệm cơ bản và thực hiện khi có hướng dẫn.',
    level2Anchor: COMPANY_PORTAL ? '' : 'Áp dụng độc lập, giải quyết các tình huống nghiệp vụ thông thường.',
    level3Anchor: COMPANY_PORTAL ? '' : 'Thành thạo chuyên môn, giải quyết các tình huống nghiệp vụ phức tạp.',
    level4Anchor: COMPANY_PORTAL ? '' : 'Nâng cao, tối ưu hóa quy trình, thiết kế giải pháp và tư vấn cho đơn vị khác.',
    level5Anchor: COMPANY_PORTAL ? '' : 'Chuyên gia đầu ngành, thiết kế chuẩn mực toàn hệ thống, dẫn dắt đổi mới.',
  });

  const [isEditingAnchors, setIsEditingAnchors] = useState(false);
  const [editedAnchors, setEditedAnchors] = useState({
    level1Anchor: '',
    level2Anchor: '',
    level3Anchor: '',
    level4Anchor: '',
    level5Anchor: '',
  });

  const selectedComp = competencies.find((c) => c.id === selectedCompId);
  const compVersions = versions.filter((v) => v.competencyId === selectedCompId);
  // Chỉ chọn trong các phiên bản của ĐÚNG năng lực đang xem (tránh hiển thị nhầm phiên bản của năng lực trước)
  const activeVersion =
    compVersions.find((v) => v.id === selectedVersionId) ||
    compVersions.find((v) => v.id === selectedComp?.currentVersionId) ||
    compVersions[compVersions.length - 1];
  const activeCategory = categories.find((cat) => cat.id === selectedComp?.categoryId);

  // Auto-sync recommended owner for unassigned competency
  useEffect(() => {
    if (!COMPANY_PORTAL && selectedComp && selectedComp.hasOwner === false) {
      const recMap: Record<string, string> = {
        'FU02': 'Ban Đầu tư (B01)',
        'FU16': 'FRT — Đơn vị Dịch vụ Nghỉ dưỡng (B09)',
        'FU23': 'Ban Kinh doanh Vận hành (B06)',
        'FU29': 'Ban Đầu tư (B01)',
        'FU43': 'FRT — Đơn vị Dịch vụ Nghỉ dưỡng (B09)',
        'FU45': 'Ban Pháp chế & Kiểm soát Tuân thủ (B02)',
      };
      if (recMap[selectedComp.code]) {
        setSelectedAssignUnit(recMap[selectedComp.code]);
      }
    }
  }, [selectedCompId, selectedComp]);

  // Domains list for functional competencies
  const domains = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of competencies) {
      if (c.domain && c.domainName) {
        map.set(c.domain, c.domainName);
      }
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [competencies]);

  // Filtered competencies
  const filteredCompetencies = useMemo(() => {
    return competencies.filter((comp) => {
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCode = comp.code.toLowerCase().includes(term);
        const matchName = comp.name.toLowerCase().includes(term);
        const matchDesc = (comp.description || '').toLowerCase().includes(term);
        if (!matchCode && !matchName && !matchDesc) return false;
      }
      // Category filter
      if (filterCategory !== 'ALL' && comp.categoryId !== filterCategory) {
        return false;
      }
      // Domain filter
      if (filterDomain !== 'ALL' && comp.domain !== filterDomain) {
        return false;
      }
      // Owner gap only
      if (filterOwnerGapOnly && comp.hasOwner !== false) {
        return false;
      }
      return true;
    });
  }, [competencies, searchTerm, filterCategory, filterDomain, filterOwnerGapOnly]);

  // Start editing anchors
  const startEditAnchors = () => {
    if (!activeVersion) return;
    setEditedAnchors({
      level1Anchor: activeVersion.level1Anchor || '',
      level2Anchor: activeVersion.level2Anchor || '',
      level3Anchor: activeVersion.level3Anchor || '',
      level4Anchor: activeVersion.level4Anchor || '',
      level5Anchor: activeVersion.level5Anchor || '',
    });
    setIsEditingAnchors(true);
  };

  const saveAnchors = () => {
    if (!activeVersion) return;
    updateCompetencyVersion(activeVersion.id, editedAnchors);
    setIsEditingAnchors(false);
  };

  // Create new Draft version
  const handleCreateDraftVersion = () => {
    if (!selectedComp || !activeVersion) return;
    const nextVerNum = Math.max(0, ...compVersions.map((v) => v.version)) + 1;
    // cùng quy ước mã với bộ chuyển dữ liệu (ver-<mã năng lực>-v<n>) để chế độ máy chủ chọn đúng bản nháp vừa tạo
    const newVerId = feVersionId(selectedComp.code, nextVerNum);

    const newDraftVersion: CompetencyVersionModel = {
      id: newVerId,
      competencyId: selectedComp.id,
      version: nextVerNum,
      title: `${selectedComp.name} (Revision v${nextVerNum})`,
      definition: activeVersion.definition,
      status: 'DRAFT',
      level1Anchor: activeVersion.level1Anchor,
      level2Anchor: activeVersion.level2Anchor,
      level3Anchor: activeVersion.level3Anchor,
      level4Anchor: activeVersion.level4Anchor,
      level5Anchor: activeVersion.level5Anchor,
      effectiveFrom: null,
      effectiveTo: null,
      authorId: 'usr-hr-lead',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    updateCompetencyVersion(newVerId, newDraftVersion);
    setSelectedVersionId(newVerId);
  };

  const handleCreateCompSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await addCompetency(
      {
        code: newCompData.code,
        name: newCompData.name,
        description: newCompData.description,
        categoryId: newCompData.categoryId,
        owningUnit: newCompData.owningUnit || null,
        hasOwner: newCompData.hasOwner,
      },
      {
        title: `${newCompData.name} Standard (v1.0)`,
        definition: newCompData.description,
        level1Anchor: newCompData.level1Anchor,
        level2Anchor: newCompData.level2Anchor,
        level3Anchor: newCompData.level3Anchor,
        level4Anchor: newCompData.level4Anchor,
        level5Anchor: newCompData.level5Anchor,
      }
    );
    if (created) setCreateCompModal(false);
  };

  const missingOwnerCount = useMemo(() => {
    return competencies.filter((c) => c.hasOwner === false).length;
  }, [competencies]);

  const dataGapCount = useMemo(() => {
    return competencies.filter((c) => !!c.dataGap).length;
  }, [competencies]);

  const handleBatchAssignOwners = () => {
    const res = batchAssignRecommendedOwners();
    setBatchFeedback(
      isVi
        ? `Đã ghi phương án ĐỀ XUẤT cho ${res.count} năng lực (${res.updatedCodes.join(', ')}). Năng lực vẫn ở trạng thái "chưa có chủ quản" cho tới khi có quyết định chính thức.`
        : `Successfully assigned owning units for ${res.count} competencies!`
    );
    setTimeout(() => setBatchFeedback(null), 6000);
  };

  const handleBatchRemediateGaps = () => {
    const res = batchRemediateAllDataGaps();
    setBatchFeedback(
      isVi
        ? `Đã tạo ${res.count} BẢN NHÁP gợi ý (gắn nhãn tự sinh). Bản đang ban hành không đổi. Chuyên gia phải sửa trước khi ban hành.`
        : `Successfully synthesized 5-level FLA-5 behavioral indicators for ${res.count} competencies!`
    );
    setTimeout(() => setBatchFeedback(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="app-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-lg font-bold text-[var(--ink)]">
              {isVi ? 'Từ điển năng lực' : 'Competency Dictionary'}
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {competencies.length} năng lực · Quản lý bản nháp, chỉ báo và phiên bản đã ban hành.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {missingOwnerCount > 0 && (
            <button
              onClick={() => setFilterOwnerGapOnly((prev) => !prev)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 border transition ${
                filterOwnerGapOnly
                  ? 'bg-rose-500 text-white border-rose-600'
                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{missingOwnerCount} {isVi ? 'chưa có chủ quản' : 'unowned'}</span>
            </button>
          )}

          <button
            disabled={!can('competency:author')}
            onClick={() => setCreateCompModal(true)}
            className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isVi ? 'Thêm Năng Lực Mới' : 'Add Competency'}</span>
          </button>
        </div>
      </div>

      {/* Batch Feedback Notification */}
      {batchFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 text-xs font-bold shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{batchFeedback}</span>
          </div>
          <button
            onClick={() => setBatchFeedback(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 underline font-semibold"
          >
            {isVi ? 'Đóng' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Dictionary Governance Action Bar */}
      {(missingOwnerCount > 0 || dataGapCount > 0) && (
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                {isVi ? 'Hành động Quản trị Dữ liệu Ưu tiên (Governance Action Center)' : 'Governance Action Center'}
              </h4>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {isVi
                ? `Hiện có ${missingOwnerCount} năng lực chưa gán đơn vị chủ quản (QT01) và ${dataGapCount} năng lực chuyên môn chưa hoàn tất 5 mức hành vi (QT05). ${dataSource === 'SERVER' ? 'Trên máy chủ: gán chủ quản từng năng lực; chỉ báo nạp qua file mẫu Mau_ChiBao_ChuyenMon_Muc1-5.xlsx.' : 'Các nút dưới chỉ tạo ĐỀ XUẤT / BẢN NHÁP — không thay quyết định chính thức:'}`
                : `Currently ${missingOwnerCount} unassigned competencies and ${dataGapCount} data gaps detected.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {missingOwnerCount > 0 && dataSource !== 'SERVER' && (
              <button
                onClick={handleBatchAssignOwners}
                className="btn py-2 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isVi ? `Ghi phương án đề xuất chủ quản (${missingOwnerCount})` : `Propose owners (${missingOwnerCount})`}</span>
              </button>
            )}

            {dataGapCount > 0 && dataSource !== 'SERVER' && (
              <button
                onClick={handleBatchRemediateGaps}
                className="btn py-2 px-3 text-xs font-bold bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isVi ? `Tạo bản nháp gợi ý 5 mức (${dataGapCount})` : `Generate draft suggestions (${dataGapCount})`}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main layout: Left filter & list, Right detail matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Competencies Directory */}
        <div id="comp-list-panel" className="lg:col-span-4 app-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--brand)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                {isVi ? 'Danh mục Năng lực' : 'Competency List'}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--line)]">
              {filteredCompetencies.length} / {competencies.length}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isVi ? 'Tìm theo mã, tên năng lực...' : 'Search by code or name...'}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--brand)]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => { setFilterCategory('ALL'); setFilterDomain('ALL'); }}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition ${
                filterCategory === 'ALL'
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)] hover:text-[var(--ink)]'
              }`}
            >
              {isVi ? 'Tất cả' : 'All'}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setFilterCategory(cat.id); setFilterDomain('ALL'); }}
                className={`text-[11px] px-2 py-1 rounded-md font-medium transition ${
                  filterCategory === cat.id
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {cat.code}
              </button>
            ))}
          </div>

          {/* Domain Filter (if Functional) */}
          {(filterCategory === 'ALL' || filterCategory === 'cat-fun') && domains.length > 0 && (
            <div className="pt-1">
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="w-full text-[11px] py-1 px-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-medium"
              >
                <option value="ALL">{isVi ? 'Tất cả Lĩnh vực Chuyên môn (Domains D1-D10)' : 'All Functional Domains (D1-D10)'}</option>
                {domains.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code}: {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* List items */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredCompetencies.map((comp) => {
              const cat = categories.find((c) => c.id === comp.categoryId);
              const isSelected = comp.id === selectedCompId;
              const hasOwner = comp.hasOwner !== false;

              return (
                <div
                  key={comp.id}
                  id={`comp-card-${comp.id}`}
                  onClick={() => {
                    setSelectedCompId(comp.id);
                    setSelectedVersionId(comp.currentVersionId ?? '');
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? 'bg-[var(--brand-50)] border-[var(--brand)] text-[var(--brand)] shadow-sm'
                      : 'bg-[var(--surface)] border-[var(--line)] hover:bg-[var(--surface-hover)] text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--line)] font-bold">
                        {comp.code}
                      </span>
                      {cat && (
                        <span className="text-[10px] font-semibold text-[var(--muted)]">
                          {cat.code}
                        </span>
                      )}
                    </div>
                    {!hasOwner && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Chưa có chủ quản</span>
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs leading-snug">{comp.name}</h4>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--muted)]">
                    {comp.domainName && (
                      <span className="truncate max-w-[160px] font-medium text-[var(--brand)]">
                        {comp.domainName}
                      </span>
                    )}
                    {comp.owningUnit && (
                      <span className="truncate text-slate-500">
                        · {comp.owningUnit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredCompetencies.length === 0 && (
              <div className="p-4 text-center text-xs text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg">
                {isVi ? 'Không tìm thấy năng lực phù hợp.' : 'No matching competencies found.'}
              </div>
            )}
          </div>
        </div>

        {/* Version Matrix & Detailed Indicators */}
        <div id="version-matrix-panel" className="lg:col-span-8 space-y-5">
          {selectedComp && activeVersion ? (
            <>
              {/* CRITICAL WARNING: NO OWNER (hasOwner: false) */}
              {selectedComp.hasOwner === false && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-3">
                  <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{isVi ? 'CẢNH BÁO QUẢN TRỊ NĂNG LỰC: CHƯA CÓ ĐƠN VỊ CHỦ QUẢN' : 'GOVERNANCE WARNING: UNASSIGNED COMPETENCY OWNER'}</span>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    Chọn đơn vị chịu trách nhiệm rà soát nội dung và chỉ báo của năng lực này.
                  </p>
                  
                  {/* Quick Assign Dropdown & Action */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 border-t border-rose-500/20">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-200 whitespace-nowrap">
                      {isVi ? 'Phân công đơn vị chủ quản:' : 'Assign Owning Unit:'}
                    </span>
                    <select
                      value={selectedAssignUnit}
                      onChange={(e) => setSelectedAssignUnit(e.target.value)}
                      className="input py-1 text-xs bg-[var(--surface)] text-[var(--ink)] flex-1 max-w-md"
                    >
                      <option value="">Chọn đơn vị</option>
                      {orgUnits.map(unit => <option key={unit.id} value={unit.name}>{unit.code} · {unit.name}</option>)}
                    </select>
                    <button
                      disabled={!selectedAssignUnit || !can('competency:publish')}
                      onClick={() => assignCompetencyOwner(selectedComp.id, selectedAssignUnit)}
                      className="btn py-1 px-3 text-xs font-bold whitespace-nowrap bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs"
                    >
                      {isVi ? 'Gán Chủ Quản Ngay' : 'Assign Owner'}
                    </button>
                  </div>
                </div>
              )}

              {/* DATA GAP WARNING (FU01 - FU45 only have level 3) */}
              {selectedComp.dataGap && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        {isVi ? 'Cảnh báo Khoảng trống Tiêu chuẩn (Data Gap)' : 'Standardization Data Gap'}
                      </h5>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {selectedComp.dataGap}
                      </p>
                    </div>
                  </div>
                  {activeVersion.status === 'DRAFT' && dataSource !== 'SERVER' && (
                  <button
                    onClick={() => {
                      if (!activeVersion || !selectedComp) return;
                      const n = selectedComp.name.toLowerCase();
                      updateCompetencyVersion(activeVersion.id, {
                        level1Anchor: `${DRAFT_TAG}Nắm khái niệm, quy chuẩn cơ bản về ${n}; thực hiện theo quy trình khi có kèm cặp.`,
                        level2Anchor: `${DRAFT_TAG}Áp dụng quy trình tiêu chuẩn về ${n}; tự xử lý tình huống thông thường.`,
                        level4Anchor: `${DRAFT_TAG}Tối ưu quy trình, thiết kế giải pháp về ${n}; tư vấn chuyên môn cho đơn vị khác.`,
                        level5Anchor: `${DRAFT_TAG}Định hình chuẩn mực về ${n} cấp Tập đoàn; dẫn dắt đổi mới.`,
                      });
                    }}
                    className="btn btn-secondary py-1 px-2.5 text-xs font-semibold whitespace-nowrap text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    {isVi ? '✨ Gợi ý khung Mức 1, 2, 4, 5 (chuyên gia phải sửa)' : '✨ Suggest Levels 1, 2, 4, 5 (expert must edit)'}
                  </button>
                  )}
                </div>
              )}

              {/* Header with Competency Metadata, Version Selector & Actions */}
              <div className="app-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--line)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[var(--brand)] bg-[var(--brand-50)] px-2 py-0.5 rounded border border-[var(--brand-100)]">
                        {selectedComp.code}
                      </span>
                      {activeCategory && (
                        <span className="text-xs text-[var(--muted)] font-medium">
                          {activeCategory.code} · {activeCategory.name}
                        </span>
                      )}
                      {selectedComp.domainName && (
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {selectedComp.domain}: {selectedComp.domainName}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--ink)] mt-1.5">{selectedComp.name}</h3>
                    <p className="text-xs text-[var(--muted)] mt-1">{selectedComp.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={activeVersion.id}
                      onChange={(e) => setSelectedVersionId(e.target.value)}
                      className="text-xs p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-bold"
                    >
                      {compVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.version} ({v.status})
                        </option>
                      ))}
                    </select>

                    {activeVersion.status === 'DRAFT' && (
                      <button
                        onClick={() => publishCompetencyVersion(activeVersion.id)}
                        className="btn btn-primary text-xs font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>{isVi ? 'Ban hành' : 'Publish'}</span>
                      </button>
                    )}

                    {activeVersion.status === 'PUBLISHED' && (
                      <button
                        onClick={handleCreateDraftVersion}
                        className="btn btn-secondary text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isVi ? 'Tạo bản sửa đổi' : 'Create Revision'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Additional Metadata Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                    <span className="text-[11px] text-[var(--muted)] block">{isVi ? 'Đơn vị chủ quản' : 'Owning Unit'}</span>
                    <span className="font-bold text-[var(--ink)]">
                      {selectedComp.owningUnit || (
                        <span className="text-rose-600 font-bold">⚠️ Chưa gán đơn vị</span>
                      )}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                    <span className="text-[11px] text-[var(--muted)] block">{isVi ? 'Thang đo chuẩn' : 'Proficiency Scale'}</span>
                    <span className="font-bold text-[var(--ink)]">Thang năng lực 5 mức</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                    <span className="text-[11px] text-[var(--muted)] block">{isVi ? 'Mức chuẩn tham chiếu' : 'Reference Benchmark'}</span>
                    <span className="font-bold text-[var(--ink)]">
                      Cấp {selectedComp.referenceLevel || 3} (Proficient / Thành thạo)
                    </span>
                  </div>
                </div>
              </div>

              {/* Flamingo 5-Level Behavioral Progression Table */}
              <div className="app-card space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      {isVi ? 'Tiêu chuẩn Hành vi Thang Thang năng lực 5 mức' : 'Five-level Behavioral Anchors'}
                    </h4>
                  </div>
                  {!isEditingAnchors && activeVersion.status !== 'DRAFT' ? (
                    <span className="text-[11px] text-[var(--muted)] italic">
                      {isVi ? 'Bản đã ban hành/lưu trữ không sửa trực tiếp — bấm "Tạo bản sửa đổi"' : 'Published versions are read-only — create a revision'}
                    </span>
                  ) : !isEditingAnchors ? (
                    <button
                      onClick={startEditAnchors}
                      className="text-xs text-[var(--brand)] font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isVi ? 'Chỉnh sửa tiêu chuẩn' : 'Edit Anchors'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingAnchors(false)}
                        className="btn btn-secondary text-xs py-1"
                      >
                        {isVi ? 'Hủy' : 'Cancel'}
                      </button>
                      <button
                        onClick={saveAnchors}
                        className="btn btn-primary text-xs py-1 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>{isVi ? 'Lưu' : 'Save'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 5 Levels Grid */}
                <div className="space-y-3">
                  {/* Level 1: Nhận biết */}
                  <div className="p-3 rounded-lg border border-slate-500/20 bg-slate-500/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          MỨC 1 · NHẬN BIẾT (AWARE)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-600 font-bold">
                          Điểm 1.0 - 1.99
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)]">Thực hiện khi có hướng dẫn</span>
                    </div>
                    {isEditingAnchors ? (
                      <textarea
                        value={editedAnchors.level1Anchor}
                        onChange={(e) => setEditedAnchors({ ...editedAnchors, level1Anchor: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                        rows={2}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink)] leading-relaxed">
                        {activeVersion.level1Anchor || 'Nắm bắt khái niệm cơ bản và thực hiện khi có hướng dẫn trực tiếp.'}
                      </p>
                    )}
                  </div>

                  {/* Level 2: Áp dụng cơ bản */}
                  <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          MỨC 2 · ÁP DỤNG CƠ BẢN (BASIC APPLICATION)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 font-bold">
                          Điểm 2.0 - 2.99
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)]">Thực hiện độc lập công việc tiêu chuẩn</span>
                    </div>
                    {isEditingAnchors ? (
                      <textarea
                        value={editedAnchors.level2Anchor}
                        onChange={(e) => setEditedAnchors({ ...editedAnchors, level2Anchor: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                        rows={2}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink)] leading-relaxed">
                        {activeVersion.level2Anchor || 'Thực hiện độc lập công việc tiêu chuẩn, xử lý tình huống thông thường.'}
                      </p>
                    )}
                  </div>

                  {/* Level 3: Thành thạo (Anchor benchmark) */}
                  <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          MỨC 3 · THÀNH THẠO (PROFICIENT) — CHUẨN ĐỘT PHÁ
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-600 font-bold">
                          Điểm 3.0 - 3.99
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-indigo-600">Xử lý phức tạp & Hướng dẫn người khác</span>
                    </div>
                    {isEditingAnchors ? (
                      <textarea
                        value={editedAnchors.level3Anchor}
                        onChange={(e) => setEditedAnchors({ ...editedAnchors, level3Anchor: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-medium"
                        rows={2}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink)] font-medium leading-relaxed">
                        {activeVersion.level3Anchor}
                      </p>
                    )}
                  </div>

                  {/* Level 4: Nâng cao */}
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          MỨC 4 · NÂNG CAO (ADVANCED)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                          Điểm 4.0 - 4.99
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)]">Tối ưu hóa quy trình & Cố vấn cấp khối</span>
                    </div>
                    {isEditingAnchors ? (
                      <textarea
                        value={editedAnchors.level4Anchor}
                        onChange={(e) => setEditedAnchors({ ...editedAnchors, level4Anchor: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                        rows={2}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink)] leading-relaxed">
                        {activeVersion.level4Anchor || 'Tối ưu hóa quy trình, thiết kế giải pháp và tư vấn cho đơn vị khác.'}
                      </p>
                    )}
                  </div>

                  {/* Level 5: Chuyên gia */}
                  <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                          MỨC 5 · CHUYÊN GIA (EXPERT)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 font-bold">
                          Điểm 5.0
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--muted)]">Chuẩn mực toàn hệ thống & Dẫn dắt ngành</span>
                    </div>
                    {isEditingAnchors ? (
                      <textarea
                        value={editedAnchors.level5Anchor}
                        onChange={(e) => setEditedAnchors({ ...editedAnchors, level5Anchor: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                        rows={2}
                      />
                    ) : (
                      <p className="text-xs text-[var(--ink)] leading-relaxed">
                        {activeVersion.level5Anchor || 'Thiết kế chuẩn mực toàn hệ thống, dẫn dắt đổi mới và định hình lĩnh vực.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Positive / Negative Indicators & Overuse Warning */}
              {((selectedComp.positiveIndicators && selectedComp.positiveIndicators.length > 0) ||
                (selectedComp.negativeIndicators && selectedComp.negativeIndicators.length > 0) ||
                selectedComp.overuseWarning) && (
                <div className="app-card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] pb-2 border-b border-[var(--line)]">
                    {isVi ? 'Chỉ báo Nhận diện Hành vi & Cảnh báo Lạm dụng' : 'Behavioral Indicators & Overuse Warning'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Positive */}
                    {selectedComp.positiveIndicators && selectedComp.positiveIndicators.length > 0 && (
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Biểu hiện Tích cực' : 'Positive Indicators'}</span>
                        </div>
                        <ul className="space-y-1 text-xs text-[var(--ink)]">
                          {selectedComp.positiveIndicators.map((pos, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span>{pos}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Negative */}
                    {selectedComp.negativeIndicators && selectedComp.negativeIndicators.length > 0 && (
                      <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Biểu hiện Tiêu cực' : 'Negative Indicators'}</span>
                        </div>
                        <ul className="space-y-1 text-xs text-[var(--ink)]">
                          {selectedComp.negativeIndicators.map((neg, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-rose-500 font-bold">•</span>
                              <span>{neg}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Overuse warning */}
                  {selectedComp.overuseWarning && (
                    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Cảnh báo Lạm dụng Năng lực (Overuse Warning)' : 'Overuse Warning'}</span>
                      </div>
                      <p className="text-xs text-[var(--ink)] leading-relaxed">
                        {selectedComp.overuseWarning}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Interview Questions Bank */}
              {selectedComp.interviewQuestions && selectedComp.interviewQuestions.length > 0 && (
                <div className="app-card space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[var(--brand)]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                        {isVi ? 'Ngân hàng Câu hỏi Phỏng vấn & Bằng chứng Ngược' : 'Interview Question Bank & Counter-Evidence'}
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--muted)]">
                      {selectedComp.interviewQuestions.length} {isVi ? 'câu hỏi' : 'questions'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedComp.interviewQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
                          q.isCounterEvidence
                            ? 'bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-200'
                            : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          q.isCounterEvidence
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-[var(--brand-50)] text-[var(--brand)]'
                        }`}>
                          {q.isCounterEvidence ? (isVi ? 'Bằng chứng ngược' : 'Counter-Evidence') : (isVi ? 'Phỏng vấn' : 'Interview')}
                        </span>
                        <span>{q.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="app-card text-center py-12 text-xs text-[var(--muted)]">
              {isVi ? 'Chọn một năng lực từ danh sách bên trái để xem tiêu chuẩn.' : 'Select a competency to view standards.'}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Competency */}
      {createCompModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="app-card w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? 'Tạo năng lực mới' : 'Create New Competency'}
              </h3>
              <button
                onClick={() => setCreateCompModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--ink)] mb-1">Mã năng lực (Code)</label>
                  <input
                    type="text"
                    value={newCompData.code}
                    onChange={(e) => setNewCompData({ ...newCompData, code: e.target.value })}
                    required
                    className="w-full p-2 rounded border border-[var(--line)] bg-[var(--bg)] font-mono text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--ink)] mb-1">Nhóm năng lực</label>
                  <select
                    value={newCompData.categoryId}
                    onChange={(e) => setNewCompData({ ...newCompData, categoryId: e.target.value })}
                    className="w-full p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--ink)] mb-1">Tên năng lực</label>
                <input
                  type="text"
                  value={newCompData.name}
                  onChange={(e) => setNewCompData({ ...newCompData, name: e.target.value })}
                  required
                  placeholder="VD: Quản trị Trải nghiệm Khách hàng số"
                  className="w-full p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--ink)] mb-1">Định nghĩa & Mô tả</label>
                <textarea
                  value={newCompData.description}
                  onChange={(e) => setNewCompData({ ...newCompData, description: e.target.value })}
                  rows={2}
                  className="w-full p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--ink)] mb-1">Đơn vị chủ quản (Owning Unit)</label>
                  <input
                    type="text"
                    value={newCompData.owningUnit}
                    onChange={(e) => setNewCompData({ ...newCompData, owningUnit: e.target.value })}
                    placeholder="Tên đơn vị chủ quản"
                    className="w-full p-2 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="hasOwnerCheck"
                    checked={newCompData.hasOwner}
                    onChange={(e) => setNewCompData({ ...newCompData, hasOwner: e.target.checked })}
                    className="rounded border-[var(--line)]"
                  />
                  <label htmlFor="hasOwnerCheck" className="font-bold text-[var(--ink)] cursor-pointer">
                    Đã có đơn vị chủ sở hữu chính thức
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                <span className="font-bold text-[var(--ink)] block">Tiêu chuẩn hành vi 5 cấp:</span>
                <div>
                  <label className="text-[11px] text-[var(--muted)]">Mức 1 (Nhận biết)</label>
                  <input
                    type="text"
                    value={newCompData.level1Anchor}
                    onChange={(e) => setNewCompData({ ...newCompData, level1Anchor: e.target.value })}
                    className="w-full p-1.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted)]">Mức 2 (Áp dụng cơ bản)</label>
                  <input
                    type="text"
                    value={newCompData.level2Anchor}
                    onChange={(e) => setNewCompData({ ...newCompData, level2Anchor: e.target.value })}
                    className="w-full p-1.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted)]">Mức 3 (Thành thạo)</label>
                  <input
                    type="text"
                    value={newCompData.level3Anchor}
                    onChange={(e) => setNewCompData({ ...newCompData, level3Anchor: e.target.value })}
                    className="w-full p-1.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted)]">Mức 4 (Nâng cao)</label>
                  <input
                    type="text"
                    value={newCompData.level4Anchor}
                    onChange={(e) => setNewCompData({ ...newCompData, level4Anchor: e.target.value })}
                    className="w-full p-1.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[var(--muted)]">Mức 5 (Chuyên gia)</label>
                  <input
                    type="text"
                    value={newCompData.level5Anchor}
                    onChange={(e) => setNewCompData({ ...newCompData, level5Anchor: e.target.value })}
                    className="w-full p-1.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setCreateCompModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
                  {isVi ? 'Tạo Năng Lực' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
