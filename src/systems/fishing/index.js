'use strict';
/** Tính toàn bộ hệ số câu cá từ trang bị, mồi, thú, bình hỗ trợ, thời tiết, thời gian và sự kiện. */
const { D } = require('../../services/gameData');
const { randRange, chance } = require('../../utils/rng');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const z = { luck: 0, detect: 0, power: 0, resist: 0, durability: 0, bite: 0, rare: 0, weight: 0, exp: 0, sell: 0 };

function computeMods({ rod, innate, bait, float, line, hook, pet, skill, buffs = {}, wx = {}, tx = {}, ev = {}, rates = {} }) {
  const p = pet || z; const b = (k) => 1 + (buffs[k] || 0) / 100;
  const inn = { rareBonus: 0, biteSpeed: 0, durabilitySave: 0, weightBonus: 0, sellBonus: 0, expBonus: 0, tensionDown: 0 };
  if (innate && innate.fx) inn[innate.fx] = innate.value;
  const sk = { rareBonus: 0, biteSpeed: 0, tensionDown: 0, weightBonus: 0, sellBonus: 0, ...(skill || {}) };
  const luck = ((rod.luck || 0) + (hook?.hook?.luck || 0) + (p.luck || 0)) * b('luck');
  const detect = ((rod.detect || 0) + (float?.float?.detect || 0) + (p.detect || 0)) * b('detect');
  const power = ((rod.power || 0) + (hook?.hook?.power || 0) + (p.power || 0)) * b('power');
  const resist = ((rod.resist || 0) + (line?.line?.resist || 0) + (p.resist || 0)) * b('resist');
  const rareBonus = clamp(((luck * 0.5 + detect * 0.7 + (bait?.stats?.rareBonus || 0) + (p.rare || 0) + (wx.rareBonus || 0) + (tx.rareBonus || 0) + (ev.rareBonus || 0) + inn.rareBonus + sk.rareBonus) * (rates.luck || 1)), 0, 400);
  const biteSpeed = clamp((bait?.stats?.biteSpeed || 0) + (float?.float?.biteSpeed || 0) + (p.bite || 0) + (buffs.biteSpeed || 0) + (wx.biteSpeed || 0) + (tx.biteSpeed || 0) + (ev.biteSpeed || 0) + inn.biteSpeed + sk.biteSpeed, -50, 300);
  const weightBonus = (p.weight || 0) + inn.weightBonus + sk.weightBonus;
  const sellBonus = (p.sell || 0) + inn.sellBonus + sk.sellBonus;
  const expBonus = (p.exp || 0) + inn.expBonus + (buffs.expMult || 0);
  return {
    luck, detect, power, reel: rod.reel || 0, resist, rareBonus, biteSpeed, weightBonus, sellBonus, expBonus,
    expMult: (1 + expBonus / 100) * (ev.expMult || 1) * (rates.exp || 1), coinMult: (1 + sellBonus / 100) * (ev.coinMult || 1) * (rates.xu || 1),
    durabilitySave: clamp((line?.line?.durabilitySave || 0) + (p.durability || 0) + inn.durabilitySave, 0, 90), tensionDown: inn.tensionDown + sk.tensionDown, maxDurability: rod.durability || 0,
  };
}
/** Thời gian chờ cá cắn (ms). */
const waitMs = (loc, mods, rnd) => Math.round(clamp((loc.baseBiteSeconds * randRange(0.6, 1.4, rnd)) / (1 + clamp(mods.biteSpeed, -50, 300) / 100), 3, 45) * 1000);
/** Thời gian được phép giật cần sau khi cá cắn (ms). */
const biteWindowMs = (mods) => 6000 + Math.min(4000, mods.reel * 8);
function skillProc(pet, rnd) { if (!pet) return null; const c = pet.def.skill.chance + pet.inst.bond / 500; if (!chance(c) && !(rnd && rnd() < c)) return null; return { id: pet.def.skill.id, name: pet.def.skill.name, ...pet.def.skill.effect }; }
module.exports = { computeMods, waitMs, biteWindowMs, skillProc };
