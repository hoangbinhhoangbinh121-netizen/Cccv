'use strict';
const { D } = require('./gameData');
const petRepo = require('../database/repositories/pets');
const users = require('../database/repositories/users');
const invRepo = require('../database/repositories/inventory');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const petSys = require('../systems/fishing/pets');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { pickWeighted } = require('../utils/rng');

const MAX_PETS = 30;
const own = (userId, id) => { const p = petRepo.owned(userId, id); if (!p) throw new GameError('Bạn không có thú cưng này.'); return p; };
/** Cộng EXP/độ thân thiết cho thú. Trả về { levels } nếu có lên cấp. */
function gainExp(userId, petId, exp, bond = 0) {
  const p = petRepo.get(petId); if (!p || p.user_id !== userId) return null; const def = D.pets.get(p.pet_id);
  const cap = def.maxLevel; let { level, exp: e } = p; e += exp; let up = 0;
  while (level < cap && e >= petSys.petExpForLevel(level)) { e -= petSys.petExpForLevel(level); level++; up++; }
  if (level >= cap) e = 0;
  petRepo.update(petId, { level, exp: e, bond: Math.min(100, p.bond + bond) });
  return up ? { name: def.name, level, up } : null;
}
function hatch(userId, eggId) {
  const egg = D.items.get(eggId); if (!egg || egg.type !== 'egg') throw new GameError('Đây không phải trứng thú.');
  return getDb().tx(() => {
    if (petRepo.list(userId).length >= MAX_PETS) throw new GameError(`Bạn đã đạt giới hạn ${MAX_PETS} thú cưng.`);
    if (!invRepo.consume(userId, eggId, 1)) throw new GameError('Bạn không có quả trứng này.');
    const pool = D.petList.filter((p) => egg.egg.pool.includes(p.rarity));
    const pet = pickWeighted(pool, (p) => D.rarities[p.rarity - 1].weight + 1);
    const id = petRepo.create(userId, pet.id);
    return { id, def: pet };
  });
}
function equip(userId, petId) { const p = own(userId, petId); users.setEquip(userId, 'pet_id', p.id); return D.pets.get(p.pet_id); }
const unequip = (userId) => users.setEquip(userId, 'pet_id', null);
function feed(userId, petId, foodId, qty = 1) {
  const food = D.items.get(foodId); if (!food || food.type !== 'petfood') throw new GameError('Đây không phải thức ăn thú cưng.');
  return getDb().tx(() => {
    own(userId, petId); if (!invRepo.consume(userId, foodId, qty)) throw new GameError('Bạn không đủ thức ăn.');
    const bond = (food.tier >= 3 ? 8 : 2) * qty; const up = gainExp(userId, petId, food.petExp * qty, bond); return { up, bond, exp: food.petExp * qty };
  });
}
function rename(userId, petId, name) { own(userId, petId); name = String(name || '').trim().slice(0, 24); if (!name) throw new GameError('Tên không hợp lệ.'); petRepo.update(petId, { nickname: name }); return name; }
function evolveInfo(p) { const def = D.pets.get(p.pet_id); return { def, can: p.stage < 2, level: def.evolve.level, bond: def.evolve.bond, mats: def.evolve.mats, xu: def.evolve.xu }; }
function evolve(userId, petId) {
  return getDb().tx(() => {
    const p = own(userId, petId); const e = evolveInfo(p);
    if (!e.can) throw new GameError('Thú cưng đã tiến hoá tối đa.'); if (p.level < e.level) throw new GameError(`Cần đạt cấp **${e.level}** (hiện ${p.level}).`); if (p.bond < e.bond) throw new GameError(`Cần độ thân thiết **${e.bond}** (hiện ${p.bond}). Hãy cho thú ăn!`);
    invSvc.spend(userId, e.mats); economy.debit(userId, e.xu, 'pet_evolve', { note: e.def.name });
    petRepo.update(petId, { stage: 2 }); return e.def;
  });
}
const view = (p) => { const s = petSys.petStats(p); return { inst: p, def: s.def, stats: s.stats, need: petSys.petExpForLevel(p.level) }; };
module.exports = { gainExp, hatch, equip, unequip, feed, rename, evolve, evolveInfo, view, list: (u) => petRepo.list(u).map(view), get: (u, id) => view(own(u, id)), MAX_PETS };
