import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { CompanyPortal } from './components/CompanyPortal';
import { ServerConnectButton, ServerConnectModal, NoticeToast } from './components/ServerConnectPanel';
import { ServerDashboard } from './components/server/ServerDashboard';
import { OrgHierarchyTree } from './components/OrgHierarchyTree';
import { CompetencyVersionMatrix } from './components/CompetencyVersionMatrix';
import { TalentHub } from './components/server/TalentHub';
import { EmployeeImport } from './components/server/EmployeeImport';
import { Employees } from './components/server/Employees';
import { RoleProfiles } from './components/server/RoleProfiles';
import { AuditLogViewer } from './components/AuditLogViewer';

function Workspace() {
  const { dataSource, orgUnits, proficiencyScales, auditLogs, can } = useApp();
  const [active, setActive] = useState('dashboard');
  const [accountOpen, setAccountOpen] = useState(false);
  if (dataSource !== 'SERVER') return <CompanyPortal />;
  const tabs = [
    ['dashboard', 'Tổng quan', true],
    ['hierarchy', 'Cơ cấu tổ chức', can('org:read') || can('org:read_all')],
    ['employees', 'Danh sách nhân sự', can('employee:read')],
    ['competencies', 'Từ điển năng lực', can('competency:read')],
    ['scales', 'Thang năng lực', can('competency:read')],
    ['roleProfiles', 'Hồ sơ chức danh', can('competency:read')],
    ['assessment360', 'Đánh giá và phát triển', true],
    ['dataHub', 'Nhập nhân sự', can('employee:import')],
    ['scopes', 'Quản lý tài khoản', can('user:manage')],
    ['audit', 'Nhật ký hệ thống', can('audit:read')],
  ] as const;
  const selected = tabs.some(([key, , allowed]) => key === active && allowed) ? active : 'dashboard';
  return <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
    <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] p-4">
      <div><p className="font-bold">CompetencyAI</p><p className="text-xs text-[var(--muted)]">{orgUnits.find(unit => unit.code === 'HQ')?.name ?? 'Quản trị năng lực doanh nghiệp'}</p></div>
      <ServerConnectButton onOpen={() => setAccountOpen(true)} />
    </header>
    <div className="md:flex">
      <nav aria-label="Chức năng doanh nghiệp" className="flex gap-1 overflow-x-auto p-3 md:w-56 md:shrink-0 md:flex-col">
        {tabs.filter(([, , allowed]) => allowed).map(([key, label]) => <button key={key} onClick={() => setActive(key)}
          aria-current={key === selected ? 'page' : undefined}
          className={'whitespace-nowrap rounded-lg p-3 text-left text-sm ' + (key === selected ? 'bg-[var(--brand-50)] font-semibold text-[var(--brand)]' : '')}>{label}</button>)}
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        {selected === 'dashboard' && <ServerDashboard onNavigate={setActive} />}
        {selected === 'hierarchy' && <OrgHierarchyTree />}
        {selected === 'employees' && <Employees />}
        {selected === 'roleProfiles' && <RoleProfiles />}
        {selected === 'competencies' && <CompetencyVersionMatrix />}
        {selected === 'scales' && <section className="app-card space-y-3"><h1 className="text-xl font-bold">Thang năng lực</h1>
          {proficiencyScales.filter(scale => !scale.parentId).map(scale => <div key={scale.id}>
            <h2 className="font-semibold">{scale.name}</h2>
            <ul className="mt-2 space-y-2">{proficiencyScales.filter(level => level.parentId === scale.id).map(level =>
              <li key={level.id}><b>{level.label}</b>{level.description && <p>{level.description}</p>}</li>)}</ul>
          </div>)}</section>}
        {selected === 'assessment360' && <TalentHub />}
        {selected === 'scopes' && <TalentHub key="accounts" initial="accounts" />}
        {selected === 'dataHub' && <EmployeeImport />}
        {selected === 'audit' && <AuditLogViewer logs={auditLogs} />}
      </main>
    </div>
    <ServerConnectModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    <NoticeToast />
  </div>;
}

export default function PortalApp() {
  return <AppProvider><Workspace /></AppProvider>;
}
