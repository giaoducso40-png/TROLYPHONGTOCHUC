# PROMPT TẠO PHẦN MỀM QUẢN LÝ PHÒNG TỔ CHỨC – ĐH SƯ PHẠM – ĐH ĐÀ NẴNG

Hãy xây dựng phần mềm quản lý hồ sơ cán bộ, viên chức, người lao động và hợp đồng cho Phòng Tổ chức của Trường Đại học Sư phạm – Đại học Đà Nẵng. Phần mềm phải giúp nhập dữ liệu, tra cứu, kiểm tra, cập nhật, theo dõi biến động, cảnh báo thời hạn, lập báo cáo và xuất hồ sơ trình lãnh đạo. Giao diện tiếng Việt, đẹp, sáng, chuyên nghiệp, dễ dùng trên máy tính, máy tính bảng và điện thoại.

## 1. Phân tích dữ liệu nguồn trước khi xây dựng

Đọc và lập bản đồ dữ liệu từ 3 tệp:

- Nam 2026 (cap nhat).xls: các sheet T01, T02, T3, T4, T5, T6, T7, T8 là dữ liệu đội ngũ theo tháng; có các sheet Thanh cap nhat, DS VC da & dang hoc tap o NN, Den bu chi phi dao tao, Tot nghiep o NN.
- THONG KE HOP DONG XDTH.xlsx: danh sách hợp đồng xác định thời hạn.
- THONG KE HOP DONG TOAN TRUONG.xlsx: các nhóm HDLV XĐTH, HDLV KXĐTH, hợp đồng giảng viên có trình độ cao đã nghỉ hưu, hợp đồng học việc, hợp đồng chuyên môn–nghiệp vụ và hợp đồng thỉnh giảng.

Không được đọc cứng theo vị trí một file duy nhất. Các file có tiêu đề nhiều hàng, ô gộp, tên cột khác nhau và số lượng cột thay đổi theo tháng. Phải có bước chọn dòng tiêu đề, ánh xạ cột, xem trước và xác nhận trước khi nhập. Không tự đoán các trường không đủ căn cứ.

## 2. Mô hình dữ liệu

### Hồ sơ nhân sự

Tạo bảng hồ sơ có khóa ổn định, không dùng họ tên làm khóa:

person_id, mã cán bộ/viên chức, họ tên, ngày sinh, giới tính, đơn vị, khoa/phòng/bộ môn, chức vụ, chức danh nghề nghiệp, tình trạng công tác, ngày bắt đầu công tác, điện thoại, email công vụ, email cá nhân nếu được phép, địa chỉ liên hệ, ghi chú.

### Đơn vị tổ chức

Mã đơn vị, tên chính thức, tên viết tắt, cấp đơn vị, đơn vị cha, người phụ trách, trạng thái hoạt động, lịch sử đổi tên/sáp nhập/chuyển đơn vị.

### Chức vụ, chức danh và trình độ

Quản lý riêng chức vụ, chức danh nghề nghiệp, học hàm, học vị, trình độ chuyên môn, ngành/chuyên ngành, nơi đào tạo, quốc gia đào tạo, năm tốt nghiệp, ngoại ngữ, tin học, Đảng/đoàn thể và tình trạng nghiên cứu sinh. Không gộp các trường cần thống kê vào một ô văn bản.

### Hợp đồng

Mỗi hợp đồng có contract_id riêng và liên kết person_id:

số hợp đồng, loại hợp đồng, người ký/đơn vị ký, đơn vị sử dụng, chức danh/chuyên môn, ngày ký, ngày hiệu lực, ngày bắt đầu, ngày hết hạn, số tháng, thời gian hợp đồng dạng văn bản, trạng thái, ngày thanh lý, lý do thanh lý, ghi chú, tệp hợp đồng và phụ lục.

Loại hợp đồng gồm: xác định thời hạn, không xác định thời hạn, học việc, chuyên môn–nghiệp vụ, thỉnh giảng, giảng viên trình độ cao đã nghỉ hưu và loại khác.

