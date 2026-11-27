'use strict';
/**
 * Tài nguyên Pixel Art 128×128 PNG (nền trong suốt) trong /assets.
 *  - Cần câu, vật phẩm, icon UI: NHẬP từ 3 ảnh sprite sheet của chủ dự án (assets-source/*.png)
 *    bằng `python3 scripts/import-art.py` (script này không ghi đè các thư mục đó).
 *  - Cá, mồi, thú cưng, khu vực, khung phẩm cấp, hiệu ứng: vẽ bằng code (scripts/pixel/*).
 * Sau cùng quét toàn bộ assets/ để ghi assets/manifest.json (key emoji → file).
 * Chạy: node scripts/generate-pixel-art.js [--all]   (--all: vẽ lại cả cần/vật phẩm/UI bằng code, bỏ qua ảnh nhập)
 */
const fs = require('fs');
const path = require('path');
const { drawFish } = require('./pixel/fish');
const { drawRod, drawBait, drawItem } = require('./pixel/gear');
const { drawPet, drawLocation, drawFrame, drawFx, drawUi, UI_NAMES, FX_NAMES } = require('./pixel/world');
const { hash } = require('./pixel/lib');

const ROOT = path.join(__dirname, '..');
const A = (...p) => path.join(ROOT, 'assets', ...p);
const D = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', n), 'utf8'));
const ALL = process.argv.includes('--all');
const imported = (n) => !ALL && fs.existsSync(path.join(ROOT, 'assets-source', `${n}.png`));

// sheet2.png (bảng ảnh do chủ dự án cung cấp) thay thế mồi, thú, khu vực, hiệu ứng, khung → chạy scripts/import-sheet2.py
const sheet2 = imported('sheet2');
const regen = ['fish'];
if (!sheet2) regen.push('baits', 'pets', 'locations', 'effects');
if (!imported('rods')) regen.push('rods');
if (!imported('items')) regen.push('items');
if (!imported('ui')) regen.push('ui');
regen.forEach((d) => fs.rmSync(A(d), { recursive: true, force: true }));
const save = (cv, dir, id) => cv.save(A(dir, `${id}.png`), 2);

const fishes = D('fishes.json'); const { rods } = D('rods.json'); const baits = D('baits.json'); const items = D('items.json'); const pets = D('pets.json'); const locs = D('locations.json'); const rar = D('rarities.json');
fishes.forEach((f) => save(drawFish(f.sprite, f.id), 'fish', f.id));
if (!sheet2) baits.forEach((b) => save(drawBait(b.sprite), 'baits', b.id));
if (!sheet2) pets.forEach((p) => { save(drawPet({ ...p.sprite }, 1), 'pets', p.id); save(drawPet({ ...p.sprite }, 2), 'pets', `${p.id}_tienhoa`); });
if (!sheet2) locs.forEach((l) => save(drawLocation(l.scene), 'locations', l.id));
if (!sheet2) { rar.forEach((r) => save(drawFrame(r.id, r.color), 'effects', `khung_${r.key}`)); FX_NAMES.forEach((n) => save(drawFx(n), 'effects', n)); }
if (regen.includes('rods')) rods.forEach((r) => save(drawRod(r.sprite), 'rods', r.id));
if (regen.includes('items')) items.forEach((i) => save(drawItem({ ...i.sprite, id: i.id }), 'items', i.id));
if (regen.includes('ui')) UI_NAMES.forEach((n) => save(drawUi(n), 'ui', n));

/* manifest: tên emoji Discord (2–32 ký tự, [A-Za-z0-9_]) → file. Quét thực tế thư mục assets/. */
const PREFIX = { fish: 'f', rods: 'rod', baits: 'bait', pets: 'pet', items: 'it', locations: 'loc', effects: 'fx', ui: 'ui', arcade: 'ng' };
const manifest = {};
for (const dir of Object.keys(PREFIX)) {
  if (!fs.existsSync(A(dir))) continue;
  for (const f of fs.readdirSync(A(dir)).filter((x) => x.endsWith('.png')).sort()) {
    const id = f.slice(0, -4);
    let key = `${PREFIX[dir]}_${id}`.replace(/[^A-Za-z0-9_]/g, '_');
    if (key.length > 32) key = `${key.slice(0, 27)}_${(hash(key) & 0xffff).toString(16).padStart(4, '0')}`;
    if (manifest[key]) throw new Error(`Trùng tên emoji: ${key}`);
    manifest[key] = `${dir}/${f}`;
  }
}
fs.writeFileSync(A('manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
const count = (d) => (fs.existsSync(A(d)) ? fs.readdirSync(A(d)).filter((f) => f.endsWith('.png')).length : 0);
console.log(`✔ Pixel Art 128×128: cá ${count('fish')} | cần ${count('rods')}${imported('rods') ? ' (nhập)' : ''} | mồi ${count('baits')} | thú ${count('pets')} | vật phẩm ${count('items')}${imported('items') ? ' (nhập)' : ''} | khu vực ${count('locations')} | hiệu ứng ${count('effects')} | UI ${count('ui')}${imported('ui') ? ' (nhập)' : ''}`);
console.log(`  Tổng: ${Object.keys(manifest).length} ảnh → assets/manifest.json`);
