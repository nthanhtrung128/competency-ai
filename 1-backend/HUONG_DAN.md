# Hướng dẫn triển khai & nhập dữ liệu nhân sự

Dành cho người không chuyên IT. Làm theo đúng thứ tự, mỗi bước có cách kiểm tra đã đúng chưa.

---

## Phần 0 — Bạn đang có gì

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `prisma/schema.prisma` | 18 bảng dữ liệu | Đã kiểm tra 44 quan hệ khớp nhau |
| `src/` | Backend API bằng Express + TypeScript | **`tsc --noEmit` sạch, 0 lỗi** |
| `web/import-console.html` | **Màn hình nhập nhân sự — không cần gõ lệnh** | Mở bằng trình duyệt, chạy ngay |
| `src/smoke.ts` | Kiểm tra toàn hệ thống bằng 1 lệnh | Đã chạy thử, 13/13 đạt |
| `src/seed-competencies.ts` | Nạp 57 năng lực vào CSDL | Đọc từ `data/flamingo_seed_data.json` |
| `templates/mau_nhap_nhan_su.csv` | File mẫu nhập nhân sự, 10 dòng ví dụ | Mở bằng Excel được |
| `render.yaml` | Cấu hình deploy sẵn | Render tự đọc |

**Một điều cần biết trước:** tôi không chạy được `prisma generate` trong môi trường dựng file này (mạng bị chặn `binaries.prisma.sh`). Phần code TypeScript đã kiểm tra sạch bằng stub. Lệnh `npx prisma generate` phải chạy trên máy bạn — nếu báo lỗi, gửi nguyên đoạn lỗi cho tôi.

**Vì sao dùng Express thay vì NestJS như thiết kế GĐ0:** NestJS nặng hơn, khởi động chậm hơn — trên Render gói miễn phí (dịch vụ ngủ sau 15 phút, phải khởi động lại), NestJS làm lần gọi đầu chờ lâu hơn đáng kể. Express đủ cho quy mô này và ít file hơn nhiều, dễ đọc với người mới. Nếu bạn cần đúng NestJS cho bài nộp, báo tôi chuyển lại.

---

## Phần 0b — Đường tắt: ba lệnh và một cú nhấp

Nếu chỉ muốn dùng ngay, làm đúng bốn việc này:

```bash
npm install && npx prisma generate && npx prisma db push
npm run seed:all                                          # quyền, vai trò, 34 đơn vị, 57 năng lực, Job Architecture
npm run dev                                               # chạy máy chủ
```

Mở tab Terminal thứ hai, kiểm tra mọi thứ hoạt động:
```bash
npm run smoke
```

Kết quả mong đợi: `ĐẠT — 19/19 mục kiểm tra thành công`

Sau đó **nhấp đúp vào `web/import-console.html`** để nhập nhân sự bằng giao diện, không cần gõ lệnh nữa.


---

## Phần 1 — Tạo cơ sở dữ liệu (Neon, miễn phí vĩnh viễn)

1. Vào `neon.com`, đăng ký bằng tài khoản Google. **Không cần thẻ tín dụng.**
2. Bấm **Create project**, đặt tên `competencyai`, chọn region gần nhất (Singapore).
3. Xong sẽ thấy dòng **Connection string** dạng:
   ```
   postgresql://user:xxxx@ep-abc-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Copy và lưu lại** — đây là `DATABASE_URL`.

> Vì sao Neon chứ không dùng Postgres của Render: Postgres miễn phí của Render **tự xoá sau 30 ngày**. Neon miễn phí vĩnh viễn, 0.5 GB — thừa cho 1.307 nhân sự.

---

## Phần 2 — Chạy thử trên máy trước khi deploy

Mở Terminal (Mac) hoặc PowerShell (Windows) tại thư mục dự án:

```bash
npm install
```

Tạo file `.env` (chép từ `.env.example`), điền `DATABASE_URL` vừa lấy ở Phần 1.

Sinh hai chuỗi bí mật:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Chạy hai lần, dán vào `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`.

Tạo bảng và nạp dữ liệu nền:
```bash
npx prisma generate
npx prisma db push
npm run seed
```

Kết quả mong đợi:
```
▸ Xong: { quyen: 10, vaiTro: 5, donVi: 34, taiKhoan: 4, nhanSu: 0 }
▸ Mật khẩu các tài khoản mẫu: Flamingo@2026
```

`nhanSu: 0` là **đúng** — seed cố ý không tạo nhân sự giả. Nhân sự thật nhập ở Phần 4.

Chạy server:
```bash
npm run dev
```

Kiểm tra ở trình duyệt: `http://localhost:8080/health` → phải thấy `{"status":"ok","db":"connected"}`

