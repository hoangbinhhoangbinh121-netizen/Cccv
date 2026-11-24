'use strict';
/**
 * Minigame kéo cá theo lượt (phù hợp độ trễ Discord). Mỗi lượt cá thực hiện một "chiêu"; người chơi phải chọn đúng thao tác.
 *   Lao đi → Thả dây | Vùng vẫy → Giữ | Mệt lả → Kéo
 * Máy chủ sinh chiêu, tính toán và kiểm tra thời hạn – client không thể giả mạo kết quả.
 */
const { rand } = require('../../utils/rng');
const MOVES = {
  dash: { id: 'dash', name: 'Lao đi', hint: 'Cá lao mạnh – hãy thả dây!', correct: 'release' },
  thrash: { id: 'thrash', name: 'Vùng vẫy', hint: 'Cá vùng vẫy – hãy giữ cần!', correct: 'hold' },
  tire: { id: 'tire', name: 'Mệt lả', hint: 'Cá đuối sức – kéo ngay!', correct: 'pull' },
};
const ACTIONS = { pull: { name: 'Kéo', tension: 9 }, hold: { name: 'Giữ', tension: 3 }, release: { name: 'Thả dây', tension: -12 } };
const ROUND_MS = 9000; const BOSS_ROUNDS = 5;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const randomMove = (rnd = rand) => Object.values(MOVES)[Math.floor(rnd() * 3)].id;

function initFish({ fish, stats, tensionDown = 0 }, rnd = rand) {
  const maxStamina = Math.round(40 + fish.difficulty * 1.3);
  const dmg = Math.round(clamp(16 + stats.power * 0.25 + stats.reel * 0.2, 16, maxStamina * 0.45));
  return {
    mode: 'fish', stamina: maxStamina, maxStamina, dmg, tension: 0, round: 0, wrong: 0, idle: 0, saved: false, resist: stats.resist,
    penalty: Math.round(clamp(12 + fish.difficulty * 0.18 - stats.resist * 0.05, 6, 40) * (1 - clamp(tensionDown, 0, 60) / 100)),
    maxRounds: Math.ceil(maxStamina / dmg) * 2 + 3, move: randomMove(rnd),
  };
}
function initBoss({ damage }, rnd = rand) { return { mode: 'boss', round: 0, maxRounds: BOSS_ROUNDS, combo: 0, hits: 0, baseDamage: damage, total: 0, idle: 0, move: randomMove(rnd) }; }

/** Xử lý một lượt. action = 'pull' | 'hold' | 'release' | null (hết giờ). Trả về {correct, done, ...}. */
function resolve(s, action, rnd = rand) {
  const move = MOVES[s.move]; const correct = !!action && action === move.correct;
  s.round++; s.idle = action ? 0 : s.idle + 1;
  const out = { correct, move: s.move, action, done: null, saved: false, damage: 0 };
  if (s.mode === 'boss') {
    if (correct) { s.combo++; s.hits++; out.damage = Math.round(s.baseDamage * (1 + 0.15 * (s.combo - 1))); s.total += out.damage; } else s.combo = 0;
    if (s.round >= s.maxRounds) out.done = 'end'; else if (s.idle >= 2) out.done = 'timeout';
    s.move = randomMove(rnd); return out;
  }
  const tAdj = action ? ACTIONS[action].tension : 0;
  if (correct) { s.stamina -= s.dmg; s.tension = clamp(s.tension + tAdj, 0, 120); out.damage = s.dmg; }
  else { s.wrong++; s.tension = clamp(s.tension + tAdj + s.penalty, 0, 120); s.stamina = Math.min(s.maxStamina, s.stamina + Math.round(s.maxStamina * 0.08)); }
  if (s.tension >= 100) {
    if (!s.saved && rnd() < s.resist / (s.resist + 120)) { s.saved = true; s.tension = 70; out.saved = true; } else { out.done = 'snap'; return out; }
  }
  if (s.stamina <= 0) out.done = 'success';
  else if (s.idle >= 2) out.done = 'timeout';
  else if (s.round >= s.maxRounds) out.done = 'escaped';
  s.move = randomMove(rnd);
  return out;
}
module.exports = { MOVES, ACTIONS, ROUND_MS, BOSS_ROUNDS, initFish, initBoss, resolve };
