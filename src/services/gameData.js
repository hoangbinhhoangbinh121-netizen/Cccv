'use strict';
/** Nạp & kiểm tra dữ liệu tĩnh (data/*.json), dựng chỉ mục tra cứu, đồng bộ danh mục vào DB. */
const fs = require('fs');
const path = require('path');
const config = require('../config');

const D = { loaded: false };
const read = (n) => JSON.parse(fs.readFileSync(path.join(config.dataDir, n), 'utf8'));
const byId = (arr, key = 'id') => new Map(arr.map((x) => [x[key], x]));

function load() {
  D.rarities = read('rarities.json');
  D.fishList = read('fishes.json'); D.fishes = byId(D.fishList);
  const rodsFile = read('rods.json'); D.tiers = rodsFile.tiers; D.innates = byId(rodsFile.innates); D.rodList = rodsFile.rods; D.rods = byId(D.rodList);
  D.locList = read('locations.json'); D.locations = byId(D.locList);
  D.baitList = read('baits.json'); D.baits = byId(D.baitList);
  D.itemList = read('items.json'); D.items = byId(D.itemList);
  D.petList = read('pets.json'); D.pets = byId(D.petList);
  D.bossList = read('bosses.json'); D.bosses = byId(D.bossList);
  D.recipes = read('recipes.json');
  D.missions = read('missions.json');
  const ach = read('achievements.json'); D.achievements = ach.achievements; D.achMap = byId(ach.achievements); D.titles = ach.titles;
  D.arcade = read('arcade.json'); D.arcadeItems = byId(D.arcade.box.items);
  D.arcadeEmoji = new Map(read('arcade-emoji.json').map((x) => [x.id, x.fb]));
  D.events = read('events.json'); D.eventTemplates = byId(D.events.templates, 'key');
  D.manifest = fs.existsSync(path.join(config.assetsDir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(config.assetsDir, 'manifest.json'), 'utf8')) : {};
  D.fishByLoc = new Map();
  for (const f of D.fishList) { if (f.bossOnly || f.event) continue; if (!D.fishByLoc.has(f.location)) D.fishByLoc.set(f.location, []); D.fishByLoc.get(f.location).push(f); }
  D.loaded = true; validate(); return D;
}
function validate() {
  const errs = [];
  const need = (c, m) => { if (!c) errs.push(m); };
  const itemOrBait = (id) => D.items.has(id) || D.baits.has(id);
  for (const f of D.fishList) { need(D.rarities[f.rarity - 1], `cá ${f.id}: phẩm cấp`); need(f.minWeight > 0 && f.maxWeight > f.minWeight, `cá ${f.id}: cân nặng`); need(f.event || f.location === 'event' || D.locations.has(f.location), `cá ${f.id}: khu vực ${f.location}`); }
  for (const l of D.locList) { need(D.bosses.has(l.boss), `khu vực ${l.id}: boss`); (D.fishByLoc.get(l.id) || []).length >= 8 || errs.push(`khu vực ${l.id}: <8 loài cá`); for (const r of l.resources) need(D.items.has(r.item), `khu vực ${l.id}: tài nguyên ${r.item}`); }
  for (const b of D.bossList) need(D.fishes.has(b.trophyFish), `boss ${b.id}: trophy`);
  for (const r of D.recipes.rods) { need(D.rods.has(r.rod), `recipe ${r.id}`); for (const k of Object.keys(r.mats)) need(D.items.has(k), `recipe ${r.id}: nguyên liệu ${k}`); }
  for (const r of D.recipes.items) { for (const k of [...Object.keys(r.in), ...Object.keys(r.out)]) need(itemOrBait(k), `recipe ${r.id}: ${k}`); }
  const rewardItems = (rw, where) => { for (const k of Object.keys((rw && rw.items) || {})) need(itemOrBait(k), `${where}: vật phẩm ${k}`); };
  for (const a of D.achievements) { rewardItems(a.reward, `thành tựu ${a.id}`); if (a.reward.title) need(D.titles[a.reward.title], `thành tựu ${a.id}: danh hiệu`); }
  for (const k of ['daily', 'weekly']) for (const m of D.missions[k]) rewardItems(m.reward, `nhiệm vụ ${m.id}`);
  for (const c of D.missions.chains) for (const s of c.steps) rewardItems(s.reward, `chuỗi ${c.id}`);
  for (const t of D.events.templates) { rewardItems(t.rewards, `sự kiện ${t.key}`); need(t.rewards && t.durationMin > 0, `sự kiện ${t.key}: thiếu phần thưởng/thời lượng`); for (const x of (t.rewards.top || [])) rewardItems(x, `sự kiện ${t.key} top`); for (const p of (t.fishPool || [])) need(D.fishes.has(p), `sự kiện ${t.key}: cá ${p}`); }
  for (const p of D.petList) need(D.rarities[p.rarity - 1], `thú ${p.id}`);
  for (const rod of D.rodList) { need(D.tiers[rod.tier - 1], `cần ${rod.id}`); need(fs.existsSync(path.join(config.assetsDir, 'rods', `${rod.id}.png`)) || process.env.SKIP_ASSET_CHECK, `thiếu ảnh cần ${rod.id}`); }
  const A = D.arcade;
  need(A.ranks.length === 5 && A.box.tiers.length === 5, 'arcade: cần 5 cấp bậc và 5 hộp');
  for (const t of A.box.tiers) { need(t.weights.length === A.box.grades.length, `hộp ${t.id}: số trọng số`); need(t.weights.reduce((a, b) => a + b, 0) > 0, `hộp ${t.id}: tổng trọng số`); }
  for (const g of A.box.grades) need(A.box.items.some((x) => x.grade === g.id), `arcade: thiếu Linh Bảo hạng ${g.id}`);
  need(A.box.items.length === byId(A.box.items).size, 'arcade: Linh Bảo trùng id');
  for (const a of A.achievements) need(a.stat && a.target > 0, `arcade: thành tích ${a.id}`);
  for (const m of A.missions) need(m.ev && m.target > 0 && m.reward > 0, `arcade: nhiệm vụ ${m.id}`);
  if (errs.length) throw new Error(`Dữ liệu game không hợp lệ:\n - ${errs.join('\n - ')}`);
}
/** Định nghĩa vật phẩm thống nhất (mồi + vật phẩm) */
function item(id) { return D.items.get(id) || D.baits.get(id) || null; }
function ensureLoaded() { if (!D.loaded) load(); return D; }
/** Đồng bộ danh mục vào các bảng *_catalog (phục vụ truy vấn/quản trị & toàn vẹn dữ liệu). */
function syncCatalogs(db) {
  ensureLoaded();
  db.tx(() => {
    for (const f of D.fishList) db.run('INSERT INTO fish_catalog(id,name,rarity,category,location,min_weight,max_weight,price_per_kg,exp,difficulty,spawn_weight,data) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rarity=excluded.rarity,category=excluded.category,location=excluded.location,min_weight=excluded.min_weight,max_weight=excluded.max_weight,price_per_kg=excluded.price_per_kg,exp=excluded.exp,difficulty=excluded.difficulty,spawn_weight=excluded.spawn_weight,data=excluded.data', f.id, f.name, f.rarity, f.category, f.location, f.minWeight, f.maxWeight, f.pricePerKg, f.exp, f.difficulty, f.spawnWeight, JSON.stringify({ times: f.times, weatherPref: f.weatherPref, bossOnly: f.bossOnly, event: f.event }));
    for (const r of D.rodList) db.run('INSERT INTO rod_catalog(id,name,tier,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tier=excluded.tier,data=excluded.data', r.id, r.name, r.tier, JSON.stringify({ stats: r.stats, maxLevel: r.maxLevel, enhanceCap: r.enhanceCap, sockets: r.sockets, innate: r.innate }));
    for (const b of D.baitList) db.run('INSERT INTO baits(id,name,tier,price,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tier=excluded.tier,price=excluded.price,data=excluded.data', b.id, b.name, b.tier, b.price, JSON.stringify(b.stats));
    for (const l of D.locList) db.run('INSERT INTO locations(id,name,ord,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,ord=excluded.ord,data=excluded.data', l.id, l.name, l.order, JSON.stringify({ unlock: l.unlock, rarity: l.rarity }));
    for (const p of D.petList) db.run('INSERT INTO pets(id,name,rarity,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rarity=excluded.rarity,data=excluded.data', p.id, p.name, p.rarity, JSON.stringify({ stats: p.stats, skill: p.skill }));
  });
}
module.exports = { D, load, ensureLoaded, item, syncCatalogs, rarity: (id) => D.rarities[id - 1], tierOf: (t) => D.tiers[t - 1] };
