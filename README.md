# CompetencyAI — Bộ triển khai đầy đủ

Gói này chứa mọi thứ cần để chạy hệ thống. Đọc file này trước.

> **Bản 14/10/2026 (lần 3).** Thêm **Bàn duyệt (HR)** để gỡ QĐ-02/03/04b ngay trên app, **Bảng điều khiển** số liệu thật, **Kế hoạch kế thừa**, và **gói triển khai thật** (`4-tai-lieu/TRIEN_KHAI.md`, sao lưu, máy chủ tự từ chối khởi động khi cấu hình chưa an toàn). Nhật ký toàn dự án: `NHAT_KY_DU_AN.txt`.
>
> **Bản 14/10/2026 (lần 2).** Đã áp dụng 4 quyết định vừa chốt: **QĐ-01** thêm CO7–CO9 (bản nháp) · **QĐ-04** AI soạn nháp 195 ô chỉ báo để chuyên gia sửa · **QĐ-06** đưa 360°, 9-Box, IDP lên dữ liệu thật · **QĐ-07** tài khoản HR + quản lý, bắt đổi mật khẩu lần đầu. Đã kiểm thử trên **PostgreSQL thật**. Các việc còn phải chốt nằm trong `4-tai-lieu/QUYET_DINH_HOAN_THIEN.md`.

---

## Cấu trúc gói

```
CompetencyAI/
├── 1-backend/      Máy chủ API — Express + Prisma + PostgreSQL
├── 2-frontend/     Giao diện người dùng — React + Vite (nối được máy chủ, vẫn chạy Demo được)
├── 3-du-lieu/      Dữ liệu nạp vào hệ thống
├── 4-tai-lieu/     Hướng dẫn và tài liệu thiết kế
└── README.md       (file này)
```

---

## Ba lỗi đã sửa trong `2-frontend/`

Bản export gốc từ Google AI Studio có 3 lỗi. Tôi đã sửa và kiểm tra lại — `npx tsc --noEmit` **sạch 0 lỗi**, `npm run build` thành công.

| # | Lỗi | File | Đã sửa thế nào |
|---|---|---|---|
| 1 | Gõ nhầm `req.competencyCode` → đúng là `req.competency`, 5 chỗ | `src/components/SelfServiceHubView.tsx` | Sửa cả 5 chỗ. Màn hình "Đối chiếu năng lực bản thân" trước đây so sánh với `undefined`, hiển thị sai âm thầm |
| 2 | Render object vào JSX → crash trắng màn hình | `src/components/SelfServiceHubView.tsx:141` | Ép về chuỗi trước khi render |
| 3 | Xuất bản phiên bản không lưu trữ bản cũ, không cập nhật `currentVersionId` | `src/context/AppContext.tsx` | Viết lại `publishCompetencyVersion`: chuyển bản PUBLISHED cũ sang ARCHIVED + cập nhật con trỏ. Thêm trường `archivedAt` vào model |

Lỗi số 3 là vi phạm nguyên tắc versioning: xuất bản v2 xong mà cả v1 và v2 cùng mang trạng thái PUBLISHED.

---

## Thứ tự triển khai

### Bước 1 — Cơ sở dữ liệu (5 phút)

Vào `neon.com`, đăng ký bằng Google, **không cần thẻ**. Tạo project `competencyai`, chọn region Singapore. Copy chuỗi **Connection string**.

> Đừng dùng Postgres miễn phí của Render — nó **tự xoá sau 30 ngày**. Neon miễn phí vĩnh viễn.

### Bước 2 — Chạy backend

```bash
cd 1-backend
npm install
```

Tạo file `.env` (chép từ `.env.example`), điền `DATABASE_URL` từ Bước 1.

Sinh 2 chuỗi bí mật, chạy lệnh này 2 lần:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Dán vào `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET`.

```bash
npx prisma generate
npx prisma db push
npm run seed:all        # quyền, vai trò, 34 đơn vị, 57 năng lực, 14 họ nghề, 6 cấp, 26 vai trò
npm run dev
```

### Bước 3 — Kiểm tra mọi thứ hoạt động

Mở Terminal thứ hai:
```bash
cd 1-backend
npm run smoke
```

Kết quả mong đợi: **`ĐẠT — 19/19 mục kiểm tra thành công`**

> Muốn đưa lên mạng: làm theo **`4-tai-lieu/TRIEN_KHAI.md`** (checklist từng bước Neon → Render → Cloudflare, kèm các bước khoá an toàn).

Nếu có mục nào đỏ, đọc dòng giải thích bên dưới nó.

### Bước 4 — Nhập nhân sự

**Nhấp đúp `1-backend/web/import-console.html`.** Không cần gõ lệnh.

