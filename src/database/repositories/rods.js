'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const get = (id) => db().get('SELECT * FROM rod_instances WHERE id=?', id);
const owned = (userId, id) => db().get('SELECT * FROM rod_instances WHERE id=? AND user_id=?', id, userId);
const list = (userId) => db().all('SELECT * FROM rod_instances WHERE user_id=? ORDER BY id', userId);
function create(userId, rodId, { level = 1, maxDurability, durability, enhance = 0 }) {
  const id = db().run('INSERT INTO rod_instances(user_id,rod_id,level,enhance,durability,max_durability,created_at) VALUES(?,?,?,?,?,?,?)', userId, rodId, level, enhance, durability ?? maxDurability, maxDurability, now()).lastInsertRowid;
  db().run('INSERT OR IGNORE INTO user_skins(user_id,skin_id) VALUES(?,?)', userId, rodId);
  return id;
}
const FIELDS = ['level', 'enhance', 'durability', 'max_durability', 'awaken', 'sockets', 'skin', 'pity', 'locked', 'listed', 'user_id'];
function update(id, f) { const ks = Object.keys(f); for (const k of ks) if (!FIELDS.includes(k)) throw new Error(`Trường cần không hợp lệ: ${k}`); db().run(`UPDATE rod_instances SET ${ks.map((k) => `${k}=?`).join(',')} WHERE id=?`, ...ks.map((k) => f[k]), id); }
const remove = (id) => db().run('DELETE FROM rod_instances WHERE id=?', id);
const skins = (userId) => db().all('SELECT skin_id FROM user_skins WHERE user_id=?', userId).map((r) => r.skin_id);
const addSkin = (userId, skin) => db().run('INSERT OR IGNORE INTO user_skins(user_id,skin_id) VALUES(?,?)', userId, skin);
const countOwned = (userId) => db().value('SELECT COUNT(*) FROM rod_instances WHERE user_id=? AND listed=0', userId);
module.exports = { get, owned, list, create, update, remove, skins, addSkin, countOwned };
