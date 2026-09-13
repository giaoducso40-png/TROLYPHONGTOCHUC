export const SOURCE_AS_OF = "08/09/2026";

export const monthlyWorkforce = [
  { month: "T01", total: 380, male: 163, female: 217 },
  { month: "T02", total: 380, male: 163, female: 217 },
  { month: "T03", total: 381, male: 164, female: 217 },
  { month: "T04", total: 382, male: 165, female: 217 },
  { month: "T05", total: 381, male: 165, female: 216 },
  { month: "T06", total: 383, male: 167, female: 216 },
  { month: "T07", total: 382, male: 167, female: 215 },
  { month: "T08", total: 384, male: 169, female: 215 },
];

export const degreeDistribution = [
  { name: "Tiến sĩ", value: 204, color: "#0065a8" },
  { name: "Thạc sĩ", value: 109, color: "#13a89e" },
  { name: "Đại học", value: 55, color: "#f2b544" },
  { name: "Khác/chưa rõ", value: 16, color: "#94a3b8" },
];

export const sourceFiles = [
  {
    id: "staff-2026",
    file: "Nam 2026 (cap nhat).xls",
    purpose: "Đội ngũ cán bộ, viên chức theo tháng",
    status: "mapped",
    sheets: [
      { name: "T01", header: "5–6", rows: 380, note: "Ảnh chụp tháng 01/2026" },
      { name: "T02", header: "5–6", rows: 380, note: "Ảnh chụp tháng 02/2026" },
      { name: "T3", header: "5–6", rows: 381, note: "Ảnh chụp tháng 03/2026" },
      { name: "T4", header: "5–6", rows: 382, note: "Ảnh chụp tháng 04/2026" },
      { name: "T5", header: "5–6", rows: 381, note: "Ảnh chụp tháng 05/2026" },
      { name: "T6", header: "5–6", rows: 383, note: "Ảnh chụp tháng 06/2026" },
      { name: "T7", header: "5–7", rows: 382, note: "Mẫu mở rộng; dữ liệu bắt đầu dòng 8, vùng nghiệp vụ đến AQ" },
      { name: "T8", header: "5–7", rows: 384, note: "Mẫu hiện hành; dữ liệu bắt đầu dòng 8, vùng nghiệp vụ đến AQ" },
      { name: "Thanh cap nhat", header: "5–7", rows: 357, note: "356 dòng có STT và 1 hồ sơ thiếu STT nhưng có họ tên; giữ để kiểm tra, không làm mất dòng" },
      { name: "DS VC da & dang hoc tap o NN", header: "4–5", rows: 74, note: "74 dòng có STT + họ tên; không tính dòng trống cuối vùng" },
      { name: "Den bu chi phi dao tao", header: "5–6", rows: 7, note: "Cam kết/đền bù đào tạo" },
      { name: "Tot nghiep o NN", header: "Không có", rows: 42, note: "Danh sách phụ; cần xác nhận ý nghĩa cột" },
    ],
  },
  {
    id: "contract-fixed",
    file: "THONG KE HOP DONG XDTH(1).xlsx",
    purpose: "Hợp đồng xác định thời hạn",
    status: "duplicate",
    sheets: [{ name: "HDLV XĐTH", header: "1", rows: 89, note: "Trùng khớp 89/89 với sheet cùng tên trong tệp toàn trường; không nhập lần hai" }],
  },
  {
    id: "contract-all",
    file: "THONG KE HOP DONG TOAN TRUONG(1).xlsx",
    purpose: "Hợp đồng toàn trường",
    status: "mapped",
    sheets: [
      { name: "HDLV XĐTH", header: "1", rows: 89, note: "Hợp đồng xác định thời hạn" },
      { name: "HDLV KXDTH", header: "1", rows: 283, note: "Hợp đồng không xác định thời hạn" },
      { name: "HDLD NGHI HUU TD CAO", header: "3", rows: 9, note: "Giảng viên trình độ cao đã nghỉ hưu" },
      { name: "HOP DONG HOC VIEC", header: "3", rows: 4, note: "Hợp đồng học việc" },
      { name: "HDLD CM-NV", header: "3", rows: 5, note: "Hợp đồng chuyên môn – nghiệp vụ" },
      { name: "HD THINH GIANG", header: "3", rows: 33, note: "Có dòng phân kỳ năm 2025/2026, không xem là dữ liệu cá nhân" },
    ],
  },
] as const;

export const contractMetrics = {
  total: 423,
  active: 407,
  expired: 15,
  terminated: 1,
  expiring30: 0,
  expiring60: 2,
  expiring90: 3,
  missingNumbers: 9,
  duplicateNumbers: 85,
  exactDuplicateRowsSkipped: 89,
};

export const contractTypes = [
  { name: "Không xác định thời hạn", value: 283, color: "#0065a8" },
  { name: "Xác định thời hạn", value: 89, color: "#13a89e" },
  { name: "Thỉnh giảng", value: 33, color: "#7c5ce7" },
  { name: "GV nghỉ hưu trình độ cao", value: 9, color: "#f2b544" },
  { name: "Chuyên môn – nghiệp vụ", value: 5, color: "#ef7d56" },
  { name: "Học việc", value: 4, color: "#94a3b8" },
];

