'use strict';
/** Thú cưng (/thucung) và Boss (/boss, /toidau). */
const K = require('../../ui/kit');
const { D } = require('../../services/gameData');
const petSvc = require('../../services/petService');
const bossSvc = require('../../services/bossService');
const invRepo = require('../../database/repositories/inventory');
const bossRepo = require('../../database/repositories/bosses');
const users = require('../../database/repositories/users');
const petRepo = require('../../database/repositories/pets');
const R = require('../../systems/rarity');
const { GameError } = require('../../utils/errors');
const { E, F, COLOR, cid } = K;

const STAT_N = { luck: 'May mắn', bite: 'Cắn câu', rare: 'Cá hiếm', weight: 'Cân nặng', exp: 'EXP', reel: 'Kéo', coin: 'Xu', durability: 'Độ bền', detect: 'Phát hiện' };
const sorted = (uid) => { const eq = users.equipment(uid); return petSvc.list(uid).sort((a, b) => (b.inst.id === eq.pet_id) - (a.inst.id === eq.pet_id) || b.def.rarity - a.def.rarity || b.inst.level - a.inst.level); };
const pet = {
  render(c, [pid]) {
    const list = sorted(c.uid); const eq = users.equipment(c.uid); const eggs = invRepo.all(c.uid).filter((r) => D.items.get(r.item_id)?.type === 'egg');
    if (!list.length) return K.msg({ embeds: [K.embed({ title: `${E('ui', 'pet')} Thú cưng`, desc: 'Bạn chưa có thú cưng nào.\nMua **Trứng Thú** ở `/cuahang` → danh mục *Thú cưng*, rồi ấp tại đây.', color: COLOR.info })], components: K.rows(eggs.length ? [K.select({ id: cid('v', c.uid, 'pet', 'egg'), placeholder: 'Ấp trứng…', options: eggs.map((r) => ({ label: `${D.items.get(r.item_id).name} ×${r.qty}`, value: r.item_id })) })] : []) });
    const v = list.find((x) => String(x.inst.id) === String(pid)) || list[0]; const { inst, def } = v; const info = petSvc.evolveInfo(inst); const files = []; const stage = inst.stage >= 2 ? `${def.id}_tienhoa` : def.id; const im = K.img('pets', stage); if (im) files.push(im.file);
    const need = v.need; const food = invRepo.all(c.uid).filter((r) => D.items.get(r.item_id)?.type === 'petfood');
    const e = K.embed({ title: `${E('pets', stage)} ${inst.nickname || def.name}${inst.id === eq.pet_id ? ' · ✅ đang đi cùng' : ''}`, desc: `${K.rar(def.rarity)} · ${def.group} · Giai đoạn ${inst.stage}/2\nCấp **${inst.level}/${def.maxLevel}** — ${F.num(inst.exp)}/${F.num(need)} EXP\n${F.bar(inst.exp, need, 12)}\n💞 Thân thiết ${inst.bond}/100 ${F.bar(inst.bond, 100, 10)}`, color: R.color(def.rarity), thumb: im?.url,
      fields: [{ name: 'Chỉ số cộng thêm', value: Object.entries(v.stats).map(([k, x]) => `${STAT_N[k] || k}: **+${x}**`).join(' · ') || '—' }, { name: `Kỹ năng: ${def.skill.name}`, value: `${def.skill.desc} (${F.pct(def.skill.chance, 0)}/lần câu)` }, { name: `Nội tại: ${def.innate.name}`, value: 'Luôn có hiệu lực khi đi cùng.' },
        { name: 'Tiến hoá', value: inst.stage >= 2 ? '✅ Đã tiến hoá' : `Cấp ${info.level} ${inst.level >= info.level ? '✅' : '❌'} · Thân thiết ${info.bond} ${inst.bond >= info.bond ? '✅' : '❌'}\n${Object.entries(info.mats).map(([k, q]) => `${K.itemLine(k)} ${invRepo.count(c.uid, k)}/${q}`).join(', ')} · ${F.xu(info.xu)}` }], footer: `Thú ${list.indexOf(v) + 1}/${list.length}` });
    const comps = [K.button({ id: cid('v', c.uid, 'pet', inst.id === eq.pet_id ? 'unequip' : 'equip', inst.id), label: inst.id === eq.pet_id ? 'Cho nghỉ' : 'Mang theo', style: 'primary', emoji: K.emoji.btn('ui', 'pet') }), K.button({ id: cid('v', c.uid, 'pet', 'rename', inst.id), label: 'Đặt tên…', emoji: '✏️' }), K.button({ id: cid('v', c.uid, 'pet', 'evolve', inst.id), label: 'Tiến hoá', style: 'success', disabled: inst.stage >= 2, emoji: '🌟' })];
    comps.push(K.select({ id: cid('v', c.uid, 'pet', 'pick'), placeholder: 'Chọn thú cưng…', options: list.slice(0, 25).map((x) => ({ label: `${x.inst.nickname || x.def.name} Lv${x.inst.level}`, value: String(x.inst.id), description: `${R.name(x.def.rarity)} · ${x.def.group}`, default: x.inst.id === inst.id })) }));
    if (food.length) comps.push(K.select({ id: cid('v', c.uid, 'pet', 'feed', inst.id), placeholder: 'Cho ăn…', options: food.map((r) => ({ label: `${D.items.get(r.item_id).name} ×${r.qty}`, value: r.item_id, description: `+${D.items.get(r.item_id).petExp} EXP` })) }));
    if (eggs.length) comps.push(K.select({ id: cid('v', c.uid, 'pet', 'egg'), placeholder: 'Ấp trứng…', options: eggs.map((r) => ({ label: `${D.items.get(r.item_id).name} ×${r.qty}`, value: r.item_id })) }));
    return K.msg({ embeds: [e], files, components: K.rows(comps) });
  },
  act(c, act, [a1], i) {
    if (act === 'pick') return { args: [i.values[0]] };
    if (act === 'equip') { const d = petSvc.equip(c.uid, +a1); return { notice: `🐾 **${d.name}** sẽ đi câu cùng bạn!`, args: [a1] }; } if (act === 'unequip') { petSvc.unequip(c.uid); return { notice: 'Thú cưng đã nghỉ ngơi.', args: [a1] }; }
    if (act === 'feed') { const r = petSvc.feed(c.uid, +a1, i.values[0], 1); return { notice: `🍖 +${F.num(r.exp)} EXP, +${r.bond} thân thiết${r.up ? ` — lên cấp ${r.up.level}!` : ''}`, args: [a1] }; }
    if (act === 'egg') { const r = petSvc.hatch(c.uid, i.values[0]); return { notice: `🥚 Trứng nở ra **${r.def.name}** (${R.name(r.def.rarity)})!`, args: [r.id] }; }
    if (act === 'evolve') { const r = petSvc.evolve(c.uid, +a1); return { notice: `🌟 Tiến hoá thành công! ${r?.name ? `**${r.name}**` : ''}`, args: [a1] }; }
    if (act === 'rename') return { modal: K.modal({ id: cid('m', c.uid, 'pet', 'rename', a1), title: 'Đặt tên thú cưng', fields: [{ id: 'name', label: 'Tên mới (tối đa 24 ký tự)', max: 24 }] }) };
    return undefined;
  },
  modal(c, act, [a1], f) { const n = petSvc.rename(c.uid, +a1, f.get('name')); return { notice: `✏️ Đã đổi tên thành **${n}**.`, args: [a1] }; },
};
/* ------------------------------------------------------------------ BOSS */
const boss = {
  render(c, [bid]) {
    const list = bossSvc.activeList(); const files = [];
    if (!list.length) return K.msg({ embeds: [K.embed({ title: `${E('ui', 'boss')} Boss`, desc: 'Hiện không có boss nào xuất hiện. Boss mới sẽ tự xuất hiện theo chu kỳ (hoặc theo sự kiện)!', color: COLOR.dark })] });
    const b = list.find((x) => String(x.id) === String(bid)) || list[0]; const st = bossSvc.status(b.id); const def = D.bosses.get(b.boss_id); const loc = D.locations.get(b.location); const li = K.img('locations', loc.id); const fi = K.img('fish', def.trophyFish); if (li) files.push(li.file); if (fi) files.push(fi.file);
    const top = bossSvc.sharesOf(b.id).slice(0, 5); const party = bossSvc.partyBonus(b.id, c.uid); const cd = require('../../database/repositories/settings').cooldownLeft(c.uid, `boss:${b.id}`);
    const e = K.embed({ title: `${E('ui', 'boss')} ${def.name} · cấp ${def.level}`, desc: `📍 ${loc.name} · ${K.rar(def.rarity)}\nHP ${F.bar(st.hp, st.max_hp, 14, '🟥', '⬛')} **${F.num(st.hp)}/${F.num(st.max_hp)}**\n⏳ Rời đi ${F.rel(st.ends_at)}${def.regenPctPerMin ? ` · hồi ${def.regenPctPerMin}% HP/phút` : ''}${def.armorPct ? ` · giáp ${def.armorPct}%` : ''}\n\n*${def.desc}*`, color: R.color(def.rarity), image: li?.url, thumb: fi?.url,
      fields: [{ name: 'Phần thưởng', value: `${F.xu(Math.round(def.rewards.xu * b.reward_mult))} + ${F.num(Math.round(def.rewards.exp * b.reward_mult))} EXP + ${K.itemLine(def.rewards.chest)}\nChia theo đóng góp. Cá chiến lợi phẩm: **${D.fishes.get(def.trophyFish).name}**` }, { name: 'Bảng đóng góp', value: top.map((t, k) => `${['🥇', '🥈', '🥉', '4.', '5.'][k]} ${t.name} — ${F.num(t.damage)} (${F.pct(t.share, 0)})`).join('\n') || 'Chưa ai tấn công.' }, { name: 'Tổ đội', value: party.members > 1 ? `👥 ${party.members} người · +${Math.round(party.bonus * 100)}% sát thương` : 'Chưa vào tổ đội (tối đa 5 người, +8%/người)' }], footer: `Boss #${b.id}${cd ? ` · hồi sức ${Math.ceil(cd / 1000)}s` : ''}` });
    const comps = [K.button({ id: cid('fa', c.uid, 'boss', b.id), label: 'Tấn công!', style: 'danger', emoji: '⚔️' }), K.button({ id: cid('v', c.uid, 'boss', 'party', b.id), label: party.members > 1 ? 'Rời tổ đội' : 'Lập tổ đội', emoji: '👥' }), K.button({ id: cid('v', c.uid, 'boss', 'show', b.id), label: 'Làm mới', emoji: '🔄' })];
    if (party.members > 1 && party.leader === c.uid) comps.push(K.button({ id: cid('v', c.uid, 'boss', 'invite', b.id), label: 'Mời bạn…', emoji: '📨' }));
    if (list.length > 1) comps.push(K.select({ id: cid('v', c.uid, 'boss', 'pick'), placeholder: 'Chọn boss…', options: list.map((x) => ({ label: D.bosses.get(x.boss_id).name, value: String(x.id), default: x.id === b.id })) }));
    return K.msg({ embeds: [e], files, components: K.rows(comps) });
  },
  act(c, act, [a1], i) {
    if (act === 'pick') return { args: [i.values[0]] };
    if (act === 'party') { const p = bossSvc.partyBonus(+a1, c.uid); if (p.members > 1) { bossSvc.leaveParty(c.uid, +a1); return { notice: 'Đã rời tổ đội.', args: [a1] }; } try { bossSvc.leaveParty(c.uid, +a1); } catch { /* chưa có */ } bossSvc.createParty(c.uid, +a1); return { notice: `👥 Đã lập tổ đội! Bạn bè dùng \`/boss\` → *Vào tổ đội* với mã **${c.uid}** hoặc bấm nút "Mời bạn".`, args: [a1] }; }
    if (act === 'invite') return { reply: `Gửi cho bạn bè lệnh: \`/toidau tothoi:${c.uid}\` để vào tổ đội của bạn (boss #${a1}).` };
    return undefined;
  },
};
module.exports = { pet, boss };
