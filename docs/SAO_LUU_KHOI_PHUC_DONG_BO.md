# Sao lưu, khôi phục và đồng bộ 2.0.0

## Nguồn sự thật

- D1 lưu 23 bảng nghiệp vụ và hệ thống.
- R2 lưu byte tệp; D1 giữ metadata, owner, phiên bản và checksum.
- IndexedDB trên trình duyệt chỉ giữ hàng đợi ngoại tuyến, không thay thế D1.
- Namespace và binding `DB`/`BUCKET` được giữ nguyên qua migration.

## Đồng bộ

Mỗi thao tác ghi mang `x-idempotency-key`. Máy chủ kiểm tra danh tính, vai trò, phạm vi đơn vị, khóa chống lặp và phiên bản trước khi ghi. Lỗi mạng, 408, 425, 429, 502, 503 và 504 được giữ để thử lại với backoff; lỗi dữ liệu hoặc lỗi quyền dừng ngay và yêu cầu sửa. Thời gian chờ tăng dần, tối đa 5 phút.

Khi có xung đột phiên bản, máy chủ tạo bản ghi trong `sync_conflicts`; không tự ghi đè. Nút **Thử lại lỗi** chỉ gửi lại outbox thất bại. Nút **Đối soát** kiểm tra số lượng, mã bản ghi, khóa ngoại, mã trùng và checksum.

## Sao lưu JSON phiên bản 3

Gói sao lưu chứa dữ liệu cấu trúc nghiệp vụ, danh mục, cảnh báo, import, snapshot và xung đột. Gói cố ý không chứa:

- `user_roles` và thông tin cấp quyền;
- `file_records` cùng byte tệp R2;
- `audit_logs`;
- `idempotency_keys`;
- mật khẩu, access token hoặc client secret.

Checksum SHA-256 được tính trên nội dung chuẩn hóa. Quản trị viên nên sao lưu trước đợt nhập lớn, sửa hàng loạt, migration hoặc khôi phục.

## Khôi phục

1. Tạo bản sao lưu hiện tại trước khi thử khôi phục.
2. Chọn đúng JSON có `format=ued-organization-backup`, `version=3` và checksum còn nguyên.
3. Kiểm tra số bảng và tổng số dòng trong bản xem trước.
4. Nhập lý do rồi xác nhận bằng tài khoản Quản trị viên.
5. Chạy đối soát ngay sau khôi phục.

Nếu checksum sai, phiên bản không hỗ trợ hoặc dữ liệu không hợp lệ, hệ thống từ chối trước khi ghi. Khôi phục dùng giao dịch có kiểm soát và không xóa byte R2 chỉ vì metadata bị xóa mềm.

## Xử lý sự cố

- **Mất mạng:** giữ outbox, kết nối lại rồi bấm Thử lại lỗi.
- **Hết phiên/quyền:** đăng nhập hoặc xin cấp lại quyền; không sao chép token vào mã nguồn.
- **Xung đột:** so sánh bản cục bộ/máy chủ theo từng trường và chọn phương án có lý do.
- **Đối soát không đạt:** dừng duyệt, tải báo cáo, sửa bản ghi cụ thể và đối soát lại.
- **Nâng cấp:** sao lưu trước migration; sau migration kiểm tra tổng dòng, khóa, quan hệ và checksum, không đổi namespace.
