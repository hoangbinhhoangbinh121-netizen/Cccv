'use strict';
/** Mở khoá & di chuyển giữa các khu vực câu. */
const { D } = require('./gameData');
const users = require('../database/repositories/users');
const rodRepo = require('../database/repositories/rods');
const economy = require('./economyService');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');

function status(userId) {
  const u = users.get(userId); const open = new Set(users.unlockedLocations(userId));
  const bestTier = Math.max(0, ...rodRepo.list(userId).map((r) => D.rods.get(r.rod_id)?.tier || 0));
  return D.locList.map((l) => ({ loc: l, unlocked: open.has(l.id), current: u.location === l.id, meetsLevel: u.level >= l.unlock.level, meetsRod: bestTier >= l.unlock.rodTier }));
}
function unlock(userId, locId) {
  const loc = D.locations.get(locId); if (!loc) throw new GameError('Khu vực không tồn tại.');
  return getDb().tx(() => {
    if (users.unlockedLocations(userId).includes(locId)) throw new GameError('Bạn đã mở khoá khu vực này rồi.');
    const s = status(userId).find((x) => x.loc.id === locId);
    const prev = D.locList.find((l) => l.order === loc.order - 1); if (prev && !users.unlockedLocations(userId).includes(prev.id)) throw new GameError(`Hãy mở khoá **${prev.name}** trước.`);
    if (!s.meetsLevel) throw new GameError(`Cần đạt cấp **${loc.unlock.level}**.`); if (!s.meetsRod) throw new GameError(`Cần sở hữu cần câu từ bậc **${D.tiers[loc.unlock.rodTier - 1].name}** trở lên.`);
    economy.debit(userId, loc.unlock.cost, 'unlock_location', { note: loc.name }); users.unlockLocation(userId, locId); users.update(userId, { location: locId });
    require('./progressService').track(userId, 'unlock', { count: 1 }); return loc;
  });
}
function travel(userId, locId) {
  const loc = D.locations.get(locId); if (!loc) throw new GameError('Khu vực không tồn tại.');
  if (!users.unlockedLocations(userId).includes(locId)) throw new GameError(`Bạn chưa mở khoá **${loc.name}**.`);
  users.update(userId, { location: locId }); return loc;
}
module.exports = { status, unlock, travel };
