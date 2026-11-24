'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const get = (id) => db().get('SELECT * FROM pet_instances WHERE id=?', id);
const owned = (userId, id) => db().get('SELECT * FROM pet_instances WHERE id=? AND user_id=?', id, userId);
const list = (userId) => db().all('SELECT * FROM pet_instances WHERE user_id=? ORDER BY id', userId);
const create = (userId, petId) => db().run('INSERT INTO pet_instances(user_id,pet_id,created_at) VALUES(?,?,?)', userId, petId, now()).lastInsertRowid;
const FIELDS = ['level', 'exp', 'bond', 'stage', 'nickname', 'locked'];
function update(id, f) { const ks = Object.keys(f); for (const k of ks) if (!FIELDS.includes(k)) throw new Error(`Trường thú không hợp lệ: ${k}`); db().run(`UPDATE pet_instances SET ${ks.map((k) => `${k}=?`).join(',')} WHERE id=?`, ...ks.map((k) => f[k]), id); }
const remove = (id) => db().run('DELETE FROM pet_instances WHERE id=?', id);
module.exports = { get, owned, list, create, update, remove };
