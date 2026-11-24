# Báo cáo kiểm thử – Thiên Tông Fishing Bot

- Thời điểm: 2026-11-24T10:14:32.581Z
- Node: v22.23.5 · SQLite driver: node-sqlite
- Kết quả: **84 đạt / 0 lỗi / 84 tổng** (4.0 giây)

## Đăng ký người chơi

| | Kiểm thử | ms |
|---|---|---|
| ✅ | đăng ký tặng quà tân thủ & trang bị cần Gỗ | 32 |
| ✅ | đăng ký hai lần không nhân đôi quà | 14 |
| ✅ | điểm danh: chuỗi ngày, chặn nhận lần hai, đứt chuỗi | 15 |
| ✅ | người chơi bị khoá không chơi được; bảo trì chặn | 16 |

## Câu cá

| | Kiểm thử | ms |
|---|---|---|
| ✅ | câu thành công: nhận cá, EXP, thống kê, codex, giảm độ bền & mồi | 21 |
| ✅ | không cho nhiều phiên câu đồng thời | 14 |
| ✅ | ràng buộc DB chặn phiên đồng thời kể cả khi bỏ qua kiểm tra ứng dụng | 17 |
| ✅ | trạng thái Cá thoát: không giật cần kịp | 17 |
| ✅ | trạng thái Thất bại (đứt dây) khi thao tác sai liên tục | 30 |
| ✅ | trạng thái Hết thời gian khi không thao tác | 22 |
| ✅ | nút cũ (nonce sai) bị từ chối | 16 |
| ✅ | người khác không điều khiển được phiên của bạn | 17 |
| ✅ | thu cần: huỷ phiên, có thể câu lại | 31 |
| ✅ | cần hỏng không câu được; sửa bằng xu | 28 |
| ✅ | khởi động lại bot: phiên dang dở bị huỷ và hoàn mồi | 43 |
| ✅ | kho đầy chặn thả câu | 11 |
| ✅ | khu vực chưa mở khoá bị chặn | 15 |

## Tỷ lệ xuất hiện, phẩm cấp, cân nặng, giá bán

| | Kiểm thử | ms |
|---|---|---|
| ✅ | mọi cá: cân nặng trong [min, 1.6×max], giá > 0, phẩm cấp hợp lệ | 18 |
| ✅ | phân bố phẩm cấp theo khu vực đúng thiết kế & may mắn làm tăng cá hiếm | 12 |
| ✅ | mô phỏng 20.000 lần chọn cá khớp xác suất lý thuyết (sai số < 1.5%) | 25 |
| ✅ | thời tiết/giờ ảnh hưởng bảng cá; mồi đúng loại tăng tỷ lệ | 12 |
| ✅ | biến thể đặc biệt hiếm đúng kỳ vọng | 18 |
| ✅ | giá trị cá tăng theo phẩm cấp & khu vực (kinh tế nhất quán) | 10 |

## Kinh tế & nhật ký giao dịch

| | Kiểm thử | ms |
|---|---|---|
| ✅ | cộng/trừ xu ghi nhật ký; không cho âm số dư | 17 |
| ✅ | idempotency: cùng khoá giao dịch chỉ áp dụng một lần | 12 |
| ✅ | bán cá: cộng đúng xu, xoá cá, ghi nhật ký; bán cá khoá bị bỏ qua | 18 |
| ✅ | mua đồ cửa hàng: trừ xu, nhận hàng; thiếu xu bị chặn | 15 |
| ✅ | tổng xu = nhật ký giao dịch (đối soát) | 16 |

## Kho đồ

| | Kiểm thử | ms |
|---|---|---|
| ✅ | sức chứa 200 ô: chặn khi đầy, mở rộng bằng phù | 13 |
| ✅ | khoá vật phẩm: không bán/dùng được; spend không đủ → lỗi và không trừ | 13 |
| ✅ | dùng rương: nhận phần thưởng, trừ rương | 14 |

## Cần câu: nâng cấp, cường hoá, khảm, thức tỉnh, chế tạo

| | Kiểm thử | ms |
|---|---|---|
| ✅ | nâng cấp cấp cần: trừ vật liệu + xu, tăng cấp & độ bền tối đa | 15 |
| ✅ | nâng cấp thiếu vật liệu: lỗi và không mất xu | 14 |
| ✅ | cường hoá: thành công/thất bại đúng cơ chế, pity tăng, rớt cấp từ +6, bùa bảo hộ | 18 |
| ✅ | cường hoá không vượt giới hạn; thiếu đá → không trừ xu | 12 |
| ✅ | khảm & gỡ ngọc: ô khảm hợp lệ, ngọc không mất khi gỡ (thu hồi) | 13 |
| ✅ | tháo/trang bị cần: yêu cầu cấp người chơi | 13 |
| ✅ | không thể dùng cần đang đăng bán; chế tạo cần theo công thức | 12 |
| ✅ | phân rã cần: trả vật liệu, xoá cần; không phân rã được cần đang trang bị | 12 |
| ✅ | đổi skin & sửa cần bằng phù | 14 |

## Thị trường & chống nhân bản

