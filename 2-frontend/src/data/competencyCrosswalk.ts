/**
 * Bảng đối chiếu mã năng lực Sổ tay (VAL/COR/LEA + tên chuyên môn) → mã Từ điển (CO/LE/FU).
 * SINH TỰ ĐỘNG từ 3-du-lieu/doi_chieu_ma_nang_luc.csv — sửa file CSV rồi sinh lại, không sửa tay file này.
 * Các dòng DE_XUAT là INFERENCE theo tên — chờ Ban NS&QTHC duyệt (QĐ-02).
 */
export interface CrosswalkEntry {
  code: string | null;
  confidence: 'CAO' | 'TRUNG_BINH' | 'THAP' | 'KHONG_CO' | string;
  status: 'DE_XUAT' | 'DA_DUYET' | string;
  note: string;
}

export const COMPETENCY_CROSSWALK: Record<string, CrosswalkEntry> = {
  "VAL01": {
    "code": "CO1",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "Từ điển gộp Chính trực vào CO1 \"Chính trực & Tuân thủ\" (có chấm điểm). Sổ tay để VAL01 là Giá trị không chấm."
  },
  "VAL02": {
    "code": "CO2",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Sổ tay tách VAL02 (niềm tin) và COR06 (hành vi); Từ điển chỉ còn CO2."
  },
  "VAL03": {
    "code": "LE3",
    "confidence": "THAP",
    "status": "DE_XUAT",
    "note": "LE3 là năng lực Lãnh đạo; vai trò không quản lý (vd R13) yêu cầu VAL03 sẽ bị gán năng lực lãnh đạo — cần quyết định."
  },
  "VAL04": {
    "code": "CO5",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Gần nghĩa \"Phối hợp Liên đơn vị\"."
  },
  "VAL05": {
    "code": "FU45",
    "confidence": "THAP",
    "status": "DE_XUAT",
    "note": "Chỉ gần về chủ đề (ESG). FU45 là năng lực chuyên môn, không phải giá trị."
  },
  "COR01": {
    "code": "CO7",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "QĐ-01 (14/10/2026): bổ sung CO7 vào Từ điển, tương đương trực tiếp. CO7 đang là bản nháp."
  },
  "COR02": {
    "code": "CO9",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "QĐ-01 (14/10/2026): bổ sung CO9 vào Từ điển, tương đương trực tiếp. CO9 đang là bản nháp."
  },
  "COR03": {
    "code": "CO8",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "QĐ-01 (14/10/2026): bổ sung CO8 vào Từ điển, tương đương trực tiếp. CO8 đang là bản nháp."
  },
  "COR04": {
    "code": "CO5",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Gần nghĩa \"Phối hợp Liên đơn vị\"."
  },
  "COR05": {
    "code": "CO6",
    "confidence": "THAP",
    "status": "DE_XUAT",
    "note": "CO6 \"Học hỏi & Thích ứng\" chỉ phủ một phần."
  },
  "COR06": {
    "code": "CO2",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "Cùng nội hàm."
  },
  "COR07": {
    "code": "CO1",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Phần tuân thủ → CO1; phần an toàn → CO4. Chọn CO1 làm mặc định."
  },
  "COR08": {
    "code": "CO3",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "CO3 \"Tư duy Phân tích & Dữ liệu\"."
  },
  "LEA01": {
    "code": "LE1",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "LE1 \"Tư duy Chiến lược & Danh mục\"."
  },
  "LEA02": {
    "code": "LE4",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "Cùng nội hàm."
  },
  "LEA03": {
    "code": "LE2",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "LE2 \"Ra quyết định trong điều kiện không chắc chắn\"."
  },
  "LEA04": {
    "code": "LE6",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "LE6 \"Quản trị Đối tác & Các bên liên quan\"."
  },
  "LEA05": {
    "code": "LE5",
    "confidence": "THAP",
    "status": "DE_XUAT",
    "note": "LE5 \"Phát triển Đội ngũ Kế cận\" chỉ phủ một phần."
  },
  "LEA06": {
    "code": "LE3",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "LE3 \"Trách nhiệm giải trình Đầu-Cuối\"."
  },
  "LEA07": {
    "code": "LE1",
    "confidence": "THAP",
    "status": "DE_XUAT",
    "note": "Không có NL riêng; gần nhất là LE1."
  },
  "LEA08": {
    "code": "CO5",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Bị hạ từ Lãnh đạo xuống Cốt lõi."
  },
  "LEA09": {
    "code": "LE2",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Trùng phạm vi với LEA03 → cùng về LE2."
  },
  "LEA10": {
    "code": "LE5",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "LE5 \"Phát triển Đội ngũ Kế cận\"."
  },
  "Thẩm định đầu tư": {
    "code": "FU03",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Phát triển quỹ đất": {
    "code": "FU04",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Phát triển quỹ đất & Pháp lý": {
    "code": "FU04",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "M&A": {
    "code": "FU05",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Nghiên cứu thị trường": {
    "code": "FU01",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quy hoạch & Thiết kế": {
    "code": "FU09",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Thiết kế sản phẩm dịch vụ": {
    "code": "FU15",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản lý dự án XD": {
    "code": "FU10",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Đảm bảo chất lượng": {
    "code": "FU39",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "FU39 \"Đảm bảo Chất lượng Công trình\"."
  },
  "An toàn": {
    "code": "FU12",
    "confidence": "TRUNG_BINH",
    "status": "DE_XUAT",
    "note": "Trong khối Xây dựng → FU12. Nếu là an toàn khách sạn/lữ hành thì nên dùng CO4."
  },
  "Đấu thầu & Nhà thầu": {
    "code": "FU11",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Hợp đồng & Khiếu nại": {
    "code": "FU38",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Mua sắm": {
    "code": "FU36",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Bán hàng & Kênh": {
    "code": "FU13",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Liên kết tín dụng": {
    "code": "FU40",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Bàn giao & Bảo hành": {
    "code": "FU42",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "CSKH & Khiếu nại": {
    "code": "FU41",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản trị thương hiệu": {
    "code": "FU26",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Danh tiếng": {
    "code": "FU27",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "FU27 \"Truyền thông & Quản trị Danh tiếng\"."
  },
  "CRM": {
    "code": "FU28",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Tiêu chuẩn dịch vụ": {
    "code": "FU16",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "FU16 chưa có đơn vị chủ quản."
  },
  "Vận hành lưu trú": {
    "code": "FU17",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Vận hành F&B": {
    "code": "FU18",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản trị doanh thu": {
    "code": "FU23",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "FU23 chưa có đơn vị chủ quản."
  },
  "Thiết kế tour": {
    "code": "FU21",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Điều hành tour": {
    "code": "FU22",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản trị kênh": {
    "code": "FU24",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Huy động vốn": {
    "code": "FU06",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Kiểm soát tài chính": {
    "code": "FU08",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Kế toán": {
    "code": "FU07",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản trị nhân sự & PTTC": {
    "code": "FU33",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Kiểm soát nội bộ": {
    "code": "FU31",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Pháp chế": {
    "code": "FU30",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Quản trị rủi ro": {
    "code": "FU31",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": "FU31 gộp KSNB & Quản trị rủi ro."
  },
  "Công nghệ & Dữ liệu": {
    "code": "FU34",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "An toàn thông tin": {
    "code": "FU35",
    "confidence": "CAO",
    "status": "DE_XUAT",
    "note": ""
  },
  "Một lĩnh vực chuyên sâu": {
    "code": null,
    "confidence": "KHONG_CO",
    "status": "DE_XUAT",
    "note": "Ô giữ chỗ — vai trò chuyên gia phải chọn cụ thể một mã FU."
  }
};
