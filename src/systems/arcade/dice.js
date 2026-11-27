'use strict';
/** Tài Xỉu Linh Vận – 3 xúc xắc, 3–10 Xỉu, 11–18 Tài. Chỉ đoán lấy Linh Điểm, không có cược tài sản. */
const rng = require('../../utils/rng');
const { D } = require('../../services/gameData');

const roll = (rnd = rng.rand) => [1, 2, 3].map(() => 1 + Math.floor(rnd() * 6));
const sideOf = (sum) => (sum >= 11 ? 'tai' : 'xiu');
const isBao = (d) => d[0] === d[1] && d[1] === d[2];
const PICKS = ['xiu', 'tai', 'bao'];
const NAME = { tai: 'Tài', xiu: 'Xỉu', bao: 'Bão' };
function judge(pick, dice) {
  const sum = dice[0] + dice[1] + dice[2]; const side = sideOf(sum); const bao = isBao(dice);
  const win = pick === 'bao' ? bao : pick === side;
  return { sum, side, bao, win };
}
function score(pick, res, streak) {
  const P = D.arcade.dice.points;
  if (pick === 'bao') return res.win ? P.bao : P.baoMiss;
  return res.win ? P.win + Math.min(P.streakMax, streak) * P.streakStep : P.lose;
}
module.exports = { roll, sideOf, isBao, judge, score, PICKS, NAME };