| | Kiểm thử | ms |
|---|---|---|
| ✅ | đăng bán cá → ký quỹ; mua: chuyển cá, trừ xu + phí, người bán nhận tiền | 13 |
| ✅ | mua hai lần cùng tin đăng: chỉ một lần thành công | 13 |
| ✅ | không tự mua hàng mình; không đăng bán cá đã khoá/đã đăng; cần cuối cùng không bán được | 15 |
| ✅ | huỷ tin trả hàng; hết hạn trả hàng; hàng đang ký quỹ không bán được ở shop | 16 |
| ✅ | giới hạn số tin đăng, giá hợp lệ, yêu cầu cấp 3 | 16 |
| ✅ | mua thiếu xu hoặc đầy kho: huỷ nguyên vẹn (không mất hàng/tiền) | 17 |
| ✅ | tính bất biến: tổng xu hệ thống chỉ giảm đúng bằng phí chợ | 17 |
| ✅ | chuyển xu giữa người chơi (giao dịch): nguyên tử | 16 |

## Thú cưng

| | Kiểm thử | ms |
|---|---|---|
| ✅ | ấp trứng → thú; nuôi lên cấp; trang bị/tháo; tiến hoá cần điều kiện | 16 |
| ✅ | không ấp được khi không có trứng; không thao tác thú của người khác | 15 |
| ✅ | thú cưng ảnh hưởng chỉ số câu | 17 |

## Boss

| | Kiểm thử | ms |
|---|---|---|
| ✅ | hạ boss: ghi đóng góp, chia thưởng, trao chiến lợi phẩm, bắn sự kiện | 20 |
| ✅ | boss hết giờ tự rời đi | 14 |
| ✅ | tổ đội: tạo/tham gia/rời, bonus theo số người | 14 |

## Sự kiện, thời tiết, nhiệm vụ, bảng xếp hạng

| | Kiểm thử | ms |
|---|---|---|
| ✅ | sự kiện: tạo từ mẫu, áp dụng modifier, kết thúc & trao thưởng | 14 |
| ✅ | thời tiết: ổn định trong một khung giờ, admin ghi đè | 13 |
| ✅ | nhiệm vụ: tiến độ tăng khi câu cá, nhận thưởng đúng một lần | 14 |
| ✅ | thành tựu: đạt điều kiện mới nhận; không nhận hai lần | 13 |
| ✅ | 8 bảng xếp hạng chạy được, sắp xếp giảm dần | 12 |

## Quản trị & toàn vẹn dữ liệu

| | Kiểm thử | ms |
|---|---|---|
| ✅ | admin: tặng xu/vật phẩm/cần/cá, đặt cấp, khoá — ghi nhật ký kiểm toán | 12 |
| ✅ | kiểm tra toàn vẹn: sạch khi dữ liệu đúng, phát hiện dữ liệu mồ côi | 11 |
| ✅ | reset người chơi xoá sạch & có thể đăng ký lại | 11 |
| ✅ | đặt cấu hình: chỉ nhận khoá hợp lệ & giá trị trong khoảng | 10 |

## Lệnh Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | toàn bộ lệnh hợp lệ theo giới hạn Discord & đủ lệnh theo đặc tả | 15 |
| ✅ | lệnh quản trị bị ẩn với người thường (default_member_permissions) | 10 |
| ✅ | mọi lệnh mở được màn hình hợp lệ (người mới & người đầy đủ) | 60 |
| ✅ | autocomplete trả về danh sách hợp lệ (≤25) và không lỗi | 22 |

## Phiên câu cá qua giao diện

| | Kiểm thử | ms |
|---|---|---|
| ✅ | chu trình đầy đủ: thả câu → cá cắn → giật → kéo đúng nhịp → thành công → câu tiếp | 25 |
| ✅ | nút của người khác / nonce cũ / phiên hết hiệu lực đều bị từ chối an toàn | 15 |
| ✅ | không mở được hai phiên; giao diện báo rõ | 14 |
| ✅ | bộ hẹn giờ làm mới: cá cắn câu & hết hạn tự cập nhật tin nhắn | 14 |
| ✅ | đánh boss qua giao diện: tấn công → 5 lượt → kết quả có nút đánh tiếp | 22 |

## Quét toàn bộ giao diện (crawler)

| | Kiểm thử | ms |
|---|---|---|
| ✅ | bấm mọi nút/menu/biểu mẫu tới độ sâu 6: không lỗi hệ thống, mọi payload hợp lệ | 366 |

## Sao lưu & khôi phục trên Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | /backupdb tạo bản sao lưu, có kiểm tra checksum & dọn dẹp; người thường bị chặn | 58 |
| ✅ | /fishing-backup: danh sách, kiểm tra, ghim, xoá, dọn dẹp, trạng thái | 47 |
| ✅ | /restore_db: chỉ chủ bot; xác nhận bằng mã; sai mã không đổi gì; đúng mã khôi phục & tự tạo bản an toàn | 72 |
| ✅ | /restore_db: tệp hỏng/không hợp lệ bị từ chối, DB không đổi | 9 |
| ✅ | khi đang khôi phục, người chơi nhận thông báo bảo trì thay vì lỗi | 10 |

## Quản trị trên Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | /fishing-admin: give-xu, give-item, set-level, ban/unban, stats, integrity-check, user-info, audit-log | 18 |
| ✅ | /fishing-event & /fishing-config & weather & boss-spawn | 23 |

## Đồng thời & tải

| | Kiểm thử | ms |
|---|---|---|
| ✅ | 50 người cùng bấm mua một tin đăng: đúng một người mua được, tiền & hàng nhất quán | 69 |
| ✅ | một người spam 30 lần nút Giật cần/Kéo cùng lúc: không lỗi, không cộng thưởng hai lần | 26 |
| ✅ | chịu tải: 300 người chơi × 5 mẻ câu đồng thời, nhanh & dữ liệu toàn vẹn | 1995 |
| ✅ | nút bán/khoá nhanh sau khi câu được cá hoạt động và chống bán hai lần | 23 |

