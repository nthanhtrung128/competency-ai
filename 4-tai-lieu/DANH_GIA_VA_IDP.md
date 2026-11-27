# Đánh giá năng lực và kế hoạch phát triển cá nhân

Cập nhật ngày 27/11/2026, áp dụng cho cổng doanh nghiệp. Các bước dưới đã được thử bằng dữ liệu giả trên trình duyệt.

## Một vòng sử dụng

1. **Chuẩn bị.** Ban hành năng lực, duyệt hồ sơ chức danh, nhập nhân sự có `job_role_code` và quan hệ quản lý. Năng lực chuyên môn cũng có thể được chọn vào kỳ đánh giá.
2. **Tạo kỳ.** Vào **Đánh giá và phát triển → Chiến dịch 360° → Chiến dịch mới**. Nhập mã, tên, hạn nộp và chọn các năng lực cần đánh giá. Phải có ít nhất một năng lực đã ban hành.
3. **Thêm người.** Chọn phạm vi và bấm **Thêm**. Tùy chọn **Chỉ người có cấp dưới** mặc định bật; bỏ chọn nếu muốn đánh giá cả chuyên viên. Hệ thống sinh phiếu theo quan hệ quản lý trong hồ sơ.
4. **Mở thu phiếu.** Kiểm tra danh sách và hồ sơ chức danh trước khi mở. Hệ thống chốt nội dung chỉ báo cùng yêu cầu năng lực của từng người. Với người thêm sau, thời điểm chốt là lúc tham gia.
5. **Thu và đóng kỳ.** Người có tài khoản nộp phiếu; HR có thể nhập hộ bằng CSV, kiểm tra rồi chọn **Ghi thật**. Khi thu xong, chọn **Đóng chiến dịch** và xem **Kết quả**. Báo cáo ghi thời điểm và chức danh dùng để đối chiếu.
6. **Lập IDP.** Mở **IDP → Lập IDP từ 360°**, chọn kỳ đã đóng, nhân sự và chu kỳ phát triển. Hệ thống chọn tối đa ba năng lực có khoảng cách dương so với mức đã chốt. Ví dụ giả: yêu cầu 3, điểm từ người khác 2 thì mục tiêu gợi ý là 3.
7. **Thực hiện.** Thêm hành động phát triển, gửi duyệt, để quản lý hoặc HR có quyền phê duyệt, rồi chọn **Bắt đầu thực hiện**. Đánh dấu hành động đã xong, ghi nhận trao đổi định kỳ và hoàn thành IDP khi đã đối chiếu kết quả.

Các nhóm 70–20–10 phân loại việc học qua công việc, qua người khác và học chính quy. Hệ thống hiện không cưỡng chế đúng tỷ lệ phần trăm này. Tiến độ 100% là tỷ lệ hành động hoàn thành, không tự chứng minh năng lực đã tăng và không tự sửa điểm đánh giá.

## Yêu cầu được giữ theo từng kỳ

| Trường hợp | Cách xử lý |
|---|---|
| Đã mở kỳ với chức danh A, mức yêu cầu 3 | Giữ mức 3 và mã A trong bộ đối chiếu của kỳ đó. |
| Sau đó duyệt mức 5 hoặc chuyển người sang chức danh B | Kỳ cũ vẫn đối chiếu bộ đã chốt; kỳ mới lấy bộ phù hợp tại lúc mở. |
| Thêm người vào kỳ đang mở | Chốt bộ đang áp dụng tại lúc thêm; thêm lại cùng người không ghi đè bộ cũ. |
| Lúc chốt chưa gắn chức danh hoặc chưa có yêu cầu đã duyệt phù hợp | Vẫn thu điểm, để trống khoảng cách và không tự lập IDP từ kỳ đó. Hoàn thiện hồ sơ trước kỳ mới. |
| Kỳ cũ chưa từng lưu bộ yêu cầu | Giữ điểm gốc, báo thiếu dữ liệu chốt, không suy ngược từ chức danh hiện tại. IDP đã tạo trước đó giữ nguyên dữ liệu đã lưu. |

Thông tin nhân sự trên báo cáo vẫn là hồ sơ hiện tại; dòng **Yêu cầu đã chốt** cho biết chức danh dùng trong kỳ. Cần đọc dòng này khi người lao động đã chuyển vị trí.

## Phạm vi đã thử và việc còn hoàn thiện

Đã kiểm tra tạo kỳ, chọn năng lực chuyên môn, nhập hộ phiếu, đổi bộ yêu cầu sau khi mở, xem kết quả, lập IDP, thêm hành động, gửi duyệt, phê duyệt, bắt đầu, ghi nhận tiến độ và hoàn thành. API có bài thử mở/thêm/đóng đồng thời và tách dữ liệu giữa các công ty.

Cần tiếp tục củng cố việc sửa mục tiêu/hành động sau khi đã gửi duyệt hoặc phê duyệt, xử lý phê duyệt đồng thời và lưu vết điều chỉnh IDP. Chưa thử tải lớn hoặc khôi phục cơ sở dữ liệu. Đây là các việc trước khi coi bản này sẵn sàng vận hành chính thức.

## Ghi chú cho phiên phát triển tiếp theo

- Cột `assessment_participants.requirement_snapshot` lưu mã chức danh, tên, số phiên bản hồ sơ, thời điểm duyệt/chốt và danh sách mức yêu cầu. Không tự điền lịch sử bằng dữ liệu hiện tại khi nâng cấp.
- `assessment-snapshots.ts` chịu trách nhiệm chụp dữ liệu và giao dịch mở/thêm/đóng. Giao dịch đọc nhất quán; xung đột được thử lại có giới hạn, sau đó trả thông báo tải lại.
- Sau khi cập nhật schema, chạy Prisma generate, build backend và bước `prepare-workspaces` như cấu hình triển khai hiện có.
- Chạy lần lượt các bài API cục bộ `company-portal.mjs`, `role-profiles.mjs`, `assessment-snapshots.mjs` với cùng `PORTAL_TEST_PASSWORD` ngẫu nhiên và hai công ty thử. Bài thứ ba dùng dữ liệu của hai bài đầu.
- Bài trình duyệt `company-portal.mjs` dùng công ty thử thứ ba và gọi `assessment-idp.mjs`. Không chạy các bài này trên dữ liệu doanh nghiệp thật.
