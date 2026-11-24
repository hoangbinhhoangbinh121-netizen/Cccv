'use strict';
/**
 * Sinh toàn bộ bộ dữ liệu game vào /data (fishes, rods, locations, baits, pets, items, recipes,
 * bosses, missions, achievements, events, rarities).
 * Chạy: node scripts/generate-data.js
 * Có thể chỉnh sửa trực tiếp các file JSON sau khi sinh; bot đọc JSON khi khởi động (/fishing-admin reload-data).
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'data');
fs.mkdirSync(OUT, { recursive: true });

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const write = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1) + '\n');

/* ------------------------------------------------------------------ RARITIES */
const RARITIES = [
  { id: 1, key: 'pho_thong', name: 'Phổ Thông', color: '#9AA0A6', weight: 100, priceMult: 1, expMult: 1, effect: 'Không', frame: 'Khung Gỗ Mộc', mark: '▫' },
  { id: 2, key: 'hiem', name: 'Hiếm', color: '#4CAF50', weight: 40, priceMult: 2.4, expMult: 1.6, effect: 'Ánh Lục', frame: 'Khung Đồng Xanh', mark: '◈' },
  { id: 3, key: 'quy_hiem', name: 'Quý Hiếm', color: '#2196F3', weight: 16, priceMult: 6, expMult: 2.6, effect: 'Lấp Lánh', frame: 'Khung Bạc Lam', mark: '◆' },
  { id: 4, key: 'su_thi', name: 'Sử Thi', color: '#B04CE0', weight: 6, priceMult: 15, expMult: 4.2, effect: 'Hào Quang Tím', frame: 'Khung Tử Tinh', mark: '✦' },
  { id: 5, key: 'huyen_thoai', name: 'Huyền Thoại', color: '#FF9800', weight: 2.2, priceMult: 38, expMult: 7, effect: 'Ngọn Lửa Vàng', frame: 'Khung Kim Hoàng', mark: '✹' },
  { id: 6, key: 'than_thoai', name: 'Thần Thoại', color: '#F0443C', weight: 0.8, priceMult: 95, expMult: 12, effect: 'Huyết Quang', frame: 'Khung Xích Long', mark: '❂' },
  { id: 7, key: 'co_dai', name: 'Cổ Đại', color: '#C9A24A', weight: 0.3, priceMult: 240, expMult: 20, effect: 'Phù Văn Cổ', frame: 'Khung Cổ Ngọc', mark: '❖' },
  { id: 8, key: 'than_cap', name: 'Thần Cấp', color: '#27E8FF', weight: 0.09, priceMult: 600, expMult: 35, effect: 'Thánh Quang', frame: 'Khung Thiên Quang', mark: '✺' },
  { id: 9, key: 'doc_nhat', name: 'Độc Nhất', color: '#FF4DE1', weight: 0.008, priceMult: 1600, expMult: 60, effect: 'Cầu Vồng Vĩnh Hằng', frame: 'Khung Vĩnh Hằng', mark: '✪' },
];
write('rarities.json', RARITIES);
const RAR = (id) => RARITIES[id - 1];

/* ------------------------------------------------------------------ LOCATIONS */
const LOCS = [
  { id: 'ao_lang', name: 'Ao Làng', rarity: 1, cat: 'nuoc_ngot', level: 1, tier: 1, cost: 0, rec: 1, scale: 0.35, scene: 'pond',
    weather: { nang: 50, mua: 30, suong_mu: 15, bao: 5 }, desc: 'Ao nhỏ yên bình đầu làng, nơi mọi cần thủ bắt đầu hành trình.' },
  { id: 'ho_thanh_binh', name: 'Hồ Thanh Bình', rarity: 2, cat: 'nuoc_ngot', level: 5, tier: 1, cost: 500, rec: 5, scale: 0.5, scene: 'lake',
    weather: { nang: 45, mua: 25, suong_mu: 25, bao: 5 }, desc: 'Mặt hồ phẳng lặng soi bóng núi xanh, ẩn chứa nhiều loài cá hiếm.' },
  { id: 'song_bang', name: 'Sông Băng', rarity: 3, cat: 'vung_bang', level: 12, tier: 2, cost: 3000, rec: 12, scale: 0.65, scene: 'glacier',
    weather: { tuyet: 50, nang: 20, suong_mu: 15, cuc_quang: 10, bao: 5 }, desc: 'Dòng sông đóng băng quanh năm, cá nơi đây có vảy lấp lánh như pha lê.' },
  { id: 'rung_nguyen_sinh', name: 'Rừng Nguyên Sinh', rarity: 4, cat: 'nuoc_ngot', level: 20, tier: 3, cost: 15000, rec: 20, scale: 0.8, scene: 'forest',
    weather: { mua: 35, suong_mu: 30, nang: 25, bao: 10 }, desc: 'Dòng suối cổ thụ giữa rừng già, linh khí nuôi dưỡng những loài cá sử thi.' },
  { id: 'bien_sau', name: 'Biển Sâu', rarity: 5, cat: 'nuoc_man', level: 30, tier: 4, cost: 60000, rec: 30, scale: 1, scene: 'ocean',
    weather: { nang: 35, mua: 25, bao: 25, suong_mu: 15 }, desc: 'Đại dương mênh mông, nơi ngự trị những truyền thuyết của biển cả.' },
  { id: 'vuc_tham', name: 'Vực Thẳm', rarity: 6, cat: 'bien_sau', level: 40, tier: 5, cost: 200000, rec: 40, scale: 1, scene: 'abyss',
    weather: { suong_mu: 40, bao: 30, cuc_quang: 15, mua: 15 }, desc: 'Vực sâu không ánh sáng, mỗi con cá là một sinh vật thần thoại.' },
  { id: 'long_hai', name: 'Long Hải', rarity: 7, cat: 'nuoc_man', level: 52, tier: 6, cost: 700000, rec: 52, scale: 1, scene: 'dragon',
    weather: { bao: 30, mua: 25, nang: 20, cuc_quang: 25 }, desc: 'Biển rồng thiêng, di tích của những chủ nhân biển cả thời cổ đại.' },
  { id: 'hai_vuc_co_dai', name: 'Hải Vực Cổ Đại', rarity: 8, cat: 'bien_sau', level: 65, tier: 7, cost: 2000000, rec: 65, scale: 1, scene: 'ancient',
    weather: { cuc_quang: 35, bao: 30, suong_mu: 25, mua: 10 }, desc: 'Phế tích dưới đáy biển nơi ngủ yên sinh vật độc nhất của thế giới.' },
];

