'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
const get = (id) => db().get('SELECT * FROM market_listings WHERE id=?', id);
const create = (l) => db().run('INSERT INTO market_listings(seller_id,kind,ref_id,item_id,qty,price,fee_pct,created_at,expires_at,summary) VALUES(?,?,?,?,?,?,?,?,?,?)', l.seller_id, l.kind, l.ref_id ?? null, l.item_id ?? null, l.qty || 1, l.price, l.fee_pct, now(), l.expires_at, l.summary || '').lastInsertRowid;
/** Chiếm giữ nguyên tử: chỉ một người mua/huỷ thành công cho mỗi tin đăng. */
const claim = (id, status, buyerId = null) => db().run("UPDATE market_listings SET status=?, buyer_id=?, closed_at=? WHERE id=? AND status='active'", status, buyerId, now(), id).changes > 0;
function search({ kind = null, q = null, sort = 'moi', limit = 8, offset = 0, seller = null, minPrice = null, maxPrice = null }) {
  const w = ["status='active'", 'expires_at>?']; const a = [now()];
  if (kind) { w.push('kind=?'); a.push(kind); } if (q) { w.push('summary LIKE ?'); a.push(`%${q}%`); } if (seller) { w.push('seller_id=?'); a.push(seller); }
  if (minPrice) { w.push('price>=?'); a.push(minPrice); } if (maxPrice) { w.push('price<=?'); a.push(maxPrice); }
  const order = { moi: 'id DESC', re: 'price ASC', dat: 'price DESC' }[sort] || 'id DESC'; const where = w.join(' AND ');
  return { rows: db().all(`SELECT * FROM market_listings WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, ...a, limit, offset), total: db().value(`SELECT COUNT(*) FROM market_listings WHERE ${where}`, ...a) };
}
const activeCount = (sellerId) => db().value("SELECT COUNT(*) FROM market_listings WHERE seller_id=? AND status='active'", sellerId);
const expired = () => db().all("SELECT * FROM market_listings WHERE status='active' AND expires_at<=?", now());
const historyOf = (userId, n = 15) => db().all("SELECT * FROM market_listings WHERE (seller_id=? OR buyer_id=?) AND status<>'active' ORDER BY id DESC LIMIT ?", userId, userId, n);
module.exports = { get, create, claim, search, activeCount, expired, historyOf };
