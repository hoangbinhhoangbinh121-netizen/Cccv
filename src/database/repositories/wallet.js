'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const balance = (userId, code = 'xu') => db().value('SELECT balance FROM currencies WHERE user_id=? AND code=?', userId, code) ?? 0;
/** Ghi nhật ký giao dịch. idem trùng → trả về null (giao dịch đã xử lý trước đó). */
function apply(userId, amount, type, { code = 'xu', ref = null, note = null, idem = null } = {}) {
  if (!Number.isInteger(amount)) throw new Error('Số tiền phải là số nguyên');
  if (idem && db().get('SELECT 1 FROM transactions WHERE idem_key=?', idem)) return null;
  db().run('INSERT OR IGNORE INTO currencies(user_id,code,balance) VALUES(?,?,0)', userId, code);
  const r = db().run('UPDATE currencies SET balance=balance+? WHERE user_id=? AND code=? AND balance+?>=0', amount, userId, code, amount);
  if (!r.changes) return false; // không đủ số dư
  const after = balance(userId, code);
  db().run('INSERT INTO transactions(user_id,currency,amount,balance_after,type,ref,note,idem_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)', userId, code, amount, after, type, ref, note, idem, now());
  if (code === 'xu') { if (amount > 0) db().run('UPDATE user_stats SET coins_earned=coins_earned+? WHERE user_id=?', amount, userId); else db().run('UPDATE user_stats SET coins_spent=coins_spent+? WHERE user_id=?', -amount, userId); }
  return after;
}
const history = (userId, limit = 15, offset = 0) => db().all('SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?', userId, limit, offset);
const historyCount = (userId) => db().value('SELECT COUNT(*) FROM transactions WHERE user_id=?', userId);
const sumSince = (userId, type, since) => db().value('SELECT COALESCE(SUM(-amount),0) FROM transactions WHERE user_id=? AND type=? AND created_at>=?', userId, type, since);
module.exports = { balance, apply, history, historyCount, sumSince };