/* ------------------------------------------------------------------ FISH */
const FISH_NAMES = {
  ao_lang: ['Cá Rô Phi|F', 'Cá Diếc|F', 'Cá Bống|R', 'Cá Chạch|L', 'Cá Chép|F', 'Cá Trê|L', 'Cá Rô Đồng|F', 'Cá Mè|F', 'Cá Trắm Cỏ|F', 'Cá Lóc Bông|L', 'Cá Chép Vàng|F'],
  ho_thanh_binh: ['Cá Sặc Rằn|R', 'Cá Thát Lát|L', 'Cá Hường|R', 'Cá Mè Hoa|F', 'Cá Trôi|F', 'Cá Lăng|L', 'Cá Chiên|L', 'Cá Anh Vũ|F', 'Cá Hô|R', 'Cá Chình Hồ|L', 'Cá Ngọc Hồ|F'],
  song_bang: ['Cá Hồi Tuyết|F', 'Cá Tuyết Bắc|F', 'Cá Bơn Băng|T', 'Cá Chày Băng|F', 'Cá Hồi Vân|F', 'Cá Đuối Băng|T', 'Cá Hồi Bạc|F', 'Cá Nhám Sương|S', 'Cá Cầu Gai Băng|R', 'Cá Kiếm Băng|F', 'Cá Rồng Băng|D'],
  rung_nguyen_sinh: ['Cá Rêu Xanh|F', 'Cá Lá Cây|T', 'Cá Suối Đá|R', 'Cá Nấm Đỏ|R', 'Cá Hổ Rừng|F', 'Cá Lục Bảo|F', 'Cá Dạ Quang|A', 'Cá Rễ Cổ Thụ|L', 'Cá Trăng Rừng|R', 'Tinh Linh Rừng|D', 'Cá Chúa Rừng|S'],
  bien_sau: ['Cá Ngừ Đại Dương|F', 'Cá Thu Vàng|F', 'Cá Mú Đỏ|R', 'Cá Chim Biển|R', 'Cá Kiếm Xanh|F', 'Cá Mập Xanh|S', 'Cá Đuối Quỷ|T', 'Cá Buồm|F', 'Cá Ngừ Vây Xanh|W', 'Cá Mập Trắng Khổng Lồ|S', 'Cá Voi Lưng Gù|W'],
  vuc_tham: ['Cá Lồng Đèn|A', 'Cá Rắn Biển Sâu|L', 'Cá Túi Nuốt|R', 'Cá Mắt Ống|F', 'Cá Câu Quỷ|A', 'Cá Rồng Vực|D', 'Mực Ma|K', 'Cá Đuối Bóng|T', 'Nhện Biển Sâu|K', 'Quỷ Vực Thẳm|A', 'Kraken Con|K'],
  long_hai: ['Cá Long Lân|F', 'Cá Vảy Ngọc|F', 'Cá Châu Long|R', 'Cá Thanh Long|L', 'Cá Hải Long|D', 'Cá Rồng Lửa|D', 'Cá Rồng Sấm|D', 'Cá Ngao Long|S', 'Cá Long Tu|L', 'Long Vương Biển|D', 'Hải Chủ Long Cung|W'],
  hai_vuc_co_dai: ['Cá Phổi Cổ|F', 'Cá Vây Tay Cổ|F', 'Cá Giáp Cổ|T', 'Cá Hóa Thạch|R', 'Cá Răng Kiếm Cổ|S', 'Mực Cổ Đại|K', 'Cổ Long|D', 'Cá Thần Hải|W', 'Cá Rồng Thần|D', 'Leviathan Vĩnh Hằng|W', 'Hải Vương Thiên Tông|D'],
};
const WEIGHT_RANGE = { F: [0.4, 5], R: [0.3, 3.5], L: [0.8, 8], T: [2, 30], S: [25, 300], A: [1.5, 25], D: [10, 200], W: [150, 2500], K: [4, 60] };
const BASE_HUE = { ao_lang: 95, ho_thanh_binh: 165, song_bang: 200, rung_nguyen_sinh: 120, bien_sau: 215, vuc_tham: 275, long_hai: 15, hai_vuc_co_dai: 45 };
const PATTERNS = ['plain', 'stripes', 'spots', 'belly', 'dorsal', 'scales'];
const TIME_SETS = [['dawn', 'day', 'dusk', 'night'], ['dawn', 'day', 'dusk', 'night'], ['dawn', 'day', 'dusk', 'night'], ['night', 'dusk'], ['dawn', 'day'], ['dawn', 'dusk']];
const WEATHERS = ['nang', 'mua', 'bao', 'suong_mu', 'tuyet', 'cuc_quang'];

// Giá bán dựa trên giá trị mục tiêu theo phẩm cấp & khu vực (không phụ thuộc cỡ cá), phân bổ theo cân nặng trung bình.
const targetValue = (li, rarity, mult = 1) => 40 * RAR(rarity).priceMult * (1 + li * 0.6) * mult;
const ppk = (li, rarity, minW, maxW, h, mult = 1) => Math.max(1, Math.round(targetValue(li, rarity, mult) * (0.85 + (h % 30) / 100) / ((minW + maxW) / 2)));
const fishes = [];
const usedIds = new Set();
function addFish(o) { let id = slug(o.name); while (usedIds.has(id)) id += '_2'; usedIds.add(id); fishes.push({ id, ...o }); return id; }

LOCS.forEach((loc, li) => {
  const names = FISH_NAMES[loc.id];
  names.forEach((raw, idx) => {
    const [name, body] = raw.split('|');
    const h = hash(loc.id + name);
    let rarity = idx <= 3 ? loc.rarity - 1 : idx <= 8 ? loc.rarity : loc.rarity + 1;
    rarity = clamp(rarity, 1, 9);
    const rar = RAR(rarity);
    const [w0, w1] = WEIGHT_RANGE[body];
    const sc = loc.scale * (1 + (rarity - 1) * 0.22);
    const minW = r2(Math.max(0.05, w0 * sc * (0.8 + (h % 40) / 100)));
    const maxW = r2(Math.max(minW * 2.2, w1 * sc * (0.85 + ((h >> 8) % 40) / 100)));
    let category = loc.cat;
    if (rarity === 9) category = 'sinh_vat_doc_nhat';
    else if (rarity === 8 || (rarity === 6) || (rarity >= 6 && 'DWK'.includes(body))) category = 'sinh_vat_than_thoai';
    else if (rarity === 7) category = 'co_dai';
    else if (rarity === 5) category = 'huyen_thoai';
    const times = TIME_SETS[h % TIME_SETS.length];
    const weatherPref = (h >> 4) % 3 === 0 ? [Object.keys(loc.weather)[(h >> 6) % Object.keys(loc.weather).length]] : [];
    const feat = [];
    if (rarity >= 4) feat.push('glow');
    if (rarity >= 5) feat.push('sparkle');
    if (rarity >= 6) feat.push('horn');
    if (rarity >= 7) feat.push('runes');
    if (rarity >= 8) feat.push('halo');
    if (rarity >= 9) feat.push('prism');
    const hue = (BASE_HUE[loc.id] + ((h >> 3) % 70) - 35 + 360) % 360;
    addFish({
      name, rarity, category, location: loc.id, minWeight: minW, maxWeight: maxW,
      pricePerKg: ppk(li, rarity, minW, maxW, h),
      exp: Math.round(10 * rar.expMult * (1 + li * 0.35)),
      difficulty: clamp(8 + rarity * 10 + (h % 9), 5, 100),
      spawnWeight: r2(0.7 + (h % 60) / 100),
      times, weatherPref, bossOnly: false, event: null,
      sprite: { body, hue, sat: clamp(55 + (h % 30) - (rarity >= 8 ? 10 : 0), 30, 90), pattern: PATTERNS[(h >> 2) % PATTERNS.length], features: feat, dark: times.length === 2 && times[0] === 'night' },
      desc: `${rar.name} • sống ở ${loc.name}.`,
    });
  });
});

