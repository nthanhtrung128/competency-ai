import React, { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { useServerData, Loading, ErrorBox, Empty, Pill, RELATION_VI, fmt, inputCls, CAMPAIGN_STATUS } from './shared';

type CampaignRow = { id: string; code: string; name: string; status: string };
type SummaryRow = {
  employee: { id: string; employeeCode: string; fullName: string; jobTitle: string | null };
  submitted: number; total: number; core: number | null; leadership: number | null; suggestedPotential: number | null; gaps: number;
  requirementBasis?: { status: string; requirementsCount: number };
};
type Result = {
  campaign: { name: string; status: string; minRatersForAnonymity: number };
  employee: { employeeCode: string; fullName: string; jobTitle: string | null; jobRoleCode: string | null };
  requirementBasis?: { status: string; capturedAt: string | null; jobRoleCode: string | null; roleTitle: string | null; roleRevision: number | null; requirementsCount: number };
  raters: { total: number; submitted: number; byRelation: Array<{ relation: string; invited: number; submitted: number }>; hiddenGroups: string[] };
  summary: { core: number | null; leadership: number | null };
  competencies: Array<{
    code: string; name: string; category: string; self: number | null; manager: number | null; peer: number | null;
    directReport: number | null; others: number | null; othersCount: number; required: number | null; requiredStatus: string | null;
    gap: number | null; blindSpot: number | null;
  }>;
};

const POT = ['', 'Thấp', 'Trung bình', 'Cao'];

/** Kết quả 360°: tổng hợp chiến dịch + chi tiết từng người, có bảo vệ ẩn danh */
export const Results: React.FC<{ initial?: { campaignId: string; employeeId: string } | null }> = ({ initial }) => {
  const camps = useServerData<{ campaigns: CampaignRow[] }>('/campaigns');
  const [campaignId, setCampaignId] = useState<string>(initial?.campaignId ?? '');
  const [employeeId, setEmployeeId] = useState<string>(initial?.employeeId ?? '');
  useEffect(() => {
    if (!campaignId && camps.data?.campaigns.length) {
      setCampaignId((camps.data.campaigns.find((c) => c.status === 'CLOSED') ?? camps.data.campaigns[0]).id);
    }
  }, [camps.data, campaignId]);
  const summary = useServerData<{ participants: SummaryRow[] }>(campaignId ? `/campaigns/${campaignId}/summary` : null);

  if (camps.loading && !camps.data) return <Loading />;
  if (camps.error) return <ErrorBox text={camps.error} />;
  if (!camps.data?.campaigns.length) return <Empty>Chưa có chiến dịch 360° nào.</Empty>;

  return (
    <div className="space-y-3">
      <select className={inputCls} value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setEmployeeId(''); }}>
        {camps.data.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {CAMPAIGN_STATUS[c.status][0]}</option>)}
      </select>
      {employeeId ? (
        <PersonResult campaignId={campaignId} employeeId={employeeId} onBack={() => setEmployeeId('')} />
      ) : summary.loading && !summary.data ? <Loading /> : summary.error ? <ErrorBox text={summary.error} /> : (
        !summary.data?.participants.length ? <Empty>Không có người được đánh giá trong phạm vi của bạn.</Empty> : (
          <div className="app-card overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
                <th className="py-1.5 pr-2">Nhân sự</th><th className="pr-2">Phiếu</th><th className="pr-2">Cốt lõi</th><th className="pr-2">Lãnh đạo</th>
                <th className="pr-2">Gợi ý tiềm năng</th><th className="pr-2">NL dưới yêu cầu</th><th />
              </tr></thead>
              <tbody>
                {summary.data.participants.map((p) => (
                  <tr key={p.employee.id} className="border-b border-[var(--line)]">
                    <td className="py-1.5 pr-2"><b>{p.employee.fullName}</b> <span className="text-[var(--muted)]">{p.employee.employeeCode}</span></td>
                    <td className="pr-2">{p.submitted}/{p.total}</td>
                    <td className="pr-2">{fmt(p.core)}</td>
                    <td className="pr-2">{fmt(p.leadership)}</td>
                    <td className="pr-2">{p.suggestedPotential ? POT[p.suggestedPotential] : '—'}</td>
                    <td className="pr-2">{p.requirementBasis && !p.requirementBasis.requirementsCount ? '—' : p.gaps > 0 ? <Pill tone="amber">{p.gaps}</Pill> : '0'}</td>
                    <td><button onClick={() => setEmployeeId(p.employee.id)} className="text-[var(--brand)] font-bold">Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10.5px] text-[var(--muted)] mt-2">
              Điểm = trung bình của người khác đánh giá (không tính tự đánh giá). Gợi ý tiềm năng [PROPOSAL]: nhóm Lãnh đạo ≥ 3,5 → Cao; ≥ 2,5 → Trung bình.
              {' '}Dấu — ở cột năng lực dưới yêu cầu nghĩa là chưa có mức yêu cầu để đối chiếu.
            </p>
          </div>
        )
      )}
    </div>
  );
};

