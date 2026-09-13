# Hướng dẫn quản trị và phân quyền 2.0.0

Quyền được kiểm tra tại API. Việc ẩn nút trên giao diện chỉ hỗ trợ thao tác, không thay thế kiểm soát máy chủ.

## Bốn vai trò chuẩn

| Vai trò | Xem | Dữ liệu nhạy cảm | Nhập/sửa | Xuất | Duyệt | Khôi phục | Quản trị |
|---|---:|---:|---:|---:|---:|---:|---:|
| Quản trị viên | Có | Có | Có | Có | Có | Có | Có |
| Người nhập liệu | Có | Theo phạm vi | Có | Có | Không | Không | Không |
| Người kiểm tra | Có | Có | Không | Có | Có | Không | Không |
| Người chỉ xem | Có | Không | Không | Có | Không | Không | Không |

Các tên vai trò cũ được ánh xạ tương thích: Quản trị hệ thống → Quản trị viên; Cán bộ Phòng Tổ chức → Người nhập liệu; Trưởng phòng → Người kiểm tra; Người xem/báo cáo và Kiểm toán → Người chỉ xem.

## Cấp tài khoản

1. Xác minh email Google và đơn vị công tác của người dùng.
2. Cấp vai trò tối thiểu đủ dùng; không dùng chung tài khoản.
3. Chọn **Toàn trường** hoặc đúng một phạm vi đơn vị. API áp dụng phạm vi ở cả truy vấn và thao tác ghi.
4. Kiểm tra bằng tài khoản thử trước khi dùng dữ liệu thật.
5. Khi người dùng điều chuyển hoặc nghỉ việc, khóa tài khoản thay vì xóa lịch sử.

Hệ thống cho phép tối đa 5 tài khoản đang hoạt động. Muốn cấp tài khoản thứ sáu, Quản trị viên phải khóa một tài khoản đang hoạt động trước. Không thể khóa hoặc hạ quyền Quản trị viên cuối cùng.

## Khởi tạo môi trường mới

Khi chưa có bản ghi phân quyền, tài khoản đầu tiên truy cập được bootstrap thành Quản trị viên. Sau đó phải cấp quyền có chủ đích cho các tài khoản còn lại và giữ Site ở phạm vi riêng tư của workspace/chủ sở hữu.

## Rà soát định kỳ

- Kiểm tra tài khoản đang hoạt động, vai trò và phạm vi đơn vị.
- Kiểm tra nhật ký xuất dữ liệu, cập nhật hàng loạt, xóa, khôi phục và đổi quyền.
- Không ghi mật khẩu Gmail, access token hoặc client secret vào ứng dụng, mẫu Excel hay nhật ký.
- Thu hồi quyền ngay khi phát hiện tài khoản không còn thuộc phạm vi sử dụng.
