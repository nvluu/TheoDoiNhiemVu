# Kích hoạt nhập liệu bằng Gmail cá nhân

Bản này dành cho **duy nhất `ongtaymepho@gmail.com`**, chỉ thêm/sửa/xóa/khôi phục nhiệm vụ. Danh mục đơn vị là chỉ đọc. Dashboard công khai vẫn chạy trên GitHub Pages; trình quản lý chạy trên Google Apps Script và dùng đăng nhập Google có sẵn. Không cần tạo mật khẩu, API key hoặc OAuth client riêng.

## 1. Tạo Apps Script bằng đúng Gmail

1. Đăng nhập **ongtaymepho@gmail.com** tại <https://script.google.com/home/start> và tạo dự án mới. Nên dùng cửa sổ riêng chỉ đăng nhập Gmail này để tránh Google chọn nhầm tài khoản.
2. Tài khoản này phải có quyền **Chỉnh sửa** file Google Sheets nguồn: <https://docs.google.com/spreadsheets/d/1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks/edit>.
3. Dán toàn bộ `apps-script/Code.gs` vào file `Code.gs` của dự án.
4. Thêm file **HTML** tên **Editor**, dán toàn bộ `apps-script/Editor.html`.
5. Mở **Project Settings → Show "appsscript.json" manifest file in editor**, rồi thay manifest bằng nội dung `apps-script/appsscript.json`.

Mã dùng `Session.getActiveUser().getEmail()` do Google cung cấp, không dùng Gmail do form hoặc URL gửi lên. Mỗi RPC (đọc danh sách riêng, thêm/sửa/xóa, thùng rác, khôi phục) kiểm tra lại Gmail trước khi mở file hoặc lấy khóa ghi. Nếu Google không cung cấp email, từ chối thay vì đoán từ tài khoản chủ dự án.

## 2. Triển khai Web app riêng tư

Chọn **Deploy → New deployment → Web app**:

- **Execute as:** **User accessing the web app** (Người dùng truy cập ứng dụng).
- **Who has access:** **Only myself** (Chỉ mình tôi).

Đây là hai giá trị quan trọng, tương ứng manifest `USER_ACCESSING` và `MYSELF`. Không đổi thành thực thi dưới danh nghĩa chủ dự án hoặc mở cho người ẩn danh. Người triển khai phải là `ongtaymepho@gmail.com`; quyền Only myself chặn tài khoản khác ngay ở Google, kiểm tra email trong mã là lớp kiểm tra tiếp theo.

Cho phép dự án truy cập email tài khoản và Google Sheets khi Google yêu cầu. Phạm vi Sheets cho phép dự án sửa file nguồn và tạo một file riêng tư chứa lịch sử/thùng rác. Không cần quyền Gmail, Drive tổng quát, Google login secret hoặc mật khẩu trong mã.

Sao chép URL Web app dạng:

