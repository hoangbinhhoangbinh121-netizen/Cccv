'use strict';
const { D } = require('./gameData');
const users = require('../database/repositories/users');
const rods = require('../database/repositories/rods');
const prog = require('../database/repositories/progress');
const settings = require('../database/repositories/settings');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const progression = require('../systems/progression');
const rodSys = require('../systems/rods');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { now, dayKey } = require('../utils/time');
const ctx = require('./context');

const STARTER = { xu: 500, items: { moi_giun_dat: 20 } };
/** Đăng ký/tải hồ sơ. Lần đầu: tặng cần Gỗ, mồi, xu và mở chuỗi nhiệm vụ tân thủ. */
function register(userId, name = '') {
  return getDb().tx(() => {
    const { user, created } = users.ensure(userId, name);
    if (created) {
      const def = D.rods.get('rod_t1_a');
      const id = rods.create(userId, def.id, { maxDurability: rodSys.maxDurabilityBase(def, 1) });
      users.setEquip(userId, 'rod_id', id);
      economy.credit(userId, STARTER.xu, 'starter', { note: 'Quà tân thủ' });
      invSvc.grant(userId, STARTER.items, { force: true });
      users.setEquip(userId, 'bait_id', 'moi_giun_dat');
      require('./progressService').ensureMissions(userId);
    }
    return { user: users.get(userId), created };
  });
}
function assertCanPlay(userId) {
  if (ctx.restoring) throw new GameError('Hệ thống đang khôi phục dữ liệu, vui lòng thử lại sau ít phút.', 'MAINT');
  if (settings.get('maintenance')) throw new GameError('Bot đang bảo trì. Vui lòng quay lại sau!', 'MAINT');
  const u = users.get(userId); if (u && u.banned) throw new GameError(`Tài khoản bị khoá${u.ban_reason ? `: ${u.ban_reason}` : ''}.`, 'BANNED');
  return u;
}
function ensureReady(userId, name) { const r = register(userId, name); assertCanPlay(userId); return r; }

/** Cộng EXP, tự xử lý lên cấp + thưởng. Trả về { up, level, rewards }. Gọi trong giao dịch. */
function addExp(userId, gain) {
  const u = users.get(userId); const r = progression.applyExp(u.level, u.exp, gain);
  const rewards = [];
  for (let lv = u.level + 1; lv <= r.level; lv++) { const rw = progression.levelReward(lv); economy.credit(userId, rw.xu, 'level_up', { note: `Lên cấp ${lv}` }); invSvc.grant(userId, rw.items, { force: true }); rewards.push({ level: lv, ...rw }); }
  users.update(userId, { level: r.level, exp: r.exp });
  return { up: r.up, level: r.level, exp: r.exp, rewards };
}
const DAILY_ITEMS = { 3: { ruong_go: 1 }, 5: { moi_tom_nho: 15 }, 7: { ruong_bac: 1 } };
function daily(userId) {
  return getDb().tx(() => {
    const u = users.get(userId); const today = dayKey();
    if (u.last_daily === today) throw new GameError('Bạn đã nhận quà điểm danh hôm nay rồi. Hãy quay lại vào ngày mai!', 'COOLDOWN');
    const yesterday = dayKey(now() - 86400000);
    const streak = u.last_daily === yesterday ? (u.daily_streak % 7) + 1 : 1;
    const base = settings.get('daily_xu_base');
    const xu = Math.round((base + (streak - 1) * 150 + u.level * 20) * settings.get('xu_rate'));
    const items = { ...(DAILY_ITEMS[streak] || {}) }; if (streak === 7) items.ruong_bac = 1;
    economy.credit(userId, xu, 'daily', { idem: `daily:${userId}:${today}`, note: `Điểm danh ngày ${streak}` });
    invSvc.grant(userId, items, { force: true });
    users.update(userId, { last_daily: today, daily_streak: streak });
    return { streak, xu, items, nextDay: streak % 7 + 1 };
  });
}
function setTitle(userId, titleId) {
  if (!titleId) { users.update(userId, { title: null }); return null; }
  if (!prog.titles(userId).includes(titleId)) throw new GameError('Bạn chưa sở hữu danh hiệu này.');
  users.update(userId, { title: titleId }); return D.titles[titleId];
}
const titleName = (id) => (id ? D.titles[id] || null : null);
function profile(userId) {
  const user = users.get(userId); if (!user) return null;
  const stats = users.stats(userId); const eq = users.equipment(userId);
  return { user, stats, eq, xu: economy.balance(userId), slots: invSvc.slotsUsed(userId), cap: user.inv_capacity, need: progression.expForLevel(user.level), codex: require('../database/repositories/fish').codexCount(userId), titles: prog.titles(userId), ach: prog.achCount(userId), buffs: settings.activeBuffs(userId) };
}
module.exports = { register, ensureReady, assertCanPlay, addExp, daily, setTitle, titleName, profile, STARTER };
