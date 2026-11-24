'use strict';
/** Vẽ cá Pixel Art theo "kiểu thân" (F,R,L,T,S,A,D,W,K) + họa tiết + hiệu ứng theo phẩm cấp. */
const { Cv, hsl, shade, lighten, mix, withA, hash, rng } = require('./lib');

function palette(sp) {
  const s = sp.sat / 100, h = sp.hue, L = sp.dark ? 0.34 : 0.5;
  return {
    base: hsl(h, s, L), dark: hsl(h, s, L - 0.15), deep: hsl(h, s * 0.9, L - 0.27), light: hsl(h, s * 0.6, L + 0.2),
    belly: sp.dark ? hsl(h + 20, s * 0.5, 0.58) : hsl(h + 18, s * 0.35, 0.87), fin: hsl(h + 28, Math.min(1, s * 1.1), sp.dark ? 0.42 : 0.46), fin2: hsl(h + 28, s, 0.66),
    accent: hsl(h + 180, 0.9, 0.62), gold: [255, 214, 74, 255], out: hsl(h, s * 0.7, 0.09),
  };
}

function shadeBody(P, sp, x, y, yc, th, t, rnd) {
  const r = (y - yc) / Math.max(th, 1);
  let col = r < -0.5 ? P.dark : r > 0.3 ? P.belly : P.base;
  if (r < -0.8) col = P.deep;
  if (r > -0.55 && r < -0.35) col = P.light;
  switch (sp.pattern) {
    case 'stripes': if (Math.floor((x + 2) / 4) % 2 === 0 && r < 0.5) col = r < -0.5 ? P.deep : P.dark; break;
    case 'spots': if (hash(`${x},${y},${sp.hue}`) % 17 === 0 && r < 0.6) col = P.deep; break;
    case 'belly': if (r > -0.15) col = P.belly; break;
    case 'dorsal': if (r < -0.1) col = r < -0.55 ? P.deep : P.dark; break;
    case 'scales': if ((x + y * 2) % 4 === 0 && r < 0.35) col = P.light; break;
    default:
  }
  return col;
}
function columns(c, P, sp, rnd, x0, x1, thFn, yFn) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0), th = thFn(t), yc = yFn(t);
    for (let y = Math.round(yc - th); y <= Math.round(yc + th); y++) c.set(x, y, shadeBody(P, sp, x, y, yc, th, t, rnd));
  }
}
const eye = (c, x, y, P, big = false) => { if (big) { c.rect(x - 1, y - 1, 3, 3, [255, 255, 255, 255]); c.set(x + 1, y, [15, 15, 25, 255]); c.set(x + 1, y - 1, [15, 15, 25, 255]); } else { c.set(x, y, [255, 255, 255, 255]); c.set(x + 1, y, [15, 15, 25, 255]); c.set(x + 1, y + 1, [15, 15, 25, 255]); c.set(x, y + 1, [255, 255, 255, 255]); } };
const finLines = (c, pts, col) => pts.forEach(([a, b, d, e]) => c.line(a, b, d, e, col));

