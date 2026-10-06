# Theo dõi nhiệm vụ

Trang mẫu hiển thị Google Sheets hoặc file CSV thành các thẻ, hỗ trợ tìm kiếm trên mọi cột. Dòng đầu là tiêu đề cột; mỗi dòng tiếp theo là một bản ghi. Nội dung được hiển thị bằng textContent để tránh thực thi HTML từ dữ liệu.

Chạy tại thư mục repository:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Mở trang trên cổng 8000 trong công cụ xem trước của môi trường phát triển. Bấm “Tải dữ liệu” để đọc bảng tính. Quyền chia sẻ công khai, mạng và CORS có thể ảnh hưởng đến việc tải trực tiếp. Khi tải thất bại, xuất Google Sheets bằng File → Download → Comma-separated values (.csv), rồi mở CSV trên trang. Không cần cài thư viện.

Liên kết bảng tính được cung cấp có thể là file Excel trên Drive (tham số rtpof=true); nếu Google không hỗ trợ xuất CSV từ liên kết này, hãy chuyển sang Google Sheets hoặc dùng CSV.

Đã đọc CSV thực tế từ Google Sheets ngày 06/10/2026 (HTTP 200). Trang tự tải bản lưu data.csv, gồm 21 dự án thuộc 2 nguồn vốn; nhận diện dòng tiêu đề STT/Tên dự án sau phần tiêu đề phụ lục. Bảng nguồn ghi ngày cập nhật 14/8/2026. Các STT trùng lặp được giữ nguyên, không loại bỏ dự án. Ô x được tô xanh lá, ô có mô tả được tô xanh dương, ô trống không suy luận trạng thái. Nút Tải dữ liệu thử lấy dữ liệu mới từ Google Sheets; bản lưu không tự đồng bộ.
