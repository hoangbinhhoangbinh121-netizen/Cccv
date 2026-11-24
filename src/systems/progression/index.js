'use strict';
const MAX_LEVEL = 100;
/** EXP cần để lên cấp kế tiếp. */
const expForLevel = (lv) => Math.round(80 * Math.pow(lv, 1.7));
/** Cộng EXP, trả về cấp/exp mới và số cấp tăng. */
function applyExp(level, exp, gain) {
  let lv = level, e = exp + Math.max(0, Math.round(gain)); let up = 0;
  while (lv < MAX_LEVEL && e >= expForLevel(lv)) { e -= expForLevel(lv); lv++; up++; }
  if (lv >= MAX_LEVEL) e = Math.min(e, expForLevel(MAX_LEVEL - 1));
  return { level: lv, exp: e, up };
}
/** Phần thưởng mỗi cấp: xu; mỗi 10 cấp thêm rương. */
const levelReward = (lv) => ({ xu: lv * 120, items: lv % 10 === 0 ? { [lv >= 50 ? 'ruong_vang' : 'ruong_bac']: 1 } : {} });
/** Cấp người chơi tối thiểu để dùng cần theo bậc */
const ROD_TIER_LEVEL = [1, 1, 5, 12, 20, 30, 40, 52, 65, 80];
module.exports = { MAX_LEVEL, expForLevel, applyExp, levelReward, ROD_TIER_LEVEL };
