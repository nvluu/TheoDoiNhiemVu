# Theo dõi nhiệm vụ

Web tĩnh dùng hai tab trong Google Sheets `1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks`:

- Trang tính4 (`gid=1434454130`): 65 nhiệm vụ, 10 cột thông tin gốc.
- Trang tính3 (`gid=1315345358`): 11 đơn vị, người phụ trách, Gmail và SĐT.

Bản lưu đọc từ Google Sheets ngày 08/10/2026 nằm trong `data.csv` (nhiệm vụ) và `units.csv` (đơn vị). Dữ liệu CSV dự án cũ đã được thay thế. Trang tự mở cả hai bản lưu; nút tải dữ liệu mới đọc cả hai tab và chỉ cập nhật khi cả hai thành công. Bản lưu không tự đồng bộ. Nếu mạng/CORS hoặc quyền chia sẻ chặn tải trực tiếp, xuất hai tab thành CSV và chọn hai file trên trang.

Ghép đơn vị bằng mã chính xác, không suy luận mã thiếu. Mã `CCHC-05` không có trong danh mục và một nhiệm vụ chưa có mã được hiển thị riêng. Giữ nguyên trạng thái, ghi chú, thời hạn và nội dung nguồn, kể cả ô trống và dữ liệu chưa nhất quán. Danh mục hiển thị toàn bộ đơn vị dù chưa có nhiệm vụ. Tìm kiếm trên mọi cột và thông tin đơn vị; lọc theo đơn vị và trạng thái. Nội dung được đưa vào DOM bằng textContent.

Chạy tại thư mục repository (không cần cài thư viện hoặc build):

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Kiểm tra trang hiển thị 65/65 nhiệm vụ và 11 đơn vị, tìm kiếm/lọc hoạt động và chi tiết giữ đúng dữ liệu hai tab.
