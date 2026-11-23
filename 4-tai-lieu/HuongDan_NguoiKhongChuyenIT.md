# Hướng dẫn dành cho người không chuyên IT

## Phần 1 — Hiện tại bạn đang có gì

Có ba thứ, mức độ "chạy được" rất khác nhau:

| Thứ bạn có | Chạy được chưa? | Mở bằng gì |
|---|---|---|
| **File Excel từ điển năng lực** | Chạy được ngay | Excel — dùng luôn để tuyển dụng, phỏng vấn |
| **prototype-ui.html** | Chạy được ngay | Nhấp đúp, mở bằng Chrome/Edge |
| **Phần mềm CompetencyAI thật** | **Chưa tồn tại** | Mới có bản thiết kế cơ sở dữ liệu (GĐ0/7) |

Nói thẳng: **phần mềm chưa có để chạy.** Mới xong phần móng — bản thiết kế 40 bảng dữ liệu. Sáu giai đoạn còn lại (đăng nhập, phân quyền, màn hình, đánh giá, AI) chưa viết dòng code nào.

---

## Phần 2 — Mở bản mẫu giao diện ngay bây giờ

Đây là thứ duy nhất bạn xem được ngay, không cần cài gì.

1. Tải file `prototype-ui.html` về máy
2. Nhấp đúp vào file
3. Trình duyệt mở lên, bạn thấy giao diện phần mềm

Thử ba nút này:
- **VI / EN** ở góc trên phải — chuyển ngữ
- **◐ Tối** — chuyển nền sáng/tối
- Bấm các mục ở menu trái — thấy mục được chọn đổi màu

Đây là **bản vẽ giao diện**, không phải phần mềm thật. Bấm vào không lưu được dữ liệu. Mục đích: để bạn duyệt bố cục trước, vì sửa file HTML rẻ hơn sửa code React rất nhiều.

---

## Phần 3 — Muốn có phần mềm thật thì làm sao

### Sự thật cần biết trước

Xây phần mềm này cần: cài Node.js, cài Docker, chạy PostgreSQL, gõ lệnh trong Terminal, đọc thông báo lỗi bằng tiếng Anh và sửa. Khoảng **6 giai đoạn × mỗi giai đoạn vài buổi làm việc**.

Một người không chuyên IT có làm được không? Có, nhưng sẽ mất nhiều thời gian và dễ nản ở chỗ gặp lỗi mà không biết lỗi gì. Đây là bài thực tập dành cho người đã quen môi trường lập trình.

### Ba lựa chọn thực tế

**Lựa chọn A — Dùng Excel, không xây phần mềm** *(khuyến nghị nếu mục tiêu là công việc HR)*

Bộ Excel hiện có đã dùng được ngay cho: tuyển dụng, khung phỏng vấn, định hướng đào tạo, thiết kế lộ trình nghề nghiệp. Phần mềm chỉ thêm giá trị khi bạn cần *nhiều người cùng nhập liệu* và *theo dõi điểm qua nhiều kỳ*.

**Lựa chọn B — Nhờ một lập trình viên** *(khuyến nghị nếu bắt buộc phải có phần mềm)*

Đưa họ thư mục `CompetencyAI_GD0`. Trong đó đã có sẵn schema, tài liệu kiến trúc và prompt viết sẵn cho GĐ1. Một lập trình viên biết Next.js/NestJS sẽ hiểu ngay phải làm gì.

**Lựa chọn C — Tự làm cùng Claude Code** *(nếu bạn muốn học)*

Xem Phần 4 bên dưới. Cứ làm từng giai đoạn, không vội.

---

## Phần 4 — Nếu chọn tự làm: cài đặt từng bước

### Bước 1 — Cài Node.js

1. Vào `nodejs.org`
2. Tải bản **LTS** (nút bên trái, có chữ "Recommended")
3. Cài như cài phần mềm bình thường, bấm Next liên tục
4. Kiểm tra: mở **Terminal** (máy Mac) hoặc **PowerShell** (máy Windows), gõ:
   ```
   node --version
   ```
   Hiện ra số kiểu `v20.x.x` là được.

> **Terminal / PowerShell là gì?** Là cửa sổ màu đen để gõ lệnh thay vì bấm chuột.
> Windows: bấm nút Start, gõ "PowerShell", Enter.
> Mac: bấm Cmd+Space, gõ "Terminal", Enter.

### Bước 2 — Cài Docker Desktop

1. Vào `docker.com`, tải **Docker Desktop**
2. Cài, khởi động lại máy nếu được yêu cầu
3. Mở Docker Desktop, chờ đến khi biểu tượng con cá voi hiện màu xanh

Docker dùng để chạy cơ sở dữ liệu PostgreSQL mà không phải cài PostgreSQL thủ công.

### Bước 3 — Cài Claude Code

Trong Terminal/PowerShell, gõ:
```
npm install -g @anthropic-ai/claude-code
```

Chờ xong, gõ `claude` để khởi động. Lần đầu sẽ yêu cầu đăng nhập.

### Bước 4 — Tạo thư mục dự án

```
mkdir competencyai
cd competencyai
```

Chép thư mục `prisma` và `docs` từ bộ GĐ0 vào đây.

### Bước 5 — Khởi động cơ sở dữ liệu

```
docker run -d --name capg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=competencyai -p 5432:5432 postgres:15
```

Một dòng dài, chép nguyên rồi Enter.

### Bước 6 — Nghiệm thu GĐ0

```
npx prisma validate
npx prisma migrate dev --name init
```

- Hiện `The schema is valid` → tốt, đi tiếp
- Hiện chữ đỏ `Error` → chép nguyên đoạn lỗi, đưa cho Claude Code nhờ sửa

### Bước 7 — Bắt đầu GĐ1

Mở `README.md` trong bộ GĐ0, mục 4 có sẵn đoạn prompt. Chép nguyên đoạn đó, dán vào Claude Code.

**Nguyên tắc quan trọng nhất:** làm xong GĐ1 thì dừng lại kiểm tra, chạy được rồi mới sang GĐ2. Đừng bảo AI làm liền một mạch — khi lỗi xuất hiện ở GĐ4 mà GĐ1–3 chưa kiểm tra, bạn sẽ không biết lỗi từ đâu.

---

## Phần 5 — Khi gặp lỗi

Bạn không cần hiểu lỗi. Chỉ cần:

1. Bôi đen toàn bộ chữ màu đỏ trong Terminal
2. Chép
3. Dán vào Claude Code, viết thêm: *"Tôi gặp lỗi này khi chạy lệnh [tên lệnh]. Sửa giúp tôi."*

Đừng tự đoán và sửa lung tung — dễ hỏng thêm.

---

## Phần 6 — Ba câu hỏi tự kiểm tra trước khi bắt đầu

1. **Mục tiêu của tôi là gì?** Nếu để phục vụ công việc HR ngay → dùng Excel. Nếu để nộp bài thực tập → phải xây phần mềm.
2. **Tôi có bao nhiêu thời gian?** Dưới 2 tuần và chưa từng gõ Terminal → nên chọn Lựa chọn B.
3. **Ai sẽ bảo trì phần mềm sau này?** Nếu không có ai → cân nhắc kỹ trước khi xây.