---

## Phần 3 — Kiểm tra phân quyền có thật sự chặn không

Đây là thứ bản AI Studio **chưa có** — persona chỉ đổi nhãn, không chặn dữ liệu.

Đăng nhập bằng tài khoản HRBP (chỉ được xem Khối Kinh doanh):
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hrbp@flamingo.vn","password":"Flamingo@2026"}'
```

Lấy `accessToken` trong kết quả, rồi gọi:
```bash
curl http://localhost:8080/api/org-units \
  -H "Authorization: Bearer <dán_accessToken_vào_đây>"
```

**Kết quả đúng:** chỉ thấy K2 và các Ban con (B05, B06, B07, FTV, FRT) — **không thấy** K1 hay K3.

Thử tài khoản `admin@flamingo.vn` sẽ thấy đủ 18 đơn vị. Đó là phân quyền thật, không phải nhãn hiển thị.

---

## Phần 4 — Nhập dữ liệu nhân sự thật

### 4.1 Chuẩn bị file

Mở `templates/mau_nhap_nhan_su.csv` bằng Excel. Xoá 10 dòng mẫu, điền dữ liệu thật của bạn.

| Cột | Bắt buộc | Ghi chú |
|---|---|---|
| `employee_code` | **Có** | Mã nhân viên, không trùng nhau |
| `full_name` | **Có** | Họ tên đầy đủ |
| `org_unit_code` | **Có** | Mã đơn vị — phải khớp mã đã có (FLA, K1, B01...) |
| `email` | Không | Nếu điền phải hợp lệ và không trùng người khác |
| `manager_code` | Không | Mã nhân viên của người quản lý |
| `hire_date` | Không | Dạng `dd/mm/yyyy` |
| `status` | Không | `Đang làm việc` / `Nghỉ phép` / `Đã nghỉ việc` |
| `phone`, `job_title`, `job_role_code`, `job_level_code`, `grade_code` | Không | |

**Khi lưu từ Excel:** chọn **CSV UTF-8 (Comma delimited)**. Chọn sai định dạng thì tiếng Việt sẽ thành ký tự lạ.

### 4.2 Nhập bằng giao diện — cách khuyến nghị

**Nhấp đúp vào `web/import-console.html`.** Không cần cài gì, không cần gõ lệnh.

1. **Kết nối** — điền địa chỉ máy chủ (để nguyên `http://localhost:8080` nếu chạy trên máy) và đăng nhập bằng tài khoản Trưởng Ban Nhân sự.
2. **Chọn file** — kéo thả file CSV vào ô, hoặc bấm để chọn.
3. **Kiểm tra** — màn hình hiện 5 con số: tổng dòng, hợp lệ, cảnh báo, lỗi, sẽ tạo mới. Có tab riêng để xem từng nhóm dòng lỗi kèm lý do cụ thể.
4. **Ghi thật** — nút này **tự khoá** nếu còn dòng lỗi. Chỉ mở khi file sạch.

Màn hình tự chặn ba tình huống dễ sai: tải nhầm file không phải CSV, dùng tài khoản không có quyền `employee:import`, và bấm ghi khi còn lỗi.

### 4.3 Nhập bằng dòng lệnh — nếu cần tự động hóa

Bước kiểm tra (chưa ghi gì):
```bash
curl -X POST http://localhost:8080/api/import/employees/validate \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@duong-dan-toi-file.csv"
```

Xem chi tiết dòng lỗi:
```bash
curl "http://localhost:8080/api/import/employees/<batchId>/rows?status=ERROR" \
  -H "Authorization: Bearer <accessToken>"
```

Ghi thật (chỉ chạy khi `loi: 0`):
```bash
curl -X POST http://localhost:8080/api/import/employees/<batchId>/commit \
  -H "Authorization: Bearer <accessToken>"
```

Hệ thống kiểm tra 7 loại lỗi:
1. Thiếu mã nhân viên hoặc họ tên
2. Mã nhân viên bị lặp trong chính file
3. Mã đơn vị không tồn tại
4. Email sai định dạng
5. Email đã thuộc về người khác
6. Nhân viên là quản lý của chính mình
7. Ngày vào làm không đọc được

**Ba điều hệ thống tự làm đúng:**
- Chạy trong transaction — hỏng giữa chừng thì hoàn tác toàn bộ, không để dữ liệu dở dang
- Gán quản lý ở **vòng thứ hai**, sau khi mọi người đã tồn tại — nên thứ tự dòng trong file không quan trọng
- Đổi đơn vị thì tạo bản ghi lịch sử mới, **không xoá bản ghi cũ** — tra được quá khứ điều chuyển