/* Bosses */
const BOSSES = [
  { loc: 'ao_lang', name: 'Lão Trê Ao Làng', trophy: 'Trê Ông Ngàn Năm', body: 'L', hp: 6000, regen: 0, armor: 0, stance: 25, level: 5 },
  { loc: 'ho_thanh_binh', name: 'Hồ Thần Chép Vàng', trophy: 'Chép Thần Hồ Xanh', body: 'F', hp: 14000, regen: 1, armor: 0, stance: 24, level: 12 },
  { loc: 'song_bang', name: 'Cự Kình Sông Băng', trophy: 'Kình Ngư Băng Hà', body: 'W', hp: 30000, regen: 0, armor: 15, stance: 22, level: 20 },
  { loc: 'rung_nguyen_sinh', name: 'Thủy Quái Cổ Thụ', trophy: 'Rồng Rễ Nghìn Năm', body: 'D', hp: 60000, regen: 2, armor: 0, stance: 22, level: 30 },
  { loc: 'bien_sau', name: 'Đại Mập Đại Dương', trophy: 'Mập Vương Biển Cả', body: 'S', hp: 110000, regen: 0, armor: 20, stance: 20, level: 40 },
  { loc: 'vuc_tham', name: 'Ma Mực Vực Thẳm', trophy: 'Mực Quỷ Hắc Ám', body: 'K', hp: 190000, regen: 1, armor: 10, stance: 15, level: 50 },
  { loc: 'long_hai', name: 'Thanh Long Hải Chủ', trophy: 'Châu Long Chí Tôn', body: 'D', hp: 320000, regen: 2, armor: 15, stance: 18, level: 60 },
  { loc: 'hai_vuc_co_dai', name: 'Thái Cổ Leviathan', trophy: 'Tâm Leviathan', body: 'W', hp: 520000, regen: 2, armor: 20, stance: 14, level: 75 },
];
const bosses = BOSSES.map((b, i) => {
  const loc = LOCS[i];
  const rarity = clamp(loc.rarity + 2, 1, 9);
  const rar = RAR(rarity);
  const h = hash(b.trophy);
  const trophyId = addFish({
    name: b.trophy, rarity, category: rarity === 9 ? 'sinh_vat_doc_nhat' : 'sinh_vat_than_thoai', location: loc.id,
    minWeight: r2(WEIGHT_RANGE[b.body][1] * loc.scale * 1.2), maxWeight: r2(WEIGHT_RANGE[b.body][1] * loc.scale * 1.8),
    pricePerKg: ppk(i, rarity, WEIGHT_RANGE[b.body][1] * loc.scale * 1.2, WEIGHT_RANGE[b.body][1] * loc.scale * 1.8, h, 4), exp: Math.round(40 * rar.expMult * (1 + i * 0.4)), difficulty: 100,
    spawnWeight: 0, times: ['dawn', 'day', 'dusk', 'night'], weatherPref: [], bossOnly: true, event: null,
    sprite: { body: b.body, hue: (BASE_HUE[loc.id] + 180) % 360, sat: 80, pattern: PATTERNS[h % 6], features: ['glow', 'sparkle', 'horn', 'halo', 'crown'], dark: false },
    desc: `Chiến lợi phẩm khi hạ ${b.name}.`,
  });
  return {
    id: 'boss_' + slug(b.name), name: b.name, location: loc.id, level: b.level, rarity, hp: b.hp, durationMin: 40,
    regenPctPerMin: b.regen, armorPct: b.armor, stanceSeconds: b.stance, trophyFish: trophyId,
    rewards: { xu: Math.round(b.hp * 0.9), exp: Math.round(b.hp * 0.05), chest: ['ruong_go', 'ruong_bac', 'ruong_vang', 'ruong_vang', 'ruong_kim_cuong', 'ruong_kim_cuong', 'ruong_than_thoai', 'ruong_than_thoai'][i] },
    desc: `Boss khu vực ${loc.name}. Mọi người cùng hợp sức để hạ gục!`,
  };
});

/* Event-limited fish */
const EVENT_FISH = [
  { name: 'Cá Chép Hóa Rồng', event: 'le_hoi_tet', rarity: 6, body: 'D', hue: 8 },
  { name: 'Cá Đèn Lồng Đỏ', event: 'le_hoi_den_long', rarity: 5, body: 'A', hue: 20 },
  { name: 'Cá Trăng Rằm', event: 'su_kien_gioi_han', rarity: 5, body: 'R', hue: 52 },
  { name: 'Cá Pháo Hoa', event: 'le_hoi_phao_hoa', rarity: 6, body: 'F', hue: 330 },
];
EVENT_FISH.forEach((e, i) => {
  const rar = RAR(e.rarity); const h = hash(e.name);
  addFish({
    name: e.name, rarity: e.rarity, category: 'su_kien', location: 'event', minWeight: 2, maxWeight: 40, pricePerKg: ppk(3, e.rarity, 2, 40, h),
    exp: Math.round(25 * rar.expMult), difficulty: 60 + e.rarity * 4, spawnWeight: 1, times: ['dawn', 'day', 'dusk', 'night'], weatherPref: [], bossOnly: false, event: e.event,
    sprite: { body: e.body, hue: e.hue, sat: 85, pattern: PATTERNS[h % 6], features: ['glow', 'sparkle', 'horn'], dark: false }, desc: 'Cá giới hạn theo sự kiện.',
  });
});
write('fishes.json', fishes);

/* ------------------------------------------------------------------ RODS */
const TIERS = [
  { id: 1, name: 'Gỗ', color: '#8B5A2B', mat: 'go_soi' }, { id: 2, name: 'Đồng', color: '#B87333', mat: 'phoi_dong' },
  { id: 3, name: 'Bạc', color: '#C7CCD4', mat: 'thoi_bac' }, { id: 4, name: 'Vàng', color: '#FFD23F', mat: 'thoi_vang' },
  { id: 5, name: 'Kim Cương', color: '#7DF9FF', mat: 'manh_kim_cuong' }, { id: 6, name: 'Sử Thi', color: '#B04CE0', mat: 'loi_su_thi' },
  { id: 7, name: 'Huyền Thoại', color: '#FF9800', mat: 'vay_rong' }, { id: 8, name: 'Thần Thoại', color: '#F0443C', mat: 'tinh_hoa_than_thoai' },
  { id: 9, name: 'Cổ Đại', color: '#C9A24A', mat: 'manh_co_dai' }, { id: 10, name: 'Thần Cấp', color: '#27E8FF', mat: 'tinh_hoa_than_cap' },
];
const ROD_NAMES = [
  ['Cần Gỗ Sồi', 'Cần Tre Xanh'], ['Cần Đồng Cổ', 'Cần Hoa Đào'], ['Cần Thép Lam', 'Cần Ngân Vân'], ['Cần Hoàng Kim', 'Cần Hỏa Kim'],
  ['Cần Băng Tinh', 'Cần Lục Bảo'], ['Cần Tử Diễm', 'Cần Hắc Tử'], ['Cần Thiên Sứ', 'Cần Tinh Tú'], ['Cần Xích Diễm', 'Cần Xích Long'],
  ['Cần Hắc Long', 'Cần Kim Quang Cổ'], ['Cần Thủy Thần', 'Cần Thiên Tông'],
];
const INNATES = [
  { id: 'lucky_cast', name: 'Vận May', desc: 'Tăng tỷ lệ cá hiếm' }, { id: 'swift_bite', name: 'Dụ Cá Nhanh', desc: 'Giảm thời gian chờ cá cắn' },
  { id: 'sturdy', name: 'Kiên Cố', desc: 'Giảm hao mòn độ bền' }, { id: 'bountiful', name: 'Bội Thu', desc: 'Tăng cân nặng cá' },
  { id: 'gold_touch', name: 'Chạm Vàng', desc: 'Tăng giá bán cá' }, { id: 'exp_flow', name: 'Dòng Tri Thức', desc: 'Tăng EXP nhận được' },
  { id: 'steady_line', name: 'Dây Vững', desc: 'Giảm căng dây khi kéo cá' },
];
const rods = [];
TIERS.forEach((t, ti) => {
  [0, 1].forEach((v) => {
    const k = t.id - 1; const A = v === 0;
    const power = 12 + 10 * k, luck = 5 + 6 * k, reel = 8 + 5 * k, detect = 3 + 5 * k, resist = 5 + 4 * k, dura = 60 + 25 * k;
    const innate = t.id >= 3 ? INNATES[(t.id * 2 + v + (t.id > 5 ? 1 : 0)) % INNATES.length] : null;
    rods.push({
      id: `rod_t${t.id}_${A ? 'a' : 'b'}`, name: ROD_NAMES[ti][v], tier: t.id, tierName: t.name, variant: A ? 'A' : 'B',
      stats: {
        luck: Math.round(luck * (A ? 1.25 : 0.85)), power: Math.round(power * (A ? 0.92 : 1.2)), reel: Math.round(reel * (A ? 1.1 : 0.95)),
        durability: Math.round(dura * (A ? 0.95 : 1.15)), detect: Math.round(detect * (A ? 1.25 : 0.85)), resist: Math.round(resist * (A ? 0.9 : 1.25)),
      },
      maxLevel: 20 + 5 * t.id, enhanceCap: Math.min(15, 5 + Math.floor(k * 1.2)), sockets: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4][k],
      innate: innate ? { id: innate.id, base: r2(2 + t.id * 1.5) } : null,
      price: [0, 1500, 9000, 40000, 150000, 0, 0, 0, 0, 0][k], buyable: t.id <= 5 && t.id >= 1 && !(t.id === 1 && v === 1) ? true : (t.id === 1 && v === 1),
      starter: t.id === 1 && v === 0,
      sprite: { style: v === 0 ? 'A' : 'B', tier: t.id, color: t.color },
      desc: `Cần câu ${t.name} (${A ? 'thiên về may mắn & phát hiện' : 'thiên về sức mạnh & độ bền'}).`,
    });
  });
});
// Cần bậc 1 B giá rẻ, các tier >5 không bán trong shop (chế tạo/rớt boss)
rods.find((r) => r.id === 'rod_t1_b').price = 600;
write('rods.json', { tiers: TIERS, innates: INNATES, rods });

