# Báo cáo kiểm thử – Thiên Tông Fishing Bot

- Thời điểm: 2026-11-26T11:51:10.810Z
- Node: v22.23.5 · SQLite driver: node-sqlite
- Kết quả: **146 đạt / 0 lỗi / 146 tổng** (5.4 giây)

## Ngư Trường – dữ liệu & hệ thống thuần

| | Kiểm thử | ms |
|---|---|---|
| ✅ | dữ liệu arcade hợp lệ: 30 Linh Bảo/6 phẩm, 5 hộp, catalog emoji khớp ảnh | 15 |
| ✅ | đua cá: 4–6 cá, thứ hạng là hoán vị, mọi vòng cộng dồn tăng, cùng RNG → cùng kết quả | 33 |
| ✅ | xúc xắc: 3–10 Xỉu, 11–18 Tài, phân bố 50/50 chính xác, Bão = 3 viên giống nhau | 16 |
| ✅ | hộp: tỉ lệ phẩm bám trọng số, bảo hiểm luôn kích hoạt đúng hạn, không bao giờ ra phẩm có trọng số 0 | 43 |
| ✅ | câu đố: 10 câu/vòng, 4 đáp án khác nhau, đúng 1 đáp án, độ khó tăng dần, đáp án khớp dữ liệu cá | 39 |

## Ngư Trường – Đoán Ngư Vương

| | Kiểm thử | ms |
|---|---|---|
| ✅ | luồng đầy đủ: chọn → xuất phát → chạy → tự chốt thưởng đúng một lần | 20 |
| ✅ | không đổi lựa chọn sau khi xuất phát; kết quả cố định theo thời gian máy chủ | 16 |
| ✅ | đang có cuộc đua thì mở lại trả đúng cuộc đó (không tạo trùng); huỷ ở bước chọn không tốn lượt | 21 |
| ✅ | bỏ dở bước chọn quá 3 phút → phiên đóng; người khác không động được phiên của bạn | 17 |
| ✅ | giới hạn 15 cuộc/ngày và hồi chiêu giữa hai cuộc | 59 |
| ✅ | thưởng ngựa ô: chọn cá ít khả năng thắng mà đúng được điểm cao hơn; đoán trượt vào top 3 vẫn có điểm nhỏ | 15 |

## Ngư Trường – Tài Xỉu Linh Vận

| | Kiểm thử | ms |
|---|---|---|
| ✅ | tung xúc xắc: kết quả nhất quán, ghi lịch sử, điểm đúng bảng, sổ cái đúng 1 dòng/ván | 14 |
| ✅ | chuỗi đúng tăng thưởng và đứt khi sai; Bão trúng được thưởng lớn | 13 |
| ✅ | bấm đúp / spam: hồi chiêu chặn lượt thứ hai, giới hạn 40 lượt/ngày, lựa chọn sai bị từ chối | 18 |

## Ngư Trường – Linh Bảo Bí Hộp

| | Kiểm thử | ms |
|---|---|---|
| ✅ | mở hộp: nhận Linh Bảo, sưu tầm tăng, trùng quy đổi nửa điểm, không tốn xu/kho | 18 |
| ✅ | hộp xịn bị khoá theo cấp bậc; mở khoá khi đủ điểm; mỗi bậc có giới hạn ngày riêng | 12 |
| ✅ | bảo hiểm được lưu theo từng bậc và đặt lại khi ra phẩm đủ tốt | 12 |

## Ngư Trường – Truy Tìm Linh Ngư

| | Kiểm thử | ms |
|---|---|---|
| ✅ | vòng 10/10 nhanh: đủ điểm câu + thưởng tuyệt đối, ghi thống kê và thành tích | 15 |
| ✅ | trả lời sai/hết giờ: không điểm, chuỗi đứt; bỏ dở → tự hết giờ từng câu và chốt đúng 1 lần | 12 |
| ✅ | hết giờ thì đáp án muộn không được tính; nút cũ (câu đã qua) bị bỏ qua, không trừ/cộng gì | 12 |
| ✅ | thưởng nhanh/chuỗi: đúng nhanh hơn được nhiều điểm hơn; giới hạn 6 vòng/ngày | 22 |

