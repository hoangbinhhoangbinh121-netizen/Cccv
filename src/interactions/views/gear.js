'use strict';
/** Cần câu (/cancau) và xưởng chế tác: nâng cấp, cường hoá, khảm ngọc, thức tỉnh, chế tạo. */
const K = require('../../ui/kit');
const { D } = require('../../services/gameData');
const rodSvc = require('../../services/rodService');
const invSvc = require('../../services/inventoryService');
const economy = require('../../services/economyService');
const rodRepo = require('../../database/repositories/rods');
const invRepo = require('../../database/repositories/inventory');
const users = require('../../database/repositories/users');
const rodSys = require('../../systems/rods');
const { ROD_TIER_LEVEL } = require('../../systems/progression');
const R = require('../../systems/rarity');
const { GameError } = require('../../utils/errors');
const { E, F, COLOR, cid } = K;

const TIER_COLOR = [0x8b5a2b, 0x9aa0a6, 0xc0c0c8, 0xf0c040, 0x66d9e8, 0x4aa3df, 0x9b59b6, 0xe84393, 0xff7043, 0xffd700];
const statLine = (st) => rodSys.STATS.map((k) => `${E('ui', rodSys.STAT_ICON[k])} ${rodSys.STAT_NAMES[k]}: **${st[k]}**`).join('\n');
const need = (uid, items) => Object.entries(items).map(([k, q]) => { const have = invRepo.count(uid, k); return `${have >= q ? '✅' : '❌'} ${K.itemLine(k)} ${have}/${q}`; }).join('\n') || '—';
const sorted = (uid) => { const eq = users.equipment(uid); return rodRepo.list(uid).sort((a, b) => (b.id === eq.rod_id) - (a.id === eq.rod_id) || D.rods.get(b.rod_id).tier - D.rods.get(a.rod_id).tier || b.level - a.level); };
const pickRod = (uid, rid) => { const l = sorted(uid); return l.find((r) => String(r.id) === String(rid)) || l[0]; };

