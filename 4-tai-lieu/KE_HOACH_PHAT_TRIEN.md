# Kế hoạch phát triển bản dùng thử

Cập nhật ngày 27/11/2026. Ưu tiên hoàn thành một vòng sử dụng từ đăng ký đến đánh giá, sau đó mở rộng theo phản hồi thực tế.

| Ưu tiên | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| 1 | Gói web doanh nghiệp và tra cứu nhân sự | Gói phát hành loại dữ liệu demo. HR tìm được hồ sơ đã nhập bằng mã hoặc tên. |
| 2 | Hồ sơ chức danh và yêu cầu năng lực | HR tạo chức danh, chọn năng lực, đặt mức yêu cầu và phê duyệt trước khi dùng để đánh giá. |
| 3 | Đánh giá và kế hoạch phát triển | Một nhóm thử hoàn thành chiến dịch, xem kết quả theo quyền và theo dõi các hành động phát triển. |
| 4 | Khôi phục dữ liệu và triển khai | Thử khôi phục bản sao trên môi trường riêng. Xác nhận địa chỉ web thật, đăng nhập và dữ liệu sau khi khởi động lại. |
| 5 | Mời đồng nghiệp và quên mật khẩu | Chọn dịch vụ gửi email, thử thời hạn liên kết và thu hồi liên kết sau khi sử dụng. |
| 6 | Hỗ trợ soạn thảo bằng AI | Người dùng chủ động gửi nội dung, xem chi phí dự kiến và duyệt đề xuất trước khi lưu. |

## Phạm vi đợt hiện tại

Đã triển khai ưu tiên 1, hồ sơ chức danh của ưu tiên 2, chốt yêu cầu theo kỳ và thử một vòng IDP của ưu tiên 3. Xem [hướng dẫn đánh giá và IDP](DANH_GIA_VA_IDP.md) và [tiến độ kiểm thử](TIEN_DO.md). Việc thêm doanh nghiệp hiện cần người vận hành chuẩn bị mã và cơ sở dữ liệu trước khi gửi mã kích hoạt.

## Đề xuất sau khi rà soát luồng đánh giá

1. **Chốt yêu cầu theo chiến dịch — đã hoàn thành đợt 2.** Đã lưu mã chức danh, phiên bản hồ sơ và mức yêu cầu theo người, có bài thử chứng minh đổi chức danh hoặc duyệt bộ mới không làm đổi kỳ cũ. Người tham gia muộn được chốt lúc bổ sung; dữ liệu cũ thiếu bộ đã chốt được đánh dấu rõ.
2. **Củng cố IDP — ưu tiên kế tiếp.** Vòng tạo → hành động → gửi duyệt → phê duyệt → tiến độ → hoàn thành đã đạt trên trình duyệt. Tiếp tục quy định việc sửa sau gửi/duyệt, kiểm soát phê duyệt đồng thời và nhật ký điều chỉnh. Cần phân biệt hoàn thành hành động với việc đã đạt mức năng lực mục tiêu.
3. **Khôi phục và vận hành.** Chuẩn bị bản sao riêng cho từng công ty, phục hồi trên cơ sở dữ liệu khác rồi đối chiếu. Đo thời gian mở ứng dụng sau khi hosting ngủ và kiểm tra phiên đăng nhập sau khi dịch vụ khởi động lại.
4. **Mời tài khoản qua email.** Dùng API gửi mail qua HTTPS, thêm liên kết dùng một lần và giới hạn thử lại. Cần chọn nhà cung cấp trước khi tích hợp.
5. **AI hỗ trợ soạn nội dung.** Đặt sau các bước trên; ưu tiên tạo nháp chỉ báo và gợi ý hành động IDP với người duyệt và hạn mức chi phí riêng cho công ty.

## Phương án hosting

Đã đối chiếu nguồn chính thức ngày 27/11/2026. Giữ phương án Render + Neon cho bản thử để tận dụng backend hiện có.

- Render Free ngủ sau 15 phút không có truy cập, cấp 750 giờ chạy cho mỗi workspace trong tháng. Render khuyến cáo không dùng Free cho production. PostgreSQL Free của Render hết hạn sau 30 ngày; không dùng nó làm nơi lưu dữ liệu lâu dài. [Tài liệu Render](https://render.com/docs/free)
- Neon Free hiện công bố 100 CU-giờ và 1 GB lưu trữ cho mỗi project. Cửa sổ khôi phục tối đa 6 giờ hoặc 1 GB thay đổi dữ liệu, nên cần bổ sung bản sao và thử phục hồi. [Bảng gói Neon](https://neon.com/pricing)

Khi mở rộng cho doanh nghiệp sử dụng chính thức, cần đo tải, nhu cầu liên tục và thời gian khôi phục chấp nhận được rồi chọn gói. Chưa thay gói hoặc đăng ký dịch vụ phát sinh phí.

Khôi phục dữ liệu cần được thử thực tế trong giới hạn lịch sử mà gói cơ sở dữ liệu đang dùng hỗ trợ. [Tài liệu Neon](https://neon.com/docs/postgres/backup-restore/history-window)

## Công việc cho phiên tiếp theo

Đọc [nhật ký mới nhất](nhat-ky/README.md), bảng tiến độ, kiểm tra trạng thái PR #4 và các PR kiểm thử đang mở. Tiếp tục kiểm soát chỉnh sửa/phê duyệt IDP, sau đó thử sao lưu/khôi phục và tải dữ liệu lớn hơn. Khi có quyền truy cập hosting, triển khai bản dùng thử rồi ghi URL cùng kết quả kiểm tra vào bảng tiến độ.
