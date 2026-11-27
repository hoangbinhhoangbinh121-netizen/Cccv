'use strict';
/**
 * Ngư Trường Giải Trí – dịch vụ lõi. Quy tắc:
 *  - Điểm giải trí (Linh Điểm) tách biệt hoàn toàn khỏi ví xu: không có hàm nào ở đây chạm vào ví/kho/cá/thú cưng.
 *  - Mọi lần cộng điểm đi qua repo.award(): sổ cái có khoá duy nhất (user, game, ref) → bấm trùng / chạy lại / khởi động lại không trả thưởng hai lần.
 *  - Kết quả ngẫu nhiên do máy chủ sinh; trạng thái phiên nằm trong DB và tính theo giờ máy chủ → mất kết nối/khởi động lại vẫn chốt đúng.
 *  - Mỗi hàm ghi là đồng bộ và nằm trong một giao dịch (db.tx); router đã khoá theo người chơi nên không có hai thao tác chen nhau.
 */
const repo = require('../database/repositories/arcade');
const settings = require('../database/repositories/settings');
const { getDb } = require('../database/connection');
const { D, ensureLoaded } = require('./gameData');
const { GameError } = require('../utils/errors');
const rng = require('../utils/rng');
const logger = require('../utils/logger');
const { now, dayKey } = require('../utils/time');
const race = require('../systems/arcade/race');
const dice = require('../systems/arcade/dice');
const box = require('../systems/arcade/box');
const quiz = require('../systems/arcade/quiz');

const A = () => { ensureLoaded(); return D.arcade; };
const GAMES = ['race', 'dice', 'box', 'quiz'];
const GAME_NAME = { race: 'Đoán Ngư Vương', dice: 'Tài Xỉu Linh Vận', box: 'Linh Bảo Bí Hộp', quiz: 'Truy Tìm Linh Ngư' };
const tx = (fn) => getDb().tx(fn);

