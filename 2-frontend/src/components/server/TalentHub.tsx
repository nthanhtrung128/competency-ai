import React, { useState } from 'react';
import { ClipboardCheck, Megaphone, BarChart3, Grid3x3, Route, UserCog, GitBranch } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RaterTasks } from './RaterTasks';
import { Campaigns } from './Campaigns';
import { Results } from './Results';
import { NineBox } from './NineBox';
import { IdpView } from './IdpView';
import { Accounts } from './Accounts';
import { Succession } from './Succession';

export type HubTab = 'tasks' | 'campaigns' | 'results' | '9box' | 'succession' | 'idp' | 'accounts';

/**
 * QĐ-06: 360° → 9-Box → IDP trên dữ liệu máy chủ. Chỉ hiện ở chế độ Máy chủ.
 * Tab hiện theo quyền thật của tài khoản (máy chủ vẫn chặn lần nữa).
 */
export const TalentHub: React.FC<{ initial?: HubTab }> = ({ initial = 'tasks' }) => {
  const { can } = useApp();
  const [tab, setTab] = useState<HubTab>(initial);
  const [resultTarget, setResultTarget] = useState<{ campaignId: string; employeeId: string } | null>(null);

  const tabs: Array<{ key: HubTab; label: string; icon: React.ElementType; show: boolean }> = [
    { key: 'tasks', label: 'Phiếu của tôi', icon: ClipboardCheck, show: true },
    { key: 'campaigns', label: 'Chiến dịch 360°', icon: Megaphone, show: can('assessment:manage') || can('assessment:read_results') },
    { key: 'results', label: 'Kết quả 360°', icon: BarChart3, show: can('assessment:manage') || can('assessment:read_results') },
    { key: '9box', label: '9-Box', icon: Grid3x3, show: can('talent:review') },
    { key: 'succession', label: 'Kế thừa', icon: GitBranch, show: can('talent:review') || can('assessment:manage') },
    { key: 'idp', label: 'IDP', icon: Route, show: true },
    { key: 'accounts', label: 'Tài khoản', icon: UserCog, show: can('user:manage') },
  ];
  const visible = tabs.filter((t) => t.show);
  const active = visible.some((t) => t.key === tab) ? tab : visible[0].key;

  return (
    <div className="space-y-4">
      <div className="app-card">
        <h2 className="text-base font-bold text-[var(--ink)]">Đánh giá 360° · 9-Box · Kế thừa · IDP</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Dữ liệu thật trên máy chủ. Luồng: chiến dịch 360° (chốt phiên bản năng lực) → phiếu → kết quả có bảo vệ ẩn danh → gợi ý trục Tiềm năng 9-Box → ứng viên kế thừa cho vị trí then chốt → khoảng cách so với yêu cầu vai trò → IDP 70-20-10.
        </p>
        <div className="flex flex-wrap gap-1 mt-3 border-b border-[var(--line)]">
          {visible.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition ${active === t.key ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {active === 'tasks' && <RaterTasks />}
      {active === 'campaigns' && <Campaigns onViewResult={(campaignId, employeeId) => { setResultTarget({ campaignId, employeeId }); setTab('results'); }} />}
      {active === 'results' && <Results key={resultTarget ? `${resultTarget.campaignId}-${resultTarget.employeeId}` : 'all'} initial={resultTarget} />}
      {active === '9box' && <NineBox />}
      {active === 'succession' && <Succession />}
      {active === 'idp' && <IdpView />}
      {active === 'accounts' && <Accounts />}
    </div>
  );
};
