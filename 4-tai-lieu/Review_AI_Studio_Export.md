# Review kỹ thuật — Bản export từ Google AI Studio (WIP)

> Đã cài `npm install`, chạy `npx tsc --noEmit`, `npm run build`, và đọc trực tiếp mã nguồn — không đánh giá qua ảnh chụp màn hình. Mọi phát hiện dưới đây đều trỏ tới file và dòng cụ thể.

## Tóm tắt một câu

Đây là một **bản mẫu giao diện chạy hoàn toàn trên trình duyệt**, dữ liệu lưu ở `localStorage` — không phải phần mềm nhiều người dùng đã có backend như thiết kế GĐ0. Chất lượng giao diện và độ trung thực dữ liệu tốt hơn kỳ vọng, nhưng có **2 lỗi biên dịch thật** và **1 lỗi làm sai lệch chính nguyên tắc versioning** đã thống nhất từ đầu.

---

## 1. Điểm cộng — làm đúng hơn mong đợi

**Đã dùng đúng `flamingo_seed_data.json` và đúng thứ tự nạp tôi yêu cầu.** Xem comment ở đầu `flamingoAdapter.ts`:
```
* 1. proficiencyScale (FLA-5)
* 2. competencyCategories ...
* 8. jobRoles (26 roles with mapped requirements)
```
Đúng 8 bước tôi ghi trong prompt trước. Cờ `hasOwner` và `dataGap` (6 năng lực chưa có chủ sở hữu) cũng được giữ nguyên, không bị lược bỏ.

**Vài chỗ thiết kế lại còn tốt hơn schema gốc của tôi:**
- `ScopeAccessLevel` (READ/WRITE/APPROVE/ADMIN) chi tiết hơn `includeDescendants: Boolean` tôi từng viết.
- `OrgUnit.path` (materialized path) — tối ưu truy vấn cây mà schema GĐ0 chưa có.
- `UserScope.expiresAt` — ủy quyền tạm thời, một tình huống thực tế tôi bỏ sót.
- `AuditLog.diff` tách riêng khỏi `oldValues`/`newValues` — dễ hiển thị hơn.

**Trung thực về phạm vi.** Tên file có "WIP", `dataWarnings` được giữ và hiển thị chứ không giấu đi.

---

## 2. Lỗi biên dịch thật — `npx tsc --noEmit` KHÔNG pass

Đây là tiêu chí nghiệm thu tôi đặt ra từ GĐ0 (`npm run lint` chính là lệnh này). Chạy thật ra:

```
src/components/SelfServiceHubView.tsx(119,60): error TS2551:
  Property 'competencyCode' does not exist on type 'JobRoleRequirement'. Did you mean 'competency'?
```
Lặp lại ở dòng 119, 130, 139, 140, 179 — **5 chỗ cùng một lỗi chính tả tên trường**.

**Hậu quả không chỉ là lỗi biên dịch.** Tính năng "Đối chiếu năng lực bản thân" — màn hình nhân viên tự xem mình còn thiếu năng lực gì so với vai trò — đang so sánh với `undefined` vì trường đúng tên là `req.competency`, không phải `req.competencyCode`. Với TypeScript bị bỏ qua lúc chạy dev (Vite dùng esbuild, không kiểm tra kiểu), tính năng này **âm thầm hiển thị sai** thay vì báo lỗi.

**Lỗi thứ hai nghiêm trọng hơn — sẽ crash khi chạy:**
```
src/components/SelfServiceHubView.tsx(715,74): error TS2322:
  Type 'string | CompetencyCategoryModel' is not assignable to type 'ReactNode'.
```
Dòng 715 render `{item.category}` trực tiếp vào JSX, nhưng `category` là cả một object (`{id, code, name...}`), không phải chuỗi. React sẽ báo `"Objects are not valid as a React child"` và **crash trắng màn hình** ngay khi mở panel này — đúng vào màn hình nhân viên dùng nhiều nhất.

---

## 3. Vi phạm nguyên tắc versioning đã thống nhất từ đầu

Nguyên tắc B.5 số 4 (và GĐ2): *xuất bản phiên bản mới phải chuyển phiên bản cũ sang ARCHIVED và cập nhật `currentVersionId`, không được để hai phiên bản cùng ACTIVE.*

Đọc `publishCompetencyVersion` trong `AppContext.tsx` (dòng 655–670):

```ts
const publishCompetencyVersion = (versionId: string) => {
  setVersions((prev) =>
    prev.map((v) =>
      v.id === versionId
        ? { ...v, status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() }
        : v
    )
  );
  addAuditLog('PUBLISH', 'CompetencyVersion', versionId, { published: true });
};
```

Hàm này **chỉ đổi status của đúng bản đang publish**. Nó không:
- chuyển phiên bản PUBLISHED trước đó sang ARCHIVED
- cập nhật `Competency.currentVersionId` trỏ sang bản mới

