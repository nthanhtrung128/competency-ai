# Tiến độ phát triển website

Cập nhật ngày 27/11/2026, nhánh `feature/company-portal`. PR #4 còn mở.

| Hạng mục | Kết quả |
|---|---|
| Đăng ký, đăng nhập, đổi mật khẩu, đăng xuất | Đã hoàn thiện và thử trên trình duyệt. |
| Tách không gian của từng doanh nghiệp | Đã kiểm tra bằng dữ liệu giả của hai doanh nghiệp. |
| Tạo bản nháp năng lực và nhập CSV | Đã hoàn thiện. Người dùng xem kết quả kiểm tra trước khi xác nhận nhập. |
| Hồ sơ chức danh | Đã có tạo, lưu nháp, duyệt, kiểm soát sửa đồng thời và kiểm tra mã khi nhập nhân sự. |
| Liên kết chức danh → đánh giá → IDP | Đã thử bằng API với dữ liệu giả. Chỉ dùng mức yêu cầu đã duyệt; còn cần chốt yêu cầu theo chiến dịch. |
| Kiểm thử nghiệp vụ | Đợt 27/11: bài cổng doanh nghiệp và 6 nhóm kiểm thử chức danh đạt. Hai bộ 134/134 và 73/73 là kết quả đợt trước. |
| Kiểm thử giao diện | Đã đạt ở kích thước điện thoại và máy tính. |
| Phát hành bản thí điểm | Đã có cấu hình. Chưa có URL công khai. |

## Công việc tiếp theo

1. Kiểm tra thay đổi mới nhất trên nhánh hoặc pull request.
2. Chốt yêu cầu chức danh theo từng chiến dịch để báo cáo lịch sử không thay đổi khi duyệt bộ yêu cầu mới.
3. Thử đầy đủ vòng IDP trên giao diện và thử khôi phục bản sao dữ liệu.
4. Khi có tài khoản hosting, triển khai bản thí điểm và kiểm tra qua URL thật.

[Nhật ký đợt phát triển](nhat-ky/2026-11-26.md) · [Hướng dẫn triển khai](CONG_DOANH_NGHIEP.md)

## Đợt tiếp theo ngày 26/11/2026

- Đã tách điểm vào của bản web doanh nghiệp. Quá trình build sẽ dừng nếu kéo theo module dữ liệu demo.
- Đã bổ sung danh sách nhân sự, tìm theo tên hoặc mã, phân trang và tải lại.
- Đã thay danh sách đơn vị gán chủ quản bằng cơ cấu đang sử dụng.
- Đã biên soạn [kế hoạch phát triển](KE_HOACH_PHAT_TRIEN.md). Ưu tiên tiếp theo là hồ sơ chức danh và yêu cầu năng lực.
- Đã đạt kiểm tra kiểu, build hai chế độ, bài thử API trên PostgreSQL và Chromium trên điện thoại, máy tính. Bài thử mới xác nhận tìm kiếm hồ sơ và xử lý dữ liệu phân trang không hợp lệ. Hai bộ 207 mục nghiệp vụ là kết quả của đợt trước.

## Đợt ngày 27/11/2026 — hoàn thành hồ sơ chức danh

- Đã viết API và màn hình hồ sơ chức danh, tách bản nháp khỏi bộ yêu cầu đã duyệt, kiểm soát quyền và sửa đồng thời bằng số phiên bản.
- Đã bổ sung đối chiếu mã chức danh khi nhập CSV. Bản doanh nghiệp chỉ tính khoảng cách và lập mục tiêu IDP từ yêu cầu đã duyệt.
- Kiểm tra kiểu backend/frontend, build hai chế độ, bài API trên PostgreSQL và bài Chromium trên điện thoại/máy tính đều đạt. Chức danh mới cũng xuất hiện trong phần kế thừa mà không cần đăng nhập lại.
- Đã cập nhật giới hạn hosting từ tài liệu Render và Neon, cùng ưu tiên chốt yêu cầu theo chiến dịch. Chưa triển khai URL công khai.
- [Nhật ký ngày 27/11](nhat-ky/2026-11-27.md) · [Hướng dẫn hồ sơ chức danh](HO_SO_CHUC_DANH.md)