const BODIES = {
  F(c, P, sp, rnd) {
    const x0 = 13, x1 = 51, th = (t) => 9.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), 0.8) + 0.4, yc = 32;
    c.poly([[x0 + 2, 32], [x0 - 9, 22], [x0 - 5, 32], [x0 - 9, 42]], P.fin); finLines(c, [[x0 + 1, 32, x0 - 8, 24], [x0 + 1, 32, x0 - 8, 40]], P.fin2);
    c.poly([[x0 + 12, yc - th(0.3)], [x0 + 17, yc - th(0.3) - 9], [x0 + 27, yc - th(0.55)]], P.fin);
    c.poly([[x0 + 15, yc + th(0.4)], [x0 + 12, yc + th(0.4) + 7], [x0 + 22, yc + th(0.5)]], P.fin);
    columns(c, P, sp, rnd, x0, x1, th, () => yc);
    c.poly([[x1 - 14, 33], [x1 - 22, 40], [x1 - 13, 38]], P.fin2);
    c.line(x1 - 11, 27, x1 - 10, 37, P.dark); eye(c, x1 - 6, 29, P); c.set(x1, 33, P.deep);
    return { x: x1 - 7, y: yc - th(0.9) };
  },
  R(c, P, sp, rnd) {
    const x0 = 17, x1 = 47, th = (t) => 13 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))) + 0.4, yc = 33;
    c.poly([[x0 + 1, 33], [x0 - 7, 26], [x0 - 4, 33], [x0 - 7, 40]], P.fin);
    c.poly([[x0 + 9, yc - 12], [x0 + 14, yc - 18], [x0 + 20, yc - 12]], P.fin);
    columns(c, P, sp, rnd, x0, x1, th, () => yc);
    c.poly([[32, 36], [27, 44], [37, 40]], P.fin2);
    eye(c, x1 - 8, 29, P, true); c.set(x1 - 1, 35, P.deep); c.set(x1 - 2, 36, P.deep);
    return { x: x1 - 9, y: yc - 12 };
  },
  L(c, P, sp, rnd) {
    const ph = (hash(String(sp.hue)) % 6) / 6, x0 = 5, x1 = 56, yFn = (t) => 34 + 6 * Math.sin(t * Math.PI * 2.3 + ph * 6), th = (t) => 2.4 + 2.4 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)), 0.6);
    for (let x = x0 + 4; x <= x1 - 6; x++) { const t = (x - x0) / (x1 - x0); if (t > 0.12 && t < 0.92) { c.set(x, Math.round(yFn(t) - th(t) - 1), P.fin); if (x % 2) c.set(x, Math.round(yFn(t) - th(t) - 2), P.fin2); } }
    columns(c, P, sp, rnd, x0, x1, th, yFn);
    const y1 = yFn(1);
    c.poly([[x1 - 5, y1 + 1], [x1 - 11, y1 + 8], [x1 - 9, y1 + 1]], P.fin2);
    eye(c, x1 - 5, Math.round(y1 - 2), P); c.line(x1, Math.round(y1 + 1), x1 - 3, Math.round(y1 + 2), P.deep);
    return { x: x1 - 5, y: y1 - 5 };
  },
  T(c, P, sp, rnd) {
    c.line(14, 32, 3, 38, P.dark, 2); c.line(14, 32, 4, 30, P.deep, 1);
    c.ellipse(34, 33, 23, 13, (x, y, dx, dy) => (dy < -0.5 ? P.dark : dy > 0.35 ? P.belly : (sp.pattern === 'spots' && hash(`${x}${y}`) % 15 === 0 ? P.deep : (sp.pattern === 'stripes' && Math.floor(x / 4) % 2 === 0 ? P.dark : P.base))));
    c.poly([[12, 33], [30, 15], [34, 27]], (x, y) => ((x + y) % 5 === 0 ? P.light : P.base));
    c.poly([[12, 33], [30, 51], [34, 39]], P.dark);
    c.poly([[56, 33], [44, 24], [44, 42]], P.base);
    eye(c, 46, 29, P, true); eye(c, 46, 38, P, true); c.set(51, 33, P.deep); c.set(52, 33, P.deep);
    return { x: 45, y: 22 };
  },
  S(c, P, sp, rnd) {
    const x0 = 9, x1 = 57, th = (t) => 8.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.15)), 0.75) + 0.4, yc = 33;
    c.poly([[x0 + 3, 32], [x0 - 7, 15], [x0 - 2, 31]], P.dark); c.poly([[x0 + 3, 34], [x0 - 5, 44], [x0 - 1, 34]], P.fin);
    c.poly([[x0 + 20, yc - th(0.45)], [x0 + 28, yc - th(0.45) - 13], [x0 + 32, yc - th(0.55)]], P.dark);
    c.poly([[x0 + 16, yc - th(0.4)], [x0 + 19, yc - th(0.4) - 4], [x0 + 22, yc - th(0.45)]], P.dark);
    columns(c, P, { ...sp, pattern: sp.pattern === 'plain' ? 'dorsal' : sp.pattern }, rnd, x0, x1, th, () => yc);
    c.poly([[x1 - 16, 38], [x1 - 27, 48], [x1 - 13, 41]], P.fin);
    for (let i = 0; i < 3; i++) c.line(x1 - 14 + i * 2, 29, x1 - 15 + i * 2, 35, P.deep);
    eye(c, x1 - 6, 30, P); c.line(x1 - 2, 36, x1 - 9, 36, P.deep); for (let i = 0; i < 3; i++) c.set(x1 - 3 - i * 2, 37, [255, 255, 255, 255]);
    return { x: x1 - 8, y: yc - th(0.9) };
  },
  A(c, P, sp, rnd) {
    c.poly([[18, 33], [8, 25], [11, 34], [8, 43]], P.fin);
    c.ellipse(30, 35, 16, 14, (x, y, dx, dy) => (dy < -0.4 ? P.deep : dy > 0.45 ? P.dark : P.base));
    for (let i = 0; i < 9; i++) c.set(18 + Math.floor(rnd() * 24), 24 + Math.floor(rnd() * 18), P.light);
    c.poly([[34, 46], [47, 40], [46, 50], [38, 52]], P.dark); c.line(36, 42, 47, 40, P.deep, 1);
    for (let i = 0; i < 5; i++) { c.poly([[37 + i * 2, 41 - (i % 2)], [38 + i * 2, 45], [39 + i * 2, 41 - (i % 2)]], [255, 255, 240, 255]); }
    for (let i = 0; i < 3; i++) c.poly([[38 + i * 3, 46], [39 + i * 3, 43], [40 + i * 3, 46]], [255, 255, 240, 255]);
    eye(c, 39, 29, P, true);
    c.line(34, 22, 38, 12, P.deep); c.line(38, 12, 47, 11, P.deep); c.line(47, 11, 49, 14, P.deep);
    c.ellipse(49, 16, 2.6, 2.6, [255, 240, 120, 255]); c.set(49, 15, [255, 255, 255, 255]);
    c.poly([[26, 20], [30, 12], [33, 21]], P.fin);
    return { x: 38, y: 23 };
  },
  D(c, P, sp, rnd) {
    const x0 = 4, x1 = 52, yFn = (t) => 33 + 9 * Math.sin(t * Math.PI * 2.1 + 0.5), th = (t) => 2 + 4.3 * Math.pow(t, 0.8);
    for (let x = x0 + 2; x <= x1 - 8; x += 3) { const t = (x - x0) / (x1 - x0); const y = yFn(t) - th(t); c.poly([[x, y], [x + 1, y - 5], [x + 3, y]], P.fin); }
    columns(c, P, { ...sp, pattern: sp.pattern === 'plain' ? 'scales' : sp.pattern }, rnd, x0, x1, th, yFn);
    for (let x = x0 + 4; x < x1 - 6; x += 2) { const t = (x - x0) / (x1 - x0); c.set(x, Math.round(yFn(t) + th(t) - 1), P.gold); }
    const hy = yFn(1);
    c.ellipse(x1 + 2, hy, 8, 5.5, (x, y, dx, dy) => (dy < -0.3 ? P.base : dy > 0.4 ? P.belly : P.light));
    c.poly([[x1 + 6, hy + 3], [x1 + 11, hy + 7], [x1 + 3, hy + 6]], P.dark);
    c.line(x1 + 4, hy - 7, x1 - 3, hy - 14, P.accent, 2); c.line(x1 + 7, hy - 6, x1 + 4, hy - 14, P.accent, 2);
    c.line(x1 + 9, hy + 1, x1 + 12, hy + 7, P.gold); c.line(x1 + 9, hy, x1 + 12, hy - 4, P.gold);
    eye(c, x1 + 2, Math.round(hy - 2), P, true); c.set(x1 + 3, Math.round(hy - 2), P.accent);
    c.poly([[x0 + 3, yFn(0) + 1], [x0 - 3, yFn(0) + 8], [x0 + 2, yFn(0) + 2]], P.fin2);
    return { x: x1, y: hy - 6 };
  },
  W(c, P, sp, rnd) {
    const x0 = 8, x1 = 57, th = (t) => 12.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.1)), 0.7) + 0.5, yc = 35;
    c.poly([[x0 + 5, 33], [x0 - 4, 22], [x0 + 3, 19], [x0 + 7, 28]], P.dark); c.poly([[x0 + 7, 34], [x0 + 1, 24], [x0 + 12, 31]], P.fin);
    columns(c, P, { ...sp, pattern: sp.pattern === 'plain' ? 'dorsal' : sp.pattern }, rnd, x0, x1, th, () => yc);
    for (let i = 0; i < 5; i++) c.line(x1 - 10 - i * 4, 40, x1 - 11 - i * 4, 46, P.light);
    c.poly([[x1 - 22, 40], [x1 - 30, 50], [x1 - 17, 45]], P.fin);
    eye(c, x1 - 9, 34, P); c.line(x1, 38, x1 - 12, 41, P.deep);
    c.set(x1 - 12, 22, [190, 230, 255, 255]); c.set(x1 - 13, 19, [190, 230, 255, 255]); c.set(x1 - 11, 18, [190, 230, 255, 255]); c.set(x1 - 15, 20, [190, 230, 255, 255]);
    return { x: x1 - 10, y: yc - 11 };
  },
  K(c, P, sp, rnd) {
    for (let i = 0; i < 7; i++) {
      const bx = 17 + i * 5, ph = i * 0.9;
      for (let y = 30; y <= 59; y++) { const wob = Math.sin((y - 30) / 4.5 + ph) * (2 + (y - 30) / 12); const x = bx + wob; c.set(x, y, (y % 6 === 0 && i % 2) ? P.light : (i % 2 ? P.dark : P.base)); if (y < 52) c.set(x + 1, y, i % 2 ? P.dark : P.base); if ((y - 30) % 7 === 3) c.set(x + 2, y, P.belly); }
    }
    c.ellipse(32, 22, 15, 13, (x, y, dx, dy) => (dy < -0.45 ? P.deep : dy > 0.5 ? P.dark : (sp.pattern === 'spots' && hash(`${x}${y}`) % 9 === 0 ? P.light : P.base)));
    c.poly([[22, 12], [32, 3], [42, 12]], (x, y) => (y < 8 ? P.deep : P.dark));
    eye(c, 26, 24, P, true); eye(c, 36, 24, P, true); c.set(27, 25, P.accent); c.set(37, 25, P.accent);
    c.line(30, 31, 34, 31, P.deep);
    return { x: 32, y: 8 };
  },
};

