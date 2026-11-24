'use strict';
const { D } = require('./gameData');
const prog = require('../database/repositories/progress');
const users = require('../database/repositories/users');
const fishRepo = require('../database/repositories/fish');
const rodRepo = require('../database/repositories/rods');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { dayKey, weekKey, now } = require('../utils/time');
const { mulberry32, hashStr, shuffle } = require('../utils/rng');
const settings = require('../database/repositories/settings');

const DAILY_COUNT = 4; const WEEKLY_COUNT = 3;
const defOf = (kind, key) => D.missions[kind].find((m) => m.id === key);
const chainDef = (id) => D.missions.chains.find((c) => c.id === id);
function targetFor(def, level) { return def.fixed ? def.base : Math.max(1, Math.round(def.base * (1 + level / 25))); }

/** Tạo nhiệm vụ ngày/tuần (chọn ngẫu nhiên xác định theo người chơi + kỳ) và bảo đảm có chuỗi nhiệm vụ đang hoạt động. */
function ensureMissions(userId) {
  const u = users.get(userId); if (!u) return;
  getDb().tx(() => {
    for (const [kind, key, count] of [['daily', dayKey(), DAILY_COUNT], ['weekly', weekKey(), WEEKLY_COUNT]]) {
      if (prog.missions(userId, kind, key).length) continue;
      const pool = D.missions[kind].filter((m) => !m.minLevel || u.level >= m.minLevel);
      const rnd = mulberry32(hashStr(`${userId}:${kind}:${key}`));
      for (const m of shuffle(pool, rnd).slice(0, count)) prog.missionInsert(userId, kind, m.id, key, targetFor(m, u.level));
    }
    const chains = D.missions.chains; const rows = getDb().all("SELECT mission_key, claimed, meta FROM missions WHERE user_id=? AND kind='chain'", userId);
    const open = rows.some((r) => !JSON.parse(r.meta).done);
    if (!open) { const next = chains.find((c) => !rows.some((r) => r.mission_key === c.id)); if (next) prog.missionInsert(userId, 'chain', next.id, 'chain', next.steps[0].target, { step: 0 }); }
  });
}
const matches = (def, type, p) => {
  if (def.on !== type) return false; const f = def.filter || {};
  if (f.minRarity && (p.rarity || 0) < f.minRarity) return false; if (f.category && p.category !== f.category) return false; if (f.location && p.location !== f.location) return false;
  return true;
};
/** Ghi nhận hành động của người chơi vào nhiệm vụ đang mở. Gọi trong giao dịch của hành động gốc. */
function track(userId, type, p = {}) {
  for (const m of prog.missionActive(userId)) {
    let def = null;
    if (m.kind === 'chain') { const c = chainDef(m.mission_key); def = c && c.steps[m.meta.step]; } else if (m.period_key === (m.kind === 'daily' ? dayKey() : weekKey())) def = defOf(m.kind, m.mission_key);
    if (!def || !matches(def, type, p)) continue;
    const amt = def.amount === 'weight' ? p.weight || 0 : def.amount === 'value' ? p.value || 0 : p.count || 1;
    prog.missionSet(m.id, Math.min(m.target, m.progress + amt));
  }
}
function describe(m) {
  let def; if (m.kind === 'chain') { const c = chainDef(m.mission_key); def = c.steps[m.meta.step]; return { id: m.id, kind: 'chain', title: `${c.name} (${m.meta.step + 1}/${c.steps.length})`, text: def.name, reward: def.reward, progress: m.progress, target: m.target, claimed: !!m.claimed, done: !!m.meta.done }; }
  def = defOf(m.kind, m.mission_key); return { id: m.id, kind: m.kind, text: def.name.replace('{target}', Math.round(m.target)), reward: def.reward, progress: m.progress, target: m.target, claimed: !!m.claimed };
}
function list(userId) {
  ensureMissions(userId);
  return { daily: prog.missions(userId, 'daily', dayKey()).map(describe), weekly: prog.missions(userId, 'weekly', weekKey()).map(describe), chains: getDb().all("SELECT * FROM missions WHERE user_id=? AND kind='chain' ORDER BY id", userId).map((m) => ({ ...m, meta: JSON.parse(m.meta) })).filter((m) => !m.meta.done).map(describe) };
}
function giveReward(userId, rw, type, note) {
  if (rw.xu) economy.credit(userId, Math.round(rw.xu * settings.get('xu_rate')), type, { note });
  if (rw.exp) require('./userService').addExp(userId, Math.round(rw.exp * settings.get('exp_rate')));
  if (rw.items) invSvc.grant(userId, rw.items, { force: true });
}
function claimMission(userId, missionId) {
  return getDb().tx(() => {
    const m = prog.missionGet(userId, missionId); if (!m) throw new GameError('Không tìm thấy nhiệm vụ.');
    if (m.claimed) throw new GameError('Bạn đã nhận thưởng nhiệm vụ này rồi.'); if (m.progress < m.target) throw new GameError('Nhiệm vụ chưa hoàn thành.');
    if (!prog.missionClaim(m.id)) throw new GameError('Không thể nhận thưởng (đã nhận?).');
    let rw; let next = null;
    if (m.kind === 'chain') {
      const c = chainDef(m.mission_key); rw = c.steps[m.meta.step].reward; const ns = m.meta.step + 1;
      if (ns < c.steps.length) { getDb().run('UPDATE missions SET claimed=0, progress=0, target=?, meta=? WHERE id=?', c.steps[ns].target, JSON.stringify({ step: ns }), m.id); next = c.steps[ns].name; }
      else { getDb().run('UPDATE missions SET meta=? WHERE id=?', JSON.stringify({ step: m.meta.step, done: true }), m.id); ensureMissions(userId); next = 'Hoàn thành chuỗi!'; }
    } else rw = defOf(m.kind, m.mission_key).reward;
    giveReward(userId, rw, 'mission', `Nhiệm vụ ${m.mission_key}`);
    const newAch = checkAchievements(userId);
    return { reward: rw, next, newAch };
  });
}
/* ---------------- Thành tựu ---------------- */
function metric(userId, name, st) {
  switch (name) {
    case 'total_catch': return st.total_catch; case 'total_weight': return st.total_weight; case 'rare_catch': return st.rare_catch; case 'legend_catch': return st.legend_catch;
    case 'codex_count': return fishRepo.codexCount(userId); case 'deep_catch': return st.deep_catch; case 'boss_kills': return st.boss_kills; case 'ancient_catch': return st.ancient_catch;
    case 'unique_catch': return st.unique_catch; case 'coins_earned': return st.coins_earned;
    case 'rod_tier': return Math.max(0, ...rodRepo.list(userId).map((r) => D.rods.get(r.rod_id).tier));
    default: return 0;
  }
}
/** Mở khoá thành tựu đạt điều kiện; trả về danh sách mới mở. */
function checkAchievements(userId) {
  const st = users.stats(userId); const have = prog.achievements(userId); const fresh = [];
  for (const a of D.achievements) { if (have.has(a.id)) continue; if (metric(userId, a.metric, st) >= a.target && prog.achUnlock(userId, a.id)) fresh.push(a); }
  return fresh;
}
function achievementList(userId) {
  const st = users.stats(userId); const have = prog.achievements(userId);
  return D.achievements.map((a) => ({ ...a, value: Math.min(a.target, metric(userId, a.metric, st)), unlocked: have.has(a.id), claimed: !!have.get(a.id)?.claimed_at }));
}
function claimAchievement(userId, id) {
  return getDb().tx(() => {
    const a = D.achMap.get(id); if (!a) throw new GameError('Thành tựu không tồn tại.');
    const have = prog.achievements(userId).get(id); if (!have) throw new GameError('Bạn chưa đạt thành tựu này.'); if (have.claimed_at) throw new GameError('Bạn đã nhận thưởng thành tựu này.');
    if (!prog.achClaim(userId, id)) throw new GameError('Không thể nhận thưởng.');
    giveReward(userId, a.reward, 'achievement', a.name); let title = null; if (a.reward.title && prog.addTitle(userId, a.reward.title)) title = D.titles[a.reward.title];
    return { achievement: a, title };
  });
}
function claimAllAchievements(userId) {
  const out = []; for (const a of achievementList(userId)) if (a.unlocked && !a.claimed) out.push(claimAchievement(userId, a.id)); return out;
}
/* ---------------- Bảng xếp hạng ---------------- */
function leaderboard(board, userId, n = 15) {
  if (!prog.BOARDS[board]) throw new GameError('Bảng xếp hạng không tồn tại.');
  if (now() - prog.boardAge(board) > 60000) prog.refreshBoard(board);
  const def = prog.BOARDS[board];
  const fmt = (v) => (def.show ? def.show(v) : v);
  return { board, name: def.name, unit: def.unit, rows: prog.boardTop(board, n).map((r, i) => ({ rank: i + 1, user_id: r.user_id, name: r.name, value: fmt(r.value) })), me: userId ? (() => { const r = prog.boardRank(board, userId); return r && { rank: r.rank, value: fmt(r.value) }; })() : null };
}
module.exports = { ensureMissions, track, list, claimMission, checkAchievements, achievementList, claimAchievement, claimAllAchievements, leaderboard, giveReward, targetFor };
