import React, { useState } from 'react';
import {
  UserModel,
  OrgUnitModel,
  UserScopeModel,
  ScopeAccessLevel,
} from '../../packages/db/src/types';
import {
  Lock,
  ShieldCheck,
  Check,
  Layers,
  ChevronRight,
  AlertCircle,
  Building2,
  User,
  Clock,
  ArrowRight,
  Plus,
  Trash2,
  Play,
  ShieldX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const UserScopeMatrix: React.FC = () => {
  const { users, orgUnits, userScopes, lang, addUserScope, deleteUserScope } = useApp();
  const isVi = lang === 'vi';

  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];

  // Modal State
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [newScopeData, setNewScopeData] = useState<{
    orgUnitId: string;
    accessLevel: ScopeAccessLevel;
    includeSubtree: boolean;
  }>({
    orgUnitId: orgUnits[0]?.id || '',
    accessLevel: 'READ',
    includeSubtree: true,
  });

  // RLS Simulator State
  const [simUser, setSimUser] = useState<string>(users[0]?.id || '');
  const [simUnit, setSimUnit] = useState<string>(orgUnits[0]?.id || '');
  const [simLevel, setSimLevel] = useState<ScopeAccessLevel>('READ');
  const [simResult, setSimResult] = useState<{ allowed: boolean; reason: string; inheritedVia?: string } | null>(null);

  // Helper to find all accessible OrgUnits for a user given their scopes and the subtree rule
  const getUserAccessibleUnits = (userId: string) => {
    const scopes = userScopes.filter((s) => s.userId === userId);
    const accessibleMap = new Map<
      string,
      { unit: OrgUnitModel; maxAccess: ScopeAccessLevel; viaScope: UserScopeModel; isSubtreeInherited: boolean }
    >();

    const accessRank: Record<ScopeAccessLevel, number> = {
      READ: 1,
      WRITE: 2,
      APPROVE: 3,
      ADMIN: 4,
    };

    scopes.forEach((scope) => {
      const rootUnit = orgUnits.find((o) => o.id === scope.orgUnitId);
      if (!rootUnit) return;

      // Add direct unit
      const existing = accessibleMap.get(rootUnit.id);
      if (!existing || accessRank[scope.accessLevel] > accessRank[existing.maxAccess]) {
        accessibleMap.set(rootUnit.id, {
          unit: rootUnit,
          maxAccess: scope.accessLevel,
          viaScope: scope,
          isSubtreeInherited: false,
        });
      }

      // If includeSubtree is true, grant access to all descendants in hierarchy tree
      if (scope.includeSubtree && rootUnit.path) {
        orgUnits.forEach((childUnit) => {
          if (childUnit.path && childUnit.path.startsWith(rootUnit.path + '/') && childUnit.id !== rootUnit.id) {
            const childExisting = accessibleMap.get(childUnit.id);
            if (!childExisting || accessRank[scope.accessLevel] > accessRank[childExisting.maxAccess]) {
              accessibleMap.set(childUnit.id, {
                unit: childUnit,
                maxAccess: scope.accessLevel,
                viaScope: scope,
                isSubtreeInherited: true,
              });
            }
          }
        });
      }
    });

    return Array.from(accessibleMap.values());
  };

  const userActiveScopes = userScopes.filter((s) => s.userId === selectedUser?.id);
  const effectiveAccessibleUnits = selectedUser ? getUserAccessibleUnits(selectedUser.id) : [];

  // RLS Simulation Query Checker
  const runRLSSimulation = () => {
    const testUser = users.find((u) => u.id === simUser);
    const testUnit = orgUnits.find((u) => u.id === simUnit);
    if (!testUser || !testUnit) return;

    const accessRank: Record<ScopeAccessLevel, number> = {
      READ: 1,
      WRITE: 2,
      APPROVE: 3,
      ADMIN: 4,
    };

    const targetReqRank = accessRank[simLevel];
    const userAccessible = getUserAccessibleUnits(simUser);
    const matched = userAccessible.find((item) => item.unit.id === testUnit.id);

    if (!matched) {
      setSimResult({
        allowed: false,
        reason: isVi
          ? `Người dùng ${testUser.name} không có bất kỳ phạm vi (Scope) nào bao hàm đơn vị ${testUnit.name}.`
          : `User ${testUser.name} has no scope coverage for ${testUnit.name}.`,
      });
    } else if (accessRank[matched.maxAccess] >= targetReqRank) {
      setSimResult({
        allowed: true,
        reason: isVi
          ? `Được phép! Quyền hiệu lực cao nhất là ${matched.maxAccess} (Yêu cầu: ${simLevel}).`
          : `ALLOWED! Effective access is ${matched.maxAccess} (Required: ${simLevel}).`,
        inheritedVia: matched.isSubtreeInherited
          ? isVi
            ? `Kế thừa đệ quy từ đơn vị gốc qua cờ includeSubtree=true (${matched.viaScope.accessLevel})`
            : `Inherited via recursive materialized path (${matched.viaScope.accessLevel})`
          : isVi
          ? 'Gán trực tiếp'
          : 'Direct assignment',
      });
    } else {
      setSimResult({
        allowed: false,
        reason: isVi
          ? `Từ chối (Permission Denied)! Người dùng chỉ có quyền ${matched.maxAccess}, không đủ mức ${simLevel}.`
          : `DENIED! User only holds ${matched.maxAccess}, insufficient for requested ${simLevel}.`,
      });
    }
  };

  const handleGrantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    addUserScope({
      userId: selectedUser.id,
      orgUnitId: newScopeData.orgUnitId,
      accessLevel: newScopeData.accessLevel,
      includeSubtree: newScopeData.includeSubtree,
      grantedBy: 'user-superadmin',
      expiresAt: null,
    });

    setGrantModalOpen(false);
  };

  const getAccessBadge = (level: ScopeAccessLevel) => {
    switch (level) {
      case 'ADMIN':
        return 'bg-purple-500/15 text-purple-600 border-purple-500/30 font-bold';
      case 'APPROVE':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold';
      case 'WRITE':
        return 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30 font-bold';
      case 'READ':
      default:
        return 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="app-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {isVi ? 'Phân quyền Dữ liệu Row-Level Security (RLS UserScope)' : 'Row-Level Security (RLS) & Data Scope Policy'}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {isVi
                ? 'Kiểm soát truy cập dữ liệu đa cấp kết hợp kế thừa đệ quy qua cờ includeSubtree = true'
                : 'Scoped access control linking users to OrgUnits with recursive subtree inheritance (includeSubtree = true)'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setGrantModalOpen(true)}
          className="btn btn-primary text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isVi ? 'Gán Phạm vi Mới' : 'Grant New Scope'}</span>
        </button>
      </div>

      {/* Main Grid: User Directory & Effective Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Selector List */}
        <div id="users-scope-panel" className="lg:col-span-4 app-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--brand)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                {isVi ? 'Danh sách Nhân sự' : 'Users Directory'}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--line)]">
              {users.length} users
            </span>
          </div>

          <div className="space-y-2">
            {users.map((u) => {
              const isSelected = u.id === selectedUser?.id;
              const scopesCount = userScopes.filter((s) => s.userId === u.id).length;
              return (
                <div
                  key={u.id}
                  id={`user-scope-card-${u.id}`}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? 'bg-[var(--brand-50)] border-[var(--brand)] text-[var(--brand)] shadow-sm'
                      : 'bg-[var(--surface)] border-[var(--line)] hover:bg-[var(--surface-hover)] text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs">{u.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
                      {scopesCount} scopes
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{u.email}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1 font-medium">{u.title}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected User Scopes & Effective Tree */}
        <div id="user-scope-details-panel" className="lg:col-span-8 space-y-5">
          {/* Direct Scopes Granted */}
          <div className="app-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h4 className="font-bold text-sm text-[var(--ink)]">
                  {isVi ? `Phạm vi Gán trực tiếp: ${selectedUser?.name}` : `Direct Scopes: ${selectedUser?.name}`}
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Các bản ghi gán quyền trong bảng UserScope của Prisma ORM'
                    : 'Explicit UserScope records in database'}
                </p>
              </div>
              <button
                onClick={() => setGrantModalOpen(true)}
                className="btn btn-secondary text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isVi ? 'Thêm Scope' : 'Add Scope'}</span>
              </button>
            </div>

            {userActiveScopes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userActiveScopes.map((scope) => {
                  const unit = orgUnits.find((o) => o.id === scope.orgUnitId);
                  return (
                    <div
                      key={scope.id}
                      className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-2 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${getAccessBadge(scope.accessLevel)}`}>
                          {scope.accessLevel}
                        </span>
                        <button
                          onClick={() => deleteUserScope(scope.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 transition"
                          title="Xóa scope"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-xs font-bold text-[var(--ink)]">{unit?.name || scope.orgUnitId}</div>
                      <div className="text-[10.5px] font-mono text-[var(--muted)]">Path: {unit?.path}</div>

                      <div className="text-[11px] flex items-center gap-1.5 pt-1 border-t border-[var(--line)] text-[var(--muted)]">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>
                          {scope.includeSubtree
                            ? isVi ? 'Kế thừa toàn bộ nhánh con' : 'Recursive Subtree Enabled'
                            : isVi ? 'Chỉ áp dụng tại đơn vị này' : 'Exact Unit Only'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[var(--muted)] bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                {isVi ? 'Người dùng chưa được gán bất kỳ Scope dữ liệu nào.' : 'No active scopes assigned to this user.'}
              </div>
            )}
          </div>

          {/* Effective Permissions (Computed Tree) */}
          <div className="app-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--ink)]">
                  {isVi ? 'Tổng hợp Quyền Hiệu lực (Effective Computed Access)' : 'Computed Effective Permissions'}
                </h4>
                <p className="text-xs text-[var(--muted)]">
                  {isVi
                    ? 'Kết quả sau khi thuật toán đệ quy quét cây thư mục Materialized Path'
                    : 'Result after evaluating recursive materialized path inheritance'}
                </p>
              </div>
              <span className="badge-pill b-active text-[10px]">
                {effectiveAccessibleUnits.length} {isVi ? 'đơn vị có quyền' : 'accessible units'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {effectiveAccessibleUnits.map(({ unit, maxAccess, isSubtreeInherited }) => (
                <div
                  key={unit.id}
                  className="p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[var(--brand)]" />
                    <span className="font-semibold text-[var(--ink)]">{unit.name}</span>
                    {isSubtreeInherited && (
                      <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                        {isVi ? 'Kế thừa đệ quy' : 'Subtree Inherited'}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getAccessBadge(maxAccess)}`}>
                    {maxAccess}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RLS INTERACTIVE SIMULATOR (TEST QUERY) */}
      <div className="app-card space-y-4 border-2 border-[var(--brand-100)] bg-[var(--brand-50)]/30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--brand)]" />
          <h3 className="font-bold text-sm text-[var(--ink)]">
            {isVi ? 'Bộ Thử nghiệm Truy vấn Quyền RLS (Interactive RLS Access Tester)' : 'Interactive RLS Access Query Simulator'}
          </h3>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {isVi
            ? 'Mô phỏng tức thì hành vi kiểm tra quyền truy cập của hệ thống khi một nhân sự thực hiện thao tác trên một phòng ban bất kỳ.'
            : 'Simulate runtime RLS policy checks when a user attempts to access or mutate a specific organizational unit.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
              {isVi ? 'Chọn Nhân sự' : 'Select User'}
            </label>
            <select
              value={simUser}
              onChange={(e) => setSimUser(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
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
              {isVi ? 'Chọn Đơn vị Cần Thao Tác' : 'Target Org Unit'}
            </label>
            <select
              value={simUnit}
              onChange={(e) => setSimUnit(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
            >
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
              {isVi ? 'Mức Quyền Yêu Cầu' : 'Required Access Level'}
            </label>
            <select
              value={simLevel}
              onChange={(e) => setSimLevel(e.target.value as any)}
              className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
            >
              <option value="READ">READ (Chỉ xem)</option>
              <option value="WRITE">WRITE (Tạo / Sửa)</option>
              <option value="APPROVE">APPROVE (Duyệt kết quả)</option>
              <option value="ADMIN">ADMIN (Toàn quyền quản trị)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={runRLSSimulation}
            className="btn btn-primary text-xs font-bold flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isVi ? 'Chạy Kiểm Tra Quyền (Simulate Access)' : 'Simulate Access Check'}</span>
          </button>
        </div>

        {/* Simulation Output Result */}
        {simResult && (
          <div
            className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs ${
              simResult.allowed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700'
            }`}
          >
            {simResult.allowed ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <ShieldX className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold text-sm">
                {simResult.allowed ? (isVi ? 'CHO PHÉP TRUY CẬP (ACCESS GRANTED)' : 'ACCESS GRANTED') : (isVi ? 'TỪ CHỐI TRUY CẬP (ACCESS DENIED)' : 'ACCESS DENIED')}
              </div>
              <p className="leading-relaxed">{simResult.reason}</p>
              {simResult.inheritedVia && (
                <div className="font-mono text-[11px] pt-1 opacity-90">
                  ⚡ Cơ chế: {simResult.inheritedVia}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* GRANT SCOPE MODAL */}
      {grantModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h3 className="font-bold text-sm text-[var(--ink)]">
                {isVi ? `Gán Scope Dữ liệu cho ${selectedUser?.name}` : `Grant Scope to ${selectedUser?.name}`}
              </h3>
              <button
                onClick={() => setGrantModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGrantSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Đơn vị Tổ chức (Org Unit)' : 'Target Org Unit'}
                </label>
                <select
                  value={newScopeData.orgUnitId}
                  onChange={(e) => setNewScopeData({ ...newScopeData, orgUnitId: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                  required
                >
                  {orgUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--muted)] mb-1">
                  {isVi ? 'Mức Quyền (Access Level)' : 'Access Level'}
                </label>
                <select
                  value={newScopeData.accessLevel}
                  onChange={(e) => setNewScopeData({ ...newScopeData, accessLevel: e.target.value as any })}
                  className="w-full text-xs p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]"
                >
                  <option value="READ">READ (Xem dữ liệu)</option>
                  <option value="WRITE">WRITE (Tạo & Sửa dữ liệu)</option>
                  <option value="APPROVE">APPROVE (Duyệt kết quả đánh giá)</option>
                  <option value="ADMIN">ADMIN (Toàn quyền quản trị đơn vị)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg)]">
                <input
                  type="checkbox"
                  id="chk-subtree"
                  checked={newScopeData.includeSubtree}
                  onChange={(e) => setNewScopeData({ ...newScopeData, includeSubtree: e.target.checked })}
                  className="w-4 h-4 text-[var(--brand)] rounded"
                />
                <label htmlFor="chk-subtree" className="text-xs font-semibold text-[var(--ink)] cursor-pointer">
                  {isVi ? 'Kế thừa tự động cho toàn bộ phòng ban cấp dưới (includeSubtree)' : 'Include child departments recursively'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGrantModalOpen(false)}
                  className="btn btn-secondary text-xs font-bold"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
                  {isVi ? 'Xác nhận Gán Quyền' : 'Grant Scope'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
