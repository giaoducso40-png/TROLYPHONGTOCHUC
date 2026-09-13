# UED Tổ chức 2.0.0

Ứng dụng quản lý nghiệp vụ dành cho Phòng Tổ chức – Trường Đại học Sư phạm, Đại học Đà Nẵng (UED). Hệ thống quản lý hồ sơ nhân sự, cơ cấu đơn vị, chức vụ, hợp đồng, biến động, đào tạo, cam kết, tệp minh chứng, cảnh báo, báo cáo, nhật ký và đồng bộ ngoại tuyến.

## Nguyên tắc dữ liệu

- D1 là nguồn dữ liệu cấu trúc dùng chung; R2 lưu nội dung tệp minh chứng.
- `person_id`, `contract_id`, mã cán bộ và các mã nghiệp vụ ổn định dùng để liên kết; họ tên không phải khóa duy nhất.
- Mỗi thay đổi có phiên bản, checksum, người sửa, trạng thái đồng bộ và nhật ký.
- Nhập dữ liệu luôn theo luồng nhận diện → chọn sheet/tiêu đề → ánh xạ → xem trước → kiểm tra → xác nhận ghi.
- Tệp XĐTH độc lập trùng 89/89 dòng với sheet XĐTH trong tệp toàn trường nên không được cộng hai lần.
- Tệp học sinh gửi nhầm không thuộc phạm vi và không được dùng trong mã nguồn, dữ liệu mẫu hoặc bản phát hành.

## Tính năng chính của bản 2.0.0

- Giao diện responsive tiếng Việt cho 13 nhóm màn hình nghiệp vụ Phòng Tổ chức.
- Dashboard và báo cáo lấy dữ liệu động, lọc theo đơn vị, loại hợp đồng và các mốc 7/15/30/60/90 ngày.
- Lưới hồ sơ, đơn vị và hợp đồng có tìm kiếm, lọc, phân trang, sửa, chọn nhiều dòng, xóa mềm và khôi phục.
- Bốn vai trò chuẩn: Quản trị viên, Người nhập liệu, Người kiểm tra, Người chỉ xem; giới hạn tối đa 5 tài khoản Google hoạt động và có phạm vi đơn vị.
- Sao lưu JSON phiên bản 3 có checksum; loại trừ tài khoản, nhật ký, idempotency và byte tệp R2.
- Năm mẫu Excel UED-TC-2.0.0 có khóa liên kết, kiểu ngày–số, danh mục chọn, từ điển trường và logo UED chính thức.

## Chạy và kiểm tra

Yêu cầu Node.js `>=22.13.0`.

```bash
npm run dev
npm run qa:all
```

Các cổng kiểm tra riêng:

```bash
npm run typecheck
npm run lint
npm test
npm run qa:runtime
npm run qa:v2
npm run qa:templates
npm run qa:sources
```

Sau khi sửa `db/schema.ts`, sinh migration bằng `npm run db:generate`.

Site dùng các binding tại `.openai/hosting.json`:

- `DB`: Cloudflare D1.
- `BUCKET`: Cloudflare R2.

## Bộ mẫu Excel chính thức

Các mẫu được phát hành tại `public/templates/` và có nút tải trong Trung tâm nhập dữ liệu:

1. `UED_MAU_01_CAN_BO_GIANG_VIEN_V2.xlsx`
2. `UED_MAU_02_DON_VI_CHUC_VU_V2.xlsx`
3. `UED_MAU_03_HOP_DONG_V2.xlsx`
4. `UED_MAU_04_DAO_TAO_CAM_KET_V2.xlsx`
5. `UED_MAU_05_BIEN_DONG_HO_SO_V2.xlsx`

Mẫu v1 trong `templates/` chỉ giữ để tương thích và đối chiếu lịch sử; dữ liệu mới dùng bộ v2.

## Tài liệu bàn giao

- `docs/BAN_DO_DU_LIEU_NGUON.md`: bản đồ và kết quả đối soát ba tệp đúng.
- `docs/PROMPT_TRIEN_KHAI_UED.md`: yêu cầu triển khai đã chốt.
- `docs/HUONG_DAN_SU_DUNG.md`: quy trình nhập, tra cứu và xuất.
- `docs/HUONG_DAN_QUAN_TRI_PHAN_QUYEN.md`: tài khoản, vai trò và phạm vi.
- `docs/SAO_LUU_KHOI_PHUC_DONG_BO.md`: sao lưu v3, khôi phục và xử lý lỗi đồng bộ.
- `docs/BAO_CAO_KIEM_THU.md`: bằng chứng kiểm thử phát hành.
- `docs/DANH_SACH_TEP_BAN_GIAO_2.0.0.md`: cấu trúc gói ZIP.
- `sample-data/`: dữ liệu kiểm thử hư cấu, không chứa PII thật.

## Bảo mật vận hành

Danh tính do nền tảng truyền qua header xác thực; mọi API kiểm tra quyền phía máy chủ. Ứng dụng không lưu mật khẩu Gmail, access token hoặc client secret. Không đưa dữ liệu cá nhân thật hay tệp nguồn vào repository. Dữ liệu chỉ được ghi sau khi người có quyền chọn chế độ nhập và xác nhận.
