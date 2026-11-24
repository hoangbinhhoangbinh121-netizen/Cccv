'use strict';
/** Cửa hàng NPC, thị trường người chơi và chuyển xu. */
const K = require('../../ui/kit');
const { D, item: itemDef } = require('../../services/gameData');
const shopSvc = require('../../services/shopService');
const marketSvc = require('../../services/marketService');
const economy = require('../../services/economyService');
const rodRepo = require('../../database/repositories/rods');
const users = require('../../database/repositories/users');
const marketRepo = require('../../database/repositories/market');
const settings = require('../../database/repositories/settings');
const { ROD_TIER_LEVEL } = require('../../systems/progression');
const { GameError } = require('../../utils/errors');
const { now } = require('../../utils/time');
const { E, F, COLOR, cid } = K;

const price = (s) => Math.floor(Number(String(s).replace(/[.,\s]/g, '')));
/* ------------------------------------------------------------------ CỬA HÀNG */
const shop = {
  render(c, [cat = 'moi', page = '0', sel]) {
    const list = shopSvc.catalog(cat); const per = 8; const pages = Math.max(1, Math.ceil(list.length / per)); const p = Math.max(0, Math.min(pages - 1, +page)); const slice = list.slice(p * per, p * per + per); const bal = economy.balance(c.uid); const files = [];
    const it = sel ? list.find((x) => x.id === sel) : null; let e; let comps = [];
    if (it) {
      const isRod = it.kind === 'rod'; const d = isRod ? D.rods.get(it.id) : itemDef(it.id); const im = K.img(isRod ? 'rods' : D.baits.has(it.id) ? 'baits' : 'items', it.id); if (im) files.push(im.file);
      e = K.embed({ title: `${isRod ? E('rods', it.id) : K.itemEmoji(it.id)} ${it.name}`, desc: `${it.desc || d.desc || ''}\n\nGiá: **${F.xu(it.price)}**${isRod ? `\nYêu cầu cấp ${ROD_TIER_LEVEL[d.tier - 1]} để trang bị` : ''}\nSố dư: ${F.xu(bal)}`, color: COLOR.gold, thumb: im?.url });
      comps = isRod ? [K.button({ id: cid('v', c.uid, 'shop', 'buy', cat, p, it.id, 1), label: 'Mua', style: 'success', disabled: bal < it.price, emoji: K.emoji.btn('ui', 'coin') })] : [1, 10, 50].map((n) => K.button({ id: cid('v', c.uid, 'shop', 'buy', cat, p, it.id, n), label: `Mua ×${n} (${F.num(it.price * n)})`, style: n === 1 ? 'success' : 'primary', disabled: bal < it.price * n }));
      if (!isRod) comps.push(K.button({ id: cid('v', c.uid, 'shop', 'buyq', cat, p, it.id), label: 'Số lượng khác…', emoji: '✏️' }));
      comps.push(K.button({ id: cid('v', c.uid, 'shop', 'show', cat, p), label: '← Quay lại', emoji: '↩️' }));
    } else {
      e = K.embed({ title: `${E('ui', 'market')} Cửa hàng — ${shopSvc.CATS[cat]}`, desc: `${E('ui', 'coin')} Số dư: **${F.xu(bal)}**\n\n${slice.map((x) => `${x.kind === 'rod' ? E('rods', x.id) : K.itemEmoji(x.id)} **${x.name}** — ${F.xu(x.price)}`).join('\n') || '*Chưa có mặt hàng.*'}`, color: COLOR.gold, footer: 'Chọn món để xem chi tiết và mua · Cần mạnh hơn cũng có thể chế tạo bằng /chetao' });
      comps = [...K.pager(c.uid, 'shop', 'pg', p, pages, [cat]), K.button({ id: cid('v', c.uid, 'sell', 'show'), label: 'Bán cá', emoji: K.emoji.btn('ui', 'fish') })];
      if (slice.length) comps.push(K.select({ id: cid('v', c.uid, 'shop', 'sel', cat, p), placeholder: 'Chọn mặt hàng…', options: slice.map((x) => ({ label: `${x.name} — ${F.num(x.price)} xu`, value: x.id, description: (x.desc || '').slice(0, 90) })) }));
      comps.push(K.select({ id: cid('v', c.uid, 'shop', 'cat'), placeholder: 'Danh mục…', options: Object.entries(shopSvc.CATS).map(([k, l]) => ({ label: l, value: k, default: k === cat })) }));
    }
    return K.msg({ embeds: [e], files, components: K.rows(comps) });
  },
  act(c, act, [a1, a2, a3, a4], i) {
    if (act === 'pgp') return { args: [a2, a1] }; if (act === 'cat') return { args: [i.values[0], '0'] }; if (act === 'sel') return { args: [a1, a2, i.values[0]] };
    if (act === 'buy') { const r = shopSvc.buy(c.uid, a3, +a4 || 1); return { notice: r.kind === 'rod' ? `🛒 Đã mua **${r.def?.name || r.name || 'cần câu'}** (−${F.xu(r.cost ?? 0)}).` : `🛒 Đã mua ${r.qty}× **${r.def.name}** (−${F.xu(r.cost)}).`, args: [a1, a2, a3] }; }
    if (act === 'buyq') return { modal: K.modal({ id: cid('m', c.uid, 'shop', 'buyq', a1, a2, a3), title: 'Mua số lượng tuỳ chọn', fields: [{ id: 'qty', label: 'Số lượng (1–999)', placeholder: '25', max: 3 }] }) };
    return undefined;
  },
  modal(c, act, [a1, a2, a3], f) { const q = Math.floor(Number(f.get('qty'))); if (!(q >= 1 && q <= 999)) throw new GameError('Số lượng phải từ 1 đến 999.'); const r = shopSvc.buy(c.uid, a3, q); return { notice: `🛒 Đã mua ${r.qty}× **${r.def.name}** (−${F.xu(r.cost)}).`, args: [a1, a2, a3] }; },
};
/* ------------------------------------------------------------------ THỊ TRƯỜNG */
const KIND = { all: 'Tất cả', fish: 'Cá', rod: 'Cần câu', item: 'Vật phẩm' }; const SORT = { moi: 'Mới nhất', re: 'Giá thấp', dat: 'Giá cao' };
const line = (l) => `\`#${l.id}\` ${l.kind === 'fish' ? '🐟' : l.kind === 'rod' ? '🎣' : '📦'} **${l.summary}** — ${F.xu(l.price)} · ${F.rel(l.expires_at)}`;
const market = {
  render(c, [mode = 'browse', kind = 'all', sort = 'moi', page = '0', sel]) {
    const per = 8; const p = Math.max(0, +page); let rows; let total; let title;
    if (mode === 'mine') { const r = marketRepo.search({ seller: c.uid, limit: per, offset: p * per, sort }); rows = r.rows; total = r.total; title = 'Tin đăng của tôi'; }
    else if (mode === 'hist') { rows = marketRepo.historyOf(c.uid, 12); total = rows.length; title = 'Lịch sử giao dịch'; }
    else { const r = marketRepo.search({ kind: kind === 'all' ? null : kind, sort, limit: per, offset: p * per }); rows = r.rows; total = r.total; title = 'Chợ người chơi'; }
    const pages = Math.max(1, Math.ceil(total / per)); const one = sel ? marketRepo.get(+sel) : null; let e; let comps = [];
    const fee = settings.get('market_fee_pct');
    if (one) {
      const mine = one.seller_id === c.uid; const seller = users.get(one.seller_id)?.name || '?';
      e = K.embed({ title: `🏪 Tin đăng #${one.id}`, desc: `**${one.summary}**\nGiá: **${F.xu(one.price)}**\nNgười bán: ${seller}\nHết hạn: ${F.rel(one.expires_at)}\nTrạng thái: **${{ active: 'Đang bán', sold: 'Đã bán', cancelled: 'Đã huỷ', expired: 'Hết hạn' }[one.status]}**`, color: COLOR.gold, footer: `Phí chợ ${fee}% trừ vào tiền người bán` });
      comps = [K.button({ id: cid('v', c.uid, 'market', 'buy', mode, kind, sort, page, one.id), label: `Mua (${F.num(one.price)} xu)`, style: 'success', disabled: mine || one.status !== 'active', emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'market', 'cancel', mode, kind, sort, page, one.id), label: 'Huỷ tin', style: 'danger', disabled: !mine || one.status !== 'active' }), K.button({ id: cid('v', c.uid, 'market', 'show', mode, kind, sort, page), label: '← Danh sách', emoji: '↩️' })];
    } else {
      e = K.embed({ title: `${E('ui', 'market')} ${title} (${total})`, desc: rows.map(mode === 'hist' ? (l) => `${l.status === 'sold' ? (l.seller_id === c.uid ? '💰 Bán' : '🛒 Mua') : '↩️ ' + l.status} · ${line(l)}` : line).join('\n') || '*Chưa có tin đăng nào.*', color: COLOR.gold, footer: `Phí chợ ${fee}% · tối đa ${settings.get('market_max_listings')} tin/người · đăng bán cá/vật phẩm ở /khoca và /kho` });
      comps = [K.selectRow(['browse', 'mine', 'hist'].map((m) => K.button({ id: cid('v', c.uid, 'market', 'mode', m), label: { browse: 'Duyệt chợ', mine: 'Tin của tôi', hist: 'Lịch sử' }[m], style: m === mode ? 'primary' : 'secondary', disabled: m === mode })))];
      if (mode !== 'hist') comps.push(K.selectRow(K.pager(c.uid, 'market', 'pg', p, pages, [mode, kind, sort])));
      if (mode !== 'hist' && rows.length) comps.push(K.select({ id: cid('v', c.uid, 'market', 'sel', mode, kind, sort, p), placeholder: 'Chọn tin đăng…', options: rows.map((l) => ({ label: `#${l.id} ${l.summary}`.slice(0, 100), value: String(l.id), description: `${F.num(l.price)} xu`.slice(0, 100) })) }));
      if (mode === 'browse') comps.push(K.select({ id: cid('v', c.uid, 'market', 'kind', sort), placeholder: 'Loại hàng…', options: Object.entries(KIND).map(([k, l]) => ({ label: l, value: k, default: k === kind })) }), K.select({ id: cid('v', c.uid, 'market', 'sort', kind), placeholder: 'Sắp xếp…', options: Object.entries(SORT).map(([k, l]) => ({ label: l, value: k, default: k === sort })) }));
      if (mode === 'mine') { const eq = users.equipment(c.uid); const rods = rodRepo.list(c.uid).filter((r) => !r.listed && !r.locked && r.id !== eq.rod_id); if (rods.length && rodRepo.countOwned(c.uid) > 1) comps.push(K.select({ id: cid('v', c.uid, 'market', 'rodlist', mode), placeholder: 'Đăng bán một cần câu…', options: rods.slice(0, 25).map((r) => ({ label: K.rodName(r), value: String(r.id), description: D.rods.get(r.rod_id).tierName })) })); }
    }
    return K.msg({ embeds: [e], components: K.rows(comps) });
  },
  act(c, act, [a1, a2, a3, a4, a5], i) {
    if (act === 'mode') return { args: [a1] }; if (act === 'pgp') return { args: [a2, a3, a4, a1] }; if (act === 'kind') return { args: ['browse', i.values[0], a1, '0'] }; if (act === 'sort') return { args: ['browse', a1, i.values[0], '0'] }; if (act === 'sel') return { args: [a1, a2, a3, a4, i.values[0]] };
    if (act === 'buy') return { confirm: { text: `Mua tin đăng #${a5} với giá hiển thị? Tiền sẽ bị trừ ngay.`, yes: ['market', 'buyyes', a1, a2, a3, a4, a5], no: ['market', 'show', a1, a2, a3, a4, a5] } };
    if (act === 'buyyes') { const r = marketSvc.buy(c.uid, +a5); return { notice: `🛒 Mua thành công **${r.listing.summary}** với giá ${F.xu(r.listing.price)}!`, args: [a1, a2, a3, a4] }; }
    if (act === 'cancel') { marketSvc.cancel(c.uid, +a5); return { notice: '↩️ Đã huỷ tin và trả hàng về kho.', args: [a1, a2, a3, a4] }; }
    if (act === 'rodlist') return { modal: K.modal({ id: cid('m', c.uid, 'market', 'rodlist', i.values[0]), title: 'Đăng bán cần câu', fields: [{ id: 'price', label: 'Giá bán (xu)', placeholder: 'ví dụ 150000', max: 10 }] }) };
    return undefined;
  },
  modal(c, act, [rid], f) { const l = marketSvc.listItem(c.uid, { kind: 'rod', refId: +rid, price: price(f.get('price')) }); return { notice: `🏪 Đã đăng chợ #${l.id}: ${l.summary} giá ${F.xu(l.price)}.`, args: ['mine'] }; },
};
/* ------------------------------------------------------------------ CHUYỂN XU */
const trade = {
  render(c, [to, amount]) {
    const t = users.get(to); if (!t) throw new GameError('Người nhận chưa đăng ký chơi.'); const amt = Math.floor(+amount); const fee = Math.ceil((amt * settings.get('transfer_fee_pct')) / 100); const bal = economy.balance(c.uid);
    const e = K.embed({ title: '🤝 Chuyển xu', desc: `Người nhận: **${t.name}**\nSố xu: **${F.xu(amt)}**\nPhí (${settings.get('transfer_fee_pct')}%): **${F.xu(fee)}**\nTổng trừ: **${F.xu(amt + fee)}** · Số dư: ${F.xu(bal)}\n\nHạn mức chuyển mỗi ngày: ${F.xu(settings.get('transfer_daily_cap'))} · cần cấp ${settings.get('transfer_min_level')}.`, color: COLOR.warn });
    return K.msg({ embeds: [e], components: K.rows([K.button({ id: cid('v', c.uid, 'trade', 'go', to, amt), label: 'Xác nhận chuyển', style: 'success', disabled: bal < amt + fee || amt < 100 }), K.button({ id: cid('v', c.uid, 'trade', 'no', to, amt), label: 'Huỷ', style: 'secondary' })]) });
  },
  act(c, act, [to, amt]) {
    if (act === 'go') { const r = marketSvc.transferXu(c.uid, to, +amt); return { payload: K.msg({ embeds: [K.embed({ title: '✅ Chuyển xu thành công', desc: `Đã chuyển **${F.xu(r.amount)}** (phí ${F.xu(r.fee)}) cho <@${to}>.`, color: COLOR.ok })], components: [] }) }; }
    if (act === 'no') return { payload: K.msg({ embeds: [K.embed({ title: 'Đã huỷ giao dịch.', color: COLOR.dark })], components: [] }) }; return undefined;
  },
};
module.exports = { shop, market, trade };
