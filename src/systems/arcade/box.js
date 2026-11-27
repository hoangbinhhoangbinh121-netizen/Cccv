'use strict';
/** Linh Bảo Bí Hộp – 5 bậc hộp, bảo hiểm (pity) chống xui, phần thưởng theo phẩm. Không tốn tài sản. */
const rng = require('../../utils/rng');
const { D } = require('../../services/gameData');

const cfg = () => D.arcade.box;
const tier = (id) => cfg().tiers.find((t) => t.id === +id) || null;
function rollGrade(t, rnd, minGrade = 0) {
  const ws = t.weights.map((w, i) => (i + 1 >= minGrade ? w : 0));
  const g = rng.pickWeighted(t.weights.map((_, i) => i + 1), (g1) => ws[g1 - 1], rnd);
  return g === undefined ? Math.max(1, minGrade) : g; // hộp không có phẩm ≥ bảo hiểm → trả đúng phẩm bảo hiểm
}
/** pityCount = số lần mở liên tiếp của hộp này mà chưa ra phẩm ≥ pity.grade. */
function open(t, { pityCount = 0, owned = new Set() } = {}, rnd = rng.rand) {
  const pity = t.pity || { after: 0, grade: 0 };
  const forced = pity.after > 0 && pityCount + 1 >= pity.after;
  const grade = rollGrade(t, rnd, forced ? pity.grade : 0);
  const list = cfg().items.filter((x) => x.grade === grade); const item = list[Math.floor(rnd() * list.length)];
  const dupe = owned.has(item.id);
  const base = Math.round(cfg().gradePoints[grade - 1] * t.mult);
  const points = dupe ? Math.max(1, Math.round(base * cfg().dupeRatio)) : base;
  const hit = pity.after > 0 && grade >= pity.grade;
  return { grade, item, dupe, points, base, pityUsed: forced, pityNext: hit ? 0 : pityCount + 1 };
}
module.exports = { tier, open, rollGrade };
