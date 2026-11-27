'use strict';
/** Dữ liệu Ngư Trường Giải Trí. Mọi thao tác ghi điểm đều đi qua award() (sổ cái có khoá duy nhất → không trả thưởng hai lần). */
const { getDb } = require('../connection');
const { now, dayKey, weekKey } = require('../../utils/time');

const seasonKey = (ms = now()) => dayKey(ms).slice(0, 7);
const periods = (ms = now()) => ({ d: dayKey(ms), w: weekKey(ms), s: seasonKey(ms) });
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

/* ---- dữ liệu người chơi (thống kê dạng JSON) ---- */
function data(uid) { const r = getDb().get('SELECT data FROM arcade_player WHERE user_id=?', uid); return r ? parse(r.data, {}) : {}; }
/** Đọc → sửa → ghi trong một giao dịch. fn nhận object dữ liệu, có thể sửa tại chỗ hoặc trả object mới. */
function mutate(uid, fn) {
  const db = getDb();
  return db.tx(() => {
    const r = db.get('SELECT data FROM arcade_player WHERE user_id=?', uid); const cur = r ? parse(r.data, {}) : {};
    const out = fn(cur) || cur;
    db.run('INSERT INTO arcade_player(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at', uid, JSON.stringify(out), now());
    return out;
  });
}

/* ---- điểm ---- */
const pts = (uid, kind, pkey = '') => getDb().value('SELECT pts FROM arcade_points WHERE user_id=? AND kind=? AND pkey=?', uid, kind, pkey) || 0;
const lifetime = (uid) => pts(uid, 'all', '');
function addPts(uid, n, t = now()) {
  if (n <= 0) return; const db = getDb(); const p = periods(t);
  for (const [kind, pkey] of [['all', ''], ['d', p.d], ['w', p.w], ['s', p.s]])
    db.run('INSERT INTO arcade_points(user_id,kind,pkey,pts) VALUES(?,?,?,?) ON CONFLICT(user_id,kind,pkey) DO UPDATE SET pts=pts+excluded.pts', uid, kind, pkey, n);
}
/**
 * Cộng điểm một lần duy nhất cho (user, game, ref). capped=true → bị chặn bởi trần điểm trong ngày.
 * Trả { duplicate, requested, applied, capped } — duplicate=true nghĩa là đã trả rồi, không cộng lại.
 */
function award(uid, game, ref, requested, { capped = true, cap = 0, note = null, t = now() } = {}) {
  const db = getDb(); requested = Math.max(0, Math.floor(requested));
  return db.tx(() => {
    const old = db.get('SELECT requested, applied FROM arcade_ledger WHERE user_id=? AND game=? AND ref=?', uid, game, ref);
    if (old) return { duplicate: true, requested: old.requested, applied: old.applied, capped: old.applied < old.requested };
    let applied = requested;
    if (capped && cap > 0) applied = Math.max(0, Math.min(requested, cap - pts(uid, 'd', dayKey(t))));
    db.run('INSERT INTO arcade_ledger(user_id,game,ref,requested,applied,note,created_at) VALUES(?,?,?,?,?,?,?)', uid, game, ref, requested, applied, note, t);
    addPts(uid, applied, t);
    return { duplicate: false, requested, applied, capped: applied < requested };
  });
}
const ledgerHas = (uid, game, ref) => !!getDb().get('SELECT 1 AS x FROM arcade_ledger WHERE user_id=? AND game=? AND ref=?', uid, game, ref);
const ledgerRecent = (uid, n = 10) => getDb().all('SELECT * FROM arcade_ledger WHERE user_id=? ORDER BY id DESC LIMIT ?', uid, n);

/* ---- bảng xếp hạng ---- */
const top = (kind, pkey, limit = 10) => getDb().all(
  'SELECT p.user_id, p.pts, u.name FROM arcade_points p JOIN users u ON u.id=p.user_id WHERE p.kind=? AND p.pkey=? AND p.pts>0 AND u.banned=0 ORDER BY p.pts DESC, p.user_id LIMIT ?', kind, pkey, limit);
function rankOf(uid, kind, pkey) {
  const mine = pts(uid, kind, pkey); if (mine <= 0) return null;
  return 1 + getDb().value('SELECT COUNT(*) FROM arcade_points p JOIN users u ON u.id=p.user_id WHERE p.kind=? AND p.pkey=? AND u.banned=0 AND (p.pts>? OR (p.pts=? AND p.user_id<?))', kind, pkey, mine, mine, uid);
}
const seasons = (limit = 6) => getDb().all("SELECT DISTINCT pkey FROM arcade_points WHERE kind='s' ORDER BY pkey DESC LIMIT ?", limit).map((r) => r.pkey);

