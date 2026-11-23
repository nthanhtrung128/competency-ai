# CLAUDE.md — CompetencyAI (Tập đoàn Flamingo)

Claude Code đọc file này đầu tiên mỗi phiên. Lịch sử đầy đủ của dự án: `NHAT_KY_DU_AN.txt`. Thay đổi theo đợt: `CHANGELOG.md`. Quyết định còn mở: `4-tai-lieu/QUYET_DINH_HOAN_THIEN.md`.

## Người dùng & cách làm việc
- Chuyên viên Total Rewards, Ban Tổ chức Nhân sự (Ban TCNS) Tập đoàn Flamingo. **Không chuyên IT.**
- **Trả lời bằng tiếng Việt.** Thuật ngữ HR giữ tiếng Anh khi cần (Job Family, IDP, 9-Box…).
- Hướng dẫn kỹ thuật viết **từng bước** cho người không chuyên; không giả định họ biết terminal/git.
- Trước việc lớn: hỏi xác nhận hướng bằng câu hỏi lựa chọn, rồi tự làm tiếp.
- File đầu ra ghi đè đúng tên chuẩn (vd `CompetencyAI.zip`, `NHAT_KY_DU_AN.txt`).
- Sau mỗi đợt làm: **ghi nối vào mục 11 của `NHAT_KY_DU_AN.txt`** và thêm mục vào `CHANGELOG.md`.

## Nguyên tắc dữ liệu — bắt buộc
- Gắn nhãn **[SOURCE]** (tài liệu chính thức) / **[INFERENCE]** (suy luận) / **[PROPOSAL]** (đề xuất HR, chưa duyệt) / **[GAP]** (thiếu nguồn).
- **Không bịa** số liệu, đơn vị, nội dung chỉ báo. Thiếu thì ghi "[Mức n chưa có chỉ báo]", không điền câu chung chung.
- Không ghi đè nội dung đã rà soát; phần bổ sung phải phân biệt được. Bản đã ban hành **không sửa trực tiếp** — tạo bản nháp.
- Việc chờ phê duyệt dùng lời lẽ thận trọng.
- Cơ cấu đã chốt: **Ban KSNB đã gộp vào Ban Pháp chế → Ban PC&KSNB**; **Hội đồng Đầu tư đã bỏ**; tài sản giữ ở cấp Tập đoàn. FTV, FRT, VPCT chưa có breakdown [GAP].
- Dữ liệu nhân sự là dữ liệu cá nhân (NĐ 13/2023, Luật 91/2025/QH15): không nạp CCCD, tài khoản ngân hàng, lương, sức khoẻ. **Không commit dữ liệu nhân sự thật, file `.env`, thư mục `backups/`.**

## Cấu trúc kho
| Thư mục | Nội dung |
|---|---|
| `1-backend/` | API: Express 4 + TypeScript + Prisma 5 + PostgreSQL (33 bảng) |
| `2-frontend/` | Giao diện React + Vite (gốc từ Google AI Studio, đã sửa). Hai chế độ: **Demo** (localStorage) và **Máy chủ** (gọi API) |
| `3-du-lieu/` | `flamingo_seed_data.json` (dữ liệu chuẩn nạp app), Từ điển & Sổ tay (.xlsx), bảng đối chiếu mã, mẫu nhập |
| `4-tai-lieu/` | Sổ quyết định, hướng dẫn, `TRIEN_KHAI.md` (checklist deploy), kiến trúc, thiết kế GĐ0 |
| `5-khung-to-chuc/` | Sản phẩm phân tích: chuỗi giá trị (I1–I8, H1–H6, T1–T6), capability map 71 năng lực, operating model, RACI (.html/.xlsx/.pptx) |

## Lệnh thường dùng (`1-backend/`)
```bash
npm install
npx prisma generate
npx prisma db push          # tạo/cập nhật bảng (dùng db push, KHÔNG dùng migrate ở giai đoạn thí điểm)
npm run seed:all            # quyền, vai trò, 34 đơn vị, 60 năng lực, Job Architecture
npm run dev                 # máy chủ cổng 8080
npm run smoke               # kiểm tra nhanh — kỳ vọng ĐẠT 19/19
npm run import:indicators -- <file.xlsx> [--commit]
npm run backup
npx tsc --noEmit            # kiểm tra kiểu
```
Frontend (`2-frontend/`): `npm install && npm run dev` (cổng 3000) · `npx tsc --noEmit && npx vite build`.

