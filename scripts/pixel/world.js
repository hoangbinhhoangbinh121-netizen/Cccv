'use strict';
/** Thú cưng, khu vực, hiệu ứng, icon UI. */
const { Cv, hsl, hex, shade, lighten, mix, withA, hash, rng } = require('./lib');
const WHITE = [255, 255, 255, 255], GOLD = [255, 214, 74, 255], BLACK = [20, 18, 28, 255];

/* ---------------------------------------------------------------- THÚ CƯNG */
function petEyes(c, x, y, accent) { c.ellipse(x, y, 2.4, 2.8, BLACK); c.set(x - 1, y - 1, WHITE); c.set(x, y - 1, WHITE); if (accent) c.set(x, y + 1, accent); }
function drawPet(sp, stage) {
  const c = new Cv(64), col = hex(sp.color), dk = shade(col, 0.66), lt = lighten(col, 0.5), bl = lighten(col, 0.75), out = shade(col, 0.22);
  const ev = stage >= 2, acc = hsl(hash(sp.color) % 360, 0.9, 0.6);
  switch (sp.group) {
    case 'meo': {
      c.line(44, 50, 54, 42, col, 4); c.line(54, 42, 52, 30, col, 4); c.line(52, 31, 52, 30, dk, 3);
      c.ellipse(32, 45, 13, 10, (x, y, dx, dy) => (dy > 0.3 ? bl : col));
      c.ellipse(32, 27, 12, 11, col); c.poly([[21, 21], [22, 9], [31, 17]], col); c.poly([[43, 21], [42, 9], [33, 17]], col); c.poly([[23, 18], [24, 12], [28, 17]], [255, 170, 190, 255]); c.poly([[41, 18], [40, 12], [36, 17]], [255, 170, 190, 255]);
      c.line(32, 17, 32, 21, dk); c.line(28, 18, 28, 21, dk); c.line(36, 18, 36, 21, dk);
      petEyes(c, 26, 27, acc); petEyes(c, 38, 27, acc); c.set(32, 31, [255, 130, 150, 255]); c.line(30, 33, 32, 34, dk); c.line(32, 34, 34, 33, dk);
      c.line(20, 31, 12, 29, dk); c.line(20, 33, 12, 34, dk); c.line(44, 31, 52, 29, dk); c.line(44, 33, 52, 34, dk);
      c.ellipse(24, 54, 4, 3, bl); c.ellipse(40, 54, 4, 3, bl);
      c.ellipse(32, 11, 12, 3, hex('#e7c97a')); c.poly([[24, 11], [28, 3], [36, 3], [40, 11]], hex('#f1d78e')); c.line(25, 8, 39, 8, hex('#c0392b'));
      break; }
    case 'cao': {
      for (let k = 0; k < (ev ? 3 : 1); k++) { const a = (k - (ev ? 1 : 0)) * 0.5; c.ellipse(48 + k * 2, 42 - k * 5 - (ev ? 2 : 0), 9, 5, (x, y, dx) => (dx > 0.4 ? WHITE : col)); }
      c.ellipse(30, 46, 13, 10, (x, y, dx, dy) => (dy > 0.2 ? WHITE : col));
      c.ellipse(30, 28, 12, 10, col); c.poly([[19, 22], [18, 6], [29, 17]], col); c.poly([[41, 22], [42, 6], [31, 17]], col); c.poly([[21, 18], [21, 10], [26, 16]], dk); c.poly([[39, 18], [39, 10], [34, 16]], dk);
      c.ellipse(30, 34, 8, 5, WHITE); petEyes(c, 24, 27, acc); petEyes(c, 36, 27, acc); c.ellipse(30, 33, 2, 1.5, BLACK);
      c.ellipse(22, 55, 4, 3, dk); c.ellipse(38, 55, 4, 3, dk);
      c.ring(30, 14, 12, 3, [150, 220, 255, 255]); break; }
    case 'rai': {
      c.ellipse(26, 44, 18, 9, (x, y, dx, dy) => (dy > 0.2 ? bl : col)); c.ellipse(9, 46, 8, 3.5, dk);
      c.ellipse(46, 32, 10, 9, col); c.ellipse(46, 36, 7, 5, bl); c.ellipse(40, 24, 3, 3, dk); c.ellipse(52, 24, 3, 3, dk); petEyes(c, 42, 30, acc); petEyes(c, 50, 30, acc); c.ellipse(46, 35, 2, 1.5, BLACK);
      c.line(38, 36, 30, 35, dk); c.line(38, 38, 30, 40, dk); c.line(54, 36, 60, 35, dk);
      c.poly([[34, 48], [44, 44], [48, 50], [38, 52]], [150, 190, 210, 255]); c.ellipse(36, 54, 4, 3, dk); c.ellipse(52, 52, 4, 3, dk);
      if (ev) { c.ellipse(26, 44, 4, 4, [240, 250, 255, 255]); c.star(26, 44, WHITE, 2); } break; }
    case 'rua': {
      c.ellipse(53, 41, 6, 5, bl); c.ellipse(32, 44, 16, 4, dk); c.ellipse(46, 54, 4, 4, bl); c.ellipse(20, 54, 4, 4, bl); c.ellipse(32, 56, 4, 3, bl);
      c.ellipse(30, 36, 18, 14, (x, y, dx, dy) => (dy < -0.5 ? lt : col));
      for (let i = -2; i <= 2; i++) c.line(30 + i * 7, 25, 30 + i * 6, 47, dk); c.line(14, 36, 46, 36, dk); c.line(18, 28, 42, 28, dk); c.line(18, 44, 42, 44, dk);
      petEyes(c, 55, 38, acc); c.set(57, 43, dk);
      if (ev) { [[22, 30], [34, 30], [28, 40]].forEach(([x, y]) => { c.rect(x, y, 2, 5, acc); c.rect(x - 1, y + 2, 4, 1, acc); }); c.poly([[26, 22], [29, 12], [32, 22]], hex('#7df9ff')); c.poly([[34, 22], [38, 14], [40, 22]], hex('#7df9ff')); } break; }
    case 'long': {
      const yF = (t) => 34 + 9 * Math.sin(t * 6.3 + 0.4);
      for (let x = 6; x < 50; x++) { const t = (x - 6) / 44, th = 2.5 + t * 3.5, y = yF(t); for (let yy = Math.round(y - th); yy <= Math.round(y + th); yy++) c.set(x, yy, yy > y + th * 0.3 ? bl : yy < y - th * 0.4 ? dk : col); if (x % 3 === 0) c.poly([[x, y - th], [x + 1, y - th - 4], [x + 3, y - th]], lt); }
      const hy = yF(1); c.ellipse(52, hy, 7, 5.5, col); c.poly([[56, hy + 2], [61, hy + 5], [53, hy + 5]], dk); petEyes(c, 52, Math.round(hy - 2), acc);
      c.line(50, hy - 5, 45, hy - 12, acc, 2); c.line(54, hy - 5, 52, hy - 12, acc, 2); c.poly([[8, yF(0)], [2, yF(0) + 7], [10, yF(0) + 3]], lt);
      if (ev) { c.poly([[20, 12], [26, 4], [32, 12]], lt); c.poly([[30, 54], [36, 62], [40, 54]], lt); } break; }
    default: { // linh thú biển sâu
      c.line(32, 14, 38, 6, dk, 2); c.line(38, 6, 46, 7, dk, 1); c.ellipse(47, 9, 3, 3, [255, 240, 130, 255]);
      c.ellipse(30, 38, 18, 15, (x, y, dx, dy) => (dy < -0.4 ? lighten(col, 0.1) : dy > 0.5 ? dk : col));
      c.poly([[12, 38], [4, 28], [6, 40], [4, 50]], dk); c.poly([[28, 22], [32, 14], [36, 22]], dk);
      c.ellipse(36, 32, 5, 5, WHITE); c.ellipse(37, 32, 2.5, 3, BLACK); c.set(36, 31, WHITE);
      c.line(22, 46, 40, 46, dk); for (let i = 0; i < 5; i++) c.poly([[24 + i * 3, 46], [25 + i * 3, 49], [26 + i * 3, 46]], WHITE);
      for (let i = 0; i < 5; i++) c.set(18 + i * 4, 28 + (i % 2) * 5, acc);
      if (ev) { c.ellipse(20, 15, 2.5, 2.5, acc); c.line(20, 18, 22, 26, dk); c.ellipse(46, 54, 3, 3, acc); } break; }
  }
  c.outline(out);
  if (ev) { c.aura(withA(lighten(col, 0.3), 160), 4); c.star(8, 10, WHITE, 2); c.star(56, 12, GOLD, 3); c.ring(32, 6, 9, 2.5, GOLD); if (sp.rarity >= 6) c.star(54, 56, WHITE, 2); }
  else if (sp.rarity >= 5) c.aura(withA(lighten(col, 0.3), 110), 2);
  return c;
}

