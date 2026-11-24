'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const create = (userId, f) => db().run('INSERT INTO fish_instances(user_id,fish_id,weight,variant,rarity,base_value,location,caught_at,source) VALUES(?,?,?,?,?,?,?,?,?)', userId, f.fish_id, f.weight, f.variant, f.rarity, f.base_value, f.location ?? null, now(), f.source || 'cau').lastInsertRowid;
const get = (id) => db().get('SELECT * FROM fish_instances WHERE id=?', id);
const owned = (userId, id) => db().get('SELECT * FROM fish_instances WHERE id=? AND user_id=?', id, userId);
const remove = (id) => db().run('DELETE FROM fish_instances WHERE id=?', id).changes;
const count = (userId, includeListed = false) => db().value(`SELECT COUNT(*) FROM fish_instances WHERE user_id=?${includeListed ? '' : ' AND listed=0'}`, userId);
const SORTS = { moi: 'id DESC', cu: 'id ASC', gia: 'base_value DESC', can: 'weight DESC', hiem: 'rarity DESC, base_value DESC' };
function search(userId, { rarityMin = 1, rarityMax = 9, location = null, q = null, sort = 'moi', limit = 10, offset = 0, onlyUnlocked = false } = {}) {
  const w = ['user_id=?', 'listed=0', 'rarity>=?', 'rarity<=?']; const a = [userId, rarityMin, rarityMax];
  if (location) { w.push('location=?'); a.push(location); } if (q) { w.push('fish_id LIKE ?'); a.push(`%${q}%`); } if (onlyUnlocked) w.push('locked=0');
  const where = w.join(' AND ');
  return { rows: db().all(`SELECT * FROM fish_instances WHERE ${where} ORDER BY ${SORTS[sort] || SORTS.moi} LIMIT ? OFFSET ?`, ...a, limit, offset), total: db().value(`SELECT COUNT(*) FROM fish_instances WHERE ${where}`, ...a) };
}
const setLocked = (userId, id, v) => db().run('UPDATE fish_instances SET locked=? WHERE id=? AND user_id=? AND listed=0', v ? 1 : 0, id, userId).changes > 0;
function sellable(userId, { rarityMax = 9, location = null } = {}) { const a = [userId, rarityMax]; let sql = 'SELECT * FROM fish_instances WHERE user_id=? AND locked=0 AND listed=0 AND rarity<=?'; if (location) { sql += ' AND location=?'; a.push(location); } return db().all(sql, ...a); }
/* codex */
function codexUpsert(userId, fishId, weight, variant) {
  const r = db().get('SELECT * FROM codex WHERE user_id=? AND fish_id=?', userId, fishId);
  if (!r) { db().run('INSERT INTO codex(user_id,fish_id,count,best_weight,first_at,variants) VALUES(?,?,1,?,?,?)', userId, fishId, weight, now(), JSON.stringify([variant])); return { isNew: true }; }
  const vs = JSON.parse(r.variants); if (!vs.includes(variant)) vs.push(variant);
  db().run('UPDATE codex SET count=count+1, best_weight=MAX(best_weight,?), variants=? WHERE user_id=? AND fish_id=?', weight, JSON.stringify(vs), userId, fishId);
  return { isNew: false, newVariant: !JSON.parse(r.variants).includes(variant), record: weight > r.best_weight };
}
const codex = (userId) => new Map(db().all('SELECT * FROM codex WHERE user_id=?', userId).map((r) => [r.fish_id, r]));
const codexCount = (userId) => db().value('SELECT COUNT(*) FROM codex WHERE user_id=?', userId);
/* history */
const addHistory = (h) => db().run('INSERT INTO fishing_history(user_id,session_id,fish_id,fish_instance_id,location,weight,rarity,variant,result,exp,value,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', h.user_id, h.session_id ?? null, h.fish_id ?? null, h.fish_instance_id ?? null, h.location ?? null, h.weight ?? null, h.rarity ?? null, h.variant ?? null, h.result, h.exp || 0, h.value || 0, now());
const recentHistory = (userId, n = 10) => db().all('SELECT * FROM fishing_history WHERE user_id=? ORDER BY id DESC LIMIT ?', userId, n);
module.exports = { create, get, owned, remove, count, search, setLocked, sellable, codexUpsert, codex, codexCount, addHistory, recentHistory };
