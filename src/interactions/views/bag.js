'use strict';
/** Kho đồ (/kho, /sudung), kho cá (/khoca) và bán cá (/ban_ca). */
const K = require('../../ui/kit');
const { D, item: itemDef } = require('../../services/gameData');
const invSvc = require('../../services/inventoryService');
const itemSvc = require('../../services/itemService');
const shopSvc = require('../../services/shopService');
const marketSvc = require('../../services/marketService');
const fishing = require('../../services/fishingService');
const invRepo = require('../../database/repositories/inventory');
const fishRepo = require('../../database/repositories/fish');
const users = require('../../database/repositories/users');
const fishSys = require('../../systems/fish');
const R = require('../../systems/rarity');
const { GameError } = require('../../utils/errors');
const { E, F, COLOR, cid } = K;

const CATS = { all: 'Tất cả', usable: 'Dùng được', bait: 'Mồi', gear: 'Phao · Dây · Lưỡi', material: 'Nguyên liệu', stone: 'Đá · Bùa', gem: 'Ngọc', chest: 'Rương', potion: 'Bình', egg: 'Trứng · Thức ăn thú', ticket: 'Vé · Khác' };
const catOf = (d) => ({ bait: 'bait', float: 'gear', line: 'gear', hook: 'gear', material: 'material', stone: 'stone', gem: 'gem', chest: 'chest', potion: 'potion', egg: 'egg', petfood: 'egg', ticket: 'ticket', misc: 'ticket' }[d.type] || 'ticket');
const USABLE = new Set(['chest', 'potion', 'egg', 'petfood', 'misc']);
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

