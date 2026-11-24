'use strict';
const { getDb } = require('../connection');
const db = () => getDb();
const count = (userId, itemId) => db().value('SELECT qty FROM inventory WHERE user_id=? AND item_id=?', userId, itemId) || 0;
const all = (userId) => db().all('SELECT item_id, qty, locked FROM inventory WHERE user_id=? AND qty>0', userId);
function add(userId, itemId, qty) { db().run('INSERT INTO inventory(user_id,item_id,qty) VALUES(?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET qty=qty+excluded.qty', userId, itemId, qty); }
/** Trừ vật phẩm – điều kiện qty>=? nằm trong chính câu UPDATE nên không thể âm/trừ trùng. */
function remove(userId, itemId, qty) { const r = db().run('UPDATE inventory SET qty=qty-? WHERE user_id=? AND item_id=? AND qty>=? AND locked=0', qty, userId, itemId, qty); if (!r.changes) return false; db().run('DELETE FROM inventory WHERE user_id=? AND item_id=? AND qty=0', userId, itemId); return true; }
/** Trừ bỏ qua cờ khoá (dùng cho nguyên liệu chế tạo/mồi khi người chơi chủ động dùng) */
function consume(userId, itemId, qty) { const r = db().run('UPDATE inventory SET qty=qty-? WHERE user_id=? AND item_id=? AND qty>=?', qty, userId, itemId, qty); if (!r.changes) return false; db().run('DELETE FROM inventory WHERE user_id=? AND item_id=? AND qty=0', userId, itemId); return true; }
const setLocked = (userId, itemId, v) => db().run('UPDATE inventory SET locked=? WHERE user_id=? AND item_id=? AND qty>0', v ? 1 : 0, userId, itemId).changes > 0;
module.exports = { count, all, add, remove, consume, setLocked };
