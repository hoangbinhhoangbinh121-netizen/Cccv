'use strict';
/** Vẽ Pixel Art cho emoji Ngư Trường (64×64 → PNG 128×128). Mỗi hàm vẽ theo id trong scripts/pixel/arcade-catalog.js. */
const { Cv, hsl, hex, shade, lighten, mix } = require('./lib');
const data = require('../../data/arcade.json');
const rar = require('../../data/rarities.json');

const W = [255, 255, 255, 255], BK = [24, 20, 32, 255], GOLD = hex('#ffd23f'), GOLD2 = hex('#e6a712'), RED = hex('#e5484d'), BLUE = hex('#4fa3ff'), GREEN = hex('#3ed16e'), PURP = hex('#8f7aff'), GRAY = hex('#9aa5b5'), CREAM = hex('#f4e4b0'), BROWN = hex('#8b5a2b'), CLEAR = [0, 0, 0, 0];
const OUT = [24, 20, 30, 255];
const gradeCol = (g) => hex(rar[g - 1].color);
const finish = (c) => { c.outline(OUT); return c; };
const sparkle = (c, x, y, col = W, r = 2) => { c.star(x, y, col, r); c.set(x + 1, y + 1, col); c.set(x - 1, y - 1, col); };
const disc = (c, cx, cy, r, col) => { c.ellipse(cx, cy, r, r, shade(col, 0.55)); c.ellipse(cx, cy, r - 2, r - 2, col); c.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.28, r * 0.2, lighten(col, 0.5)); };
const arrow = (c, dir, col) => { // dir: 'l' | 'r' | 'u' | 'd'
  const P = { r: [[10, 24], [38, 24], [38, 12], [56, 32], [38, 52], [38, 40], [10, 40]], l: [[54, 24], [26, 24], [26, 12], [8, 32], [26, 52], [26, 40], [54, 40]], u: [[24, 54], [24, 26], [12, 26], [32, 8], [52, 26], [40, 26], [40, 54]], d: [[24, 10], [24, 38], [12, 38], [32, 56], [52, 38], [40, 38], [40, 10]] }[dir];
  c.poly(P, shade(col, 0.7)); c.poly(P.map(([x, y]) => [32 + (x - 32) * 0.82, 32 + (y - 32) * 0.82]), col);
};
const starPts = (cx, cy, R, r) => { const o = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? r : R; o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return o; };
const ringArrows = (c, col) => { for (const a0 of [20, 200]) for (let a = a0; a < a0 + 140; a += 2) for (const rr of [18, 19, 20, 21, 22]) c.set(32 + Math.cos(a / 57.3) * rr, 32 + Math.sin(a / 57.3) * rr, col); c.poly([[50, 8], [60, 28], [38, 26]], col); c.poly([[14, 56], [4, 36], [26, 38]], col); };
const check = (c, col, t = 4) => { c.line(14, 34, 26, 46, col, t); c.line(26, 46, 50, 18, col, t); };
const cross = (c, col, t = 4) => { c.line(16, 16, 48, 48, col, t); c.line(48, 16, 16, 48, col, t); };
const fishShape = (c, cx, cy, s, col, flip = 1) => { c.poly([[cx - 12 * s * flip, cy], [cx - 4 * s * flip, cy - 8 * s], [cx + 10 * s * flip, cy - 5 * s], [cx + 14 * s * flip, cy], [cx + 10 * s * flip, cy + 5 * s], [cx - 4 * s * flip, cy + 8 * s]], col); c.poly([[cx - 12 * s * flip, cy], [cx - 20 * s * flip, cy - 7 * s], [cx - 17 * s * flip, cy], [cx - 20 * s * flip, cy + 7 * s]], shade(col, 0.8)); c.set(cx + 8 * s * flip, cy - 2 * s, W); c.set(cx + 9 * s * flip, cy - 2 * s, BK); };