/* ------------------------------------------------------------------ LOCATIONS JSON */
const locOut = LOCS.map((l, i) => ({
  id: l.id, name: l.name, order: i + 1, rarity: l.rarity, category: l.cat, scene: l.scene, desc: l.desc,
  unlock: { level: l.level, rodTier: l.tier, cost: l.cost }, recommendedLevel: l.rec,
  weather: l.weather,
  timeBands: { dawn: 1.0, day: 1.0, dusk: 1.0, night: i >= 5 ? 1.25 : 1.0 },
  resources: [
    { item: ['vay_ca', 'phoi_dong', 'tinh_the_bang', 're_co_thu', 'ngoc_trai', 'da_vuc', 'vay_rong', 'manh_co_dai'][i], chance: 0.1 },
    { item: ['go_soi', 'go_soi', 'thoi_bac', 'thoi_vang', 'manh_kim_cuong', 'loi_su_thi', 'tinh_hoa_than_thoai', 'tinh_hoa_than_cap'][i], chance: i === 7 ? 0.03 : 0.045 },
  ],
  boss: bosses[i].id,
  baseBiteSeconds: [8, 9, 10, 11, 12, 13, 14, 15][i],
  fishCount: fishes.filter((f) => f.location === l.id).length,
}));
write('locations.json', locOut);

/* ------------------------------------------------------------------ BAITS */
const BAIT_DEFS = [
  ['Giun Đất', 5, 0, 0, 0, null], ['Giòi Bọ', 8, 12, 0, 0, null], ['Bột Gạo Thơm', 12, 8, 0, 25, 'nuoc_ngot'],
  ['Tôm Nhỏ', 30, 8, 3, 25, 'nuoc_man'], ['Cá Mồi Nhỏ', 60, 6, 5, 20, 'nuoc_man'], ['Mồi Giả Bạc', 150, 10, 10, 0, null],
  ['Mồi Phát Quang', 400, 10, 14, 30, 'bien_sau'], ['Mồi Băng Tinh', 600, 8, 14, 35, 'vung_bang'], ['Mồi Rễ Cổ Thụ', 900, 8, 18, 30, 'nuoc_ngot'],
  ['Mồi Long Lân', 3000, 12, 28, 0, 'sinh_vat_than_thoai'], ['Mồi Thái Cổ', 8000, 12, 34, 0, 'co_dai'], ['Mồi Thần Cấp', 30000, 15, 45, 0, null],
];
const baits = BAIT_DEFS.map(([name, price, biteSpeed, rareBonus, catBonus, cat], i) => ({
  id: 'moi_' + slug(name), name, type: 'bait', tier: i + 1, price, sell: Math.max(1, Math.floor(price * 0.3)),
  stats: { biteSpeed, rareBonus, categoryBonus: catBonus, category: cat },
  shop: i < 9, sprite: { kind: 'bait', index: i }, desc: `Mồi câu: nhanh cá cắn +${biteSpeed}%, tỷ lệ cá hiếm +${rareBonus}%${cat ? `, +${catBonus}% cá ${cat}` : ''}.`,
}));
write('baits.json', baits);

/* ------------------------------------------------------------------ ITEMS */
const items = [];
const addItem = (o) => items.push({ stack: 999, sell: Math.max(1, Math.floor((o.price || 10) * 0.35)), ...o });
const MATS = [
  ['Vảy Cá', 1, 20], ['Gỗ Sồi', 1, 25], ['Phôi Đồng', 2, 80], ['Thỏi Bạc', 3, 260], ['Tinh Thể Băng', 3, 300], ['Thỏi Vàng', 4, 800], ['Rễ Cổ Thụ', 4, 900],
  ['Mảnh Kim Cương', 5, 2600], ['Ngọc Trai', 5, 3000], ['Lõi Sử Thi', 6, 7000], ['Đá Vực', 6, 8000], ['Vảy Rồng', 7, 20000], ['Tinh Hoa Thần Thoại', 8, 55000],
  ['Mảnh Cổ Đại', 9, 150000], ['Tinh Hoa Thần Cấp', 10, 400000],
];
MATS.forEach(([name, tier, price]) => addItem({ id: slug(name), name, type: 'material', tier, price, sprite: { kind: 'material', tier, id: slug(name) }, desc: `Nguyên liệu bậc ${tier}.` }));
[['Đá Cường Hóa Sơ', 1, 120, 'cuong_hoa'], ['Đá Cường Hóa Trung', 2, 900, 'cuong_hoa'], ['Đá Cường Hóa Cao', 3, 7000, 'cuong_hoa']].forEach(([name, tier, price, kind]) =>
  addItem({ id: slug(name), name, type: 'stone', tier, price, sprite: { kind: 'stone', tier }, desc: `Dùng để cường hóa cần câu (${tier === 1 ? '+1~+5' : tier === 2 ? '+6~+10' : '+11~+15'}).` }));
addItem({ id: 'bua_bao_ho', name: 'Bùa Bảo Hộ', type: 'stone', tier: 2, price: 1500, sprite: { kind: 'charm' }, desc: 'Giữ nguyên cấp cường hóa khi thất bại (tự dùng nếu bật).' });
const GEMS = [['may_man', 'May Mắn', 'luck', 6, '#3ED16E'], ['suc_manh', 'Sức Mạnh', 'power', 8, '#E8483C'], ['toc_do', 'Tốc Độ', 'reel', 5, '#FFD23F'],
  ['ben_bi', 'Bền Bỉ', 'durability', 14, '#B07A4A'], ['mat_than', 'Mắt Thần', 'detect', 5, '#B04CE0'], ['chong_thoat', 'Chống Thoát', 'resist', 4, '#3AA8FF']];
