# Changelog

## 2.0.0 – 2026-09-13

- Mở rộng schema lên 23 bảng với mã giảng viên, loại nhân sự, CCCD, thuế, BHXH, quê quán, chuyên môn, bố trí làm việc, hệ số lương, chức vụ, năm học và thiết lập hệ thống.
- Chuẩn hóa bốn vai trò, giới hạn 5 tài khoản Google hoạt động và áp dụng phạm vi đơn vị ở cả đọc lẫn ghi.
- Thêm dashboard động, bộ lọc thời hạn 7/15/30/60/90 ngày, lưới nghiệp vụ và báo cáo nhiều định dạng.
- Thêm chuỗi phiên bản tệp minh chứng, xóa mềm hàng loạt, thùng rác, hoàn tác, outbox retry và sao lưu JSON v3 có checksum.
- Phát hành 5 mẫu Excel UED-TC-2.0.0, dùng `personId`/`contractId`, không ô gộp, có validation và logo UED chính thức.
- Bổ sung 20 kịch bản nghiệm thu API v2 và bộ kiểm tra tự động riêng cho 5 workbook.
- Giữ tương thích migration với dữ liệu cũ; không thay namespace D1/R2 và không xóa dữ liệu khi nâng cấp.

## 1.0.0 – 2026-09-09

- Xây dựng 14 màn hình nghiệp vụ Phòng Tổ chức, responsive từ 320 px.
- Tích hợp logo UED chính thức và giao diện tiếng Việt.
- Hoàn thiện schema D1 20 bảng, kho tệp R2, RBAC, audit, checksum, version và xóa mềm.
- Hỗ trợ nhập 8 nhóm dữ liệu với nhận diện sheet/tiêu đề, ánh xạ, xem trước, kiểm tra và chống trùng.
- Hỗ trợ XLS/XLSX/CSV/TSV; xuất XLSX/CSV/DOCX/PDF/bản in.
- Tạo bộ mẫu Excel UED-TC-1.0.0 gồm 18 sheet và danh mục/validation.
- Đối soát đúng 384 hồ sơ T8, 423 hợp đồng không trùng; loại nguồn học sinh gửi nhầm.
- Thêm hàng đợi ngoại tuyến, idempotency, kiểm tra xung đột và snapshot sau nhập.
- Chốt 363 liên kết chính xác; chuyển 60 trường hợp chưa đủ khóa sang hàng chờ xác minh, không ghép theo họ tên đơn lẻ.
- Bổ sung bộ kiểm tra hồi quy API, nhập nguồn thật trong CSDL tạm và báo cáo nghiệm thu không chứa PII.
