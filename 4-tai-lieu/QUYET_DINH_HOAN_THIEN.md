# CompetencyAI — Sổ quyết định để hoàn thiện ứng dụng

**Tập đoàn Flamingo · Ban NS&QTHC · cập nhật 14/10/2026 (lần 3: thêm Bàn duyệt, Kế thừa, Bảng điều khiển, gói triển khai)**

Ký hiệu nguồn: **[SOURCE]** lấy từ tài liệu chính thức · **[INFERENCE]** suy luận có căn cứ · **[PROPOSAL]** đề xuất của nhóm HR, chưa được duyệt.

---

## 1. Executive Summary

| Hạng mục | Trước | Sau đợt này |
|---|---|---|
| Phân hệ chạy trên dữ liệu thật | Tổ chức, Từ điển, Job Architecture | **+ Đánh giá 360°, 9-Box, IDP, Quản trị tài khoản** |
| Năng lực trong Từ điển | 57 | **60** (thêm CO7–CO9 ở trạng thái bản nháp) |
| Yêu cầu năng lực của vai trò đối chiếu tin cậy CAO | 84/141 (60%) | **103/141 (73%)** |
| Yêu cầu không có năng lực tương đương | 12 dòng, 12 vai trò | **1 dòng** (R26 "Một lĩnh vực chuyên sâu") |
| Ô chỉ báo Mức 1-2-4-5 của 45 NL chuyên môn | 0/180 | **180/180 có dự thảo AI**, 0 ô đã duyệt |
| Kiểm thử | Máy chủ giả lập | **PostgreSQL 16 thật**: kiểm tra nhanh 19/19 · 360°–9-Box–IDP–tài khoản 46/46 · giao diện chạy trên trình duyệt |

**Còn chặn vận hành thật:** QĐ-02 (duyệt bảng đối chiếu) · QĐ-03 (chủ quản 6 NL) · QĐ-10 (pháp lý dữ liệu ra nước ngoài) · tiến độ chuyên gia sửa 195 ô dự thảo AI.

---

## 2. Quyết định đã chốt ngày 14/10/2026 và việc đã làm theo

| Mã | Đã chốt | Đã triển khai trong app |
|---|---|---|
| **QĐ-01** | Từ điển 57 NL là chuẩn **+ thêm 3 NL** từ Sổ tay | CO7 Giao tiếp · CO8 Lập kế hoạch & Tổ chức · CO9 Hướng đến kết quả. Ba năng lực này vào Từ điển ở trạng thái **BẢN NHÁP** (căn cứ chọn: [SOURCE] Sổ tay sheet 03; định nghĩa và 5 mức: dự thảo AI). Bảng đối chiếu: COR01→CO7, COR03→CO8, COR02→CO9 |
| **QĐ-04** | **AI soạn nháp, chuyên gia sửa** | Đã soạn nháp 195 ô (180 ô FU + 15 ô CO7–CO9) trong `3-du-lieu/Mau_ChiBao_ChuyenMon_Muc1-5.xlsx` và `ai_draft_indicators.json`. Mọi ô gắn nhãn `[DỰ THẢO AI – CHƯA DUYỆT]`. Có 3 lớp chặn: lệnh nạp **từ chối** ô còn nhãn; máy chủ **từ chối ban hành** phiên bản còn nhãn; ô chuyên gia chỉ xoá nhãn mà giữ nguyên chữ AI thì được **ghi vết** "chấp nhận nguyên văn AI" để HR biết |
| **QĐ-06** | Đưa **cả 360°, 9-Box và IDP** lên dữ liệu thật | Chiến dịch 360° (tự sinh người đánh giá theo quan hệ báo cáo, **chốt phiên bản năng lực khi mở**, phiếu trong app, kết quả có **bảo vệ ẩn danh**) → 9-Box (gợi ý trục Tiềm năng từ 360°, hiệu chỉnh, chốt) → IDP (sinh mục tiêu từ khoảng cách 360°, hành động 70-20-10, gửi duyệt, quản lý trực tiếp phê duyệt, trao đổi định kỳ) |
| **QĐ-21** | Đưa **Kế hoạch kế thừa** lên dữ liệu thật (chọn ngày 14/10) | Vị trí then chốt → ứng viên → mức sẵn sàng (ngay / 1–2 năm / ≥ 3 năm) và rủi ro mất ứng viên. Gợi ý ứng viên từ 9-Box [PROPOSAL: ô 9, 8, 6]. Mỗi ứng viên kèm ô 9-Box, điểm 360° Lãnh đạo, tiến độ IDP. Có chỉ số bench strength và số vị trí trọng yếu chưa có người thay ngay |
| **QĐ-07** | Thí điểm cấp tài khoản cho **HR + quản lý** | Cấp lẻ hoặc **cấp hàng loạt cho quản lý** (người có cấp dưới hoặc là trưởng đơn vị, có email). Mật khẩu tạm hiện một lần. **Bắt buộc đổi mật khẩu** ở lần đầu (máy chủ chặn mọi chức năng khác). Đặt lại mật khẩu, khoá tài khoản. Phiếu 360° của người chưa có tài khoản: **HR nhập hộ bằng file** (`mau_nhap_phieu_360.csv`), có kiểm tra trước khi ghi |