Trạng thái gồm: dự thảo, đang hiệu lực, sắp hết hạn, đã hết hạn, đã thanh lý, hủy, chờ bổ sung.

### Lịch sử và phiên bản

Mỗi lần sửa phải lưu bản trước, bản sau, trường thay đổi, người sửa, thời gian, thiết bị/phiên, lý do và tệp minh chứng. Không ghi đè làm mất lịch sử.

Lưu ảnh chụp dữ liệu theo tháng T01–T12 và năm; cho phép xem hiện tại, xem tại một tháng, so sánh hai tháng và so sánh hai năm.

## 3. Nhập dữ liệu

Hỗ trợ XLSX, XLS, CSV, TSV, kéo thả nhiều tệp và nhiều sheet. Trung tâm nhập dữ liệu phải:

- Tự phát hiện vùng dữ liệu nhưng cho phép chọn lại dòng tiêu đề.
- Bỏ qua vùng tiêu đề, ghi chú và sheet hướng dẫn không phải dữ liệu.
- Hiển thị bước ánh xạ cột nguồn sang cột hệ thống.
- Ghi nhớ mẫu ánh xạ theo từng loại file.
- Có bản xem trước trước khi ghi.
- Cho phép sửa trực tiếp trên bản xem trước.
- Không từ chối toàn bộ file chỉ vì một vài ô trống không bắt buộc.
- Với ô bắt buộc bị trống, báo rõ sheet, dòng, cột và cho phép sửa, bỏ qua dòng, nhập tiếp hoặc hủy.
- Có chế độ nhập mới, cập nhật theo mã, gộp có kiểm tra và chỉ kiểm tra chưa ghi.
- Hiển thị số bản ghi thêm, cập nhật, trùng, bỏ qua và lỗi.
- Cho phép tải báo cáo lỗi.
- Có chức năng xuất ngược dữ liệu theo đúng mẫu để nhập lại không sai cột.

Kiểm tra bắt buộc:

- Không dùng họ tên làm khóa.
- Kiểm tra trùng mã cán bộ, số hợp đồng, email, điện thoại và tổ hợp họ tên + ngày sinh.
- Ngày ký, ngày hiệu lực, ngày bắt đầu và ngày hết hạn phải được kiểm tra logic.
- Hợp đồng không xác định thời hạn không bắt buộc ngày hết hạn.
- Không tự suy đoán ngày hoặc số hợp đồng bị thiếu.
- Chuẩn hóa khoảng trắng, dấu tiếng Việt và kiểu ngày nhưng giữ dữ liệu gốc để đối chiếu.
- Không xóa dữ liệu sai; đánh dấu để người có quyền xử lý.

## 4. Giao diện

Dùng bố cục quản trị hiện đại, màu xanh dương/trắng/xanh ngọc nhạt, chữ dễ đọc, không màu mè. Có thanh điều hướng thu gọn, tìm kiếm toàn cục, bảng dữ liệu cố định tiêu đề, bộ lọc nhiều điều kiện, sắp xếp, phân trang, chọn cột, sửa trực tiếp, mở hồ sơ chi tiết, xóa mềm và khôi phục.

Các màn hình chính:

1. Tổng quan.
2. Hồ sơ nhân sự.
3. Đơn vị tổ chức.
4. Hợp đồng.
5. Biến động theo tháng/năm.
6. Học hàm, học vị, đào tạo và nghiên cứu sinh.
7. Tệp hồ sơ và minh chứng.
8. Nhập dữ liệu.
9. Báo cáo.
10. Kiểm tra chất lượng dữ liệu.
11. Nhật ký hoạt động.
12. Quản trị danh mục, tài khoản và phân quyền.
13. Sao lưu – đồng bộ.

Mọi thông báo và lỗi phải bằng tiếng Việt, nói rõ lỗi ở đâu, vì sao và cách sửa.

