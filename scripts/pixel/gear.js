'use strict';
/** Cần câu, mồi câu và vật phẩm phụ trợ. */
const { Cv, hsl, hex, shade, lighten, mix, withA, hash, rng } = require('./lib');

const GOLD = [255, 214, 74, 255], WHITE = [255, 255, 255, 255];

/* ---------------------------------------------------------------- CẦN CÂU */
function drawRod(sp) {
  const c = new Cv(64), col = hex(sp.color), t = sp.tier, B = sp.style === 'B';
  const dark = shade(col, 0.62), light = lighten(col, 0.5), out = shade(col, 0.18);
  const leather = B ? hex('#3a2a4a') : hex('#6b4a2b'), leather2 = lighten(leather, 0.3);
  // thân cần
  const hs = [9, 56], he = [23, 42], te = [47, 17];
  c.line(hs[0], hs[1], he[0], he[1], leather, 4);
  for (let i = 0; i < 6; i++) { const x = hs[0] + 2 + i * 2.3, y = hs[1] - 2 - i * 2.3; c.set(x, y - 1, B ? col : leather2); c.set(x + 1, y, B ? col : leather2); }
  c.line(he[0], he[1], te[0], te[1], col, 3); c.line(he[0], he[1] - 1, te[0], te[1] - 1, light, 1);
  c.line(te[0], te[1], 54, 12, dark, 2); c.line(54, 12, 58, 14, dark, 1); c.line(58, 14, 59, 18, dark, 1);
  // vòng đai theo bậc
  for (let i = 0; i < Math.min(5, 1 + Math.floor(t / 2)); i++) { const k = (i + 1) / 6; const x = he[0] + (te[0] - he[0]) * k, y = he[1] + (te[1] - he[1]) * k; c.rect(x - 1, y - 1, 3, 3, B ? GOLD : light); }
  // cuộn dây
  c.ellipse(17, 49, 5, 5, shade([180, 186, 196, 255], B ? 0.9 : 1)); c.ellipse(17, 49, 2, 2, B ? GOLD : [90, 96, 110, 255]); c.line(20, 52, 24, 55, GOLD, 1);
  if (B) { c.line(20, 40, 27, 47, GOLD, 1); c.ring(24, 42, 3, 3, GOLD); c.line(8, 57, 6, 62, GOLD, 1); c.set(6, 63, GOLD); c.set(9, 58, GOLD); }
  // đồ trang trí theo bậc: ngọc
  if (t >= 3) { const gem = lighten(col, 0.2); c.rect(21, 44, 3, 3, B ? [240, 70, 90, 255] : gem); c.set(21, 44, WHITE); }
  // dây câu + lưỡi
  for (let y = 18; y < 40; y++) c.set(59 + Math.round(Math.sin((y - 18) / 6) * 1.2), y, [235, 240, 250, 255]);
  c.line(60, 40, 60, 45, [200, 205, 215, 255]); c.line(60, 45, 57, 47, [200, 205, 215, 255]); c.set(56, 46, [200, 205, 215, 255]); c.set(60, 40, [255, 90, 90, 255]);
  if (t >= 9) { for (let i = 0; i < 4; i++) { const k = (i + 1) / 5; c.set(he[0] + (te[0] - he[0]) * k + 1, he[1] + (te[1] - he[1]) * k + 1, hsl(180 + i * 40, 0.9, 0.7)); } }
  if (t >= 10) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const p = c.get(x, y); if (p[3] && p[0] > 150 && p[1] > 150) c.set(x, y, hsl(x * 8, 0.85, 0.65)); }
  c.outline(out);
  if (t >= 6) c.aura(withA(lighten(col, 0.3), 140), t >= 8 ? 4 : 3);
  if (t >= 8) { c.star(10, 12, WHITE, 2); c.star(52, 52, GOLD, 2); c.star(36, 8, WHITE, 1); }
  if (t >= 10) { c.ring(53, 8, 7, 2.5, GOLD); }
  return c;
}

