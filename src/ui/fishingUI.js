'use strict';
/**
 * Giao diện phiên câu cá / đánh boss: dựng embed theo trạng thái + bộ hẹn giờ cập nhật tin nhắn.
 * Trạng thái thật luôn nằm trong DB và được tính theo thời gian máy chủ (fishingService.advance) –
 * bộ hẹn giờ chỉ để làm mới giao diện đúng lúc (cá cắn câu, hết hạn giật cần…).
 */
const K = require('./kit');
const { D } = require('../services/gameData');
const fishing = require('../services/fishingService');
const bossSvc = require('../services/bossService');
const weather = require('../systems/weather');
const fishSys = require('../systems/fish');
const R = require('../systems/rarity');
const mg = require('../systems/minigame');
const logger = require('../utils/logger');
const ctxBus = require('../services/context');
const { now } = require('../utils/time');
const { E, F, COLOR } = K;

const ACTIVE = ['waiting', 'bite', 'reeling'];
const timers = new Map(); // sessionId → { timer, edit }
const MOVE_ICON = { dash: '💨', thrash: '🌊', tire: '😮‍💨' };
const ACT_ICON = { pull: '⬆️', hold: '✊', release: '↩️' };

const fx = (n) => K.img('effects', n);
function sessionBtn(s, action, label, style, extra = {}) { return K.button({ id: K.cid('fs', s.id, s.nonce, action), label, style, ...extra }); }

