import React, { useState } from 'react';
import { AuditLogModel, AuditAction } from '../../packages/db/src/types';
import { History, Shield, User, Globe, CheckCircle2, AlertTriangle, XCircle, Search, Filter, ArrowRight } from 'lucide-react';

interface AuditLogViewerProps {
  logs: AuditLogModel[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogModel | null>(logs[0] || null);

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.entityName?.toLowerCase().includes(search.toLowerCase()) ||
      log.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
      log.entityType.toLowerCase().includes(search.toLowerCase()) ||
      log.id.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
      case 'PUBLISH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'UPDATE':
      case 'ROLE_ASSIGNED':
      case 'PERMISSION_GRANTED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'DELETE':
      case 'ROLE_REVOKED':
      case 'PERMISSION_REVOKED':
      case 'ARCHIVE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'FAILURE':
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor email, entity name, or log ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Actions ({logs.length})</option>
            <option value="ROLE_ASSIGNED">ROLE_ASSIGNED</option>
            <option value="PERMISSION_GRANTED">PERMISSION_GRANTED</option>
            <option value="PUBLISH">PUBLISH</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Audit Log Entries List */}
        <div id="audit-log-list" className="lg:col-span-7 bg-slate-900/40 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Audit Trail Events ({filteredLogs.length})</span>
            <span className="font-mono text-[10px]">Immutable Event Log</span>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <div
                    key={log.id}
                    id={`log-item-${log.id}`}
                    onClick={() => setSelectedLog(log)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition text-left space-y-2 ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {log.entityType}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        {getStatusIcon(log.status)}
                        <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <h4 className="font-semibold text-xs text-slate-200 truncate">{log.entityName || log.entityId}</h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <User className="w-3 h-3 text-indigo-400" />
                        {log.actorEmail || 'System'}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        IP: {log.actorIp || 'internal'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <History className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">No audit logs matching search query.</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected Log Inspector */}
        <div id="audit-log-detail" className="lg:col-span-5 bg-slate-900/40 rounded-xl border border-slate-800 p-5 space-y-4">
          {selectedLog ? (
            <>
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${getActionColor(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      ID: {selectedLog.id}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">{selectedLog.entityName || selectedLog.entityId}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Target Entity: {selectedLog.entityType} ({selectedLog.entityId})</p>
                </div>
              </div>

              {/* Actor & Security Context */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Security &amp; Actor Context
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block">Actor Email:</span>
                    <span className="text-slate-200 font-semibold">{selectedLog.actorEmail || 'System / Auto'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Actor IP:</span>
                    <span className="text-slate-200">{selectedLog.actorIp || '127.0.0.1'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Timestamp:</span>
                    <span className="text-indigo-300">{new Date(selectedLog.timestamp).toISOString()}</span>
                  </div>
                  {selectedLog.userAgent && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">User Agent:</span>
                      <span className="text-slate-400 text-[10px] break-all">{selectedLog.userAgent}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Diff & State Deltas */}
              {selectedLog.diff && (
                <div className="space-y-1.5 text-xs">
                  <label className="text-slate-400 font-medium">State Mutation Delta (Diff)</label>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-2">
                    {Object.entries(selectedLog.diff).map(([key, change]) => (
                      <div key={key} className="flex items-center gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-400 font-bold">{key}:</span>
                        <span className="text-rose-400 line-through">{String(change.old ?? 'null')}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-emerald-400 font-bold">{String(change.new ?? 'null')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Values Snapshot */}
              {selectedLog.newValues && (
                <div className="space-y-1.5 text-xs">
                  <label className="text-slate-400 font-medium">Captured New State Payload</label>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-36">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <div className="space-y-1.5 text-xs">
                  <label className="text-slate-400 font-medium">Operational Metadata</label>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-indigo-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <History className="w-8 h-8 opacity-40" />
              <p className="text-sm">Select an audit log to inspect its mutation payload.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