/* ---------------------------------------------------------------- KHU VỰC */
function sky(c, top, bot, hz, bands = 7) { for (let y = 0; y < hz; y++) { const k = Math.floor((y / hz) * bands) / (bands - 1); for (let x = 0; x < 64; x++) c.set(x, y, mix(top, bot, k)); } }
function water(c, top, bot, hz, seed, light) { const r = rng(seed); for (let y = hz; y < 64; y++) { const k = Math.floor(((y - hz) / (64 - hz)) * 6) / 5; for (let x = 0; x < 64; x++) c.set(x, y, mix(top, bot, k)); } for (let i = 0; i < 38; i++) { const x = Math.floor(r() * 60), y = hz + 2 + Math.floor(r() * (62 - hz)); c.line(x, y, x + 2 + Math.floor(r() * 4), y, light); } }
function drawLocation(scene) {
  const c = new Cv(64); const r = rng(hash(scene));
  switch (scene) {
    case 'pond':
      sky(c, hex('#8fd0ff'), hex('#e6f6ff'), 26); c.ellipse(50, 9, 5, 5, hex('#fff1a8')); c.aura([255, 240, 160, 120], 3);
      [[8, 26, 12], [22, 26, 9], [40, 26, 11], [56, 26, 10]].forEach(([x, y, s]) => c.ellipse(x, y - 2, s, s * 0.7, hex('#3f8f4f')));
      water(c, hex('#58b58a'), hex('#2f7d5a'), 26, 7, hex('#9be0bd'));
      for (let k = 0; k < 6; k++) { const x = 4 + k * 3, h = 16 + (k % 3) * 4; c.line(x, 52, x + (k % 2 ? 1 : -1), 52 - h, hex('#4f9a3f')); if (k % 2 === 0) c.ellipse(x + 1, 52 - h, 1.3, 3, hex('#8b5a2b')); }
      [[24, 44], [34, 52], [18, 55], [44, 40]].forEach(([x, y]) => { c.ellipse(x, y, 5, 2.2, hex('#4fae5c')); c.line(x, y, x + 4, y - 1, hex('#58b58a')); }); c.ellipse(34, 51, 1.6, 1.6, hex('#ff8fb8')); c.ellipse(44, 39, 1.4, 1.4, WHITE);
      c.rect(46, 50, 18, 3, hex('#a8733d')); c.rect(48, 53, 2, 8, hex('#6d441f')); c.rect(58, 53, 2, 8, hex('#6d441f')); c.line(46, 50, 64, 50, hex('#c99358')); break;
    case 'lake':
      sky(c, hex('#6db3f2'), hex('#cdeeff'), 28); c.poly([[0, 28], [14, 10], [28, 28]], hex('#6a7fa8')); c.poly([[14, 10], [18, 16], [10, 16]], WHITE); c.poly([[20, 28], [38, 6], [58, 28]], hex('#51658f')); c.poly([[38, 6], [43, 14], [33, 14]], WHITE); c.poly([[44, 28], [60, 14], [64, 28]], hex('#6a7fa8'));
      for (let i = 0; i < 14; i++) { const x = i * 5; c.poly([[x, 30], [x + 2, 20 + (i % 3) * 2], [x + 4, 30]], hex('#2f6b4a')); }
      water(c, hex('#4f9ad9'), hex('#2d6fb0'), 29, 11, hex('#a8d8ff')); c.poly([[22, 44], [42, 44], [38, 50], [26, 50]], hex('#8b5a2b')); c.line(32, 44, 32, 32, hex('#6d441f')); c.poly([[33, 33], [33, 43], [43, 43]], hex('#fff5dc')); c.line(20, 52, 44, 52, hex('#7fbcf0')); break;
    case 'glacier':
      sky(c, hex('#b9d8f5'), hex('#eaf8ff'), 28); for (let i = 0; i < 3; i++) { const col = i % 2 ? [90, 255, 190, 80] : [150, 120, 255, 80]; for (let x = 0; x < 64; x++) { const y = 8 + i * 5 + Math.sin(x / 7 + i) * 3; for (let k = 0; k < 6; k++) c.blend(x, y + k, [col[0], col[1], col[2], 80 - k * 10]); } }
      c.poly([[0, 28], [10, 12], [20, 28]], hex('#e6f7ff')); c.poly([[10, 12], [16, 24], [10, 28]], hex('#9bd3ec')); c.poly([[22, 28], [36, 6], [52, 28]], hex('#d9f1fb')); c.poly([[36, 6], [44, 20], [36, 28]], hex('#8bc8e4')); c.poly([[48, 28], [58, 14], [64, 28]], hex('#e6f7ff'));
      water(c, hex('#4bb0c9'), hex('#1f6f8e'), 29, 3, hex('#a4ecff')); [[10, 44, 8], [34, 52, 10], [52, 40, 6], [22, 58, 7]].forEach(([x, y, s]) => { c.ellipse(x, y, s, s * 0.35, WHITE); c.ellipse(x, y + 1, s * 0.8, s * 0.25, hex('#b7e8f5')); }); for (let i = 0; i < 16; i++) c.set(Math.floor(r() * 64), Math.floor(r() * 28), WHITE); break;
    case 'forest':
      sky(c, hex('#2f6f3a'), hex('#c8f08a'), 30); for (let i = 0; i < 5; i++) { const x = 4 + i * 14; c.rect(x, 0, 6, 34, hex('#5a3a1e')); c.rect(x + 1, 0, 2, 34, hex('#7a5230')); c.ellipse(x + 3, 6, 11, 8, hex('#2a7a3a')); c.ellipse(x + 3, 4, 8, 5, hex('#3f9a4a')); }
      water(c, hex('#4aa88a'), hex('#276b5e'), 34, 5, hex('#9be0cf')); [[12, 48, 8], [44, 54, 9]].forEach(([x, y, s]) => { c.ellipse(x, y, s, s * 0.5, hex('#6b7a68')); c.ellipse(x, y - 2, s * 0.8, s * 0.3, hex('#58a05a')); });
      [[28, 44], [34, 46]].forEach(([x, y]) => { c.rect(x, y, 2, 4, hex('#f4ecd4')); c.ellipse(x + 1, y, 4, 2.5, hex('#e04a3a')); c.set(x, y - 1, WHITE); c.set(x + 2, y, WHITE); });
      for (let i = 0; i < 14; i++) c.set(Math.floor(r() * 64), 20 + Math.floor(r() * 30), [255, 240, 120, 255]); break;
    case 'ocean':
      sky(c, hex('#4fa3ff'), hex('#bfe6ff'), 26); c.ellipse(14, 9, 5, 5, hex('#fff1a8')); [[44, 8, 8], [54, 11, 5], [30, 14, 6]].forEach(([x, y, s]) => { c.ellipse(x, y, s, s * 0.45, WHITE); c.ellipse(x - 2, y - 2, s * 0.6, s * 0.4, WHITE); }); c.ellipse(52, 26, 10, 4, hex('#3f7a5a')); c.poly([[46, 26], [52, 18], [58, 26]], hex('#4f9a6a'));
      water(c, hex('#2a7fe0'), hex('#0b3f94'), 26, 9, hex('#7fc0ff')); for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 56), y = 30 + Math.floor(r() * 30); c.line(x, y, x + 4, y, WHITE); c.line(x + 1, y - 1, x + 3, y - 1, WHITE); }
      c.poly([[20, 44], [26, 34], [30, 44]], hex('#7d8ea6')); c.line(18, 45, 32, 45, WHITE); c.line(8, 12, 10, 10, WHITE); c.line(10, 10, 12, 12, WHITE); break;
    case 'abyss':
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) c.set(x, y, mix(hex('#050818'), hex('#12183a'), Math.floor((y / 64) * 6) / 5));
      for (let i = 0; i < 38; i++) c.set(Math.floor(r() * 64), Math.floor(r() * 64), hsl(180 + r() * 120, 0.9, 0.6));
      [[14, 18, 270], [44, 12, 180], [30, 34, 320]].forEach(([x, y, h]) => { c.ellipse(x, y, 8, 6, hsl(h, 0.8, 0.5, 200)); c.ellipse(x, y - 2, 5, 3, hsl(h, 0.8, 0.75, 220)); for (let k = -2; k <= 2; k++) for (let yy = 0; yy < 12; yy++) c.set(x + k * 3 + Math.sin(yy / 2 + k) * 1.5, y + 5 + yy, hsl(h, 0.8, 0.6, 180 - yy * 12)); });
      c.poly([[0, 64], [0, 46], [8, 52], [16, 44], [24, 54], [34, 48], [44, 56], [54, 46], [64, 52], [64, 64]], hex('#0a0d1f')); c.line(46, 50, 50, 40, hex('#1b2342')); c.ellipse(50, 39, 3, 3, [255, 240, 130, 255]); c.aura([255, 240, 130, 160], 4); break;
    case 'dragon':
      sky(c, hex('#6b2a6e'), hex('#ffc46b'), 28, 8); c.ellipse(32, 26, 15, 15, hex('#ff6a4a')); c.ellipse(32, 26, 11, 11, hex('#ffb45a')); c.rect(0, 26, 64, 4, hex('#ffc46b'));
      c.poly([[2, 22], [10, 16], [18, 22], [14, 24], [6, 24]], [255, 150, 120, 160]); c.poly([[40, 14], [52, 10], [60, 16], [52, 18]], [255, 150, 120, 160]);
      for (let k = 0; k < 18; k++) { const x = 6 + k * 1.2 + Math.sin(k / 2) * 6, y = 6 + k * 0.5; c.ellipse(x, y, 2.4 - k * 0.06, 2, hex('#2a0f3a')); } c.poly([[22, 8], [30, 3], [28, 11]], hex('#2a0f3a'));
      water(c, hex('#d9553a'), hex('#5a1f4a'), 30, 13, hex('#ffd36b')); c.rect(6, 40, 3, 20, hex('#c0392b')); c.rect(24, 40, 3, 20, hex('#c0392b')); c.rect(2, 38, 28, 3, hex('#e04a3a')); c.rect(4, 35, 24, 3, hex('#c0392b')); c.line(0, 38, 32, 38, hex('#ffd36b'));
      for (let i = 0; i < 6; i++) { const x = 36 + i * 5; c.ring(x, 58, 6, 3, hex('#ffd36b')); } break;
    default: // ancient
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) c.set(x, y, mix(hex('#0a4a52'), hex('#041a24'), Math.floor((y / 64) * 6) / 5));
      [[10, 20], [30, 14], [48, 24]].forEach(([x, w]) => c.poly([[x, 0], [x + 6, 0], [x + 6 + w, 64], [x + w * 0.4, 64]], [140, 240, 230, 28]));
      [[8, 22, 8], [28, 14, 10], [48, 26, 8]].forEach(([x, top, w]) => { c.rect(x, top, w, 64 - top, hex('#4a6b78')); c.rect(x, top, 2, 64 - top, hex('#6f93a0')); c.rect(x - 2, top, w + 4, 3, hex('#6f93a0')); for (let k = 0; k < 4; k++) c.line(x + 1, top + 8 + k * 9, x + w - 1, top + 10 + k * 9, hex('#35505b')); c.rect(x + 3, top + 14, 2, 4, hsl(172, 0.9, 0.6)); c.rect(x + 2, top + 15, 4, 1, hsl(172, 0.9, 0.6)); });
      c.poly([[16, 22], [20, 14], [28, 14], [32, 22]], hex('#4a6b78')); c.rect(0, 56, 64, 8, hex('#0b2a33')); for (let i = 0; i < 9; i++) c.line(4 + i * 7, 58, 4 + i * 7 + Math.sin(i) * 3, 46 - (i % 3) * 3, hex('#2f8f6a'), 2);
      for (let i = 0; i < 12; i++) c.ring(Math.floor(r() * 64), Math.floor(r() * 56), 1.5, 1.5, [190, 255, 255, 190]); c.star(54, 48, hsl(172, 0.9, 0.7), 2); c.star(40, 40, hsl(50, 0.9, 0.7), 1); break;
  }
  return c;
}