function header(s) {
  const d = s.data; const loc = D.locations.get(s.location); const wx = weather.WEATHER[d.weather]; const tb = weather.TIME[d.timeBand];
  return `${E('locations', loc.id)} **${loc.name}** · ${E('ui', `weather_${d.weather}`)} ${wx.name} · ${E('ui', `time_${d.timeBand}`)} ${tb.name}`;
}
function hint(d) {
  const f = D.fishes.get(d.fishId);
  if (d.revealed) return `${E('ui', 'stat_detect')} Phát hiện: có vẻ là **${R.name(f.rarity)}** (${f.category.replace('_', ' ')}).`;
  return `${E('ui', 'stat_detect')} Chưa rõ con gì đang dòm mồi…`;
}
/* ------------------------------------------------------------------ CÂU CÁ */
function renderFish(s) {
  const d = s.data; const loc = D.locations.get(s.location); const files = []; const em = { thumb: null, image: null };
  const locImg = K.img('locations', loc.id); if (locImg) { files.push(locImg.file); em.image = locImg.url; }
  const rodDef = s.rod_instance_id ? require('../database/repositories/rods').get(s.rod_instance_id) : null;
  const rodImg = rodDef ? K.img('rods', rodDef.skin || rodDef.rod_id) : null; if (rodImg) { files.push(rodImg.file); em.thumb = rodImg.url; }
  if (s.state === 'waiting') {
    const e = K.embed({ title: '🎣 Đã thả câu – đang chờ cá cắn…', desc: `${header(s)}\n\n${hint(d)}\nMồi: ${d.baitName ? `**${d.baitName}**` : '*không dùng*'}\nCá sẽ cắn câu ${F.rel(s.bite_at)} — đừng giật cần quá sớm!`, color: COLOR.info, thumb: em.thumb, image: em.image, footer: `Phiên #${s.id}${d.skill ? ` · Thú cưng kích hoạt: ${d.skill}` : ''}` });
    return K.msg({ embeds: [e], files, components: K.rows([sessionBtn(s, 'refresh', 'Kiểm tra cá', 'secondary', { emoji: '🔄' }), sessionBtn(s, 'cancel', 'Thu cần', 'secondary', { emoji: '↩️' })]) });
  }
  if (s.state === 'bite') {
    const b = fx('bite'); if (b) files.push(b.file);
    const e = K.embed({ title: '❗ CÁ CẮN CÂU! GIẬT CẦN NGAY!', desc: `${header(s)}\n\n${hint(d)}\nPhải giật cần trước ${F.rel(s.deadline_at)}!`, color: COLOR.warn, thumb: b ? b.url : em.thumb, image: em.image, footer: `Phiên #${s.id}` });
    return K.msg({ embeds: [e], files, components: K.rows([sessionBtn(s, 'hook', 'GIẬT CẦN!', 'danger', { emoji: '🎣' }), sessionBtn(s, 'cancel', 'Thu cần', 'secondary')]) });
  }
  if (s.state === 'reeling') return renderReel(s, files, em);
  return renderEnd(s);
}
function stamBar(m) { return `${F.bar(m.stamina, m.maxStamina, 12)} ${Math.max(0, Math.round((m.stamina / m.maxStamina) * 100))}%`; }
function tensionBar(m) { const t = m.tension; return `${F.bar(t, 100, 12, t >= 80 ? '🟥' : t >= 55 ? '🟨' : '🟩', '⬛')} ${Math.round(t)}%`; }
function lastLine(d) {
  const l = d.last; if (!l) return '';
  const mv = mg.MOVES[l.move];
  return l.correct ? `\n✅ Lượt trước: cá **${mv.name}**, bạn **${l.action ? mg.ACTIONS[l.action].name : '—'}** đúng! (−${l.damage} sức)` : `\n❌ Lượt trước: cá **${mv.name}** nhưng ${l.action ? `bạn **${mg.ACTIONS[l.action].name}**` : 'bạn không kịp phản ứng'} — dây căng thêm!${l.saved ? '\n🛡️ Kháng chịu cứu dây!' : ''}`;
}
function renderReel(s, files = [], em = {}) {
  const d = s.data; const m = d.mini; const move = mg.MOVES[m.move]; const f = D.fishes.get(d.fishId);
  const name = d.revealed ? `**${f.name}** [${R.name(f.rarity)}]` : 'Một con cá bí ẩn';
  const e = K.embed({ title: `${MOVE_ICON[m.move]} ${name} đang ${move.name.toLowerCase()}!`, desc: `${header(s)}\n\n**${move.hint}**${lastLine(d)}\n\nSức cá  ${stamBar(m)}\nĐộ căng ${tensionBar(m)}${m.saved ? ' 🛡️' : ''}\nLượt ${m.round + 1}/${m.maxRounds} · phản ứng trước ${F.rel(d.roundDeadline)}`, color: m.tension >= 80 ? COLOR.err : COLOR.info, thumb: em.thumb, image: em.image, footer: `Phiên #${s.id} · Lao đi→Thả dây · Vùng vẫy→Giữ · Mệt lả→Kéo` });
  return K.msg({ embeds: [e], files, components: K.rows([sessionBtn(s, 'pull', 'Kéo', 'success', { emoji: ACT_ICON.pull }), sessionBtn(s, 'hold', 'Giữ', 'primary', { emoji: ACT_ICON.hold }), sessionBtn(s, 'release', 'Thả dây', 'secondary', { emoji: ACT_ICON.release }), sessionBtn(s, 'cancel', 'Thu cần', 'danger')]) });
}
function renderEnd(s) {
  if (s.kind === 'boss') return renderBossEnd(s);
  const r = s.result || (typeof s.result === 'string' ? JSON.parse(s.result) : {}); const loc = D.locations.get(s.location); const files = [];
  const again = K.button({ id: K.cid('fa', s.user_id, 'again'), label: 'Câu tiếp', style: 'primary', emoji: '🎣' });
  if (r.outcome === 'success') {
    const f = D.fishes.get(r.fishId); const v = fishSys.variantById(r.variant); const col = R.color(f.rarity); const fi = K.img('fish', f.id); const fr = K.img('effects', R.frameKey(f.rarity)); if (fi) files.push(fi.file); if (fr) files.push(fr.file);
    const lines = [`${E('fish', f.id)} **${f.name}** — ${K.rar(f.rarity)}${v.id !== 'thuong' ? ` · ✨ **${v.name}**` : ''}`, `⚖️ ${F.kg(r.weight)} · ${E('ui', 'coin')} ~${F.xu(r.baseValue)} · ${E('ui', 'exp')} +${F.num(r.exp)} EXP`];
    if (r.record) lines.push('🏅 **Kỷ lục cá nặng nhất của bạn!**'); if (r.codex?.isNew) lines.push('📖 **Loài mới được ghi vào Codex!**'); if (r.skill) lines.push(`🐾 Thú cưng kích hoạt **${r.skill}**`);
    if (Object.keys(r.drops || {}).length) lines.push(`🎁 Nhặt được: ${K.itemsText(r.drops)}`);
    if (r.level?.up) lines.push(`🆙 **Lên cấp ${r.level.level}!** ${r.level.rewards?.length ? '(nhận thưởng cấp)' : ''}`); if (r.petUp) lines.push(`🐾 ${r.petUp.name} lên cấp ${r.petUp.level}!`);
    if (r.newAch?.length) lines.push(`🏆 Thành tựu mới: ${r.newAch.map((a) => `**${a.name}**`).join(', ')}`);
    const e = K.embed({ title: `🎉 Câu thành công!`, desc: `${header(s)}\n\n${lines.join('\n')}\n\n*${f.desc}*`, color: col, image: fi?.url, thumb: fr?.url, footer: `Phiên #${s.id}` });
    return K.msg({ embeds: [e], files, components: K.rows([again, K.button({ id: K.cid('fa', s.user_id, 'sell', r.fishInstanceId), label: 'Bán ngay', style: 'success', emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: K.cid('fa', s.user_id, 'lock', r.fishInstanceId), label: 'Khoá cá', emoji: '🔒' }), K.button({ id: K.cid('v', s.user_id, 'fishbag', 'show'), label: 'Kho cá', emoji: K.emoji.btn('ui', 'backpack') })]) });
  }
  const T = { escaped: ['💨 Cá đã thoát!', COLOR.warn], fail: ['💥 Câu thất bại!', COLOR.err], timeout: ['⌛ Hết thời gian!', COLOR.warn], cancelled: ['↩️ Đã thu cần', COLOR.dark], cancel: ['↩️ Đã thu cần', COLOR.dark] }[s.state] || ['Kết thúc', COLOR.dark];
  const lost = r.lost && r.lost.revealed ? `\nCon cá đó là **${D.fishes.get(r.lost.fishId).name}** [${R.name(r.lost.rarity)}].` : '';
  const li = K.img('locations', loc.id); if (li) files.push(li.file);
  return K.msg({ embeds: [K.embed({ title: T[0], desc: `${header(s)}\n\n${r.reason || ''}${lost}`, color: T[1], thumb: li?.url, footer: `Phiên #${s.id}` })], files, components: K.rows([again, K.button({ id: K.cid('v', s.user_id, 'rod', 'show'), label: 'Cần câu', emoji: K.emoji.btn('ui', 'rod') })]) });
}
/* ------------------------------------------------------------------ BOSS */
function renderBoss(s) {
  if (!ACTIVE.includes(s.state)) return renderBossEnd(s);
  const d = s.data; const m = d.mini; const move = mg.MOVES[m.move]; const b = bossSvc.status(d.bossInstanceId); const def = D.bosses.get(d.bossId); const files = [];
  const li = K.img('locations', def.location); const fi = K.img('fish', def.trophyFish); if (li) files.push(li.file); if (fi) files.push(fi.file);
  const lastTxt = d.last ? (d.last.correct ? `\n✅ Trúng đòn! **−${F.num(d.last.damage)}** HP (combo ×${m.combo})` : '\n❌ Hụt đòn – mất combo!') : '';
  const e = K.embed({ title: `👹 ${def.name}`, desc: `HP  ${F.bar(b.hp, b.max_hp, 14, '🟥', '⬛')} ${F.num(b.hp)}/${F.num(b.max_hp)}\n\n${MOVE_ICON[m.move]} Boss **${move.name}** — **${move.hint}**${lastTxt}\nSát thương đợt này: **${F.num(m.total)}** · Lượt ${m.round + 1}/${m.maxRounds} · phản ứng trước ${F.rel(d.roundDeadline)}${d.party?.members > 1 ? `\n👥 Tổ đội ${d.party.members} người: +${Math.round(d.party.bonus * 100)}% sát thương` : ''}`, color: COLOR.err, image: li?.url, thumb: fi?.url, footer: `Đợt đánh #${s.id}` });
  return K.msg({ embeds: [e], files, components: K.rows([sessionBtn(s, 'pull', 'Kéo', 'success', { emoji: ACT_ICON.pull }), sessionBtn(s, 'hold', 'Giữ', 'primary', { emoji: ACT_ICON.hold }), sessionBtn(s, 'release', 'Thả dây', 'secondary', { emoji: ACT_ICON.release }), sessionBtn(s, 'cancel', 'Rút lui', 'danger')]) });
}
function renderBossEnd(s) {
  const r = s.result || {}; const def = D.bosses.get(s.data.bossId); const files = []; const li = K.img('locations', def.location); if (li) files.push(li.file);
  const lines = [`Gây **${F.num(r.damage || 0)}** sát thương (${r.hits || 0}/${s.data.mini.maxRounds} đòn trúng).`]; if (r.hp != null) lines.push(`HP boss còn: ${F.num(r.hp)}/${F.num(r.maxHp)}`);
  if (r.defeated) lines.push(`🎉 **${def.name} đã bị hạ gục!** Phần thưởng đã được chia theo đóng góp.`); if (r.ended) lines.push('Boss đã rời đi.'); if (r.newAch?.length) lines.push(`🏆 ${r.newAch.map((a) => `**${a.name}**`).join(', ')}`);
  return K.msg({ embeds: [K.embed({ title: r.defeated ? '🏆 Boss bị hạ!' : '⚔️ Kết thúc đợt tấn công', desc: lines.join('\n'), color: r.defeated ? COLOR.gold : COLOR.dark, image: li?.url, footer: `Đợt đánh #${s.id}` })], files, components: K.rows([K.button({ id: K.cid('fa', s.user_id, 'boss', s.data.bossInstanceId), label: 'Đánh tiếp', style: 'danger', emoji: '⚔️' }), K.button({ id: K.cid('v', s.user_id, 'boss', 'show', s.data.bossInstanceId), label: 'Bảng boss', emoji: K.emoji.btn('ui', 'boss') })]) });
}
const render = (s) => (s.kind === 'boss' ? renderBoss(s) : renderFish(s));
/* ------------------------------------------------------------------ HẸN GIỜ LÀM MỚI */
/** `edit(payload)` là hàm sửa tin nhắn gốc (interaction.editReply hoặc sửa tin nhắn kênh). */
function track(s, edit) {
  const old = timers.get(s.id); if (old) clearTimeout(old.timer);
  if (!ACTIVE.includes(s.state)) { timers.delete(s.id); return; }
  const t = now(); const d = s.data;
  const at = s.state === 'waiting' ? s.bite_at + 80 : s.state === 'bite' ? s.deadline_at + 1700 : (d.roundDeadline || t) + 1700;
  const delay = Math.max(200, Math.min(at - t, 2 ** 30)); const entry = { edit };
  entry.timer = setTimeout(() => tick(s.id), delay); entry.timer.unref?.(); timers.set(s.id, entry);
}
// Mã lỗi Discord không thể phục hồi (tin nhắn đã xoá, token hết hạn, thiếu quyền…) → ngừng thử lại.
const PERMANENT = new Set([10003, 10008, 10015, 10062, 50001, 50013, 50027, 40060]);
async function tick(id) {
  const entry = timers.get(id); if (!entry) return; timers.delete(id);
  if (ctxBus.restoring) { entry.timer = setTimeout(() => tick(id), 3000); entry.timer.unref?.(); timers.set(id, entry); return; }
  try {
    const s = fishing.advance(id); if (!s) return;
    await entry.edit(render(s)); track(s, entry.edit);
  } catch (e) {
    logger.warn(`Làm mới phiên ${id} lỗi: ${e.message}`);
    // Lỗi tạm thời (mạng, rate limit…) → thử lại vài lần để tin nhắn không bị kẹt ở "đang chờ"; người chơi vẫn có nút 🔄 Kiểm tra cá.
    entry.fails = (entry.fails || 0) + 1;
    if (!PERMANENT.has(e.code) && entry.fails <= 4) { entry.timer = setTimeout(() => tick(id), 1500 * 2 ** entry.fails); entry.timer.unref?.(); timers.set(id, entry); }
  }
}
const clearAll = () => { for (const v of timers.values()) clearTimeout(v.timer); timers.clear(); };
module.exports = { render, renderFish, renderBoss, track, tick, clearAll, ACTIVE, timers };