const { describeUse } = require('../../ui/describe');
/* ------------------------------------------------------------------ KHO ĐỒ */
const inventory = {
  render(c, [cat = 'all', page = '0', sel]) {
    const all = invRepo.all(c.uid).map((r) => ({ ...r, def: itemDef(r.item_id) })).filter((r) => r.def);
    let list = all.filter((r) => (cat === 'all' ? true : cat === 'usable' ? USABLE.has(r.def.type) : catOf(r.def) === cat)).sort((a, b) => (b.def.tier || 0) - (a.def.tier || 0) || a.def.name.localeCompare(b.def.name));
    const per = 10; const pages = Math.max(1, Math.ceil(list.length / per)); const p = Math.max(0, Math.min(pages - 1, +page)); const slice = list.slice(p * per, p * per + per); const files = [];
    const used = invSvc.slotsUsed(c.uid); const cap = invSvc.capacity(c.uid); let comps = [];
    let e;
    const chosen = sel ? all.find((r) => r.item_id === sel) : null;
    if (chosen) {
      const d = chosen.def; const im = K.img(D.baits.has(d.id) ? 'baits' : 'items', d.id); if (im) files.push(im.file);
      e = K.embed({ title: `${K.itemEmoji(d.id)} ${d.name} ×${F.num(chosen.qty)}${chosen.locked ? ' 🔒' : ''}`, desc: `${d.desc || ''}\n\nGiá bán NPC: ${F.xu(d.sell || 0)}/cái · Giá mua: ${d.price ? F.xu(d.price) : '—'}\nXếp chồng tối đa ${d.stack || 999}`, color: COLOR.info, thumb: im?.url });
      const usable = USABLE.has(d.type);
      comps = [K.button({ id: cid('v', c.uid, 'inventory', 'use', cat, p, d.id, 1), label: 'Dùng 1', style: 'success', disabled: !usable, emoji: '✨' }), K.button({ id: cid('v', c.uid, 'inventory', 'use', cat, p, d.id, chosen.qty), label: 'Dùng hết', style: 'primary', disabled: !usable || d.type === 'misc' && !!d.repair, emoji: '✨' }),
        K.button({ id: cid('v', c.uid, 'inventory', 'lock', cat, p, d.id), label: chosen.locked ? 'Mở khoá' : 'Khoá', emoji: '🔒' }), K.button({ id: cid('v', c.uid, 'inventory', 'sell1', cat, p, d.id), label: 'Bán 1', style: 'secondary', disabled: !!chosen.locked || !d.sell, emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'inventory', 'sellq', cat, p, d.id), label: 'Bán / Đăng chợ…', disabled: !!chosen.locked, emoji: K.emoji.btn('ui', 'market') }),
        K.button({ id: cid('v', c.uid, 'inventory', 'show', cat, p), label: '← Danh sách', emoji: '↩️' })];
    } else {
      e = K.embed({ title: `${E('ui', 'backpack')} Kho đồ — ${CATS[cat]}`, desc: `Ô sử dụng: **${used}/${cap}** ${F.bar(used, cap, 12)}\n\n${slice.map((r) => `${K.itemEmoji(r.item_id)} **${r.def.name}** ×${F.num(r.qty)}${r.locked ? ' 🔒' : ''}`).join('\n') || '*Không có vật phẩm nào.*'}`, color: COLOR.info, footer: 'Chọn một vật phẩm bên dưới để dùng/bán/khoá · Cá nằm ở /khoca' });
      comps = [...K.pager(c.uid, 'inventory', 'pg', p, pages, [cat]), K.button({ id: cid('v', c.uid, 'fishbag', 'show'), label: 'Kho cá', emoji: K.emoji.btn('ui', 'fish') })];
      if (slice.length) comps.push(K.select({ id: cid('v', c.uid, 'inventory', 'sel', cat, p), placeholder: 'Chọn vật phẩm…', options: slice.map((r) => ({ label: `${r.def.name} ×${F.num(r.qty)}`, value: r.item_id, description: (r.def.desc || '').slice(0, 90) })) }));
      comps.push(K.select({ id: cid('v', c.uid, 'inventory', 'cat'), placeholder: 'Lọc theo loại…', options: Object.entries(CATS).map(([k, l]) => ({ label: l, value: k, default: k === cat })) }));
    }
    return K.msg({ embeds: [e], files, components: K.rows(comps) });
  },
  act(c, act, [cat, page, id, q], i) {
    if (act === 'pgp') return { args: [page, cat] };
    if (act === 'cat') return { args: [i.values[0], '0'] }; if (act === 'sel') return { args: [cat, page, i.values[0]] };
    if (act === 'use') { const r = itemSvc.use(c.uid, id, +q || 1); const left = invRepo.count(c.uid, id); return { notice: describeUse(r), args: [cat, page, left > 0 ? id : undefined] }; }
    if (act === 'lock') return { notice: invSvc.toggleLockItem(c.uid, id) ? '🔒 Đã khoá vật phẩm.' : '🔓 Đã mở khoá.', args: [cat, page, id] };
    if (act === 'sell1') { const r = shopSvc.sellItem(c.uid, id, 1); return { notice: `💰 Bán ${r.qty}× ${r.def.name} được ${F.xu(r.total)}.`, args: [cat, page, invRepo.count(c.uid, id) ? id : undefined] }; }
    if (act === 'sellq') return { modal: K.modal({ id: cid('m', c.uid, 'inventory', 'sellq', cat, page, id), title: 'Bán hoặc đăng chợ', fields: [{ id: 'qty', label: 'Số lượng', placeholder: '1', max: 6 }, { id: 'price', label: 'Giá đăng chợ (xu/cả lô). Bỏ trống = bán NPC', placeholder: 'ví dụ 5000', required: false, max: 10 }] }) };
    return undefined;
  },
  modal(c, act, [cat, page, id], f) {
    const qty = Math.floor(Number(f.get('qty'))); if (!(qty >= 1)) throw new GameError('Số lượng không hợp lệ.'); const priceRaw = f.get('price').trim();
    if (priceRaw) { const l = marketSvc.listItem(c.uid, { kind: 'item', itemId: id, qty, price: Number(priceRaw.replace(/[.,\s]/g, '')) }); return { notice: `🏪 Đã đăng chợ #${l.id}: ${l.summary} giá ${F.xu(l.price)}.`, args: [cat, page] }; }
    const r = shopSvc.sellItem(c.uid, id, qty); return { notice: `💰 Bán ${r.qty}× ${r.def.name} được ${F.xu(r.total)}.`, args: [cat, page] };
  },
};
/* ------------------------------------------------------------------ KHO CÁ */
const SORT = { moi: 'Mới nhất', cu: 'Cũ nhất', gia: 'Giá trị', can: 'Cân nặng', hiem: 'Độ hiếm' };
const fishbag = {
  render(c, [sort = 'moi', rar = '0', page = '0', sel, q = '']) {
    const rarMin = +rar || 1; const per = 8; const p = Math.max(0, +page); const query = q ? slug(q) : null;
    const { rows, total } = fishRepo.search(c.uid, { rarityMin: rarMin, sort, limit: per, offset: p * per, q: query }); const pages = Math.max(1, Math.ceil(total / per)); const files = []; let comps = [];
    const one = sel ? fishRepo.owned(c.uid, +sel) : null; let e;
    if (one) {
      const f = D.fishes.get(one.fish_id); const v = fishSys.variantById(one.variant); const fi = K.img('fish', f.id); const fr = K.img('effects', R.frameKey(f.rarity)); if (fi) files.push(fi.file); if (fr) files.push(fr.file); const mult = fishing.sellMultiplier(c.uid);
      e = K.embed({ title: `${E('fish', f.id)} ${f.name}${one.locked ? ' 🔒' : ''}${one.listed ? ' 🏪' : ''}`, desc: `${K.rar(f.rarity)}${v.id !== 'thuong' ? ` · ✨ ${v.name}` : ''}\n⚖️ ${F.kg(one.weight)} · Giá trị ${F.xu(one.base_value)} (bán ~${F.xu(Math.round(one.base_value * mult))})\n📍 ${D.locations.get(one.location)?.name || '—'} · ${F.abs(one.caught_at)}\n\n*${f.desc}*`, color: R.color(f.rarity), image: fi?.url, thumb: fr?.url });
      comps = [K.button({ id: cid('v', c.uid, 'fishbag', 'sell', sort, rar, page, one.id), label: 'Bán', style: 'success', disabled: !!one.locked || !!one.listed, emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'fishbag', 'lock', sort, rar, page, one.id), label: one.locked ? 'Mở khoá' : 'Khoá', emoji: '🔒', disabled: !!one.listed }), K.button({ id: cid('v', c.uid, 'fishbag', 'list', sort, rar, page, one.id), label: 'Đăng chợ…', disabled: !!one.locked || !!one.listed, emoji: K.emoji.btn('ui', 'market') }), K.button({ id: cid('v', c.uid, 'fishbag', 'show', sort, rar, page), label: '← Danh sách', emoji: '↩️' })];
    } else {
      const lines = rows.map((f) => { const d = D.fishes.get(f.fish_id); const v = fishSys.variantById(f.variant); return `${R.mark(f.rarity)} ${E('fish', d.id)} **${d.name}**${v.id !== 'thuong' ? ` ✨${v.name}` : ''} — ${F.kg(f.weight)} · ${F.num(f.base_value)} xu${f.locked ? ' 🔒' : ''}`; });
      e = K.embed({ title: `${E('ui', 'fish')} Kho cá (${F.num(total)})`, desc: lines.join('\n') || '*Không có con cá nào.*', color: COLOR.info, footer: `Sắp xếp: ${SORT[sort]} · Phẩm cấp ≥ ${R.name(rarMin)}${q ? ` · Tìm: ${q}` : ''}` });
      comps = [...K.pager(c.uid, 'fishbag', 'pg', p, pages, [sort, rar]), K.button({ id: cid('v', c.uid, 'sell', 'show'), label: 'Bán hàng loạt', style: 'success', emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'fishbag', 'search', sort, rar), label: 'Tìm kiếm…', emoji: '🔍' })];
      if (rows.length) comps.push(K.select({ id: cid('v', c.uid, 'fishbag', 'sel', sort, rar, p), placeholder: 'Chọn một con cá…', options: rows.map((f) => ({ label: `${D.fishes.get(f.fish_id).name} · ${F.kg(f.weight)}`, value: String(f.id), description: `${R.name(f.rarity)} · ${F.num(f.base_value)} xu`, emoji: K.emoji.btn('fish', f.fish_id) })) }));
      comps.push(K.select({ id: cid('v', c.uid, 'fishbag', 'sort', rar), placeholder: 'Sắp xếp…', options: Object.entries(SORT).map(([k, l]) => ({ label: l, value: k, default: k === sort })) }), K.select({ id: cid('v', c.uid, 'fishbag', 'rar', sort), placeholder: 'Lọc theo phẩm cấp…', options: D.rarities.map((r) => ({ label: `≥ ${r.name}`, value: String(r.id), default: r.id === rarMin })) }));
    }
    return K.msg({ embeds: [e], files, components: K.rows(comps) });
  },
  act(c, act, [a1, a2, a3, a4], i) {
    if (act === 'pgp') return { args: [a2, a3, a1] }; // pager extra [sort, rar]
    if (act === 'sort') return { args: [i.values[0], a1, '0'] }; if (act === 'rar') return { args: [a1, i.values[0], '0'] }; if (act === 'sel') return { args: [a1, a2, a3, i.values[0]] };
    if (act === 'lock') { const f = fishRepo.owned(c.uid, +a4); if (!f) throw new GameError('Không tìm thấy con cá.'); const v = f.locked ? 0 : 1; fishRepo.setLocked(c.uid, f.id, v); return { notice: v ? '🔒 Đã khoá cá.' : '🔓 Đã mở khoá cá.', args: [a1, a2, a3, a4] }; }
    if (act === 'sell') { const r = shopSvc.sellFish(c.uid, { ids: [+a4] }); return { notice: `💰 Đã bán cá được ${F.xu(r.total)}.`, args: [a1, a2, a3] }; }
    if (act === 'list') return { modal: K.modal({ id: cid('m', c.uid, 'fishbag', 'list', a1, a2, a3, a4), title: 'Đăng bán cá lên chợ', fields: [{ id: 'price', label: 'Giá bán (xu)', placeholder: 'ví dụ 25000', max: 10 }] }) };
    if (act === 'search') return { modal: K.modal({ id: cid('m', c.uid, 'fishbag', 'search', a1, a2), title: 'Tìm cá theo tên', fields: [{ id: 'q', label: 'Tên cá', placeholder: 'ví dụ: rô phi', max: 40 }] }) };
    return undefined;
  },
  modal(c, act, [a1, a2, a3, a4], f) {
    if (act === 'search') return { args: [a1, a2, '0', undefined, f.get('q')] };
    const l = marketSvc.listItem(c.uid, { kind: 'fish', refId: +a4, price: Number(f.get('price').replace(/[.,\s]/g, '')) }); return { notice: `🏪 Đã đăng chợ #${l.id}: ${l.summary} giá ${F.xu(l.price)}.`, args: [a1, a2, a3] };
  },
};
/* ------------------------------------------------------------------ BÁN HÀNG LOẠT */
const sell = {
  render(c, [rarMax = '3', loc = 'all']) {
    const rm = Math.max(1, Math.min(9, +rarMax)); const pv = shopSvc.previewSell(c.uid, { rarityMax: rm, location: loc === 'all' ? null : loc });
    const e = K.embed({ title: `${E('ui', 'coin')} Bán cá hàng loạt`, desc: `Bán tất cả cá **không khoá** có phẩm cấp ≤ **${R.name(rm)}**${loc !== 'all' ? ` tại **${D.locations.get(loc).name}**` : ''}.\n\n🐟 Số cá: **${F.num(pv.count)}**\n💰 Thu về dự kiến: **${F.xu(pv.total)}** (hệ số giá ×${pv.mult.toFixed(2)})\n\n*Cá đang khoá 🔒 hoặc đang rao bán sẽ không bị bán.*`, color: pv.count ? COLOR.ok : COLOR.dark });
    return K.msg({ embeds: [e], components: K.rows([K.button({ id: cid('v', c.uid, 'sell', 'go', rm, loc), label: `Bán ${F.num(pv.count)} cá`, style: rm >= 5 ? 'danger' : 'success', disabled: !pv.count, emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'fishbag', 'show'), label: 'Kho cá', emoji: K.emoji.btn('ui', 'fish') }),
      K.select({ id: cid('v', c.uid, 'sell', 'rar', loc), placeholder: 'Phẩm cấp tối đa được bán…', options: D.rarities.map((r) => ({ label: `≤ ${r.name}`, value: String(r.id), default: r.id === rm })) }), K.select({ id: cid('v', c.uid, 'sell', 'loc', rm), placeholder: 'Khu vực…', options: [{ label: 'Tất cả khu vực', value: 'all', default: loc === 'all' }, ...D.locList.map((l) => ({ label: l.name, value: l.id, default: l.id === loc }))] })]) });
  },
  act(c, act, [a1, a2], i) {
    if (act === 'rar') return { args: [i.values[0], a1] }; if (act === 'loc') return { args: [a1, i.values[0]] };
    if (act === 'go') { if (+a1 >= 5) return { confirm: { text: `Bán cả cá từ phẩm cấp **${R.name(+a1)}** trở xuống? Cá quý hiếm cũng sẽ bị bán!`, yes: ['sell', 'goyes', a1, a2], no: ['sell', 'show', a1, a2] } }; return sellNow(c, a1, a2); }
    if (act === 'goyes') return sellNow(c, a1, a2); return undefined;
  },
};
function sellNow(c, rm, loc) { const r = shopSvc.sellFish(c.uid, { rarityMax: +rm, location: loc === 'all' ? null : loc }); const hi = Object.entries(r.byRarity).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([k, v]) => `${v}× ${R.name(+k)}`).join(', '); return { notice: `💰 Đã bán **${r.count}** cá (${F.kg(r.weight)}) được **${F.xu(r.total)}** — ${hi}.${r.newAch?.length ? ` 🏆 ${r.newAch.map((a) => a.name).join(', ')}` : ''}`, args: [rm, loc] }; }
module.exports = { inventory, fishbag, sell };