## Ngư Trường – điểm, trần ngày, bảng xếp hạng, nhiệm vụ, thành tích

| | Kiểm thử | ms |
|---|---|---|
| ✅ | trần điểm ngày: phần vượt bị cắt, thưởng nhiệm vụ/thành tích không bị trần, qua ngày mới lại cộng được | 13 |
| ✅ | sổ cái chống trả thưởng hai lần: cùng ref → duplicate, điểm không đổi | 11 |
| ✅ | bảng xếp hạng tuần/mùa/tích luỹ: sắp xếp đúng, hạng của bạn đúng, tuần mới bắt đầu từ 0 | 16 |
| ✅ | nhiệm vụ ngày: 3 ngẫu nhiên + 1 cố định, tiến độ tăng theo hành động, nhận thưởng đúng 1 lần | 17 |
| ✅ | nhiệm vụ đổi theo ngày; tiến độ ngày cũ không dồn sang ngày mới | 12 |
| ✅ | thành tích mở đúng điều kiện, thưởng điểm một lần, danh hiệu được lưu; lên cấp bậc được thông báo | 11 |
| ✅ | thống kê cá nhân khớp lịch sử; tổng sổ cái = điểm tích luỹ | 16 |

## Ngư Trường – đồng thời, khởi động lại, dữ liệu

| | Kiểm thử | ms |
|---|---|---|
| ✅ | nhiều người chơi đồng thời qua router: không lỗi, điểm từng người khớp sổ cái, không trùng thưởng | 46 |
| ✅ | bấm cùng một nút nhiều lần cùng lúc: chỉ 1 ván được tính | 17 |
| ✅ | khởi động lại giữa chừng: dữ liệu phiên còn nguyên, sweep chốt cuộc đua/vòng đố dở đúng một lần | 15 |
| ✅ | migration 003 an toàn trên DB đã có dữ liệu cũ; kiểm tra toàn vẹn khoá ngoại | 8 |
| ✅ | sao lưu & khôi phục giữ nguyên dữ liệu Ngư Trường | 19 |
| ✅ | hồi quy: chơi Ngư Trường không đổi xu, kho, cá, thú cưng, EXP/cấp của người chơi | 15 |

## Ngư Trường – giao diện Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | mọi lệnh con /ngutruong và lối tắt tiền tố mở được, payload hợp lệ (≤5 hàng, ≤25 nút, custom_id ≤100) | 22 |
| ✅ | tên lệnh /ngutruong: tổng ký tự lệnh ≤ 8000 và các lệnh con khai báo hợp lệ | 14 |
| ✅ | đi qua cả 4 trò bằng nút/menu như người chơi thật (đua → xúc xắc → hộp → đố → hồ sơ) | 29 |
| ✅ | nút của người khác bị từ chối, nút cũ không gây lỗi hệ thống | 13 |
| ✅ | hoạt ảnh: khung hình tính theo thời gian máy chủ, bộ hẹn giờ dừng đúng lúc, lỗi sửa tin nhắn không làm sập | 1312 |
| ✅ | crawler Ngư Trường: bấm mọi nút/menu tới độ sâu 5, không lỗi hệ thống, mọi payload hợp lệ | 60 |

## Đăng ký người chơi

| | Kiểm thử | ms |
|---|---|---|
| ✅ | đăng ký tặng quà tân thủ & trang bị cần Gỗ | 13 |
| ✅ | đăng ký hai lần không nhân đôi quà | 10 |
| ✅ | điểm danh: chuỗi ngày, chặn nhận lần hai, đứt chuỗi | 10 |
| ✅ | người chơi bị khoá không chơi được; bảo trì chặn | 10 |

## Câu cá