/* ------------------------------------------------------------------ tiện ích chung */
const dk = (uid, ev, t = now()) => `d:${dayKey(t)}:${ev}`;
const dayCount = (uid, ev, t = now()) => repo.count(uid, dk(uid, ev, t));
const dayBump = (uid, ev, n = 1, t = now()) => repo.bump(uid, dk(uid, ev, t), n);
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const DEFAULTS = () => ({
  race: { plays: 0, wins: 0, podium: 0, streak: 0, best_streak: 0, underdog_wins: 0, fish: {} },
  dice: { plays: 0, wins: 0, streak: 0, best_streak: 0, bao_hits: 0, tai: 0, xiu: 0, bao: 0 },
  box: { opens: 0, dupes: 0, byGrade: {}, pity: {} },
  quiz: { rounds: 0, answered: 0, correct: 0, streak: 0, best_streak: 0, perfect: 0, best_score: 0 },
  missions: { claimed: 0 }, titles: [],
});
function withDefaults(d) { const o = DEFAULTS(); for (const k of Object.keys(o)) { if (d[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) o[k] = { ...o[k], ...d[k] }; else if (d[k] !== undefined) o[k] = d[k]; } return o; }
const stats = (uid) => withDefaults(repo.data(uid));
const mutate = (uid, fn) => repo.mutate(uid, (raw) => { const d = withDefaults(raw); fn(d); return d; });

function rankInfo(life) {
  const ranks = A().ranks; let cur = ranks[0]; for (const r of ranks) if (life >= r.need) cur = r;
  const next = ranks.find((r) => r.id === cur.id + 1) || null;
  return { id: cur.id, name: cur.name, next, life, need: next ? next.need : null, into: life - cur.need, span: next ? next.need - cur.need : 0 };
}
const rankOfUser = (uid) => rankInfo(repo.lifetime(uid));
function cooldownCheck(uid, game) { const left = settings.cooldownLeft(uid, `arc:${game}`); if (left > 0) throw new GameError(`⏳ Thao tác quá nhanh — chờ **${Math.ceil(left / 1000)} giây** nữa rồi thử lại.`, 'COOLDOWN'); }
const cooldownSet = (uid, game) => { const ms = A().cooldownMs[game]; if (ms) settings.setCooldown(uid, `arc:${game}`, ms); };
const limitLeft = (uid, game) => Math.max(0, A().limits[game] - dayCount(uid, `n:${game}`));
const boxLeft = (uid, t) => Math.max(0, t.daily - dayCount(uid, `n:box${t.id}`));
const need = (c, m, code) => { if (!c) throw new GameError(m, code); };

/** Cộng điểm (có trần ngày) + ghi nhận cho nhiệm vụ "kiếm điểm". */
function grant(uid, game, ref, pts, { capped = true, note = null } = {}) {
  const r = repo.award(uid, game, ref, pts, { capped, cap: A().dailyCap, note });
  if (!r.duplicate && capped && r.applied > 0) dayBump(uid, 'pts', r.applied);
  return r;
}

/* ------------------------------------------------------------------ thành tích */
function statValue(uid, st, path) {
  switch (path) {
    case 'points.all': return repo.lifetime(uid);
    case 'points.rank': return rankOfUser(uid).id;
    case 'box.collected': return repo.itemCount(uid);
    case 'box.epic_plus': return Object.entries(st.box.byGrade).reduce((a, [g, n]) => a + (+g >= 4 ? n : 0), 0);
    case 'box.legend_plus': return Object.entries(st.box.byGrade).reduce((a, [g, n]) => a + (+g >= 5 ? n : 0), 0);
    default: return +getPath(st, path) || 0;
  }
}
/** Kiểm tra & mở thành tích đạt điều kiện; trả danh sách vừa mở (đã cộng thưởng điểm, không bị trần ngày). */
function checkAch(uid) {
  const out = [];
  for (let pass = 0; pass < 3; pass++) {
    const st = stats(uid); const have = new Set(repo.achList(uid).map((x) => x.ach_id)); let found = false;
    for (const a of A().achievements) {
      if (have.has(a.id) || statValue(uid, st, a.stat) < a.target) continue;
      if (!repo.achUnlock(uid, a.id)) continue;
      found = true; grant(uid, 'ach', `ach:${a.id}`, a.reward, { capped: false, note: a.name }); out.push(a);
      if (a.title) mutate(uid, (d) => { if (!d.titles.includes(a.title)) d.titles.push(a.title); });
    }
    if (!found) break;
  }
  return out;
}
const notesOf = (before, uid, ach) => {
  const after = rankOfUser(uid); const n = [];
  if (after.id > before) n.push(`🎖️ Lên cấp bậc **${after.name}**!`);
  for (const a of ach) n.push(`🏆 Thành tích **${a.name}** (+${a.reward} LĐ${a.title ? ` · danh hiệu «${a.title}»` : ''})`);
  return n;
};

/* ------------------------------------------------------------------ tổng quan */
function summary(uid) {
  const t = now(); const p = repo.periods(t); const life = repo.lifetime(uid);
  return {
    life, rank: rankInfo(life), cap: A().dailyCap, today: repo.pts(uid, 'd', p.d), week: repo.pts(uid, 'w', p.w), season: repo.pts(uid, 's', p.s), seasonKey: p.s,
    left: { race: limitLeft(uid, 'race'), dice: limitLeft(uid, 'dice'), quiz: limitLeft(uid, 'quiz'), box: A().box.tiers.map((x) => boxLeft(uid, x)) },
    active: { race: repo.sessionActive(uid, 'race'), quiz: repo.sessionActive(uid, 'quiz') },
    claimable: missionsOf(uid).filter((m) => m.done && !m.claimed).length,
  };
}

/* ------------------------------------------------------------------ ĐOÁN NGƯ VƯƠNG */
function ownSession(uid, sid, game) {
  const s = repo.sessionGet(+sid); need(s && s.user_id === uid && s.game === game, 'Phiên chơi không tồn tại hoặc không phải của bạn.', 'OWNER'); return s;
}
const raceOpen = (uid) => tx(() => raceOpen0(uid));
function raceOpen0(uid) {
  const cur = repo.sessionActive(uid, 'race'); if (cur) return raceAdvance(cur.id);
  need(limitLeft(uid, 'race') > 0, `Hôm nay bạn đã xem đủ **${A().limits.race}** cuộc đua. Mai quay lại nhé!`, 'LIMIT'); cooldownCheck(uid, 'race');
  const field = race.genField(); const od = race.odds(field, 400, 1 + Math.floor(rng.rand() * 1e9));
  const id = repo.sessionCreate(uid, 'race', 'pick', rng.token(6), { field, odds: od, pick: null }, now() + A().race.pickWindowMs);
  return repo.sessionGet(id);
}
function racePick(uid, sid, idx) {
  return tx(() => {
    const s = raceAdvance(ownSession(uid, sid, 'race').id); if (s.status !== 'active' || s.phase !== 'pick') return s;
    need(Number.isInteger(idx) && idx >= 0 && idx < s.data.field.length, 'Lựa chọn không hợp lệ.');
    repo.sessionSave(s.id, { data: { ...s.data, pick: idx } }); return repo.sessionGet(s.id);
  });
}
function raceStart(uid, sid) {
  return tx(() => {
    const s = raceAdvance(ownSession(uid, sid, 'race').id); if (s.status !== 'active' || s.phase !== 'pick') return s;
    need(s.data.pick !== null && s.data.pick !== undefined, 'Hãy chọn một chú cá trước khi xuất phát.');
    need(limitLeft(uid, 'race') > 0, `Hôm nay bạn đã xem đủ **${A().limits.race}** cuộc đua.`, 'LIMIT');
    const t = now(); const sim = race.simulate(s.data.field); dayBump(uid, 'n:race', 1, t);
    repo.sessionSave(s.id, { phase: 'run', nonce: rng.token(6), data: { ...s.data, startAt: t, result: { cum: sim.cum, order: sim.order, final: sim.final } }, expiresAt: t + race.totalMs() + A().race.settleGraceMs }, t);
    return repo.sessionGet(s.id);
  });
}
function raceCancel(uid, sid) {
  return tx(() => { const s = ownSession(uid, sid, 'race'); if (s.status === 'active' && s.phase === 'pick') repo.sessionClose(s.id, 'cancelled'); return repo.sessionGet(s.id); });
}
const raceDueAt = (s) => (s.data.startAt || 0) + race.totalMs() + A().race.settleGraceMs;
function raceAdvance(sid) {
  return tx(() => {
    const s = repo.sessionGet(+sid); need(s, 'Phiên đua không còn tồn tại.', 'STALE'); if (s.status !== 'active') return s;
    const t = now();
    if (s.phase === 'pick') { if (t >= s.expires_at) repo.sessionClose(s.id, 'expired'); return repo.sessionGet(s.id); }
    if (s.phase === 'run' && t >= raceDueAt(s)) return settleRace(s);
    return s;
  });
}
function settleRace(s) {
  const uid = s.user_id; const d = s.data; const t = now();
  if (!repo.sessionClose(s.id, 'done', t)) return repo.sessionGet(s.id);
  const before = rankOfUser(uid).id; const st = stats(uid); const sc = race.score({ pickIdx: d.pick, order: d.result.order, odds: d.odds, streak: st.race.streak });
  const r = grant(uid, 'race', `race:${s.id}`, sc.points); const pickedFish = d.field[d.pick].id;
  mutate(uid, (x) => {
    const g = x.race; g.plays++; g.fish[pickedFish] = (g.fish[pickedFish] || 0) + 1;
    if (sc.won) { g.wins++; g.streak++; g.best_streak = Math.max(g.best_streak, g.streak); if (sc.underdog) g.underdog_wins++; } else g.streak = 0;
    if (sc.rank <= 3) g.podium++;
  });
  dayBump(uid, 'play:race', 1, t); if (sc.won) dayBump(uid, 'win:race', 1, t);
  repo.histAdd(uid, 'race', `race:${s.id}`, { field: d.field.map((x) => x.id), pick: d.pick, order: d.result.order, rank: sc.rank, won: sc.won, kind: sc.kind, underdog: sc.underdog, odds: d.odds[d.pick] }, r.applied, t);
  cooldownSet(uid, 'race');
  const notes = notesOf(before, uid, checkAch(uid));
  repo.sessionSave(s.id, { phase: 'done', data: { ...d, reward: { ...sc, applied: r.applied, requested: r.requested, capped: r.capped, notes } } }, t);
  return repo.sessionGet(s.id);
}

/* ------------------------------------------------------------------ TÀI XỈU LINH VẬN */
function diceRoll(uid, pick) {
  need(dice.PICKS.includes(pick), 'Lựa chọn không hợp lệ (xiu / tai / bao).');
  return tx(() => {
    const t = now(); need(limitLeft(uid, 'dice') > 0, `Hôm nay bạn đã tung đủ **${A().limits.dice}** lần. Mai quay lại nhé!`, 'LIMIT'); cooldownCheck(uid, 'dice');
    const before = rankOfUser(uid).id; const st = stats(uid); const d3 = dice.roll(); const res = dice.judge(pick, d3);
    const streak = st.dice.streak; const pts = dice.score(pick, res, streak); const ref = `dice:${t}:${rng.token(6)}`;
    const r = grant(uid, 'dice', ref, pts); dayBump(uid, 'n:dice', 1, t); cooldownSet(uid, 'dice');
    mutate(uid, (x) => {
      const g = x.dice; g.plays++; g[pick]++; if (res.win) { g.wins++; g.streak++; g.best_streak = Math.max(g.best_streak, g.streak); if (pick === 'bao') g.bao_hits++; } else g.streak = 0;
    });
    dayBump(uid, 'play:dice', 1, t); if (res.win) dayBump(uid, 'win:dice', 1, t);
    const detail = { pick, dice: d3, sum: res.sum, side: res.side, bao: res.bao, win: res.win, streakBefore: streak, requested: r.requested, applied: r.applied, capped: r.capped, at: t };
    const hid = repo.histAdd(uid, 'dice', ref, detail, r.applied, t);
    const notes = notesOf(before, uid, checkAch(uid)); detail.notes = notes; repo.histSet(hid, detail, r.applied);
    return { id: hid, detail, points: r.applied };
  });
}
const diceHistory = (uid, n = A().dice.history) => repo.histRecent(uid, 'dice', n);

/* ------------------------------------------------------------------ LINH BẢO BÍ HỘP */
function boxTiers(uid) {
  const rk = rankOfUser(uid).id;
  return A().box.tiers.map((t) => ({ ...t, unlocked: rk >= t.rank, left: boxLeft(uid, t) }));
}
function boxOpen(uid, tierId) {
  const tier = box.tier(tierId); need(tier, 'Hộp không tồn tại.');
  return tx(() => {
    const t = now(); const rk = rankOfUser(uid); need(rk.id >= tier.rank, `🔒 **${tier.name}** mở khoá ở cấp bậc **${A().ranks[tier.rank - 1].name}**.`, 'LOCKED');
    need(boxLeft(uid, tier) > 0, `Hôm nay bạn đã mở hết **${tier.daily}** lượt ${tier.name}.`, 'LIMIT'); cooldownCheck(uid, 'box');
    const st = stats(uid); const owned = new Set(repo.items(uid).map((x) => x.item_id));
    const res = box.open(tier, { pityCount: st.box.pity[tier.id] || 0, owned });
    const ref = `box:${t}:${rng.token(6)}`; const it = repo.itemAdd(uid, res.item.id, t);
    const before = rk.id; const r = grant(uid, 'box', ref, res.points); dayBump(uid, `n:box${tier.id}`, 1, t); cooldownSet(uid, 'box');
    mutate(uid, (x) => { const g = x.box; g.opens++; if (res.dupe) g.dupes++; g.byGrade[res.grade] = (g.byGrade[res.grade] || 0) + 1; g.pity[tier.id] = res.pityNext; });
    dayBump(uid, 'play:box', 1, t); if (res.grade >= 3) dayBump(uid, 'box:g3', 1, t);
    const detail = { tier: tier.id, grade: res.grade, item: res.item.id, dupe: res.dupe, isNew: it.isNew, pityUsed: res.pityUsed, requested: r.requested, applied: r.applied, capped: r.capped, at: t };
    const hid = repo.histAdd(uid, 'box', ref, detail, r.applied, t);
    const notes = notesOf(before, uid, checkAch(uid)); detail.notes = notes; repo.histSet(hid, detail, r.applied);
    return { id: hid, detail, points: r.applied };
  });
}
const boxHistory = (uid, n = A().box.history) => repo.histRecent(uid, 'box', n);
const collection = (uid) => { const have = new Map(repo.items(uid).map((x) => [x.item_id, x.qty])); return A().box.items.map((it) => ({ ...it, qty: have.get(it.id) || 0 })); };

/* ------------------------------------------------------------------ TRUY TÌM LINH NGƯ */
const qLimitMs = (lv) => quiz.secondsOf(lv) * 1000;
function quizStart(uid) {
  return tx(() => {
    const cur = repo.sessionActive(uid, 'quiz'); if (cur) return quizAdvance(cur.id);
    const t = now(); need(limitLeft(uid, 'quiz') > 0, `Hôm nay bạn đã chơi đủ **${A().limits.quiz}** vòng đố. Mai quay lại nhé!`, 'LIMIT'); cooldownCheck(uid, 'quiz');
    const qs = quiz.generate(); const limitMs = qLimitMs(qs[0].lv); dayBump(uid, 'n:quiz', 1, t);
    const data = { qs, i: 0, qStart: t, limitMs, answers: [], correct: 0, streak: 0, pts: 0, last: null };
    const id = repo.sessionCreate(uid, 'quiz', 'play', rng.token(6), data, t + limitMs + A().quiz.graceMs, t);
    return repo.sessionGet(id);
  });
}
/** Ghi một câu (đã trả lời hoặc hết giờ) và chuyển sang câu kế. nextStart = mốc bắt đầu câu sau. */
function applyAnswer(d, { choice, timeout, elapsed }, nextStart) {
  const q = d.qs[d.i]; const ok = !timeout && choice === q.a; let pts = 0; let parts = null;
  if (ok) { d.streak++; parts = quiz.scoreAnswer({ lv: q.lv, elapsedMs: elapsed, limitMs: d.limitMs, streak: d.streak }); pts = parts.total; d.correct++; } else d.streak = 0;
  d.pts += pts; d.answers.push({ c: timeout ? -1 : choice, ok, pts, ms: timeout ? d.limitMs : elapsed });
  d.last = { ok, timeout: !!timeout, right: q.o[q.a], pts, parts, q: q.t };
  d.i++;
  if (d.i < d.qs.length) { d.qStart = nextStart; d.limitMs = qLimitMs(d.qs[d.i].lv); }
}
function quizAnswer(uid, sid, qi, choice) {
  return tx(() => {
    const s0 = ownSession(uid, sid, 'quiz'); let s = quizAdvance(s0.id); if (s.status !== 'active') return s;
    const d = s.data; if (d.i !== qi) return s; // nút cũ / bấm đúp: bỏ qua, chỉ hiển thị lại câu hiện tại
    need(Number.isInteger(choice) && choice >= 0 && choice < 4, 'Đáp án không hợp lệ.');
    const t = now(); const elapsed = t - d.qStart; const late = elapsed > d.limitMs + A().quiz.graceMs;
    applyAnswer(d, { choice, timeout: late, elapsed: Math.min(elapsed, d.limitMs) }, t);
    return d.i >= d.qs.length ? settleQuiz(s, d, t) : saveQuiz(s, d, t);
  });
}
function saveQuiz(s, d, t = now()) { repo.sessionSave(s.id, { data: d, expiresAt: d.qStart + d.limitMs + A().quiz.graceMs }, t); return repo.sessionGet(s.id); }
function quizAdvance(sid) {
  return tx(() => {
    const s = repo.sessionGet(+sid); need(s, 'Phiên đố không còn tồn tại.', 'STALE'); if (s.status !== 'active') return s;
    const d = s.data; const t = now(); let changed = false;
    while (d.i < d.qs.length && t > d.qStart + d.limitMs + A().quiz.graceMs) { applyAnswer(d, { timeout: true, elapsed: d.limitMs }, d.qStart + d.limitMs + A().quiz.graceMs); changed = true; }
    if (d.i >= d.qs.length) return settleQuiz(s, d, t);
    return changed ? saveQuiz(s, d, t) : s;
  });
}
function settleQuiz(s, d, t = now()) {
  const uid = s.user_id; if (!repo.sessionClose(s.id, 'done', t)) return repo.sessionGet(s.id);
  const before = rankOfUser(uid).id; const bonus = quiz.roundBonus(d.correct, d.qs.length); const total = d.pts + bonus;
  const r = grant(uid, 'quiz', `quiz:${s.id}`, total);
  mutate(uid, (x) => {
    const g = x.quiz; g.rounds++; g.answered += d.qs.length; g.correct += d.correct; g.best_score = Math.max(g.best_score, total);
    let run = g.streak; for (const a of d.answers) { run = a.ok ? run + 1 : 0; g.best_streak = Math.max(g.best_streak, run); } g.streak = run;
    if (d.correct >= d.qs.length) g.perfect++;
  });
  dayBump(uid, 'play:quiz', 1, t); if (d.correct) dayBump(uid, 'quizc', d.correct, t);
  repo.histAdd(uid, 'quiz', `quiz:${s.id}`, { correct: d.correct, total: d.qs.length, pts: d.pts, bonus }, r.applied, t); cooldownSet(uid, 'quiz');
  const notes = notesOf(before, uid, checkAch(uid));
  repo.sessionSave(s.id, { phase: 'done', data: { ...d, final: { bonus, total, applied: r.applied, requested: r.requested, capped: r.capped, notes } } }, t);
  return repo.sessionGet(s.id);
}
function quizGet(uid, sid) { const s = ownSession(uid, sid, 'quiz'); return s.status === 'active' ? quizAdvance(s.id) : s; }
function raceGet(uid, sid) { const s = ownSession(uid, sid, 'race'); return s.status === 'active' ? raceAdvance(s.id) : s; }

/* ------------------------------------------------------------------ NHIỆM VỤ NGÀY */
function missionsOf(uid, t = now()) {
  const day = dayKey(t); const r = rng.mulberry32(rng.hashStr(`${uid}:${day}`));
  const chosen = rng.shuffle(A().missions, r).slice(0, A().missionCount); const all = A().missionAll;
  const prog = (m) => (m.id === all.id ? ['race', 'dice', 'box', 'quiz'].filter((g) => dayCount(uid, `play:${g}`, t) > 0).length : dayCount(uid, m.ev, t));
  return [...chosen, all].map((m) => { const p = Math.min(prog(m), m.target); return { ...m, progress: p, done: p >= m.target, claimed: repo.ledgerHas(uid, 'mission', `mission:${day}:${m.id}`) }; });
}
function claimMission(uid, id) {
  return tx(() => {
    const t = now(); const m = missionsOf(uid, t).find((x) => x.id === id); need(m, 'Nhiệm vụ này không có trong hôm nay.');
    need(m.done, 'Nhiệm vụ chưa hoàn thành.'); need(!m.claimed, 'Bạn đã nhận thưởng nhiệm vụ này rồi.');
    const before = rankOfUser(uid).id; const r = grant(uid, 'mission', `mission:${dayKey(t)}:${m.id}`, m.reward, { capped: false, note: m.name });
    if (r.duplicate) throw new GameError('Bạn đã nhận thưởng nhiệm vụ này rồi.');
    mutate(uid, (x) => { x.missions.claimed++; });
    return { mission: m, points: r.applied, notes: notesOf(before, uid, checkAch(uid)) };
  });
}
function achievements(uid) { const have = new Map(repo.achList(uid).map((x) => [x.ach_id, x.unlocked_at])); const st = stats(uid); return A().achievements.map((a) => ({ ...a, unlocked: have.get(a.id) || null, value: Math.min(statValue(uid, st, a.stat), a.target) })); }

/* ------------------------------------------------------------------ BẢNG XẾP HẠNG */
function board(kind, pkey, uid, limit = 10) {
  const p = repo.periods(); const key = kind === 'all' ? '' : pkey || (kind === 'w' ? p.w : kind === 's' ? p.s : p.d);
  return { kind, pkey: key, rows: repo.top(kind, key, limit), mine: uid ? { pts: repo.pts(uid, kind, key), rank: repo.rankOf(uid, kind, key) } : null, seasons: repo.seasons() };
}

/* ------------------------------------------------------------------ nền */
/** Chốt các phiên đã quá hạn (đua đã chạy xong, đố bỏ dở, phiên chọn cá bị bỏ). An toàn khi gọi nhiều lần. */
function sweep() {
  let n = 0;
  for (const s of repo.sessionsOpen(now())) {
    try { if (s.game === 'race') raceAdvance(s.id); else if (s.game === 'quiz') quizAdvance(s.id); n++; } catch (e) { logger.warn(`arcade.sweep ${s.game}#${s.id}: ${e.message}`); }
  }
  return n;
}
function purge() {
  const t = now(); return { sessions: repo.sessionPurge(t - 7 * 86400000), history: repo.histPurge(t - 90 * 86400000), counters: repo.counterPurge(dayKey(t - 10 * 86400000)) };
}

module.exports = {
  GAMES, GAME_NAME, A, stats, summary, rankInfo, rankOfUser, limitLeft, boxLeft,
  raceOpen, racePick, raceStart, raceCancel, raceAdvance, raceGet, raceDueAt,
  diceRoll, diceHistory,
  boxTiers, boxOpen, boxHistory, collection,
  quizStart, quizAnswer, quizAdvance, quizGet,
  missionsOf, claimMission, achievements, board, sweep, purge, checkAch,
};
