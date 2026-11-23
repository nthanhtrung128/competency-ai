# CompetencyAI — GĐ0 bàn giao

Bộ file này là **kết quả GĐ0** (Kiến trúc & Lược đồ) theo Master Prompt Phần B. Đúng nguyên tắc A.3: dừng lại nghiệm thu trước khi sang GĐ1.

```
CompetencyAI_GD0/
├── prisma/schema.prisma      836 dòng · 40 model · 14 enum
├── docs/ARCHITECTURE.md      ERD 5 miền + bảng đối chiếu 8 nguyên tắc B.5
├── prototype-ui.html         Bản mẫu giao diện — mở bằng trình duyệt, không cần cài gì
└── README.md
```

---

## 1. Mở bản mẫu giao diện ngay

Nhấp đúp `prototype-ui.html`. Không cần Node, không cần cài đặt.

Kiểm tra đúng chuẩn B.8: xanh #2563eb trên nền tint nhạt · sidebar nhãn eyebrow viết hoa · topbar có chip persona + nút Trợ lý AI · chuyển ngữ VI/EN · sáng/tối · badge màu theo loại.

**Duyệt bố cục này trước, rồi mới viết Next.js thật.** Sửa layout trên file HTML rẻ hơn sửa trên code React rất nhiều.

---

## 2. Khởi tạo dự án và nghiệm thu schema

```bash
# Tạo monorepo
mkdir competencyai && cd competencyai
npm init -y
npm pkg set workspaces[]="apps/*" workspaces[]="packages/*"
mkdir -p apps/web apps/api packages/db/prisma

# Đặt schema vào đúng chỗ
cp <đường-dẫn>/prisma/schema.prisma packages/db/prisma/schema.prisma

# Postgres bằng Docker
docker run -d --name capg -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=competencyai -p 5432:5432 postgres:15

cd packages/db
npm init -y && npm i -D prisma && npm i @prisma/client
echo 'DATABASE_URL="postgresql://postgres:dev@localhost:5432/competencyai"' > .env

# BA LỆNH NGHIỆM THU GĐ0
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```

**Nếu `prisma validate` báo lỗi:** sửa rồi mới đi tiếp. Xem mục 6 của `docs/ARCHITECTURE.md` — tôi không chạy được CLI Prisma trong môi trường dựng file này (mạng chặn `binaries.prisma.sh`), nên đã kiểm tra thay thế bằng script: 118/118 quan hệ có chiều ngược khớp tên. Đó là lỗi hay gặp nhất, nhưng CLI vẫn có thể bắt thêm lỗi cú pháp attribute.

---

## 3. Bổ sung ràng buộc tier (bắt buộc trước khi sang GĐ1)

Nguyên tắc B.5 số 2 yêu cầu `child.tier > parent.tier`. Prisma không diễn đạt được ràng buộc này, phải thêm trigger thủ công vào migration:

```sql
-- thêm vào cuối file migration init
CREATE OR REPLACE FUNCTION check_orgunit_tier() RETURNS TRIGGER AS $$
DECLARE parent_tier INT;
BEGIN
  IF NEW."parentId" IS NOT NULL THEN
    SELECT tier INTO parent_tier FROM "OrgUnit" WHERE id = NEW."parentId";
    IF NEW.tier <= parent_tier THEN
      RAISE EXCEPTION 'tier cua don vi con (%) phai lon hon tier cua don vi cha (%)', NEW.tier, parent_tier;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgunit_tier
  BEFORE INSERT OR UPDATE ON "OrgUnit"
  FOR EACH ROW EXECUTE FUNCTION check_orgunit_tier();
```

---

## 4. Prompt cho GĐ1 — dán vào Claude Code