**Áp dụng sẵn theo khuyến nghị, cần xác nhận chính thức:** QĐ-00 (thang FLA-5). Toàn bộ nhãn "Korn Ferry 4 cấp" đã được đổi.

---

## 3. Quyết định còn mở

Ưu tiên: 🔴 chặn vận hành thật · 🟠 chặn mở rộng · 🟢 cần trước khi nhân rộng.

### Nhóm A — Nội dung khung năng lực (Ban NS&QTHC chủ trì)

| Mã | Ưu tiên | Câu hỏi | Khuyến nghị [PROPOSAL] |
|---|---|---|---|
| **QĐ-02** | 🔴 | Duyệt bảng đối chiếu 60 dòng (`doi_chieu_ma_nang_luc.csv`) | Có 46 dòng tin cậy CAO, duyệt theo lô. Xem riêng **VAL03 → LE3**: dòng này gán năng lực Lãnh đạo cho vai trò không quản lý (R13). **Làm trên app: Bàn duyệt (HR) → Đối chiếu mã** (nút "Chọn các dòng tin cậy CAO" → Duyệt). Xong thì bấm **Xuất CSV** để cập nhật file nguồn |
| **QĐ-03** | 🔴 | Đơn vị chủ quản FU02, FU16, FU23, FU29, FU43, FU45 | Xem bảng 3.1. **Làm trên app: Bàn duyệt (HR) → Đơn vị chủ quản** (ô chọn điền sẵn theo phương án đề xuất) |
| **QĐ-04b** | 🔴 | **Lịch và người chịu trách nhiệm** sửa 195 ô dự thảo | Chia theo 13 lĩnh vực, mỗi đơn vị chủ quản 2 tuần. HR rà soát chéo. Riêng CO7–CO9 do Ban NS&QTHC chủ trì. **Rà soát trên app: Bàn duyệt (HR) → Bản nháp chỉ báo** — so từng mức với bản đang hiệu lực, Ban hành hoặc Trả lại (bắt buộc ghi lý do, nội dung được lưu vào nhật ký) |
| **QĐ-05** | 🟠 | Bộ Giá trị cốt lõi chính thức | Tạm ẩn nhóm VAL cho tới khi có văn bản HĐQT |

#### 3.1. Phương án đơn vị chủ quản (QĐ-03) [PROPOSAL]

| NL | Tên | Đề xuất | Thay thế | Căn cứ |
|---|---|---|---|---|
| FU02 | Hoạch định Chiến lược & Danh mục | Ban TGĐ tạm giữ | Bộ phận Chiến lược thuộc VPCT | [SOURCE] Sổ tay sheet 07: "chưa có đơn vị chủ quản rõ ràng" |
| FU16 | Tiêu chuẩn Dịch vụ | Ban KD Vận hành (B06) | FRT | Chuẩn tự xây, dùng chung khách sạn và lữ hành [INFERENCE] |
| FU23 | Quản trị Doanh thu | Ban KD Vận hành (B06) | FRT | Đi cùng FU24 do B06 chủ trì [INFERENCE] |
| FU29 | Danh mục Tài sản & CAPEX | Ban Đầu tư (B01) chủ trì, TCKT phối hợp | Ban TCKT | Tài sản giữ ở cấp Tập đoàn [SOURCE]; B11-P4 không quản tài sản khai thác [SOURCE] |
| FU43 | Vận hành Tòa nhà & Cư dân | Ban KD BĐS (B05) | Lập đơn vị quản lý vận hành | Nối tiếp bàn giao FU42 [INFERENCE] |
| FU45 | ESG & Phát triển Bền vững | Ban PC&KSNB (B12) chủ trì, TT&TH phối hợp | Ban TGĐ | Gần tuân thủ và rủi ro [INFERENCE] |

