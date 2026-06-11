# ReceiptToSheet Pro

Ứng dụng web để quét PDF/hình ảnh hóa đơn, trích xuất dữ liệu bằng Gemini OCR, rà soát thủ công và xuất Excel tổng hợp.

## Chức năng chính

- Tải nhiều file PDF, PNG, JPG, WEBP cùng lúc.
- Xử lý tuần tự để giảm lỗi giới hạn API.
- Trích xuất số hóa đơn, ngày, creator/người nhận, username, địa chỉ và tổng tiền.
- Chuẩn hóa ngày và số tiền VND.
- Cho chỉnh sửa trực tiếp trên bảng trước khi xuất Excel.
- Đánh dấu dòng thiếu thông tin để rà soát nhanh.

## Cách chạy trên máy

1. Cài dependency:

   ```powershell
   npm.cmd install
   ```

2. Tạo file `.env.local` trong thư mục dự án và thêm Gemini API key:

   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

3. Chạy app:

   ```powershell
   npm.cmd run dev
   ```

4. Mở trình duyệt tại:

   ```text
   http://localhost:3000
   ```

## Kiểm tra trước khi dùng

```powershell
npm.cmd run lint
npm.cmd run build
```

Nếu chưa cấu hình `GEMINI_API_KEY`, giao diện vẫn mở được nhưng chức năng đọc hóa đơn sẽ trả thông báo cấu hình còn thiếu.
