'use strict';
const { D } = require('../../services/gameData');
/** Chỉ số thú cưng: theo cấp, độ thân thiết và giai đoạn tiến hoá. */
function petStats(inst) {
  const def = D.pets.get(inst.pet_id); const mul = (1 + 0.03 * (inst.level - 1)) * (1 + inst.bond / 200) * (inst.stage >= 2 ? 1.5 : 1);
  const st = {}; for (const [k, v] of Object.entries(def.stats)) st[k] = Math.round(v * mul * 10) / 10;
  return { def, stats: st, mul };
}
const petExpForLevel = (lv) => Math.round(60 * Math.pow(lv, 1.5));
module.exports = { petStats, petExpForLevel };