/* ---------------------------------------------------------------- MỒI CÂU */
function drawBait(sp) {
  const c = new Cv(64); const i = sp.index; const out = [30, 20, 25, 255];
  const hookAt = (x, y) => { c.line(x, y, x, y + 8, [210, 215, 225, 255], 1); c.line(x, y + 8, x - 5, y + 11, [210, 215, 225, 255], 1); c.set(x - 6, y + 10, [210, 215, 225, 255]); };
  switch (i) {
    case 0: for (let k = 0; k < 40; k++) { const x = 12 + k * 0.9, y = 36 + Math.sin(k / 3.2) * 8; c.ellipse(x, y, 3, 3, k % 6 < 1 ? hex('#d98fa0') : hex('#c46b82')); } c.ellipse(48, 28, 3, 3, hex('#e8a5b5')); break;
    case 1: for (let k = 0; k < 9; k++) { const x = 20 + (k % 3) * 11, y = 22 + Math.floor(k / 3) * 11; c.ellipse(x, y, 5, 3.4, [244, 232, 190, 255]); c.line(x - 4, y, x + 4, y, [220, 205, 160, 255]); c.set(x + 4, y - 1, [60, 50, 40, 255]); } break;
    case 2: c.ellipse(32, 36, 17, 14, (x, y, dx, dy) => (dy < -0.4 ? [255, 255, 255, 255] : dy > 0.4 ? [226, 222, 210, 255] : [245, 242, 232, 255])); for (let k = 0; k < 14; k++) c.set(20 + (k * 7) % 25, 26 + (k * 5) % 20, [215, 205, 170, 255]); c.rect(28, 20, 8, 3, [96, 160, 90, 255]); break;
    case 3: for (let a = 0; a < 18; a++) { const x = 14 + a * 2.2, y = 22 + 20 * Math.sin((a / 18) * Math.PI * 0.9); c.ellipse(x, y, 4 - a * 0.1, 3.5 - a * 0.1, a % 3 === 0 ? [255, 160, 110, 255] : [244, 112, 70, 255]); } c.line(52, 24, 58, 16, [255, 190, 140, 255]); c.line(54, 28, 61, 24, [255, 190, 140, 255]); c.set(50, 33, WHITE); break;
    case 4: c.poly([[12, 34], [24, 24], [44, 26], [54, 34], [44, 42], [24, 42]], (x, y) => (y < 31 ? [160, 190, 205, 255] : y > 37 ? [235, 240, 245, 255] : [200, 215, 225, 255])); c.poly([[12, 34], [4, 26], [6, 34], [4, 42]], [150, 175, 195, 255]); c.set(46, 31, WHITE); c.set(47, 31, [20, 20, 30, 255]); hookAt(52, 34); break;
    case 5: c.poly([[10, 34], [24, 24], [46, 26], [56, 34], [46, 42], [24, 42]], (x, y) => ((x + y) % 4 === 0 ? [255, 255, 255, 255] : y < 33 ? [190, 196, 208, 255] : [226, 230, 238, 255])); c.poly([[10, 34], [3, 26], [5, 34], [3, 42]], [150, 156, 170, 255]); c.ellipse(46, 31, 2, 2, [20, 30, 60, 255]); c.set(45, 30, WHITE); hookAt(32, 42); break;
    case 6: c.poly([[10, 34], [24, 22], [46, 24], [56, 34], [46, 44], [24, 44]], (x, y) => (y < 33 ? [150, 255, 140, 255] : [230, 255, 120, 255])); for (let k = 0; k < 5; k++) c.set(20 + k * 6, 30 + (k % 2) * 6, WHITE); c.ellipse(46, 31, 3, 3, [255, 255, 200, 255]); c.aura([200, 255, 120, 200], 5); break;
    case 7: c.poly([[32, 6], [44, 22], [38, 56], [32, 60], [26, 56], [20, 22]], (x, y) => (x < 32 ? [150, 235, 255, 255] : [200, 250, 255, 255])); c.line(32, 8, 32, 58, WHITE); c.line(24, 26, 40, 26, [110, 200, 235, 255]); c.aura([140, 230, 255, 200], 4); c.star(10, 14, WHITE, 2); c.star(54, 40, WHITE, 2); break;
    case 8: for (let k = 0; k < 5; k++) { const ph = k * 1.3; for (let y = 10; y < 56; y++) c.set(16 + k * 7 + Math.sin(y / 5 + ph) * 3, y, k % 2 ? [120, 82, 44, 255] : [90, 150, 70, 255]); } c.ellipse(32, 52, 12, 4, [70, 120, 60, 255]); c.ellipse(32, 18, 4, 3, [255, 200, 90, 255]); break;
    case 9: c.poly([[32, 6], [52, 22], [48, 46], [32, 58], [16, 46], [12, 22]], (x, y) => ((x + y) % 5 === 0 ? [255, 190, 80, 255] : [220, 60, 50, 255])); c.poly([[32, 14], [44, 24], [40, 42], [32, 50], [24, 42], [20, 24]], (x, y) => (y < 34 ? [255, 120, 80, 255] : [200, 40, 40, 255])); c.star(32, 30, GOLD, 3); c.aura([255, 140, 60, 170], 3); break;
    case 10: c.poly([[12, 24], [32, 8], [52, 24], [48, 52], [32, 58], [16, 52]], (x, y) => ((x * 3 + y) % 9 === 0 ? [170, 160, 130, 255] : [190, 178, 140, 255])); [[26, 26], [34, 24], [30, 36], [38, 40]].forEach(([x, y]) => { c.rect(x, y, 2, 4, hsl(170, 0.9, 0.6)); c.rect(x - 1, y + 1, 4, 1, hsl(170, 0.9, 0.6)); }); c.aura([90, 230, 200, 170], 3); break;
    default: c.poly([[32, 4], [50, 20], [56, 38], [32, 60], [8, 38], [14, 20]], (x, y) => hsl(x * 6 + y * 2, 0.8, y < 30 ? 0.78 : 0.62)); c.star(32, 28, WHITE, 5); c.star(14, 12, GOLD, 3); c.star(52, 50, WHITE, 2); c.aura([255, 255, 220, 200], 5); break;
  }
  c.outline(out); return c;
}