## 5. Tổng quan và tra cứu

Dashboard phải lọc theo năm, tháng, đơn vị, loại hợp đồng và trạng thái. Hiển thị:

- Tổng số cán bộ/viên chức/người lao động.
- Số người theo khoa, phòng, bộ môn.
- Đang công tác, nghỉ hưu, nghỉ việc, biệt phái, tạm hoãn, học tập.
- Số hợp đồng đang hiệu lực.
- Hợp đồng sắp hết hạn trong 30, 60, 90 ngày.
- Hợp đồng đã hết hạn, đã thanh lý và thiếu dữ liệu.
- Phân bố học vị, chức danh, độ tuổi và loại hợp đồng.
- Biến động tăng, giảm, chuyển đơn vị và thay đổi chức vụ.

Mọi chỉ số phải bấm được để mở danh sách chi tiết. Tìm kiếm toàn cục theo tên, mã cán bộ, số hợp đồng, đơn vị và email. Có bộ lọc hồ sơ có vấn đề, hiển thị nguồn dữ liệu, thời điểm cập nhật và lịch sử thay đổi.

## 6. Báo cáo

Có trình tạo báo cáo cho phép chọn cột, bộ lọc, nhóm, thứ tự sắp xếp, tiêu đề và người lập. Tối thiểu có:

- Danh sách toàn trường theo đơn vị.
- Danh sách theo khoa/phòng/bộ môn.
- Danh sách theo chức vụ, chức danh, học hàm, học vị.
- Danh sách theo trình độ, ngành đào tạo và nơi đào tạo.
- Danh sách hợp đồng theo từng loại.
- Hợp đồng sắp hết hạn 30/60/90 ngày.
- Hợp đồng hết hạn, thanh lý, thiếu hồ sơ.
- Ký mới, gia hạn, chấm dứt, chuyển đơn vị.
- Biến động nhân sự theo tháng/năm.
- Đối chiếu hai kỳ dữ liệu.
- Báo cáo chất lượng dữ liệu.
- Báo cáo tổng hợp trình lãnh đạo có ngày lập, người lập, người kiểm tra và chữ ký.

Xuất được Excel, CSV, PDF, Word và bản in. Báo cáo phải ghi bộ lọc, thời điểm, nguồn dữ liệu, tổng số dòng và số trang.

## 7. Phân quyền

Dùng RBAC:

- Quản trị hệ thống: cấu hình, tài khoản, danh mục, phân quyền, khôi phục.
- Trưởng phòng: xem toàn bộ, duyệt thay đổi, xem và xuất báo cáo.
- Cán bộ Phòng Tổ chức: nhập, sửa, kiểm tra, xuất theo phạm vi.
- Người nhập liệu: nhập/sửa bản nháp, không xóa vĩnh viễn và không duyệt.
- Người xem/báo cáo: chỉ xem và xuất phần được phép.
- Kiểm toán: xem nhật ký, không sửa dữ liệu.

Cho phép giới hạn quyền theo đơn vị hoặc nhóm hồ sơ. Xóa là xóa mềm. Ghi nhật ký đăng nhập, xuất dữ liệu, sửa, xóa, khôi phục và đổi quyền.

## 8. Gmail, Google Drive và đồng bộ

Dùng Google Identity Services/OAuth 2.0, không yêu cầu nhập hoặc lưu mật khẩu Gmail. Xác minh đúng tài khoản trước khi truy cập. Không đưa client secret, access token hoặc dữ liệu cá nhân vào mã nguồn công khai.

Dùng Drive appDataFolder cho dữ liệu riêng theo người dùng khi phù hợp. Nếu nhiều cán bộ cùng làm việc trên một dữ liệu trung tâm, không dùng appDataFolder cá nhân làm cơ sở dữ liệu dùng chung; phải có backend/cơ sở dữ liệu trung tâm có xác thực và phân quyền.

Đồng bộ phải có:

- Hàng đợi thay đổi.
- Retry có giới hạn và backoff.
- Phiên bản dữ liệu và checksum ổn định.
- Không dừng toàn bộ chỉ vì một bản ghi lỗi.
- Tiếp tục bản ghi hợp lệ, ghi riêng bản ghi lỗi.
- Trạng thái Chưa kết nối, Đang đồng bộ, Đã đồng bộ, Có thay đổi chờ gửi, Có lỗi.
- Nút Tự kiểm tra và sửa đồng bộ nhưng không tự ý xóa dữ liệu cục bộ hoặc Drive.
- Xung đột hiển thị bản cục bộ và bản máy chủ, cho phép chọn giữ cục bộ, giữ máy chủ hoặc hợp nhất.
- Snapshot trước khôi phục hoặc sửa hàng loạt.
- Nhật ký đồng bộ và báo cáo bản ghi thất bại.
- Hoạt động được khi mạng yếu, đóng trình duyệt giữa chừng hoặc token hết hạn.

## 9. An toàn dữ liệu

Mã hóa khi truyền; hạn chế dữ liệu nhạy cảm trong log, URL và thông báo. Tự khóa phiên, đăng xuất, sao lưu tự động/thủ công, khôi phục có kiểm tra và lịch sử phiên bản. Xóa phải hiển thị rõ số bản ghi và phạm vi ảnh hưởng. Không cho người không có quyền xem điện thoại, email cá nhân hoặc hồ sơ nhạy cảm.

## 10. Kiểm thử và bàn giao

Trước khi bàn giao phải kiểm thử:

- Nhập đủ các file nguồn và đối chiếu số dòng.
- Không mất tên, ngày sinh, đơn vị, số hợp đồng, thời hạn.
- Không trùng khóa hoặc số hợp đồng.
- Đúng logic ngày và cảnh báo hết hạn.
- Xuất rồi nhập lại không đổi dữ liệu.
- Đúng phân quyền.
- Đồng bộ khi mạng yếu, mất mạng, token hết hạn, hai máy sửa cùng lúc.
- Nâng cấp không xóa dữ liệu cũ.
- Giao diện PC, máy tính bảng và điện thoại.

Bàn giao phần mềm, cấu trúc dữ liệu, mẫu Excel theo từng nhóm, mẫu báo cáo, hướng dẫn nhập liệu, hướng dẫn quản trị/phân quyền, quy trình sao lưu–khôi phục–sửa đồng bộ, nhật ký phiên bản và bộ dữ liệu mẫu không chứa thông tin cá nhân thật.

Bắt đầu bằng bản đồ dữ liệu: liệt kê từng file, sheet, dòng tiêu đề, cột nguồn, cột hệ thống, kiểu dữ liệu, khóa liên kết, trường bắt buộc và trường cần người quản trị xác nhận. Chỉ sau khi bản đồ được duyệt mới xây dựng giao diện và chức năng.

Tài liệu kỹ thuật tham khảo:
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- Google Identity Services cho web: https://developers.google.com/identity/oauth2/web/guides/overview
- Google Drive API và appDataFolder: https://developers.google.com/workspace/drive/api/guides/about-files

## 11. Trung tâm thông báo và cảnh báo thời hạn

Phải có một mục riêng tên **Thông báo – Cảnh báo**, hiển thị ngay trên trang tổng quan và có thể mở thành danh sách chi tiết. Không chỉ cảnh báo hợp đồng mà phải quét mọi luồng dữ liệu có ngày bắt đầu, ngày kết thúc, thời hạn hoặc mốc phải thực hiện.

Các nhóm cảnh báo tối thiểu:

- Hợp đồng sắp hết hạn theo các mốc cấu hình được: 7, 15, 30, 60 và 90 ngày.
- Hợp đồng đã hết hạn, thiếu ngày hết hạn, ngày hết hạn trước ngày hiệu lực hoặc số tháng không khớp ngày.
- Cán bộ sắp hết thời gian tập sự/thử việc, biệt phái, đào tạo, nghiên cứu sinh, học tập ở nước ngoài, hoàn trả kinh phí hoặc các cam kết có thời hạn.
- Hồ sơ, chứng chỉ, quyết định, báo cáo định kỳ và nhiệm vụ sắp đến hạn.
- Dữ liệu thiếu trường bắt buộc, sai liên kết đơn vị, trùng mã, sai định dạng ngày hoặc đang chờ xác minh.

Mỗi thông báo phải có mức độ (khẩn cấp/cảnh báo/thông tin), loại dữ liệu, người/đơn vị liên quan, ngày phát sinh, ngày đến hạn, số ngày còn lại, người phụ trách và liên kết mở thẳng bản ghi. Có chức năng đánh dấu đã đọc, xác nhận đã xử lý, giao người xử lý, tạm hoãn, ghi chú, lọc theo đơn vị/năm học/loại cảnh báo và xuất danh sách cảnh báo. Không tạo thông báo trùng lặp sau khi đồng bộ lại.

Quản trị viên được cấu hình số ngày cảnh báo, nhóm người nhận, tần suất nhắc lại và kênh thông báo. Có thể thông báo trong ứng dụng và qua email/Gmail khi người dùng đã cấp quyền; không đưa dữ liệu nhạy cảm vào tiêu đề hoặc nội dung email nếu không cần thiết.

## 12. Thống kê trình độ và bảng điều khiển

Trang tổng quan phải có thẻ thống kê và biểu đồ có thể bấm để truy xuất danh sách chi tiết:

- Tổng số cán bộ/giảng viên theo đơn vị, chức vụ, trạng thái công tác và năm.
- Số tiến sĩ, thạc sĩ, đại học và các trình độ khác; tỷ lệ theo toàn trường và từng đơn vị.
- Phân tích theo giới tính, độ tuổi, ngạch/chức danh, chuyên ngành, nơi đào tạo, ngoại ngữ, tin học, nghiên cứu sinh và tình trạng đào tạo.
- So sánh kỳ hiện tại với kỳ trước; cho phép chọn mốc thời gian và tải dữ liệu nguồn của biểu đồ.

Không tự suy đoán trình độ hoặc giới tính khi dữ liệu nguồn trống. Mọi con số trên dashboard phải truy ngược được về các bản ghi đã lọc và có thời điểm cập nhật.

## 13. Nhập, sửa, xóa và điều chỉnh hàng loạt

Mọi bảng dữ liệu phải có lưới thao tác trực tiếp, tìm kiếm, lọc, sắp xếp, phân trang, cố định cột khóa và mở hồ sơ chi tiết. Người có quyền được:

- Chọn nhiều dòng theo bộ lọc hoặc chọn toàn bộ kết quả.
- Sửa hàng loạt các trường được phép, gán đơn vị/trạng thái/loại hợp đồng, thêm ghi chú và cập nhật ngày.
- Xóa mềm hàng loạt, khôi phục, xem bản ghi đã xóa và hoàn tác trong thời gian cấu hình.
- Dán vùng dữ liệu từ Excel, xem trước số dòng bị ảnh hưởng, tải danh sách lỗi và chỉ ghi những dòng hợp lệ.

Trước mọi thao tác hàng loạt phải hiển thị số bản ghi, phạm vi, trường bị thay đổi và nút xác nhận. Không xóa cứng dữ liệu nghiệp vụ nếu chưa có quyền đặc biệt. Mọi thao tác phải có nhật ký người dùng, thời gian, giá trị trước/sau và lý do.

## 14. Mẫu Excel chuẩn và xuất dữ liệu vòng kín

Phải phát hành bộ mẫu Excel chính thức theo từng nhóm:

