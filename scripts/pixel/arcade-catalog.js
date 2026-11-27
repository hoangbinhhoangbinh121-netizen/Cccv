'use strict';
/**
 * Danh mục emoji Pixel Art của module Ngư Trường (nguồn duy nhất): mỗi mục = 1 file assets/arcade/<id>.png = 1 emoji `ng_<id>`.
 * Chạy `node scripts/pixel/arcade-catalog.js` để ghi data/arcade-emoji.json (bot đọc để lấy emoji Unicode dự phòng).
 * Trường: id · group (nhóm) · name (tên gọi) · meaning (nó là gì) · use (dùng ở đâu) · fb (emoji Unicode dự phòng khi chưa tải emoji lên Discord).
 */
const fs = require('fs');
const path = require('path');
const data = require('../../data/arcade.json');

const L = [];
const add = (id, group, name, meaning, use, fb) => L.push({ id, group, name, meaning, use, fb });

/* 1. CHUNG / HUB */
add('hub_logo', 'Chung', 'Lều Hội Ngư Trường', 'Chiếc lều hội có cờ — biểu tượng của cả module Ngư Trường.', 'Tiêu đề màn hình chính /ngutruong', '🎪');
add('hub_points', 'Chung', 'Linh Điểm', 'Viên tinh thể xanh — đơn vị điểm giải trí (không phải xu).', 'Mọi chỗ hiện điểm thưởng', '💠');
add('hub_rank', 'Chung', 'Cấp Bậc', 'Huy hiệu vương miện nhỏ — cấp bậc Ngư Trường.', 'Hồ sơ giải trí, mở khoá hộp', '🎖️');
add('hub_mission', 'Chung', 'Nhiệm Vụ Giải Trí', 'Cuộn giấy có dấu tích.', 'Nút/Màn hình nhiệm vụ ngày', '📜');
add('hub_ach', 'Chung', 'Thành Tích', 'Chiếc cúp vàng nhỏ.', 'Nút/Màn hình thành tích', '🏆');
add('hub_board', 'Chung', 'Bảng Xếp Hạng', 'Bục ba cột cao thấp.', 'Nút/Màn hình bảng xếp hạng', '📊');
add('hub_stats', 'Chung', 'Thống Kê', 'Biểu đồ cột có mũi tên đi lên.', 'Nút/Màn hình thống kê cá nhân', '📈');
add('hub_help', 'Chung', 'Hướng Dẫn', 'Dấu chấm hỏi trong khung sách.', 'Nút hướng dẫn', '❓');
add('hub_cap', 'Chung', 'Trần Điểm Ngày', 'Đồng hồ cát đang chảy.', 'Thanh "điểm hôm nay / trần ngày"', '⏳');
add('hub_claim', 'Chung', 'Nhận Thưởng', 'Hộp quà nhỏ có nơ.', 'Nút nhận thưởng nhiệm vụ', '🎁');
for (const r of data.ranks) add(`rank_${r.id}`, 'Cấp bậc', `Cấp ${r.id}: ${r.name}`, ['Mầm non xanh', 'Cá nhỏ bạc', 'Kiếm cá chéo', 'Khiên cá', 'Vương miện có cá'][r.id - 1] + ` — biểu tượng cấp ${r.name}.`, 'Cạnh tên cấp bậc', ['🌱', '🐟', '⚔️', '🛡️', '👑'][r.id - 1]);

/* 2. ĐOÁN NGƯ VƯƠNG */
add('race_game', 'Đoán Ngư Vương', 'Đoán Ngư Vương', 'Lá cờ caro và một chú cá đang lao đi.', 'Nút vào trò Đoán Ngư Vương', '🏁');
add('race_start', 'Đoán Ngư Vương', 'Vạch Xuất Phát', 'Cờ đỏ cắm trên vạch kẻ.', 'Nút "Xuất phát"', '🚩');
add('race_finish', 'Đoán Ngư Vương', 'Vạch Đích', 'Cổng đích với cờ caro.', 'Dòng kết quả cuộc đua', '🏁');
add('race_pick', 'Đoán Ngư Vương', 'Chọn Cá', 'Tâm ngắm nhỏ.', 'Menu chọn cá thắng', '🎯');
add('race_speed', 'Đoán Ngư Vương', 'Tốc Độ', 'Tia sét vàng.', 'Chỉ số Tốc độ của cá', '⚡');
add('race_stamina', 'Đoán Ngư Vương', 'Thể Lực', 'Trái tim có vòng bảo vệ.', 'Chỉ số Thể lực (Bền) của cá', '💪');
add('race_luck', 'Đoán Ngư Vương', 'May Mắn', 'Cỏ bốn lá.', 'Chỉ số May mắn của cá', '🍀');
add('race_fav', 'Đoán Ngư Vương', 'Cá Cửa Trên', 'Ngọn lửa nhỏ — cá được đánh giá cao nhất.', 'Nhãn "cửa trên" trước giờ đua', '🔥');
add('medal_1', 'Đoán Ngư Vương', 'Huy Chương Vàng', 'Huy chương vàng số 1.', 'Hạng nhất', '🥇');
add('medal_2', 'Đoán Ngư Vương', 'Huy Chương Bạc', 'Huy chương bạc số 2.', 'Hạng nhì', '🥈');
add('medal_3', 'Đoán Ngư Vương', 'Huy Chương Đồng', 'Huy chương đồng số 3.', 'Hạng ba', '🥉');
const TR = data.race.traits; const trIcon = { nuoc_rut: ['trait_sprint', 'Mũi tên tăng tốc', '🚀'], ben_bi: ['trait_endure', 'Khiên bền bỉ', '🛡️'], khoi_dau: ['trait_burst', 'Vụ nổ khởi động', '💥'], may_man: ['trait_lucky', 'Ngôi sao may mắn', '🌟'], an_minh: ['trait_stealth', 'Đám sương ẩn mình', '🌫️'], that_thuong: ['trait_wild', 'Xoáy nước thất thường', '🌀'] };
for (const t of TR) add(trIcon[t.id][0], 'Đoán Ngư Vương', `Đặc tính ${t.name}`, `${trIcon[t.id][1]} — ${t.desc}`, 'Thẻ đặc tính dưới tên cá', trIcon[t.id][2]);