| | Kiểm thử | ms |
|---|---|---|
| ✅ | câu thành công: nhận cá, EXP, thống kê, codex, giảm độ bền & mồi | 17 |
| ✅ | không cho nhiều phiên câu đồng thời | 11 |
| ✅ | ràng buộc DB chặn phiên đồng thời kể cả khi bỏ qua kiểm tra ứng dụng | 11 |
| ✅ | trạng thái Cá thoát: không giật cần kịp | 11 |
| ✅ | trạng thái Thất bại (đứt dây) khi thao tác sai liên tục | 20 |
| ✅ | trạng thái Hết thời gian khi không thao tác | 13 |
| ✅ | nút cũ (nonce sai) bị từ chối | 11 |
| ✅ | người khác không điều khiển được phiên của bạn | 11 |
| ✅ | thu cần: huỷ phiên, có thể câu lại | 12 |
| ✅ | cần hỏng không câu được; sửa bằng xu | 12 |
| ✅ | khởi động lại bot: phiên dang dở bị huỷ và hoàn mồi | 17 |
| ✅ | kho đầy chặn thả câu | 8 |
| ✅ | khu vực chưa mở khoá bị chặn | 11 |

## Tỷ lệ xuất hiện, phẩm cấp, cân nặng, giá bán

| | Kiểm thử | ms |
|---|---|---|
| ✅ | mọi cá: cân nặng trong [min, 1.6×max], giá > 0, phẩm cấp hợp lệ | 13 |
| ✅ | phân bố phẩm cấp theo khu vực đúng thiết kế & may mắn làm tăng cá hiếm | 10 |
| ✅ | mô phỏng 20.000 lần chọn cá khớp xác suất lý thuyết (sai số < 1.5%) | 22 |
| ✅ | thời tiết/giờ ảnh hưởng bảng cá; mồi đúng loại tăng tỷ lệ | 9 |
| ✅ | biến thể đặc biệt hiếm đúng kỳ vọng | 17 |
| ✅ | giá trị cá tăng theo phẩm cấp & khu vực (kinh tế nhất quán) | 11 |

## Lệnh tiền tố

| | Kiểm thử | ms |
|---|---|---|
| ✅ | đọc số: 1k, 2.5m, 1.000.000, chữ → null | 10 |
| ✅ | tách từ có ngoặc kép | 8 |
| ✅ | mọi lệnh slash đều gọi được bằng tiền tố (tên gốc, bỏ _ / -, và bí danh) | 10 |
| ✅ | .cauca mở phiên câu, trả lời dạng tin nhắn thường và tự làm mới bằng message.edit | 12 |
| ✅ | .cauca lần hai khi đang có phiên → mở lại đúng phiên, không lỗi | 12 |
| ✅ | .cauca ao → tự hoàn thành tên khu vực như slash | 11 |
| ✅ | .kho, .thongtin, .daily, .bangxephang, .nhiemvu trả lời bằng embed hợp lệ | 13 |
| ✅ | không phải lệnh / chat thường / bot / tin nhắn riêng → im lặng | 10 |
| ✅ | thiếu tham số → báo cách dùng; lệnh con sai → báo cách dùng | 11 |
| ✅ | chuyển xu: .giaodich @người 1k (đọc mention và số rút gọn) | 11 |
| ✅ | quyền: người thường bị chặn lệnh quản trị, admin chạy được | 12 |
| ✅ | .restore_db chỉ chủ bot và cần tệp đính kèm hợp lệ | 11 |
| ✅ | .lenh liệt kê lệnh và tiền tố | 10 |
| ✅ | giới hạn tốc độ: spam lệnh tiền tố bị bỏ qua, không treo | 11 |
| ✅ | PREFIX_ENABLED=0 tắt hẳn | 10 |
| ✅ | sau khi chạy lệnh tiền tố không có lỗi hệ thống nào bị ghi log | 9 |
| ✅ | .giaodich mở màn xác nhận với đúng số xu (1k = 1000) và giữ giới hạn tối thiểu của lệnh | 11 |

## Kinh tế & nhật ký giao dịch

| | Kiểm thử | ms |
|---|---|---|
| ✅ | cộng/trừ xu ghi nhật ký; không cho âm số dư | 12 |
| ✅ | idempotency: cùng khoá giao dịch chỉ áp dụng một lần | 11 |
| ✅ | bán cá: cộng đúng xu, xoá cá, ghi nhật ký; bán cá khoá bị bỏ qua | 10 |
| ✅ | mua đồ cửa hàng: trừ xu, nhận hàng; thiếu xu bị chặn | 10 |
| ✅ | tổng xu = nhật ký giao dịch (đối soát) | 11 |

## Kho đồ

