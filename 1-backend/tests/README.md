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
- Tài khoản mẫu `admin@` / `hrlead@` còn mật khẩu mặc định `SEED_PASSWORD` (mặc định `Flamingo@2026`).
- Đơn vị `B01` tồn tại; Từ điển có ≥ 2 năng lực Cốt lõi và ≥ 2 Lãnh đạo đã ban hành và có thang điểm.
- Quyền theo vai trò đúng như `src/seed.ts` (vd LINE_MANAGER có `idp:approve`, HRBP không có `assessment:manage`).

## Chưa bao phủ

- Ban hành thật một phiên bản năng lực (không hoàn tác được) — đã có kiểm tra 422 và 409 quanh nó.
- Nhập nhân sự 2 bước (`src/routes/import.ts`) và nhập chỉ báo từ Excel (`npm run import:indicators`).
- Giao diện (`2-frontend`).

## Kiểm thử giao diện / build (`2-frontend/`)

Phần này **không cần PostgreSQL hay máy chủ** — chạy hoàn toàn trên máy, mạng được giả lập.
Mở terminal trong thư mục `2-frontend` và chạy:

```bash
npm install
npm run test:ui      # chỉ chạy test (vitest) — 24 mục
npm run check:ui     # đủ bộ: tsc --noEmit  →  vite build  →  test
```

| File (`2-frontend/tests/`) | Kiểm tra gì | Số mục |
|---|---|---|
| `serverAdapter.test.ts` | `mapBootstrap` (id `comp-fu03` / `ver-fu03-v2` / `org-b01` + uuid thật trong `serverIds`; thang FLA-5; cha ngoài phạm vi thành gốc; mức chưa có chỉ báo ghi "[Mức n chưa có…]"), `anchorsToIndicators` (bỏ ô giữ chỗ), `mapAuditLogs` | 9 |
| `client.test.ts` | `login` (email chữ thường, lưu phiên), `api()` (Bearer, 401 → tự refresh đúng một lần, refresh hỏng → xoá phiên, 403/428/422/500), `wakeServer`, và kết quả 360° có điểm nhóm bị ẩn được chuyển nguyên vẹn | 15 |

Lưu ý phạm vi — nói thẳng để khỏi hiểu nhầm:
- **Ẩn danh 360° do máy chủ quyết định** (`minRatersForAnonymity`, đã nằm trong kịch bản đầu-cuối 134 mục). Lớp `serverAdapter`/`client` không tự tính ẩn danh; test chỉ chứng minh giao diện **không làm lộ lại** điểm nhóm bị ẩn (giá trị `null` và `hiddenGroups` đi qua nguyên vẹn).
- Chưa có test cho việc vẽ màn hình (`components/`), `AppContext`, hay nhập Excel.
- Build còn cảnh báo "chunk > 500 kB" (không phải lỗi, chưa xử lý).