GEMS.forEach(([k, name, stat, val, color]) => [1, 2, 3].forEach((t) => addItem({
  id: `ngoc_${k}_${t}`, name: `Ngọc ${name} ${['Sơ', 'Trung', 'Cao'][t - 1]}`, type: 'gem', tier: t, price: [300, 2500, 20000][t - 1],
  gem: { stat, value: val * [1, 2.4, 5.5][t - 1] }, sprite: { kind: 'gem', tier: t, color }, desc: `Khảm vào cần câu: +${Math.round(val * [1, 2.4, 5.5][t - 1])} ${stat}.`,
})));
[['Rương Gỗ', 1, 400, '#8B5A2B'], ['Rương Bạc', 3, 3000, '#C7CCD4'], ['Rương Vàng', 4, 12000, '#FFD23F'], ['Rương Kim Cương', 5, 60000, '#7DF9FF'], ['Rương Thần Thoại', 8, 250000, '#F0443C']]
  .forEach(([name, tier, price, color]) => addItem({ id: slug(name), name, type: 'chest', tier, price, shop: tier <= 4, sprite: { kind: 'chest', tier, color }, desc: `Rương kho báu bậc ${tier}, mở bằng /sudung.` }));
[['Bình May Mắn', 'luck', 30, 600], ['Bình Phát Hiện', 'detect', 30, 600], ['Bình Tốc Độ', 'biteSpeed', 25, 500], ['Bình Kinh Nghiệm', 'expMult', 50, 900],
  ['Bình Bền Dây', 'resist', 30, 600], ['Bình Sức Mạnh', 'power', 30, 600]].forEach(([name, stat, val, price], i) => addItem({
  id: slug(name), name, type: 'potion', tier: 2, price, shop: true, potion: { stat, value: val, minutes: 30 },
  sprite: { kind: 'potion', color: ['#3ED16E', '#B04CE0', '#FFD23F', '#3AA8FF', '#B07A4A', '#E8483C'][i] }, desc: `Hiệu lực 30 phút: +${val}% ${stat}.`,
}));
[['Vé Đại Hội', 'ticket', 've_dai_hoi'], ['Vé Sự Kiện', 'ticket', 've_su_kien'], ['Vé Lễ Hội', 'ticket', 've_le_hoi']].forEach(([name, , id], i) =>
  addItem({ id, name, type: 'ticket', tier: 3, price: [1500, 800, 800][i], shop: true, sprite: { kind: 'ticket', color: ['#FFD23F', '#3AA8FF', '#FF6FB5'][i] }, desc: 'Dùng để tham gia sự kiện.' }));
[['Phao Nứa', 1, 150, 4, 0], ['Phao Phát Sáng', 3, 3000, 8, 6], ['Phao Ngọc', 5, 35000, 14, 12], ['Phao Thần', 8, 400000, 22, 20]].forEach(([name, tier, price, bite, detect]) =>
  addItem({ id: slug(name), name, type: 'float', tier, price, shop: tier <= 5, float: { biteSpeed: bite, detect }, sprite: { kind: 'float', tier }, desc: `Phao: cá cắn nhanh +${bite}%, phát hiện +${detect}.` }));
[['Dây Cước', 1, 150, 4, 5], ['Dây Tơ Bạc', 3, 3000, 9, 12], ['Dây Kim Tuyến', 5, 35000, 15, 20], ['Dây Long Gân', 8, 400000, 24, 32]].forEach(([name, tier, price, resist, save]) =>
  addItem({ id: slug(name), name, type: 'line', tier, price, shop: tier <= 5, line: { resist, durabilitySave: save }, sprite: { kind: 'line', tier }, desc: `Dây: chống cá thoát +${resist}%, giảm hao mòn ${save}%.` }));
[['Lưỡi Sắt', 1, 150, 3, 0], ['Lưỡi Thép', 3, 3000, 8, 4], ['Lưỡi Kim Cương', 5, 35000, 15, 8], ['Lưỡi Thiên Tông', 8, 400000, 24, 14]].forEach(([name, tier, price, power, luck]) =>
  addItem({ id: slug(name), name, type: 'hook', tier, price, shop: tier <= 5, hook: { power, luck }, sprite: { kind: 'hook', tier }, desc: `Lưỡi: sức mạnh +${power}, may mắn +${luck}.` }));
[['Trứng Thú Thường', 2, 3000, 'trung_thu_thuong', [1, 2, 3]], ['Trứng Thú Quý', 4, 25000, 'trung_thu_quy', [3, 4, 5]], ['Trứng Thú Thần', 6, 150000, 'trung_thu_than', [5, 6, 7, 8]]].forEach(([name, tier, price, id, pool]) =>
  addItem({ id, name, type: 'egg', tier, price, shop: tier <= 4, egg: { pool }, sprite: { kind: 'egg', tier }, desc: 'Ấp nở ngẫu nhiên một thú cưng.' }));
addItem({ id: 'thuc_an_thu', name: 'Thức Ăn Thú Cưng', type: 'petfood', tier: 1, price: 150, shop: true, petExp: 80, sprite: { kind: 'petfood', tier: 1 }, desc: 'Cho thú cưng ăn: +80 EXP, +2 thân thiết.' });
addItem({ id: 'thuc_an_thu_cao', name: 'Thức Ăn Thú Cao Cấp', type: 'petfood', tier: 3, price: 1400, shop: true, petExp: 600, sprite: { kind: 'petfood', tier: 3 }, desc: 'Cho thú cưng ăn: +600 EXP, +8 thân thiết.' });
addItem({ id: 'phu_mo_rong_kho', name: 'Phù Mở Rộng Kho', type: 'misc', tier: 3, price: 8000, shop: true, expand: 20, sprite: { kind: 'bag' }, desc: 'Dùng để mở rộng kho thêm 20 ô.' });
addItem({ id: 'phu_sua_can', name: 'Phù Sửa Cần', type: 'misc', tier: 2, price: 500, shop: true, repair: 50, sprite: { kind: 'repair' }, desc: 'Dùng để sửa 50 độ bền cho cần câu đang trang bị.' });
write('items.json', items);