/* 3. TÀI XỈU LINH VẬN */
add('dice_game', 'Tài Xỉu Linh Vận', 'Tài Xỉu Linh Vận', 'Ba viên xúc xắc xếp chồng.', 'Nút vào trò Tài Xỉu', '🎲');
for (let i = 1; i <= 6; i++) add(`die_${i}`, 'Tài Xỉu Linh Vận', `Xúc Xắc ${i}`, `Mặt xúc xắc ${i} chấm.`, 'Hiển thị kết quả 3 xúc xắc', ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][i - 1]);
add('die_q', 'Tài Xỉu Linh Vận', 'Xúc Xắc Đang Lăn', 'Xúc xắc nghiêng có dấu "?" và vệt chuyển động.', 'Khung hoạt ảnh khi đang lắc', '❔');
add('dice_tai', 'Tài Xỉu Linh Vận', 'Tài', 'Mũi tên đỏ chỉ lên, số 11–18.', 'Nút Tài', '🔺');
add('dice_xiu', 'Tài Xỉu Linh Vận', 'Xỉu', 'Mũi tên xanh chỉ xuống, số 3–10.', 'Nút Xỉu', '🔻');
add('dice_bao', 'Tài Xỉu Linh Vận', 'Bão', 'Cơn lốc xoáy — ba xúc xắc giống nhau.', 'Nút Bão / nhãn Bão', '🌪️');
add('dice_cup', 'Tài Xỉu Linh Vận', 'Chén Lắc', 'Chiếc chén úp trên khay.', 'Khung hoạt ảnh lắc xúc xắc', '🥣');

/* 4. LINH BẢO BÍ HỘP */
add('box_game', 'Linh Bảo Bí Hộp', 'Linh Bảo Bí Hộp', 'Chiếc rương có ánh sáng bên trong.', 'Nút vào trò Bí Hộp', '🎁');
for (const t of data.box.tiers) {
  add(`box_${t.id}`, 'Linh Bảo Bí Hộp', t.name, `${t.name} đang đóng (bậc ${t.id}/5).`, 'Nút chọn hộp, khung hộp đóng', '📦');
  add(`box_${t.id}_open`, 'Linh Bảo Bí Hộp', `${t.name} (mở)`, `${t.name} đã bật nắp, hào quang bay lên.`, 'Khung mở hộp', '🎉');
}
add('box_crack', 'Linh Bảo Bí Hộp', 'Hộp Nứt Sáng', 'Chiếc hộp rạn nứt, tia sáng toả ra.', 'Khung giữa của hoạt ảnh mở hộp', '💥');
add('box_lock', 'Linh Bảo Bí Hộp', 'Hộp Khoá', 'Ổ khoá sắt trên nắp hộp.', 'Hộp chưa mở khoá cấp bậc', '🔒');
add('box_spark', 'Linh Bảo Bí Hộp', 'Tia Lấp Lánh', 'Ngôi sao 4 cánh.', 'Trang trí khi ra phẩm cao', '✨');
add('box_pity', 'Linh Bảo Bí Hộp', 'Bảo Hiểm May Mắn', 'Chiếc khiên có ngôi sao — bộ đếm đảm bảo ra phẩm tốt.', 'Dòng bảo hiểm của hộp', '🛡️');
data.box.grades.forEach((g) => add(`grade_${g.id}`, 'Linh Bảo Bí Hộp', `Phẩm ${g.name}`, `Viên đá màu phẩm ${g.name} (hạng ${g.id}/6).`, 'Nhãn phẩm của Linh Bảo', ['⚪', '🟢', '🔵', '🟣', '🟠', '🔴'][g.id - 1]));
const SHAPE_VN = { shell: 'vỏ sò', pearl: 'viên ngọc trai', bottle: 'chiếc chai', scroll: 'cuộn thư', lantern: 'chiếc đèn lồng', compass: 'chiếc la bàn', anchor: 'chiếc neo', feather: 'chiếc lông vũ', crown: 'vương miện', orb: 'quả cầu' };
for (const it of data.box.items) add(`i_${it.id}`, `Linh Bảo — ${data.box.grades[it.grade - 1].name}`, it.name, `${SHAPE_VN[it.shape][0].toUpperCase()}${SHAPE_VN[it.shape].slice(1)} màu phẩm ${data.box.grades[it.grade - 1].name}.`, 'Phần thưởng của Bí Hộp & Bộ sưu tập', ['🐚', '🔮', '🍶', '🪶', '⚓', '📜', '🏮', '🧭', '👑', '🔮'][['shell', 'orb', 'bottle', 'feather', 'anchor', 'scroll', 'lantern', 'compass', 'crown', 'pearl'].indexOf(it.shape)] || '💎');