> Hội đồng Đầu tư **đã bỏ** (2026), không đưa vào phương án nào.

### Nhóm B — Quy tắc đánh giá mới phát sinh khi triển khai QĐ-06 (Ban NS&QTHC chủ trì)

| Mã | Ưu tiên | Câu hỏi | Đang cài đặt [PROPOSAL] | Ghi chú |
|---|---|---|---|---|
| **QĐ-15** | 🟠 | Ngưỡng **ẩn danh** của nhóm Đồng nghiệp và Cấp dưới | Dưới **3** người trả lời thì không hiện điểm riêng của nhóm, nhưng điểm vẫn được tính vào cột "Người khác" | Chỉnh được theo từng chiến dịch (1–10) |
| **QĐ-16** | 🟠 | Quy tắc **gợi ý trục Tiềm năng** 9-Box | Điểm Lãnh đạo do người khác chấm: ≥ 3,5 → Cao · ≥ 2,5 → Trung bình · còn lại → Thấp | Chỉ là gợi ý, HR xếp ô thủ công |
| **QĐ-17** | 🟠 | Nguồn trục **Hiệu suất** 9-Box | Nhập tay theo kết quả ĐGNS | Cần nối với hệ thống ĐGNS (Nội dung 2 của chỉ đạo ĐGNS) |
| **QĐ-18** | 🟠 | Năng lực trong chiến dịch 360° quản lý | 12 NL Cốt lõi + Lãnh đạo **đã ban hành** | CO7–CO9 chỉ vào được sau khi ban hành |
| **QĐ-19** | 🟢 | Người được đánh giá có tự xem kết quả 360° của mình không | Có, với người **có tài khoản** (quản lý). Nhân viên không có tài khoản nhận kết quả qua buổi trao đổi với quản lý | Ảnh hưởng tới QĐ-07 khi mở rộng |
| **QĐ-20** | 🟢 | IDP: số mục tiêu và tỷ lệ 70-20-10 | Tối đa 3 mục tiêu mỗi chu kỳ. Mỗi mục tiêu phải có ít nhất 1 hành động học qua công việc. Không gửi duyệt được khi mục tiêu chưa có hành động | |
| **QĐ-22** | 🟠 | Danh sách **vị trí then chốt** và quy tắc gợi ý ứng viên kế thừa | Đang gợi ý người ở ô 9, 8, 6 của 9-Box gần nhất [PROPOSAL] | Danh sách vị trí do Ban TGĐ chốt; nên bắt đầu từ các vị trí L4–L6 |

### Nhóm C — Sản phẩm, hạ tầng, pháp lý

| Mã | Ưu tiên | Câu hỏi | Khuyến nghị [PROPOSAL] |
|---|---|---|---|
| **QĐ-08** | 🟢 | Trợ lý AI trong app dùng gì, gửi dữ liệu gì ra ngoài | Chỉ gửi nội dung Từ điển, không gửi dữ liệu cá nhân. Cần Ban PC&KSNB xác nhận |
| **QĐ-09** | 🟠 | Ma trận phân quyền thực tế | Đã cài theo bảng 3.2. Cần Ban NS&QTHC xác nhận |
| **QĐ-10** | 🔴 *(trước khi nạp nhân sự thật)* | Dữ liệu nhân sự lưu ở máy chủ **Singapore** (Neon, Render) | Ban PC&KSNB xác nhận nghĩa vụ theo NĐ 13/2023 và Luật BVDLCN 91/2025/QH15 (hiệu lực 01/01/2026). Một bản tóm tắt luật nêu ngoại lệ cho việc *lưu dữ liệu nhân viên trên dịch vụ điện toán đám mây*; **pháp chế cần xác nhận ngoại lệ này áp dụng được** [INFERENCE]. Phiếu 360° và IDP cũng là dữ liệu cá nhân. Trong lúc chờ: chỉ nạp mã NV, họ tên, đơn vị, chức danh, quản lý, email công việc |
| **QĐ-11** | 🟠 | Hạ tầng miễn phí hay trả phí | Miễn phí đủ cho thí điểm. Khi mở chiến dịch 360° thật, nâng gói Render để máy chủ không ngủ |
| **QĐ-12** | 🟠 | Ai vận hành hệ thống | Ban CNTT vận hành kỹ thuật; Ban NS&QTHC sở hữu nội dung và giữ quyền ban hành |
| **QĐ-13** | 🟢 | Express hay NestJS | Giữ Express tới hết thí điểm |
| **QĐ-14** | 🟠 | Breakdown FTV, FRT, Văn phòng Chủ tịch | Thiếu thì không gán được phạm vi dữ liệu cho hai đơn vị này |