| | Kiểm thử | ms |
|---|---|---|
| ✅ | sức chứa 200 ô: chặn khi đầy, mở rộng bằng phù | 11 |
| ✅ | khoá vật phẩm: không bán/dùng được; spend không đủ → lỗi và không trừ | 10 |
| ✅ | dùng rương: nhận phần thưởng, trừ rương | 10 |

## Cần câu: nâng cấp, cường hoá, khảm, thức tỉnh, chế tạo

| | Kiểm thử | ms |
|---|---|---|
| ✅ | nâng cấp cấp cần: trừ vật liệu + xu, tăng cấp & độ bền tối đa | 11 |
| ✅ | nâng cấp thiếu vật liệu: lỗi và không mất xu | 11 |
| ✅ | cường hoá: thành công/thất bại đúng cơ chế, pity tăng, rớt cấp từ +6, bùa bảo hộ | 12 |
| ✅ | cường hoá không vượt giới hạn; thiếu đá → không trừ xu | 12 |
| ✅ | khảm & gỡ ngọc: ô khảm hợp lệ, ngọc không mất khi gỡ (thu hồi) | 11 |
| ✅ | tháo/trang bị cần: yêu cầu cấp người chơi | 10 |
| ✅ | không thể dùng cần đang đăng bán; chế tạo cần theo công thức | 10 |
| ✅ | phân rã cần: trả vật liệu, xoá cần; không phân rã được cần đang trang bị | 9 |
| ✅ | đổi skin & sửa cần bằng phù | 11 |

## Thị trường & chống nhân bản

| | Kiểm thử | ms |
|---|---|---|
| ✅ | đăng bán cá → ký quỹ; mua: chuyển cá, trừ xu + phí, người bán nhận tiền | 15 |
| ✅ | mua hai lần cùng tin đăng: chỉ một lần thành công | 14 |
| ✅ | không tự mua hàng mình; không đăng bán cá đã khoá/đã đăng; cần cuối cùng không bán được | 11 |
| ✅ | huỷ tin trả hàng; hết hạn trả hàng; hàng đang ký quỹ không bán được ở shop | 11 |
| ✅ | giới hạn số tin đăng, giá hợp lệ, yêu cầu cấp 3 | 11 |
| ✅ | mua thiếu xu hoặc đầy kho: huỷ nguyên vẹn (không mất hàng/tiền) | 12 |
| ✅ | tính bất biến: tổng xu hệ thống chỉ giảm đúng bằng phí chợ | 13 |
| ✅ | chuyển xu giữa người chơi (giao dịch): nguyên tử | 13 |

## Thú cưng

| | Kiểm thử | ms |
|---|---|---|
| ✅ | ấp trứng → thú; nuôi lên cấp; trang bị/tháo; tiến hoá cần điều kiện | 11 |
| ✅ | không ấp được khi không có trứng; không thao tác thú của người khác | 11 |
| ✅ | thú cưng ảnh hưởng chỉ số câu | 12 |

## Boss

| | Kiểm thử | ms |
|---|---|---|
| ✅ | hạ boss: ghi đóng góp, chia thưởng, trao chiến lợi phẩm, bắn sự kiện | 14 |
| ✅ | boss hết giờ tự rời đi | 11 |
| ✅ | tổ đội: tạo/tham gia/rời, bonus theo số người | 11 |

## Sự kiện, thời tiết, nhiệm vụ, bảng xếp hạng

| | Kiểm thử | ms |
|---|---|---|
| ✅ | sự kiện: tạo từ mẫu, áp dụng modifier, kết thúc & trao thưởng | 13 |
| ✅ | thời tiết: ổn định trong một khung giờ, admin ghi đè | 10 |
| ✅ | nhiệm vụ: tiến độ tăng khi câu cá, nhận thưởng đúng một lần | 11 |
| ✅ | thành tựu: đạt điều kiện mới nhận; không nhận hai lần | 13 |
| ✅ | 8 bảng xếp hạng chạy được, sắp xếp giảm dần | 11 |

## Quản trị & toàn vẹn dữ liệu

