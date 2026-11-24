'use strict';
const config = require('../../config');
const { getDb } = require('../connection');
const { now } = require('../../utils/time');

/** Cấu hình động (bảng settings) – /fishing-config ghi vào đây; chưa đặt thì dùng config.defaults. */
const cache = new Map();
function get(key) {
  const def = config.defaults[key];
  let raw;
  if (cache.has(key)) raw = cache.get(key);
  else { try { const r = getDb().get('SELECT value FROM settings WHERE key=?', key); raw = r ? r.value : undefined; } catch { raw = undefined; } cache.set(key, raw); }
  if (raw === undefined) return def;
  return typeof def === 'number' ? Number(raw) : String(raw);
}
function set(key, value) { getDb().run('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at', key, String(value), now()); cache.set(key, String(value)); }
function unset(key) { getDb().run('DELETE FROM settings WHERE key=?', key); cache.delete(key); }
const clearCache = () => cache.clear();
function all() { const o = { ...config.defaults }; for (const k of Object.keys(config.defaults)) o[k] = get(k); return o; }
/** Khoá tự do (không nằm trong defaults): ghi đè thời tiết, cờ… */
const getRaw = (key) => { const r = getDb().get('SELECT value FROM settings WHERE key=?', key); return r ? r.value : null; };

function log(adminId, action, target, detail) { getDb().run('INSERT INTO admin_log(admin_id,action,target,detail,created_at) VALUES(?,?,?,?,?)', adminId, action, target ?? null, detail ?? null, now()); }
const recentLog = (n = 20) => getDb().all('SELECT * FROM admin_log ORDER BY id DESC LIMIT ?', n);

/* cooldown */
function cooldownLeft(userId, key, t = now()) { const r = getDb().get('SELECT until FROM cooldowns WHERE user_id=? AND key=?', userId, key); return r && r.until > t ? r.until - t : 0; }
const setCooldown = (userId, key, ms, t = now()) => getDb().run('INSERT INTO cooldowns(user_id,key,until) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET until=excluded.until', userId, key, t + ms);
const clearCooldowns = (userId) => getDb().run('DELETE FROM cooldowns WHERE user_id=?', userId);

/* buff (bình hỗ trợ) */
const activeBuffs = (userId, t = now()) => getDb().all('SELECT stat, value, until FROM buffs WHERE user_id=? AND until>?', userId, t);
const addBuff = (userId, stat, value, until) => getDb().run('INSERT INTO buffs(user_id,stat,value,until) VALUES(?,?,?,?) ON CONFLICT(user_id,stat) DO UPDATE SET value=excluded.value, until=excluded.until', userId, stat, value, until);
const purgeBuffs = (t = now()) => getDb().run('DELETE FROM buffs WHERE until<=?', t);
module.exports = { get, set, unset, all, getRaw, clearCache, log, recentLog, cooldownLeft, setCooldown, clearCooldowns, activeBuffs, addBuff, purgeBuffs };
