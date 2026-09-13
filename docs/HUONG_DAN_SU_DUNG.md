# Hướng dẫn sử dụng UED Tổ chức 2.0.0

## 1. Bắt đầu an toàn

1. Đăng nhập bằng tài khoản Google đã được Quản trị viên cấp quyền.
2. Mở **Sao lưu – Đồng bộ** và tạo bản sao lưu trước đợt nhập lớn.
3. Tải đúng một trong 5 mẫu UED-TC-2.0.0 ngay tại **Trung tâm nhập dữ liệu**.
4. Thay hoặc xóa dòng dữ liệu minh họa trước khi nhập dữ liệu thật.
5. Nhập theo thứ tự phụ thuộc: Đơn vị → Cán bộ/giảng viên → Chức vụ và hợp đồng → Đào tạo/cam kết → Biến động và hồ sơ.

Không sử dụng tệp `hs1.xlsx`; đây là tệp học sinh gửi nhầm và không thuộc nghiệp vụ Phòng Tổ chức.

## 2. Bộ mẫu Excel

| Mẫu | Sheet dữ liệu | Khóa chính/liên kết |
|---|---|---|
| Mẫu 01 – Cán bộ, giảng viên | `CAN_BO_GIANG_VIEN` | `personId`, `staffCode`, `lecturerCode` |
| Mẫu 02 – Đơn vị, chức vụ | `DON_VI`, `CHUC_VU` | `organizationCode`, `assignmentId`, `personId` |
| Mẫu 03 – Hợp đồng | `HOP_DONG` | `contractId`, `personId`, `staffCode` |
| Mẫu 04 – Đào tạo, cam kết | `DAO_TAO_NCS`, `CAM_KET_HOAN_TRA` | `trainingId`, `commitmentId`, `personId` |
| Mẫu 05 – Biến động, hồ sơ | `BIEN_DONG`, `HO_SO_QUYET_DINH` | `eventId`, `fileRecordId`, `ownerEntityId` |

Mỗi workbook có sheet `HUONG_DAN`, `TU_DIEN_TRUONG` và `DANH_MUC`. Không đổi tên sheet, mã trường đứng trước dấu `|` hoặc dòng tiêu đề số 1. Không dùng ô gộp và không chèn dòng trống giữa dữ liệu.

## 3. Nhập dữ liệu

1. Chọn một hoặc nhiều tệp XLSX, XLS, CSV hoặc TSV.
2. Kiểm tra sheet, dòng tiêu đề và số tầng tiêu đề. Với workbook nhiều sheet, xử lý từng sheet dữ liệu riêng.
3. Xác nhận nhóm dữ liệu. Mẫu v2 được nhận diện theo tên sheet trước, tên tệp sau.
4. Kiểm tra ánh xạ từng cột. Mã trường chuẩn đứng trước dấu `|` được ánh xạ tự động.
5. Mở bản xem trước. Sửa lỗi đỏ; đọc và xác minh cảnh báo vàng.
6. Chạy **Chỉ kiểm tra, chưa ghi** trước.
7. Chọn Nhập mới, Cập nhật theo mã hoặc Gộp có kiểm tra rồi bấm **Xác nhận ghi**.
8. Đối chiếu số thêm, cập nhật, trùng, bỏ qua và lỗi; sau đó mở **Chất lượng dữ liệu**.

Một dòng lỗi không làm dừng các dòng hợp lệ. Hệ thống không tự đoán ngày, số hợp đồng hoặc quan hệ người–đơn vị khi chưa đủ căn cứ.

## 4. Tra cứu và cập nhật

- Dùng tìm kiếm toàn cục cho tên, mã cán bộ, số hợp đồng, đơn vị và email.
- Dùng bộ lọc trước khi chọn nhiều dòng; xác nhận lại số bản ghi và phạm vi trước cập nhật hàng loạt.
- Họ tên chỉ dùng tìm kiếm/đối chiếu. Liên kết ưu tiên `personId`, sau đó mã cán bộ; họ tên + ngày sinh chỉ dùng khi kết quả duy nhất.
- Xóa là xóa mềm. Quản trị viên có thể mở **Thùng rác** để khôi phục; mã định danh và lịch sử không đổi.

## 5. Tệp minh chứng

- Chỉ liên kết tệp với hồ sơ nhân sự hoặc hợp đồng đã tồn tại.
- Tệp mới có thể thay thế một phiên bản cũ; hệ thống giữ chuỗi phiên bản và checksum.
- Định dạng hỗ trợ: PDF, DOCX, XLS/XLSX, CSV, PNG, JPG/JPEG, WEBP; tối đa 15 MB.
- Metadata trong mẫu Excel không thay thế thao tác tải byte tệp ở mục **Tệp và minh chứng**.

## 6. Báo cáo

1. Chọn mẫu báo cáo, bộ lọc, cột và thứ tự.
2. Kiểm tra tổng số dòng và bản xem trước.
3. Xuất XLSX, CSV, DOCX, PDF hoặc bản in.
4. Kiểm tra tiêu đề, bộ lọc, logo, số dòng, thời điểm và người xuất trước khi trình ký.

## 7. Quy trình vòng kín

Tải mẫu → điền dữ liệu → chỉ kiểm tra → nhập → đối soát → xuất theo cùng trường → nhập lại ở chế độ cập nhật. Mã, tên, dấu tiếng Việt, ngày, số, ô trống, ghi chú và quan hệ khóa phải giữ nguyên. Nếu khác, dừng duyệt và tải báo cáo lỗi để xác định sheet, dòng, cột và giá trị liên quan.

## 8. Khi mất mạng hoặc có xung đột

Thay đổi hợp lệ được giữ trong outbox và thử lại có giới hạn. Lỗi dữ liệu hoặc lỗi quyền không tự lặp. Khi hai nơi sửa cùng bản ghi, hệ thống giữ bản cục bộ và máy chủ; người có quyền chọn giữ một bản hoặc hợp nhất. Không xóa dữ liệu cục bộ để “sửa nhanh” lỗi đồng bộ.
