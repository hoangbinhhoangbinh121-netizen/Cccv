'use strict';
const { D, item: itemDef } = require('./gameData');
const inv = require('../database/repositories/inventory');
const users = require('../database/repositories/users');
const fishRepo = require('../database/repositories/fish');
const rodRepo = require('../database/repositories/rods');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');

const stackOf = (id) => (itemDef(id) && itemDef(id).stack) || 999;
function slotsUsed(userId) {
  const stacks = inv.all(userId).reduce((a, r) => a + Math.ceil(r.qty / stackOf(r.item_id)), 0);
  return stacks + fishRepo.count(userId) + rodRepo.countOwned(userId);
}
const capacity = (userId) => users.get(userId).inv_capacity;
const freeSlots = (userId) => capacity(userId) - slotsUsed(userId);
function requireSpace(userId, n = 1) { const free = freeSlots(userId); if (free < n) throw new GameError(`Kho đồ đã đầy (${slotsUsed(userId)}/${capacity(userId)} ô). Hãy bán bớt cá hoặc dùng **Phù Mở Rộng Kho**.`, 'FULL'); }
/** Cộng vật phẩm; mặc định kiểm tra chỗ trống (force=true cho phần thưởng không được phép mất). */
function grant(userId, items, { force = false } = {}) {
  const entries = Object.entries(items || {}).filter(([, q]) => q > 0);
  for (const [id] of entries) if (!itemDef(id)) throw new GameError(`Vật phẩm không tồn tại: ${id}`);
  if (!force) { const before = slotsUsed(userId); let add = 0; for (const [id, q] of entries) { const cur = inv.count(userId, id); add += Math.ceil((cur + q) / stackOf(id)) - Math.ceil(cur / stackOf(id)); } if (capacity(userId) - before < add) throw new GameError('Kho đồ không đủ chỗ cho phần thưởng. Hãy dọn kho rồi thử lại.', 'FULL'); }
  for (const [id, q] of entries) inv.add(userId, id, q);
}
const has = (userId, items) => Object.entries(items).every(([id, q]) => inv.count(userId, id) >= q);
function missingText(userId, items) { return Object.entries(items).filter(([id, q]) => inv.count(userId, id) < q).map(([id, q]) => `${itemDef(id)?.name || id} (${inv.count(userId, id)}/${q})`).join(', '); }
/** Trừ nhiều vật phẩm, tất cả hoặc không có gì. Vật phẩm bị khoá bị bỏ qua khi tính. */
function spend(userId, items) {
  if (!has(userId, items)) throw new GameError(`Thiếu nguyên liệu: ${missingText(userId, items)}`, 'MISSING');
  for (const [id, q] of Object.entries(items)) if (!inv.consume(userId, id, q)) throw new GameError(`Thiếu ${itemDef(id)?.name || id}`, 'MISSING');
}
function toggleLockItem(userId, itemId) { const r = getDb().get('SELECT locked FROM inventory WHERE user_id=? AND item_id=?', userId, itemId); if (!r) throw new GameError('Bạn không có vật phẩm này'); const v = r.locked ? 0 : 1; inv.setLocked(userId, itemId, v); return !!v; }
const MAX_CAPACITY = 600;
function expand(userId, slots) { const u = users.get(userId); if (u.inv_capacity >= MAX_CAPACITY) throw new GameError(`Kho đã đạt tối đa ${MAX_CAPACITY} ô.`); const next = Math.min(MAX_CAPACITY, u.inv_capacity + slots); users.update(userId, { inv_capacity: next }); return next; }
module.exports = { stackOf, slotsUsed, capacity, freeSlots, requireSpace, grant, has, spend, missingText, toggleLockItem, expand, count: inv.count, all: inv.all, MAX_CAPACITY };