Bốn bước trên màn hình: Kết nối → Chọn file CSV → Xem kết quả kiểm tra → Ghi thật.

File mẫu: `3-du-lieu/mau_nhap_nhan_su.csv`

Nút "Ghi vào hệ thống" **tự khoá** khi còn dòng lỗi.

### Bước 5 — Chạy giao diện chính và nối máy chủ

```bash
cd 2-frontend
npm install
npm run dev
```

Mở `http://localhost:3000`. Ứng dụng mở ở chế độ **Demo** (nút vàng trên thanh tiêu đề).

Bấm nút **"Demo · Kết nối máy chủ"** → nhập địa chỉ máy chủ (`http://localhost:8080` khi chạy trên máy, hoặc địa chỉ Render) + email + mật khẩu → **Kết nối**. Nút chuyển sang màu xanh **"Máy chủ · email"** là đã dùng dữ liệu thật.

> Máy chủ phải cho phép địa chỉ giao diện: trong `.env` của backend, `CORS_ORIGINS=http://localhost:3000` (thêm địa chỉ Cloudflare Pages khi deploy, cách nhau bằng dấu phẩy).

### Bước 6 — Chuyên gia sửa dự thảo chỉ báo (QĐ-04)

1. Gửi `3-du-lieu/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx` cho đơn vị chủ quản. Mỗi ô vàng đã có **dự thảo AI**, gắn nhãn `[DỰ THẢO AI – CHƯA DUYỆT]`. Chuyên gia sửa nội dung, **xoá nhãn**, rồi đổi Trạng thái sang "Chờ duyệt".
2. Nhận lại file, chép vào `1-backend/templates/`, chạy thử:
   ```bash
   npm run import:indicators -- ./templates/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx
   ```
3. Hết lỗi thì ghi thật (thêm `--commit`). Hệ thống tạo **bản nháp**, bản đang hiệu lực không đổi. Ô còn nhãn bị từ chối. Ô chỉ xoá nhãn mà giữ nguyên chữ AI được ghi vết để HR biết.
4. Mở app → Từ điển năng lực → chọn bản DRAFT → rà soát → **Ban hành**. Máy chủ từ chối ban hành nếu còn ô mang nhãn dự thảo.

### Bước 7 — Cấp tài khoản và chạy 360° → 9-Box → IDP (QĐ-06, QĐ-07)

Đăng nhập bằng tài khoản Trưởng Ban NS. **Bảng điều khiển** hiện số liệu thật. Mục **Bàn duyệt (HR)** ở thanh bên trái dùng để duyệt đối chiếu mã, gán chủ quản, ban hành / trả lại bản nháp chỉ báo. Vào **Chiến dịch 360°** (thanh bên trái) để có 7 tab:

| Tab | Việc làm |
|---|---|
| **Kế thừa** | Thêm vị trí then chốt → "Gợi ý từ 9-Box" → chọn ứng viên, mức sẵn sàng, rủi ro mất người |
| **Tài khoản** | Bấm "Cấp hàng loạt cho quản lý" → Xem trước → Cấp. Tải file CSV mật khẩu tạm, gửi **riêng** cho từng người. Người nhận phải đổi mật khẩu ở lần đăng nhập đầu |
| **Chiến dịch 360°** | Tạo chiến dịch → Thêm người được đánh giá (mặc định: người có cấp dưới) → **Mở thu phiếu**. Phiếu của người chưa có tài khoản: nhập hộ bằng `3-du-lieu/mau_nhap_phieu_360.csv` |
| **Phiếu của tôi** | Quản lý tự đánh giá và chấm cho đồng nghiệp, cấp trên |
| **Kết quả 360°** | Sau khi **Đóng chiến dịch**: điểm theo nhóm, khoảng cách so với yêu cầu vai trò, điểm mù |
| **9-Box** | Xếp ô theo gợi ý Tiềm năng từ 360° + Hiệu suất từ ĐGNS → Chốt hiệu chỉnh |
| **IDP** | "Lập IDP từ 360°" → thêm hành động 70-20-10 → Gửi duyệt → quản lý trực tiếp phê duyệt |

### Đã cài bản trước? Nâng cấp thế này

```bash
cd 1-backend
npm install
npx prisma db push
npm run seed:all
```

---

## Deploy lên mạng (miễn phí)

| Thành phần | Nền tảng | Cần thẻ? |
|---|---|---|
| Database | Neon | Không |
| Backend | Render — Web Service Free | Không |
| Frontend | Cloudflare Pages | Không |

**Backend:** đẩy thư mục `1-backend` lên GitHub → Render đọc sẵn `render.yaml` → chỉ cần điền `DATABASE_URL` và `CORS_ORIGINS`.

