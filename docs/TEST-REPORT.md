# Báo cáo kiểm thử – Thiên Tông Fishing Bot v1.0

Chi tiết từng ca kiểm thử (84 ca) được sinh tự động vào `tests/REPORT.md` mỗi lần chạy `npm test`.

## Kết quả lần chạy cuối

| Hạng mục | Kết quả |
|---|---|
| Kiểm thử tự động (`npm test`) | **84 / 84 đạt**, 0 lỗi (~3 giây) |
| Kiểm tra tài nguyên (`npm run validate`) | 282 ảnh PNG 128×128 RGBA hợp lệ, manifest khớp 282 mục |
| Crawler giao diện | 484 thao tác (bấm mọi nút / select / modal, sâu 6 tầng), 111 hành động thành công, không có payload vi phạm giới hạn Discord, không có "undefined / NaN / [object Object]" |
| Tải | 1.500 mẻ câu trong ~1,5 giây (≈957 mẻ/giây), 1.500 thành công |
| Đồng thời | Nhiều thao tác song song không nhân đôi xu / vật phẩm; chỉ một phiên câu hoạt động / người chơi |
| Khởi động – tắt | Boot thử: migrate → ready → SIGTERM tạo backup `shutdown` |
| Đăng ký lệnh | 34 lệnh, JSON 14.788 byte (lệnh lớn nhất `fishing-admin` 5.769 byte) |

## Phạm vi được kiểm thử

Đăng ký & quà tân thủ, điểm danh; vòng đời câu cá (thành công, cá thoát, thất bại, hết giờ, nút cũ, người khác bấm, thu cần, cần hỏng, khởi động lại giữa phiên, kho đầy, khu chưa mở khoá); tỷ lệ phẩm cấp (mô phỏng 20.000 lần); kinh tế & nhật ký giao dịch (idempotency, không âm xu); kho đồ; nâng cấp / cường hoá / khảm đá / thức tỉnh / chế tạo; thị trường (ký quỹ, phí, chống nhân bản); thú cưng; boss; sự kiện, thời tiết, nhiệm vụ, bảng xếp hạng; quản trị; backup / prune / verify / restore / rollback; lệnh admin trên Discord.

## Giới hạn trung thực (cần biết trước khi triển khai)

1. **Chưa chạy với Discord thật.** Môi trường build không có mạng, không cài được `discord.js`. Toàn bộ kiểm thử dùng bản stub `tests/mocks/node_modules/discord.js` có hàm `validatePayload` ép các giới hạn của Discord (độ dài tên, số nút/dòng, custom_id trùng, attachment…). Tương thích với API thật đã được rà soát bằng đọc, nhưng chưa xác nhận bằng gateway/REST thật.
2. **Chưa chạy với `better-sqlite3`.** Test dùng driver `node:sqlite` của Node 22 (tự động chọn khi không có better-sqlite3; `DB_DRIVER=auto`). Cùng một lớp `Db` bao cả hai.
3. **Chưa thử upload Application Emoji thật** (`npm run emojis`). Bot có sẵn fallback Unicode và luôn đính kèm ảnh, nên thiếu emoji không làm hỏng giao diện.
4. Cân bằng game (tỷ lệ, giá, độ khó) đã kiểm tra về mặt thống kê, chưa qua thử nghiệm người chơi thật.

## Cách tự kiểm tra sau khi cài

1. `npm install` → `npm test` (lần này dùng `discord.js` thật nếu đặt `TEST_STUB=0`).
2. `npm run deploy` → `npm run emojis` → `npm start`.
3. Trong Discord: `/thongtin`, `/cauca`, `/backupdb`, rồi `/restore_db` (chỉ OWNER_IDS).
