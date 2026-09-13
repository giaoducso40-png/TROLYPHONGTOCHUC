# Danh sách gói bàn giao UED Tổ chức 2.0.0

Gói ZIP được phát hành không chứa `node_modules`, bản build tạm, cache, Git metadata, tệp nguồn thật hoặc dữ liệu cá nhân thật.

## Thành phần

| Nhóm | Nội dung |
|---|---|
| Mã nguồn | `app/`, `components/`, `db/`, `lib/`, `scripts/`, cấu hình dự án và lockfile |
| Migration | `drizzle/0000` đến `drizzle/0005` và metadata tương ứng |
| Logo | `public/ued-logo.png`, SHA-256 `f5c6059fcbd09af008a174e27f05fb3bfffcd1200fea2335395152e8e8981a87` |
| Mẫu Excel | 5 workbook trong `public/templates/` |
| Dữ liệu mẫu | `sample-data/`, hoàn toàn hư cấu |
| Hướng dẫn | Bản đồ nguồn, sử dụng, phân quyền, sao lưu–khôi phục–đồng bộ và prompt triển khai trong `docs/` |
| Kiểm thử | Kịch bản runtime, v2 acceptance, workbook, nguồn và báo cáo kết quả |
| Phiên bản | `README.md`, `CHANGELOG.md`, `RELEASE_MANIFEST_SHA256.txt` |

## Cách kiểm tra

1. Giải nén vào thư mục riêng.
2. So sánh checksum bằng `sha256sum -c RELEASE_MANIFEST_SHA256.txt` trên Linux/macOS có GNU coreutils.
3. Chạy `npm ci` hoặc quy trình cài đặt nội bộ tương đương.
4. Chạy `npm run qa:all`; đặt `UED_SOURCE_DIR` đến thư mục ba tệp nguồn đúng khi chạy nhóm `qa:sources`.
5. Không đưa tệp `hs1.xlsx` vào thư mục nguồn.

## Nâng cấp an toàn

Giữ nguyên Site/project, binding `DB` và `BUCKET`. Tạo backup JSON v3 trước khi áp dụng migration. Không sao chép dữ liệu mẫu lên dữ liệu thật. Sau nâng cấp, chạy đối soát số lượng, mã, khóa ngoại và checksum trước khi cho phép duyệt.
