# Nhật ký thay đổi

## 23/11/2026 — Chạy kiểm thử tự động trên GitHub (CI)

- Thêm `.github/workflows/backend-tests.yml`: mỗi lần push / PR tự chạy trên GitHub — PostgreSQL 16 tạm, `npm ci`, `tsc --noEmit` + `npm run lint:tests`, `prisma db push`, `npm run seed:all`, `npm test`, rồi bật máy chủ cổng 8080 và `npm run smoke`.
- `npm run smoke` chạy lại: **19/19 đạt** (đúng con số cũ, không phải sửa script).
- `tests/docker-compose.test.yml`: thêm healthcheck (để `docker compose up -d --wait` đợi CSDL sẵn sàng). Chưa thử được vì môi trường không có Docker daemon.
- Không đổi nội dung các kịch bản test. Workflow chưa chạy trên GitHub thật (chỉ chạy từng bước tương đương trên PostgreSQL 16 cục bộ).

## 23/11/2026 — Bộ kiểm thử đầu-cuối vào kho

- Thêm `1-backend/tests/`: `e2e-360-idp.ts` (134 mục), `e2e-review-succession.ts` (73 mục), `helpers.ts`, `run.ts`, `README.md`, `docker-compose.test.yml`.
- Lệnh mới: `npm test` (tự bật máy chủ cổng 8099, chạy cả hai kịch bản), `npm run test:360`, `npm run test:review`, `npm run lint:tests`.
- Test ghi rồi xoá dữ liệu thử và từ chối chạy khi `DATABASE_URL`/`API_URL` không phải máy cục bộ (trừ `ALLOW_REMOTE_TEST_DB=1`).
- Đã chạy trên PostgreSQL 18 tạm: 134/134 và 73/73. Chưa chạy lại `npm run smoke`; chưa thử `docker-compose.test.yml`.

## 23/11/2026 — Đưa dự án lên GitHub

- Tạo kho riêng tư `nthanhtrung128/competency-ai` gồm toàn bộ backend, frontend, dữ liệu, tài liệu, khung tổ chức.
- Thêm `CLAUDE.md` (bối cảnh cho Claude Code) và `.gitignore` (loại `.env`, `backups/`, `node_modules/`).

## 14/10/2026 — Nối giao diện với máy chủ, Job Architecture, Sổ quyết định

**Backend (`1-backend`)**
- Thêm 4 bảng: `JobFamily`, `JobLevel`, `JobRole`, `JobRoleRequirement`; thêm `Competency.domainName`.
- Endpoint mới (`src/routes/framework.ts`): `GET /api/bootstrap`, `PATCH /api/competencies/:id/owner`, `POST /api/competencies/:id/versions`, `PATCH /api/competency-versions/:id` (chỉ DRAFT), `GET /api/job-roles`, `PUT /api/job-roles/:code/requirements`.
- Lệnh mới: `seed:job-architecture`, `import:indicators`, `seed:all`.
- `seed.ts` nạp đủ 34 đơn vị từ `data/flamingo_seed_data.json` (trước: 18 đơn vị viết cứng).
- `seed-competencies.ts` không ghi đè đơn vị chủ quản đã gán trên app.
- `smoke.ts` thêm 2 mục: bootstrap, chặn sửa trực tiếp bản đã ban hành.
- Thêm thư viện `exceljs` để đọc file mẫu chỉ báo.

**Frontend (`2-frontend`)**
- `src/api/client.ts`, `src/api/serverAdapter.ts`, `src/components/ServerConnectPanel.tsx`: kết nối máy chủ, đăng nhập, tự làm mới phiên, đánh thức máy chủ Render.
- `AppContext`: chế độ DEMO/SERVER; dữ liệu máy chủ không ghi vào localStorage; các thao tác ghi gọi API thật.
- Khóa quản trị: không sửa trực tiếp bản đã ban hành; không ban hành bản có câu chữ tự sinh; nút "gán nhanh chủ quản" chỉ ghi phương án đề xuất; mức chưa có chỉ báo ghi rõ "chưa có" thay vì câu chung chung.
- Đối chiếu mã Sổ tay → Từ điển cho yêu cầu năng lực của vai trò; nhãn "đề xuất" / "chưa có mã" trên Hồ sơ năng lực.
- Sửa lỗi: Hồ sơ năng lực mượn chỉ báo của năng lực khác khi không tìm thấy mã; tạo bản nháp ở chế độ Demo không thêm được phiên bản mới; 4 màn hình đọc dữ liệu mẫu cố định thay vì dữ liệu hiện hành.
- Đổi toàn bộ nhãn "Korn Ferry 4 cấp" → "FLA-5 (5 mức)".

**Dữ liệu (`3-du-lieu`)**
- `doi_chieu_ma_nang_luc.csv` (mới), `Mau_ChiBao_ChuyenMon_Muc1-5.xlsx` (mới).
- `flamingo_seed_data.json`: đơn vị chủ quản FU14/30/31/37/38/44 → Ban PC&KSNB (theo quyết định gộp KSNB).

**Tài liệu (`4-tai-lieu`)**
- `QUYET_DINH_HOAN_THIEN.md` (mới) — Sổ quyết định.
- `HUONG_DAN.md` — Phần 6 viết lại; thêm 6.1, 6.2.

## 14/10/2026 (lần 2) — Áp dụng QĐ-01, QĐ-04, QĐ-06, QĐ-07

