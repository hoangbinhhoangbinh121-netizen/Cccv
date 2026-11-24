'use strict';
/** Kiểm tra tài nguyên: mọi cá/cần/mồi/thú/vật phẩm/khu vực đều có PNG 128×128 RGBA, manifest khớp, tên emoji hợp lệ. Chạy: npm run validate */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..'); const A = (...p) => path.join(ROOT, 'assets', ...p); const D = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', n), 'utf8'));
const errors = []; const err = (m) => errors.push(m);
function png(file) { const b = fs.readFileSync(file); if (b.readUInt32BE(0) !== 0x89504e47) return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], color: b[25], bytes: b.length }; }
const need = (dir, ids) => { for (const id of ids) { const f = A(dir, `${id}.png`); if (!fs.existsSync(f)) { err(`Thiếu ảnh ${dir}/${id}.png`); continue; } const p = png(f); if (!p) err(`${dir}/${id}.png không phải PNG`); else if (p.w !== 128 || p.h !== 128) err(`${dir}/${id}.png kích thước ${p.w}×${p.h} (cần 128×128)`); else if (p.color !== 6) err(`${dir}/${id}.png không có kênh alpha (RGBA)`); else if (p.bytes > 256 * 1024) err(`${dir}/${id}.png quá nặng cho emoji Discord (${p.bytes}B > 256KB)`); } };
const fishes = D('fishes.json'); const rods = D('rods.json').rods; const baits = D('baits.json'); const items = D('items.json'); const pets = D('pets.json'); const locs = D('locations.json'); const rar = D('rarities.json');
need('fish', fishes.map((f) => f.id)); need('rods', rods.map((r) => r.id)); need('baits', baits.map((b) => b.id)); need('items', items.map((i) => i.id)); need('locations', locs.map((l) => l.id));
need('pets', pets.flatMap((p) => [p.id, `${p.id}_tienhoa`])); need('effects', rar.map((r) => `khung_${r.key}`)); need('ui', ['coin', 'exp', 'durability', 'fish', 'rod', 'backpack', 'boss', 'market', 'mission', 'achievement', 'pet', 'location', 'title', 'stat_luck', 'stat_power', 'stat_speed', 'stat_detect', 'stat_resist', 'stat_durability', 'weather_nang', 'weather_mua', 'weather_bao', 'weather_suong_mu', 'weather_tuyet', 'weather_cuc_quang', 'time_dawn', 'time_day', 'time_dusk', 'time_night']);
need('effects', ['bite', 'splash', 'sparkle', 'levelup']);
const man = JSON.parse(fs.readFileSync(A('manifest.json'), 'utf8')); const keys = Object.keys(man); const seen = new Set();
for (const [k, rel] of Object.entries(man)) { if (!/^[A-Za-z0-9_]{2,32}$/.test(k)) err(`Tên emoji không hợp lệ: ${k}`); if (seen.has(k.toLowerCase())) err(`Tên emoji trùng (không phân biệt hoa/thường): ${k}`); seen.add(k.toLowerCase()); if (!fs.existsSync(A(rel))) err(`manifest trỏ tới tệp không có: ${rel}`); }
let total = 0; for (const d of fs.readdirSync(A(''), { withFileTypes: true }).filter((x) => x.isDirectory())) total += fs.readdirSync(A(d.name)).filter((f) => f.endsWith('.png')).length;
if (total !== keys.length) err(`Số PNG (${total}) khác số mục manifest (${keys.length})`);
if (keys.length > 2000) err('Vượt giới hạn 2000 application emoji của Discord');
console.log(`Ảnh: ${total} · manifest: ${keys.length} mục · giới hạn Discord: 2000`);
if (errors.length) { errors.slice(0, 40).forEach((e) => console.log('✖', e)); console.log(`\n${errors.length} lỗi`); process.exit(1); }
console.log('✔ Tài nguyên hợp lệ (128×128 RGBA, tên emoji hợp lệ, manifest khớp).');
