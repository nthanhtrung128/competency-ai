import React, { useEffect, useState } from 'react';
import { ClipboardCheck, ChevronLeft, Send, Save } from 'lucide-react';
import { useServerData, useAction, Loading, ErrorBox, Empty, Pill, RELATION_VI } from './shared';

type Task = {
  id: string; relation: string; status: string; answered: number; submittedAt: string | null;
  campaign: { id: string; code: string; name: string; endDate: string | null };
  evaluatee: { employeeCode: string; fullName: string; jobTitle: string | null };
};
type Form = {
  id: string; relation: string; status: string;
  campaign: { code: string; name: string; status: string };
  evaluatee: { employeeCode: string; fullName: string; jobTitle: string | null };
  competencies: Array<{
    code: string; name: string; category: string; definition: string;
    anchors: Array<{ level: number; text: string | null }>;
    level: number | null; evidence: string | null; answered: boolean;
  }>;
};

/** "Phiếu của tôi": danh sách phiếu 360° được giao cho tài khoản đang đăng nhập */
export const RaterTasks: React.FC = () => {
  const { data, error, loading, reload } = useServerData<{ linked: boolean; tasks: Task[] }>('/my/rater-tasks');
  const [open, setOpen] = useState<string | null>(null);

  if (open) return <RatingForm id={open} onBack={() => { setOpen(null); void reload(); }} />;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox text={error} />;
  if (!data?.linked) {
    return <Empty>Tài khoản này chưa gắn với hồ sơ nhân sự nên không có phiếu đánh giá. HR gắn hồ sơ khi cấp tài khoản.</Empty>;
  }
  if (!data.tasks.length) return <Empty>Không có phiếu nào đang mở cho bạn.</Empty>;

  const pending = data.tasks.filter((t) => t.status !== 'SUBMITTED').length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        Bạn có <b>{pending}</b> phiếu cần hoàn thành. Điểm của nhóm Đồng nghiệp và Cấp dưới được gộp và chỉ hiển thị khi đủ số người trả lời.
        Người được đánh giá không biết ai chấm điểm nào.
      </p>
      <div className="grid gap-2">
        {data.tasks.map((t) => (
          <button key={t.id} onClick={() => setOpen(t.id)}
            className="app-card text-left flex items-center justify-between gap-3 hover:border-[var(--brand)] transition">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[var(--ink)]">
                {t.relation === 'SELF' ? 'Tự đánh giá' : `${t.evaluatee.fullName} · ${t.evaluatee.employeeCode}`}
              </div>
              <div className="text-[11px] text-[var(--muted)]">
                {t.campaign.name} · vai trò của bạn: {RELATION_VI[t.relation]}
                {t.campaign.endDate ? ` · hạn ${new Date(t.campaign.endDate).toLocaleDateString('vi-VN')}` : ''}
              </div>
            </div>
            {t.status === 'SUBMITTED' ? <Pill tone="green">Đã nộp</Pill> : <Pill tone="amber">Chưa nộp · {t.answered} đã trả lời</Pill>}
          </button>
        ))}
      </div>
    </div>
  );
};

