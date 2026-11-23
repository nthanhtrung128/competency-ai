import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useServerData, Loading, ErrorBox } from './shared';

type Dash = {
  generatedAt: string;
  framework: {
    competencies: number; published: number; draftOnly: number; fullFiveLevels: number; scored: number;
    byCategory: Array<{ category: string; total: number; published: number; full: number }>;
    ownersMissing: number; pendingDrafts: number; requirements: Record<string, number>;
  };
  org: { units: number; employees: number; accounts: number | null; pendingPasswordChange: number | null };
  assessment: { byStatus: Record<string, number>; latest: { name: string; status: string; participants: number; raters: number; submitted: number; rate: number; participantsComplete: number; endDate: string | null } | null } | null;
  talent: { cycle: string; reviewed: number; calibrated: number; boxes: Record<string, number> } | null;
  idp: { plans: number; byStatus: Record<string, number>; avgProgress: number; overdueActions: number } | null;
  succession: { plans: number; critical: number; withReadyNow: number; criticalUncovered: number; withoutCandidate: number } | null;
};

const CAT: Record<string, string> = { COR: 'Cốt lõi', LEA: 'Lãnh đạo', FUN: 'Chuyên môn' };
const BOX_LABEL: Record<number, string> = { 1: 'Rủi ro', 2: 'Ổn định', 3: 'Chuyên gia tin cậy', 4: 'Cần xem xét', 5: 'Nòng cốt', 6: 'Đóng góp mạnh', 7: 'Viên ngọc thô', 8: 'Ngôi sao tương lai', 9: 'Ngôi sao' };
const IDP_VI: Record<string, string> = { DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Huỷ' };

/** Thẻ số liệu — số lớn, nhãn, ghi chú; trạng thái cảnh báo đi kèm biểu tượng + chữ, không chỉ dùng màu */
const Tile: React.FC<{ label: string; value: React.ReactNode; note?: React.ReactNode; warn?: boolean }> = ({ label, value, note, warn }) => (
  <div className="app-card">
    <div className="text-[11px] font-semibold text-[var(--muted)]">{label}</div>
    <div className="text-2xl font-extrabold text-[var(--ink)] tracking-tight mt-1">{value}</div>
    {note && (
      <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${warn ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`}>
        {warn ? <AlertTriangle className="w-3 h-3 shrink-0" /> : null}{note}
      </div>
    )}
  </div>
);

/** Thanh tiến độ một màu trên nền trung tính; số liệu in bằng chữ, không chỉ dựa vào độ dài thanh */
const Meter: React.FC<{ label: string; value: number; total: number; suffix?: string }> = ({ label, value, total, suffix }) => {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1" title={`${label}: ${value}/${total} (${pct}%)`}>
      <div className="flex justify-between text-[11.5px]"><span className="text-[var(--ink)]">{label}</span><span className="text-[var(--muted)]">{value}/{total}{suffix ?? ''} · {pct}%</span></div>
      <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

export const ServerDashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const d = useServerData<Dash>('/dashboard');
  if (d.loading && !d.data) return <Loading text="Đang tổng hợp số liệu…" />;
  if (d.error) return <ErrorBox text={d.error} />;
  if (!d.data) return null;
  const { framework: f, org, assessment: a, talent: t, idp, succession: s } = d.data;
  const req = f.requirements;
  const reqTotal = (req.APPROVED ?? 0) + (req.PROPOSED ?? 0) + (req.UNMAPPED ?? 0);
  const maxBox = t ? Math.max(1, ...Object.values(t.boxes)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Bảng điều khiển — dữ liệu thật</h1>
          <p className="text-xs text-[var(--muted)]">Số liệu trong phạm vi tài khoản của bạn · cập nhật {new Date(d.data.generatedAt).toLocaleString('vi-VN')}</p>
        </div>
        <button onClick={() => d.reload()} className="btn btn-secondary text-xs flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Làm mới</button>
      </div>

      {/* Khung năng lực */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Khung năng lực</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Năng lực đã ban hành" value={`${f.published}/${f.competencies}`} note={f.draftOnly ? `${f.draftOnly} năng lực mới đang là bản nháp` : 'không có năng lực chờ'} />
          <Tile label="Đủ 5 mức chỉ báo" value={`${f.fullFiveLevels}/${f.scored}`} note="năng lực có chấm điểm" warn={f.fullFiveLevels < f.scored} />
          <Tile label="Bản nháp chờ duyệt" value={f.pendingDrafts} note={<button className="underline" onClick={() => onNavigate?.('review')}>mở Bàn duyệt</button>} warn={f.pendingDrafts > 0} />
          <Tile label="Chưa có đơn vị chủ quản" value={f.ownersMissing} note={f.ownersMissing ? 'QĐ-03 chưa xong' : 'đã đủ'} warn={f.ownersMissing > 0} />
        </div>
        <div className="app-card grid md:grid-cols-2 gap-x-8 gap-y-3">
          {f.byCategory.map((c) => <Meter key={c.category} label={`${CAT[c.category]} — đủ 5 mức`} value={c.full} total={c.total} />)}
          <Meter label="Yêu cầu năng lực của vai trò đã duyệt (QĐ-02)" value={req.APPROVED ?? 0} total={reqTotal} />
        </div>
      </section>

      {/* Tổ chức */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Tổ chức & tài khoản</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Đơn vị" value={org.units} />
          <Tile label="Nhân sự đang làm việc" value={org.employees} note={org.employees ? undefined : 'chưa nạp nhân sự'} warn={!org.employees} />
          {org.accounts !== null && <Tile label="Tài khoản hoạt động" value={org.accounts} />}
          {org.pendingPasswordChange !== null && <Tile label="Chưa đổi mật khẩu lần đầu" value={org.pendingPasswordChange} warn={org.pendingPasswordChange > 0} note={org.pendingPasswordChange ? 'nhắc người dùng đăng nhập' : 'đã đủ'} />}
        </div>
      </section>

      {/* 360° */}
      {a && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Đánh giá 360°</h2>
          {a.latest ? (
            <div className="app-card space-y-3">
              <div className="flex justify-between text-xs"><b>{a.latest.name}</b><span className="text-[var(--muted)]">{a.latest.status === 'OPEN' ? 'đang thu phiếu' : a.latest.status === 'CLOSED' ? 'đã đóng' : 'đang chuẩn bị'}{a.latest.endDate ? ` · hạn ${new Date(a.latest.endDate).toLocaleDateString('vi-VN')}` : ''}</span></div>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                <Meter label="Phiếu đã nộp" value={a.latest.submitted} total={a.latest.raters} />
                <Meter label="Người được đánh giá đã đủ phiếu" value={a.latest.participantsComplete} total={a.latest.participants} />
              </div>
              <div className="text-[11px] text-[var(--muted)]">Tổng: {a.byStatus.OPEN} đang mở · {a.byStatus.CLOSED} đã đóng · {a.byStatus.DRAFT} đang chuẩn bị</div>
            </div>
          ) : <div className="app-card text-xs text-[var(--muted)]">Chưa có chiến dịch 360°.</div>}
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* 9-Box */}
        {t && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">9-Box chu kỳ {t.cycle}</h2>
            <div className="app-card space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((b) => {
                  const n = t.boxes[b] ?? 0;
                  // một màu, đậm dần theo số người (thang tuần tự)
                  const alpha = n ? 0.12 + 0.6 * (n / maxBox) : 0;
                  return (
                    <div key={b} title={`Ô ${b} · ${BOX_LABEL[b]}: ${n} người`} className="rounded-lg p-2 border border-[var(--line)]"
                      style={{ background: n ? `rgba(37, 99, 235, ${alpha})` : undefined }}>
                      <div className="text-[10px] text-[var(--ink)]">{b} · {BOX_LABEL[b]}</div>
                      <div className="text-lg font-extrabold text-[var(--ink)]">{n}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-1">
                {t.reviewed ? <><CheckCircle2 className="w-3 h-3" /> {t.reviewed} người đã xếp ô · {t.calibrated} đã chốt hiệu chỉnh</> : 'Chưa xếp ô cho ai trong chu kỳ này.'}
                · trục dọc Tiềm năng, trục ngang Hiệu suất
              </div>
            </div>
          </section>
        )}

        <div className="space-y-5">
          {/* IDP */}
          {idp && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">IDP</h2>
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Kế hoạch" value={idp.plans} />
                <Tile label="Tiến độ trung bình" value={`${idp.avgProgress}%`} />
                <Tile label="Hành động quá hạn" value={idp.overdueActions} warn={idp.overdueActions > 0} note={idp.overdueActions ? 'cần nhắc' : 'không có'} />
              </div>
              {idp.plans > 0 && (
                <div className="app-card text-[11.5px] flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(idp.byStatus).map(([k, v]) => <span key={k}>{IDP_VI[k] ?? k}: <b>{v}</b></span>)}
                </div>
              )}
            </section>
          )}
          {/* Kế thừa */}
          {s && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Kế thừa</h2>
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Vị trí then chốt" value={s.plans} note={`${s.critical} trọng yếu`} />
                <Tile label="Có người sẵn sàng ngay" value={`${s.withReadyNow}/${s.plans}`} />
                <Tile label="Trọng yếu chưa có người thay" value={s.criticalUncovered} warn={s.criticalUncovered > 0} note={s.criticalUncovered ? 'rủi ro gián đoạn' : 'đã phủ'} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