```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Mở URL này bằng đúng Gmail, xác nhận trang hiện `Đã đăng nhập: ongtaymepho@gmail.com` và danh sách nhiệm vụ. Kiểm tra bằng tài khoản khác/cửa sổ chưa đăng nhập: Google yêu cầu đăng nhập đúng tài khoản hoặc từ chối, không được vào form quản lý.

## 3. Nối với dashboard

Điền **URL Web app** (không phải mật khẩu hoặc token) vào `editor-config.js`:

```js
window.TASK_EDITOR_CONFIG = Object.freeze({
  url: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'
});
```

URL này không phải bí mật; quyền truy cập được Google và máy chủ kiểm tra. Tăng `v` của script `editor-config.js` trong `index.html` khi đổi cấu hình để tránh cache mã cũ. Commit và triển khai bản dashboard cần dùng. Nhánh hiện tại là **nhapdulieu**; chưa tự merge lên main.

Nút **Đăng nhập / Nhập liệu** mở trang quản lý ở tab riêng. Người chưa có phiên đăng nhập Google sẽ đăng nhập trước khi vào. Cấu hình để trống sẽ chỉ hiển thị thông báo chưa kích hoạt, không giả lập đăng nhập hoặc giả lập lưu thành công. Backend dùng `google.script.run` trong trang do Apps Script phục vụ, không dùng POST cross-origin từ GitHub Pages và không dùng proxy bên thứ ba.

## Dữ liệu và phục hồi

- Nhiệm vụ: `gid=1434454130`, dòng tiêu đề 4, cột A:J.
- Danh mục đơn vị: `gid=1315345358`, dòng tiêu đề 3; không có hàm ghi danh mục.
- Khi tài khoản hợp lệ mở danh sách lần đầu, hệ thống thêm cột **K `_TASK_ID`** và UUID cho nhiệm vụ thiếu mã. Nếu cột K có nội dung khác, dừng để bảo vệ dữ liệu. Không đổi STT hoặc nội dung nhiệm vụ khi cấp mã. Dashboard tiếp tục đọc A:J.
- Thêm mới tự cấp STT tăng dần. ID của bản nháp được giữ khi thử lưu lại để tránh thêm trùng do mất phản hồi mạng. Mã ID không phải khóa xác thực.
- Khi sửa/xóa, máy chủ đối chiếu ID và phiên bản hiện tại. Nội dung đã thay đổi sau lúc mở form sẽ bị từ chối; tải lại danh sách và mở lại nhiệm vụ. Khóa Apps Script tuần tự hóa các lượt ghi của ứng dụng; thao tác trực tiếp đồng thời trong Google Sheets không dùng khóa này, nên tránh sửa cùng nhiệm vụ ở cả hai nơi.
- Các trường được ghi dưới dạng văn bản, tránh thực thi chuỗi bắt đầu như công thức. Thời hạn vẫn hỗ trợ văn bản như Quý IV/2026. Khi sửa, giữ nguyên trạng thái/mã đơn vị cũ chưa chuẩn nếu không thay đổi; nhiệm vụ mới phải dùng danh mục/trạng thái được cho phép.
- Trước khi sửa/xóa, lưu bản chụp dữ liệu vào **file Sheets riêng tư mới** tên `Lịch sử và thùng rác nhiệm vụ (riêng tư)`. ID file được lưu trong Script Properties `TASK_ARCHIVE_ID`. Không chia sẻ công khai file này. Không dùng tab ẩn trong file nguồn công khai làm nơi lưu riêng tư.
- Lịch sử là các **yêu cầu/bản chụp trước thao tác**, không phải xác nhận mọi yêu cầu đã thành công. Nếu lưu bản chụp lỗi, không sửa/xóa dữ liệu nguồn. Nếu thao tác ghi sau đó lỗi, bản chụp có thể còn trong lịch sử. Thùng rác chỉ hiện bản xóa khi ID không còn trong danh sách đang hoạt động.
- Xóa làm trống A:K của đúng dòng, không dịch các dòng khác. Khôi phục tạo lại dòng với cùng ID và STT, giữ nội dung, không khôi phục trùng. Định dạng/công thức của Google Sheets không nằm trong bản chụp văn bản.
- Lưu/xóa/khôi phục thành công cập nhật ngay danh sách trong trang quản lý. Bấm **Mở dashboard với dữ liệu mới** để mở dashboard với `?refresh=1`: hiển thị cache cũ nếu có, đọc lại nguồn rồi thay cache khi thành công. Các cửa sổ dashboard khác vẫn dùng cache cho tới khi bấm Cập nhật ngay. Google có thể có độ trễ cache xuất dữ liệu.
- Nếu Sheets thật chưa có nhiệm vụ, dashboard hiển thị số 0 đúng thay vì tự quay lại bản dữ liệu cũ.

## Cập nhật Apps Script sau này

Thay nội dung file, vào **Deploy → Manage deployments → Edit → New version → Deploy** để cập nhật deployment hiện tại và giữ URL `/exec`. File đã push lên GitHub **không tự cập nhật dự án Apps Script**.

## Kiểm tra

Trong thư mục repository, chạy:

```sh
node --test tests/editor-server.test.cjs tests/editor-browser.test.cjs
```

Cần Node.js, Playwright và Chromium (`/usr/bin/chromium`, có trong môi trường phát triển). Kiểm tra máy chủ chạy bằng mô phỏng dịch vụ Apps Script/Sheets; kiểm tra trình duyệt mô phỏng RPC để xác minh form, payload, lỗi, xóa/khôi phục và liên kết. Chúng không thay thế kiểm tra đăng nhập, quyền thực tế và ghi Sheets trên deployment thật.

Sau khi triển khai, thử tạo một nhiệm vụ kiểm tra, sửa, xóa, khôi phục rồi dọn bản thử; xác nhận cả trong Google Sheets. Không chạy thử ghi lên dữ liệu thật từ môi trường phát triển khi chưa có phiên Google hợp lệ. Kiểm tra riêng tài khoản sai bị từ chối. Apps Script/Sheets có hạn mức của Google; nếu lưu lỗi, đừng giả định đã ghi thành công: tải lại danh sách hoặc thử cùng bản nháp trước khi thêm nhiệm vụ khác.

## Trạng thái của bản triển khai trong repository

Đã có mã giao diện và máy chủ, kiểm tra mô phỏng đăng nhập/phân quyền và thêm/sửa/xóa/khôi phục. **Chưa triển khai trong tài khoản Google, chưa có URL Web app, chưa kiểm tra đăng nhập thật hoặc ghi dữ liệu thật.** Cần chủ Gmail thực hiện bước 1–2, cung cấp URL công khai `/exec`, rồi nối cấu hình và kiểm tra lại.

Tài liệu chính thức: [Web apps](https://developers.google.com/apps-script/guides/web), [Web app manifest](https://developers.google.com/apps-script/manifest/web-app-api-executable), [Session](https://developers.google.com/apps-script/reference/base/session), [HTML service communication](https://developers.google.com/apps-script/guides/html/communication).
