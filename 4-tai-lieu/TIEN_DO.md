# Tiến độ phát triển website

Cập nhật ngày 26/11/2026, nhánh `feature/company-portal`.

| Hạng mục | Kết quả |
|---|---|
| Đăng ký, đăng nhập, đổi mật khẩu, đăng xuất | Đã hoàn thiện và thử trên trình duyệt. |
| Tách không gian của từng doanh nghiệp | Đã kiểm tra bằng dữ liệu giả của hai doanh nghiệp. |
| Tạo bản nháp năng lực và nhập CSV | Đã hoàn thiện. Người dùng xem kết quả kiểm tra trước khi xác nhận nhập. |
| Kiểm thử nghiệp vụ | Hai bộ kiểm thử đạt lần lượt 134/134 và 73/73. |
| Kiểm thử giao diện | Đã đạt ở kích thước điện thoại và máy tính. |
| Phát hành bản thí điểm | Đã có cấu hình. Chưa có URL công khai. |

## Công việc tiếp theo

1. Kiểm tra thay đổi mới nhất trên nhánh hoặc pull request.
2. Khi có tài khoản hosting, triển khai bản thí điểm và kiểm tra qua URL thật.
3. Chạy thử với dữ liệu giả, thu phản hồi và bổ sung kết quả vào trang này.

[Nhật ký đợt phát triển](nhat-ky/2026-11-26.md) · [Hướng dẫn triển khai](CONG_DOANH_NGHIEP.md)

## Đợt tiếp theo ngày 26/11/2026

- Đã tách điểm vào của bản web doanh nghiệp. Quá trình build sẽ dừng nếu kéo theo module dữ liệu demo.
- Đã bổ sung danh sách nhân sự, tìm theo tên hoặc mã, phân trang và tải lại.
- Đã thay danh sách đơn vị gán chủ quản bằng cơ cấu đang sử dụng.
- Đã biên soạn [kế hoạch phát triển](KE_HOACH_PHAT_TRIEN.md). Ưu tiên tiếp theo là hồ sơ chức danh và yêu cầu năng lực.
- Đã đạt kiểm tra kiểu, build hai chế độ, bài thử API trên PostgreSQL và Chromium trên điện thoại, máy tính. Bài thử mới xác nhận tìm kiếm hồ sơ và xử lý dữ liệu phân trang không hợp lệ. Hai bộ 207 mục nghiệp vụ là kết quả của đợt trước.
