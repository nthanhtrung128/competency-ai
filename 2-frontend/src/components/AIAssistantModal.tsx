import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Sliders,
  ShieldCheck,
  BrainCircuit,
  CheckCircle2,
  FileCode,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Language } from '../data/i18n';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const isVi = lang === 'vi';
  const [prompt, setPrompt] = useState('');
  const [selectedTask, setSelectedTask] = useState<string>('korn_ferry_indicators');
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRunAI = () => {
    setLoading(true);
    setResponseOutput(null);

    setTimeout(() => {
      if (selectedTask === 'korn_ferry_indicators') {
        setResponseOutput(
          isVi
            ? `### Đề xuất Bộ Chỉ báo Hành vi Chuẩn thang FLA-5 (5 mức):
**Năng lực:** ${prompt || 'Ra quyết định khi không chắc chắn (Decision under Uncertainty - LE2)'}

- **Level 1 (Basic / Developing):** Thu thập dữ liệu cơ bản, tuân thủ các quy trình đã có trước khi đưa ra đề xuất cho cấp trên; nhận diện được các rủi ro hiển nhiên.
- **Level 2 (Proficient / Applied):** Độc lập ra quyết định trong phạm vi phụ trách ngay cả khi thông tin chưa đầy đủ 100%; đánh giá tương quan rủi ro - lợi ích và xây dựng kế hoạch dự phòng B.
- **Level 3 (Advanced / Accomplished):** Định hướng đội ngũ đưa ra quyết định chiến lược trong môi trường biến động cao; quản trị bất định bằng cách thiết lập các kịch bản linh hoạt và giải phóng nguồn lực kịp thời.
- **Level 4 (Expert / Benchmark):** Dẫn dắt toàn tổ chức vượt qua các giai đoạn chuyển đổi phức tạp; thiết lập khung chuẩn ra quyết định cấp tập đoàn và dự báo trước các xu hướng thị trường.`
            : `### FLA-5 5-Level Behavioral Indicator Proposal:
**Competency:** ${prompt || 'Decision under Uncertainty (LE2)'}

- **Level 1 (Basic / Developing):** Gathers baseline facts and consults established protocols before making recommendations; recognizes immediate surface risks.
- **Level 2 (Proficient / Applied):** Autonomously makes sound operational decisions with incomplete data; balances risk vs reward with proactive Contingency Plan B.
- **Level 3 (Advanced / Accomplished):** Steers multi-department teams through high-volatility scenarios; institutes scenario planning frameworks and timely resource reallocation.
- **Level 4 (Expert / Benchmark):** Sets enterprise-wide decision-making governance; anticipates market dislocations and leads organizational pivots with high clarity.`
        );
      } else if (selectedTask === 'rls_audit') {
        setResponseOutput(
          isVi
            ? `### Đánh giá Bảo mật & RLS UserScope (packages/db):
- **Cơ chế:** Kiểm tra bảng \`user_scopes\` với \`@@unique([userId, orgUnitId, accessLevel])\`.
- **Kế thừa cây đơn vị (\`includeSubtree = true\`):** Đảm bảo Manager tại Khối (T1) tự động có quyền READ/WRITE/APPROVE cho tất cả các Ban (T2) và Phòng (T3) cấp dưới thông qua đệ quy Materialized Path hoặc Recursive CTE.
- **Tính toàn vẹn FK:** Khóa ngoại \`onDelete: Cascade\` trên \`UserScope\` và \`onDelete: Restrict\` trên \`OrgUnit.parentId\` ngăn ngừa việc tạo các nhánh dữ liệu mồ côi.`
            : `### Security & RLS UserScope Audit (packages/db):
- **Mechanism:** Evaluates \`user_scopes\` with \`@@unique([userId, orgUnitId, accessLevel])\`.
- **Subtree Inheritance (\`includeSubtree = true\`):** Guarantees Division Managers (T1) inherit access across Departments (T2) and Teams (T3) via recursive tree traversal.
- **FK Integrity:** \`onDelete: Cascade\` on \`UserScope\` and \`onDelete: Restrict\` on \`OrgUnit.parentId\` prevents orphaned records.`
        );
      } else {
        setResponseOutput(
          isVi
            ? `### Lộ trình Kỹ thuật Triển khai từng Giai đoạn (GĐ0 - GĐ4):
1. **GĐ0 (Nghiệm thu chuẩn UI & Data Model):** Hoàn thành chuẩn UI B.8, Prisma Schema 12 Models, FLA-5 5-Level Scale và RLS UserScope (Hiện tại).
2. **GĐ1 (Foundation & Org Architecture):** Xây dựng REST/tRPC API cho OrgUnit CRUD, Tree traversal, Role-Permission assignment.
3. **GĐ2 (Competency & Success Profiles):** Quản lý phiên bản từ điển năng lực, gán năng lực cho Job Family & Cấp bậc.
4. **GĐ3 (Assessment 360° & Gap Analysis):** Mở chiến dịch đánh giá đa chiều, tính điểm trung bình và biểu đồ Radar.
5. **GĐ4 (Talent Calibration 9-Box & AI IDP):** Hiệu chuẩn nhân tài 9 ô và sinh kế hoạch đào tạo cá nhân hóa bằng Gemini.`
            : `### Multi-Phase Implementation Roadmap (GĐ0 - GĐ4):
1. **Phase 0 (UI Benchmark & Data Modeling):** B.8 UI Standard, Prisma 12 Models, FLA-5 5-Level & UserScope RLS (Active).
2. **Phase 1 (Foundation & Org Architecture):** REST/tRPC APIs for OrgUnit CRUD, Tree traversal, Role-Permission matrix.
3. **Phase 2 (Competency & Success Profiles):** Competency versioning, Job Family mapping & FLA-5 benchmarks.
4. **Phase 3 (360 Assessment & Gap Analysis):** Multi-rater campaigns, rating aggregations & competency gap radars.
5. **Phase 4 (9-Box Calibration & AI IDP):** 9-Box grid calibration & AI-generated personalized development plans.`
        );
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[var(--brand-50)] border-b border-[var(--brand-100)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isVi ? 'Trợ lý AI Quản trị Năng lực & Kiến trúc Hệ thống' : 'AI Competency & Architecture Copilot'}
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                {isVi ? 'Phân tích thang FLA-5 (5 mức), RLS UserScope & Lộ trình triển khai' : 'FLA-5 5-Level analysis, RLS UserScope & Multi-Phase Roadmap'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Action Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isVi ? 'Chọn tác vụ AI đề xuất:' : 'Select AI Assistant Task:'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedTask('korn_ferry_indicators')}
                className={`p-2.5 rounded-lg border text-left transition flex items-center gap-2 ${
                  selectedTask === 'korn_ferry_indicators'
                    ? 'border-[var(--brand)] bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]/40'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{isVi ? 'Chuẩn hóa FLA-5' : 'FLA-5 Anchors'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTask('rls_audit')}
                className={`p-2.5 rounded-lg border text-left transition flex items-center gap-2 ${
                  selectedTask === 'rls_audit'
                    ? 'border-[var(--brand)] bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]/40'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isVi ? 'Kiểm toán RLS Scope' : 'RLS Scope Audit'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTask('roadmap_guidance')}
                className={`p-2.5 rounded-lg border text-left transition flex items-center gap-2 ${
                  selectedTask === 'roadmap_guidance'
                    ? 'border-[var(--brand)] bg-[var(--brand-50)] text-[var(--brand)] font-bold'
                    : 'border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]/40'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isVi ? 'Lộ trình từng Giai đoạn' : 'Phase Roadmap'}</span>
              </button>
            </div>
          </div>

          {/* Input Prompt */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {isVi ? 'Nội dung hoặc Tên năng lực yêu cầu:' : 'Prompt or Competency Name:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  isVi
                    ? 'Nhập tên năng lực (ví dụ: Ra quyết định khi không chắc chắn, Tư duy chiến lược...)'
                    : 'Enter competency name (e.g. Decision under Uncertainty, Strategic Agility...)'
                }
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs focus:outline-none focus:border-[var(--brand)]"
              />
              <button
                onClick={handleRunAI}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-600)] text-white font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {loading ? (
                  <BrainCircuit className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Phân tích' : 'Analyze'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output Display */}
          {responseOutput && (
            <div className="p-4 rounded-xl bg-[var(--brand-50)] border border-[var(--brand-100)] text-[var(--ink)] space-y-2 leading-relaxed animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--brand-100)]">
                <span className="font-bold text-[var(--brand)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
                  {isVi ? 'Kết quả Phân tích AI:' : 'AI Generation Output:'}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)]">Gemini Engine</span>
              </div>
              <div className="whitespace-pre-line text-xs font-sans">
                {responseOutput}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--line)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--muted)]">
            {isVi ? 'Chuẩn FLA-5 5-Level Framework & Prisma ORM' : 'FLA-5 5-Level Framework & Prisma ORM'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold hover:bg-[var(--line)]/50 transition"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