/* ---------------------------------------------------------------- HIỆU ỨNG */
function drawFrame(r, color) {
  const c = new Cv(64), col = hex(color), lt = lighten(col, 0.5), dk = shade(col, 0.55);
  const w = 2 + Math.floor(r / 3);
  for (let i = 0; i < w; i++) { const k = i === 0 ? dk : i === w - 1 ? lt : col; c.line(i, i, 63 - i, i, k); c.line(i, 63 - i, 63 - i, 63 - i, k); c.line(i, i, i, 63 - i, k); c.line(63 - i, i, 63 - i, 63 - i, k); }
  const corner = (x, y) => { if (r >= 2) c.rect(x - 1, y - 1, 5, 5, lt); c.rect(x, y, 3, 3, r >= 5 ? GOLD : col); if (r >= 4) c.set(x + 1, y + 1, WHITE); };
  corner(1, 1); corner(60, 1); corner(1, 60); corner(60, 60);
  if (r >= 3) for (let x = 12; x < 52; x += 8) { c.set(x, w + 1, lt); c.set(x, 62 - w, lt); }
  if (r >= 6) { c.line(w + 2, w + 2, 63 - w - 2, w + 2, withA(lt, 160)); c.line(w + 2, 63 - w - 2, 63 - w - 2, 63 - w - 2, withA(lt, 160)); }
  if (r >= 7) c.star(32, 1, GOLD, 3), c.star(32, 62, GOLD, 3);
  if (r === 9) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { if (c.solid(x, y) && (x < 6 || x > 57 || y < 6 || y > 57)) c.set(x, y, hsl(x * 6 + y * 6, 0.9, 0.62)); }
  if (r >= 5) c.aura(withA(col, 130), r >= 8 ? 3 : 2);
  return c;
}
function drawFx(name) {
  const c = new Cv(64);
  switch (name) {
    case 'sparkle': c.poly([[32, 4], [37, 27], [60, 32], [37, 37], [32, 60], [27, 37], [4, 32], [27, 27]], (x, y) => (Math.hypot(x - 32, y - 32) < 9 ? WHITE : hex('#fff2a8'))); c.star(52, 12, WHITE, 3); c.star(12, 50, GOLD, 3); break;
    case 'splash': for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI; c.ellipse(32 + Math.cos(a) * 20, 40 + Math.sin(a) * 24, 3, 4, hex('#8fd0ff')); } c.ellipse(32, 50, 22, 5, hex('#4fa3ff')); c.ellipse(32, 48, 16, 3, hex('#bfe6ff')); c.line(32, 40, 32, 18, hex('#bfe6ff'), 3); c.ellipse(32, 16, 4, 5, hex('#bfe6ff')); break;
    case 'ripple': for (let i = 0; i < 4; i++) c.ring(32, 32, 6 + i * 8, 3 + i * 4, [150, 215, 255, 255 - i * 45]); break;
    case 'bubbles': [[20, 46, 9], [38, 30, 7], [44, 50, 5], [28, 18, 4], [50, 14, 3]].forEach(([x, y, r]) => { c.ring(x, y, r, r, [190, 235, 255, 255]); c.set(x - r * 0.4, y - r * 0.4, WHITE); c.set(x - r * 0.4 + 1, y - r * 0.4, WHITE); }); break;
    case 'bite': c.ellipse(32, 32, 24, 24, hex('#ffd23f')); c.ring(32, 32, 24, 24, hex('#c0392b')); c.ring(32, 32, 23, 23, hex('#c0392b')); c.rect(29, 14, 6, 22, hex('#d62828')); c.rect(29, 41, 6, 6, hex('#d62828')); c.rect(30, 15, 2, 20, hex('#ff6b6b')); break;
    case 'levelup': c.poly([[32, 6], [52, 30], [40, 30], [40, 56], [24, 56], [24, 30], [12, 30]], (x, y) => (y < 30 ? hex('#6aff8f') : hex('#2fd45f'))); c.line(32, 12, 32, 50, hex('#c9ffd8')); c.star(10, 10, GOLD, 3); c.star(56, 20, WHITE, 3); c.star(54, 54, GOLD, 2); break;
    case 'exp_orb': c.ellipse(32, 32, 18, 18, (x, y, dx, dy) => hsl(205, 0.9, 0.55 - (dx + dy) * 0.12)); c.ellipse(26, 26, 5, 4, [255, 255, 255, 200]); c.aura([90, 180, 255, 200], 5); break;
    case 'shine': for (let i = 0; i < 3; i++) c.line(10 + i * 14, 54, 30 + i * 14, 10, [255, 255, 255, 200 - i * 40], 3 - i % 2); c.star(48, 14, WHITE, 4); break;
    case 'confetti': { const r = rng(9); for (let i = 0; i < 40; i++) c.rect(Math.floor(r() * 60), Math.floor(r() * 60), 2 + (i % 2), 2, hsl(r() * 360, 0.9, 0.6)); break; }
    case 'flame': c.poly([[32, 4], [46, 24], [52, 42], [42, 58], [22, 58], [12, 42], [18, 24], [26, 30]], (x, y) => (y < 30 ? hex('#ff7a2b') : y < 46 ? hex('#ffb22b') : hex('#ffe066'))); c.poly([[32, 30], [40, 44], [36, 56], [28, 56], [24, 44]], hex('#fff3b0')); c.aura([255, 140, 40, 170], 3); break;
    default:
  }
  return c;
}

