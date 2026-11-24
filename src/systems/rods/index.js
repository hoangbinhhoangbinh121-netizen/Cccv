'use strict';
const { D } = require('../../services/gameData');
const STATS = ['luck', 'power', 'reel', 'detect', 'resist'];
const STAT_NAMES = { luck: 'May mắn', power: 'Sức mạnh', reel: 'Tốc độ kéo', durability: 'Độ bền', detect: 'Phát hiện cá hiếm', resist: 'Chống cá thoát' };
const STAT_ICON = { luck: 'stat_luck', power: 'stat_power', reel: 'stat_speed', durability: 'stat_durability', detect: 'stat_detect', resist: 'stat_resist' };
const ENHANCE_RATE = [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1]; // theo cấp ĐÍCH +1..+15
const INNATE_FX = { lucky_cast: 'rareBonus', swift_bite: 'biteSpeed', sturdy: 'durabilitySave', bountiful: 'weightBonus', gold_touch: 'sellBonus', exp_flow: 'expBonus', steady_line: 'tensionDown' };
const AWAKEN_LEVEL_FRAC = [0.5, 0.75, 1]; const AWAKEN_ENHANCE = [3, 6, 9]; const AWAKEN_MATS = [5, 10, 20];

const maxDurabilityBase = (def, level) => Math.round(def.stats.durability * (1 + 0.02 * (level - 1)));
const socketCount = (def, inst) => def.sockets + (inst.awaken >= 3 ? 1 : 0);
const tierMat = (tier) => D.tiers[tier - 1].mat;
const sockets = (inst) => (Array.isArray(inst.sockets) ? inst.sockets : JSON.parse(inst.sockets || '[]'));

/** Tính chỉ số hiệu dụng của một cần (cấp độ + cường hóa + thức tỉnh + ngọc khảm + nội tại). */
function computeStats(inst) {
  const def = D.rods.get(inst.rod_id);
  const mul = (1 + 0.03 * (inst.level - 1)) * (1 + 0.04 * inst.enhance + (inst.enhance >= 10 ? 0.1 : 0)) * (1 + 0.08 * inst.awaken);
  const gem = { luck: 0, power: 0, reel: 0, durability: 0, detect: 0, resist: 0 };
  for (const g of sockets(inst)) { const gd = g && D.items.get(g); if (gd && gd.gem) gem[gd.gem.stat] += gd.gem.value; }
  const st = {}; for (const k of STATS) st[k] = Math.round(def.stats[k] * mul + gem[k]);
  st.durability = maxDurabilityBase(def, inst.level) + gem.durability;
  let innate = null;
  if (def.innate) { const meta = D.innates.get(def.innate.id); innate = { id: def.innate.id, name: meta.name, desc: meta.desc, value: Math.round(def.innate.base * (1 + 0.5 * inst.awaken) * 10) / 10, fx: INNATE_FX[def.innate.id] }; }
  return { stats: st, innate, def, mul };
}
const upgradeCost = (def, level) => ({ xu: Math.round(120 * def.tier * Math.pow(level, 1.35)), mats: level >= 4 ? { [tierMat(def.tier)]: Math.ceil(level / 4) } : {} });
const enhanceCost = (def, target) => ({ xu: Math.round(200 * Math.pow(def.tier, 1.5) * Math.pow(target, 1.6)), stone: target <= 5 ? 'da_cuong_hoa_so' : target <= 10 ? 'da_cuong_hoa_trung' : 'da_cuong_hoa_cao', stones: 1 + Math.floor((target - 1) / 3) });
const enhanceChance = (target, pity = 0) => Math.min(1, ENHANCE_RATE[target - 1] + (ENHANCE_RATE[target - 1] < 1 ? Math.min(0.3, pity * 0.02) : 0));
const awakenCost = (def, inst) => { const s = inst.awaken + 1; return { stage: s, level: Math.min(def.maxLevel, Math.ceil(def.maxLevel * AWAKEN_LEVEL_FRAC[s - 1])), enhance: AWAKEN_ENHANCE[s - 1], xu: 8000 * def.tier * s * s, mats: { [tierMat(def.tier)]: AWAKEN_MATS[s - 1] } }; };
const repairCost = (def, missing) => missing * 2 * def.tier * def.tier;
const skinCost = (def) => 1000 * def.tier;
function dismantleReturn(def, inst) {
  const mats = { [tierMat(def.tier)]: 1 + def.tier + Math.floor(inst.level / 10) };
  if (inst.enhance >= 3) mats.da_cuong_hoa_so = Math.floor(inst.enhance / 3);
  if (inst.enhance >= 8) mats.da_cuong_hoa_trung = Math.floor(inst.enhance / 6);
  const buy = def.price || 600 * Math.pow(3.1, def.tier - 2);
  return { mats, xu: Math.round(buy * 0.2) };
}
module.exports = { STATS, STAT_NAMES, STAT_ICON, ENHANCE_RATE, INNATE_FX, computeStats, maxDurabilityBase, socketCount, upgradeCost, enhanceCost, enhanceChance, awakenCost, repairCost, skinCost, dismantleReturn, tierMat, sockets };
