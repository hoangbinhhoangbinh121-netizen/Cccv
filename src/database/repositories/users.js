'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const get = (id) => db().get('SELECT * FROM users WHERE id=?', id);
const FIELDS = ['name', 'level', 'exp', 'location', 'title', 'inv_capacity', 'daily_streak', 'last_daily', 'banned', 'ban_reason', 'last_seen'];
function update(id, fields) {
  const keys = Object.keys(fields); for (const k of keys) if (!FIELDS.includes(k)) throw new Error(`Trường không hợp lệ: ${k}`);
  if (!keys.length) return; db().run(`UPDATE users SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, ...keys.map((k) => fields[k]), id);
}
/** Tạo người chơi + toàn bộ bản ghi liên quan trong một giao dịch. Trả về { user, created }. */
function ensure(id, name = '') {
  const u = get(id); const t = now();
  if (u) { if (name && u.name !== name) update(id, { name, last_seen: t }); else db().run('UPDATE users SET last_seen=? WHERE id=? AND last_seen<?', t, id, t - 60000); return { user: get(id), created: false }; }
  db().tx(() => {
    db().run('INSERT OR IGNORE INTO users(id,name,created_at,last_seen) VALUES(?,?,?,?)', id, name, t, t);
    db().run('INSERT OR IGNORE INTO user_stats(user_id) VALUES(?)', id);
    db().run("INSERT OR IGNORE INTO currencies(user_id,code,balance) VALUES(?,'xu',0)", id);
    db().run('INSERT OR IGNORE INTO equipment(user_id) VALUES(?)', id);
    db().run("INSERT OR IGNORE INTO user_locations(user_id,location_id,unlocked_at) VALUES(?, 'ao_lang', ?)", id, t);
  });
  return { user: get(id), created: true };
}
const stats = (id) => db().get('SELECT * FROM user_stats WHERE user_id=?', id);
const STAT_FIELDS = ['total_catch', 'total_weight', 'rare_catch', 'legend_catch', 'ancient_catch', 'unique_catch', 'deep_catch', 'boss_kills', 'boss_damage', 'coins_earned', 'coins_spent', 'sales_count', 'fail_count', 'escaped_count', 'rod_upgrades', 'rod_enhances', 'crafts', 'market_sales', 'market_buys', 'chests_opened'];
function bumpStats(id, inc) {
  const ks = Object.keys(inc).filter((k) => STAT_FIELDS.includes(k) && inc[k]); if (!ks.length) return;
  db().run(`UPDATE user_stats SET ${ks.map((k) => `${k}=${k}+?`).join(',')} WHERE user_id=?`, ...ks.map((k) => inc[k]), id);
}
const equipment = (id) => db().get('SELECT * FROM equipment WHERE user_id=?', id);
const EQ = ['rod_id', 'bait_id', 'float_id', 'line_id', 'hook_id', 'pet_id'];
function setEquip(id, field, value) { if (!EQ.includes(field)) throw new Error('Ô trang bị không hợp lệ'); db().run(`UPDATE equipment SET ${field}=? WHERE user_id=?`, value, id); }
const unlockedLocations = (id) => db().all('SELECT location_id FROM user_locations WHERE user_id=?', id).map((r) => r.location_id);
const unlockLocation = (id, loc) => db().run('INSERT OR IGNORE INTO user_locations(user_id,location_id,unlocked_at) VALUES(?,?,?)', id, loc, now());
const count = () => db().value('SELECT COUNT(*) FROM users');
module.exports = { get, update, ensure, stats, bumpStats, equipment, setEquip, unlockedLocations, unlockLocation, count };
