'use strict';
const { D, item: itemDef } = require('./gameData');
const users = require('../database/repositories/users');
const settings = require('../database/repositories/settings');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const rodSvc = require('./rodService');
const fishing = require('./fishingService');
const fishRepo = require('../database/repositories/fish');
const fishSys = require('../systems/fish');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { now } = require('../utils/time');

/** Kiểm tra toàn vẹn nghiệp vụ: số dư = tổng giao dịch, không có mồ côi, không có phiên trùng. */
function integrityCheck() {
  const db = getDb(); const issues = [];
  const bad = db.all("SELECT c.user_id, c.balance, COALESCE(SUM(t.amount),0) s FROM currencies c LEFT JOIN transactions t ON t.user_id=c.user_id AND t.currency=c.code GROUP BY c.user_id, c.code HAVING c.balance != s");
  for (const r of bad) issues.push(`Số dư lệch sổ cái: user ${r.user_id} (số dư ${r.balance} ≠ tổng giao dịch ${r.s})`);
  const q = (sql, msg) => { const n = db.value(sql); if (n) issues.push(`${msg}: ${n}`); };
  q('SELECT COUNT(*) FROM fish_instances f LEFT JOIN users u ON u.id=f.user_id WHERE u.id IS NULL', 'Cá không có chủ');
  q('SELECT COUNT(*) FROM rod_instances f LEFT JOIN users u ON u.id=f.user_id WHERE u.id IS NULL', 'Cần không có chủ');
  q("SELECT COUNT(*) FROM fish_instances WHERE listed=1 AND id NOT IN (SELECT ref_id FROM market_listings WHERE kind='fish' AND status='active')", 'Cá đánh dấu rao bán nhưng không có tin đăng');
  q("SELECT COUNT(*) FROM rod_instances WHERE listed=1 AND id NOT IN (SELECT ref_id FROM market_listings WHERE kind='rod' AND status='active')", 'Cần đánh dấu rao bán nhưng không có tin đăng');
  q('SELECT COUNT(*) FROM equipment e JOIN rod_instances r ON r.id=e.rod_id WHERE r.user_id!=e.user_id', 'Trang bị cần của người khác');
  q('SELECT COUNT(*) FROM equipment e WHERE e.rod_id IS NOT NULL AND e.rod_id NOT IN (SELECT id FROM rod_instances)', 'Trang bị trỏ tới cần không tồn tại');
  q('SELECT COUNT(*) FROM inventory WHERE qty<0', 'Số lượng vật phẩm âm');
  q('SELECT COUNT(*) FROM users u LEFT JOIN user_stats s ON s.user_id=u.id WHERE s.user_id IS NULL', 'Người chơi thiếu user_stats');
  q("SELECT COUNT(*) FROM (SELECT user_id FROM fishing_sessions WHERE state IN ('waiting','bite','reeling') GROUP BY user_id HAVING COUNT(*)>1)", 'Người chơi có nhiều phiên câu đồng thời');
  for (const r of db.all('SELECT DISTINCT item_id FROM inventory')) if (!itemDef(r.item_id)) issues.push(`Vật phẩm không còn trong dữ liệu: ${r.item_id}`);
  return { ok: issues.length === 0, issues };
}
function globalStats() {
  const db = getDb();
  return { users: db.value('SELECT COUNT(*) FROM users'), banned: db.value('SELECT COUNT(*) FROM users WHERE banned=1'), active24h: db.value('SELECT COUNT(*) FROM users WHERE last_seen>?', now() - 86400000), xuTotal: db.value("SELECT COALESCE(SUM(balance),0) FROM currencies WHERE code='xu'"), fish: db.value('SELECT COUNT(*) FROM fish_instances'), rods: db.value('SELECT COUNT(*) FROM rod_instances'), catches: db.value('SELECT COALESCE(SUM(total_catch),0) FROM user_stats'), tx: db.value('SELECT COUNT(*) FROM transactions'), listings: db.value("SELECT COUNT(*) FROM market_listings WHERE status='active'"), sessions: db.value("SELECT COUNT(*) FROM fishing_sessions WHERE state IN ('waiting','bite','reeling')"), dbBytes: require('fs').existsSync(db.file) ? require('fs').statSync(db.file).size : 0 };
}
function mustUser(id) { const u = users.get(id); if (!u) throw new GameError('Người chơi này chưa đăng ký.'); return u; }
function giveXu(adminId, targetId, amount, note) { mustUser(targetId); return getDb().tx(() => { const r = amount >= 0 ? economy.credit(targetId, amount, 'admin', { note: note || `admin ${adminId}` }) : economy.debit(targetId, -amount, 'admin', { note: note || `admin ${adminId}` }); settings.log(adminId, 'xu', targetId, String(amount)); return r; }); }
function giveItem(adminId, targetId, itemId, qty) { mustUser(targetId); if (!itemDef(itemId)) throw new GameError('Vật phẩm không tồn tại.'); return getDb().tx(() => { invSvc.grant(targetId, { [itemId]: qty }, { force: true }); settings.log(adminId, 'item', targetId, `${itemId} x${qty}`); }); }
function giveRod(adminId, targetId, rodId, level = 1, enhance = 0) { mustUser(targetId); return getDb().tx(() => { const id = rodSvc.grantRod(targetId, rodId, { level, enhance, force: true }); settings.log(adminId, 'rod', targetId, `${rodId} Lv${level}+${enhance}`); return id; }); }
function giveFish(adminId, targetId, fishId, weight) { mustUser(targetId); const f = D.fishes.get(fishId); if (!f) throw new GameError('Cá không tồn tại.'); const w = weight || f.minWeight; const v = fishSys.variantById('thuong'); return getDb().tx(() => { const id = fishRepo.create(targetId, { fish_id: f.id, weight: w, variant: v.id, rarity: f.rarity, base_value: fishSys.baseValue(f, w, v), location: f.location, source: 'admin' }); fishRepo.codexUpsert(targetId, f.id, w, v.id); settings.log(adminId, 'fish', targetId, `${fishId} ${w}kg`); return id; }); }
function setLevel(adminId, targetId, level) { mustUser(targetId); users.update(targetId, { level, exp: 0 }); settings.log(adminId, 'level', targetId, String(level)); }
function ban(adminId, targetId, reason) { mustUser(targetId); users.update(targetId, { banned: 1, ban_reason: reason || null }); fishing.forceEnd(targetId); settings.log(adminId, 'ban', targetId, reason); }
function unban(adminId, targetId) { mustUser(targetId); users.update(targetId, { banned: 0, ban_reason: null }); settings.log(adminId, 'unban', targetId, ''); }
/** Xoá toàn bộ dữ liệu game của một người chơi (không thể hoàn tác trừ khi khôi phục backup). */
function resetUser(adminId, targetId) { mustUser(targetId); return getDb().tx(() => { fishing.forceEnd(targetId); getDb().run('DELETE FROM market_listings WHERE seller_id=? AND status=\'active\'', targetId); getDb().run('DELETE FROM users WHERE id=?', targetId); for (const t of ['transactions', 'cooldowns', 'fishing_history', 'fishing_sessions']) getDb().run(`DELETE FROM ${t} WHERE user_id=?`, targetId); settings.log(adminId, 'reset', targetId, ''); }); }
function setWeather(adminId, loc, weather, minutes) { if (!D.locations.has(loc)) throw new GameError('Khu vực không tồn tại.'); if (!require('../systems/weather').WEATHER[weather]) throw new GameError('Thời tiết không hợp lệ.'); settings.set(`weather:${loc}`, JSON.stringify({ weather, until: now() + minutes * 60000 })); settings.log(adminId, 'weather', loc, `${weather} ${minutes}p`); }
const CONFIG_KEYS = { backup_interval_min: [1, 1440], backup_keep_auto: [3, 500], backup_keep_manual: [1, 200], backup_max_age_days: [1, 90], backup_max_total_mb: [10, 20000], backup_auto_enabled: [0, 1], backup_upload_log: [0, 1], market_fee_pct: [0, 30], market_max_listings: [1, 100], market_expire_hours: [1, 720], transfer_fee_pct: [0, 30], transfer_daily_cap: [0, 1e9], transfer_min_level: [1, 100], daily_xu_base: [0, 1e6], exp_rate: [0.1, 20], xu_rate: [0.1, 20], luck_rate: [0.1, 5], boss_auto_spawn: [0, 1], boss_respawn_hours: [0.1, 168], maintenance: [0, 1], announce_channel: null, log_channel: null };
function setConfig(adminId, key, value) {
  if (!(key in CONFIG_KEYS)) throw new GameError(`Khoá cấu hình không hợp lệ. Hợp lệ: ${Object.keys(CONFIG_KEYS).join(', ')}`); const rule = CONFIG_KEYS[key];
  if (rule) { const n = Number(value); if (!Number.isFinite(n) || n < rule[0] || n > rule[1]) throw new GameError(`Giá trị cho ${key} phải trong khoảng ${rule[0]}–${rule[1]}.`); value = n; }
  settings.set(key, value); settings.log(adminId, 'config', key, String(value)); return value;
}
module.exports = { integrityCheck, globalStats, giveXu, giveItem, giveRod, giveFish, setLevel, ban, unban, resetUser, setWeather, setConfig, CONFIG_KEYS };
