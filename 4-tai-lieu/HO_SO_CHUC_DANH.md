# Hồ sơ chức danh trên cổng doanh nghiệp

Cập nhật ngày 27/11/2026. Chức năng thuộc bản `VITE_COMPANY_PORTAL=true`.

## Cách sử dụng

1. Tạo năng lực tại **Từ điển năng lực**, hoàn thiện chỉ báo cho năm mức và ban hành nội dung.
2. Mở **Hồ sơ chức danh**, nhập mã và tên, chọn **Tạo chức danh**. Mã được chuyển thành chữ hoa; mỗi công ty có bộ mã riêng.
3. Chọn **Thêm năng lực**, chọn năng lực và mức yêu cầu, sau đó **Lưu bản nháp**. Mỗi hồ sơ có tối đa 40 năng lực, mỗi mã xuất hiện một lần.
4. Người có quyền duyệt đối chiếu bản nháp với bộ yêu cầu đang áp dụng rồi chọn **Duyệt bộ yêu cầu**. Bản nháp rỗng hoặc có năng lực chưa ban hành sẽ không được duyệt.
5. Khi nhập CSV nhân sự, điền mã vào cột `job_role_code`. Hệ thống kiểm tra mã trong công ty hiện tại. Dòng có mã sai sẽ báo lỗi và không được ghi.
6. Tạo chiến dịch có các năng lực tương ứng, thu phiếu, đóng chiến dịch và lập IDP từ kết quả. Ví dụ giả: yêu cầu mức 3, điểm đánh giá từ người khác là 2 thì khoảng cách bằng 1 và mục tiêu IDP là mức 3.

| Vai trò | Xem bộ đã duyệt | Tạo chức danh, sửa nháp | Duyệt |
|---|---|---|---|
| ADMIN, HR_LEAD | Có | Có | Có |
| HRBP | Có | Có | Không |
| LINE_MANAGER | Có | Không | Không |

Quyền soạn thảo và duyệt tách riêng. Hiện ADMIN hoặc HR_LEAD có thể tự duyệt bản mình soạn; chưa có quy tắc bắt buộc hai người khác nhau.

## Quy tắc lưu dữ liệu

- Bản nháp lưu riêng với bộ đang áp dụng. Sửa hoặc lưu nháp không thay đổi kết quả tính theo bộ đã duyệt.
- Mỗi lần lưu hoặc duyệt tăng số phiên bản của hồ sơ. Nếu có người khác vừa thay đổi, thao tác dùng phiên bản cũ bị từ chối. Xem lại nội dung rồi tải lại trước khi tiếp tục.
- Duyệt thay toàn bộ bộ yêu cầu trong một giao dịch cùng nhật ký. Nhật ký giữ bộ cũ, bộ mới, phiên bản và người thực hiện.
- Cổng doanh nghiệp chặn đường ghi trực tiếp yêu cầu ở API cũ. Chỉ bộ đã duyệt của chức danh còn hoạt động được dùng để tính khoảng cách.
- IDP của bản doanh nghiệp không tự suy ra mức 3 khi thiếu bộ yêu cầu đã duyệt. Cần gắn đúng chức danh và duyệt các năng lực tương ứng trước khi tạo IDP từ đánh giá. Năng lực không nằm trong bộ đã duyệt không được chọn làm mục tiêu tự động.

## Giới hạn còn mở

Kết quả đánh giá hiện tra bộ yêu cầu chức danh đang áp dụng tại thời điểm xem. Duyệt bộ mới có thể làm thay đổi khoảng cách trong chiến dịch cũ; IDP đã tạo giữ nguyên mục tiêu đã lưu. Bước tiếp theo là chốt chức danh và mức yêu cầu cho từng người tại thời điểm mở chiến dịch. Cần hoàn thành bước này trước khi dùng báo cáo lịch sử làm căn cứ quản trị chính thức.

Chưa có màn hình đổi mã, đổi tên hoặc ngừng sử dụng chức danh. Chưa có quy trình phê duyệt nhiều cấp. Đây là các hạng mục phát triển sau khi luồng đánh giá được ổn định.

## Kiểm tra kỹ thuật

Các cột mới `pending_requirements`, `revision`, `approved_at` được thêm vào `job_roles`. Chạy `npm run prisma:generate`, build backend và `node dist/prepare-workspaces.js` với cấu hình công ty trước khi khởi động bản mới. Script triển khai hiện tại đã gọi bước chuẩn bị này.

Chỉ chạy các bài thử dưới đây trên cơ sở dữ liệu cục bộ, trống, dành riêng để kiểm thử. Không dùng cấu hình doanh nghiệp thật. Chuẩn bị hai công ty cho API và một công ty riêng cho trình duyệt, cùng một máy chủ chạy bản doanh nghiệp. Các khóa phiên, mật khẩu và mã kích hoạt phải được sinh ngẫu nhiên cho mỗi lượt chạy.

1. Trong backend, chạy `node --test tests/company-portal.mjs` với `WORKSPACES_JSON` chứa hai công ty thử và `PORTAL_TEST_PASSWORD` được sinh cho lượt chạy.
2. Chạy tiếp `node --test tests/role-profiles.mjs` với đúng cấu hình và mật khẩu trên. Hai lệnh phải chạy lần lượt vì bài thứ hai dùng tài khoản do bài thứ nhất tạo.
3. Build frontend với `VITE_COMPANY_PORTAL=true`. Chạy `node tests/company-portal.mjs` trong frontend; `WORKSPACES_JSON` chứa công ty thứ ba còn trống, `BROWSER_TEST_COMPANY` chọn công ty này và `CHROMIUM_PATH` chỉ đến Chromium đã cài. File thử tự gọi `tests/role-profiles.mjs` để kiểm tra tạo, lưu, duyệt và sửa nháp trên giao diện.

Bài API kiểm tra tạo trùng đồng thời, cô lập công ty, quyền, năng lực chưa ban hành, mức sai, mã lặp, ghi bằng phiên bản cũ, duyệt đồng thời, nhập nhân sự, kết quả đánh giá và mục tiêu IDP. Bài trình duyệt kiểm tra kích thước 390 và 1280 pixel, lưu qua tải lại trang và việc sửa nháp vẫn giữ bộ đã duyệt.
