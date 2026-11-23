# Triển khai CompetencyAI lên mạng — checklist từng bước

**Dành cho:** người phụ trách triển khai thí điểm (không cần là lập trình viên).
**Kết quả:** một địa chỉ web cho HR và quản lý đăng nhập, dữ liệu lưu trên cơ sở dữ liệu thật.
**Thời gian:** khoảng 60–90 phút cho lần đầu.

> ⚠ **Chặn trước khi nạp dữ liệu nhân sự thật:** QĐ-10 trong Sổ quyết định. Dữ liệu lưu ở máy chủ Singapore. Ban PC&KSNB phải xác nhận nghĩa vụ theo NĐ 13/2023 và Luật 91/2025/QH15 trước. Có thể triển khai và chạy thử với dữ liệu giả trong lúc chờ.

---

## 0. Chuẩn bị (10 phút)

| Việc | Ghi chú |
|---|---|
| Tài khoản **GitHub** | Đăng ký miễn phí tại github.com |
| Tài khoản **Neon** | neon.com — đăng nhập bằng Google, không cần thẻ |
| Tài khoản **Render** | render.com — đăng nhập bằng GitHub |
| Tài khoản **Cloudflare** | dash.cloudflare.com — cho phần giao diện |
| Máy tính đã cài **Node.js 20+** | nodejs.org → bản LTS |
| Giải nén `CompetencyAI.zip` | Ra thư mục `CompetencyAI/` |

---

## 1. Cơ sở dữ liệu — Neon (10 phút)

1. Neon → **New Project** → tên `competencyai` → Region **Singapore** → Create.
2. Màn hình Dashboard → **Connection string** → copy chuỗi bắt đầu bằng `postgresql://…`.
3. Cất chuỗi này ở nơi an toàn. **Không gửi qua chat nhóm, không dán vào tài liệu chung.**

> Đừng dùng Postgres miễn phí của Render — nó tự xoá sau 30 ngày.

---

## 2. Tạo bảng và nạp dữ liệu nền — chạy trên máy bạn (15 phút)

Mở Terminal ở thư mục `CompetencyAI/1-backend`:

```bash
npm install
```

Tạo file `.env` (chép từ `.env.example`) và điền:

```
DATABASE_URL=<chuỗi kết nối Neon ở bước 1>
SEED_PASSWORD=<mật khẩu riêng cho 4 tài khoản mẫu, ≥ 10 ký tự, có chữ và số>
```

Chạy lần lượt:

```bash
npx prisma generate
npx prisma db push          # tạo 33 bảng trên Neon
npm run seed:all            # quyền, vai trò, 34 đơn vị, 60 năng lực, Job Architecture
```

Kết quả mong đợi ở dòng cuối: `Job Family: 14 · Job Level: 6 · Job Role: 26`.

---

## 3. Máy chủ API — Render (15 phút)

1. Đẩy thư mục `1-backend` lên một repository GitHub **riêng tư** (private).
   - **Không** đẩy file `.env` (đã nằm trong `.gitignore`).
2. Render → **New** → **Blueprint** → chọn repository → Render đọc `render.yaml` sẵn có.
3. Điền biến môi trường khi Render hỏi:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `DATABASE_URL` | chuỗi Neon | |
| `CORS_ORIGINS` | địa chỉ giao diện ở bước 4, vd `https://competencyai.pages.dev` | **Bắt buộc**. Để trống hoặc `*` thì máy chủ **từ chối khởi động** |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Render tự sinh | Không sửa |
| `NODE_ENV` | `production` | Đã có sẵn |

4. Bấm **Apply**. Lần build đầu mất 3–5 phút.
5. Mở `https://<tên-dịch-vụ>.onrender.com/health` → phải thấy `{"status":"ok","db":"connected"}`.

**Máy chủ tự kiểm tra cấu hình khi khởi động.** Nếu log Render hiện `✖ KHÔNG KHỞI ĐỘNG: cấu hình production chưa an toàn`, đọc dòng ✖ bên dưới để biết thiếu gì.

> Chưa biết địa chỉ giao diện? Tạm điền `https://example.invalid` để máy chủ khởi động, làm bước 4, rồi quay lại sửa `CORS_ORIGINS`.

