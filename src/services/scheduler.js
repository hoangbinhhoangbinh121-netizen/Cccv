'use strict';
/** Các tác vụ nền: sự kiện, boss, thị trường hết hạn, bảng xếp hạng, dọn dẹp, backup tự động. */
const settings = require('../database/repositories/settings');
const sessRepo = require('../database/repositories/sessions');
const progRepo = require('../database/repositories/progress');
const eventSvc = require('./eventService');
const bossSvc = require('./bossService');
const marketSvc = require('./marketService');
const backup = require('../database/backup');
const ctx = require('./context');
const logger = require('../utils/logger');
const { now, dayKey, weekKey } = require('../utils/time');

const timers = [];
const safe = (name, fn) => async () => { if (ctx.restoring) return; try { await fn(); } catch (e) { logger.error(`Tác vụ nền ${name} lỗi:`, e.message); } };
function every(ms, name, fn, initial = 5000) { const run = safe(name, fn); const t0 = setTimeout(run, initial); const t = setInterval(run, ms); t0.unref?.(); t.unref?.(); timers.push(t0, t); }
function start() {
  every(30000, 'events', () => { for (const n of eventSvc.tick()) ctx.emit(n.type === 'started' ? 'eventStarted' : 'eventEnded', n); });
  every(30000, 'boss', () => bossSvc.tick());
  every(60000, 'market', () => { for (const l of marketSvc.expireDue()) ctx.emit('listingExpired', l); });
  every(300000, 'leaderboards', () => progRepo.refreshAll(), 15000);
  every(3600000, 'cleanup', () => { settings.purgeBuffs(); sessRepo.purgeOld(now() - 7 * 86400000); progRepo.missionPurge(dayKey(now() - 14 * 86400000)); }, 60000);
  backup.startAuto();
}
const stop = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.length = 0; backup.stopAuto(); };
module.exports = { start, stop };