**Frontend:** đẩy `2-frontend` lên GitHub → Cloudflare Pages → build command `npm run build`, output `dist`.

Lưu ý gói Render miễn phí: dịch vụ **ngủ sau 15 phút** không dùng, lần gọi đầu sau đó chờ 30–60 giây.

---

## Tài liệu trong `4-tai-lieu/`

| File | Nội dung |
|---|---|
| `QUYET_DINH_HOAN_THIEN.md` | **Sổ quyết định — đã chốt / còn mở, kèm phương án, ma trận phân quyền, lộ trình** |
| `TRIEN_KHAI.md` | **Checklist đưa lên mạng từng bước + khoá an toàn + vận hành định kỳ** |
| `HUONG_DAN.md` | Hướng dẫn chi tiết từng phần (cài đặt, nhập liệu, nối giao diện, nạp chỉ báo) |
| `HuongDan_NguoiKhongChuyenIT.md` | Dành cho người chưa từng gõ Terminal |
| `ARCHITECTURE.md` | Thiết kế cơ sở dữ liệu, ERD 5 miền |
| `Review_AI_Studio_Export.md` | Đánh giá kỹ thuật bản gốc, giải thích 3 lỗi đã sửa |
| `prototype-ui.html` | Bản mẫu giao diện, mở bằng trình duyệt |

---

## Dữ liệu trong `3-du-lieu/`

| File | Nội dung |
|---|---|
| `flamingo_seed_data.json` | 60 năng lực (57 đã ban hành + CO7–CO9 bản nháp), 34 đơn vị, 26 vai trò, 36 câu hỏi phỏng vấn |
| `Flamingo_TuDien_NangLuc.xlsx` | Từ điển năng lực bản Excel — dùng được ngay cho tuyển dụng |
| `Flamingo_SoTay_KhungNangLuc.xlsx` | Sổ tay giải thích khung năng lực cho toàn công ty |
| `mau_nhap_nhan_su.csv` | File mẫu nhập nhân sự |
| `Mau_ChiBao_ChuyenMon_Muc1-5.xlsx` | 48 năng lực (45 FU + CO7–CO9), dự thảo AI sẵn trong ô vàng, chuyên gia sửa và xoá nhãn |
| `ai_draft_indicators.json` | Bản gốc dự thảo AI (195 ô) — để đối chiếu, không nạp trực tiếp |
| `mau_nhap_phieu_360.csv` | Mẫu HR nhập hộ phiếu 360° cho người chưa có tài khoản |
| `doi_chieu_ma_nang_luc.csv` | Bảng đối chiếu mã Sổ tay → mã Từ điển (60 dòng, chờ duyệt) |

---

## Những điều cần biết trước khi dùng thật

**1. Đã kiểm tra những gì.** Toàn bộ backend đã chạy trên **PostgreSQL 16 thật** với dữ liệu giả lập: nạp dữ liệu nền, kiểm tra nhanh `npm run smoke` **19/19**, kịch bản 360° → 9-Box → IDP → tài khoản **46/46**, kịch bản Bàn duyệt → Kế thừa → Bảng điều khiển **29/29**, lệnh nạp chỉ báo, chặn ban hành dự thảo AI, sao lưu, máy chủ từ chối khởi động khi cấu hình production chưa an toàn, máy chủ không sập khi mất kết nối cơ sở dữ liệu. Giao diện đã chạy trên trình duyệt với máy chủ thật: đổi mật khẩu lần đầu → chấm phiếu → đóng chiến dịch → kết quả → 9-Box → IDP → tài khoản; tạo bản nháp → ban hành năng lực. Phiên bản Prisma dùng khi kiểm thử khác bản trong gói (do môi trường chặn tải engine), nên lần đầu chạy trên máy bạn, `npm run smoke` vẫn là phép thử cuối.

**2. Phân hệ nào đã là dữ liệu thật:** Bảng điều khiển · Bàn duyệt · Cơ cấu tổ chức · Từ điển năng lực & phiên bản · Job Architecture · Đánh giá 360° · 9-Box · Kế thừa · IDP · Tài khoản · Nhật ký. **Vẫn là minh họa:** Mô phỏng luân chuyển, Trợ lý AI.

**3. Yêu cầu năng lực của 26 vai trò vẫn ở trạng thái ĐỀ XUẤT** (QĐ-02). Sau QĐ-01: 103/141 dòng đối chiếu tin cậy cao, chỉ còn 1 dòng không có năng lực tương đương.

**4. 195 ô chỉ báo đang là dự thảo AI**, chưa có giá trị ban hành (QĐ-04b). **6 năng lực chưa có đơn vị chủ quản** (QĐ-03).

**5. Chưa nạp nhân sự thật trước khi có QĐ-10** (dữ liệu lưu ở máy chủ Singapore).