export const dataMap = [
  { source: "A", sourceName: "Số TT", target: "—", type: "Số", required: false, note: "Chỉ dùng đối chiếu dòng; không làm khóa" },
  { source: "B + C", sourceName: "Họ và tên", target: "full_name", type: "Văn bản", required: true, note: "Ghép có khoảng trắng, giữ nguyên dấu" },
  { source: "D / E", sourceName: "Ngày sinh Nam / Nữ", target: "birth_date + gender", type: "Ngày", required: true, note: "Lấy ô có giá trị; không tự đoán giới tính" },
  { source: "F", sourceName: "Đơn vị công tác", target: "organization_name_source", type: "Văn bản", required: true, note: "Chuẩn hóa qua bảng danh mục đơn vị" },
  { source: "G", sourceName: "Chức vụ", target: "position", type: "Danh mục", required: false, note: "Giữ cả giá trị nguồn" },
  { source: "H:L", sourceName: "Đảng/đoàn thể/HĐT", target: "organization_roles", type: "Nhóm trường", required: false, note: "Không gộp thành một ô thống kê" },
  { source: "M:R", sourceName: "Chức danh nghề nghiệp", target: "professional_title", type: "Danh mục", required: false, note: "Suy ra từ cột có dấu/giá trị" },
  { source: "S:T", sourceName: "Học hàm", target: "academic_title + year", type: "Danh mục/năm", required: false, note: "GS/PGS quản lý riêng" },
  { source: "U:X", sourceName: "Trình độ chuyên môn", target: "degree_level + year", type: "Danh mục/năm", required: false, note: "TS/ThS/ĐH/Khác quản lý riêng" },
  { source: "Y:AJ (T7–T8)", sourceName: "Chi tiết đào tạo TS/ThS/ĐH", target: "education_history[]", type: "Nhóm lặp", required: false, note: "Ba nhóm Năm–Chuyên ngành–Nước–Ngoại ngữ; giữ độc lập theo bậc" },
  { source: "AK (T7–T8) / Y (T01–T6)", sourceName: "Ngành/chuyên ngành bậc cao nhất", target: "major", type: "Văn bản", required: false, note: "Không đổi nội dung nguồn; T6 dịch cột do thêm Khối ngành" },
  { source: "AL (T7–T8) / Z (T6)", sourceName: "Khối ngành", target: "discipline_group", type: "Danh mục", required: false, note: "Chỉ có từ T6; các tháng trước để trống" },
  { source: "AM (T7–T8) / Z:AA (T01–T6)", sourceName: "Nơi đào tạo", target: "institution / country", type: "Văn bản", required: false, note: "Lưu nguyên văn ở cơ sở đào tạo; chỉ tách quốc gia khi nguồn ghi rõ" },
  { source: "AN (T7–T8) / AA:AB (T01–T6)", sourceName: "Ngoại ngữ", target: "foreign_language", type: "Văn bản", required: false, note: "Không suy diễn trình độ" },
  { source: "AO (T7–T8) / AB:AC (T01–T6)", sourceName: "Tin học", target: "informatics", type: "Văn bản", required: false, note: "Giữ nguyên chứng chỉ/học vị" },
  { source: "AP (T7–T8) / AC:AD (T01–T6)", sourceName: "Đi học NCS", target: "phd_status", type: "Văn bản/thời hạn", required: false, note: "Quét mốc thời gian để cảnh báo" },
  { source: "AQ (T7–T8) / AD:AE (T01–T6)", sourceName: "Ghi chú", target: "notes", type: "Văn bản", required: false, note: "Không dùng làm trường thống kê chính" },
] as const;

export const contractMap = [
  { sourceName: "Họ tên + Ngày sinh", target: "person_id", rule: "Đối chiếu chính xác; không dùng họ tên đơn lẻ làm khóa" },
  { sourceName: "Đơn vị/Khoa giảng dạy", target: "using_organization_id", rule: "Ánh xạ danh mục, lưu tên nguồn song song" },
  { sourceName: "Loại/sheet hợp đồng", target: "contract_type", rule: "Suy ra từ sheet đã xác nhận" },
  { sourceName: "Số HĐ", target: "contract_number", rule: "Không tự sinh nếu thiếu; chuyển trạng thái chờ bổ sung" },
  { sourceName: "Ngày ký/hiệu lực", target: "signed_date/effective_date", rule: "Chuẩn ISO, giữ giá trị gốc" },
  { sourceName: "Thời gian hợp đồng", target: "start_date/end_date/period_text", rule: "Tách khi đúng mẫu ngày; nếu không thì giữ nguyên để xác minh" },
  { sourceName: "Số tháng", target: "duration_months", rule: "Đối chiếu với khoảng ngày, không ghi đè" },
  { sourceName: "Ghi chú", target: "notes/termination", rule: "Chỉ tách thanh lý khi có câu chữ rõ ràng" },
] as const;

