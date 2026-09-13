# Bản đồ và biên bản đối soát dữ liệu nguồn

Ngày kiểm tra cấu trúc: 08/09/2026. Phạm vi chỉ dành cho Phòng Tổ chức UED.

## Tệp được phép dùng

| Tệp | Vai trò | Kết luận |
|---|---|---|
| `Nam 2026 (cap nhat).xls` | Ảnh chụp đội ngũ T01–T08 và các danh sách đào tạo phụ | Nguồn hồ sơ đội ngũ |
| `THONG KE HOP DONG TOAN TRUONG(1).xlsx` | Sáu nhóm hợp đồng toàn trường | Nguồn hợp đồng chính |
| `THONG KE HOP DONG XDTH(1).xlsx` | 89 hợp đồng xác định thời hạn | Trùng tuyệt đối 89/89 với sheet cùng tên của tệp toàn trường; không cộng lần hai |

Tệp học sinh gửi nhầm đã bị loại hoàn toàn khỏi phạm vi xử lý.

## Hồ sơ đội ngũ

| Kỳ | Dòng tiêu đề | Dòng dữ liệu đầu | Tổng | Nam | Nữ |
|---|---:|---:|---:|---:|---:|
| T01 | 5–6 | 7 | 380 | 163 | 217 |
| T02 | 5–6 | 7 | 380 | 163 | 217 |
| T03 | 5–6 | 7 | 381 | 164 | 217 |
| T04 | 5–6 | 7 | 382 | 165 | 217 |
| T05 | 5–6 | 7 | 381 | 165 | 216 |
| T06 | 5–6 | 7 | 383 | 167 | 216 |
| T07 | 5–7 | 8 | 382 | 167 | 215 |
| T08 | 5–7 | 8 | 384 | 169 | 215 |

T08 có 17 đơn vị. Phân bố trình độ kiểm tra được: 204 tiến sĩ, 109 thạc sĩ, 55 đại học và 16 khác/chưa rõ; tổng đúng 384. Học hàm: 1 giáo sư, 40 phó giáo sư. Vùng nghiệp vụ T07–T08 kết thúc ở cột AQ.

Tệp đội ngũ không có mã cán bộ ổn định. Khi nhập chính thức, hệ thống tạo `person_id` nội bộ, giữ khóa dòng nguồn và yêu cầu bổ sung mã cán bộ trước các thao tác liên kết nhạy cảm. Họ tên đơn lẻ không được dùng làm khóa.

## Hợp đồng

| Nhóm | Số dòng |
|---|---:|
| Xác định thời hạn | 89 |
| Không xác định thời hạn | 283 |
| Giảng viên trình độ cao đã nghỉ hưu | 9 |
| Học việc | 4 |
| Chuyên môn – nghiệp vụ | 5 |
| Thỉnh giảng | 33 |
| **Tổng không trùng** | **423** |

Theo mốc kiểm tra 08/09/2026: 407 đang hiệu lực, 15 đã hết hạn, 1 đã thanh lý; 0 hết hạn trong 30 ngày, 2 trong 60 ngày và 3 trong 90 ngày. Có 9 dòng thiếu số hợp đồng. Đối chiếu người theo quy tắc không ghép tên đơn lẻ: 363 liên kết chính xác; 15 chỉ khớp tên cần xác minh; 45 chưa khớp hoặc là người ngoài trường.

## Quy tắc ánh xạ cốt lõi

| Nguồn | Trường đích | Quy tắc |
|---|---|---|
| Họ + tên | `full_name` | Ghép có khoảng trắng, giữ dấu |
| Ngày sinh Nam/Nữ | `birth_date`, `gender` | Lấy đúng ô có giá trị, không suy đoán |
| Đơn vị nguồn | `organization_id`, `organization_name_source` | Mã danh mục là khóa; tên gốc vẫn được giữ |
| Nhóm học hàm/học vị | `qualifications` | Tách độc lập theo loại và lịch sử |
| Hợp đồng | `contract_id`, `source_identity_key` | Ưu tiên mã hợp đồng; nếu nguồn cũ thiếu mã thì dùng khóa ghép có checksum |
| Chức vụ | `person_assignments` | Mỗi phân công là một dòng có hiệu lực |
| Đào tạo/cam kết | `training_records`, `training_commitments` | Liên kết bằng `person_id`; kiểm tra thứ tự ngày |
| Tài liệu | `document_records`, `file_records` | Metadata và tệp nhị phân tách riêng, cùng mã hồ sơ đích |

Mọi giá trị không tách được an toàn được giữ trong `raw_data` và đưa vào báo cáo lỗi/cảnh báo; hệ thống không tự bịa giá trị thiếu.
