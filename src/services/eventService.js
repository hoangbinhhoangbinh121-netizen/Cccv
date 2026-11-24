'use strict';
const { D } = require('./gameData');
const evRepo = require('../database/repositories/events');
const prog = require('../database/repositories/progress');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const evSys = require('../systems/events');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { now, startOfDay, dayOfWeek } = require('../utils/time');
const ctx = require('./context');

let cache = { at: 0, mods: null, list: [] };
const invalidate = () => { cache.at = 0; };
function active() { const t = now(); if (!cache.mods || t - cache.at > 3000 || t < cache.at) { const list = evRepo.active(t); cache = { at: t, list, mods: evSys.aggregate(list) }; } return cache.list; }
const modifiers = () => { active(); return cache.mods; };

/** Tạo sự kiện từ mẫu. Luôn có lịch bắt đầu/kết thúc và phần thưởng. */
function createFromTemplate(key, { startAt = now(), durationMin, by = null, nameOverride } = {}) {
  const tpl = D.eventTemplates.get(key); if (!tpl) throw new GameError(`Không có mẫu sự kiện "${key}".`);
  const dur = (durationMin || tpl.durationMin) * 60000; if (dur <= 0) throw new GameError('Thời lượng sự kiện không hợp lệ.');
  const data = { template: key, type: tpl.type, modifiers: tpl.modifiers || {}, rewards: tpl.rewards, scoring: tpl.scoring || null, ticket: tpl.ticket || null, fishPool: tpl.fishPool || [], fishWeight: tpl.fishWeight || 0, boss: tpl.boss || null, desc: tpl.desc };
  const id = evRepo.create({ key, name: nameOverride || tpl.name, type: tpl.type, start_at: startAt, end_at: startAt + dur, data, created_by: by });
  if (!id) throw new GameError('Sự kiện này đã tồn tại ở thời điểm đó.');
  invalidate(); return evRepo.get(id);
}
/** Lên lịch các sự kiện định kỳ trong 36 giờ tới (idempotent nhờ UNIQUE(key,start_at)). */
function ensureRecurring() {
  const t = now(); const out = [];
  for (const r of D.events.recurring) {
    for (let d = 0; d <= 1; d++) {
      const dayStart = startOfDay(t) + d * 86400000; const start = dayStart + r.hour * 3600000;
      if (r.dow !== null && dayOfWeek(dayStart + 3600000) !== r.dow) continue;
      if (start < t - 300000 || start > t + 36 * 3600000) continue;
      const tpl = D.eventTemplates.get(r.template);
      const id = evRepo.create({ key: r.template, name: tpl.name, type: tpl.type, start_at: start, end_at: start + tpl.durationMin * 60000, data: { template: r.template, type: tpl.type, modifiers: tpl.modifiers || {}, rewards: tpl.rewards, scoring: tpl.scoring || null, ticket: tpl.ticket || null, fishPool: tpl.fishPool || [], fishWeight: tpl.fishWeight || 0, boss: tpl.boss || null, desc: tpl.desc }, created_by: 'system' });
      if (id) out.push(id);
    }
  }
  return out;
}
function startEvent(ev) {
  evRepo.setStatus(ev.id, 'active'); invalidate();
  if (ev.data.boss) { try { require('./bossService').spawn(ev.data.boss, { rewardMult: 2, eventId: ev.id, durationMs: Math.min(ev.end_at - now(), 90 * 60000) }); } catch (e) { require('../utils/logger').warn(`Sự kiện ${ev.id}: không spawn được boss: ${e.message}`); } }
  return evRepo.get(ev.id);
}
/** Kết thúc & trao thưởng (chỉ một lần nhờ markFinalized). */
function finalize(evId) {
  return getDb().tx(() => {
    const ev = evRepo.get(evId); if (!ev) throw new GameError('Sự kiện không tồn tại.');
    if (!evRepo.markFinalized(evId)) return null;
    const rw = ev.data.rewards || {}; const paid = []; const given = new Set();
    const grant = (uid, r, note) => { if (r.xu) economy.credit(uid, r.xu, 'event', { note, idem: `event:${evId}:${uid}:${note}` }); if (r.items) invSvc.grant(uid, r.items, { force: true }); if (r.title) prog.addTitle(uid, r.title); };
    const ranking = ev.data.scoring ? evRepo.ranking(evId, 50) : [];
    for (const [i, row] of ranking.entries()) { const tier = (rw.top || []).find((x) => x.rank === i + 1); if (tier) { grant(row.user_id, tier, `top${i + 1}`); paid.push({ user_id: row.user_id, rank: i + 1, name: row.name, score: row.score }); given.add(row.user_id); } }
    for (const p of evRepo.participants(evId)) { if (p.score > 0 || ev.data.ticket) { grant(p.user_id, { xu: rw.xu, items: rw.items }, 'participation'); given.add(p.user_id); } }
    evRepo.setStatus(evId, 'ended'); invalidate();
    return { event: ev, winners: paid, rewarded: given.size };
  });
}
function cancel(evId) { const ev = evRepo.get(evId); if (!ev) throw new GameError('Sự kiện không tồn tại.'); if (ev.status === 'ended') throw new GameError('Sự kiện đã kết thúc.'); evRepo.setStatus(evId, 'cancelled'); invalidate(); return ev; }
/** Chạy định kỳ: bắt đầu/kết thúc sự kiện đến hạn. Trả về danh sách thông báo. */
function tick() {
  const out = []; ensureRecurring(); const due = evRepo.due();
  for (const ev of due.toStart) out.push({ type: 'started', event: startEvent(ev) });
  for (const ev of due.toEnd) { const r = finalize(ev.id); if (r) out.push({ type: 'ended', ...r }); }
  return out;
}
function join(userId, evId) {
  return getDb().tx(() => {
    const ev = evRepo.get(evId); if (!ev || ev.status !== 'active') throw new GameError('Sự kiện không còn diễn ra.');
    if (evRepo.joined(evId, userId)) throw new GameError('Bạn đã tham gia sự kiện này rồi.');
    if (ev.data.ticket) { if (!require('../database/repositories/inventory').consume(userId, ev.data.ticket, 1)) throw new GameError(`Cần **${D.items.get(ev.data.ticket).name}** để tham gia.`); }
    evRepo.join(evId, userId); return ev;
  });
}
/** Ghi điểm cho sự kiện xếp hạng (gọi khi bắt được cá). */
function score(userId, { weight }) {
  for (const ev of active()) {
    const sc = ev.data.scoring; if (!sc) continue;
    if (ev.data.ticket && !evRepo.joined(ev.id, userId)) continue;
    evRepo.addScore(ev.id, userId, sc === 'catch_count' ? 1 : weight);
  }
}
const upcoming = () => evRepo.list(['scheduled', 'active'], 20);
module.exports = { active, modifiers, createFromTemplate, ensureRecurring, tick, finalize, cancel, join, score, upcoming, invalidate, startEvent, ranking: evRepo.ranking, get: evRepo.get };
