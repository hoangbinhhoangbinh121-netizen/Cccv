'use strict';
const { D } = require('../../services/gameData');
const rarity = require('../rarity');
const { rand, pickWeighted } = require('../../utils/rng');

const VARIANTS = [
  { id: 'thuong', name: 'Thường', w: 90, weightMult: 1, valueMult: 1 },
  { id: 'khong_lo', name: 'Khổng Lồ', w: 6, weightMult: 1.35, valueMult: 1.5 },
  { id: 'bach_tang', name: 'Bạch Tạng', w: 2.6, weightMult: 1, valueMult: 2.2 },
  { id: 'anh_kim', name: 'Ánh Kim', w: 1.2, weightMult: 1.1, valueMult: 3.2 },
  { id: 'cau_vong', name: 'Cầu Vồng', w: 0.25, weightMult: 1.2, valueMult: 7 },
];
const variantById = (id) => VARIANTS.find((v) => v.id === id) || VARIANTS[0];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/**
 * Bảng cá có thể xuất hiện: trọng số = spawnWeight × độ hiếm × (giờ phù hợp) × (thời tiết phù hợp) × (1+R)^bậc × mồi.
 * R (%) là tổng "tỷ lệ cá hiếm" từ cần/mồi/thú/sự kiện/thời tiết. Cá nào càng hiếm so với khu vực thì càng hưởng lợi từ R.
 */
function spawnTable({ location, timeBand, weather, rareBonus = 0, bait = null, eventPool = [] }) {
  const loc = D.locations.get(location); const fishes = D.fishByLoc.get(location) || [];
  const R = clamp(rareBonus, 0, 400) / 100;
  const rows = fishes.map((f) => {
    const rank = clamp(f.rarity - (loc.rarity - 1), 0, 2);
    let w = f.spawnWeight * rarity.weight(f.rarity);
    w *= f.times.includes(timeBand) ? 1.25 : 0.6;
    w *= f.weatherPref.includes(weather) ? 2 : 1;
    w *= Math.pow(1 + R, rank);
    if (bait && bait.stats.category && bait.stats.category === f.category) w *= 1 + bait.stats.categoryBonus / 100;
    return { fish: f, weight: w };
  });
  const base = rows.reduce((a, r) => a + r.weight, 0);
  for (const e of eventPool) { const f = D.fishes.get(e.fishId); if (f) rows.push({ fish: f, weight: (base * e.share) / 100, event: e.eventId }); }
  const total = rows.reduce((a, r) => a + r.weight, 0);
  return rows.map((r) => ({ ...r, chance: total ? r.weight / total : 0 }));
}
const pickFish = (table, rnd = rand) => pickWeighted(table, (r) => r.weight, rnd)?.fish;
function rollVariant(luck = 0, rnd = rand) { const boost = 1 + clamp(luck, 0, 400) / 200; return pickWeighted(VARIANTS, (v) => (v.id === 'thuong' ? v.w : v.w * boost), rnd); }
function rollWeight(fish, weightBonus = 0, variant = VARIANTS[0], rnd = rand) {
  const u = Math.pow(rnd(), 1.8); let w = fish.minWeight + (fish.maxWeight - fish.minWeight) * u;
  w = w * (1 + weightBonus / 100) * variant.weightMult; w = clamp(w, fish.minWeight, fish.maxWeight * 1.6);
  return Math.round(w * 100) / 100;
}
const baseValue = (fish, weight, variant) => Math.max(1, Math.round(weight * fish.pricePerKg * variant.valueMult));
const expFor = (fish, weight, variant) => { const t = (weight - fish.minWeight) / Math.max(0.01, fish.maxWeight - fish.minWeight); return Math.max(1, Math.round(fish.exp * (0.8 + 0.4 * clamp(t, 0, 1)) * (1 + (variant.valueMult - 1) * 0.3))); };
module.exports = { VARIANTS, variantById, spawnTable, pickFish, rollVariant, rollWeight, baseValue, expFor };