Biến môi trường: xem `1-backend/.env.example`. Production (`NODE_ENV=production`) **từ chối khởi động** nếu JWT secret < 32 ký tự hoặc `CORS_ORIGINS` trống/`*` (`src/preflight.ts`).

## Kiến trúc backend — điểm cần nhớ
- Router: `routes/api.ts` (auth, org, employees, competencies, publish), `import.ts` (nhập nhân sự 2 bước), `framework.ts` (`/bootstrap`, bản nháp, owner, job roles), `talent.ts` (360°, 9-Box, IDP), `users.ts` (tài khoản), `review.ts` (Bàn duyệt), `succession.ts` (kế thừa), `dashboard.ts`.
- Quyền: `requirePermission(...)`; phạm vi dữ liệu: `resolveScope()` (theo đơn vị) và `visibleEmployeeIds()` (đơn vị + cấp dưới theo managerId). **Mọi endpoint đọc nhân sự phải lọc theo phạm vi.**
- Mọi thao tác ghi gọi `audit(...)`.
- Phiên bản năng lực: DRAFT → PUBLISHED → ARCHIVED; publish chạy trong transaction, cập nhật `currentVersionId`. Máy chủ trả **422** khi ban hành bản còn nhãn `[DỰ THẢO AI…]` hoặc `[Mức n chưa có…]`.
- Tài khoản mới / đặt lại: `mustChangePassword` → mọi API trả **428** tới khi đổi mật khẩu.
- 360°: chiến dịch chốt phiên bản năng lực khi mở (`snapshot`); ẩn điểm nhóm Đồng nghiệp/Cấp dưới khi < `minRatersForAnonymity` (mặc định 3).
- Express 4 + `express-async-errors` (bắt buộc giữ — thiếu nó một lỗi async làm sập máy chủ).

## Frontend — điểm cần nhớ
- `src/api/client.ts` (token trong sessionStorage, tự refresh), `src/api/serverAdapter.ts` (map `/bootstrap` → model giao diện, id dạng `comp-fu03`, `ver-fu03-v2`, `org-b01`).
- `src/context/AppContext.tsx`: `dataSource` DEMO/SERVER; ở SERVER không ghi localStorage; các mutator gọi API.
- Màn hình dữ liệu thật: `src/components/server/*` (TalentHub, ReviewDesk, ServerDashboard, Succession…).
- Màu thương hiệu Flamingo: navy `#154577`, cam `#F58A1F`.

## Hiện trạng (cập nhật 14/10/2026)
- Dữ liệu thật: Bảng điều khiển, Bàn duyệt, Tổ chức, Từ điển & phiên bản, Job Architecture, 360°, 9-Box, Kế thừa, IDP, Tài khoản, Nhật ký. **Còn minh họa:** Mô phỏng luân chuyển, Trợ lý AI.
- Từ điển 60 năng lực: CO1–CO9 (CO7–CO9 là **bản nháp** theo QĐ-01), LE1–LE6, FU01–FU45. Thang FLA-5. 195 ô chỉ báo đang là **dự thảo AI** chờ chuyên gia sửa (QĐ-04).
- Yêu cầu năng lực 26 vai trò: đối chiếu mã Sổ tay→Từ điển đang ở trạng thái **ĐỀ XUẤT** (QĐ-02).
- Kiểm thử gần nhất trên PostgreSQL 16 thật: smoke 19/19, kịch bản 360°→IDP 46/46, Bàn duyệt→Kế thừa→Dashboard 29/29. Các script kiểm thử đầu-cuối chưa nằm trong kho — nên viết lại thành `1-backend/tests/`.
- **Chưa deploy.** Chặn trước khi nạp nhân sự thật: QĐ-10 (pháp lý dữ liệu lưu ở Singapore).

## Việc tiếp theo gợi ý
1. Đưa bộ kiểm thử đầu-cuối vào kho (`tests/`, chạy bằng Postgres cục bộ hoặc Docker).
2. Triển khai theo `4-tai-lieu/TRIEN_KHAI.md`.
3. Hỗ trợ HR dùng Bàn duyệt để chốt QĐ-02, QĐ-03; nạp chỉ báo chuyên gia đã sửa.
4. Các quyết định còn mở: xem `4-tai-lieu/QUYET_DINH_HOAN_THIEN.md`.
