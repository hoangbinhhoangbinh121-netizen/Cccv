'use strict';
/** Vẽ toàn bộ emoji Pixel Art Ngư Trường → assets/arcade/*.png (128×128) và thêm khoá `ng_*` vào assets/manifest.json. */
const fs = require('fs');
const path = require('path');
const cat = require('./pixel/arcade-catalog');
const { draw } = require('./pixel/arcade');
if (fs.existsSync(path.join(__dirname, '..', 'assets-source', 'sheet3.png')) && !process.argv.includes('--force')) { console.log('assets/arcade đã dùng bản vẽ từ assets-source/sheet3.png (scripts/import-sheet3.py). Chạy lại với --force để vẽ lại toàn bộ bằng code (ghi đè), sau đó chạy import-sheet3.py nếu muốn dùng lại bản vẽ mới.'); process.exit(0); }
const out = path.join(__dirname, '..', 'assets', 'arcade'); fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith('.png')) fs.unlinkSync(path.join(out, f));
for (const x of cat) draw(x.id).save(path.join(out, `${x.id}.png`), 2);
const mf = path.join(__dirname, '..', 'assets', 'manifest.json'); const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const k of Object.keys(m)) if (k.startsWith('ng_')) delete m[k];
for (const x of cat) m[`ng_${x.id}`] = `arcade/${x.id}.png`;
fs.writeFileSync(mf, `${JSON.stringify(m, null, 1)}\n`);
require('./pixel/arcade-catalog'); // đảm bảo catalog hợp lệ
console.log(`✔ ${cat.length} emoji Ngư Trường → assets/arcade · manifest ${Object.keys(m).length} khoá`);
