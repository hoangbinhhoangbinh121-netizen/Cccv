'use strict';
/**
 * Đoán Ngư Vương – hệ thống đua cá thuần (không đụng DB). Chỉ số lấy từ dữ liệu cá có sẵn:
 *  tốc độ ← phẩm cấp + hệ số riêng của loài, thể lực ← cân nặng tối đa + hệ số riêng, may mắn ← hệ số riêng; mỗi loài có 1 đặc tính cố định.
 * Mọi hàm nhận `rnd` (mặc định RNG máy chủ) nên kiểm thử có thể dùng hạt giống cố định.
 */
const { D } = require('../../services/gameData');
const rng = require('../../utils/rng');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cfg = () => D.arcade.race;
/** Cá hợp lệ để đua: loài thường, có khu vực thật (không boss, không sự kiện). */
const pool = () => D.fishList.filter((f) => !f.bossOnly && !f.event && D.locations.has(f.location));

function statsOf(f) {
  const h = rng.hashStr(f.id); const tr = cfg().traits[h % cfg().traits.length];
  const speed = clamp(40 + f.rarity * 2 + (h >>> 3) % 31, 20, 99);
  const stamina = clamp(34 + Math.round(Math.log2(1 + f.maxWeight) * 5) + (h >>> 9) % 26, 20, 99);
  const luck = 20 + (h >>> 15) % 61;
  return { id: f.id, speed, stamina, luck, trait: tr.id };
}
const power = (r) => r.speed * 0.5 + r.stamina * 0.3 + r.luck * 0.2;

function genField(rnd = rng.rand) {
  const n = cfg().minRacers + Math.floor(rnd() * (cfg().maxRacers - cfg().minRacers + 1));
  return rng.shuffle(pool(), rnd).slice(0, n).map(statsOf);
}

/** Mô phỏng toàn bộ cuộc đua: trả vị trí cộng dồn từng vòng + thứ hạng cuối. */
function simulate(field, rnd = rng.rand) {
  const R = cfg().rounds; const pos = field.map(() => 0); const cum = []; const steps = [];
  for (let r = 0; r < R; r++) {
    const row = field.map((x, k) => {
      let step = 10 + x.speed * 0.03;
      const late = r >= R - 2; const early = r < 2;
      let fatigue = 1 - (0.16 * (1 - x.stamina / 130)) * (r / (R - 1));
      let amp = 0.45;
      switch (x.trait) {
        case 'nuoc_rut': if (late) step *= 1.12; break;
        case 'ben_bi': fatigue = 1; break;
        case 'khoi_dau': if (early) step *= 1.12; else if (late) step *= 0.96; break;
        case 'may_man': if (rnd() < x.luck / 200) step *= 1.25; break;
        case 'an_minh': amp = 0.2; break;
        case 'that_thuong': amp = 0.8; break;
        default: break;
      }
      if (rnd() < x.luck / 400) step *= 1.15;
      step *= fatigue * (1 + (rnd() * 2 - 1) * amp);
      return Math.max(1, step);
    });
    row.forEach((s, k) => { pos[k] += s; });
    steps.push(row.map((v) => Math.round(v * 10) / 10)); cum.push(pos.map((v) => Math.round(v * 10) / 10));
  }
  const order = field.map((_, k) => k).sort((a, b) => pos[b] - pos[a] || field[b].luck - field[a].luck || a - b);
  return { cum, steps, order, final: pos.map((v) => Math.round(v * 10) / 10) };
}

/** Xác suất thắng ước lượng (Monte Carlo với RNG có hạt giống → ổn định, lưu cùng phiên). */
function odds(field, sims = 400, seed = 1) {
  const r = rng.mulberry32(seed); const wins = field.map(() => 0);
  for (let i = 0; i < sims; i++) wins[simulate(field, r).order[0]]++;
  return wins.map((w) => w / sims);
}

/** Điểm cho một lượt đoán. odd = xác suất thắng ước lượng của cá được chọn. */
function score({ pickIdx, order, odds: od, streak }) {
  const P = cfg().points; const n = od.length; const rankOfPick = order.indexOf(pickIdx);
  const won = rankOfPick === 0; const underdogIdx = od.indexOf(Math.min(...od));
  const rel = od[pickIdx] * n; let pts = P.join; let kind = 'out';
  if (won) { const bonus = rel >= 1 ? 0 : Math.round(P.underdogMax * (1 - rel)); pts = P.win + bonus + Math.min(P.streakMax, streak) * P.streakStep; kind = 'win'; }
  else if (rankOfPick <= 2) { pts = P.podium; kind = 'podium'; }
  return { won, kind, points: pts, rank: rankOfPick + 1, underdog: won && pickIdx === underdogIdx };
}
const totalMs = () => cfg().rounds * cfg().roundMs;
module.exports = { statsOf, power, genField, simulate, odds, score, totalMs, traitInfo: (id) => cfg().traits.find((t) => t.id === id) };