const PersonResult: React.FC<{ campaignId: string; employeeId: string; onBack: () => void }> = ({ campaignId, employeeId, onBack }) => {
  const r = useServerData<Result>(`/campaigns/${campaignId}/results/${employeeId}`);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorBox text={r.error} />;
  if (!r.data) return null;
  const d = r.data;
  const bar = (v: number | null, color: string) => v === null ? null : (
    <div className="h-1.5 rounded bg-[var(--line)] w-20 inline-block align-middle ml-1"><div className={`h-full rounded ${color}`} style={{ width: `${(v / 5) * 100}%` }} /></div>
  );
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-[var(--brand)] font-bold">← Tổng hợp chiến dịch</button>
      <div className="app-card space-y-1.5">
        <h3 className="text-sm font-bold text-[var(--ink)]">{d.employee.fullName} <span className="text-xs text-[var(--muted)]">· {d.employee.employeeCode} · {d.employee.jobTitle} · vai trò {d.employee.jobRoleCode ?? '—'}</span></h3>
        {d.requirementBasis?.status === 'FROZEN' && <p className="text-xs text-[var(--muted)]">
          Yêu cầu đã chốt ngày {d.requirementBasis.capturedAt ? new Date(d.requirementBasis.capturedAt).toLocaleString('vi-VN') : '—'}
          {' '}· chức danh {d.requirementBasis.jobRoleCode ?? 'chưa gán'}{d.requirementBasis.roleTitle ? ` · ${d.requirementBasis.roleTitle}` : ''}.
          {' '}Thay đổi chức danh hoặc bộ yêu cầu sau đó không làm đổi mức đối chiếu của kỳ này.
          {!d.requirementBasis.requirementsCount && ' Tại thời điểm chốt chưa có yêu cầu đã duyệt phù hợp với các năng lực trong kỳ.'}
        </p>}
        {d.requirementBasis?.status === 'MISSING' && <p className="text-xs text-amber-700 dark:text-amber-300">Kỳ này chưa lưu yêu cầu chức danh tại thời điểm đánh giá. Hệ thống giữ điểm và để trống khoảng cách; không dùng bộ yêu cầu hiện tại để suy ngược.</p>}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {d.raters.byRelation.filter((x) => x.invited).map((x) => <Pill key={x.relation}>{RELATION_VI[x.relation]} {x.submitted}/{x.invited}</Pill>)}
          <Pill tone="blue">Cốt lõi {fmt(d.summary.core)}</Pill><Pill tone="blue">Lãnh đạo {fmt(d.summary.leadership)}</Pill>
        </div>
        {d.raters.hiddenGroups.length > 0 && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <EyeOff className="w-3.5 h-3.5" /> Ẩn điểm riêng nhóm {d.raters.hiddenGroups.map((g) => RELATION_VI[g]).join(', ')} vì dưới {d.campaign.minRatersForAnonymity} người trả lời.
            Điểm của họ vẫn được tính vào cột "Người khác".
          </div>
        )}
      </div>
      <div className="app-card overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead><tr className="text-left text-[var(--muted)] border-b border-[var(--line)]">
            <th className="py-1.5 pr-2">Năng lực</th><th className="pr-2">Tự ĐG</th><th className="pr-2">Quản lý</th><th className="pr-2">Đồng nghiệp</th>
            <th className="pr-2">Cấp dưới</th><th className="pr-2">Người khác</th><th className="pr-2">Yêu cầu</th><th className="pr-2">Khoảng cách</th><th>Điểm mù</th>
          </tr></thead>
          <tbody>
            {d.competencies.map((c) => (
              <tr key={c.code} className="border-b border-[var(--line)]">
                <td className="py-1.5 pr-2"><span className="font-mono font-bold text-[var(--brand)]">{c.code}</span> {c.name}</td>
                <td className="pr-2">{fmt(c.self)}</td>
                <td className="pr-2">{fmt(c.manager)}</td>
                <td className="pr-2">{fmt(c.peer)}</td>
                <td className="pr-2">{fmt(c.directReport)}</td>
                <td className="pr-2 whitespace-nowrap"><b>{fmt(c.others)}</b>{bar(c.others, 'bg-[var(--brand)]')}</td>
                <td className="pr-2">{c.required ?? '—'}{c.requiredStatus === 'PROPOSED' && <span title="Yêu cầu vai trò đang ở trạng thái đề xuất (QĐ-02)"> *</span>}</td>
                <td className="pr-2">{c.gap === null ? '—' : c.gap > 0 ? <Pill tone="amber">−{fmt(c.gap)}</Pill> : <Pill tone="green">đạt</Pill>}</td>
                <td>{c.blindSpot === null ? '—' : Math.abs(c.blindSpot) >= 1 ? <Pill tone={c.blindSpot > 0 ? 'red' : 'blue'}>{c.blindSpot > 0 ? 'tự đánh giá cao hơn' : 'tự đánh giá thấp hơn'} {fmt(Math.abs(c.blindSpot))}</Pill> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10.5px] text-[var(--muted)] mt-2">
          {d.competencies.some(c => c.requiredStatus === 'PROPOSED') && <>* Mức yêu cầu có dấu sao còn là đề xuất chờ duyệt. </>}
          Điểm mù: chênh lệch tự đánh giá và người khác từ 1 điểm trở lên.
        </p>
      </div>
    </div>
  );
};