#### 3.2. Ma trận phân quyền đang cài đặt (QĐ-09) [PROPOSAL]

| Quyền | ADMIN | HR_LEAD | HRBP | LINE_MANAGER |
|---|---|---|---|---|
| Ban hành năng lực, duyệt yêu cầu vai trò, duyệt đối chiếu mã, gán chủ quản, trả lại bản nháp | ✔ | ✔ | — | — |
| Soạn bản nháp năng lực | ✔ | ✔ | ✔ | — |
| Tạo / mở / đóng chiến dịch 360°, nhập hộ phiếu | ✔ | ✔ | — | — |
| Xem kết quả 360° (trong phạm vi) | ✔ | ✔ (toàn bộ) | ✔ (khối được giao) | ✔ (cấp dưới) |
| Xếp ô 9-Box | ✔ | ✔ | ✔ | — |
| Chốt hiệu chỉnh 9-Box | ✔ | ✔ | — | — |
| Lập / sửa kế hoạch kế thừa | ✔ | ✔ | ✔ | — |
| Lập / sửa IDP (trong phạm vi) | ✔ | ✔ | ✔ | ✔ |
| Phê duyệt IDP | ✔ | ✔ | — | ✔ (chỉ cấp dưới trực tiếp) |
| Cấp tài khoản, đặt lại mật khẩu | ✔ | ✔ (trừ ADMIN) | — | — |

---

## 4. Lộ trình đề xuất

| Giai đoạn | Thời lượng tham khảo | Điều kiện | Đầu ra | KPI nghiệm thu |
|---|---|---|---|---|
| 1. Chốt nền | 2 tuần | — | QĐ-02, 03, 10, 15, 16 có văn bản | 100% yêu cầu năng lực ở trạng thái APPROVED |
| 2. Chuyên gia sửa dự thảo | 4–6 tuần | QĐ-04b | 195 ô được duyệt, ban hành v2 cho 45 NL FU và v1 cho CO7–CO9 | 48/48 NL đạt FULL; tỷ lệ ô "giữ nguyên văn AI" được HR rà soát |
| 3. Thí điểm 360° quản lý | 4 tuần | Giai đoạn 1 + QĐ-11 | Cấp tài khoản quản lý; chiến dịch 360° cấp L4–L6 trên 12 NL đã ban hành | Tỷ lệ nộp phiếu ≥ 85% |
| 4. 9-Box & IDP | 4 tuần | Đóng chiến dịch 360° | Xếp ô 9-Box, hiệu chỉnh; IDP cho 100% người tham gia | 100% IDP được quản lý trực tiếp phê duyệt |
| 5. Mở rộng | theo kế hoạch | Kết quả giai đoạn 4 | Kế thừa (QĐ-21), SSO, nhân viên tự đánh giá | — |

> Thời lượng là ước tính để lập kế hoạch, chưa phải cam kết [INFERENCE].

## 5. Rủi ro

| Rủi ro | Mức | Giảm thiểu đã cài |
|---|---|---|
| Chuyên gia chỉ xoá nhãn, không đọc dự thảo AI | Cao | Ghi vết "chấp nhận nguyên văn AI" theo từng mức; HR thấy cảnh báo khi nạp |
| Dùng yêu cầu vai trò "đề xuất" làm căn cứ đánh giá chính thức | Cao | Kết quả 360° đánh dấu * cho mức yêu cầu còn ở trạng thái đề xuất |
| Lộ danh tính người đánh giá | Cao | Ngưỡng ẩn danh; quản lý không thấy tên người chấm nhóm Đồng nghiệp/Cấp dưới; chỉ người quản trị chiến dịch thấy |
| Dữ liệu cá nhân ra nước ngoài chưa có xác nhận pháp lý | Cao | QĐ-10 trước khi nạp dữ liệu thật |
| Mật khẩu tạm bị lộ khi gửi chung | Trung bình | Hiện một lần, bắt đổi ở lần đầu, có đặt lại / khoá |
| Đổi năng lực giữa chiến dịch làm sai lệch điểm | Trung bình | Chốt phiên bản năng lực khi mở chiến dịch; mọi điểm lưu kèm phiên bản |