/* ---------------------------------------------------------------- hình dạng Linh Bảo */
function item(shape, hue, grade) {
  const c = new Cv(64), g = gradeCol(grade); const base = hsl(hue, 0.7, 0.55), dk = hsl(hue, 0.7, 0.32), lt = hsl(hue, 0.8, 0.78), dkk = hsl(hue, 0.6, 0.2);
  c.ellipse(32, 32, 29, 29, shade(g, 0.35)); c.ellipse(32, 32, 26, 26, mix(shade(g, 0.22), hsl(hue, 0.4, 0.14), 0.4)); c.ring(32, 32, 27, 27, g);
  switch (shape) {
    case 'shell': c.poly([[32, 50], [14, 36], [14, 24], [24, 14], [40, 14], [50, 24], [50, 36]], base); for (let k = -3; k <= 3; k++) c.line(32, 50, 32 + k * 5, 17, dk); c.rect(25, 49, 14, 4, dk); c.poly([[22, 20], [28, 16], [26, 24]], lt); break;
    case 'pearl': c.ellipse(32, 34, 15, 15, dk); c.ellipse(32, 33, 13, 13, base); c.ellipse(32, 33, 13, 13, (x, y, dx, dy) => lighten(base, 0.35 - (dx + dy) * 0.18)); c.ellipse(26, 26, 5, 4, W); c.set(36, 40, lt); c.poly([[20, 52], [32, 46], [44, 52], [38, 56], [26, 56]], shade(g, 0.8)); break;
    case 'bottle': c.rect(27, 12, 10, 6, hex('#a8794a')); c.rect(29, 18, 6, 8, lt); c.poly([[22, 28], [42, 28], [46, 36], [46, 52], [18, 52], [18, 36]], (x, y) => (y < 40 ? lt : base)); c.rect(24, 36, 16, 12, CREAM); c.line(26, 40, 38, 40, dk); c.line(26, 44, 36, 44, dk); c.rect(21, 30, 3, 14, W); break;
    case 'feather': c.poly([[48, 10], [34, 16], [22, 30], [16, 52], [24, 46], [40, 36], [50, 22]], base); c.poly([[48, 10], [40, 22], [30, 34], [18, 52], [22, 50], [34, 38], [44, 24]], lt); c.line(48, 10, 16, 52, dk, 2); for (let k = 0; k < 4; k++) c.line(40 - k * 6, 20 + k * 7, 46 - k * 6, 28 + k * 7, dk); break;
    case 'anchor': c.ring(32, 14, 6, 6, base); c.ring(32, 14, 5, 5, base); c.rect(30, 20, 5, 28, base); c.rect(22, 25, 20, 4, base); c.poly([[12, 38], [18, 38], [24, 48], [32, 52], [40, 48], [46, 38], [52, 38], [48, 52], [32, 58], [16, 52]], dk); c.poly([[12, 38], [18, 38], [22, 46], [16, 46]], base); c.poly([[52, 38], [46, 38], [42, 46], [48, 46]], base); c.line(31, 22, 31, 46, lt); break;
    case 'scroll': c.rect(16, 14, 32, 38, CREAM); c.ellipse(16, 33, 4, 21, hex('#d6c28a')); c.ellipse(48, 33, 4, 21, hex('#d6c28a')); c.rect(14, 10, 36, 6, base); c.rect(14, 50, 36, 6, base); for (let k = 0; k < 4; k++) c.line(22, 22 + k * 7, 42, 22 + k * 7, dk); c.ellipse(38, 44, 5, 5, mix(base, RED, 0.5)); c.star(38, 44, lt, 1); break;
    case 'lantern': c.rect(29, 8, 6, 5, dkk); c.ring(32, 10, 6, 4, dk); c.rect(22, 13, 20, 5, dk); c.ellipse(32, 33, 16, 17, base); c.ellipse(32, 33, 11, 12, lt); c.ellipse(32, 33, 5, 6, W); for (let k = -1; k <= 1; k++) c.line(32 + k * 8, 17, 32 + k * 10, 50, dk); c.rect(24, 50, 16, 5, dk); c.line(32, 55, 32, 60, base, 2); break;
    case 'compass': c.ellipse(32, 32, 22, 22, GOLD2); c.ellipse(32, 32, 19, 19, CREAM); c.ring(32, 32, 19, 19, dk); c.poly([[32, 10], [37, 32], [32, 36], [27, 32]], RED); c.poly([[32, 54], [27, 32], [32, 28], [37, 32]], base); c.ellipse(32, 32, 3, 3, GOLD); for (const [x, y] of [[32, 12], [52, 32], [32, 52], [12, 32]]) c.set(x, y, dk); c.rect(30, 6, 4, 5, GOLD2); break;
    case 'crown': c.poly([[10, 48], [10, 20], [22, 32], [32, 14], [42, 32], [54, 20], [54, 48]], base); c.rect(10, 44, 44, 10, dk); c.rect(10, 44, 44, 3, lt); for (const [x, y] of [[10, 20], [32, 14], [54, 20]]) c.ellipse(x, y, 4, 4, GOLD); c.ellipse(32, 50, 3, 3, W); c.ellipse(20, 50, 2, 2, lt); c.ellipse(44, 50, 2, 2, lt); c.poly([[22, 34], [26, 44], [18, 44]], lt); break;
    case 'orb': c.ellipse(32, 32, 20, 20, dk); c.ellipse(32, 32, 18, 18, (x, y, dx, dy) => mix(base, lt, Math.max(0, 0.6 - (dx + dy + 1) * 0.35))); c.ellipse(24, 24, 6, 4, W); c.ring(32, 32, 14, 14, lt); c.set(40, 42, lt); c.set(41, 42, lt); c.rect(22, 50, 20, 5, dkk); c.rect(25, 48, 14, 3, dk); break;
    default: c.ellipse(32, 32, 12, 12, base);
  }
  if (grade >= 4) { sparkle(c, 10, 12, lighten(g, 0.5), 2); sparkle(c, 54, 52, lighten(g, 0.5), 2); }
  if (grade >= 6) { sparkle(c, 54, 12, W, 3); sparkle(c, 10, 52, W, 2); }
  return c;
}

