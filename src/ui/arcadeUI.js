'use strict';
/**
 * Giao diện dùng chung của Ngư Trường: emoji pixel, thanh điều hướng, bộ hẹn giờ hoạt ảnh.
 * Hoạt ảnh KHÔNG giữ trạng thái: mỗi khung hình được tính từ dữ liệu trong DB + giờ máy chủ (frame() của view), nên
 * làm mới thủ công, mở lại lệnh hay khởi động lại bot đều ra đúng khung hình hiện tại; bộ hẹn giờ chỉ gọi edit đúng lúc.
 */
const K = require('./kit');
const logger = require('../utils/logger');
const H = require('../interactions/helpers');

const E = (id) => K.E('arcade', id);
const B = (id) => K.emoji.btn('arcade', id);
const COLOR = { hub: K.COLOR.gold, race: 0x4aa3df, dice: 0xf0b840, box: 0xb04cef, quiz: 0x57c37a, ok: K.COLOR.ok, err: K.COLOR.err };
const GAME_VIEW = { race: 'ngrace', dice: 'ngdice', box: 'ngbox', quiz: 'ngquiz' };
const GAME_LABEL = { race: 'Đoán Ngư Vương', dice: 'Tài Xỉu', box: 'Bí Hộp', quiz: 'Truy Tìm' };

/** Hàng điều hướng: [Sảnh] [Đua] [Xúc xắc] [Hộp] [Đố] — nút của màn hình hiện tại bị tắt. */
function navRow(uid, cur) {
  const b = (view, label, ic, id) => K.button({ id: K.cid('v', uid, view, 'show'), label, emoji: B(ic), disabled: cur === id, style: cur === id ? 'primary' : 'secondary' });
  return K.selectRow([b('ng', 'Sảnh', 'hub_logo', 'hub'), b('ngrace', 'Đua', 'race_game', 'race'), b('ngdice', 'Xúc xắc', 'dice_game', 'dice'), b('ngbox', 'Hộp', 'box_game', 'box'), b('ngquiz', 'Đố', 'quiz_game', 'quiz')]);
}
const pointsLine = (applied, requested) => `${E('hub_points')} **+${applied} Linh Điểm**${applied < requested ? ` *(đã chạm trần ngày, lẽ ra +${requested})*` : ''}`;
const notesText = (notes) => (notes && notes.length ? `\n\n${notes.join('\n')}` : '');
const medal = (rank) => (rank <= 3 ? E(`medal_${rank}`) : `**${rank}.**`);
/** Thanh dạng pixel ▰▱ (mobile hiển thị đều hơn khối ký tự rộng). */
const pbar = (v, max, len = 10) => K.F.bar(v, max, len, '▰', '▱');

/* ------------------------------------------------------------------ hoạt ảnh */
const timers = new Map(); // uid → entry
const PERMANENT = new Set([10003, 10008, 10015, 10062, 50001, 50013, 50027, 40060, 50035]);
function stop(uid) { const e = timers.get(uid); if (e) { clearTimeout(e.timer); timers.delete(uid); } }
/**
 * Hẹn giờ cập nhật tin nhắn. step() → { payload, next }: next = ms tới khung kế tiếp (null/undefined = dừng).
 * Gọi ngay sau khi gửi khung đầu; một người chơi chỉ có một bộ hẹn giờ (khung mới thay khung cũ).
 */
function track(uid, edit, step) {
  stop(uid); let first; try { first = step(); } catch { return; }
  if (!first || first.next == null) return;
  const entry = { timer: null, fails: 0 }; timers.set(uid, entry);
  const schedule = (ms) => { entry.timer = setTimeout(tick, Math.max(150, Math.min(ms, 60000))); entry.timer.unref?.(); };
  const tick = async () => {
    if (timers.get(uid) !== entry) return;
    let out; try { out = step(); } catch (e) { logger.debug(`arcade tick: ${e.message}`); stop(uid); return; }
    if (timers.get(uid) !== entry) return;
    try { await edit(H.finalize(out.payload)); entry.fails = 0; } catch (e) {
      entry.fails++; if (PERMANENT.has(e.code) || entry.fails > 3) { stop(uid); return; }
      schedule(1200 * 2 ** entry.fails); return;
    }
    if (timers.get(uid) !== entry) return;
    if (out.next == null) { timers.delete(uid); return; }
    schedule(out.next);
  };
  schedule(first.next);
}
const stopAll = () => { for (const k of [...timers.keys()]) stop(k); };
module.exports = { E, B, COLOR, GAME_VIEW, GAME_LABEL, navRow, pointsLine, notesText, medal, pbar, track, stop, stopAll, timers: () => timers.size };