Một lô đã ghi thì **không ghi lại lần hai** được (trả lỗi 409), tránh nhân đôi dữ liệu do bấm nhầm.

---

## Phần 5 — Deploy lên Render (miễn phí)

1. Đẩy code lên GitHub (repo riêng tư)
2. Vào `render.com`, đăng ký — **không cần thẻ**
3. **New → Web Service** → chọn repo
4. Render tự đọc `render.yaml`, chỉ cần điền 2 biến:
   - `DATABASE_URL` — chuỗi Neon ở Phần 1
   - `CORS_ORIGINS` — địa chỉ frontend, ví dụ `https://competencyai.pages.dev`
5. Bấm **Create Web Service**, chờ 3–5 phút

Kiểm tra: mở `https://<tên-app>.onrender.com/health`

**Hai điều cần biết về gói miễn phí:**
- Dịch vụ **ngủ sau 15 phút** không ai dùng. Lần gọi đầu sau đó chờ **30–60 giây**. Với tool nội bộ thì chấp nhận được; nếu khó chịu thì $7/tháng là hết ngủ.
- 750 giờ/tháng cho toàn workspace — một dịch vụ chạy liên tục cả tháng vừa đủ.

---

## Phần 6 — Nối giao diện (2-frontend) với máy chủ

**Đã làm sẵn — không cần sửa code.**

1. Trong `.env` của backend, cho phép địa chỉ giao diện:
   ```
   CORS_ORIGINS=http://localhost:3000,https://<tên-app>.pages.dev
   ```
2. (Tuỳ chọn) Trong `2-frontend/.env`, điền `VITE_API_URL=<địa chỉ máy chủ>` để ô địa chỉ được điền sẵn.
3. Mở giao diện → bấm nút vàng **"Demo · Kết nối máy chủ"** → nhập địa chỉ, email, mật khẩu → **Kết nối**.

Khi đã kết nối:

| Thao tác trên giao diện | Gọi máy chủ | Quyền cần có |
|---|---|---|
| Mở app / Tải lại dữ liệu | `GET /api/bootstrap` | `competency:read` |
| Tạo bản sửa đổi năng lực | `POST /api/competencies/:id/versions` | `competency:author` |
| Lưu chỉ báo trên bản nháp | `PATCH /api/competency-versions/:id` (chỉ DRAFT) | `competency:author` |
| Ban hành | `POST /api/competency-versions/:id/publish` | `competency:publish` |
| Gán đơn vị chủ quản | `PATCH /api/competencies/:id/owner` | `competency:author` |
| Lưu ma trận năng lực của vai trò | `PUT /api/job-roles/:code/requirements` → trạng thái APPROVED | `competency:publish` |
| Thêm đơn vị | `POST /api/org-units` | `org:manage` |

Không đủ quyền → máy chủ trả 403 và giao diện hiện thông báo đỏ. Phiên đăng nhập lưu trong tab; đóng tab là phải đăng nhập lại. **Ngắt · về Demo** trả lại nguyên dữ liệu Demo.

### 6.1 Nạp chỉ báo hành vi do chuyên gia viết

```bash
npm run import:indicators -- ./templates/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx            # chạy thử
npm run import:indicators -- ./templates/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx --commit   # ghi thật
```

Lệnh kiểm tra: mã có tồn tại không, có trùng không, câu quá ngắn (dưới 15 ký tự), có nhãn tự sinh không, hai mức có trùng chữ không. Còn lỗi thì **không ghi gì**. Dòng có Trạng thái "Đang viết" được bỏ qua.

### 6.1b Bản nháp AI (QĐ-04)

File mẫu đã có dự thảo AI trong mọi ô vàng, gắn nhãn `[DỰ THẢO AI – CHƯA DUYỆT]`. Chuyên gia **sửa nội dung rồi xoá nhãn**. Lệnh nạp:
- **Từ chối** ô còn nhãn.
- **Ghi vết** ô chỉ xoá nhãn mà giữ nguyên chữ AI (`aiAcceptedVerbatim`), để HR rà soát.
- Chỉ ghi các mức thực sự thay đổi.

Máy chủ cũng từ chối **ban hành** phiên bản còn nhãn dự thảo (mã lỗi 422).

### 6.2 Duyệt bảng đối chiếu mã năng lực