/* ---------------------------------------------------------------- hộp */
const BOX = { 1: ['#8b5a2b', '#a8794a', '#5a3a1a', '#c9a15e'], 2: ['#b86a2e', '#d98a4a', '#7a4219', '#ffbf7a'], 3: ['#aab4c4', '#d3dbe6', '#6d788a', '#ffffff'], 4: ['#e6a712', '#ffd23f', '#a8740a', '#fff08a'], 5: ['#5b4bd6', '#8f7aff', '#2c2290', '#7df9ff'] };
function box(tier, state) {
  const c = new Cv(64); const [body, lid, dk, hi] = BOX[tier].map((x) => hex(x));
  const strap = tier === 5 ? hex('#7df9ff') : GOLD;
  const chest = (dy = 0) => { c.rect(10, 32 + dy, 44, 22, body); c.rect(10, 32 + dy, 44, 4, lid); c.rect(10, 50 + dy, 44, 4, dk); c.rect(30, 32 + dy, 4, 22, strap); c.rect(28, 38 + dy, 8, 8, GOLD); c.ellipse(32, 42 + dy, 2, 2, dk); };
  if (state === 'closed' || state === 'lock') {
    chest(0); c.poly([[10, 32], [14, 18], [50, 18], [54, 32]], lid); c.rect(10, 28, 44, 4, dk); c.rect(30, 18, 4, 14, strap); c.line(16, 22, 46, 22, hi);
    if (tier === 5) { sparkle(c, 12, 14, hex('#7df9ff'), 2); sparkle(c, 52, 12, W, 2); }
    if (state === 'lock') { c.ring(46, 46, 6, 7, hex('#cdd3dc')); c.rect(39, 46, 14, 11, hex('#7a8494')); c.ellipse(46, 51, 2, 2, BK); c.rect(45, 51, 2, 4, BK); c.ring(46, 46, 5, 6, hex('#cdd3dc')); }
  } else if (state === 'open') {
    for (let a = -60; a <= 60; a += 24) c.line(32, 26, 32 + Math.sin(a / 57.3) * 30, 26 - Math.cos(a / 57.3) * 24, hex('#fff6b0'), 2);
    c.ellipse(32, 24, 12, 10, [255, 240, 150, 255]); c.ellipse(32, 24, 7, 6, W);
    chest(4); c.poly([[10, 22], [16, 6], [48, 6], [54, 22]], lid); c.rect(10, 18, 44, 4, dk); c.rect(30, 6, 4, 16, strap); c.rect(12, 34, 40, 3, hi);
    sparkle(c, 12, 12, GOLD, 2); sparkle(c, 54, 16, W, 2); sparkle(c, 32, 6, hi, 1);
  } else { // crack
    chest(0); c.poly([[10, 32], [14, 18], [50, 18], [54, 32]], lid);
    c.line(24, 16, 30, 26, [255, 245, 170, 255], 2); c.line(30, 26, 26, 34, [255, 245, 170, 255], 2); c.line(40, 16, 34, 28, [255, 245, 170, 255], 2); for (let a = -50; a <= 50; a += 25) c.line(32, 30, 32 + Math.sin(a / 57.3) * 28, 30 - Math.cos(a / 57.3) * 24, [255, 240, 150, 200], 1);
    c.ellipse(32, 30, 5, 4, W); sparkle(c, 10, 14, GOLD, 2); sparkle(c, 54, 20, W, 2);
  }
  return c;
}
const crackBox = () => { const c = box(3, 'crack'); return c; };

/* ---------------------------------------------------------------- xúc xắc */
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function die(n, ghost) {
  const c = new Cv(64); c.rect(8, 8, 48, 48, ghost ? hex('#c8d2dc') : W); c.rect(8, 8, 48, 4, ghost ? hex('#dfe6ee') : hex('#eef3ff')); c.rect(8, 52, 48, 4, hex('#aeb9ca')); c.rect(52, 8, 4, 48, hex('#c4cedd'));
  [[8, 8], [55, 8], [8, 55], [55, 55]].forEach(([x, y]) => c.set(x, y, CLEAR));
  if (ghost) { // dấu hỏi
    c.rect(26, 18, 12, 4, hex('#6a7488')); c.rect(34, 22, 4, 8, hex('#6a7488')); c.rect(28, 30, 8, 4, hex('#6a7488')); c.rect(28, 34, 4, 6, hex('#6a7488')); c.rect(28, 44, 4, 4, hex('#6a7488')); c.line(6, 20, 2, 20, hex('#8fa1bd'), 1); c.line(6, 32, 0, 32, hex('#8fa1bd')); c.line(6, 44, 2, 44, hex('#8fa1bd'));
    return c;
  }
  for (const [px, py] of PIPS[n]) { const x = 32 + px * 14, y = 32 + py * 14; c.ellipse(x, y, 5, 5, n === 1 || n === 4 ? RED : BK); c.set(x - 2, y - 2, [255, 255, 255, 120]); }
  return c;
}