- Cán bộ/giảng viên.
- Đơn vị và chức vụ.
- Hợp đồng theo từng loại trong dữ liệu nguồn.
- Đào tạo, nghiên cứu sinh, học tập ở nước ngoài và hoàn trả kinh phí.
- Lịch sử biến động, quyết định và hồ sơ liên quan.

Mỗi mẫu phải có phiên bản, tên sheet chính, dòng tiêu đề cố định, mã trường, kiểu dữ liệu, trường bắt buộc, giá trị cho phép và định dạng ngày thống nhất. Sheet hướng dẫn phải tách riêng hoặc không được đưa vào vùng đọc dữ liệu nếu bộ nhập không hỗ trợ sheet phụ. Không dùng merged cell, dòng trống trong vùng dữ liệu hoặc tiêu đề thay đổi tùy ý.

Quy trình nhập phải là: đọc file → nhận diện mẫu/phiên bản → chuẩn hóa → kiểm tra → hiển thị xem trước → báo rõ dòng/cột lỗi → cho phép sửa trực tiếp → xác nhận ghi. Trường trống không bị từ chối một cách máy móc; hệ thống phải nêu rõ trường nào đang trống, trường đó bắt buộc hay tùy chọn và hỏi người dùng có tiếp tục hay không.

Bắt buộc kiểm thử vòng kín với từng mẫu: tải mẫu → điền dữ liệu → nhập → xuất lại → nhập lại lần hai. Mã, tên, ngày, số, dấu tiếng Việt, ô trống, ghi chú, định dạng và quan hệ khóa phải giữ nguyên. Nếu sai, phải chỉ rõ sheet, dòng, cột, giá trị nguồn, giá trị hệ thống và cách sửa.

Cho phép xuất toàn bộ, theo bộ lọc, theo đơn vị, theo năm, theo loại hợp đồng hoặc các dòng đã chọn sang XLSX, CSV, DOCX và PDF. Có xem trước trước khi xuất, tên file tự động có ngày giờ, logo trường, tiêu đề, bộ lọc, chân trang, số trang, người xuất và thời điểm xuất. Bản PDF phải kiểm tra không tràn chữ/cắt cột; bản Excel phải mở được và giữ đúng kiểu ngày/số; bản Word phải giữ đúng bảng và tiếng Việt.

## 15. Đồng bộ dữ liệu chặt chẽ và có khả năng tự phục hồi

Thiết kế một schema chuẩn và lớp mapping trung gian; không cho từng màn hình tự đặt tên trường riêng. Mọi liên kết phải dùng mã định danh ổn định, khóa ngoại và kiểm tra toàn vẹn trước khi ghi. Luồng đồng bộ phải có outbox/inbox, idempotency key, phiên bản bản ghi, checksum ổn định, retry có backoff, giới hạn kích thước lô và tiếp tục bản ghi hợp lệ khi một bản ghi lỗi.

Khi phát hiện lỗi checksum, token, mạng, quyền hoặc định dạng:

- Không xóa dữ liệu cục bộ và không đánh dấu dữ liệu hợp lệ là đã đồng bộ.
- Tự thử lại theo cấp độ an toàn; sau đó đưa riêng bản ghi lỗi vào hàng đợi sửa.
- Hiển thị nguyên nhân bằng tiếng Việt, mã lỗi, bản ghi/luồng bị ảnh hưởng và nút thử lại.
- Cho phép tải báo cáo lỗi, sửa trực tiếp rồi gửi lại; không bắt người dùng sửa trong mã nguồn.
- Kiểm tra đối soát số lượng, mã bản ghi và checksum sau mỗi đợt; chỉ xác nhận thành công khi đối soát đạt.
- Khi hai nơi cùng sửa, hiển thị bản cục bộ/bản máy chủ/thời gian sửa và cho phép giữ cục bộ, giữ máy chủ hoặc hợp nhất theo từng trường.

Nâng cấp ứng dụng chỉ được thêm schema migration tương thích ngược. Không đổi namespace, database key, mã trường hoặc cấu trúc cũ nếu chưa có migration; không xóa dữ liệu cũ. Trước migration phải tạo snapshot và sau migration phải chạy đối soát số bản ghi, khóa và các liên kết.