/* ---------------------------------------------------------------- VẬT PHẨM */
function facetGem(c, cx, cy, r, col, tier) {
  const L = lighten(col, 0.5), D = shade(col, 0.6);
  c.poly([[cx, cy - r], [cx + r, cy - r * 0.2], [cx + r * 0.6, cy + r], [cx - r * 0.6, cy + r], [cx - r, cy - r * 0.2]], (x, y) => (y < cy - r * 0.2 ? (x < cx ? L : col) : (x < cx ? col : D)));
  c.line(cx, cy - r, cx, cy + r, lighten(col, 0.25)); c.line(cx - r, cy - r * 0.2, cx + r, cy - r * 0.2, lighten(col, 0.25)); c.set(cx - r * 0.4, cy - r * 0.6, WHITE);
}
function drawItem(sp) {
  const c = new Cv(64), out = [25, 20, 30, 255];
  const K = sp.kind;
  if (K === 'material') drawMaterial(c, sp);
  else if (K === 'stone') { const col = [hex('#9fb4c8'), hex('#5fa8ff'), hex('#c36bff')][sp.tier - 1]; c.poly([[16, 38], [26, 18], [44, 14], [52, 32], [42, 50], [22, 52]], (x, y) => (y < 32 ? lighten(col, 0.2) : col)); c.line(26, 18, 36, 34, shade(col, 0.6)); c.line(36, 34, 52, 32, shade(col, 0.6)); c.line(36, 34, 42, 50, shade(col, 0.6)); for (let i = 0; i < sp.tier; i++) c.rect(22 + i * 7, 30, 2, 5, [255, 240, 150, 255]); c.star(46, 20, WHITE, 2); if (sp.tier >= 2) c.aura(withA(col, 160), 3); }
  else if (K === 'charm') { c.rect(20, 8, 24, 46, [250, 232, 170, 255]); c.rect(20, 8, 24, 4, [200, 60, 50, 255]); c.rect(20, 50, 24, 4, [200, 60, 50, 255]); c.line(26, 20, 38, 20, [180, 40, 40, 255], 2); c.line(32, 20, 32, 44, [180, 40, 40, 255], 2); c.line(26, 34, 38, 34, [180, 40, 40, 255], 2); c.set(26, 44, [180, 40, 40, 255]); c.set(38, 44, [180, 40, 40, 255]); c.aura([255, 220, 120, 160], 3); }
  else if (K === 'gem') { const col = hex(sp.color); const r = [10, 14, 18][sp.tier - 1]; facetGem(c, 32, 32, r, col, sp.tier); if (sp.tier >= 2) c.star(48, 14, WHITE, 2); if (sp.tier >= 3) { c.star(14, 46, WHITE, 3); c.aura(withA(col, 200), 4); } }
  else if (K === 'chest') drawChest(c, sp);
  else if (K === 'potion') { const col = hex(sp.color); c.poly([[26, 10], [38, 10], [38, 22], [50, 46], [46, 56], [18, 56], [14, 46], [26, 22]], [210, 230, 240, 190]); c.poly([[22, 36], [42, 36], [50, 46], [46, 56], [18, 56], [14, 46]], col); c.line(20, 38, 44, 38, lighten(col, 0.4)); c.rect(25, 5, 14, 6, hex('#9b6a3a')); c.set(22, 46, WHITE); c.set(23, 47, WHITE); for (let i = 0; i < 4; i++) c.set(26 + i * 4, 44 + (i % 2) * 5, lighten(col, 0.6)); }
  else if (K === 'ticket') { const col = hex(sp.color); c.rect(6, 18, 52, 28, col); c.rect(6, 18, 52, 3, lighten(col, 0.4)); c.rect(6, 43, 52, 3, shade(col, 0.7)); c.ellipse(6, 32, 4, 4, [0, 0, 0, 0]); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { if (Math.hypot(x - 6, y - 32) < 4.5 || Math.hypot(x - 58, y - 32) < 4.5) c.d[(y * 64 + x) * 4 + 3] = 0; } for (let y = 22; y < 42; y += 3) c.set(40, y, shade(col, 0.6)); c.star(24, 32, WHITE, 4); c.star(24, 32, shade(col, 0.5), 2); c.rect(46, 26, 8, 2, shade(col, 0.5)); c.rect(46, 31, 8, 2, shade(col, 0.5)); c.rect(46, 36, 6, 2, shade(col, 0.5)); }
  else if (K === 'float') { const cols = [[hex('#e5484d'), WHITE], [hex('#ffd23f'), hex('#ff7a2b')], [hex('#7df9ff'), hex('#3aa8ff')], [hex('#ff4de1'), hex('#27e8ff')]][[1, 3, 5, 8].indexOf(sp.tier)] || [hex('#e5484d'), WHITE]; c.ellipse(32, 36, 13, 15, (x, y) => (y < 36 ? cols[0] : cols[1])); c.line(32, 6, 32, 22, [230, 230, 240, 255], 2); c.rect(30, 6, 4, 3, cols[0]); c.set(26, 28, WHITE); c.set(27, 27, WHITE); c.line(32, 52, 32, 60, [210, 215, 225, 255]); if (sp.tier >= 5) c.aura(withA(cols[0], 150), 3); }
  else if (K === 'line') { const col = [hex('#c9d4e2'), hex('#e8e8f5'), hex('#ffd23f'), hex('#27e8ff')][[1, 3, 5, 8].indexOf(sp.tier)]; c.ellipse(32, 32, 20, 6, hex('#6b4a2b')); c.rect(12, 20, 40, 5, hex('#8a6035')); c.rect(12, 39, 40, 5, hex('#8a6035')); c.rect(12, 25, 40, 14, col); for (let x = 14; x < 50; x += 3) c.line(x, 25, x, 38, shade(col, 0.8)); c.line(52, 30, 60, 26, col); c.line(60, 26, 61, 20, col); if (sp.tier >= 5) c.aura(withA(col, 140), 3); }
  else if (K === 'hook') { const col = [hex('#aab4c2'), hex('#cfd8e6'), hex('#7df9ff'), hex('#27e8ff')][[1, 3, 5, 8].indexOf(sp.tier)]; c.ring(32, 12, 4, 4, col); c.line(32, 16, 32, 40, col, 3); c.line(32, 40, 26, 52, col, 3); c.line(26, 52, 18, 50, col, 3); c.line(18, 50, 14, 40, col, 2); c.poly([[14, 38], [10, 44], [18, 46]], col); c.set(31, 22, WHITE); if (sp.tier >= 5) c.aura(withA(col, 150), 3); }
  else if (K === 'egg') { const col = [hex('#f2e6c8'), hex('#9ee0ff'), hex('#ffb4f0')][[2, 4, 6].indexOf(sp.tier)] || hex('#f2e6c8'); const sc = [hex('#c9a860'), hex('#3aa8ff'), hex('#ff4de1')][[2, 4, 6].indexOf(sp.tier)] || hex('#c9a860'); c.ellipse(32, 34, 16, 21, (x, y, dx, dy) => (dy < -0.5 ? lighten(col, 0.3) : dy > 0.5 ? shade(col, 0.8) : col)); [[26, 26], [38, 30], [30, 42], [40, 44], [24, 36]].forEach(([x, y]) => c.ellipse(x, y, 2.4, 2.4, sc)); c.set(26, 20, WHITE); c.set(27, 19, WHITE); if (sp.tier >= 4) c.aura(withA(sc, 150), 3); }
  else if (K === 'petfood') { const col = sp.tier >= 3 ? hex('#ffb347') : hex('#d6a35c'); c.poly([[8, 34], [20, 22], [44, 24], [56, 34], [44, 44], [20, 46]], col); c.poly([[8, 34], [2, 26], [4, 34], [2, 42]], shade(col, 0.8)); c.line(20, 28, 44, 28, lighten(col, 0.3)); c.set(46, 31, [40, 30, 20, 255]); for (let i = 0; i < 4; i++) c.set(18 + i * 7, 36, shade(col, 0.7)); if (sp.tier >= 3) c.star(48, 16, GOLD, 2); }
  else if (K === 'bag') { c.ellipse(32, 38, 18, 18, hex('#b98a52')); c.poly([[22, 24], [26, 10], [38, 10], [42, 24]], hex('#a07240')); c.rect(22, 22, 20, 4, hex('#7a5530')); c.rect(28, 32, 8, 12, GOLD); c.rect(26, 36, 12, 4, GOLD); c.set(24, 32, WHITE); }
  else if (K === 'repair') { c.line(14, 50, 40, 24, hex('#8a6035'), 5); c.poly([[36, 12], [52, 12], [54, 22], [44, 28], [38, 24]], [190, 196, 208, 255]); c.rect(42, 14, 6, 4, [90, 96, 110, 255]); c.line(44, 48, 52, 40, [190, 196, 208, 255], 4); c.line(20, 20, 30, 30, [190, 196, 208, 255], 4); c.star(14, 14, GOLD, 2); }
  else if (K === 'ui_blank') { /* empty */ }
  c.outline(out); return c;
}
function drawMaterial(c, sp) {
  const id = sp.id, tier = sp.tier;
  const ingot = (col) => { c.poly([[10, 42], [18, 24], [46, 24], [54, 42]], (x, y) => (y < 30 ? lighten(col, 0.45) : col)); c.rect(10, 42, 44, 8, shade(col, 0.7)); c.line(18, 24, 46, 24, WHITE); c.set(24, 30, WHITE); c.set(25, 29, WHITE); };
  switch (id) {
    case 'vay_ca': c.poly([[10, 36], [32, 12], [54, 36], [32, 54]], (x, y) => ((x + y) % 6 === 0 ? [255, 255, 255, 255] : y < 33 ? hex('#8fd3e8') : hex('#5fb2d0'))); c.line(32, 14, 32, 52, hex('#3f8fb0')); c.line(14, 34, 50, 34, hex('#3f8fb0')); c.line(20, 22, 44, 46, hex('#3f8fb0')); break;
    case 'go_soi': c.rect(8, 22, 44, 22, hex('#8b5a2b')); c.rect(8, 22, 44, 5, hex('#a8733d')); c.ellipse(52, 33, 5, 11, hex('#c99358')); c.ring(52, 33, 3, 7, hex('#8b5a2b')); c.ring(52, 33, 1, 3, hex('#8b5a2b')); for (let x = 12; x < 48; x += 7) c.line(x, 28, x + 3, 40, hex('#6d441f')); break;
    case 'phoi_dong': ingot(hex('#c87a3d')); break;
    case 'thoi_bac': ingot(hex('#c7ccd4')); break;
    case 'thoi_vang': ingot(hex('#ffd23f')); c.aura([255, 220, 100, 150], 3); break;
    case 'tinh_the_bang': c.poly([[32, 4], [42, 26], [38, 58], [26, 58], [22, 26]], (x) => (x < 32 ? hex('#b8f0ff') : hex('#7cd6f0'))); c.poly([[14, 30], [20, 18], [24, 44], [16, 48]], hex('#9be4f7')); c.poly([[46, 34], [52, 24], [54, 46], [46, 50]], hex('#6cc8e6')); c.line(32, 6, 32, 56, WHITE); c.aura([150, 230, 255, 170], 3); break;
    case 're_co_thu': for (let k = 0; k < 3; k++) { c.line(32, 8, 12 + k * 20, 56, hex('#6d441f'), 4); c.line(32, 8, 16 + k * 16, 40, hex('#8b5a2b'), 2); } c.ellipse(32, 14, 8, 5, hex('#4f9a4a')); c.ellipse(26, 11, 4, 3, hex('#7ccf6a')); break;
    case 'manh_kim_cuong': facetGem(c, 32, 30, 20, hex('#7df9ff'), 3); c.star(50, 12, WHITE, 3); c.aura([140, 250, 255, 170], 3); break;
    case 'ngoc_trai': c.poly([[8, 38], [14, 22], [32, 16], [50, 22], [56, 38], [48, 54], [16, 54]], hex('#d9c3d9')); for (let x = 14; x < 54; x += 5) c.line(32, 16, x, 54, hex('#b89cb8')); c.ellipse(32, 34, 9, 9, (x, y, dx, dy) => (dx + dy < -0.3 ? WHITE : [236, 232, 246, 255])); c.set(29, 31, WHITE); c.aura([255, 240, 255, 150], 3); break;
    case 'loi_su_thi': c.ellipse(32, 32, 18, 18, (x, y, dx, dy) => hsl(285, 0.7, 0.5 - (dx + dy) * 0.12)); c.ring(32, 32, 14, 14, hex('#e0a8ff')); c.ellipse(32, 32, 7, 7, hex('#f3d6ff')); c.star(32, 32, WHITE, 4); c.aura([190, 90, 240, 190], 4); break;
    case 'da_vuc': c.poly([[8, 40], [16, 16], [36, 8], [54, 24], [50, 50], [24, 54]], hex('#2a2f4a')); c.line(20, 20, 34, 34, hex('#5c6cff'), 2); c.line(34, 34, 44, 28, hex('#5c6cff'), 1); c.line(34, 34, 30, 48, hex('#5c6cff'), 2); c.aura([100, 120, 255, 170], 3); break;
    case 'vay_rong': c.poly([[8, 40], [20, 12], [44, 12], [56, 40], [32, 58]], (x, y) => (y < 34 ? hex('#ff6a4a') : hex('#d83a2f'))); for (let y = 20; y < 52; y += 8) c.line(14 + (y - 20) / 3, y, 50 - (y - 20) / 3, y, hex('#ffd23f')); c.line(32, 12, 32, 56, hex('#ffd23f')); c.aura([255, 150, 80, 190], 3); break;
    case 'tinh_hoa_than_thoai': c.ellipse(32, 32, 17, 17, (x, y, dx, dy) => hsl(5, 0.85, 0.48 - (dx + dy) * 0.15)); for (let a = 0; a < 360; a += 30) c.line(32, 32, 32 + Math.cos(a / 57) * 24, 32 + Math.sin(a / 57) * 24, [255, 150, 120, 150]); c.ellipse(32, 32, 7, 7, hex('#ffd9c8')); c.aura([255, 90, 70, 200], 4); break;
    case 'manh_co_dai': c.poly([[10, 22], [38, 8], [54, 30], [44, 56], [14, 50]], hex('#b3a37a')); c.poly([[10, 22], [38, 8], [34, 28], [14, 36]], hex('#c9ba90')); [[22, 26], [34, 34], [26, 44]].forEach(([x, y]) => { c.rect(x, y, 2, 5, hsl(170, 0.9, 0.55)); c.rect(x - 1, y + 2, 4, 1, hsl(170, 0.9, 0.55)); }); c.aura([90, 230, 200, 160], 3); break;
    case 'tinh_hoa_than_cap': c.ellipse(32, 32, 16, 16, (x, y, dx, dy) => hsl(185, 0.9, 0.7 - (dx + dy) * 0.12)); c.ring(32, 32, 22, 8, GOLD); c.ring(32, 32, 8, 22, GOLD); c.ellipse(32, 32, 6, 6, WHITE); c.star(10, 10, WHITE, 3); c.star(54, 52, GOLD, 3); c.aura([120, 250, 255, 220], 5); break;
    default: ingot(hex('#aaaaaa'));
  }
}
function drawChest(c, sp) {
  const col = hex(sp.color), t = sp.tier, dk = shade(col, 0.55), lt = lighten(col, 0.45), wood = [hex('#8b5a2b'), hex('#7a7f8c'), hex('#b8892b'), hex('#4fb6c4'), hex('#8a2a2a')][[1, 3, 4, 5, 8].indexOf(t)] || hex('#8b5a2b');
  c.rect(8, 28, 48, 26, wood); c.rect(8, 28, 48, 4, lighten(wood, 0.3));
  c.poly([[8, 28], [12, 12], [52, 12], [56, 28]], lighten(wood, 0.15)); c.line(12, 12, 52, 12, lighten(wood, 0.5));
  c.rect(8, 26, 48, 4, col); c.rect(8, 50, 48, 4, col); c.rect(14, 12, 4, 42, col); c.rect(46, 12, 4, 42, col);
  c.rect(28, 28, 8, 10, lt); c.rect(30, 31, 4, 5, dk); c.set(31, 33, [10, 10, 10, 255]);
  for (let i = 0; i < 4; i++) c.set(10 + i * 14, 30, WHITE);
  if (t >= 4) c.aura(withA(col, 170), 4);
  if (t >= 5) { c.star(32, 6, WHITE, 3); c.star(8, 14, GOLD, 2); c.star(56, 16, GOLD, 2); }
  if (t >= 8) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const p = c.get(x, y); if (p[3] === 255 && p[0] > 200 && p[1] < 120) { /* giữ */ } }
}
module.exports = { drawRod, drawBait, drawItem };