/* ---------------------------------------------------------------- bộ vẽ theo id */
function draw(id) {
  let m;
  if ((m = id.match(/^i_(.+)$/))) { const it = data.box.items.find((x) => x.id === m[1]); return item(it.shape, it.hue, it.grade); }
  if ((m = id.match(/^box_(\d)_open$/))) return box(+m[1], 'open');
  if ((m = id.match(/^box_(\d)$/))) return box(+m[1], 'closed');
  if ((m = id.match(/^die_(\d)$/))) return die(+m[1]);
  if ((m = id.match(/^grade_(\d)$/))) { const c = new Cv(64), g = gradeCol(+m[1]); c.poly([[32, 6], [52, 22], [46, 52], [18, 52], [12, 22]], shade(g, 0.6)); c.poly([[32, 11], [47, 23], [42, 47], [22, 47], [17, 23]], g); c.poly([[32, 11], [47, 23], [32, 30], [17, 23]], lighten(g, 0.45)); c.line(32, 30, 32, 47, shade(g, 0.8)); sparkle(c, 46, 14, W, 2); return c; }
  if ((m = id.match(/^rank_(\d)$/))) return rank(+m[1]);
  if ((m = id.match(/^medal_(\d)$/))) { const c = new Cv(64); const col = [hex('#ffd23f'), hex('#cfd6e0'), hex('#d08a4a')][+m[1] - 1]; c.poly([[18, 4], [30, 4], [34, 26], [24, 26]], RED); c.poly([[46, 4], [34, 4], [30, 26], [40, 26]], BLUE); c.ellipse(32, 40, 18, 18, shade(col, 0.6)); c.ellipse(32, 40, 15, 15, col); c.ring(32, 40, 12, 12, lighten(col, 0.4)); c.rect(30, 32, 5, 16, shade(col, 0.6)); if (+m[1] === 1) c.rect(28, 34, 3, 3, shade(col, 0.6)); if (+m[1] === 2) { c.rect(27, 32, 10, 3, shade(col, 0.6)); c.rect(27, 40, 10, 3, shade(col, 0.6)); c.rect(27, 46, 10, 3, shade(col, 0.6)); } c.set(24, 32, W); c.set(25, 31, W); return c; }
  if ((m = id.match(/^quiz_lv(\d)$/))) { const c = new Cv(64); const n = +m[1]; const R = n === 1 ? 20 : n === 2 ? 14 : 11; for (let k = 0; k < n; k++) { const x = 32 + (k - (n - 1) / 2) * (R * 2 + 1); c.poly(starPts(x, 30, R, R * 0.45), GOLD2); c.poly(starPts(x, 30, R - 2, (R - 2) * 0.45), GOLD); } c.rect(10, 54, 44, 4, hex(['#3ed16e', '#ffb22b', '#e5484d'][n - 1])); return c; }
  if ((m = id.match(/^quiz_([abcd])$/))) return letter(m[1].toUpperCase());
  return other(id);
}
function rank(n) {
  const c = new Cv(64);
  if (n === 1) { c.line(32, 54, 32, 30, hex('#2a9a4a'), 4); c.poly([[32, 34], [16, 22], [14, 34], [28, 38]], GREEN); c.poly([[32, 30], [48, 16], [52, 28], [36, 34]], hex('#58e08a')); c.ellipse(32, 56, 14, 4, hex('#6b4a2a')); }
  else if (n === 2) fishShape(c, 32, 32, 1.8, hex('#cfd6e0'));
  else if (n === 3) { c.line(14, 52, 50, 14, hex('#cfd6e0'), 4); c.line(50, 52, 14, 14, hex('#cfd6e0'), 4); c.rect(8, 48, 12, 6, BROWN); c.rect(44, 48, 12, 6, BROWN); c.ellipse(32, 32, 6, 6, GOLD); c.ellipse(32, 32, 3, 3, RED); }
  else if (n === 4) { c.poly([[10, 8], [54, 8], [54, 36], [32, 58], [10, 36]], hex('#3a8fe0')); c.poly([[15, 13], [49, 13], [49, 34], [32, 51], [15, 34]], hex('#7fc0ff')); fishShape(c, 32, 30, 1.2, W); }
  else { c.poly([[8, 46], [8, 18], [20, 30], [32, 12], [44, 30], [56, 18], [56, 46]], GOLD); c.rect(8, 42, 48, 10, GOLD2); fishShape(c, 32, 34, 0.9, hex('#4fc3f7')); for (const [x, y] of [[8, 18], [32, 12], [56, 18]]) c.ellipse(x, y, 4, 4, RED); sparkle(c, 54, 8, W, 2); }
  return c;
}
function letter(L) {
  const c = new Cv(64); c.rect(6, 6, 52, 52, hex('#2f4f8f')); c.rect(9, 9, 46, 46, hex('#4a7fd6')); c.rect(9, 9, 46, 4, hex('#7fb0ff'));
  const G = { A: ['0110', '1001', '1111', '1001', '1001'], B: ['1110', '1001', '1110', '1001', '1110'], C: ['0111', '1000', '1000', '1000', '0111'], D: ['1110', '1001', '1001', '1001', '1110'] }[L];
  G.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') c.rect(16 + x * 8, 16 + y * 7, 8, 7, W); })); return c;
}
function other(id) {
  const c = new Cv(64);
  switch (id) {
    case 'hub_logo': c.poly([[6, 30], [32, 8], [58, 30]], RED); for (let k = 0; k < 4; k++) c.poly([[6 + k * 13, 30], [32, 8], [19 + k * 13, 30]], k % 2 ? W : RED); c.rect(10, 30, 44, 24, hex('#e8d8a8')); c.rect(24, 36, 16, 18, hex('#6d441f')); c.rect(14, 34, 6, 8, hex('#7fc0ff')); c.rect(44, 34, 6, 8, hex('#7fc0ff')); c.line(32, 8, 32, 0, BROWN, 2); c.poly([[32, 0], [42, 3], [32, 6]], GOLD); fishShape(c, 32, 47, 0.5, hex('#4fc3f7')); break;
    case 'hub_points': c.poly([[32, 4], [52, 24], [32, 60], [12, 24]], hex('#1f7fc0')); c.poly([[32, 9], [47, 24], [32, 52], [17, 24]], hex('#4fc3f7')); c.poly([[32, 9], [47, 24], [32, 28], [17, 24]], hex('#b3ecff')); c.line(32, 28, 32, 52, hex('#2a9ad6')); sparkle(c, 50, 10, W, 2); break;
    case 'hub_rank': c.poly([[10, 6], [54, 6], [54, 36], [32, 58], [10, 36]], hex('#6a4cff')); c.poly([[15, 11], [49, 11], [49, 34], [32, 51], [15, 34]], PURP); c.poly([[20, 36], [20, 20], [27, 27], [32, 17], [37, 27], [44, 20], [44, 36]], GOLD); break;
    case 'hub_mission': c.rect(12, 8, 40, 48, CREAM); c.rect(8, 6, 48, 6, hex('#c99358')); c.rect(8, 52, 48, 6, hex('#c99358')); for (let k = 0; k < 3; k++) { c.rect(16, 18 + k * 11, 4, 4, GREEN); c.line(24, 20 + k * 11, 46, 20 + k * 11, BROWN); } c.line(15, 21, 17, 23, W); break;
    case 'hub_ach': c.poly([[14, 6], [50, 6], [46, 30], [38, 38], [26, 38], [18, 30]], GOLD); c.rect(28, 38, 8, 10, GOLD2); c.rect(18, 48, 28, 8, hex('#c99358')); c.ring(12, 16, 6, 7, GOLD2); c.ring(52, 16, 6, 7, GOLD2); c.rect(20, 10, 4, 14, hex('#fff08a')); break;
    case 'hub_board': c.rect(22, 14, 20, 40, hex('#ffd23f')); c.rect(4, 28, 18, 26, hex('#cfd6e0')); c.rect(42, 36, 18, 18, hex('#d08a4a')); c.rect(22, 14, 20, 3, W); c.rect(4, 54, 56, 4, hex('#6d441f')); c.star(32, 8, GOLD, 3); c.rect(29, 28, 6, 12, hex('#a8740a')); break;
    case 'hub_stats': c.rect(8, 8, 4, 48, hex('#6a7488')); c.rect(8, 52, 50, 4, hex('#6a7488')); [[16, 38, '#4fa3ff'], [28, 28, '#3ed16e'], [40, 18, '#ffd23f']].forEach(([x, y, col]) => c.rect(x, y, 9, 52 - y, hex(col))); c.line(14, 34, 26, 24, RED, 2); c.line(26, 24, 38, 14, RED, 2); c.poly([[38, 8], [50, 8], [50, 20]], RED); break;
    case 'hub_help': c.ellipse(32, 32, 26, 26, hex('#3a62ad')); c.ellipse(32, 32, 22, 22, hex('#4a7fd6')); c.rect(26, 16, 14, 5, W); c.rect(35, 21, 5, 9, W); c.rect(28, 28, 8, 5, W); c.rect(28, 33, 5, 7, W); c.rect(28, 44, 5, 5, W); break;
    case 'hub_cap': c.rect(14, 6, 36, 5, hex('#c99358')); c.rect(14, 53, 36, 5, hex('#c99358')); c.poly([[18, 11], [46, 11], [34, 32], [46, 53], [18, 53], [30, 32]], hex('#dff3ff')); c.poly([[22, 15], [42, 15], [34, 28], [30, 28]], GOLD); c.poly([[26, 52], [38, 52], [32, 40]], GOLD); c.line(32, 30, 32, 40, GOLD2); break;
    case 'hub_claim': c.rect(10, 26, 44, 28, RED); c.rect(8, 20, 48, 8, hex('#ff6a6a')); c.rect(28, 20, 8, 34, GOLD); c.poly([[32, 20], [18, 8], [12, 16], [26, 22]], GOLD); c.poly([[32, 20], [46, 8], [52, 16], [38, 22]], GOLD); c.ellipse(32, 20, 4, 4, GOLD2); break;
    case 'race_game': c.line(14, 8, 14, 58, BROWN, 3); for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) c.rect(17 + x * 7, 8 + y * 7, 7, 7, (x + y) % 2 ? BK : W); fishShape(c, 38, 46, 1.0, hex('#4fc3f7')); c.line(6, 40, 14, 40, hex('#b3ecff')); c.line(4, 46, 12, 46, hex('#b3ecff')); break;
    case 'race_start': c.line(18, 6, 18, 58, BROWN, 4); c.poly([[20, 8], [54, 18], [20, 30]], RED); c.poly([[20, 8], [38, 14], [20, 18]], hex('#ff7a7a')); c.rect(8, 54, 40, 4, W); c.rect(12, 56, 6, 2, BK); break;
    case 'race_finish': c.rect(8, 8, 6, 50, BROWN); c.rect(50, 8, 6, 50, BROWN); for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) c.rect(14 + x * 6, 8 + y * 6, 6, 6, (x + y) % 2 ? BK : W); c.rect(8, 56, 48, 3, hex('#c8d2dc')); break;
    case 'race_pick': c.ring(32, 32, 22, 22, RED); c.ring(32, 32, 21, 21, RED); c.ring(32, 32, 12, 12, RED); c.line(32, 4, 32, 24, RED, 3); c.line(32, 40, 32, 60, RED, 3); c.line(4, 32, 24, 32, RED, 3); c.line(40, 32, 60, 32, RED, 3); c.ellipse(32, 32, 3, 3, GOLD); break;
    case 'race_speed': c.poly([[36, 4], [14, 36], [28, 36], [22, 60], [50, 24], [34, 24], [42, 4]], GOLD2); c.poly([[36, 8], [20, 34], [32, 34], [28, 52], [44, 26], [32, 26], [38, 8]], GOLD); break;
    case 'race_stamina': c.ellipse(32, 32, 26, 26, hex('#c8d2dc')); c.ellipse(32, 32, 22, 22, hex('#e9eef5')); c.poly([[32, 50], [14, 32], [14, 22], [22, 16], [32, 24], [42, 16], [50, 22], [50, 32]], RED); c.poly([[20, 20], [24, 18], [26, 24]], hex('#ff9a9a')); break;
    case 'race_luck': for (let k = 0; k < 4; k++) { const a = (k * 90 + 45) / 57.3; c.ellipse(32 + Math.cos(a) * 11, 28 + Math.sin(a) * 11, 10, 10, GREEN); } c.line(32, 28, 40, 58, hex('#2a9a4a'), 3); c.ellipse(32, 28, 3, 3, hex('#b8ffcc')); break;
    case 'race_fav': c.poly([[32, 4], [46, 20], [44, 34], [52, 28], [54, 44], [44, 58], [20, 58], [10, 44], [14, 28], [22, 34], [20, 20]], hex('#ff6a2b')); c.poly([[32, 22], [42, 36], [40, 52], [24, 52], [22, 36]], GOLD); c.poly([[32, 36], [37, 46], [32, 52], [27, 46]], W); break;
    case 'trait_sprint': c.poly([[12, 40], [34, 18], [44, 10], [54, 10], [54, 20], [46, 30], [24, 52]], hex('#cfd6e0')); c.ellipse(42, 22, 5, 5, hex('#4fa3ff')); c.poly([[12, 40], [24, 52], [6, 58]], RED); c.poly([[8, 52], [14, 46], [4, 56]], GOLD); break;
    case 'trait_endure': c.poly([[10, 8], [54, 8], [54, 34], [32, 58], [10, 34]], hex('#3a62ad')); c.poly([[16, 14], [48, 14], [48, 32], [32, 50], [16, 32]], hex('#7fb0ff')); c.rect(28, 20, 8, 22, W); c.rect(22, 26, 20, 8, W); break;
    case 'trait_burst': { const pts = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const r = k % 2 ? 14 : 28; pts.push([32 + Math.cos(a) * r, 32 + Math.sin(a) * r]); } c.poly(pts, hex('#ff8a2b')); c.ellipse(32, 32, 13, 13, GOLD); c.ellipse(32, 32, 6, 6, W); break; }
    case 'trait_lucky': c.poly([[32, 4], [39, 24], [60, 24], [43, 37], [49, 58], [32, 45], [15, 58], [21, 37], [4, 24], [25, 24]], GOLD); c.poly([[32, 12], [36, 26], [32, 30], [28, 26]], hex('#fff6b0')); sparkle(c, 54, 8, W, 2); break;
    case 'trait_stealth': for (const [x, y, r] of [[22, 32, 14], [38, 28, 16], [46, 38, 12], [30, 40, 14]]) c.ellipse(x, y, r, r * 0.7, hex('#b8c4d4')); c.ellipse(32, 30, 10, 6, hex('#dfe8f2')); c.line(10, 50, 54, 50, hex('#8fa1bd'), 2); c.line(16, 56, 48, 56, hex('#8fa1bd'), 1); break;
    case 'trait_wild': for (let k = 0; k < 3; k++) for (let a = 0; a < 330; a += 3) { const t = a + k * 40; const rr = (6 + k * 7) * (0.35 + a / 330 * 0.65) + 3; const col = hex(['#7df9ff', '#4fa3ff', '#8f7aff'][k]); c.ellipse(32 + Math.cos(t / 57.3) * rr * 1.4, 32 + Math.sin(t / 57.3) * rr * 1.4, 1.6, 1.6, col); } c.ellipse(32, 32, 3, 3, W); break;
    case 'dice_game': c.rect(6, 28, 30, 30, hex('#eef3ff')); c.rect(30, 8, 28, 28, W); [[14, 36], [28, 50], [21, 43]].forEach(([x, y]) => c.ellipse(x, y, 3, 3, BK)); [[38, 16], [50, 16], [44, 22], [38, 28], [50, 28]].forEach(([x, y]) => c.ellipse(x, y, 2.4, 2.4, RED)); c.rect(6, 54, 30, 4, hex('#aeb9ca')); break;
    case 'die_q': return die(0, true);
    case 'dice_tai': arrow(c, 'u', RED); c.rect(22, 42, 20, 6, W); c.set(30, 30, W); break;
    case 'dice_xiu': arrow(c, 'd', hex('#3a8fe0')); break;
    case 'dice_bao': for (let k = 0; k < 6; k++) { const w = 52 - k * 8; const y = 6 + k * 9; c.ellipse(32 + (k % 2 ? 3 : -3), y + 4, w / 2, 5, [hex('#8da4bd'), hex('#a8bcd2'), hex('#c8d6e6'), hex('#8da4bd'), hex('#6a82a0'), hex('#4a5a72')][k]); c.ellipse(32 + (k % 2 ? 3 : -3), y + 3, w / 2 - 4, 2, [hex('#dfe9f5'), hex('#eaf2fb'), W, hex('#c8d6e6'), hex('#a8bcd2'), hex('#6a82a0')][k]); } sparkle(c, 54, 10, GOLD, 2); sparkle(c, 8, 50, W, 2); break;
    case 'dice_cup': c.ellipse(32, 52, 28, 7, hex('#6a7488')); c.ellipse(32, 50, 25, 5, hex('#9aa5b5')); c.poly([[8, 50], [10, 40], [16, 28], [24, 18], [32, 14], [40, 18], [48, 28], [54, 40], [56, 50]], hex('#b86a2e')); c.poly([[12, 46], [14, 38], [19, 28], [26, 20], [30, 18], [26, 30], [22, 46]], hex('#e0955a')); c.rect(8, 44, 48, 5, GOLD2); c.rect(8, 44, 48, 2, GOLD); c.ellipse(32, 12, 5, 5, GOLD); c.ellipse(31, 11, 2, 2, hex('#fff6b0')); break;
    case 'box_game': return box(2, 'open');
    case 'box_crack': return crackBox();
    case 'box_lock': return box(3, 'lock');
    case 'box_spark': sparkle(c, 32, 32, W, 18); c.poly([[32, 6], [38, 26], [58, 32], [38, 38], [32, 58], [26, 38], [6, 32], [26, 26]], GOLD); c.poly([[32, 16], [35, 29], [48, 32], [35, 35], [32, 48], [29, 35], [16, 32], [29, 29]], hex('#fff6b0')); sparkle(c, 52, 10, W, 3); sparkle(c, 12, 52, W, 2); break;
    case 'box_pity': c.poly([[10, 8], [54, 8], [54, 34], [32, 58], [10, 34]], hex('#2c8f5a')); c.poly([[16, 14], [48, 14], [48, 32], [32, 50], [16, 32]], hex('#58e08a')); c.poly([[32, 17], [36, 27], [47, 27], [38, 34], [42, 45], [32, 38], [22, 45], [26, 34], [17, 27], [28, 27]], GOLD); break;
    case 'quiz_game': c.ellipse(26, 36, 20, 12, hex('#4fc3f7')); c.poly([[8, 36], [2, 26], [4, 36], [2, 46]], hex('#29a0d6')); c.ellipse(34, 30, 6, 6, W); c.ellipse(35, 30, 3, 3, BK); c.ring(44, 32, 12, 12, GOLD2); c.ring(44, 32, 11, 11, GOLD2); c.ring(44, 32, 10, 10, hex('#dff3ff')); c.line(52, 41, 60, 52, hex('#6d441f'), 4); break;
    case 'quiz_q': c.ellipse(32, 32, 26, 26, hex('#2f8f5a')); c.ellipse(32, 32, 22, 22, hex('#57c37a')); c.rect(24, 14, 16, 6, W); c.rect(36, 20, 6, 10, W); c.rect(28, 28, 12, 6, W); c.rect(28, 34, 6, 8, W); c.rect(28, 46, 6, 6, W); break;
    case 'quiz_time': c.ellipse(32, 36, 22, 22, hex('#6a7488')); c.ellipse(32, 36, 19, 19, W); c.rect(28, 6, 8, 6, hex('#6a7488')); c.rect(30, 10, 4, 6, hex('#6a7488')); c.line(32, 36, 32, 22, BK, 2); c.line(32, 36, 42, 40, RED, 2); c.set(32, 20, RED); c.line(50, 14, 54, 10, hex('#6a7488'), 3); break;
    case 'quiz_ok': c.ellipse(32, 32, 26, 26, hex('#1f8f4a')); c.ellipse(32, 32, 23, 23, GREEN); check(c, W, 5); break;
    case 'quiz_no': c.ellipse(32, 32, 26, 26, hex('#b3262c')); c.ellipse(32, 32, 23, 23, RED); cross(c, W, 5); break;
    case 'quiz_streak': c.poly([[32, 4], [48, 24], [46, 36], [54, 40], [48, 58], [16, 58], [10, 40], [18, 30], [22, 36], [24, 18]], hex('#2a8fe0')); c.poly([[32, 20], [42, 36], [40, 52], [24, 52], [22, 36]], hex('#7df9ff')); c.poly([[32, 36], [37, 46], [32, 52], [27, 46]], W); break;
    case 'quiz_speed': c.poly([[10, 40], [18, 20], [30, 18], [36, 34], [56, 38], [56, 50], [10, 50]], hex('#e5e9f0')); c.rect(10, 46, 46, 6, hex('#8da4bd')); c.poly([[30, 18], [44, 6], [50, 14], [38, 28]], hex('#cfe6ff')); c.line(2, 30, 10, 30, hex('#b3ecff'), 2); c.line(0, 40, 8, 40, hex('#b3ecff'), 2); break;
    case 'ui_back': arrow(c, 'l', hex('#6a7488')); break;
    case 'ui_next': arrow(c, 'r', hex('#6a7488')); break;
    case 'ui_refresh': ringArrows(c, hex('#4fa3ff')); break;
    case 'ui_ok': c.ellipse(32, 32, 26, 26, hex('#1f8f4a')); c.ellipse(32, 32, 23, 23, GREEN); check(c, W, 4); break;
    case 'ui_no': c.ellipse(32, 32, 26, 26, hex('#b3262c')); c.ellipse(32, 32, 20, 20, hex('#ff8a8a')); c.line(16, 48, 48, 16, hex('#b3262c'), 6); c.ring(32, 32, 21, 21, RED); break;
    case 'ui_lock': c.ring(32, 22, 10, 12, hex('#9aa5b5')); c.ring(32, 22, 9, 11, hex('#9aa5b5')); c.rect(12, 28, 40, 28, hex('#6a7488')); c.rect(12, 28, 40, 4, hex('#8da4bd')); c.ellipse(32, 41, 4, 4, BK); c.rect(30, 42, 4, 8, BK); break;
    case 'ui_new': c.poly([[6, 14], [58, 14], [58, 50], [6, 50]], hex('#ffb22b')); c.rect(6, 14, 52, 4, hex('#ffd23f')); [[12, 'N'], [26, 'E'], [40, 'W']].forEach(([x, L]) => { const G = { N: ['1001', '1101', '1011', '1001', '1001'], E: ['111', '100', '110', '100', '111'], W: ['10001', '10001', '10101', '11011', '10001'] }[L]; G.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') c.rect(x + xx * 3, 22 + yy * 5, 3, 5, BK); })); }); break;
    case 'ui_dup': ringArrows(c, GREEN); c.ellipse(32, 32, 5, 5, hex('#b8ffcc')); break;
    case 'ui_up': arrow(c, 'u', GREEN); sparkle(c, 52, 10, W, 2); break;
    case 'ui_star': c.poly(starPts(32, 34, 28, 12), GOLD2); c.poly(starPts(32, 34, 25, 10.5), GOLD); c.poly([[32, 14], [35, 28], [32, 34], [29, 28]], hex('#fff6b0')); break;
    default: throw new Error(`Chưa có hình cho emoji: ${id}`);
  }
  return c;
}
module.exports = { draw: (id) => finish(draw(id)), item, box, die };
