'use strict';
/** Thư viện vẽ Pixel Art thuần Node: canvas 64×64 logic → PNG 128×128 (nearest-neighbor). Không cần dependency. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG encoder ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- Màu ---------- */
function hsl(h, s, l, a = 255) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), a];
}
function hex(s, a = 255) { const n = parseInt(s.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]; }
const shade = (c, f) => [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f)), c[3] === undefined ? 255 : c[3]];
const lighten = (c, t) => [Math.round(c[0] + (255 - c[0]) * t), Math.round(c[1] + (255 - c[1]) * t), Math.round(c[2] + (255 - c[2]) * t), c[3] === undefined ? 255 : c[3]];
const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
const withA = (c, a) => [c[0], c[1], c[2], a];
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* ---------- Canvas ---------- */
class Cv {
  constructor(n = 64) { this.n = n; this.d = new Uint8ClampedArray(n * n * 4); }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (!this.inb(x, y)) return; const i = (y * this.n + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3] === undefined ? 255 : c[3]; }
  blend(x, y, c) { x = Math.round(x); y = Math.round(y); if (!this.inb(x, y)) return; const a = (c[3] === undefined ? 255 : c[3]) / 255; if (a >= 1) return this.set(x, y, c); const i = (y * this.n + x) * 4; const da = this.d[i + 3] / 255; const oa = a + da * (1 - a); if (oa <= 0) return; for (let k = 0; k < 3; k++) this.d[i + k] = (c[k] * a + this.d[i + k] * da * (1 - a)) / oa; this.d[i + 3] = oa * 255; }
  get(x, y) { x = Math.round(x); y = Math.round(y); if (!this.inb(x, y)) return [0, 0, 0, 0]; const i = (y * this.n + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  solid(x, y) { return this.inb(x, y) && this.d[(y * this.n + x) * 4 + 3] > 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  ellipse(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x - cx) / (rx + 0.4), dy = (y - cy) / (ry + 0.4); if (dx * dx + dy * dy <= 1) this.set(x, y, typeof c === 'function' ? c(x, y, dx, dy) : c); } }
  ring(cx, cy, rx, ry, c) { for (let a = 0; a < 360; a += 3) this.set(cx + Math.cos((a * Math.PI) / 180) * rx, cy + Math.sin((a * Math.PI) / 180) * ry, c); }
  line(x0, y0, x1, y1, c, th = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (;;) { for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) this.set(x0 + a - (th >> 1), y0 + b - (th >> 1), c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity; pts.forEach((p) => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = []; const yy = y + 0.5;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  }
  /** Viền 1px quanh các pixel đặc */
  outline(c) {
    const add = [];
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (!this.solid(x, y)) { if (this.solid(x + 1, y) || this.solid(x - 1, y) || this.solid(x, y + 1) || this.solid(x, y - 1)) add.push([x, y]); }
    add.forEach(([x, y]) => this.set(x, y, c));
  }
  /** Hào quang mờ quanh hình */
  aura(c, r = 3) {
    const mask = []; for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) if (this.solid(x, y)) mask.push([x, y]);
    const best = new Map();
    mask.forEach(([mx, my]) => { for (let y = my - r; y <= my + r; y++) for (let x = mx - r; x <= mx + r; x++) { if (!this.inb(x, y) || this.solid(x, y)) continue; const d = Math.hypot(x - mx, y - my); if (d > r) continue; const k = y * this.n + x; if (!best.has(k) || best.get(k) > d) best.set(k, d); } });
    best.forEach((d, k) => { const x = k % this.n, y = (k / this.n) | 0; this.set(x, y, [c[0], c[1], c[2], Math.round((c[3] === undefined ? 160 : c[3]) * (1 - d / (r + 0.5)))]); });
  }
  star(cx, cy, c, r = 2) { this.set(cx, cy, c); for (let i = 1; i <= r; i++) { this.set(cx + i, cy, c); this.set(cx - i, cy, c); this.set(cx, cy + i, c); this.set(cx, cy - i, c); } }
  shadowEllipse(cx, cy, rx, ry, a = 70) { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1 && !this.solid(x, y)) this.set(x, y, [0, 0, 0, a]); } }
  toPNG(scale = 2) {
    const N = this.n * scale; const out = new Uint8ClampedArray(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const sx = (x / scale) | 0, sy = (y / scale) | 0; const i = (sy * this.n + sx) * 4, j = (y * N + x) * 4; out[j] = this.d[i]; out[j + 1] = this.d[i + 1]; out[j + 2] = this.d[i + 2]; out[j + 3] = this.d[i + 3]; }
    return encodePNG(N, N, out);
  }
  save(file, scale = 2) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, this.toPNG(scale)); }
}
module.exports = { Cv, hsl, hex, shade, lighten, mix, withA, hash, rng, encodePNG };
