# Theo dõi nhiệm vụ

Web tĩnh dùng hai tab trong Google Sheets `1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks`:

- Trang tính4 (`gid=1434454130`): 65 nhiệm vụ, 10 cột thông tin gốc.
- Trang tính3 (`gid=1315345358`): 11 đơn vị, người phụ trách, Gmail và SĐT.

Khi mở trang, ưu tiên cache hợp lệ trong localStorage của trình duyệt và hiển thị ngay, không gửi yêu cầu Google Sheets. Nếu chưa có cache hoặc cache lỗi, đọc cả hai tab qua Google Visualization Query (JSONP). Nút “Cập nhật ngay” đọc lại Google Sheets và thay cache sau khi cả hai tab được kiểm tra thành công. Cache không tự hết hạn; hiển thị thời điểm lưu để người dùng biết độ mới. Nếu trình duyệt chặn hoặc đầy bộ nhớ, vẫn hiển thị dữ liệu và thông báo không lưu được cache. Không cần xuất CSV hoặc triển khai lại web khi sửa dữ liệu bảng tính. Bảng tính phải cho phép đọc công khai; thay đổi có thể có độ trễ do bộ nhớ đệm của Google.

Dữ liệu từ cả hai tab chỉ được áp dụng khi cùng tải và kiểm tra thành công. Giữ bộ lọc/tìm kiếm qua các lần cập nhật. Nếu kết nối lỗi, giữ dữ liệu đang có; khi mở lần đầu mà không kết nối được, dùng `data.csv` và `units.csv` (bản dự phòng ngày 08/10/2026). Hiển thị rõ nguồn dự phòng; bấm “Cập nhật ngay” để thử lại. Không cập nhật định kỳ hoặc khi chuyển lại tab trình duyệt. Dữ liệu dự án cũ đã được thay thế.

Truy vấn nhiệm vụ dùng `gid=1434454130`, `range=A4:J`, `headers=1`; danh mục đơn vị dùng `gid=1315345358`, `range=A3:E`, `headers=1`. Nếu di chuyển dòng tiêu đề hoặc các cột, cần cập nhật phạm vi đọc. Endpoint cố định tại docs.google.com, không dùng proxy bên thứ ba. Nội dung ô được hiển thị bằng textContent.

Ghép đơn vị bằng mã chính xác, không suy luận mã thiếu. Mã `CCHC-05` không có trong danh mục và một nhiệm vụ chưa có mã được hiển thị riêng. Giữ nguyên trạng thái, ghi chú, thời hạn và nội dung nguồn, kể cả ô trống và dữ liệu chưa nhất quán. Danh mục hiển thị toàn bộ đơn vị dù chưa có nhiệm vụ. Tìm kiếm trên mọi cột và thông tin đơn vị; lọc theo đơn vị và trạng thái. Nội dung được đưa vào DOM bằng textContent.

Chạy tại thư mục repository (không cần cài thư viện hoặc build):

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Kiểm tra trang hiển thị 65/65 nhiệm vụ và 11 đơn vị, tìm kiếm/lọc hoạt động và chi tiết giữ đúng dữ liệu hai tab.

Thẻ thứ hai hiển thị tổng số, số nhiệm vụ hoàn thành và quá hạn theo danh sách đang lọc. Hoàn thành gồm trạng thái “Đã hoàn thành” / “Hoàn thành”; quá hạn gồm trạng thái hoặc ghi chú “Trễ hạn” / “Quá hạn”, mỗi nhiệm vụ chỉ được đếm một lần trong mỗi chỉ số. Không suy luận ngày từ thời hạn dạng văn bản.
