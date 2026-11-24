'use strict';
const crypto = require('crypto');
/** RNG phía máy chủ (crypto) – người chơi không thể đoán. Có thể thay bằng RNG có seed khi kiểm thử. */
let source = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32;
const setRng = (fn) => { source = fn || (() => crypto.randomInt(0, 2 ** 32) / 2 ** 32); };
const rand = () => source();
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));
const randRange = (a, b) => a + rand() * (b - a);
const chance = (p) => rand() < p;
function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Chọn ngẫu nhiên theo trọng số. Trả undefined nếu tổng trọng số = 0. */
function pickWeighted(list, weightFn, rnd = rand) {
  let total = 0; const ws = list.map((x) => { const w = Math.max(0, weightFn(x)); total += w; return w; });
  if (total <= 0) return undefined;
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}
const shuffle = (arr, rnd = rand) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const token = (n = 6) => crypto.randomBytes(n).toString('base64url').slice(0, n);
module.exports = { rand, randInt, randRange, chance, pickWeighted, shuffle, mulberry32, hashStr, setRng, token };
