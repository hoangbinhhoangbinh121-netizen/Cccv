'use strict';
/**
 * Emoji Pixel Art.
 *  - Mỗi PNG trong assets/ có một "khoá emoji" (assets/manifest.json). Khi đã tải lên làm Application Emoji của bot
 *    (`npm run emojis` hoặc /fishing-admin upload-emojis) thì dùng <:khoá:id> trong nội dung tin nhắn.
 *  - Chưa tải lên → dùng emoji Unicode dự phòng; ảnh vẫn hiển thị đầy đủ qua tệp đính kèm (thumbnail/ảnh embed).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const settings = require('../database/repositories/settings');
const logger = require('../utils/logger');
const { D, ensureLoaded } = require('../services/gameData');

const FALLBACK = { fish: '🐟', rods: '🎣', baits: '🪱', pets: '🐾', items: '🎒', locations: '🏞️', effects: '✨', ui: '🔹' };
const UI_FALLBACK = { coin: '🪙', exp: '⭐', durability: '🔧', fish: '🐟', rod: '🎣', backpack: '🎒', boss: '👹', market: '🏪', mission: '📜', achievement: '🏆', pet: '🐾', location: '📍', title: '🎖️', stat_luck: '🍀', stat_power: '💪', stat_speed: '⚡', stat_detect: '🔍', stat_resist: '🛡️', stat_durability: '🔧', time_dawn: '🌅', time_day: '☀️', time_dusk: '🌇', time_night: '🌙', weather_nang: '☀️', weather_mua: '🌧️', weather_bao: '⛈️', weather_suong_mu: '🌫️', weather_tuyet: '❄️', weather_cuc_quang: '🌌' };

let reverse = null; // "dir/id.png" → khoá emoji
let ids = null; // khoá → id emoji đã tải lên
const manifest = () => { ensureLoaded(); return D.manifest || {}; };
function build() { reverse = new Map(Object.entries(manifest()).map(([k, v]) => [v, k])); }
function loadIds() { try { ids = JSON.parse(settings.getRaw('emoji_ids') || '{}'); } catch { ids = {}; } }
const reset = () => { reverse = null; ids = null; };

const relFile = (kind, id) => `${kind}/${id}.png`;
const hasFile = (kind, id) => fs.existsSync(path.join(config.assetsDir, relFile(kind, id)));
const key = (kind, id) => { if (!reverse) build(); return reverse.get(relFile(kind, id)) || null; };
/** Emoji dạng văn bản: <:khoá:id> nếu đã tải lên, ngược lại Unicode dự phòng. */
function e(kind, id) {
  if (!ids) loadIds(); const k = key(kind, id);
  if (k && ids[k]) return `<:${k}:${ids[k]}>`;
  return kind === 'ui' ? UI_FALLBACK[id] || FALLBACK.ui : FALLBACK[kind] || '▫️';
}
/** Phần "emoji" cho nút/menu (object {id,name} hoặc chuỗi Unicode). */
function btn(kind, id) {
  if (!ids) loadIds(); const k = key(kind, id);
  if (k && ids[k]) return { id: ids[k], name: k };
  return kind === 'ui' ? UI_FALLBACK[id] || FALLBACK.ui : FALLBACK[kind];
}
/** Tệp đính kèm cho ảnh pixel art. Trả {file, url, name} hoặc null nếu thiếu ảnh. */
function attach(kind, id, nameHint) {
  if (!hasFile(kind, id)) return null; const { AttachmentBuilder } = require('discord.js'); const name = `${nameHint || `${kind}_${id}`}.png`.replace(/[^A-Za-z0-9_.-]/g, '_');
  return { file: new AttachmentBuilder(path.join(config.assetsDir, relFile(kind, id)), { name }), url: `attachment://${name}`, name };
}
/** Tải toàn bộ ảnh trong manifest lên làm Application Emoji (bỏ qua ảnh đã có). */
async function syncToDiscord(client, { onProgress } = {}) {
  const m = manifest(); const coll = await client.application.emojis.fetch(); const have = new Map([...coll.values()].map((x) => [x.name, x.id]));
  const map = {}; let created = 0; let reused = 0; const failed = [];
  for (const [k, rel] of Object.entries(m)) {
    if (have.has(k)) { map[k] = have.get(k); reused++; continue; }
    try { const em = await client.application.emojis.create({ attachment: path.join(config.assetsDir, rel), name: k }); map[k] = em.id; created++; if (onProgress && created % 20 === 0) onProgress({ created, total: Object.keys(m).length }); }
    catch (err) { failed.push(`${k}: ${err.message}`); if (/rate|429/i.test(err.message)) await new Promise((r) => setTimeout(r, 4000)); }
  }
  settings.set('emoji_ids', JSON.stringify({ ...JSON.parse(settings.getRaw('emoji_ids') || '{}'), ...map })); reset();
  logger.info(`Emoji: tạo mới ${created}, dùng lại ${reused}, lỗi ${failed.length}`);
  return { created, reused, failed, total: Object.keys(m).length };
}
module.exports = { e, btn, attach, key, hasFile, syncToDiscord, reset, FALLBACK };