/* ------------------------------------------------------------------ PETS */
const PET_DEFS = [
  ['Mèo Câu Cá', 'meo', 'Mèo Mướp Câu Cá', 2, '#E39B52', { luck: 4, bite: 6 }], ['Mèo Câu Cá', 'meo', 'Mèo Hoàng Kim', 5, '#FFD23F', { luck: 10, rare: 6, bite: 10 }],
  ['Cáo Biển', 'cao', 'Cáo Biển Nhỏ', 3, '#E8793A', { rare: 4, weight: 5 }], ['Cáo Biển', 'cao', 'Cáo Biển Cửu Vĩ', 6, '#FF6E4A', { rare: 12, weight: 10, luck: 6 }],
  ['Rái Cá', 'rai', 'Rái Cá Sông', 1, '#9B6B43', { exp: 5, sell: 3 }], ['Rái Cá', 'rai', 'Rái Cá Ngọc', 4, '#58C7B8', { exp: 12, sell: 8, luck: 4 }],
  ['Rùa Cổ Đại', 'rua', 'Rùa Đá', 4, '#7C8B6A', { resist: 8, durability: 10 }], ['Rùa Cổ Đại', 'rua', 'Huyền Vũ Cổ Đại', 7, '#2FB59A', { resist: 18, durability: 22, weight: 8 }],
  ['Hải Long', 'long', 'Hải Long Con', 6, '#3AA8FF', { luck: 8, rare: 8, power: 8 }], ['Hải Long', 'long', 'Hải Long Vương', 8, '#27E8FF', { luck: 16, rare: 16, power: 16, sell: 10 }],
  ['Linh Thú Biển Sâu', 'linh', 'Linh Đăng Biển Sâu', 5, '#B04CE0', { detect: 10, rare: 8 }], ['Linh Thú Biển Sâu', 'linh', 'Linh Thú Vực Thẳm', 9, '#FF4DE1', { detect: 22, rare: 22, luck: 14, exp: 15 }],
];
const SKILLS = [
  { id: 'tham_tinh', name: 'Thám Thính', desc: 'Cá cắn câu nhanh hơn 25%.', effect: { biteSpeed: 25 } },
  { id: 'huong_van', name: 'Hương Vận', desc: 'Tăng 15% tỷ lệ cá hiếm.', effect: { rareBonus: 15 } },
  { id: 'ho_tro_keo', name: 'Hỗ Trợ Kéo', desc: 'Giảm 20% căng dây.', effect: { tensionDown: 20 } },
  { id: 'bat_may', name: 'Bắt May', desc: 'Tăng 20% cân nặng cá.', effect: { weightBonus: 20 } },
  { id: 'dan_loc', name: 'Dẫn Lộc', desc: 'Tăng 20% giá bán cá.', effect: { sellBonus: 20 } },
];
const pets = PET_DEFS.map(([group, g, name, rarity, color, stats], i) => ({
  id: 'thu_' + slug(name), name, group, groupKey: g, rarity, stats, color,
  skill: { ...SKILLS[i % SKILLS.length], chance: 0.15 + rarity * 0.03 },
  innate: { id: ['bam_dinh', 'tinh_nhanh', 'kien_nhan'][i % 3], name: ['Bám Đình', 'Tinh Nhanh', 'Kiên Nhẫn'][i % 3] },
  evolve: { level: 20 + rarity * 2, bond: 40 + rarity * 10, mats: { [TIERS[Math.min(9, rarity)].mat]: 5 + rarity * 2 }, xu: 1000 * rarity * rarity },
  maxLevel: 40 + rarity * 5, skins: ['Mặc Định', 'Tiến Hóa'],
  sprite: { group: g, color, stage: 1, rarity }, desc: `${group} ${RAR(rarity).name} hỗ trợ cần thủ khi câu cá.`,
}));
write('pets.json', pets);

/* ------------------------------------------------------------------ RECIPES */
const recipes = { rods: [], items: [] };
rods.filter((r) => r.tier >= 2).forEach((r) => {
  const t = r.tier;
  const mats = { [TIERS[t - 1].mat]: 4 + t, [TIERS[t - 2].mat]: 5 };
  recipes.rods.push({ id: 'craft_' + r.id, rod: r.id, name: r.name, xu: Math.round(600 * Math.pow(3.1, t - 2)), mats, level: [0, 1, 5, 12, 20, 30, 40, 52, 65, 80][t - 1] });
});
recipes.items.push(
  { id: 'craft_da_trung', name: 'Ghép Đá Cường Hóa Trung', out: { da_cuong_hoa_trung: 1 }, in: { da_cuong_hoa_so: 3 }, xu: 400 },
  { id: 'craft_da_cao', name: 'Ghép Đá Cường Hóa Cao', out: { da_cuong_hoa_cao: 1 }, in: { da_cuong_hoa_trung: 3 }, xu: 3000 },
  { id: 'craft_da_so', name: 'Luyện Đá Cường Hóa Sơ', out: { da_cuong_hoa_so: 2 }, in: { vay_ca: 8, go_soi: 4 }, xu: 100 },
  { id: 'craft_bua', name: 'Chế Bùa Bảo Hộ', out: { bua_bao_ho: 1 }, in: { tinh_the_bang: 3, thoi_bac: 1 }, xu: 800 },
  { id: 'craft_moi_bac', name: 'Chế Mồi Giả Bạc', out: { moi_moi_gia_bac: 10 }, in: { thoi_bac: 1, vay_ca: 5 }, xu: 200 },
  { id: 'craft_moi_long_lan', name: 'Chế Mồi Long Lân', out: { moi_moi_long_lan: 10 }, in: { vay_rong: 2, ngoc_trai: 2 }, xu: 4000 },
  { id: 'craft_trung_quy', name: 'Chế Trứng Thú Quý', out: { trung_thu_quy: 1 }, in: { ngoc_trai: 3, re_co_thu: 3 }, xu: 6000 },
  { id: 'craft_ruong_vang', name: 'Chế Rương Vàng', out: { ruong_vang: 1 }, in: { thoi_vang: 3, thoi_bac: 3 }, xu: 3000 },
);
write('recipes.json', recipes);

