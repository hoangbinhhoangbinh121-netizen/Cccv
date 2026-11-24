'use strict';
/**
 * Thị trường người chơi. Chống nhân bản/mua trùng bằng:
 *  1) ký quỹ (escrow): vật phẩm rời khỏi kho khi đăng bán, cá/cần được gắn listed=1;
 *  2) chiếm tin đăng nguyên tử: UPDATE ... WHERE status='active' – chỉ một giao dịch thành công;
 *  3) toàn bộ trừ/cộng xu và chuyển quyền sở hữu nằm trong MỘT giao dịch SQLite (BEGIN IMMEDIATE).
 */
const { D, item: itemDef } = require('./gameData');
const market = require('../database/repositories/market');
const fishRepo = require('../database/repositories/fish');
const rodRepo = require('../database/repositories/rods');
const invRepo = require('../database/repositories/inventory');
const users = require('../database/repositories/users');
const settings = require('../database/repositories/settings');
const wallet = require('../database/repositories/wallet');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const fishSys = require('../systems/fish');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { now } = require('../utils/time');
const { xu: fxu, kg } = require('../utils/format');

const MAX_PRICE = 2_000_000_000;
function listItem(userId, { kind, refId = null, itemId = null, qty = 1, price }) {
  price = Math.floor(price); if (!(price >= 1 && price <= MAX_PRICE)) throw new GameError(`Giá phải từ 1 đến ${fxu(MAX_PRICE)}.`);
  return getDb().tx(() => {
    const u = users.get(userId); if (u.level < 3) throw new GameError('Cần đạt cấp 3 để dùng thị trường.');
    if (market.activeCount(userId) >= settings.get('market_max_listings')) throw new GameError(`Mỗi người chỉ được đăng tối đa ${settings.get('market_max_listings')} tin.`);
    let summary; let q = 1;
    if (kind === 'fish') {
      const f = fishRepo.owned(userId, refId); if (!f) throw new GameError('Bạn không sở hữu con cá này.'); if (f.locked) throw new GameError('Cá đang bị khoá.'); if (f.listed) throw new GameError('Cá đã được đăng bán.');
      getDb().run('UPDATE fish_instances SET listed=1 WHERE id=?', f.id); const d = D.fishes.get(f.fish_id); summary = `${d.name} ${kg(f.weight)} (${fishSys.variantById(f.variant).name}) [${require('../systems/rarity').name(d.rarity)}]`;
    } else if (kind === 'rod') {
      const r = rodRepo.owned(userId, refId); if (!r) throw new GameError('Bạn không sở hữu cần câu này.'); if (r.listed) throw new GameError('Cần đã được đăng bán.'); if (r.locked) throw new GameError('Cần đang bị khoá.');
      if (users.equipment(userId).rod_id === r.id) throw new GameError('Hãy tháo cần khỏi ô trang bị trước.'); if (rodRepo.countOwned(userId) <= 1) throw new GameError('Bạn không thể bán cần câu cuối cùng.');
      rodRepo.update(r.id, { listed: 1 }); const d = D.rods.get(r.rod_id); summary = `${d.name} [${d.tierName}] Lv${r.level} +${r.enhance}${r.awaken ? ` ✦${r.awaken}` : ''}`;
    } else if (kind === 'item') {
      const d = itemDef(itemId); if (!d) throw new GameError('Vật phẩm không tồn tại.'); q = Math.max(1, qty | 0);
      if (!invRepo.remove(userId, itemId, q)) throw new GameError('Không đủ vật phẩm hoặc vật phẩm đang bị khoá.'); summary = `${q}× ${d.name}`;
    } else throw new GameError('Loại vật phẩm không hợp lệ.');
    const id = market.create({ seller_id: userId, kind, ref_id: refId, item_id: itemId, qty: q, price, fee_pct: settings.get('market_fee_pct'), expires_at: now() + settings.get('market_expire_hours') * 3600000, summary });
    return market.get(id);
  });
}
/** Trả lại hàng ký quỹ cho người bán (huỷ/hết hạn). */
function returnEscrow(l) {
  if (l.kind === 'fish') getDb().run('UPDATE fish_instances SET listed=0 WHERE id=?', l.ref_id);
  else if (l.kind === 'rod') rodRepo.update(l.ref_id, { listed: 0 });
  else invSvc.grant(l.seller_id, { [l.item_id]: l.qty }, { force: true });
}
function buy(buyerId, listingId) {
  return getDb().tx(() => {
    const l = market.get(listingId); if (!l || l.status !== 'active') throw new GameError('Tin đăng không còn tồn tại (đã bán/huỷ).', 'GONE');
    if (l.expires_at <= now()) throw new GameError('Tin đăng đã hết hạn.', 'GONE'); if (l.seller_id === buyerId) throw new GameError('Bạn không thể mua hàng của chính mình.');
    // kiểm tra quyền sở hữu hiện tại của hàng ký quỹ
    if (l.kind === 'fish') { const f = fishRepo.get(l.ref_id); if (!f || f.user_id !== l.seller_id || !f.listed) throw new GameError('Dữ liệu tin đăng không hợp lệ.'); invSvc.requireSpace(buyerId, 1); }
    else if (l.kind === 'rod') { const r = rodRepo.get(l.ref_id); if (!r || r.user_id !== l.seller_id || !r.listed) throw new GameError('Dữ liệu tin đăng không hợp lệ.'); invSvc.requireSpace(buyerId, 1); }
    else invSvc.requireSpace(buyerId, Math.ceil(l.qty / invSvc.stackOf(l.item_id)));
    if (!market.claim(l.id, 'sold', buyerId)) throw new GameError('Có người khác vừa mua món này.', 'GONE'); // chiếm nguyên tử
    economy.debit(buyerId, l.price, 'market_buy', { ref: `listing:${l.id}`, note: l.summary, idem: `market:${l.id}:buyer` });
    const fee = Math.floor((l.price * l.fee_pct) / 100); const net = l.price - fee;
    economy.credit(l.seller_id, net, 'market_sell', { ref: `listing:${l.id}`, note: `${l.summary} (phí ${fxu(fee)})`, idem: `market:${l.id}:seller` });
    if (l.kind === 'fish') getDb().run('UPDATE fish_instances SET user_id=?, listed=0, locked=0 WHERE id=? AND user_id=?', buyerId, l.ref_id, l.seller_id);
    else if (l.kind === 'rod') { rodRepo.update(l.ref_id, { user_id: buyerId, listed: 0, locked: 0 }); rodRepo.addSkin(buyerId, rodRepo.get(l.ref_id).rod_id); }
    else invSvc.grant(buyerId, { [l.item_id]: l.qty }, { force: true });
    users.bumpStats(buyerId, { market_buys: 1 }); users.bumpStats(l.seller_id, { market_sales: 1 });
    return { listing: market.get(l.id), fee, net };
  });
}
function cancel(userId, listingId, { admin = false } = {}) {
  return getDb().tx(() => {
    const l = market.get(listingId); if (!l) throw new GameError('Tin đăng không tồn tại.'); if (l.seller_id !== userId && !admin) throw new GameError('Đây không phải tin đăng của bạn.');
    if (!market.claim(l.id, 'cancelled')) throw new GameError('Tin đăng không còn hiệu lực.'); returnEscrow(l); return l;
  });
}
function expireDue() { const out = []; for (const l of market.expired()) { getDb().tx(() => { if (market.claim(l.id, 'expired')) { returnEscrow(l); out.push(l); } }); } return out; }
/** Chuyển xu giữa người chơi (có phí, giới hạn ngày, yêu cầu cấp tối thiểu để chống chuyển tiền acc clone). */
function transferXu(fromId, toId, amount) {
  amount = Math.floor(amount); if (!(amount >= 100)) throw new GameError('Tối thiểu 100 xu mỗi lần chuyển.'); if (fromId === toId) throw new GameError('Không thể tự chuyển cho chính mình.');
  return getDb().tx(() => {
    const a = users.get(fromId); const b = users.get(toId); if (!b) throw new GameError('Người nhận chưa đăng ký chơi.'); if (b.banned) throw new GameError('Không thể chuyển cho tài khoản này.');
    if (a.level < settings.get('transfer_min_level')) throw new GameError(`Cần đạt cấp ${settings.get('transfer_min_level')} để chuyển xu.`);
    const dayStart = require('../utils/time').startOfDay(); const sent = wallet.sumSince(fromId, 'transfer_out', dayStart);
    if (sent + amount > settings.get('transfer_daily_cap')) throw new GameError(`Vượt hạn mức chuyển xu trong ngày (${fxu(settings.get('transfer_daily_cap'))}). Đã chuyển: ${fxu(sent)}.`);
    const fee = Math.ceil((amount * settings.get('transfer_fee_pct')) / 100);
    economy.debit(fromId, amount + fee, 'transfer_out', { ref: `to:${toId}`, note: `Chuyển cho ${b.name} (phí ${fxu(fee)})` }); economy.credit(toId, amount, 'transfer_in', { ref: `from:${fromId}`, note: `Nhận từ ${a.name}` });
    return { amount, fee };
  });
}
module.exports = { listItem, buy, cancel, expireDue, transferXu, search: market.search, get: market.get, historyOf: market.historyOf, activeCount: market.activeCount };
