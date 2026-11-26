# Kế hoạch phát triển bản dùng thử

Cập nhật ngày 26/11/2026. Ưu tiên hoàn thành một vòng sử dụng từ đăng ký đến đánh giá, sau đó mở rộng theo phản hồi thực tế.

| Ưu tiên | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| 1 | Gói web doanh nghiệp và tra cứu nhân sự | Gói phát hành loại dữ liệu demo. HR tìm được hồ sơ đã nhập bằng mã hoặc tên. |
| 2 | Hồ sơ chức danh và yêu cầu năng lực | HR tạo chức danh, chọn năng lực, đặt mức yêu cầu và phê duyệt trước khi dùng để đánh giá. |
| 3 | Đánh giá và kế hoạch phát triển | Một nhóm thử hoàn thành chiến dịch, xem kết quả theo quyền và theo dõi các hành động phát triển. |
| 4 | Khôi phục dữ liệu và triển khai | Thử khôi phục bản sao trên môi trường riêng. Xác nhận địa chỉ web thật, đăng nhập và dữ liệu sau khi khởi động lại. |
| 5 | Mời đồng nghiệp và quên mật khẩu | Chọn dịch vụ gửi email, thử thời hạn liên kết và thu hồi liên kết sau khi sử dụng. |
| 6 | Hỗ trợ soạn thảo bằng AI | Người dùng chủ động gửi nội dung, xem chi phí dự kiến và duyệt đề xuất trước khi lưu. |

## Phạm vi đợt hiện tại

Đã triển khai ưu tiên 1. Các bước 2–6 là đề xuất cho những đợt tiếp theo. Việc thêm doanh nghiệp hiện cần người vận hành chuẩn bị mã và cơ sở dữ liệu trước khi gửi mã kích hoạt.

## Phương án hosting

Render Free phù hợp cho thử nghiệm và có cơ chế ngủ dịch vụ. Chọn bản trả phí khi cần vận hành liên tục. Cần chốt nhu cầu sử dụng và ngân sách với người phụ trách trước khi thay gói. [Tài liệu Render](https://render.com/docs/free)

Khôi phục dữ liệu cần được thử thực tế trong giới hạn lịch sử mà gói cơ sở dữ liệu đang dùng hỗ trợ. [Tài liệu Neon](https://neon.com/docs/postgres/backup-restore/history-window)

## Công việc cho phiên tiếp theo

Đọc bảng tiến độ, kiểm tra trạng thái PR #4 và các PR kiểm thử đang mở. Bắt đầu từ hồ sơ chức danh. Khi có quyền truy cập hosting, triển khai bản dùng thử rồi ghi URL cùng kết quả kiểm tra vào bảng tiến độ.