/* ------------------------------------------------------------------ MISSIONS */
const missions = {
  daily: [
    { id: 'd_catch', name: 'Câu {target} con cá', on: 'catch', amount: 'count', base: 10, reward: { xu: 250, exp: 100 } },
    { id: 'd_rare', name: 'Câu {target} cá từ Quý Hiếm trở lên', on: 'catch', filter: { minRarity: 3 }, amount: 'count', base: 2, reward: { xu: 500, exp: 200 } },
    { id: 'd_weight', name: 'Câu tổng cộng {target} kg cá', on: 'catch', amount: 'weight', base: 30, reward: { xu: 300, exp: 120 } },
    { id: 'd_sell', name: 'Bán cá thu về {target} xu', on: 'sell', amount: 'value', base: 500, reward: { xu: 300, exp: 100 } },
    { id: 'd_fresh', name: 'Câu {target} cá nước ngọt', on: 'catch', filter: { category: 'nuoc_ngot' }, amount: 'count', base: 6, reward: { xu: 260, exp: 100 } },
    { id: 'd_salt', name: 'Câu {target} cá nước mặn', on: 'catch', filter: { category: 'nuoc_man' }, amount: 'count', base: 4, reward: { xu: 300, exp: 120 }, minLevel: 30 },
    { id: 'd_upgrade', name: 'Nâng cấp cần câu {target} lần', on: 'rod_upgrade', amount: 'count', base: 1, fixed: true, reward: { xu: 350, exp: 120 } },
    { id: 'd_boss', name: 'Tấn công Boss {target} lần', on: 'boss_hit', amount: 'count', base: 3, fixed: true, reward: { xu: 500, exp: 200, items: { ruong_go: 1 } } },
  ],
  weekly: [
    { id: 'w_catch', name: 'Câu {target} con cá trong tuần', on: 'catch', amount: 'count', base: 120, reward: { xu: 3000, exp: 1500, items: { ruong_bac: 1 } } },
    { id: 'w_rare', name: 'Câu {target} cá Sử Thi trở lên', on: 'catch', filter: { minRarity: 4 }, amount: 'count', base: 5, fixed: true, reward: { xu: 6000, exp: 2500, items: { ruong_vang: 1 } } },
    { id: 'w_weight', name: 'Tổng cân nặng cá {target} kg', on: 'catch', amount: 'weight', base: 400, reward: { xu: 3500, exp: 1800 } },
    { id: 'w_sell', name: 'Bán cá thu về {target} xu', on: 'sell', amount: 'value', base: 8000, reward: { xu: 4000, exp: 1500 } },
    { id: 'w_enhance', name: 'Cường hóa cần câu {target} lần', on: 'rod_enhance', amount: 'count', base: 8, fixed: true, reward: { xu: 2500, exp: 1000, items: { da_cuong_hoa_so: 5 } } },
    { id: 'w_boss', name: 'Gây sát thương lên Boss {target} lần', on: 'boss_hit', amount: 'count', base: 15, fixed: true, reward: { xu: 5000, exp: 2500, items: { ruong_vang: 1 } } },
  ],
  chains: [
    { id: 'chain_nguoi_moi', name: 'Hành Trình Tân Thủ', steps: [
      { name: 'Câu 5 con cá đầu tiên', on: 'catch', amount: 'count', target: 5, reward: { xu: 200, exp: 60 } },
      { name: 'Bán cá thu 150 xu', on: 'sell', amount: 'value', target: 150, reward: { xu: 200, exp: 80, items: { moi_giun_dat: 20 } } },
      { name: 'Nâng cấp cần câu 1 lần', on: 'rod_upgrade', amount: 'count', target: 1, reward: { xu: 300, exp: 100 } },
      { name: 'Câu 1 cá Hiếm', on: 'catch', filter: { minRarity: 2 }, amount: 'count', target: 1, reward: { xu: 500, exp: 150, items: { ruong_go: 1 } } },
      { name: 'Mở khóa Hồ Thanh Bình', on: 'unlock_location', filter: { location: 'ho_thanh_binh' }, amount: 'count', target: 1, reward: { xu: 1000, exp: 300, items: { trung_thu_thuong: 1 } } },
    ] },
    { id: 'chain_cuong_hoa', name: 'Thợ Rèn Cần Câu', steps: [
      { name: 'Cường hóa cần câu 3 lần', on: 'rod_enhance', amount: 'count', target: 3, reward: { xu: 800, exp: 200 } },
      { name: 'Chế tạo 1 vật phẩm', on: 'craft', amount: 'count', target: 1, reward: { xu: 1000, exp: 300, items: { da_cuong_hoa_trung: 2 } } },
      { name: 'Câu 3 cá Quý Hiếm', on: 'catch', filter: { minRarity: 3 }, amount: 'count', target: 3, reward: { xu: 2500, exp: 600, items: { ruong_bac: 1 } } },
      { name: 'Tấn công Boss 5 lần', on: 'boss_hit', amount: 'count', target: 5, reward: { xu: 5000, exp: 1200, items: { ruong_vang: 1 } } },
    ] },
    { id: 'chain_bien_sau', name: 'Chinh Phục Đại Dương', steps: [
      { name: 'Mở khóa Biển Sâu', on: 'unlock_location', filter: { location: 'bien_sau' }, amount: 'count', target: 1, reward: { xu: 8000, exp: 1500 } },
      { name: 'Câu 10 cá tại Biển Sâu', on: 'catch', filter: { location: 'bien_sau' }, amount: 'count', target: 10, reward: { xu: 12000, exp: 3000, items: { ruong_vang: 1 } } },
      { name: 'Câu 1 cá Huyền Thoại', on: 'catch', filter: { minRarity: 5 }, amount: 'count', target: 1, reward: { xu: 30000, exp: 6000, items: { ruong_kim_cuong: 1 } } },
    ] },
  ],
};
write('missions.json', missions);

/* ------------------------------------------------------------------ ACHIEVEMENTS + TITLES */
const A = [];
const ach = (group, id, name, metric, target, reward) => A.push({ id, group, name, desc: '', metric, target, reward });
ach('Người Mới Câu Cá', 'moi_1', 'Mẻ Cá Đầu Tiên', 'total_catch', 1, { xu: 100 });
ach('Người Mới Câu Cá', 'moi_2', 'Cần Thủ Tập Sự', 'total_catch', 25, { xu: 500, title: 'tan_thu' });
ach('Người Mới Câu Cá', 'moi_3', 'Quen Tay Quen Cần', 'total_catch', 100, { xu: 1500, items: { ruong_go: 1 } });
ach('Cao Thủ Câu Cá', 'cao_1', 'Cao Thủ Làng Chài', 'total_catch', 500, { xu: 5000, title: 'cao_thu' });
ach('Cao Thủ Câu Cá', 'cao_2', 'Ngư Phủ Lão Luyện', 'total_catch', 2500, { xu: 25000, items: { ruong_vang: 1 } });
ach('Cao Thủ Câu Cá', 'cao_3', 'Vua Câu Cá', 'total_catch', 10000, { xu: 150000, title: 'vua_cau_ca', items: { ruong_kim_cuong: 2 } });
ach('Cao Thủ Câu Cá', 'cao_4', 'Cân Nặng Ngàn Cân', 'total_weight', 1000, { xu: 3000 });
ach('Cao Thủ Câu Cá', 'cao_5', 'Vạn Cân Thu Hoạch', 'total_weight', 20000, { xu: 40000, items: { ruong_vang: 1 } });
ach('Bậc Thầy Săn Cá Hiếm', 'hiem_1', 'Con Mắt Tinh Đời', 'rare_catch', 5, { xu: 2000 });
ach('Bậc Thầy Săn Cá Hiếm', 'hiem_2', 'Thợ Săn Cá Hiếm', 'rare_catch', 50, { xu: 15000, title: 'tho_san_hiem' });
ach('Bậc Thầy Săn Cá Hiếm', 'hiem_3', 'Bậc Thầy Săn Cá Hiếm', 'rare_catch', 300, { xu: 120000, title: 'bac_thay_hiem', items: { ruong_kim_cuong: 1 } });
ach('Bậc Thầy Săn Cá Hiếm', 'hiem_4', 'Chạm Tay Huyền Thoại', 'legend_catch', 1, { xu: 10000 });
ach('Bậc Thầy Săn Cá Hiếm', 'hiem_5', 'Kẻ Săn Huyền Thoại', 'legend_catch', 25, { xu: 100000, title: 'ke_san_huyen_thoai' });
ach('Nhà Sưu Tập', 'suutap_1', 'Sưu Tầm Nhỏ', 'codex_count', 10, { xu: 2000 });
ach('Nhà Sưu Tập', 'suutap_2', 'Nhà Sưu Tập', 'codex_count', 40, { xu: 30000, title: 'nha_suu_tap' });
ach('Nhà Sưu Tập', 'suutap_3', 'Bách Khoa Toàn Thư Cá', 'codex_count', 85, { xu: 300000, title: 'bach_khoa_ca', items: { ruong_than_thoai: 1 } });
ach('Chinh Phục Biển Sâu', 'bien_1', 'Ra Khơi', 'deep_catch', 25, { xu: 10000 });
ach('Chinh Phục Biển Sâu', 'bien_2', 'Chinh Phục Biển Sâu', 'deep_catch', 300, { xu: 100000, title: 'chinh_phuc_bien_sau' });
ach('Chinh Phục Biển Sâu', 'bien_3', 'Kẻ Diệt Boss', 'boss_kills', 5, { xu: 20000, title: 'diet_boss' });
ach('Chinh Phục Biển Sâu', 'bien_4', 'Sát Thủ Boss', 'boss_kills', 50, { xu: 200000, items: { ruong_than_thoai: 1 } });
ach('Thợ Săn Cá Cổ Đại', 'codai_1', 'Dấu Chân Cổ Đại', 'ancient_catch', 1, { xu: 50000 });
ach('Thợ Săn Cá Cổ Đại', 'codai_2', 'Thợ Săn Cá Cổ Đại', 'ancient_catch', 20, { xu: 400000, title: 'tho_san_co_dai' });
ach('Thợ Săn Cá Cổ Đại', 'codai_3', 'Kẻ Độc Nhất', 'unique_catch', 1, { xu: 1000000, title: 'ke_doc_nhat', items: { ruong_than_thoai: 3 } });
ach('Tay Chơi Trang Bị', 'trangbi_1', 'Cần Câu Bạc', 'rod_tier', 3, { xu: 3000 });
ach('Tay Chơi Trang Bị', 'trangbi_2', 'Cần Câu Huyền Thoại', 'rod_tier', 7, { xu: 100000, title: 'than_khi' });
ach('Tay Chơi Trang Bị', 'trangbi_3', 'Cần Thần Cấp', 'rod_tier', 10, { xu: 1000000, title: 'chi_ton_can' });
ach('Đại Gia Xu', 'xu_1', 'Có Của Ăn Của Để', 'coins_earned', 100000, { xu: 5000 });
ach('Đại Gia Xu', 'xu_2', 'Triệu Phú Câu Cá', 'coins_earned', 1000000, { xu: 50000, title: 'trieu_phu' });
ach('Đại Gia Xu', 'xu_3', 'Tỷ Phú Hải Vực', 'coins_earned', 100000000, { xu: 2000000, title: 'ty_phu' });
const TITLES = { tan_thu: 'Cần Thủ Tập Sự', cao_thu: 'Cao Thủ Làng Chài', vua_cau_ca: 'Vua Câu Cá', tho_san_hiem: 'Thợ Săn Cá Hiếm', bac_thay_hiem: 'Bậc Thầy Săn Cá Hiếm',
  ke_san_huyen_thoai: 'Kẻ Săn Huyền Thoại', nha_suu_tap: 'Nhà Sưu Tập', bach_khoa_ca: 'Bách Khoa Cá', chinh_phuc_bien_sau: 'Chinh Phục Biển Sâu', diet_boss: 'Diệt Boss',
  tho_san_co_dai: 'Thợ Săn Cá Cổ Đại', ke_doc_nhat: 'Kẻ Độc Nhất', than_khi: 'Thần Khí Trong Tay', chi_ton_can: 'Chí Tôn Cần Câu', trieu_phu: 'Triệu Phú Câu Cá',
  ty_phu: 'Tỷ Phú Hải Vực', quan_quan_dai_hoi: 'Quán Quân Đại Hội', a_quan_dai_hoi: 'Á Quân Đại Hội', ngu_ong: 'Ngư Ông' };