---

## 4. Giao diện — Cloudflare Pages (15 phút)

1. Đẩy thư mục `2-frontend` lên một repository GitHub riêng tư khác.
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repository.
3. Cấu hình build:

| Mục | Giá trị |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Biến môi trường `VITE_API_URL` | địa chỉ Render ở bước 3, **không** có `/api` ở cuối |

4. Deploy. Ghi lại địa chỉ dạng `https://<tên>.pages.dev`.
5. Quay lại Render → sửa `CORS_ORIGINS` thành đúng địa chỉ này → Render tự khởi động lại.

---

## 5. Kiểm tra sau triển khai (10 phút)

Trên máy bạn, thư mục `1-backend`:

```bash
SEED_PASSWORD=<mật khẩu ở bước 2> npm run smoke -- https://<tên-dịch-vụ>.onrender.com
```

Kết quả mong đợi: **`ĐẠT — 19/19`**.

Sau đó mở địa chỉ giao diện → **Kết nối máy chủ** → đăng nhập `hrlead@flamingo.vn`.

---

## 6. Khoá an toàn trước khi mở cho người dùng — BẮT BUỘC

| # | Việc | Cách làm |
|---|---|---|
| 1 | Tạo tài khoản thật cho Trưởng Ban NS | App → Chiến dịch 360° → tab **Tài khoản** → Cấp một tài khoản, vai trò HR_LEAD |
| 2 | **Khoá 4 tài khoản mẫu** (admin@, hrlead@, hrbp@, manager@flamingo.vn) | Tab Tài khoản → **Khoá**. Giữ admin@ nếu cần, nhưng đổi mật khẩu |
| 3 | Xác nhận log Render không còn cảnh báo `Tài khoản mẫu … còn mật khẩu mặc định` | Render → Logs |
| 4 | Ghi rõ ai giữ quyền ADMIN | QĐ-12 trong Sổ quyết định |
| 5 | Có xác nhận pháp lý QĐ-10 | Trước khi nạp nhân sự thật |

---

## 7. Vận hành định kỳ

| Tần suất | Việc | Lệnh / thao tác |
|---|---|---|
| Hằng tuần, và **trước mọi lần nạp dữ liệu lớn** | Sao lưu | `npm run backup`. File lưu trong `1-backend/backups/` (không có mật khẩu, nhưng **có dữ liệu cá nhân**: cất ở nơi có kiểm soát truy cập) |
| Khi đổi cấu trúc dữ liệu (cài bản mới) | Cập nhật bảng | Render tự chạy `prisma db push` khi khởi động. Nếu thay đổi có nguy cơ mất dữ liệu, lệnh **dừng lại** và máy chủ không khởi động; khi đó liên hệ người phụ trách kỹ thuật, **không** tự thêm cờ `--accept-data-loss` |
| Khi có người nghỉ việc | Khoá tài khoản | Tab Tài khoản → Khoá (phiên đăng nhập bị thu hồi ngay) |
| Khi quên mật khẩu | Đặt lại | Tab Tài khoản → Đặt lại MK → gửi riêng mật khẩu tạm |

---

## 8. Giới hạn của gói miễn phí

| Giới hạn | Ảnh hưởng | Khi nào nâng cấp |
|---|---|---|
| Render miễn phí **ngủ sau 15 phút** không dùng | Lần mở đầu chờ 30–60 giây (app có hiện đồng hồ đếm) | Khi mở chiến dịch 360° thật cho nhiều người (QĐ-11) |
| Dung lượng Neon miễn phí có hạn | Đủ cho thí điểm vài trăm nhân sự | Khi nạp toàn Tập đoàn |
| Không có tên miền riêng | Địa chỉ dạng `.pages.dev`, `.onrender.com` | Khi Ban CNTT tiếp nhận |

> Về cập nhật cấu trúc: gói thí điểm dùng `prisma db push` để người không chuyên không phải quản lý thư mục migration. Khi Ban CNTT tiếp nhận vận hành lâu dài, nên chuyển sang `prisma migrate` để có lịch sử thay đổi cấu trúc.
