# Bộ kiểm thử đầu-cuối (tests/)

Hai kịch bản chạy trên **PostgreSQL thật** qua HTTP, đúng như giao diện gọi API:

| File | Kiểm tra gì | Số mục |
|---|---|---|
| `e2e-360-idp.ts` | Cấp tài khoản + đổi mật khẩu bắt buộc → chiến dịch 360° (nhập phiếu trên app và HR nhập hộ, ẩn danh) → 9-Box → IDP (gap → mục tiêu 70-20-10 → duyệt → hoàn thành) → nhật ký | 134 |
| `e2e-review-succession.ts` | Bàn duyệt (đối chiếu mã QĐ-02, chủ quản QĐ-03, bản nháp chỉ báo QĐ-04b) → Kế hoạch kế thừa → Bảng điều khiển theo phạm vi | 73 |

Lần chạy gần nhất (23/11/2026, PostgreSQL 18 tạm trên Windows): **134/134 và 73/73**.
Kịch bản cũ 46/46 + 29/29 (14/10/2026) chưa nằm trong kho; hai file này viết lại và mở rộng nó, bám mã nguồn hiện tại.

## An toàn dữ liệu

- Kịch bản **ghi rồi xoá** dữ liệu thử: nhân sự mã `T360-…` / `TREV-…`, email `…@test.invalid`, chiến dịch, IDP, kế hoạch kế thừa, vai trò `TREV-R1`. Chạy xong (kể cả khi lỗi) tự dọn.
- **Không ban hành thật** phiên bản năng lực nào. Chỉ thử phần chặn (422), tạo bản nháp rồi trả lại.
- Công cụ **từ chối chạy** nếu `DATABASE_URL` hoặc `API_URL` không phải máy cục bộ — để không lỡ chạy lên CSDL thật có nhân sự thật. Nếu là CSDL **riêng cho thử nghiệm** (vd nhánh Neon tách riêng), đặt `ALLOW_REMOTE_TEST_DB=1`.
- Dùng một CSDL **trống** dành cho kiểm thử, không dùng CSDL thí điểm.

## Cách chạy — từng bước

### Bước 1 · Có một PostgreSQL cục bộ

Cách dễ nhất là Docker Desktop. Mở terminal trong thư mục `1-backend` và chạy:

```powershell
docker compose -f tests/docker-compose.test.yml up -d
```

(Cách khác: tự cài PostgreSQL 16 và tạo CSDL tên `competency_test`, mã hoá UTF8.)

### Bước 2 · Trỏ vào CSDL thử và nạp dữ liệu mẫu (chỉ làm một lần)

```powershell
$env:SEED_PASSWORD = "<mật khẩu riêng cho lần chạy thử>"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:54329/competency_test"
npm install
npx prisma db push
npm run seed:all
```

Lệnh `$env:DATABASE_URL` chỉ có tác dụng trong cửa sổ terminal đó; mở cửa sổ mới thì đặt lại. Không cần tạo file `.env`.

### Bước 3 · Chạy kiểm thử

```powershell
npm test
```

`npm test` tự bật máy chủ thử ở cổng 8099, chạy cả hai kịch bản, rồi tắt máy chủ. Kết quả cuối phải là **TẤT CẢ KỊCH BẢN ĐẠT**.

Chạy riêng từng kịch bản (cần máy chủ đang chạy, đặt `API_URL` trỏ tới nó):

```powershell
$env:API_URL = "http://localhost:8080"
npm run test:360
npm run test:review
```

Kiểm tra kiểu cho chính bộ test: `npm run lint:tests`.

### Bước 4 · Tắt CSDL thử khi xong

```powershell
docker compose -f tests/docker-compose.test.yml down
```

## Khi có mục ✗

Dòng đỏ ghi rõ mã HTTP thực tế và phần đầu của phản hồi. Nếu kịch bản dừng giữa chừng, lần chạy sau tự dọn dữ liệu thử còn sót lại.

Giả định của kịch bản (nếu đổi thiết kế thì sửa test cho khớp):
- Tài khoản mẫu `admin@` / `hrlead@` còn mật khẩu mặc định `SEED_PASSWORD` đã đặt lúc seed.
- Đơn vị `B01` tồn tại; Từ điển có ≥ 2 năng lực Cốt lõi và ≥ 2 Lãnh đạo đã ban hành và có thang điểm.
- Quyền theo vai trò đúng như `src/seed.ts` (vd LINE_MANAGER có `idp:approve`, HRBP không có `assessment:manage`).

## Chưa bao phủ

- Ban hành thật một phiên bản năng lực (không hoàn tác được) — đã có kiểm tra 422 và 409 quanh nó.
- Nhập nhân sự 2 bước (`src/routes/import.ts`) và nhập chỉ báo từ Excel (`npm run import:indicators`).
- Giao diện (`2-frontend`).

## Kiểm thử cổng nhiều công ty

Chuẩn bị hai cơ sở dữ liệu PostgreSQL cục bộ trống dành riêng cho lần thử. Đặt `WORKSPACES_JSON` với đúng hai mục có mã kích hoạt như hướng dẫn cổng doanh nghiệp. Trong thư mục backend, chạy `npm run build`, `node dist/prepare-workspaces.js` rồi khởi động `node dist/index.js`. Trong terminal thứ hai với cùng cấu hình, đặt `PORTAL_TEST_URL` trỏ tới địa chỉ máy chủ cục bộ và chạy `node --test tests/company-portal.mjs`. Bài kiểm thử kích hoạt hai cơ sở dữ liệu, giữ dữ liệu để kiểm tra. Mỗi lần chạy lại cần một cặp cơ sở dữ liệu thử trống mới.

Kiểm thử giao diện dùng một công ty cục bộ thứ ba chưa kích hoạt trên cùng dịch vụ. Đặt `BROWSER_TEST_COMPANY` bằng mã công ty đó, giữ `WORKSPACES_JSON` của máy chủ và `PORTAL_TEST_URL` trong terminal. Trong `2-frontend`, chạy `npm ci`, cài Chromium bằng `npx playwright-core install chromium` (hoặc đặt `CHROMIUM_PATH` tới trình duyệt đã cài), sau đó chạy `npm run test:portal`. Kiểm tra bao gồm nhập CSV, cấp tài khoản qua giao diện và đổi mật khẩu tạm sau khi tải lại trang.