write('achievements.json', { achievements: A, titles: TITLES });

/* ------------------------------------------------------------------ EVENTS */
const events = {
  templates: [
    { key: 'ca_quy_hiem', name: 'Cá Quý Hiếm Xuất Hiện', type: 'rare_boost', durationMin: 120, modifiers: { rareBonus: 60 }, rewards: { xu: 800, items: { ruong_bac: 1 } },
      desc: 'Tỷ lệ cá hiếm tăng mạnh trong 2 giờ!' },
    { key: 'tuan_le_san_ca', name: 'Tuần Lễ Săn Cá', type: 'fishing_week', durationMin: 7 * 24 * 60, modifiers: { expMult: 1.5, rareBonus: 15 }, scoring: 'catch_count',
      rewards: { xu: 5000, items: { ruong_vang: 1 }, top: [{ rank: 1, xu: 100000, items: { ruong_kim_cuong: 2 }, title: 'ngu_ong' }, { rank: 2, xu: 50000, items: { ruong_kim_cuong: 1 } }, { rank: 3, xu: 25000, items: { ruong_vang: 2 } }] },
      desc: 'EXP x1.5, cá hiếm +15%. Xếp hạng theo số cá bắt được.' },
    { key: 'dai_hoi_cau_ca', name: 'Đại Hội Câu Cá', type: 'tournament', durationMin: 180, scoring: 'total_weight', ticket: 've_dai_hoi', modifiers: { rareBonus: 10 },
      rewards: { xu: 3000, items: { ruong_bac: 1 }, top: [{ rank: 1, xu: 150000, items: { ruong_kim_cuong: 3 }, title: 'quan_quan_dai_hoi' }, { rank: 2, xu: 80000, items: { ruong_kim_cuong: 1 }, title: 'a_quan_dai_hoi' }, { rank: 3, xu: 40000, items: { ruong_vang: 2 } }] },
      desc: 'Cần vé Đại Hội. Xếp hạng theo tổng cân nặng cá câu được.' },
    { key: 'boss_bien_sau', name: 'Boss Biển Sâu Thức Tỉnh', type: 'boss_event', durationMin: 90, boss: 'boss_dai_map_dai_duong', modifiers: { expMult: 1.25 },
      rewards: { xu: 2000, items: { ruong_vang: 1 } }, desc: 'Đại Mập Đại Dương xuất hiện tại Biển Sâu, thưởng gấp đôi!' },
    { key: 'su_kien_gioi_han', name: 'Đêm Trăng Rằm', type: 'limited', durationMin: 240, modifiers: { rareBonus: 20, expMult: 1.2 }, fishPool: ['ca_trang_ram'], fishWeight: 6,
      rewards: { xu: 3000, items: { ve_su_kien: 2 } }, desc: 'Cá Trăng Rằm xuất hiện ở mọi khu vực.' },
    { key: 'le_hoi_den_long', name: 'Lễ Hội Đèn Lồng', type: 'festival', durationMin: 72 * 60, modifiers: { expMult: 1.3, coinMult: 1.2 }, fishPool: ['ca_den_long_do'], fishWeight: 6, ticket: null,
      rewards: { xu: 6000, items: { ve_le_hoi: 3, ruong_vang: 1 } }, desc: 'Đèn lồng rực rỡ, giá cá +20%, EXP +30%.' },
    { key: 'le_hoi_tet', name: 'Tết Cá Chép', type: 'festival', durationMin: 96 * 60, modifiers: { expMult: 1.5, coinMult: 1.25, rareBonus: 20 }, fishPool: ['ca_chep_hoa_rong'], fishWeight: 5,
      rewards: { xu: 10000, items: { ruong_kim_cuong: 1 } }, desc: 'Cá chép hóa rồng xuất hiện!' },
    { key: 'le_hoi_phao_hoa', name: 'Lễ Hội Pháo Hoa', type: 'festival', durationMin: 48 * 60, modifiers: { coinMult: 1.15, biteSpeed: 15 }, fishPool: ['ca_phao_hoa'], fishWeight: 5,
      rewards: { xu: 5000, items: { ve_le_hoi: 2 } }, desc: 'Pháo hoa rực trời, cá Pháo Hoa xuất hiện.' },
    { key: 'gio_vang', name: 'Giờ Vàng Câu Cá', type: 'coin_boost', durationMin: 120, modifiers: { coinMult: 1.5 }, rewards: { xu: 500 }, desc: 'Giá bán cá tăng 50% trong 2 giờ.' },
  ],
  recurring: [
    { template: 'dai_hoi_cau_ca', dow: 6, hour: 20 },
    { template: 'ca_quy_hiem', dow: null, hour: 19 },
    { template: 'tuan_le_san_ca', dow: 1, hour: 0 },
    { template: 'gio_vang', dow: 0, hour: 10 },
  ],
};
write('events.json', events);

console.log(`✔ fishes.json: ${fishes.length} (cá thường ${fishes.filter((f) => !f.bossOnly && !f.event).length}, boss ${fishes.filter((f) => f.bossOnly).length}, sự kiện ${fishes.filter((f) => f.event).length})`);
console.log(`✔ rods.json: ${rods.length} cần | baits ${baits.length} | items ${items.length} | pets ${pets.length} | bosses ${bosses.length}`);
write('bosses.json', bosses);