/* 5. TRUY TÌM LINH NGƯ */
add('quiz_game', 'Truy Tìm Linh Ngư', 'Truy Tìm Linh Ngư', 'Cá nhỏ đeo kính lúp.', 'Nút vào trò đố', '🧠');
add('quiz_q', 'Truy Tìm Linh Ngư', 'Câu Hỏi', 'Dấu hỏi lớn trong khung tròn.', 'Tiêu đề từng câu đố', '❓');
add('quiz_time', 'Truy Tìm Linh Ngư', 'Đồng Hồ', 'Đồng hồ bấm giờ.', 'Hạn trả lời mỗi câu', '⏱️');
add('quiz_ok', 'Truy Tìm Linh Ngư', 'Trả Lời Đúng', 'Dấu tích xanh lá.', 'Kết quả câu đúng', '✅');
add('quiz_no', 'Truy Tìm Linh Ngư', 'Trả Lời Sai', 'Dấu X đỏ.', 'Kết quả câu sai / hết giờ', '❌');
add('quiz_streak', 'Truy Tìm Linh Ngư', 'Chuỗi Đúng', 'Ngọn lửa xanh-cam.', 'Thưởng chuỗi đúng liên tiếp', '🔥');
add('quiz_speed', 'Truy Tìm Linh Ngư', 'Thưởng Tốc Độ', 'Chiếc giày có cánh.', 'Thưởng trả lời nhanh', '💨');
[1, 2, 3].forEach((n) => add(`quiz_lv${n}`, 'Truy Tìm Linh Ngư', `Độ Khó ${n}`, ['Một ngôi sao — dễ.', 'Hai ngôi sao — vừa.', 'Ba ngôi sao — khó.'][n - 1], 'Nhãn độ khó câu đố', ['⭐', '⭐⭐', '⭐⭐⭐'][n - 1]));
['a', 'b', 'c', 'd'].forEach((c, i) => add(`quiz_${c}`, 'Truy Tìm Linh Ngư', `Đáp Án ${c.toUpperCase()}`, `Chữ ${c.toUpperCase()} trong khung ô vuông (đáp án ${i + 1}).`, 'Nút đáp án', ['🇦', '🇧', '🇨', '🇩'][i]));

/* 6. GIAO DIỆN CHUNG */
[['ui_back', 'Quay Lại', 'Mũi tên trái.', 'Nút quay lại', '◀️'], ['ui_next', 'Tiếp Theo', 'Mũi tên phải.', 'Nút tiếp', '▶️'], ['ui_refresh', 'Làm Mới', 'Hai mũi tên xoay vòng.', 'Nút làm mới', '🔄'],
  ['ui_ok', 'Hoàn Thành', 'Dấu tích trắng trên nền xanh.', 'Nhiệm vụ đã nhận', '✅'], ['ui_no', 'Không Được', 'Biển cấm tròn đỏ.', 'Bị khoá / hết lượt', '⛔'], ['ui_lock', 'Khoá', 'Ổ khoá xám.', 'Thành tích chưa mở', '🔒'],
  ['ui_new', 'Mới', 'Nhãn NEW vàng.', 'Linh Bảo mới nhận', '🆕'], ['ui_dup', 'Trùng', 'Hai mũi tên tái chế.', 'Linh Bảo trùng (quy đổi điểm)', '♻️'], ['ui_up', 'Lên Cấp', 'Mũi tên xanh chỉ lên.', 'Thông báo lên cấp', '⬆️'], ['ui_star', 'Ngôi Sao', 'Ngôi sao vàng 5 cánh.', 'Điểm nhấn thưởng', '⭐']]
  .forEach(([id, n, m, u, fb]) => add(id, 'Giao diện', n, m, u, fb));

if (new Set(L.map((x) => x.id)).size !== L.length) throw new Error('Trùng id emoji arcade');
for (const x of L) if (`ng_${x.id}`.length > 32 || !/^[a-z0-9_]+$/.test(x.id)) throw new Error(`id emoji không hợp lệ: ${x.id}`);
module.exports = L;
if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'arcade-emoji.json'), JSON.stringify(L.map((x, i) => ({ no: i + 1, ...x })), null, 1) + '\n');
  console.log(`Ghi data/arcade-emoji.json: ${L.length} emoji`);
}