| | Kiểm thử | ms |
|---|---|---|
| ✅ | admin: tặng xu/vật phẩm/cần/cá, đặt cấp, khoá — ghi nhật ký kiểm toán | 12 |
| ✅ | kiểm tra toàn vẹn: sạch khi dữ liệu đúng, phát hiện dữ liệu mồ côi | 12 |
| ✅ | reset người chơi xoá sạch & có thể đăng ký lại | 13 |
| ✅ | đặt cấu hình: chỉ nhận khoá hợp lệ & giá trị trong khoảng | 10 |

## Lệnh Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | toàn bộ lệnh hợp lệ theo giới hạn Discord & đủ lệnh theo đặc tả | 11 |
| ✅ | lệnh quản trị bị ẩn với người thường (default_member_permissions) | 9 |
| ✅ | mọi lệnh mở được màn hình hợp lệ (người mới & người đầy đủ) | 47 |
| ✅ | autocomplete trả về danh sách hợp lệ (≤25) và không lỗi | 21 |

## Phiên câu cá qua giao diện

| | Kiểm thử | ms |
|---|---|---|
| ✅ | chu trình đầy đủ: thả câu → cá cắn → giật → kéo đúng nhịp → thành công → câu tiếp | 21 |
| ✅ | nút của người khác / nonce cũ / phiên hết hiệu lực đều bị từ chối an toàn | 12 |
| ✅ | không mở được hai phiên; gõ lại /cauca thì mở lại đúng phiên đang chạy | 16 |
| ✅ | startCast báo rõ khi còn phiên, và tự dọn phiên đã quá hạn | 16 |
| ✅ | nút "Kiểm tra cá" làm mới giao diện khi hẹn giờ chưa kịp chạy | 16 |
| ✅ | lỗi ở bước thưởng phụ không làm kẹt phiên: vẫn giao cá và đóng phiên | 12 |
| ✅ | loài cá bị xoá khỏi dữ liệu giữa phiên: phiên được đóng và hoàn mồi | 11 |
| ✅ | bộ hẹn giờ làm mới: cá cắn câu & hết hạn tự cập nhật tin nhắn | 12 |
| ✅ | đánh boss qua giao diện: tấn công → 5 lượt → kết quả có nút đánh tiếp | 21 |

## Quét toàn bộ giao diện (crawler)

| | Kiểm thử | ms |
|---|---|---|
| ✅ | bấm mọi nút/menu/biểu mẫu tới độ sâu 6: không lỗi hệ thống, mọi payload hợp lệ | 255 |

## Sao lưu & khôi phục trên Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | /backupdb tạo bản sao lưu, có kiểm tra checksum & dọn dẹp; người thường bị chặn | 33 |
| ✅ | /fishing-backup: danh sách, kiểm tra, ghim, xoá, dọn dẹp, trạng thái | 38 |
| ✅ | /restore_db: chỉ chủ bot; xác nhận bằng mã; sai mã không đổi gì; đúng mã khôi phục & tự tạo bản an toàn | 54 |
| ✅ | /restore_db: tệp hỏng/không hợp lệ bị từ chối, DB không đổi | 7 |
| ✅ | khi đang khôi phục, người chơi nhận thông báo bảo trì thay vì lỗi | 9 |

## Quản trị trên Discord

| | Kiểm thử | ms |
|---|---|---|
| ✅ | /fishing-admin: give-xu, give-item, set-level, ban/unban, stats, integrity-check, user-info, audit-log | 18 |
| ✅ | /fishing-event & /fishing-config & weather & boss-spawn | 16 |

## Đồng thời & tải

| | Kiểm thử | ms |
|---|---|---|
| ✅ | 50 người cùng bấm mua một tin đăng: đúng một người mua được, tiền & hàng nhất quán | 37 |
| ✅ | một người spam 30 lần nút Giật cần/Kéo cùng lúc: không lỗi, không cộng thưởng hai lần | 22 |
| ✅ | chịu tải: 300 người chơi × 5 mẻ câu đồng thời, nhanh & dữ liệu toàn vẹn | 1614 |
| ✅ | nút bán/khoá nhanh sau khi câu được cá hoạt động và chống bán hai lần | 16 |

## Tự cài đặt khi khởi động (host không có terminal)

| | Kiểm thử | ms |
|---|---|---|
| ✅ | tự đăng ký lệnh một lần, lần sau bỏ qua; tải emoji khi chưa có | 11 |

