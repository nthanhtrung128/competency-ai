import React, { useState } from 'react';
import { OrgUnitModel, UserModel } from '../../packages/db/src/types';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Layers,
  Network,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const OrgHierarchyTree: React.FC = () => {
  const { orgUnits, users, lang, addOrgUnit, updateOrgUnit, deleteOrgUnit } = useApp();
  const isVi = lang === 'vi';

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'org-root': true,
    'org-tech-div': true,
    'org-eng-dept': true,
    'org-prod-div': true,
  });
  const [selectedUnit, setSelectedUnit] = useState<OrgUnitModel | null>(orgUnits[0] || null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'TEAM' as OrgUnitModel['type'],
    parentId: '',
    managerId: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getUser = (id?: string | null) => {
    if (!id) return null;
    return users.find((u) => u.id === id);
  };

  const getChildren = (parentId: string | null) => {
    return orgUnits.filter((unit) => unit.parentId === parentId);
  };

  // Open Create Modal
  const openCreateModal = (parent?: OrgUnitModel) => {
    setFormData({
      code: `UNIT-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      type: parent ? 'DEPARTMENT' : 'DIVISION',
      parentId: parent ? parent.id : orgUnits[0]?.id || '',
      managerId: '',
    });
    setActionError(null);
    setActionSuccess(null);
    setModalMode('create');
  };

  // Open Edit Modal
  const openEditModal = (unit: OrgUnitModel) => {
    setFormData({
      code: unit.code,
      name: unit.name,
      type: unit.type,
      parentId: unit.parentId || '',
      managerId: unit.managerId || '',
    });
    setActionError(null);
    setActionSuccess(null);
    setModalMode('edit');
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setActionError(isVi ? 'Vui lòng nhập tên và mã đơn vị.' : 'Please enter code and name.');
      return;
    }

    if (modalMode === 'create') {
      addOrgUnit({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parentId: formData.parentId || null,
        managerId: formData.managerId || null,
      });
      setActionSuccess(isVi ? 'Đã tạo đơn vị mới thành công!' : 'Org unit created successfully!');
    } else if (modalMode === 'edit' && selectedUnit) {
      updateOrgUnit(selectedUnit.id, {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parentId: formData.parentId || null,
        managerId: formData.managerId || null,
      });
      setSelectedUnit((prev) =>
        prev ? { ...prev, ...formData, parentId: formData.parentId || null, managerId: formData.managerId || null } : null
      );
      setActionSuccess(isVi ? 'Đã cập nhật đơn vị thành công!' : 'Org unit updated successfully!');
    }

    setTimeout(() => setModalMode(null), 800);
  };

  // Handle Delete
  const handleDelete = (unit: OrgUnitModel) => {
    if (window.confirm(isVi ? `Xác nhận xóa đơn vị "${unit.name}"?` : `Delete unit "${unit.name}"?`)) {
      const res = deleteOrgUnit(unit.id);
      if (!res.success) {
        alert(res.error);
      } else {
        setSelectedUnit(orgUnits.find((u) => u.id !== unit.id) || null);
      }
    }
  };

  const renderNode = (node: OrgUnitModel, depth = 0) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedUnit?.id === node.id;
    const manager = getUser(node.managerId);

    const typeBadge = {
      COMPANY: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      DIVISION: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      DEPARTMENT: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      TEAM: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      UNIT: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    }[node.type];

    return (
      <div key={node.id} className="select-none">
        <div
          id={`org-node-${node.id}`}
          onClick={() => setSelectedUnit(node)}
          className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all border ${
            isSelected
              ? 'bg-[var(--brand-50)] border-[var(--brand)] text-[var(--brand)] shadow-sm font-semibold'
              : 'hover:bg-[var(--surface-hover)] border-transparent text-[var(--ink)]'
          }`}
          style={{ marginLeft: `${depth * 18}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded hover:bg-[var(--line)] transition"
              title={isExpanded ? 'Collapse node' : 'Expand node'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-5 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]" />
            </div>
          )}

          <div className="p-1 rounded-md bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--brand)]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs truncate">{node.name}</span>
              <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--line)]">
                {node.code}
              </span>
            </div>
          </div>

          <span className={`text-[9.5px] uppercase font-bold px-2 py-0.5 rounded-full border ${typeBadge}`}>
            {node.type}
          </span>

          {manager && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--line)]">
              <UserCheck className="w-3 h-3 text-emerald-500" />
              <span className="truncate max-w-[110px]">{manager.name}</span>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-[var(--line)] ml-5 pl-1 mt-0.5 space-y-0.5">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootUnits = getChildren(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Org Tree Interactive View */}
      <div id="org-tree-panel" className="lg:col-span-6 app-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[var(--brand)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              {isVi ? 'Cơ cấu Tổ chức Đa cấp (Self-Ref Tree)' : 'Organizational Hierarchy Tree'}
            </h3>
          </div>
          <button
            onClick={() => openCreateModal(selectedUnit || undefined)}
            className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isVi ? 'Thêm đơn vị' : 'Add Unit'}</span>
          </button>
        </div>

        <div className="space-y-1">
          {rootUnits.map((root) => renderNode(root, 0))}
        </div>
      </div>

      {/* RIGHT: Selected Node Inspector & Actions */}
      <div id="org-node-inspector" className="lg:col-span-6 app-card space-y-5">
        {selectedUnit ? (
          <>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--line)]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--brand)] bg-[var(--brand-50)] px-2 py-0.5 rounded border border-[var(--brand-100)]">
                    {selectedUnit.code}
                  </span>
                  <span className="text-xs font-bold text-[var(--muted)]">
                    {selectedUnit.type}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[var(--ink)] mt-1.5">{selectedUnit.name}</h3>
                <div className="flex items-center gap-1 text-xs text-[var(--muted)] mt-1 font-mono">
                  <FolderTree className="w-3.5 h-3.5 text-[var(--brand)]" />
                  <span>Path: {selectedUnit.path}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEditModal(selectedUnit)}
                  className="p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)] transition"
                  title="Chỉnh sửa đơn vị"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(selectedUnit)}
                  className="p-2 rounded-lg border border-rose-500/30 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 transition"
                  title="Xóa đơn vị"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Manager Details */}
            <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {isVi ? 'Trưởng Đơn Vị (Manager)' : 'Appointed Unit Manager'}
              </div>
              {selectedUnit.managerId ? (
                (() => {
                  const mgr = getUser(selectedUnit.managerId);
                  return mgr ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-50)] border border-[var(--brand-100)] text-[var(--brand)] font-bold flex items-center justify-center text-xs">
                          {mgr.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--ink)]">{mgr.name}</div>
                          <div className="text-[11px] text-[var(--muted)]">{mgr.email}</div>
                        </div>
                      </div>
                      <span className="badge-pill b-active text-[10px]">Active</span>
                    </div>
                  ) : null;
                })()
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-4 h-4" />
                  <span>{isVi ? 'Chưa chỉ định trưởng đơn vị (Cần bổ nhiệm).' : 'No unit manager appointed.'}</span>
                </div>
              )}
            </div>

            {/* Materialized Path Explanation */}
            <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1 text-xs">
              <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>{isVi ? 'Prisma Materialized Path & RLS Fast-Lookup' : 'Prisma Materialized Path'}</span>
              </div>
              <p className="text-[var(--muted)] leading-relaxed text-[11px]">
                {isVi
                  ? `Đường dẫn "${selectedUnit.path}" cho phép truy vấn đệ quy tìm toàn bộ phòng ban cấp dưới chỉ trong 1 câu SQL WHERE path LIKE '${selectedUnit.path}/%' cực nhanh.`
                  : `Path "${selectedUnit.path}" enables O(1) subtree permission lookups via SQL WHERE path LIKE '${selectedUnit.path}/%'.`}
              </p>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--muted)]">
            {isVi ? 'Chọn một đơn vị tổ chức ở cây bên trái để xem chi tiết.' : 'Select an org unit from the tree.'}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {modalMode === 'create'
                  ? isVi ? 'Thêm Đơn vị Tổ chức Mới' : 'Create New Org Unit'
                  : isVi ? 'Chỉnh sửa Đơn vị Tổ chức' : 'Edit Org Unit'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Mã đơn vị (Code)' : 'Unit Code'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Tên đơn vị' : 'Unit Name'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  placeholder="e.g. Platform Engineering Team"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Loại đơn vị' : 'Unit Type'}
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  >
                    <option value="DIVISION">DIVISION (Khối)</option>
                    <option value="DEPARTMENT">DEPARTMENT (Ban/Phòng)</option>
                    <option value="TEAM">TEAM (Đội/Nhóm)</option>
                    <option value="UNIT">UNIT (Đơn vị)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                    {isVi ? 'Đơn vị Cha (Parent)' : 'Parent Unit'}
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  >
                    <option value="">-- {isVi ? 'Không (Là Gốc)' : 'None (Root)'} --</option>
                    {orgUnits
                      .filter((u) => modalMode === 'create' || u.id !== selectedUnit?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Trưởng đơn vị' : 'Unit Manager'}
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                >
                  <option value="">-- {isVi ? 'Chưa bổ nhiệm' : 'Unassigned'} --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {actionError && (
                <div className="p-2 text-[11px] bg-rose-500/10 text-rose-600 rounded border border-rose-500/20 font-semibold">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="p-2 text-[11px] bg-emerald-500/10 text-emerald-600 rounded border border-emerald-500/20 font-semibold">
                  {actionSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="btn btn-secondary text-xs font-bold"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
                  {modalMode === 'create'
                    ? isVi ? 'Tạo Đơn Vị' : 'Create Unit'
                    : isVi ? 'Lưu Thay Đổi' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