## 16. Kiểm thử hồi quy và tiêu chí nghiệm thu bắt buộc

Phải có bộ kiểm thử tự động và thủ công chạy trước mỗi bản phát hành, tối thiểu gồm:

- Nhập từng file nguồn thật, file mẫu đúng, file thiếu cột, file có ô trống, file nhiều sheet, file Unicode/dấu tiếng Việt, file lớn và file sai định dạng.
- Kiểm tra khóa duy nhất, khóa ngoại, mã đơn vị, mã hợp đồng, ngày tháng, số tháng, bản ghi trùng và quan hệ cán bộ–đơn vị–hợp đồng.
- Kiểm tra tạo/sửa/xóa mềm/khôi phục hàng loạt, quyền người dùng, nhật ký và hoàn tác.
- Kiểm tra cảnh báo thời hạn bằng dữ liệu gần hạn, quá hạn, thiếu ngày và ngày không hợp lệ.
- Kiểm tra dashboard bằng cách đối chiếu số liệu với truy vấn nguồn; bấm từng thẻ phải ra đúng danh sách.
- Kiểm tra xuất DOCX/XLSX/PDF/CSV; mở lại file, kiểm tra số dòng/cột, tiêu đề, tiếng Việt, kiểu ngày/số, logo, trang in và không cắt nội dung.
- Kiểm tra xuất–nhập vòng kín và so sánh bản ghi trước/sau theo mã định danh.
- Kiểm tra đồng bộ khi mạng yếu, mất mạng, token hết hạn, cấp lại quyền, mở nhiều thiết bị, sửa đồng thời, retry và bản ghi lỗi.
- Kiểm tra nâng cấp từ dữ liệu cũ; xác nhận không mất, không nhân đôi và không đổi khóa.

Mỗi lỗi phải có mã, mức độ, bước tái hiện, dữ liệu đầu vào, kết quả mong đợi, kết quả thực tế, sheet/dòng/cột hoặc mã bản ghi liên quan. Không được dùng thông báo chung chung như “Import failed” hoặc “Unknown error” khi có thể xác định nguyên nhân. Chỉ bàn giao khi không còn lỗi nghiêm trọng, lỗi mất dữ liệu, lỗi sai số liệu, lỗi sai liên kết, lỗi xuất file hoặc lỗi đồng bộ chưa được xử lý; toàn bộ kiểm thử phải lưu được báo cáo kết quả.

## 17. Giao diện và nhận diện trường

Giao diện tiếng Việt, tươi sáng, trực quan, responsive cho máy tính, máy tính bảng và điện thoại; ưu tiên thao tác ít bước, nút rõ, trạng thái dễ hiểu và có hướng dẫn ngay tại vị trí nhập. Sử dụng đúng logo chính thức của Trường Đại học Sư phạm – Đại học Đà Nẵng từ tệp tài sản do người quản trị cung cấp; không tự vẽ lại logo. Logo phải giữ đúng tỷ lệ, nền trong suốt nếu có, dùng nhất quán ở trang đăng nhập, thanh đầu trang, dashboard, báo cáo và bản in. Cho phép thay logo trong Thiết lập mà không sửa mã nguồn.

## 18. Gói bàn giao

Bàn giao prompt triển khai, mã nguồn, migration, bộ mẫu Excel phiên bản hóa, dữ liệu mẫu không chứa thông tin cá nhân thật, báo cáo kiểm thử hồi quy, hướng dẫn nhập/xuất, hướng dẫn phân quyền, hướng dẫn đồng bộ và quy trình xử lý lỗi. Cấu trúc bàn giao phải cho phép cập nhật các tệp cần thiết mà không ghi đè dữ liệu IndexedDB/Drive hiện có; mọi thay đổi schema phải có cơ chế nâng cấp và khôi phục.