const RatingForm: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const { data, error, loading } = useServerData<Form>(`/rater-tasks/${id}`);
  const { run, busy } = useAction();
  const [answers, setAnswers] = useState<Record<string, { level: number | null; evidence: string; answered: boolean }>>({});

  useEffect(() => {
    if (!data) return;
    setAnswers(Object.fromEntries(data.competencies.map((c) => [c.code, { level: c.level, evidence: c.evidence ?? '', answered: c.answered }])));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox text={error} />;
  if (!data) return null;
  const locked = data.status === 'SUBMITTED' || data.campaign.status !== 'OPEN';
  const answeredCount = Object.values(answers).filter((a) => a.answered).length;

  const save = async (submit: boolean) => {
    const scores = Object.entries(answers)
      .filter(([, a]) => a.answered)
      .map(([code, a]) => ({ code, level: a.level, evidence: a.evidence || undefined }));
    const r = await run('PUT', `/rater-tasks/${id}`, { scores, submit }, submit ? 'Đã nộp phiếu' : 'Đã lưu nháp phiếu');
    if (r && submit) onBack();
  };
  const set = (code: string, patch: Partial<{ level: number | null; evidence: string; answered: boolean }>) =>
    setAnswers((p) => ({ ...p, [code]: { ...p[code], ...patch } }));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-[var(--brand)] font-bold flex items-center gap-1">
        <ChevronLeft className="w-3.5 h-3.5" /> Danh sách phiếu
      </button>
      <div className="app-card space-y-1">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[var(--brand)]" />
          <h3 className="text-sm font-bold text-[var(--ink)]">
            {data.relation === 'SELF' ? 'Tự đánh giá' : `Đánh giá ${data.evaluatee.fullName}`} — {data.campaign.name}
          </h3>
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          Chọn mức mô tả <b>đúng nhất hành vi bạn đã quan sát được</b> trong 6–12 tháng qua, không phải mức bạn mong muốn. Không đủ cơ sở thì chọn
          “Không đủ cơ sở”. Đã trả lời {answeredCount}/{data.competencies.length}.
        </p>
      </div>

      {data.competencies.map((c) => {
        const a = answers[c.code] ?? { level: null, evidence: '', answered: false };
        return (
          <div key={c.code} className="app-card space-y-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[var(--brand)]">{c.code}</span>
                <span className="text-xs font-bold text-[var(--ink)]">{c.name}</span>
                {a.answered && <Pill tone="green">Đã trả lời</Pill>}
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{c.definition}</p>
            </div>
            <div className="grid gap-1.5">
              {c.anchors.map((an) => (
                <label key={an.level}
                  className={`flex gap-2 p-2 rounded-lg border text-[11.5px] cursor-pointer ${a.answered && a.level === an.level ? 'border-[var(--brand)] bg-[var(--brand-50)]' : 'border-[var(--line)]'} ${locked ? 'opacity-70 cursor-default' : ''}`}>
                  <input type="radio" name={`lv-${c.code}`} disabled={locked} checked={a.answered && a.level === an.level}
                    onChange={() => set(c.code, { level: an.level, answered: true })} />
                  <span><b>Mức {an.level}.</b> {an.text ?? <i className="text-[var(--muted)]">chưa có chỉ báo</i>}</span>
                </label>
              ))}
              <label className={`flex gap-2 p-2 rounded-lg border text-[11.5px] cursor-pointer ${a.answered && a.level === null ? 'border-[var(--brand)] bg-[var(--brand-50)]' : 'border-[var(--line)]'}`}>
                <input type="radio" name={`lv-${c.code}`} disabled={locked} checked={a.answered && a.level === null}
                  onChange={() => set(c.code, { level: null, answered: true })} />
                <span>Không đủ cơ sở quan sát</span>
              </label>
            </div>
            <textarea disabled={locked} value={a.evidence} onChange={(e) => set(c.code, { evidence: e.target.value })}
              placeholder="Ví dụ hành vi cụ thể (không bắt buộc, khuyến khích): tình huống — hành động — kết quả"
              className="w-full p-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] text-xs" rows={2} />
          </div>
        );
      })}

      {!locked && (
        <div className="flex gap-2 sticky bottom-2">
          <button disabled={busy} onClick={() => save(false)} className="btn btn-secondary text-xs flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Lưu nháp
          </button>
          <button disabled={busy || answeredCount < data.competencies.length} onClick={() => save(true)}
            className="btn btn-primary text-xs flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Nộp phiếu ({answeredCount}/{data.competencies.length})
          </button>
        </div>
      )}
      {locked && <Pill tone="green">Phiếu đã nộp hoặc chiến dịch đã đóng — chỉ xem</Pill>}
    </div>
  );
};