**QĐ-01 — Bộ mã chuẩn = Từ điển + 3 năng lực**
- Thêm CO7 Giao tiếp, CO8 Lập kế hoạch & Tổ chức, CO9 Hướng đến kết quả (`draft: true` → seed tạo phiên bản DRAFT, không ban hành).
- Bảng đối chiếu: COR01→CO7, COR03→CO8, COR02→CO9. Dòng tin cậy CAO trong yêu cầu vai trò: 84 → 103/141; không có tương đương: 12 → 1.

**QĐ-04 — AI soạn nháp, chuyên gia sửa**
- `3-du-lieu/ai_draft_indicators.json`: 195 ô dự thảo (45 NL × Mức 1,2,4,5 + CO7–CO9 × 5 mức).
- File mẫu mới: 5 cột mức, ô vàng có dự thảo gắn nhãn, sheet `02_Ban_goc_AI` để đối chiếu.
- `import:indicators`: từ chối ô còn nhãn; ghi vết `aiAcceptedVerbatim`; chỉ ghi mức thay đổi.
- Máy chủ trả 422 khi ban hành phiên bản còn nhãn dự thảo / ô giữ chỗ.

**QĐ-06 — 360°, 9-Box, IDP trên máy chủ**
- 9 bảng mới: AssessmentCampaign, AssessmentParticipant, AssessmentRater, AssessmentScore, TalentReview, IdpPlan, IdpGoal, IdpAction, IdpCheckIn.
- `src/routes/talent.ts`: chiến dịch, phiếu, nhập hộ phiếu CSV, kết quả có ẩn danh, 9-Box, IDP.
- Giao diện: `src/components/server/*` (TalentHub 6 tab). Ở chế độ Máy chủ, mục 360°/9-Box/Bản đồ nhiệt/Phân quyền mở TalentHub.

**QĐ-07 — Tài khoản HR + quản lý**
- `User.mustChangePassword`; máy chủ trả 428 tới khi đổi mật khẩu; chính sách mật khẩu tối thiểu.
- `src/routes/users.ts`: cấp lẻ, cấp hàng loạt cho quản lý, đặt lại mật khẩu, khoá.
- 6 quyền mới: assessment:manage, assessment:read_results, talent:review, idp:manage, idp:approve, user:manage.

**Sửa lỗi phát hiện khi kiểm thử trên PostgreSQL thật**
- CORS: `CORS_ORIGINS="*"` trước đây không hoạt động (thư viện coi "*" là một địa chỉ) → giao diện không kết nối được khi chưa đặt biến này.
- Các class `btn`, `btn-primary`, `btn-secondary` của bản AI Studio chưa từng được định nghĩa → nút hiện như chữ thường. Đã thêm.
- Từ điển: chọn năng lực chưa có bản ban hành từng hiện nhầm phiên bản của năng lực trước.
- `smoke.ts`: 15 → 19 mục.

## 14/10/2026 (lần 3) — Bàn duyệt, Bảng điều khiển, Kế thừa, Gói triển khai

**Bàn duyệt (HR)** — `src/routes/review.ts`, `components/server/ReviewDesk.tsx`
- Đối chiếu mã (QĐ-02): duyệt theo nhãn Sổ tay, áp cho mọi vai trò dùng nhãn; xuất CSV đúng định dạng file nguồn. `seed:job-architecture` không ghi đè dòng đã duyệt trên app.
- Chủ quản (QĐ-03): ô chọn điền sẵn phương án đề xuất. Gán chủ quản giờ chỉ dành cho người có quyền ban hành (HR_LEAD, ADMIN).
- Bản nháp chỉ báo (QĐ-04b): so từng mức với bản đang hiệu lực; ban hành; trả lại có lý do (nội dung lưu nhật ký).

**Bảng điều khiển** — `GET /api/dashboard`, `ServerDashboard.tsx`: số liệu thật theo phạm vi người xem; khối nào không có quyền thì ẩn.

**Kế thừa (QĐ-21)** — bảng SuccessionPlan, SuccessionCandidate; `src/routes/succession.ts`; tab Kế thừa. Gợi ý ứng viên từ 9-Box; hồ sơ ứng viên kèm ô 9-Box, 360° Lãnh đạo, tiến độ IDP; chỉ số bench strength.

**Gói triển khai**
- `4-tai-lieu/TRIEN_KHAI.md`: checklist Neon → Render → Cloudflare, khoá an toàn, vận hành định kỳ.
- `src/preflight.ts`: production từ chối khởi động nếu khoá JWT yếu / CORS để trống hoặc "*"; cảnh báo tài khoản mẫu còn mật khẩu mặc định.
- `npm run backup`: sao lưu JSON (không chứa mật khẩu, token).
- Cập nhật cấu trúc bằng `prisma db push` (render.yaml + hướng dẫn) thay cho `migrate` — đơn giản cho thí điểm.

**Sửa lỗi phát hiện khi kiểm thử**
- Lỗi trong hàm async làm **sập cả máy chủ** (Express 4) → thêm `express-async-errors`.
- Mất kết nối cơ sở dữ liệu bị báo nhầm "hết phiên đăng nhập" (401) → trả 503 đúng nghĩa.
- Ở chế độ Máy chủ ẩn công cụ chọn persona mô phỏng và khối lộ trình GĐ0–GĐ4 cũ.
