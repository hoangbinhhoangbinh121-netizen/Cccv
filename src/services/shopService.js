'use strict';
const { D, item: itemDef } = require('./gameData');
const fishRepo = require('../database/repositories/fish');
const invRepo = require('../database/repositories/inventory');
const users = require('../database/repositories/users');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const rodSvc = require('./rodService');
const fishing = require('./fishingService');
const progressSvc = require('./progressService');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');

const CATS = { moi: 'Mồi câu', phao: 'Phao câu', day: 'Dây câu', luoi: 'Lưỡi câu', binh: 'Bình hỗ trợ', tien_ich: 'Rương · Vé · Tiện ích', thu: 'Thú cưng', can: 'Cần câu' };
const catOf = (d) => ({ bait: 'moi', float: 'phao', line: 'day', hook: 'luoi', potion: 'binh', chest: 'tien_ich', ticket: 'tien_ich', misc: 'tien_ich', egg: 'thu', petfood: 'thu' }[d.type]);
function catalog(cat) {
  if (cat === 'can') return D.rodList.filter((r) => r.buyable && r.price > 0).map((r) => ({ id: r.id, name: r.name, price: r.price, kind: 'rod', tier: r.tier, desc: r.desc }));
  return [...D.baitList, ...D.itemList].filter((i) => i.shop && catOf(i) === cat).map((i) => ({ id: i.id, name: i.name, price: i.price, kind: 'item', tier: i.tier, desc: i.desc }));
}
function buy(userId, id, qty = 1) {
  qty = Math.max(1, Math.min(999, qty | 0));
  return getDb().tx(() => {
    const rod = D.rods.get(id);
    if (rod) { if (!rod.buyable || !rod.price) throw new GameError('Cần câu này không bán trong cửa hàng (hãy chế tạo).'); economy.debit(userId, rod.price, 'shop', { note: rod.name }); const rid = rodSvc.grantRod(userId, id); return { kind: 'rod', def: rod, id: rid, cost: rod.price }; }
    const def = itemDef(id); if (!def || !def.shop) throw new GameError('Mặt hàng không có trong cửa hàng.');
    const cost = def.price * qty; economy.debit(userId, cost, 'shop', { note: `${qty}× ${def.name}` }); invSvc.grant(userId, { [id]: qty }); return { kind: 'item', def, qty, cost };
  });
}
/** Bán cá theo danh sách id hoặc theo bộ lọc. idem: dùng id tương tác để chống bán trùng. */
function sellFish(userId, { ids = null, rarityMax = 9, location = null } = {}) {
  return getDb().tx(() => {
    const mult = fishing.sellMultiplier(userId); let rows;
    if (ids) rows = ids.map((i) => fishRepo.owned(userId, i)).filter((r) => r && !r.listed && !r.locked); else rows = fishRepo.sellable(userId, { rarityMax, location });
    if (!rows.length) throw new GameError('Không có cá nào có thể bán (cá bị khoá hoặc đang rao bán sẽ không được bán).');
    let total = 0; const byRarity = {}; let weight = 0;
    for (const r of rows) { if (!fishRepo.remove(r.id)) continue; const v = Math.max(1, Math.round(r.base_value * mult)); total += v; weight += r.weight; byRarity[r.rarity] = (byRarity[r.rarity] || 0) + 1; }
    economy.credit(userId, total, 'sell_fish', { note: `${rows.length} cá` }); users.bumpStats(userId, { sales_count: rows.length });
    progressSvc.track(userId, 'sell', { value: total, count: rows.length }); const newAch = progressSvc.checkAchievements(userId);
    return { count: rows.length, total, weight, byRarity, mult, newAch };
  });
}
function previewSell(userId, { rarityMax = 9, location = null } = {}) { const mult = fishing.sellMultiplier(userId); const rows = fishRepo.sellable(userId, { rarityMax, location }); return { count: rows.length, total: rows.reduce((a, r) => a + Math.max(1, Math.round(r.base_value * mult)), 0), mult }; }
function sellItem(userId, id, qty = 1) {
  const def = itemDef(id); if (!def) throw new GameError('Vật phẩm không tồn tại.'); qty = Math.max(1, qty | 0);
  return getDb().tx(() => { if (!invRepo.remove(userId, id, qty)) throw new GameError('Không đủ vật phẩm hoặc vật phẩm đang bị khoá.'); const total = def.sell * qty; economy.credit(userId, total, 'sell_item', { note: `${qty}× ${def.name}` }); progressSvc.track(userId, 'sell', { value: total }); return { def, qty, total }; });
}
module.exports = { CATS, catalog, buy, sellFish, previewSell, sellItem, catOf };