Mở `data/doi_chieu_ma_nang_luc.csv` bằng Excel. Dòng nào đồng ý thì đổi cột `trang_thai` thành `DA_DUYET`; dòng nào cần đổi mã thì sửa cột `ma_tu_dien`. Lưu lại (giữ định dạng CSV UTF-8), rồi chạy:
```bash
npm run seed:job-architecture
```
Vai trò đã được duyệt trực tiếp trên app sẽ **không** bị ghi đè.

---

## Phần 6b — Tài khoản, 360°, 9-Box, IDP (QĐ-06, QĐ-07)

**Tài khoản (thí điểm: HR + quản lý).** `POST /api/users/provision-managers` (gửi `{"commit": true}` để cấp thật) cấp tài khoản LINE_MANAGER cho mọi nhân sự có cấp dưới hoặc là trưởng đơn vị, có email và chưa có tài khoản. Phạm vi dữ liệu = đơn vị của họ. Mật khẩu tạm trả về **một lần**. Lần đăng nhập đầu, máy chủ trả mã 428 cho mọi chức năng cho tới khi gọi `POST /api/auth/change-password`. Chính sách mật khẩu: tối thiểu 10 ký tự, có chữ và số.

**360°.**
| Bước | Endpoint |
|---|---|
| Tạo chiến dịch (mặc định 12 NL Cốt lõi + Lãnh đạo đã ban hành) | `POST /api/campaigns` |
| Thêm người được đánh giá, tự sinh người đánh giá | `POST /api/campaigns/:id/participants` |
| Mở (chốt phiên bản năng lực) / Đóng | `POST /api/campaigns/:id/open` · `/close` |
| Phiếu của tôi / chấm phiếu | `GET /api/my/rater-tasks` · `GET`/`PUT /api/rater-tasks/:id` |
| HR nhập hộ phiếu (CSV, `?commit=1` để ghi) | `POST /api/campaigns/:id/import-responses` |
| Kết quả một người / tổng hợp | `GET /api/campaigns/:id/results/:employeeId` · `/summary` |

**9-Box:** `GET /api/talent-reviews?cycle=2026` · `PUT /api/talent-reviews` · `POST /api/talent-reviews/calibrate`.

**IDP:** `POST /api/idp/from-assessment` · `POST /api/idp/:id/goals` · `POST /api/idp-goals/:id/actions` · `PATCH /api/idp-actions/:id` · `POST /api/idp/:id/submit` · `/approve` · `/status` · `/check-ins`.

**Nâng cấp từ bản trước:**
```bash
npm install
npx prisma db push
npm run seed:all
```

---

## Phần 7 — Nghĩa vụ pháp lý khi xử lý dữ liệu nhân sự thật

Dữ liệu nhân sự là **dữ liệu cá nhân** theo Nghị định 13/2023/NĐ-CP. Ba việc tối thiểu:

1. **Thông báo cho nhân viên** trước khi đưa dữ liệu vào hệ thống — mục đích, phạm vi, ai được xem.
2. **Giới hạn người xem** — hệ thống đã hỗ trợ sẵn qua `UserScope`. Đừng cấp `org:read_all` cho ai không thực sự cần.
3. **Lưu nhật ký truy cập** — đã có sẵn bảng `audit_logs`, ghi tự động mọi thao tác ghi.

Không đưa số CMND/CCCD, số tài khoản ngân hàng, thông tin sức khoẻ vào file nhập nếu hệ thống chưa cần đến — đây là nhóm dữ liệu nhạy cảm, yêu cầu bảo vệ chặt hơn.

Phiếu đánh giá 360°, kết quả 9-Box và IDP cũng là **dữ liệu cá nhân**. Máy chủ Neon/Render đặt ở Singapore. Trước khi nạp dữ liệu thật, cần Ban PC&KSNB xác nhận nghĩa vụ theo NĐ 13/2023 và Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026). Xem QĐ-10 trong Sổ quyết định.

---

## Phần 8 — Khi gặp lỗi

Không cần hiểu lỗi. Chép **toàn bộ chữ đỏ** trong Terminal, gửi kèm câu: *"Tôi gặp lỗi này khi chạy [tên lệnh]."*

Ba lỗi hay gặp nhất:

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `Can't reach database server` | `DATABASE_URL` sai hoặc thiếu `?sslmode=require` | Copy lại chuỗi từ Neon |
| `Mã đơn vị "XXX" không có trong hệ thống` | File CSV dùng mã đơn vị chưa tạo | Tạo đơn vị trước, hoặc sửa mã trong file |
| Tiếng Việt thành `Nguyá»…n VÄƒn` | Lưu CSV sai định dạng | Lưu lại bằng **CSV UTF-8** |