Kết quả: xuất bản v2 xong, cả v1 và v2 cùng mang status PUBLISHED, và con trỏ hiện hành vẫn chỉ vào v1 nếu không sửa tay ở nơi khác. Đây đúng lỗi mà tôi cảnh báo trước trong README GĐ0 mục 6 ("Ba lỗi hay gặp nhất") — *"rất dễ viết code cho tiện, vi phạm thẳng nguyên tắc không ghi đè lịch sử"*.

---

## 4. Kiến trúc đã đổi khác — cần bạn xác nhận có chủ đích hay không

**Không có backend, không có Postgres thật.** `packages/db` chỉ chứa schema và types dùng để định hình dữ liệu tĩnh — không có API server nào chạy. Toàn bộ state nằm trong `localStorage` của trình duyệt (`AppContext.tsx`, gần 30 chỗ gọi `localStorage.getItem`). Nghĩa là:
- Hai người mở app trên hai máy sẽ thấy **hai bộ dữ liệu khác nhau**, không đồng bộ
- Xóa cache trình duyệt là mất sạch dữ liệu đã sửa
- Không có gì ngăn người dùng mở DevTools sửa thẳng localStorage để tự cấp quyền Admin

**Phân quyền RBAC chỉ là hình ảnh minh họa, chưa thực thi.** `activePersona` (nút chuyển vai trò ở góc trên) chỉ đổi *nhãn hiển thị* — tìm khắp `App.tsx` không thấy chỗ nào dùng persona để ẩn menu hoặc lọc dữ liệu. Các màn `RBACExplorer.tsx`, `UserScopeMatrix.tsx` là **bảng minh họa khái niệm** (rất tốt để giải thích cho người xem hiểu RBAC là gì), nhưng chuyển sang persona "Nhân viên" vẫn thấy y hệt giao diện Admin.

**Schema và code TypeScript bị lệch nhau.** `packages/db/src/types.ts` định nghĩa 24 interface, nhưng `schema.prisma` chỉ có 13 model. Tám kiểu dữ liệu đang dùng trên giao diện — `JobLevelModel`, `JobRoleModel`, `InterviewQuestionModel`, `GovernanceRuleModel`, `DataWarningModel`, `BehavioralIndicator`... — **không có bảng tương ứng trong schema**. Nếu nối Prisma thật vào Postgres lúc này, phần lớn màn hình sẽ không có dữ liệu để đọc.

**"Trợ lý AI" chưa gọi AI thật.** `AIAssistantModal.tsx` dùng `setTimeout` giả lập phản hồi — không có dòng nào import `@google/genai` dù package này có trong `package.json`. Không sai nếu là bản demo UI, nhưng nên gắn nhãn "Chế độ minh họa" để không ai tưởng nhầm đây là kết quả AI thật.

**Không có model Employee riêng** — `User` gánh cả vai trò tài khoản đăng nhập lẫn hồ sơ nhân sự. Với công ty 1.307 người, không phải ai cũng cần tài khoản hệ thống; gộp chung sẽ khó tách sau này.

---

## 5. Bảng tổng hợp việc cần làm

| # | Vấn đề | Mức độ | Sửa ở đâu |
|---|---|---|---|
| 1 | 5 chỗ gõ nhầm `competencyCode` → `competency` | Biên dịch lỗi + tính năng sai âm thầm | `SelfServiceHubView.tsx` dòng 119, 130, 139, 140, 179 |
| 2 | Render object vào JSX gây crash | Crash khi mở màn hình | `SelfServiceHubView.tsx` dòng 715 — đổi `item.category` thành `item.category.name` hoặc field string tương ứng |
| 3 | Publish version không archive bản cũ, không cập nhật currentVersionId | Vi phạm nguyên tắc dữ liệu đã thống nhất | `AppContext.tsx` hàm `publishCompetencyVersion` |
| 4 | RBAC/persona chỉ đổi nhãn, không lọc dữ liệu | Sai lệch với yêu cầu GĐ1 | Cần `ScopeService` thật, không chỉ đổi state hiển thị |
| 5 | `types.ts` có 8 kiểu không có model trong `schema.prisma` | Nợ kỹ thuật — sẽ vỡ khi nối DB thật | Thêm model hoặc xóa kiểu không dùng |
| 6 | Toàn bộ chạy client-side, không backend | Không phải lỗi, nhưng cần xác nhận có chủ đích | Quyết định: giữ làm demo hay tiếp tục xây backend theo GĐ0 |

---

## 6. Câu hỏi cần bạn trả lời trước khi đi tiếp

1. **Bạn muốn dừng ở mức demo trình bày, hay tiếp tục xây backend thật theo kiến trúc GĐ0?** Hai lựa chọn cần hướng đi khác hẳn nhau từ đây.
2. Nếu tiếp tục xây thật: cần nối `schema.prisma` (13 model) với `types.ts` (24 kiểu) trước — chọn giữ bên nào làm chuẩn.
3. Có nên yêu cầu AI Studio sửa 2 lỗi biên dịch ở mục 2–3 trước khi làm thêm tính năng mới không? Tôi khuyến nghị **có** — càng để lâu, lỗi `currentVersionId` càng khó dò khi dữ liệu phình to.
