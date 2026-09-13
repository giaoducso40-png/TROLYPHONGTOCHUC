# Báo cáo kiểm thử và đối soát bản 2.0.0

Ngày chốt: 13/09/2026. Phạm vi: phần mềm nghiệp vụ dành cho Phòng Tổ chức – Trường Đại học Sư phạm, Đại học Đà Nẵng (UED).

## Kết luận

Bản 2.0.0 vượt qua các cổng kiểm thử tự động về kiểu dữ liệu, lint, build, API, phân quyền, nhập nguồn, đồng bộ, sao lưu và 5 mẫu Excel. Trong phạm vi đã chạy, không phát hiện lỗi nghiêm trọng gây mất dữ liệu, ghi trùng khóa, đứt liên kết, sai checksum hoặc dùng sai logo.

Dữ liệu thật chỉ được đọc trong kiểm thử cục bộ tạm thời. Mã nguồn, mẫu Excel, dữ liệu mẫu và gói bàn giao không chứa dữ liệu cá nhân thật. `hs1.xlsx` bị loại khỏi toàn bộ phân tích và phát hành.

## Nguồn được chấp nhận

| Tệp | SHA-256 | Kết quả |
|---|---|---|
| `Nam 2026 (cap nhat).xls` | `12f824de4b237df66540afb11582b44b884ef6c994e4c048cab909cb6c2a36f4` | 13 sheet được nhận diện |
| `THONG KE HOP DONG TOAN TRUONG(1).xlsx` | `a6b59279bfe1d051e5a01d513b8558b48ce9ca1b148704c26e739a87b7cade31` | 6 sheet, 423 hợp đồng |
| `THONG KE HOP DONG XDTH(1).xlsx` | `f3b5ac0da603f02c99e3bcd5475f1c39bd5e9f9b58eece59c7994f4b282ceba5` | 89/89 dòng trùng nguồn chính; không cộng lần hai |

## Đối soát dữ liệu nguồn

| Hạng mục | Kết quả |
|---|---:|
| Hồ sơ kỳ T8/2026 | 384 |
| Nam / Nữ | 169 / 215 |
| Đơn vị | 17 |
| Tiến sĩ / Thạc sĩ / Đại học / Khác | 204 / 109 / 55 / 16 |
| Giáo sư / Phó giáo sư | 1 / 40 |
| Hợp đồng không trùng | 423 |
| Liên kết chính xác với hồ sơ | 363 |
| Liên kết cần người quản trị xác minh | 60 |
| Thiếu số hợp đồng | 9 |
| Ngày sinh nguồn không hợp lệ, giữ raw data | 5 |
| Liên kết gãy sau nhập thử | 0 |
| Mã cán bộ trùng sau nhập thử | 0 |

## Cổng kiểm thử phần mềm

Lệnh tổng hợp: `npm run qa:all`.

| Nhóm | Kết quả |
|---|---|
| TypeScript | Đạt, không lỗi kiểu dữ liệu |
| ESLint | Đạt |
| Build và kiểm thử tĩnh | Đạt |
| API runtime nền tảng | 15/15 nhóm đạt |
| Nghiệm thu API v2 | 20/20 kịch bản đạt |
| Kiểm tra 5 workbook | 5/5 đạt |
| Đọc và đối soát nguồn đúng | Đạt |
| Nhập thử nguồn vào D1 tạm | Đạt; không phát hành dữ liệu thật |

Hai mươi kịch bản v2 bao phủ bootstrap quản trị, mã đơn vị ổn định, hồ sơ mở rộng, chặn trùng mã giảng viên, cập nhật hàng loạt, liên kết hợp đồng, logic ngày, xung đột phiên bản, giới hạn 5 tài khoản, từ chối tài khoản chưa cấp, phạm vi đọc/ghi, bốn vai trò, danh mục và mốc cảnh báo, phiên bản tệp, xóa mềm/hoàn tác, backup v3, kiểm tra checksum khôi phục, dashboard động, lô 1.000 dòng giữ `personId`, và idempotency khi retry.

## Kiểm định bộ mẫu UED-TC-2.0.0

- Đủ 5 workbook và 8 sheet dữ liệu nghiệp vụ.
- Dòng tiêu đề cố định ở dòng 1; có bảng lọc, frozen panes và danh mục kiểm tra nhập.
- Ngày lưu dạng ngày, số tiền/hệ số/phiên bản lưu dạng số; định dạng hiển thị được khai báo.
- Không có merged cell; dữ liệu ví dụ liên tục và hoàn toàn hư cấu.
- Mỗi workbook có từ điển trường, danh mục và hướng dẫn riêng.
- Cả 5 workbook chứa đúng byte ảnh logo UED có SHA-256 `f5c6059fcbd09af008a174e27f05fb3bfffcd1200fea2335395152e8e8981a87`.
- Artifact renderer đã kiểm tra trực quan từng sheet; LibreOffice headless mở và xuất được 5/5 workbook.
- Quét công thức không phát hiện `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`, `#NUM!`, `#NULL!`, `#SPILL!` hoặc `#CALC!`.

## An toàn và giới hạn vận hành

- Danh tính do nền tảng Site cung cấp; ứng dụng không yêu cầu hoặc lưu mật khẩu Gmail.
- API kiểm tra quyền và phạm vi đơn vị phía máy chủ; dữ liệu nhạy cảm chỉ trả về cho vai trò được phép.
- D1 là dữ liệu dùng chung; không dùng Drive `appDataFolder` cá nhân làm cơ sở dữ liệu trung tâm.
- Tệp R2 có owner, phiên bản, MIME, kích thước và checksum; không lưu byte tệp trong backup JSON.
- Chưa tuyên bố nghiệm thu trên thiết bị vật lý của đơn vị. Trước khi nạp dữ liệu thật, cần một vòng nghiệm thu trực quan trên máy tính, máy tính bảng và điện thoại thực tế của UED.

## Điều kiện vận hành dữ liệu thật

1. Xác nhận tối đa 5 tài khoản, vai trò và phạm vi đơn vị.
2. Sao lưu JSON v3 trước lần nhập chính thức.
3. Nhập danh mục đơn vị trước hồ sơ và các bảng phụ thuộc.
4. Xử lý 60 liên kết chờ xác minh; không ghép bằng họ tên đơn lẻ.
5. Xác minh 9 hợp đồng thiếu số và 5 ngày sinh nguồn lỗi.
6. Đối soát số lượng, khóa ngoại và checksum sau từng đợt; chỉ duyệt khi đạt.
