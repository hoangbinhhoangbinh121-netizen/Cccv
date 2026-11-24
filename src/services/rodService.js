'use strict';
const { D } = require('./gameData');
const rodRepo = require('../database/repositories/rods');
const users = require('../database/repositories/users');
const invRepo = require('../database/repositories/inventory');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const progressSvc = require('./progressService');
const rodSys = require('../systems/rods');
const { ROD_TIER_LEVEL } = require('../systems/progression');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { rand, chance } = require('../utils/rng');
const { xu: fxu } = require('../utils/format');

const own = (userId, id) => { const r = rodRepo.owned(userId, id); if (!r) throw new GameError('Bạn không sở hữu cần câu này.'); return r; };
const notListed = (r) => { if (r.listed) throw new GameError('Cần câu đang được rao bán trên thị trường.'); };
const view = (inst) => { const c = rodSys.computeStats(inst); return { inst, def: c.def, ...c }; };

function grantRod(userId, rodId, { level = 1, enhance = 0, force = false } = {}) {
  const def = D.rods.get(rodId); if (!def) throw new GameError('Cần câu không tồn tại.');
  if (!force) invSvc.requireSpace(userId, 1);
  const id = rodRepo.create(userId, rodId, { level, enhance, maxDurability: rodSys.maxDurabilityBase(def, level) });
  return id;
}
function equip(userId, id) {
  const r = own(userId, id); notListed(r); const def = D.rods.get(r.rod_id); const u = users.get(userId);
  if (u.level < ROD_TIER_LEVEL[def.tier - 1]) throw new GameError(`Cần đạt cấp **${ROD_TIER_LEVEL[def.tier - 1]}** để dùng cần bậc ${def.tierName}.`);
  users.setEquip(userId, 'rod_id', r.id); return def;
}
const unequip = (userId) => users.setEquip(userId, 'rod_id', null);
function upgradeLevel(userId, id) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); const def = D.rods.get(r.rod_id);
    if (r.level >= def.maxLevel) throw new GameError(`Cần đã đạt cấp tối đa (${def.maxLevel}).`);
    const u = users.get(userId); if (r.level >= u.level + 5) throw new GameError(`Cấp cần không được vượt cấp người chơi quá 5 (cấp bạn: ${u.level}).`);
    const c = rodSys.upgradeCost(def, r.level); invSvc.spend(userId, c.mats); economy.debit(userId, c.xu, 'rod_upgrade', { note: `${def.name} → Lv${r.level + 1}` });
    const maxD = rodSys.maxDurabilityBase(def, r.level + 1); rodRepo.update(r.id, { level: r.level + 1, max_durability: maxD, durability: Math.min(maxD, r.durability + (maxD - r.max_durability)) });
    users.bumpStats(userId, { rod_upgrades: 1 }); progressSvc.track(userId, 'rod_upgrade', { count: 1 }); const newAch = progressSvc.checkAchievements(userId);
    return { level: r.level + 1, cost: c, newAch };
  });
}
/** Cường hóa: thất bại từ +6 trở lên sẽ tụt 1 cấp trừ khi dùng Bùa Bảo Hộ. Có bảo hiểm "pity" tăng tỷ lệ sau mỗi lần thất bại liên tiếp. */
function enhance(userId, id, { useCharm = false } = {}, rnd = rand) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); const def = D.rods.get(r.rod_id);
    if (r.enhance >= def.enhanceCap) throw new GameError(`Cần đã đạt giới hạn cường hóa (+${def.enhanceCap}).`);
    const target = r.enhance + 1; const c = rodSys.enhanceCost(def, target); const rate = rodSys.enhanceChance(target, r.pity);
    invSvc.spend(userId, { [c.stone]: c.stones }); economy.debit(userId, c.xu, 'rod_enhance', { note: `${def.name} +${target}` });
    let charmUsed = false; const ok = rnd() < rate; let newEnh = r.enhance; let pity = r.pity;
    if (ok) { newEnh = target; pity = 0; }
    else {
      pity += 1;
      if (target >= 6) { if (useCharm && invRepo.consume(userId, 'bua_bao_ho', 1)) charmUsed = true; else newEnh = r.enhance - 1; }
    }
    rodRepo.update(r.id, { enhance: Math.max(0, newEnh), pity });
    users.bumpStats(userId, { rod_enhances: 1 }); progressSvc.track(userId, 'rod_enhance', { count: 1 });
    return { success: ok, from: r.enhance, to: Math.max(0, newEnh), rate, charmUsed, cost: c, downgraded: !ok && !charmUsed && target >= 6 };
  });
}
function socketGem(userId, id, gemId, slot) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); const def = D.rods.get(r.rod_id); const gem = D.items.get(gemId);
    if (!gem || gem.type !== 'gem') throw new GameError('Đây không phải ngọc khảm.');
    const n = rodSys.socketCount(def, r); if (!n) throw new GameError('Cần câu này không có ô khảm.'); const arr = rodSys.sockets(r).slice(0, n); while (arr.length < n) arr.push(null);
    if (slot < 1 || slot > n) throw new GameError(`Ô khảm hợp lệ: 1–${n}.`); const old = arr[slot - 1];
    const fee = 500 * gem.tier; if (!invRepo.consume(userId, gemId, 1)) throw new GameError('Bạn không có viên ngọc này.');
    economy.debit(userId, fee, 'rod_socket', { note: gem.name });
    if (old) invSvc.grant(userId, { [old]: 1 }, { force: true });
    arr[slot - 1] = gemId; rodRepo.update(r.id, { sockets: JSON.stringify(arr) }); return { slot, replaced: old, fee };
  });
}
function unsocket(userId, id, slot) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); const arr = rodSys.sockets(r); const g = arr[slot - 1]; if (!g) throw new GameError('Ô khảm này đang trống.');
    arr[slot - 1] = null; invSvc.grant(userId, { [g]: 1 }, { force: true }); rodRepo.update(r.id, { sockets: JSON.stringify(arr) });
    const eff = rodSys.computeStats({ ...r, sockets: JSON.stringify(arr) }).stats.durability; if (r.durability > eff) rodRepo.update(r.id, { durability: eff }); return g;
  });
}
const recoverGems = (userId, id) => getDb().tx(() => { const r = own(userId, id); notListed(r); const arr = rodSys.sockets(r); const gems = arr.filter(Boolean); if (!gems.length) throw new GameError('Cần không có ngọc nào để thu hồi.'); for (const g of gems) invSvc.grant(userId, { [g]: 1 }, { force: true }); rodRepo.update(r.id, { sockets: JSON.stringify(arr.map(() => null)) }); return gems; });
function awaken(userId, id) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); const def = D.rods.get(r.rod_id);
    if (def.tier < 3) throw new GameError('Chỉ cần câu từ bậc Bạc trở lên mới có thể thức tỉnh.'); if (r.awaken >= 3) throw new GameError('Cần đã thức tỉnh tối đa (3 giai đoạn).');
    const c = rodSys.awakenCost(def, r); if (r.level < c.level) throw new GameError(`Cần đạt cấp cần **${c.level}** (hiện ${r.level}).`); if (r.enhance < c.enhance) throw new GameError(`Cần cường hóa tối thiểu **+${c.enhance}** (hiện +${r.enhance}).`);
    invSvc.spend(userId, c.mats); economy.debit(userId, c.xu, 'rod_awaken', { note: `${def.name} giai đoạn ${c.stage}` });
    rodRepo.update(r.id, { awaken: c.stage }); return { stage: c.stage, cost: c, bonusSocket: c.stage === 3 };
  });
}
function repair(userId, id) {
  return getDb().tx(() => {
    const r = own(userId, id); const def = D.rods.get(r.rod_id); const max = rodSys.computeStats(r).stats.durability; const missing = max - r.durability;
    if (missing <= 0) throw new GameError('Cần câu còn nguyên vẹn.'); const cost = rodSys.repairCost(def, missing);
    economy.debit(userId, cost, 'rod_repair', { note: def.name }); rodRepo.update(r.id, { durability: max }); return { restored: missing, cost };
  });
}
function repairWithScroll(userId, amount = 50) {
  const eq = users.equipment(userId); if (!eq.rod_id) throw new GameError('Bạn chưa trang bị cần câu.'); const r = own(userId, eq.rod_id); const max = rodSys.computeStats(r).stats.durability;
  if (r.durability >= max) throw new GameError('Cần câu còn nguyên vẹn.'); const add = Math.min(amount, max - r.durability); rodRepo.update(r.id, { durability: r.durability + add }); return add;
}
function setSkin(userId, id, skinId) {
  return getDb().tx(() => {
    const r = own(userId, id); const def = D.rods.get(r.rod_id); const skin = D.rods.get(skinId); if (!skin) throw new GameError('Ngoại hình không tồn tại.');
    if (!rodRepo.skins(userId).includes(skinId)) throw new GameError('Bạn chưa mở khoá ngoại hình này (sở hữu cần đó trước).'); if (skin.tier > def.tier) throw new GameError('Không thể dùng ngoại hình của bậc cao hơn cần câu.');
    const cost = rodSys.skinCost(def); economy.debit(userId, cost, 'rod_skin', { note: skin.name }); rodRepo.update(r.id, { skin: skinId === r.rod_id ? null : skinId }); return { cost, skin };
  });
}
const toggleLock = (userId, id) => { const r = own(userId, id); const v = r.locked ? 0 : 1; rodRepo.update(r.id, { locked: v }); return !!v; };
function craftRod(userId, recipeId) {
  return getDb().tx(() => {
    const rec = D.recipes.rods.find((x) => x.id === recipeId); if (!rec) throw new GameError('Công thức không tồn tại.'); const u = users.get(userId);
    if (u.level < rec.level) throw new GameError(`Cần đạt cấp **${rec.level}** để chế tạo.`); invSvc.requireSpace(userId, 1);
    invSvc.spend(userId, rec.mats); economy.debit(userId, rec.xu, 'craft', { note: rec.name }); const id = grantRod(userId, rec.rod, { force: true });
    users.bumpStats(userId, { crafts: 1 }); progressSvc.track(userId, 'craft', { count: 1 }); const newAch = progressSvc.checkAchievements(userId); return { id, def: D.rods.get(rec.rod), newAch };
  });
}
function craftItem(userId, recipeId, times = 1) {
  return getDb().tx(() => {
    const rec = D.recipes.items.find((x) => x.id === recipeId); if (!rec) throw new GameError('Công thức không tồn tại.'); times = Math.max(1, Math.min(100, times | 0));
    const need = {}; for (const [k, v] of Object.entries(rec.in)) need[k] = v * times; const out = {}; for (const [k, v] of Object.entries(rec.out)) out[k] = v * times;
    invSvc.spend(userId, need); economy.debit(userId, rec.xu * times, 'craft', { note: rec.name }); invSvc.grant(userId, out);
    users.bumpStats(userId, { crafts: times }); progressSvc.track(userId, 'craft', { count: times }); return { out, rec };
  });
}
function dismantle(userId, id) {
  return getDb().tx(() => {
    const r = own(userId, id); notListed(r); if (r.locked) throw new GameError('Cần câu đang bị khoá.'); const eq = users.equipment(userId);
    if (eq.rod_id === r.id) throw new GameError('Hãy tháo cần câu khỏi ô trang bị trước.'); const def = D.rods.get(r.rod_id);
    if (rodRepo.countOwned(userId) <= 1) throw new GameError('Bạn không thể phân giải cần câu cuối cùng.');
    const ret = rodSys.dismantleReturn(def, r); for (const g of rodSys.sockets(r).filter(Boolean)) ret.mats[g] = (ret.mats[g] || 0) + 1;
    rodRepo.remove(r.id); invSvc.grant(userId, ret.mats, { force: true }); economy.credit(userId, ret.xu, 'dismantle', { note: def.name }); return { def, ret };
  });
}
const SLOTS = { float: 'float_id', line: 'line_id', hook: 'hook_id', bait: 'bait_id' };
const TYPE_OF = { float: 'float', line: 'line', hook: 'hook', bait: 'bait' };
function equipAccessory(userId, slot, itemId) {
  if (!SLOTS[slot]) throw new GameError('Ô trang bị không hợp lệ.');
  if (!itemId) { users.setEquip(userId, SLOTS[slot], null); return null; }
  const def = require('./gameData').item(itemId); if (!def || def.type !== TYPE_OF[slot]) throw new GameError('Vật phẩm không phù hợp với ô này.');
  if (invRepo.count(userId, itemId) < 1) throw new GameError('Bạn không có vật phẩm này.'); users.setEquip(userId, SLOTS[slot], itemId); return def;
}
module.exports = { view, grantRod, equip, unequip, upgradeLevel, enhance, socketGem, unsocket, recoverGems, awaken, repair, repairWithScroll, setSkin, toggleLock, craftRod, craftItem, dismantle, equipAccessory, own, list: (u) => rodRepo.list(u).map(view) };