/* ------------------------------------------------------------------ DANH SÁCH / CHI TIẾT CẦN */
const rod = {
  render(c, [rid, page = '0']) {
    const list = sorted(c.uid); if (!list.length) throw new GameError('Bạn chưa có cần câu nào.'); const inst = pickRod(c.uid, rid); const v = rodSvc.view(inst); const def = v.def; const eq = users.equipment(c.uid); const files = [];
    const ri = K.img('rods', inst.skin || inst.rod_id); if (ri) files.push(ri.file); const sk = rodSys.sockets(inst); const ns = rodSys.socketCount(def, inst);
    const e = K.embed({ title: `${E('rods', inst.skin || inst.rod_id)} ${K.rodName(inst)}${inst.id === eq.rod_id ? ' · ✅ đang dùng' : ''}${inst.locked ? ' 🔒' : ''}${inst.listed ? ' 🏪' : ''}`, desc: `Bậc **${def.tierName}** · ${def.desc}\n\n${statLine(v.stats)}`, color: TIER_COLOR[def.tier - 1], thumb: ri?.url,
      fields: [{ name: `${E('ui', 'durability')} Độ bền`, value: `${inst.durability}/${v.stats.durability} ${F.bar(inst.durability, v.stats.durability, 10)}`, inline: true }, { name: 'Cấp / Cường hoá', value: `Lv ${inst.level}/${def.maxLevel} · +${inst.enhance}/${def.enhanceCap} · Thức tỉnh ${inst.awaken}/3`, inline: true },
        { name: 'Nội tại', value: v.innate ? `**${v.innate.name}** (${v.innate.value}) — ${v.innate.desc}` : '—', inline: false }, { name: `Ô khảm (${ns})`, value: ns ? Array.from({ length: ns }, (_, i) => `${i + 1}. ${sk[i] ? K.itemLine(sk[i]) : '*(trống)*'}`).join('\n') : 'Không có ô khảm', inline: false },
        { name: 'Yêu cầu cấp', value: `${ROD_TIER_LEVEL[def.tier - 1]}`, inline: true }, { name: 'Trang bị phụ', value: [['bait_id', 'Mồi'], ['float_id', 'Phao'], ['line_id', 'Dây'], ['hook_id', 'Lưỡi']].map(([k, l]) => `${l}: ${eq[k] ? K.itemName(eq[k]) : '—'}`).join(' · '), inline: false }], footer: `Cần ${list.indexOf(inst) + 1}/${list.length}` });
    const per = 24; const pages = Math.ceil(list.length / per); const p = Math.max(0, Math.min(pages - 1, +page));
    const buttons = [K.button({ id: cid('v', c.uid, 'rod', inst.id === eq.rod_id ? 'unequip' : 'equip', inst.id), label: inst.id === eq.rod_id ? 'Tháo' : 'Trang bị', style: 'primary', disabled: !!inst.listed, emoji: K.emoji.btn('ui', 'rod') }), K.button({ id: cid('v', c.uid, 'rod', 'repair', inst.id), label: 'Sửa cần', style: 'success', disabled: inst.durability >= v.stats.durability, emoji: '🔧' }),
      K.button({ id: cid('v', c.uid, 'rod', 'lock', inst.id), label: inst.locked ? 'Mở khoá' : 'Khoá', emoji: '🔒' }), K.button({ id: cid('v', c.uid, 'workshop', 'show', 'upgrade', inst.id), label: 'Xưởng', style: 'secondary', emoji: '🛠️' }), K.button({ id: cid('v', c.uid, 'rod', 'dismantle', inst.id), label: 'Phân giải', style: 'danger', disabled: inst.id === eq.rod_id || !!inst.locked || !!inst.listed, emoji: '♻️' })];
    const skinOpts = rodRepo.skins(c.uid).map((s) => D.rods.get(s)).filter((s) => s && s.tier <= def.tier).slice(0, 24);
    return K.msg({ embeds: [e], files, components: K.rows([...buttons, K.select({ id: cid('v', c.uid, 'rod', 'pick'), placeholder: 'Chọn cần câu…', options: list.slice(p * per, p * per + per).map((r) => ({ label: K.rodName(r), value: String(r.id), description: `${D.rods.get(r.rod_id).tierName} · độ bền ${r.durability}`, default: r.id === inst.id })) }),
      skinOpts.length > 1 ? K.select({ id: cid('v', c.uid, 'rod', 'skin', inst.id), placeholder: `Đổi ngoại hình (${F.xu(rodSys.skinCost(def))})…`, options: skinOpts.map((s) => ({ label: s.name, value: s.id, default: (inst.skin || inst.rod_id) === s.id })) }) : null,
      K.select({ id: cid('v', c.uid, 'rod', 'acc', 'bait'), placeholder: 'Chọn mồi / phao / dây / lưỡi…', options: accessoryOptions(c.uid, eq) })].filter(Boolean)) });
  },
  act(c, act, [a1, a2], i) {
    const id = +a1;
    if (act === 'pick') return { args: [i.values[0]] };
    if (act === 'equip') { const d = rodSvc.equip(c.uid, id); return { notice: `✅ Đã trang bị **${d.name}**.`, args: [id] }; } if (act === 'unequip') { rodSvc.unequip(c.uid); return { notice: 'Đã tháo cần câu.', args: [id] }; }
    if (act === 'repair') { const r = rodSvc.repair(c.uid, id); return { notice: `🔧 Đã sửa cần: +${r.restored} độ bền, tốn ${F.xu(r.cost)}.`, args: [id] }; }
    if (act === 'lock') return { notice: rodSvc.toggleLock(c.uid, id) ? '🔒 Đã khoá cần.' : '🔓 Đã mở khoá cần.', args: [id] };
    if (act === 'skin') { const r = rodSvc.setSkin(c.uid, id, i.values[0]); return { notice: `🎨 Đã đổi ngoại hình thành **${r.skin.name}** (−${F.xu(r.cost)}).`, args: [id] }; }
    if (act === 'dismantle') return { confirm: { text: 'Phân giải cần câu này? Cần sẽ biến mất, bạn nhận lại vật liệu và xu.', yes: ['rod', 'dismantleyes', id], no: ['rod', 'show', id] } };
    if (act === 'dismantleyes') { const r = rodSvc.dismantle(c.uid, id); return { notice: `♻️ Đã phân giải **${r.def.name}**: ${K.itemsText(r.ret.mats)} + ${F.xu(r.ret.xu)}.`, args: [] }; }
    if (act === 'acc') { const [slot, val] = i.values[0].split(':'); rodSvc.equipAccessory(c.uid, slot, val === '-' ? null : val); return { notice: val === '-' ? 'Đã tháo phụ kiện.' : `✅ Đã trang bị **${K.itemName(val)}**.`, args: [a2] }; }
    return undefined;
  },
};
function accessoryOptions(uid, eq) {
  const inv = invRepo.all(uid); const out = []; const EQ = { bait: 'bait_id', float: 'float_id', line: 'line_id', hook: 'hook_id' }; const LB = { bait: 'Mồi', float: 'Phao', line: 'Dây', hook: 'Lưỡi' };
  for (const slot of Object.keys(EQ)) { if (eq[EQ[slot]]) out.push({ label: `Tháo ${LB[slot].toLowerCase()} (${K.itemName(eq[EQ[slot]])})`, value: `${slot}:-`, emoji: '➖' }); }
  for (const r of inv) { const d = require('../../services/gameData').item(r.item_id); if (d && EQ[d.type]) out.push({ label: `${LB[d.type]}: ${d.name} ×${r.qty}`, value: `${d.type}:${d.id}`, description: (d.desc || '').slice(0, 90), default: eq[EQ[d.type]] === d.id }); }
  if (!out.length) out.push({ label: 'Chưa có mồi/phụ kiện – hãy mua ở /cuahang', value: 'bait:-', emoji: '🛒' }); return out.slice(0, 25);
}
/* ------------------------------------------------------------------ XƯỞNG */
const MODES = { upgrade: 'Nâng cấp', enhance: 'Cường hoá', socket: 'Khảm ngọc', awaken: 'Thức tỉnh', craft: 'Chế tạo' };
const workshop = {
  render(c, [mode = 'upgrade', rid, extra]) {
    const list = sorted(c.uid); if (!list.length) throw new GameError('Bạn chưa có cần câu nào.'); const inst = pickRod(c.uid, rid); const v = rodSvc.view(inst); const def = v.def; const bal = economy.balance(c.uid); const files = []; const ri = K.img('rods', inst.skin || inst.rod_id); if (ri) files.push(ri.file);
    const head = `${E('rods', inst.skin || inst.rod_id)} **${K.rodName(inst)}** · ${E('ui', 'coin')} ${F.xu(bal)}`; let desc = head; let fields = []; let comps = [];
    const pick = K.select({ id: cid('v', c.uid, 'workshop', 'pick', mode), placeholder: 'Chọn cần câu…', options: list.slice(0, 25).map((r) => ({ label: K.rodName(r), value: String(r.id), default: r.id === inst.id })) });
    if (mode === 'upgrade') {
      if (inst.level >= def.maxLevel) desc += '\n\n✅ Cần đã đạt cấp tối đa.'; else { const cost = rodSys.upgradeCost(def, inst.level); const nx = rodSys.computeStats({ ...inst, level: inst.level + 1 }).stats;
        desc += `\n\n**Lv ${inst.level} → ${inst.level + 1}**\n${rodSys.STATS.map((k) => `${rodSys.STAT_NAMES[k]}: ${v.stats[k]} → **${nx[k]}**`).join(' · ')}\nĐộ bền tối đa: ${v.stats.durability} → **${nx.durability}**`; fields = [{ name: 'Chi phí', value: `${F.xu(cost.xu)}\n${need(c.uid, cost.mats)}` }];
        comps = [K.button({ id: cid('v', c.uid, 'workshop', 'do', 'upgrade', inst.id), label: 'Nâng cấp', style: 'success', emoji: '⬆️' })]; }
    } else if (mode === 'enhance') {
      if (inst.enhance >= def.enhanceCap) desc += '\n\n✅ Cần đã đạt giới hạn cường hoá.'; else { const t = inst.enhance + 1; const cost = rodSys.enhanceCost(def, t); const rate = rodSys.enhanceChance(t, inst.pity); const charms = invRepo.count(c.uid, 'bua_bao_ho');
        desc += `\n\n**+${inst.enhance} → +${t}** · Tỷ lệ thành công **${F.pct(rate, 0)}**${inst.pity ? ` (bảo hiểm +${inst.pity * 2}%)` : ''}\n${t >= 6 ? '⚠️ Thất bại sẽ **tụt 1 cấp** cường hoá (dùng Bùa Bảo Hộ để tránh).' : 'Thất bại ở mức này không bị tụt cấp.'}`; fields = [{ name: 'Chi phí', value: `${F.xu(cost.xu)}\n${need(c.uid, { [cost.stone]: cost.stones })}` }, { name: 'Bùa Bảo Hộ', value: `${charms} cái` }];
        comps = [K.button({ id: cid('v', c.uid, 'workshop', 'do', 'enhance', inst.id, 0), label: 'Cường hoá', style: 'success', emoji: '🔨' }), K.button({ id: cid('v', c.uid, 'workshop', 'do', 'enhance', inst.id, 1), label: 'Cường hoá + Bùa', style: 'primary', disabled: t < 6 || !charms, emoji: K.emoji.btn('items', 'bua_bao_ho') })]; }
    } else if (mode === 'socket') {
      const n = rodSys.socketCount(def, inst); const sk = rodSys.sockets(inst); desc += `\n\nÔ khảm: ${n ? Array.from({ length: n }, (_, k) => `**${k + 1}.** ${sk[k] ? K.itemLine(sk[k]) : '*(trống)*'}`).join(' · ') : '**Cần này không có ô khảm.**'}`;
      const gems = invRepo.all(c.uid).filter((r) => D.items.get(r.item_id)?.type === 'gem'); const slot = Math.min(n || 1, Math.max(1, +extra || 1));
      if (n) { comps = [...Array.from({ length: n }, (_, k) => K.button({ id: cid('v', c.uid, 'workshop', 'slot', 'socket', inst.id, k + 1), label: `Ô ${k + 1}`, style: slot === k + 1 ? 'primary' : 'secondary', disabled: false })), K.button({ id: cid('v', c.uid, 'workshop', 'unsocket', 'socket', inst.id, slot), label: `Gỡ ô ${slot}`, style: 'danger', disabled: !sk[slot - 1] })].slice(0, 5);
        if (gems.length) comps.push(K.select({ id: cid('v', c.uid, 'workshop', 'gem', 'socket', inst.id, slot), placeholder: `Chọn ngọc để khảm vào ô ${slot}…`, options: gems.slice(0, 25).map((g) => { const d = D.items.get(g.item_id); return { label: `${d.name} ×${g.qty}`, value: g.item_id, description: `${rodSys.STAT_NAMES[d.gem.stat]} +${d.gem.value} · phí ${F.num(500 * d.tier)} xu` }; }) })); else fields = [{ name: 'Chưa có ngọc', value: 'Kiếm ngọc từ rương, boss và chế tạo.' }]; }
    } else if (mode === 'awaken') {
      if (def.tier < 3) desc += '\n\n❌ Chỉ cần từ bậc Bạc trở lên mới thức tỉnh được.'; else if (inst.awaken >= 3) desc += '\n\n✅ Đã thức tỉnh tối đa.'; else { const ac = rodSys.awakenCost(def, inst);
        desc += `\n\n**Giai đoạn ${ac.stage}/3** — chỉ số +8%, nội tại mạnh hơn${ac.stage === 3 ? ', **+1 ô khảm**' : ''}.\nYêu cầu: cấp cần ${ac.level} ${inst.level >= ac.level ? '✅' : `❌ (${inst.level})`} · cường hoá +${ac.enhance} ${inst.enhance >= ac.enhance ? '✅' : `❌ (+${inst.enhance})`}`; fields = [{ name: 'Chi phí', value: `${F.xu(ac.xu)}\n${need(c.uid, ac.mats)}` }]; comps = [K.button({ id: cid('v', c.uid, 'workshop', 'do', 'awaken', inst.id), label: 'Thức tỉnh', style: 'success', emoji: '✨' })]; }
    } else if (mode === 'craft') {
      const lv = users.get(c.uid).level; const recs = D.recipes.rods; const items = D.recipes.items; const sel = extra; const rec = recs.find((r) => r.id === sel) || items.find((r) => r.id === sel);
      desc = `${E('ui', 'coin')} ${F.xu(bal)} · Cấp ${lv}\nChọn công thức bên dưới.`;
      if (rec) { desc += rec.rod ? `\n\n**${rec.name}** (cần cấp ${rec.level})` : `\n\n**${rec.name}**`; fields = [{ name: 'Nguyên liệu', value: `${F.xu(rec.xu)}\n${need(c.uid, rec.mats || rec.in)}` }, { name: 'Tạo ra', value: rec.rod ? `🎣 ${D.rods.get(rec.rod).name}` : K.itemsText(rec.out) }]; comps = [K.button({ id: cid('v', c.uid, 'workshop', 'craft', 'craft', rec.id, 1), label: 'Chế tạo', style: 'success', emoji: '🔨' }), rec.in ? K.button({ id: cid('v', c.uid, 'workshop', 'craft', 'craft', rec.id, 10), label: 'Chế tạo ×10', style: 'primary', emoji: '🔨' }) : null]; }
      comps.push(K.select({ id: cid('v', c.uid, 'workshop', 'recipe', 'craft', inst.id), placeholder: 'Chọn công thức…', options: [...recs.map((r) => ({ label: r.name, value: r.id, description: `Cần câu · cấp ${r.level} · ${F.num(r.xu)} xu`, emoji: '🎣' })), ...items.map((r) => ({ label: r.name, value: r.id, description: `${F.num(r.xu)} xu`, emoji: '⚗️' }))].slice(0, 25) }));
    }
    const tabs = Object.entries(MODES).map(([m, l]) => K.button({ id: cid('v', c.uid, 'workshop', 'show', m, inst.id), label: l, style: m === mode ? 'primary' : 'secondary', disabled: m === mode }));
    return K.msg({ embeds: [K.embed({ title: `🛠️ Xưởng — ${MODES[mode]}`, desc, color: TIER_COLOR[def.tier - 1], thumb: ri?.url, fields })], files, components: K.rows([...tabs, ...comps.filter(Boolean), mode !== 'craft' ? pick : null]) });
  },
  act(c, act, [a1, a2, a3, a4], i) {
    if (act === 'pick') return { args: [a1, i.values[0]] };
    if (act === 'do') {
      const id = +a2;
      if (a1 === 'upgrade') { const r = rodSvc.upgradeLevel(c.uid, id); return { notice: `⬆️ Nâng cấp thành công! Cần đạt **Lv ${r.level}**.`, args: ['upgrade', id] }; }
      if (a1 === 'enhance') { const r = rodSvc.enhance(c.uid, id, { useCharm: a3 === '1' }); return { notice: r.success ? `🔨 **Thành công!** +${r.from} → **+${r.to}** (tỷ lệ ${F.pct(r.rate, 0)}).` : `💥 **Thất bại** (tỷ lệ ${F.pct(r.rate, 0)}). ${r.charmUsed ? 'Bùa Bảo Hộ đã bảo vệ cấp cường hoá.' : r.downgraded ? `Cần tụt xuống **+${r.to}**.` : 'Cấp cường hoá được giữ nguyên.'} Lần sau dễ hơn nhờ bảo hiểm.`, args: ['enhance', id] }; }
      if (a1 === 'awaken') { const r = rodSvc.awaken(c.uid, id); return { notice: `✨ Thức tỉnh giai đoạn **${r.stage}** thành công!${r.bonusSocket ? ' +1 ô khảm!' : ''}`, args: ['awaken', id] }; }
    }
    if (act === 'slot') return { args: ['socket', a2, a3] };
    if (act === 'gem') { const r = rodSvc.socketGem(c.uid, +a2, i.values[0], +a3); return { notice: `💎 Đã khảm ngọc vào ô ${r.slot} (−${F.xu(r.fee)})${r.replaced ? `, ngọc cũ **${K.itemName(r.replaced)}** đã trả về kho` : ''}.`, args: ['socket', a2, a3] }; }
    if (act === 'unsocket') { const g = rodSvc.unsocket(c.uid, +a2, +a3); return { notice: `Đã gỡ **${K.itemName(g)}** về kho.`, args: ['socket', a2, a3] }; }
    if (act === 'recipe') return { args: ['craft', a2, i.values[0]] };
    if (act === 'craft') {
      const rod = D.recipes.rods.find((r) => r.id === a2); if (rod) { const r = rodSvc.craftRod(c.uid, a2); return { notice: `🔨 Chế tạo thành công **${r.def.name}**!`, args: ['craft', '', a2] }; }
      const r = rodSvc.craftItem(c.uid, a2, +a3 || 1); return { notice: `🔨 Đã chế tạo ${K.itemsText(r.out)}.`, args: ['craft', '', a2] };
    }
    return undefined;
  },
};
module.exports = { rod, workshop };