/* ---- phiên chơi (đua, đố) ---- */
const hydrate = (r) => (r ? { ...r, data: parse(r.data, {}) } : null);
const sessionGet = (id) => hydrate(getDb().get('SELECT * FROM arcade_sessions WHERE id=?', id));
const sessionActive = (uid, game) => hydrate(getDb().get("SELECT * FROM arcade_sessions WHERE user_id=? AND game=? AND status='active'", uid, game));
function sessionCreate(uid, game, phase, nonce, d, expiresAt, t = now()) {
  const r = getDb().run('INSERT INTO arcade_sessions(user_id,game,status,phase,nonce,data,started_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)', uid, game, 'active', phase, nonce, JSON.stringify(d), t, t, expiresAt);
  return r.lastInsertRowid;
}
function sessionSave(id, { phase, nonce, data: d, expiresAt, status }, t = now()) {
  const cur = getDb().get('SELECT * FROM arcade_sessions WHERE id=?', id); if (!cur) return;
  getDb().run('UPDATE arcade_sessions SET phase=?, nonce=?, data=?, expires_at=?, status=?, updated_at=? WHERE id=?', phase ?? cur.phase, nonce ?? cur.nonce, d === undefined ? cur.data : JSON.stringify(d), expiresAt ?? cur.expires_at, status ?? cur.status, t, id);
}
/** Chỉ đổi trạng thái khi vẫn đang 'active' → đảm bảo chốt thưởng đúng một lần. */
const sessionClose = (id, status, t = now()) => getDb().run("UPDATE arcade_sessions SET status=?, updated_at=? WHERE id=? AND status='active'", status, t, id).changes > 0;
const sessionsOpen = (t = now()) => getDb().all("SELECT id, user_id, game FROM arcade_sessions WHERE status='active' AND expires_at<=?", t);
const sessionPurge = (before) => getDb().run("DELETE FROM arcade_sessions WHERE status<>'active' AND updated_at<?", before).changes;

/* ---- lịch sử ---- */
const histAdd = (uid, game, ref, detail, points = 0, t = now()) => getDb().run('INSERT INTO arcade_history(user_id,game,ref,detail,points,created_at) VALUES(?,?,?,?,?,?)', uid, game, ref, JSON.stringify(detail), points, t).lastInsertRowid;
const histRecent = (uid, game, n = 10) => getDb().all('SELECT * FROM arcade_history WHERE user_id=? AND game=? ORDER BY id DESC LIMIT ?', uid, game, n).map((r) => ({ ...r, detail: parse(r.detail, {}) }));
const histGet = (uid, id) => { const r = getDb().get('SELECT * FROM arcade_history WHERE user_id=? AND id=?', uid, id); return r ? { ...r, detail: parse(r.detail, {}) } : null; };
const histSet = (id, detail, points) => getDb().run('UPDATE arcade_history SET detail=?, points=? WHERE id=?', JSON.stringify(detail), points, id);
const histPurge = (before) => getDb().run('DELETE FROM arcade_history WHERE created_at<?', before).changes;

/* ---- Linh Bảo ---- */
function itemAdd(uid, itemId, t = now()) {
  const db = getDb(); const had = db.get('SELECT qty FROM arcade_items WHERE user_id=? AND item_id=?', uid, itemId);
  if (had) { db.run('UPDATE arcade_items SET qty=qty+1 WHERE user_id=? AND item_id=?', uid, itemId); return { isNew: false, qty: had.qty + 1 }; }
  db.run('INSERT INTO arcade_items(user_id,item_id,qty,first_at) VALUES(?,?,1,?)', uid, itemId, t); return { isNew: true, qty: 1 };
}
const items = (uid) => getDb().all('SELECT item_id, qty, first_at FROM arcade_items WHERE user_id=? ORDER BY first_at', uid);
const itemCount = (uid) => getDb().value('SELECT COUNT(*) FROM arcade_items WHERE user_id=?', uid) || 0;

/* ---- bộ đếm theo ngày / tuỳ ý ---- */
const count = (uid, k) => getDb().value('SELECT n FROM arcade_counter WHERE user_id=? AND k=?', uid, k) || 0;
const bump = (uid, k, n = 1) => { getDb().run('INSERT INTO arcade_counter(user_id,k,n) VALUES(?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET n=n+excluded.n', uid, k, n); return count(uid, k); };
const setCount = (uid, k, n) => getDb().run('INSERT INTO arcade_counter(user_id,k,n) VALUES(?,?,?) ON CONFLICT(user_id,k) DO UPDATE SET n=excluded.n', uid, k, n);
const counterPurge = (olderThanDay) => getDb().run("DELETE FROM arcade_counter WHERE k LIKE 'd:%' AND substr(k,3,10)<?", olderThanDay).changes;

/* ---- thành tích ---- */
const achUnlock = (uid, id, t = now()) => getDb().run('INSERT OR IGNORE INTO arcade_ach(user_id,ach_id,unlocked_at) VALUES(?,?,?)', uid, id, t).changes > 0;
const achList = (uid) => getDb().all('SELECT ach_id, unlocked_at FROM arcade_ach WHERE user_id=?', uid);

module.exports = {
  seasonKey, periods, data, mutate, pts, lifetime, award, ledgerHas, ledgerRecent, top, rankOf, seasons,
  sessionGet, sessionActive, sessionCreate, sessionSave, sessionClose, sessionsOpen, sessionPurge,
  histAdd, histRecent, histGet, histSet, histPurge, itemAdd, items, itemCount, count, bump, setCount, counterPurge, achUnlock, achList,
};
