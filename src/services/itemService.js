'use strict';
const { D } = require('./gameData');
const invRepo = require('../database/repositories/inventory');
const settings = require('../database/repositories/settings');
const users = require('../database/repositories/users');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const petSvc = require('./petService');
const rodSvc = require('./rodService');
const progressSvc = require('./progressService');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { rand, randInt, chance, pickWeighted } = require('../utils/rng');
const { now } = require('../utils/time');

const CHEST_XU = { 1: [200, 600], 3: [2000, 6000], 4: [8000, 24000], 5: [30000, 90000], 8: [150000, 450000] };
function chestLoot(tier) {
  const [a, b] = CHEST_XU[tier] || CHEST_XU[1]; const loot = { xu: randInt(a, b), items: {} };
  const rolls = 2 + Math.floor(tier / 3); const mats = D.itemList.filter((i) => i.type === 'material' && i.tier <= tier + 1);
  const stones = D.itemList.filter((i) => i.type === 'stone' && i.tier <= Math.ceil(tier / 3)); const gems = D.itemList.filter((i) => i.type === 'gem' && i.tier <= Math.ceil(tier / 3));
  const baits = D.baitList.filter((x) => x.tier <= tier + 2);
  for (let i = 0; i < rolls; i++) {
    const bucket = pickWeighted([['mat', 40], ['stone', 25], ['bait', 20], ['gem', 10], ['egg', tier >= 3 ? 3 : 0], ['ticket', 2]], (x) => x[1])[0]; let id; let q = 1;
    if (bucket === 'mat') { id = mats[randInt(0, mats.length - 1)].id; q = randInt(1, 3); } else if (bucket === 'stone') { id = stones[randInt(0, stones.length - 1)].id; q = randInt(1, 2); }
    else if (bucket === 'bait') { id = baits[randInt(0, baits.length - 1)].id; q = randInt(5, 15); } else if (bucket === 'gem') { id = gems[randInt(0, gems.length - 1)].id; } else if (bucket === 'egg') id = tier >= 5 ? 'trung_thu_quy' : 'trung_thu_thuong'; else id = 've_su_kien';
    loot.items[id] = (loot.items[id] || 0) + q;
  }
  return loot;
}
/** Dùng vật phẩm. Trả về mô tả kết quả để UI hiển thị. */
function use(userId, itemId, qty = 1) {
  const def = require('./gameData').item(itemId); if (!def) throw new GameError('Vật phẩm không tồn tại.'); qty = Math.max(1, qty | 0);
  return getDb().tx(() => {
    if (invRepo.count(userId, itemId) < qty) throw new GameError(`Bạn không đủ **${def.name}**.`);
    switch (def.type) {
      case 'chest': {
        qty = Math.min(qty, 20); invSvc.requireSpace(userId, 4); invRepo.consume(userId, itemId, qty); let xu = 0; const items = {};
        for (let i = 0; i < qty; i++) { const l = chestLoot(def.tier); xu += l.xu; for (const [k, v] of Object.entries(l.items)) items[k] = (items[k] || 0) + v; }
        xu = Math.round(xu * settings.get('xu_rate')); economy.credit(userId, xu, 'chest', { note: `${qty}× ${def.name}` }); invSvc.grant(userId, items, { force: true });
        users.bumpStats(userId, { chests_opened: qty }); return { kind: 'chest', qty, xu, items };
      }
      case 'potion': { invRepo.consume(userId, itemId, 1); const until = now() + def.potion.minutes * 60000; settings.addBuff(userId, def.potion.stat, def.potion.value, until); return { kind: 'potion', stat: def.potion.stat, value: def.potion.value, until }; }
      case 'egg': { const r = petSvc.hatch(userId, itemId); return { kind: 'egg', pet: r.def, id: r.id }; }
      case 'petfood': { const eq = users.equipment(userId); if (!eq.pet_id) throw new GameError('Hãy trang bị một thú cưng trước (`/thucung trang-bi`).'); const r = petSvc.feed(userId, eq.pet_id, itemId, qty); return { kind: 'petfood', ...r }; }
      case 'misc': {
        if (def.expand) { const slots = def.expand * qty; invRepo.consume(userId, itemId, qty); const cap = invSvc.expand(userId, slots); return { kind: 'expand', capacity: cap }; }
        if (def.repair) { const add = rodSvc.repairWithScroll(userId, def.repair); invRepo.consume(userId, itemId, 1); return { kind: 'repair', amount: add }; }
        throw new GameError('Vật phẩm này không dùng trực tiếp được.');
      }
      case 'bait': case 'float': case 'line': case 'hook': throw new GameError('Hãy trang bị vật phẩm này bằng `/cancau phu-kien` hoặc chọn mồi khi `/cauca`.');
      case 'stone': case 'gem': case 'material': throw new GameError('Vật phẩm này dùng khi nâng cấp/chế tạo (`/cuonghoa`, `/khamda`, `/chetao`).');
      default: throw new GameError('Vật phẩm này không thể sử dụng.');
    }
  });
}
module.exports = { use, chestLoot };