export const qualityFindings = [
  { id: "DQ-001", severity: "high", title: "Chưa có mã cán bộ ổn định trong tệp đội ngũ", count: 384, action: "Cấp/nhập mã cán bộ trước khi duyệt dữ liệu chính thức" },
  { id: "DQ-002", severity: "high", title: "Số hợp đồng để trống", count: 9, action: "Xác minh tại sheet HDLV KXDTH; không tự sinh số" },
  { id: "DQ-003", severity: "medium", title: "Số hợp đồng lặp theo phạm vi/loại", count: 85, action: "Đối chiếu theo loại, năm, người và ngày hiệu lực" },
  { id: "DQ-004", severity: "medium", title: "Liên kết hợp đồng–nhân sự chưa khớp chính xác", count: 60, action: "Xác nhận 15 trường hợp chỉ khớp tên và 45 trường hợp chưa khớp/người ngoài trường" },
  { id: "DQ-005", severity: "info", title: "Tệp XĐTH riêng trùng với tệp toàn trường", count: 89, action: "Hệ thống đã đánh dấu bỏ qua 89 dòng trùng tuyệt đối" },
] as const;

export const syntheticPeople = [
  { id: "demo-001", staffCode: "VC-DEMO-001", fullName: "Nguyễn Minh An", birthDate: "1987-03-12", gender: "Nữ", unit: "Khoa Toán – Tin", position: "Giảng viên", degree: "Tiến sĩ", status: "Đang công tác", sync: "Đã đồng bộ" },
  { id: "demo-002", staffCode: "VC-DEMO-002", fullName: "Trần Hải Bình", birthDate: "1982-11-04", gender: "Nam", unit: "Phòng Tổ chức", position: "Chuyên viên", degree: "Thạc sĩ", status: "Đang công tác", sync: "Đã đồng bộ" },
  { id: "demo-003", staffCode: "VC-DEMO-003", fullName: "Lê Thu Hà", birthDate: "1990-06-18", gender: "Nữ", unit: "Khoa Sử – Địa – Chính trị", position: "Giảng viên", degree: "Tiến sĩ", status: "Đang công tác", sync: "Chờ gửi" },
  { id: "demo-004", staffCode: "VC-DEMO-004", fullName: "Phạm Đức Long", birthDate: "1979-09-26", gender: "Nam", unit: "Phòng Hành chính", position: "Chuyên viên chính", degree: "Thạc sĩ", status: "Đang công tác", sync: "Đã đồng bộ" },
  { id: "demo-005", staffCode: "VC-DEMO-005", fullName: "Võ Ngọc Mai", birthDate: "1993-01-08", gender: "Nữ", unit: "Khoa Lý – Hóa", position: "Giảng viên", degree: "Tiến sĩ", status: "Đi học", sync: "Đã đồng bộ" },
];

export const syntheticContracts = [
  { id: "contract-demo-001", number: "124/HĐLV-DEMO", person: "Nguyễn Minh An", type: "Xác định thời hạn", unit: "Khoa Toán – Tin", start: "01/01/2026", end: "31/12/2028", status: "Đang hiệu lực", days: 845 },
  { id: "contract-demo-002", number: "208/HĐLĐ-DEMO", person: "Trần Hải Bình", type: "Không xác định thời hạn", unit: "Phòng Tổ chức", start: "01/08/2024", end: "—", status: "Đang hiệu lực", days: null },
  { id: "contract-demo-003", number: "071/HĐHV-DEMO", person: "Lê Thu Hà", type: "Học việc", unit: "Khoa Sử – Địa – Chính trị", start: "01/10/2025", end: "30/09/2026", status: "Sắp hết hạn", days: 22 },
  { id: "contract-demo-004", number: "056/HĐTG-DEMO", person: "Phạm Đức Long", type: "Thỉnh giảng", unit: "Khoa Lý – Hóa", start: "01/09/2025", end: "31/08/2026", status: "Đã hết hạn", days: -8 },
];

export const demoAlerts = [
  { id: "AL-DEMO-001", severity: "urgent", title: "Hợp đồng sắp hết hạn trong 30 ngày", subject: "071/HĐHV-DEMO · Lê Thu Hà", due: "30/09/2026", days: 22, assignee: "Cán bộ Phòng Tổ chức", status: "Chưa xử lý" },
  { id: "AL-DEMO-002", severity: "warning", title: "Thiếu số hợp đồng", subject: "9 bản ghi · HDLV KXDTH", due: "—", days: null, assignee: "Người nhập liệu", status: "Chờ xác minh" },
  { id: "AL-DEMO-003", severity: "warning", title: "Chưa khớp hồ sơ nhân sự", subject: "60 liên kết cần duyệt", due: "—", days: null, assignee: "Trưởng phòng", status: "Chưa xử lý" },
  { id: "AL-DEMO-004", severity: "info", title: "Đã ngăn nhập trùng", subject: "89 dòng XĐTH trùng tuyệt đối", due: "08/09/2026", days: 0, assignee: "Hệ thống", status: "Đã xử lý" },
];