```
Bối cảnh: Bạn đang tiếp tục dự án CompetencyAI. GĐ0 đã xong — schema Prisma
40 model nằm ở packages/db/prisma/schema.prisma, đã migrate thành công.

Nhiệm vụ GĐ1 — Xác thực, Phân quyền & Cơ cấu tổ chức. CHỈ làm GĐ1, không làm sang GĐ2.

Backend (apps/api — NestJS):
1. AuthModule: đăng nhập JWT access (15 phút) + refresh (7 ngày, lưu hash trong
   bảng RefreshToken), endpoint /auth/login, /auth/refresh, /auth/logout.
2. RbacGuard toàn cục: đọc Permission theo Role của user, decorator @RequirePermission('resource.action').
3. ScopeService: phân giải danh sách orgUnitId user được phép thấy từ bảng UserScope,
   có xử lý includeDescendants bằng truy vấn đệ quy.
4. OrgUnitModule: CRUD cây tổ chức. Bắt buộc kiểm tra child.tier > parent.tier ở
   service layer (trigger DB chỉ là lớp phòng thủ thứ hai). Endpoint GET /org-units/tree
   trả về cây theo thứ tự pre-order.
5. Bổ nhiệm/gỡ bổ nhiệm trưởng đơn vị (headEmployeeId). Cho phép để trống.
6. AuditInterceptor: mọi thao tác ghi đều tạo bản ghi AuditLog kèm before/after.

Seed (packages/db/seed.ts) — phải idempotent, chạy lại không nhân bản:
- 5 Role theo B.3, bộ Permission đầy đủ
- Cây tổ chức 3 tầng, khoảng 12 đơn vị, cố ý để 2 đơn vị KHÔNG có trưởng
- 5 user mẫu, mỗi persona một tài khoản

Frontend (apps/web — Next.js 14 App Router):
- Trang /login
- Layout chính theo đúng prototype-ui.html: topbar (logo, tagline, chip persona,
  nút chuyển ngữ VI/EN, nút Trợ lý AI) + sidebar nhóm menu có nhãn eyebrow viết hoa
- Trang /org: hiển thị cây tổ chức, badge tier, hiện "Chưa bổ nhiệm" khi thiếu trưởng đơn vị
- i18n VI/EN: mọi chuỗi hiển thị lấy từ file dịch, không hardcode

Ràng buộc:
- Mọi trường hiển thị đa ngữ lưu dạng Json { vi, en }
- Không sửa schema. Nếu thấy schema thiếu, DỪNG và báo tôi trước.

Khi xong: dừng lại, tóm tắt những gì đã làm, và cho tôi lệnh cụ thể để kiểm thử
(tsc --noEmit, nest build, curl gọi API, và URL để xem DOM). Chờ tôi duyệt.
```

---

## 5. Prompt rút gọn cho các giai đoạn sau

Giữ nguyên cấu trúc trên, đổi phần nhiệm vụ:

| Giai đoạn | Nội dung chính cần nêu trong prompt |
|---|---|
| **GĐ2** | Cây Factor → Cluster → Competency; luồng Draft → publish Active → archive (khi publish phải set `currentVersionId`, phiên bản cũ chuyển ARCHIVED, **không xoá**); chỉ báo hành vi theo mức; Skill Taxonomy dendrogram pan/zoom + xuất PNG/SVG |
| **GĐ3** | JobFamily/JobLevel với CareerLevel KF, `isManagerial` tự suy ở service không cho client đặt; bộ dựng Success Profile theo CompetencyRole; sinh JD lưu theo phiên bản; đo coverage theo từng đơn vị |
| **GĐ4** | Chiến dịch 360, rater assignment theo 5 quan hệ; nộp phiếu → tạo `CompetencyScoreSnapshot` (**insert mới, tuyệt đối không update bản cũ**); radar Target vs Actual; heatmap gap theo đơn vị |
| **GĐ5** | Lưới 9-box từ CalibrationSession; succession với readiness + flight risk; mô phỏng lộ trình A→B; IDP theo 70-20-10 |
| **GĐ6** | Dashboard coverage/bench strength/phân bố Factor; `AiService` trừu tượng với provider Gemini/Claude + **chế độ mock bắt buộc chạy được khi không có API key** |

---

## 6. Ba lỗi hay gặp nhất khi làm bài này

**Để AI làm một mạch cả sản phẩm.** Tài liệu nói rõ ở A.3 nhưng đây vẫn là lỗi phổ biến nhất. Khi lỗi xuất hiện ở GĐ4 mà GĐ1–3 chưa nghiệm thu, bạn không biết lỗi từ đâu.

**Ghi đè điểm cũ.** Rất dễ viết `prisma.snapshot.upsert()` cho tiện. Vi phạm thẳng nguyên tắc B.5 số 5, và rubric chấm 25% ở mô hình dữ liệu.

**Quên i18n khi thêm màn hình mới.** B.9 yêu cầu mọi thay đổi schema kèm cập nhật DTO + type + chuỗi VI/EN. Bỏ sót dần đến cuối sẽ phải rà lại toàn bộ.

---

## 7. Trạng thái so với rubric Phần C

| Tiêu chí | Trọng số | Trạng thái sau GĐ0 |
|---|---|---|
| Mô hình dữ liệu | 25% | Xong — chờ `prisma validate` xác nhận |
| Chức năng theo giai đoạn | 30% | GĐ0/7 |
| Chất lượng kỹ thuật | 20% | Chưa bắt đầu |
| Giao diện & trải nghiệm | 15% | Có bản mẫu chờ duyệt |
| Kỷ luật quy trình | 10% | Đang đúng — dừng nghiệm thu từng mốc |