function applyPrism(c, outline) {
  for (let y = 0; y < c.n; y++) for (let x = 0; x < c.n; x++) {
    const px = c.get(x, y); if (px[3] === 0) continue;
    const lum = (px[0] * 0.3 + px[1] * 0.59 + px[2] * 0.11) / 255; if (lum < 0.1) continue;
    const col = hsl(x * 7 + y * 3, 0.85, 0.3 + lum * 0.45); c.set(x, y, col);
  }
}

function drawFish(sp, key) {
  const c = new Cv(64); const P = palette(sp); const rnd = rng(hash(key));
  const body = BODIES[sp.body](c, P, sp, rnd);
  const f = sp.features || [];
  if (sp.dark) for (let i = 0; i < 6; i++) { const x = 16 + Math.floor(rnd() * 32), y = 26 + Math.floor(rnd() * 14); if (c.solid(x, y)) c.set(x, y, P.accent); }
  if (f.includes('prism')) applyPrism(c);
  if (f.includes('runes')) { const gl = hsl(sp.hue + 150, 0.9, 0.7); [[26, 33], [31, 31], [36, 34]].forEach(([x, y]) => { if (c.solid(x, y)) { c.set(x, y, gl); c.set(x, y + 1, gl); c.set(x + 1, y + 1, gl); } }); }
  if (f.includes('horn')) { const hc = lighten(P.base, 0.55); c.poly([[body.x - 2, body.y + 2], [body.x - 4, body.y - 6], [body.x + 1, body.y]], hc); c.poly([[body.x + 2, body.y + 1], [body.x + 6, body.y - 6], [body.x + 5, body.y + 1]], hc); }
  if (f.includes('crown')) { const g = P.gold; c.poly([[body.x - 4, body.y - 5], [body.x - 4, body.y - 10], [body.x - 2, body.y - 7], [body.x, body.y - 11], [body.x + 2, body.y - 7], [body.x + 4, body.y - 10], [body.x + 4, body.y - 5]], g); c.set(body.x, body.y - 8, [230, 60, 60, 255]); }
  c.outline(P.out);
  if (f.includes('glow')) c.aura(withA(lighten(P.base, 0.35), 150), f.includes('prism') ? 4 : 3);
  if (f.includes('halo')) { c.ring(body.x, body.y - 12, 8, 2.5, P.gold); c.ring(body.x, body.y - 12, 7, 2, lighten(P.gold, 0.5)); }
  if (f.includes('sparkle')) { const w = [255, 255, 255, 255], g = P.gold; c.star(7, 9, w, 2); c.star(57, 8, g, 3); c.star(55, 55, w, 2); c.star(8, 53, g, 1); }
  return c;
}
module.exports = { drawFish };
