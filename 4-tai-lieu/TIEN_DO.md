# Tiến độ phát triển website

Cập nhật ngày 27/11/2026, nhánh `feature/company-portal`. PR #4 còn mở.

| Hạng mục | Kết quả |
|---|---|
| Đăng ký, đăng nhập, đổi mật khẩu, đăng xuất | Đã hoàn thiện và thử trên trình duyệt. |
| Tách không gian của từng doanh nghiệp | Đã kiểm tra bằng dữ liệu giả của hai doanh nghiệp. |
| Tạo bản nháp năng lực và nhập CSV | Đã hoàn thiện. Người dùng xem kết quả kiểm tra trước khi xác nhận nhập. |
| Hồ sơ chức danh | Đã có tạo, lưu nháp, duyệt, kiểm soát sửa đồng thời và kiểm tra mã khi nhập nhân sự. |
| Liên kết chức danh → đánh giá → IDP | Đã chốt yêu cầu theo từng người/kỳ và thử hết vòng IDP trên giao diện bằng dữ liệu giả. |
| Giữ ổn định lịch sử | Đổi chức danh hoặc duyệt mức mới không đổi bộ yêu cầu của kỳ cũ. Dữ liệu cũ chưa chốt được đánh dấu rõ. |
| Kiểm thử nghiệp vụ | Đợt 2 ngày 27/11: bài cổng doanh nghiệp, 6 nhóm chức danh, 5 nhóm chốt yêu cầu đều đạt; đã chạy lại hai bộ 134/134 và 73/73. |
| Kiểm thử giao diện | Đã đạt ở kích thước điện thoại và máy tính. |
| Phát hành bản thí điểm | Đã có cấu hình. Chưa có URL công khai. |

## Công việc tiếp theo

1. Kiểm tra thay đổi mới nhất trên nhánh hoặc pull request.
2. Củng cố quy tắc chỉnh sửa sau gửi/duyệt IDP, phê duyệt đồng thời và lưu vết thay đổi.
3. Thử khôi phục bản sao dữ liệu riêng từng công ty và kiểm tra với số lượng nhân sự lớn hơn.
4. Khi có tài khoản hosting, triển khai bản thí điểm và kiểm tra qua URL thật.

[Danh mục nhật ký](nhat-ky/README.md) · [Hướng dẫn triển khai](CONG_DOANH_NGHIEP.md)

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

## Đợt 2 ngày 27/11/2026 — chốt yêu cầu và kiểm thử IDP

- Đã lưu bộ yêu cầu riêng theo người/kỳ; mở, thêm người và đóng kỳ được xử lý trong giao dịch nhất quán. Báo cáo ghi thời điểm, chức danh và tình trạng dữ liệu đã chốt.
- Đã bổ sung chọn năng lực khi tạo kỳ, không phụ thuộc bộ năng lực mẫu. IDP lấy mục tiêu từ bộ đã chốt.
- Đã đạt kiểm tra kiểu, build hai chế độ, các bài API mới, hai bộ nghiệp vụ cũ (207 mục) và vòng IDP trên Chromium. Kết quả này thuộc đợt hiện tại.
- Chưa triển khai URL thật; còn việc về kiểm soát sửa/duyệt IDP, sao lưu/khôi phục và tải lớn.
- [Nhật ký đợt 2](nhat-ky/2026-11-27-dot-2.md) · [Hướng dẫn đánh giá và IDP](DANH_GIA_VA_IDP.md)
