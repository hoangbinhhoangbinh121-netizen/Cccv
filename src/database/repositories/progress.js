'use strict';
const { getDb } = require('../connection');
const { now } = require('../../utils/time');
const db = () => getDb();
/* missions */
const missions = (userId, kind, periodKey) => db().all('SELECT * FROM missions WHERE user_id=? AND kind=? AND period_key=? ORDER BY id', userId, kind, periodKey).map((m) => ({ ...m, meta: JSON.parse(m.meta) }));
const missionInsert = (userId, kind, key, period, target, meta = {}) => db().run('INSERT OR IGNORE INTO missions(user_id,kind,mission_key,period_key,target,meta) VALUES(?,?,?,?,?,?)', userId, kind, key, period, target, JSON.stringify(meta));
const missionGet = (userId, id) => { const m = db().get('SELECT * FROM missions WHERE id=? AND user_id=?', id, userId); return m && { ...m, meta: JSON.parse(m.meta) }; };
const missionActive = (userId) => db().all("SELECT * FROM missions WHERE user_id=? AND claimed=0 AND progress<target", userId).map((m) => ({ ...m, meta: JSON.parse(m.meta) }));
const missionSet = (id, progress) => db().run('UPDATE missions SET progress=? WHERE id=?', progress, id);
const missionClaim = (id) => db().run('UPDATE missions SET claimed=1 WHERE id=? AND claimed=0 AND progress>=target', id).changes > 0;
const missionPurge = (before) => db().run("DELETE FROM missions WHERE kind IN ('daily','weekly') AND period_key<? AND claimed=1", before).changes;
/* achievements */
const achievements = (userId) => new Map(db().all('SELECT * FROM achievements WHERE user_id=?', userId).map((a) => [a.achievement_id, a]));
const achUnlock = (userId, id) => db().run('INSERT OR IGNORE INTO achievements(user_id,achievement_id,unlocked_at) VALUES(?,?,?)', userId, id, now()).changes > 0;
const achClaim = (userId, id) => db().run('UPDATE achievements SET claimed_at=? WHERE user_id=? AND achievement_id=? AND claimed_at IS NULL', now(), userId, id).changes > 0;
const achCount = (userId) => db().value('SELECT COUNT(*) FROM achievements WHERE user_id=?', userId);
/* titles */
const titles = (userId) => db().all('SELECT title_id FROM user_titles WHERE user_id=?', userId).map((r) => r.title_id);
const addTitle = (userId, id) => db().run('INSERT OR IGNORE INTO user_titles(user_id,title_id,unlocked_at) VALUES(?,?,?)', userId, id, now()).changes > 0;
/* leaderboards */
const BOARDS = {
  weight: { name: 'Tổng cân nặng cá', sql: 'SELECT user_id, total_weight AS v FROM user_stats WHERE total_weight>0', unit: 'kg' },
  count: { name: 'Số lượng cá bắt được', sql: 'SELECT user_id, total_catch AS v FROM user_stats WHERE total_catch>0', unit: 'con' },
  collection: { name: 'Giá trị bộ sưu tập', sql: "SELECT user_id, SUM(base_value) AS v FROM fish_instances WHERE listed=0 GROUP BY user_id", unit: 'xu' },
  rare: { name: 'Cá quý hiếm', sql: 'SELECT user_id, rare_catch AS v FROM user_stats WHERE rare_catch>0', unit: 'con' },
  level: { name: 'Cấp độ người chơi', sql: 'SELECT id AS user_id, level*1000000+exp AS v FROM users WHERE banned=0', unit: 'cấp', show: (v) => Math.floor(v / 1000000) },
  wealth: { name: 'Tài sản', sql: "SELECT user_id, balance AS v FROM currencies WHERE code='xu' AND balance>0", unit: 'xu' },
  achievements: { name: 'Thành tựu', sql: 'SELECT user_id, COUNT(*) AS v FROM achievements GROUP BY user_id', unit: 'thành tựu' },
  boss: { name: 'Boss đóng góp', sql: 'SELECT user_id, boss_damage AS v FROM user_stats WHERE boss_damage>0', unit: 'sát thương' },
};
function refreshBoard(board) {
  const def = BOARDS[board]; const t = now();
  db().tx(() => { db().run('DELETE FROM leaderboards WHERE board=?', board); for (const r of db().all(def.sql)) { if (db().value('SELECT banned FROM users WHERE id=?', r.user_id)) continue; db().run('INSERT INTO leaderboards(board,user_id,value,updated_at) VALUES(?,?,?,?)', board, r.user_id, r.v, t); } });
}
const refreshAll = () => Object.keys(BOARDS).forEach(refreshBoard);
const boardTop = (board, n = 15) => db().all('SELECT l.user_id, l.value, u.name FROM leaderboards l JOIN users u ON u.id=l.user_id WHERE l.board=? ORDER BY l.value DESC, l.user_id LIMIT ?', board, n);
const boardRank = (board, userId) => { const r = db().get('SELECT value FROM leaderboards WHERE board=? AND user_id=?', board, userId); if (!r) return null; return { value: r.value, rank: db().value('SELECT COUNT(*)+1 FROM leaderboards WHERE board=? AND value>?', board, r.value) }; };
const boardAge = (board) => db().value('SELECT MAX(updated_at) FROM leaderboards WHERE board=?', board) || 0;
module.exports = { missions, missionInsert, missionGet, missionActive, missionSet, missionClaim, missionPurge, achievements, achUnlock, achClaim, achCount, titles, addTitle, BOARDS, refreshBoard, refreshAll, boardTop, boardRank, boardAge };
