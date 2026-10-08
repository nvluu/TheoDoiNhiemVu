# Theo dõi nhiệm vụ

Web tĩnh dùng hai tab trong Google Sheets `1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks`:

- Trang tính4 (`gid=1434454130`): 65 nhiệm vụ, 10 cột thông tin gốc.
- Trang tính3 (`gid=1315345358`): 11 đơn vị, người phụ trách, Gmail và SĐT.

Trang tự đọc cả hai tab qua Google Visualization Query (JSONP) khi mở, kiểm tra lại mỗi 60 giây khi trang đang hiển thị và khi quay lại tab trình duyệt. Nút “Cập nhật ngay” đọc lại theo yêu cầu. Không cần xuất CSV hoặc triển khai lại web khi sửa dữ liệu bảng tính. Bảng tính phải cho phép đọc công khai; thay đổi có thể có độ trễ do bộ nhớ đệm của Google.

Dữ liệu từ cả hai tab chỉ được áp dụng khi cùng tải và kiểm tra thành công. Giữ bộ lọc/tìm kiếm qua các lần cập nhật. Nếu kết nối lỗi, giữ dữ liệu đang có; khi mở lần đầu mà không kết nối được, dùng `data.csv` và `units.csv` (bản dự phòng ngày 08/10/2026). Hiển thị rõ nguồn dự phòng và tự thử lại mỗi phút. Vẫn có thể mở hai CSV thủ công. Dữ liệu dự án cũ đã được thay thế.

Truy vấn nhiệm vụ dùng `gid=1434454130`, `range=A4:J`, `headers=1`; danh mục đơn vị dùng `gid=1315345358`, `range=A3:E`, `headers=1`. Nếu di chuyển dòng tiêu đề hoặc các cột, cần cập nhật phạm vi đọc. Endpoint cố định tại docs.google.com, không dùng proxy bên thứ ba. Nội dung ô được hiển thị bằng textContent.

Ghép đơn vị bằng mã chính xác, không suy luận mã thiếu. Mã `CCHC-05` không có trong danh mục và một nhiệm vụ chưa có mã được hiển thị riêng. Giữ nguyên trạng thái, ghi chú, thời hạn và nội dung nguồn, kể cả ô trống và dữ liệu chưa nhất quán. Danh mục hiển thị toàn bộ đơn vị dù chưa có nhiệm vụ. Tìm kiếm trên mọi cột và thông tin đơn vị; lọc theo đơn vị và trạng thái. Nội dung được đưa vào DOM bằng textContent.

Chạy tại thư mục repository (không cần cài thư viện hoặc build):

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Kiểm tra trang hiển thị 65/65 nhiệm vụ và 11 đơn vị, tìm kiếm/lọc hoạt động và chi tiết giữ đúng dữ liệu hai tab.