/* ---------------------------------------------------------------- ICON UI */
function drawUi(name) {
  const c = new Cv(64), out = [24, 20, 30, 255];
  const cloud = (col) => { c.ellipse(24, 30, 12, 9, col); c.ellipse(38, 26, 12, 11, col); c.ellipse(46, 32, 9, 7, col); c.rect(18, 32, 34, 6, col); };
  switch (name) {
    case 'coin': c.ellipse(32, 32, 24, 24, hex('#e6a712')); c.ellipse(32, 32, 20, 20, hex('#ffd23f')); c.ring(32, 32, 15, 15, hex('#e6a712')); c.line(24, 22, 40, 42, hex('#e6a712'), 3); c.line(40, 22, 24, 42, hex('#e6a712'), 3); c.rect(14, 18, 4, 3, [255, 255, 255, 200]); c.rect(16, 15, 6, 2, [255, 255, 255, 200]); break;
    case 'exp': c.ellipse(32, 32, 24, 24, hex('#2a6fe0')); c.ellipse(32, 32, 20, 20, hex('#4fa3ff')); c.poly([[32, 12], [37, 26], [52, 26], [40, 36], [45, 50], [32, 41], [19, 50], [24, 36], [12, 26], [27, 26]], hex('#ffe066')); c.ellipse(22, 20, 4, 3, [255, 255, 255, 190]); break;
    case 'fish': c.poly([[14, 32], [26, 16], [48, 18], [58, 32], [48, 46], [26, 48]], (x, y) => (y < 30 ? hex('#4fc3f7') : hex('#b3ecff'))); c.poly([[14, 32], [4, 22], [8, 32], [4, 42]], hex('#29a0d6')); c.set(48, 28, WHITE); c.set(49, 28, BLACK); c.line(34, 20, 36, 44, hex('#29a0d6')); break;
    case 'rod': c.line(10, 54, 50, 10, hex('#8b5a2b'), 3); c.line(50, 10, 56, 8, hex('#6d441f'), 2); c.line(56, 8, 58, 14, [240, 240, 250, 255]); c.line(58, 14, 58, 36, [240, 240, 250, 255]); c.ellipse(58, 40, 2, 3, hex('#e5484d')); c.ellipse(20, 44, 5, 5, [190, 196, 208, 255]); break;
    case 'location': c.poly([[32, 60], [14, 30], [20, 14], [32, 8], [44, 14], [50, 30]], hex('#e5484d')); c.ellipse(32, 26, 11, 11, hex('#ff7a7a')); c.ellipse(32, 26, 6, 6, WHITE); c.ellipse(32, 60, 10, 3, [0, 0, 0, 80]); break;
    case 'mission': c.rect(12, 12, 40, 44, hex('#f4e4b0')); c.rect(8, 8, 48, 8, hex('#c99358')); c.rect(8, 52, 48, 8, hex('#c99358')); for (let i = 0; i < 4; i++) c.line(18, 24 + i * 8, 46, 24 + i * 8, hex('#8b5a2b'), 1); c.rect(18, 22, 4, 4, hex('#e5484d')); break;
    case 'achievement': c.poly([[14, 8], [50, 8], [46, 30], [38, 38], [26, 38], [18, 30]], hex('#ffd23f')); c.rect(28, 38, 8, 10, hex('#e6a712')); c.rect(18, 48, 28, 8, hex('#c99358')); c.ring(12, 18, 6, 7, hex('#e6a712')); c.ring(52, 18, 6, 7, hex('#e6a712')); c.rect(20, 12, 4, 12, [255, 255, 255, 200]); c.star(32, 22, hex('#e5484d'), 3); break;
    case 'title': c.poly([[10, 8], [54, 8], [54, 40], [32, 54], [10, 40]], hex('#6a4cff')); c.poly([[14, 12], [50, 12], [50, 38], [32, 49], [14, 38]], hex('#8f7aff')); c.star(32, 28, GOLD, 8); c.ellipse(32, 28, 4, 4, GOLD); break;
    case 'weather_nang': c.ellipse(32, 32, 12, 12, hex('#ffd23f')); for (let a = 0; a < 360; a += 45) c.line(32 + Math.cos(a / 57.3) * 17, 32 + Math.sin(a / 57.3) * 17, 32 + Math.cos(a / 57.3) * 26, 32 + Math.sin(a / 57.3) * 26, hex('#ffb22b'), 3); break;
    case 'weather_mua': cloud(hex('#8da4bd')); for (let i = 0; i < 5; i++) c.line(18 + i * 8, 44, 15 + i * 8, 54, hex('#4fa3ff'), 2); break;
    case 'weather_bao': cloud(hex('#4a5568')); c.poly([[34, 34], [24, 48], [31, 48], [27, 60], [42, 42], [34, 42], [38, 34]], hex('#ffe066')); break;
    case 'weather_suong_mu': cloud(hex('#c8d2dc')); for (let i = 0; i < 3; i++) c.line(10 + i * 4, 44 + i * 6, 54 - i * 4, 44 + i * 6, hex('#dfe6ee'), 2); break;
    case 'weather_tuyet': for (let a = 0; a < 180; a += 60) c.line(32 + Math.cos(a / 57.3) * 24, 32 + Math.sin(a / 57.3) * 24, 32 - Math.cos(a / 57.3) * 24, 32 - Math.sin(a / 57.3) * 24, hex('#d9f4ff'), 3); c.ellipse(32, 32, 4, 4, WHITE); break;
    case 'weather_cuc_quang': for (let i = 0; i < 4; i++) for (let x = 6; x < 58; x++) { const y = 14 + i * 7 + Math.sin(x / 6 + i) * 4; c.set(x, y, hsl(130 + i * 40, 0.85, 0.6)); c.set(x, y + 1, hsl(130 + i * 40, 0.85, 0.5)); } c.star(10, 8, WHITE, 2); c.star(54, 54, WHITE, 2); break;
    case 'time_dawn': c.ellipse(32, 44, 16, 16, hex('#ff9f5a')); c.rect(0, 44, 64, 20, [0, 0, 0, 0]); c.rect(0, 44, 64, 4, hex('#5a3a7a')); for (let a = 200; a <= 340; a += 28) c.line(32 + Math.cos(a / 57.3) * 20, 44 + Math.sin(a / 57.3) * 20, 32 + Math.cos(a / 57.3) * 27, 44 + Math.sin(a / 57.3) * 27, hex('#ffd36b'), 2); break;
    case 'time_day': c.ellipse(32, 32, 12, 12, hex('#fff08a')); for (let a = 0; a < 360; a += 45) c.line(32 + Math.cos(a / 57.3) * 16, 32 + Math.sin(a / 57.3) * 16, 32 + Math.cos(a / 57.3) * 25, 32 + Math.sin(a / 57.3) * 25, hex('#ffd23f'), 3); break;
    case 'time_dusk': c.ellipse(32, 40, 16, 16, hex('#ff6a4a')); c.rect(0, 40, 64, 24, [0, 0, 0, 0]); c.rect(0, 40, 64, 4, hex('#3a2a5a')); c.star(12, 12, WHITE, 2); c.star(50, 18, WHITE, 1); break;
    case 'time_night': c.ellipse(30, 32, 16, 16, hex('#f4f1c8')); c.ellipse(38, 28, 14, 14, [0, 0, 0, 0]); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { if (Math.hypot(x - 38, y - 28) < 14) c.d[(y * 64 + x) * 4 + 3] = 0; } c.star(48, 14, WHITE, 2); c.star(54, 40, WHITE, 1); c.star(14, 52, WHITE, 1); break;
    case 'stat_luck': for (let k = 0; k < 4; k++) { const a = (k * 90 + 45) / 57.3; c.ellipse(32 + Math.cos(a) * 11, 28 + Math.sin(a) * 11, 9, 9, hex('#3ed16e')); } c.line(32, 28, 38, 58, hex('#2a9a4a'), 3); c.ellipse(32, 28, 3, 3, hex('#b8ffcc')); break;
    case 'stat_power': c.poly([[36, 4], [16, 34], [30, 34], [24, 60], [48, 26], [34, 26]], hex('#ff6a4a')); c.poly([[34, 10], [22, 32], [32, 32]], hex('#ffb0a0')); break;
    case 'stat_speed': for (let i = 0; i < 3; i++) c.poly([[8 + i * 16, 10], [24 + i * 16, 32], [8 + i * 16, 54], [16 + i * 16, 54], [32 + i * 16, 32], [16 + i * 16, 10]], hex(['#ffd23f', '#ffb22b', '#ff8a2b'][i])); break;
    case 'stat_durability': c.poly([[10, 10], [54, 10], [54, 34], [32, 58], [10, 34]], hex('#9aa5b5')); c.poly([[16, 14], [48, 14], [48, 32], [32, 50], [16, 32]], hex('#c8d2dc')); c.rect(28, 20, 8, 20, hex('#5a6578')); c.rect(22, 26, 20, 8, hex('#5a6578')); break;
    case 'stat_detect': c.ellipse(32, 32, 26, 14, WHITE); c.ellipse(32, 32, 12, 12, hex('#8f7aff')); c.ellipse(32, 32, 6, 6, BLACK); c.set(28, 28, WHITE); c.set(29, 28, WHITE); break;
    case 'stat_resist': c.poly([[10, 8], [54, 8], [54, 34], [32, 58], [10, 34]], hex('#3a8fe0')); c.poly([[16, 14], [48, 14], [48, 32], [32, 50], [16, 32]], hex('#7fc0ff')); c.line(32, 16, 32, 44, WHITE, 3); c.line(20, 26, 44, 26, WHITE, 3); break;
    case 'boss': c.ellipse(32, 36, 20, 18, hex('#e8e8e8')); c.rect(20, 46, 24, 10, hex('#e8e8e8')); c.ellipse(24, 34, 5, 6, BLACK); c.ellipse(40, 34, 5, 6, BLACK); c.poly([[32, 38], [29, 44], [35, 44]], BLACK); for (let i = 0; i < 4; i++) c.line(25 + i * 5, 48, 25 + i * 5, 55, BLACK); c.poly([[16, 20], [16, 6], [24, 14], [32, 2], [40, 14], [48, 6], [48, 20]], GOLD); break;
    case 'pet': c.ellipse(32, 42, 14, 12, hex('#e39b52')); [[14, 24], [24, 14], [40, 14], [50, 24]].forEach(([x, y]) => c.ellipse(x, y, 6, 8, hex('#e39b52'))); c.ellipse(32, 42, 6, 5, hex('#ffc9a0')); break;
    case 'market': c.rect(8, 28, 48, 28, hex('#c99358')); for (let i = 0; i < 6; i++) c.rect(8 + i * 8, 12, 8, 16, i % 2 ? WHITE : hex('#e5484d')); c.rect(14, 38, 14, 18, hex('#6d441f')); c.ellipse(44, 42, 6, 6, hex('#ffd23f')); break;
    case 'backpack': c.ellipse(32, 36, 20, 22, hex('#4a7fd6')); c.rect(16, 36, 32, 14, hex('#3a62ad')); c.rect(24, 40, 16, 8, hex('#ffd23f')); c.ring(32, 14, 8, 6, hex('#2f4f8f')); c.line(30, 50, 34, 50, BLACK); break;
    case 'durability': c.line(12, 52, 42, 22, [190, 196, 208, 255], 5); c.poly([[36, 8], [54, 12], [56, 28], [44, 30], [34, 20]], [190, 196, 208, 255]); c.ellipse(46, 18, 4, 4, [0, 0, 0, 0]); c.rect(44, 16, 4, 4, [90, 96, 110, 255]); break;
    default: c.ellipse(32, 32, 16, 16, WHITE);
  }
  c.outline(out); return c;
}
const UI_NAMES = ['coin', 'exp', 'fish', 'rod', 'location', 'mission', 'achievement', 'title', 'weather_nang', 'weather_mua', 'weather_bao', 'weather_suong_mu', 'weather_tuyet', 'weather_cuc_quang',
  'time_dawn', 'time_day', 'time_dusk', 'time_night', 'stat_luck', 'stat_power', 'stat_speed', 'stat_durability', 'stat_detect', 'stat_resist', 'boss', 'pet', 'market', 'backpack', 'durability'];
const FX_NAMES = ['sparkle', 'splash', 'ripple', 'bubbles', 'bite', 'levelup', 'exp_orb', 'shine', 'confetti', 'flame'];
module.exports = { drawPet, drawLocation, drawFrame, drawFx, drawUi, UI_NAMES, FX_NAMES };
