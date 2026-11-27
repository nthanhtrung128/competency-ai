# Đưa cổng doanh nghiệp lên web để dùng thử

Một địa chỉ web phục vụ nhiều doanh nghiệp. Mỗi doanh nghiệp có mã đăng nhập và một cơ sở dữ liệu PostgreSQL riêng. Người phụ trách triển khai chuẩn bị công ty và gửi mã kích hoạt riêng cho quản trị viên đầu tiên. Đăng ký thành công sẽ tạo đơn vị gốc HQ, quyền quản trị, ba nhóm năng lực và thang năm mức. HR tự nhập từ điển của công ty.

## 1. Chuẩn bị công ty đầu tiên

1. Trong Neon, chọn gói **Free**, tạo một project mới cho công ty dùng thử. Chọn khu vực lưu trữ phù hợp với công ty. Mở **Connect** và chép chuỗi PostgreSQL, giữ các tham số SSL. Với lệnh tạo bảng, chọn kết nối trực tiếp (tắt **Connection pooling**).
2. Chọn mã công ty dài 2–40 ký tự, bắt đầu bằng chữ thường hoặc số, có thể dùng gạch ngang. Ví dụ `an-phu`.
3. Dùng trình quản lý mật khẩu để sinh riêng một mã kích hoạt ngẫu nhiên từ 32 đến 128 ký tự chữ và số. Gửi mã này trực tiếp cho người sẽ quản trị công ty.
4. Chuẩn bị giá trị cho biến bí mật `WORKSPACES_JSON` theo mẫu dưới. Thay các chữ trong dấu ngoặc nhọn bằng giá trị thật. Chuỗi kết nối và mã kích hoạt được điền ở phần Environment của Render. Không đưa các giá trị này lên GitHub hoặc vào biến Vite của giao diện.

```json
[
  {
    "code": "an-phu",
    "databaseUrl": "<chuỗi kết nối PostgreSQL riêng của công ty>",
    "activationKey": "<mã kích hoạt ngẫu nhiên riêng của công ty>"
  }
]
```

## 2. Tạo website trên Render

1. Trong Render chọn **New → Blueprint**, kết nối GitHub và chọn repository `nthanhtrung128/competency-ai`.
2. Chọn nhánh có bản cập nhật và file **render.yaml ở thư mục gốc**. Kiểm tra dịch vụ `competencyai-portal` dùng gói **Free**.
3. Điền `WORKSPACES_JSON` ở bước 1 rồi triển khai. Blueprint tự sinh khóa phiên, build giao diện và API, tạo bảng và phục vụ cả hai tại cùng địa chỉ. Bộ triển khai này dùng toàn bộ repository.
4. Khi dịch vụ báo **Live**, mở đường dẫn Render cung cấp. Trang đầu phải là **Đăng nhập**. Truy cập `/w/an-phu/health` để kiểm tra kết nối tới đúng cơ sở dữ liệu. Kết quả mong đợi gồm `db: connected`.

Render Free có thể ngủ khi ít hoạt động và giới hạn thời gian chạy. Neon Free có hạn mức lưu trữ và tính toán theo project. Hai gói phù hợp cho thí điểm, cần kiểm tra hạn mức và yêu cầu vận hành trước khi đưa nhân sự thật vào sử dụng. [Render Free](https://render.com/docs/free) · [Neon Free](https://neon.com/pricing)

## 3. Đăng ký và mời đồng nghiệp

1. Quản trị viên mở website, chọn **Đăng ký doanh nghiệp**, nhập mã công ty, tên công ty, họ tên, mã kích hoạt, email và mật khẩu.
2. Sau khi có thông báo thành công, đăng nhập bằng mã công ty, email và mật khẩu vừa đặt. Mã kích hoạt chỉ mở được một tài khoản quản trị đầu tiên. Có thể bỏ trường `activationKey` khỏi cấu hình sau khi kích hoạt.
3. Mở **Cơ cấu tổ chức** để tạo đơn vị. Vào **Từ điển năng lực** để tạo bản nháp đầu tiên. Khi có đủ chỉ báo cho năm mức, người có quyền ban hành có thể duyệt bản nháp.
4. Mở **Quản lý tài khoản → Cấp một tài khoản**, chọn vai trò và phạm vi phù hợp. Gửi riêng mã công ty, email và mật khẩu tạm cho người nhận. Lần đầu đăng nhập, họ phải tự đặt mật khẩu. Quản trị viên cũng có thể đặt lại mật khẩu tại đây.

### Nhập hồ sơ nhân sự

Trong **Nhập nhân sự**, chọn **Tải mẫu CSV**, điền mã nhân viên, họ tên và mã đơn vị đã tạo. Lưu file CSV UTF-8 rồi chọn **Kiểm tra file**. Sửa dòng lỗi, đọc các cảnh báo và đối chiếu số hồ sơ tạo mới, cập nhật. Khi đã kiểm tra, đánh dấu xác nhận và chọn **Ghi hồ sơ nhân sự**. Có thể dùng mã nhân viên trong **Quản lý tài khoản** để liên kết tài khoản với hồ sơ.

## 4. Thêm công ty thứ hai

Tạo project PostgreSQL trống và mã kích hoạt riêng. Thêm một đối tượng mới vào danh sách `WORKSPACES_JSON` trên Render, giữ các mục đang hoạt động và chọn lưu rồi triển khai lại. Các công ty tiếp tục dùng cùng địa chỉ web. Đổi mã công ty sau khi đã gắn cơ sở dữ liệu sẽ làm dịch vụ từ chối khởi động. Hãy giữ mã ổn định và kiểm tra `/w/<mã công ty>/health` sau mỗi lần thêm.

## Kiểm tra trước khi mở thí điểm

Dùng hồ sơ giả để thử lần lượt việc đăng ký, đăng nhập, tạo bản nháp, cấp tài khoản, đổi mật khẩu tạm và đăng xuất. Kiểm tra lại với hai mã công ty. Nhật ký và danh sách đơn vị phải thuộc đúng công ty đang chọn. Bộ kiểm thử kỹ thuật có trong `1-backend/tests/company-portal.mjs`.

Bản thí điểm có hai luồng quản trị riêng. Luồng doanh nghiệp sử dụng cơ sở dữ liệu mới. Hướng dẫn cũ trong `TRIEN_KHAI.md` dành cho bộ dữ liệu mẫu Flamingo và triển khai một đơn vị.
