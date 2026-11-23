import React, { useState } from 'react';
import {
  RoleModel,
  PermissionModel,
  RolePermissionModel,
  UserModel,
  UserRoleModel
} from '../../packages/db/src/types';
import { Shield, Key, Users, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

interface RBACExplorerProps {
  roles: RoleModel[];
  permissions: PermissionModel[];
  rolePermissions: RolePermissionModel[];
  users: UserModel[];
  userRoles: UserRoleModel[];
}

export const RBACExplorer: React.FC<RBACExplorerProps> = ({
  roles,
  permissions,
  rolePermissions,
  users,
  userRoles,
}) => {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'matrix' | 'users'>('matrix');

  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0];

  // Group permissions by module
  const modules = Array.from(new Set(permissions.map(p => p.module)));

  const hasPermission = (roleId: string, permissionId: string) => {
    return rolePermissions.some(rp => rp.roleId === roleId && rp.permissionId === permissionId);
  };

  const getUsersForRole = (roleId: string) => {
    const directUserRoleIds = userRoles.filter(ur => ur.roleId === roleId).map(ur => ur.userId);
    return users.filter(u => directUserRoleIds.includes(u.id) || u.primaryRoleId === roleId);
  };

  const assignedUsers = getUsersForRole(selectedRole?.id || '');

  return (
    <div className="space-y-6">
      {/* Role Selector Header */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {roles.map((role) => {
          const isSelected = role.id === selectedRoleId;
          const rolePermCount = rolePermissions.filter(rp => rp.roleId === role.id).length;
          const userCount = getUsersForRole(role.id).length;

          return (
            <div
              key={role.id}
              id={`rbac-role-card-${role.id}`}
              onClick={() => setSelectedRoleId(role.id)}
              className={`p-4 rounded-xl border cursor-pointer transition text-left space-y-2 ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-md'
                  : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300">
                  {role.code}
                </span>
                {role.isSystem && (
                  <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    SYSTEM
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm leading-tight">{role.name}</h4>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-indigo-400" />
                  {rolePermCount} perms
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  {userCount} users
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Details & Permissions View */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{selectedRole.name}</h3>
                <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  code: {selectedRole.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedRole.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Permission Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Assigned Users ({assignedUsers.length})</span>
            </button>
          </div>
        </div>

        {activeTab === 'matrix' ? (
          <div className="space-y-4">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Granular module authorizations mapped via <code className="text-indigo-300 font-mono">RolePermission</code> join table:</span>
              <span className="font-mono text-[11px] text-slate-400">
                Granted: {rolePermissions.filter(rp => rp.roleId === selectedRole.id).length} / {permissions.length} total
              </span>
            </div>

            <div className="space-y-4">
              {modules.map((moduleName) => {
                const modulePerms = permissions.filter(p => p.module === moduleName);
                return (
                  <div key={moduleName} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                        Module: {moduleName}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        {modulePerms.filter(p => hasPermission(selectedRole.id, p.id)).length} of {modulePerms.length} granted
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {modulePerms.map((perm) => {
                        const granted = hasPermission(selectedRole.id, perm.id);
                        return (
                          <div
                            key={perm.id}
                            className={`p-3 rounded-lg border flex items-start justify-between gap-2 transition ${
                              granted
                                ? 'bg-emerald-500/5 border-emerald-500/30 text-slate-200'
                                : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-slate-200">
                                  {perm.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-snug">{perm.description}</p>
                            </div>

                            <div className={`p-1 rounded-full ${
                              granted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {granted ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Users assigned to role <strong className="text-white">{selectedRole.name}</strong>:</span>
              <span className="font-mono text-[11px]">Multi-Role &amp; Primary Role bindings</span>
            </div>

            {assignedUsers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assignedUsers.map((user) => {
                  const userRoleRecord = userRoles.find(ur => ur.userId === user.id && ur.roleId === selectedRole.id);
                  const isPrimary = userRoleRecord ? userRoleRecord.isPrimary : user.primaryRoleId === selectedRole.id;

                  return (
                    <div
                      key={user.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-indigo-300">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-white truncate">{user.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPrimary ? (
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            Primary Role
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            Secondary Role
                          </span>
                        )}
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {user.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <Users className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">No users currently assigned to this role.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
