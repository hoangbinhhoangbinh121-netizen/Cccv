'use strict';
/** Hồ sơ, điểm danh, nhiệm vụ, thành tựu, bảng xếp hạng, Codex, khu vực, sự kiện, hướng dẫn. */
const K = require('../../ui/kit');
const { D } = require('../../services/gameData');
const userSvc = require('../../services/userService');
const progSvc = require('../../services/progressService');
const locSvc = require('../../services/locationService');
const eventSvc = require('../../services/eventService');
const fishing = require('../../services/fishingService');
const economy = require('../../services/economyService');
const users = require('../../database/repositories/users');
const rodRepo = require('../../database/repositories/rods');
const fishRepo = require('../../database/repositories/fish');
const progRepo = require('../../database/repositories/progress');
const weather = require('../../systems/weather');
const R = require('../../systems/rarity');
const { GameError } = require('../../utils/errors');
const { now } = require('../../utils/time');
const { E, F, COLOR, cid } = K;

const nav = (uid, cur) => [['profile', 'Hồ sơ', 'ui:backpack'], ['missions', 'Nhiệm vụ', 'ui:mission'], ['achievements', 'Thành tựu', 'ui:achievement'], ['locations', 'Khu vực', 'ui:location'], ['leaderboard', 'Xếp hạng', 'ui:title']]
  .map(([v, l, ic]) => K.button({ id: cid('v', uid, v, 'show'), label: l, disabled: v === cur, emoji: K.emoji.btn('ui', ic.split(':')[1]) }));

/* ------------------------------------------------------------------ HỒ SƠ */
const profile = {
  render(c, [target]) {
    const tid = target || c.uid; const p = userSvc.profile(tid); if (!p) throw new GameError(tid === c.uid ? 'Bạn chưa đăng ký.' : 'Người này chưa đăng ký chơi.');
    const u = p.user; const st = p.stats; const mine = tid === c.uid; const files = []; const rodInst = p.eq.rod_id ? rodRepo.get(p.eq.rod_id) : null;
    const ri = rodInst ? K.img('rods', rodInst.skin || rodInst.rod_id) : null; if (ri) files.push(ri.file);
    const pet = p.eq.pet_id ? require('../../database/repositories/pets').get(p.eq.pet_id) : null; const petDef = pet ? D.pets.get(pet.pet_id) : null;
    const best = st.best_fish ? D.fishes.get(st.best_fish) : null; const title = userSvc.titleName(u.title);
    const e = K.embed({
      title: `${title ? `『${title}』 ` : ''}${u.name}`, color: COLOR.gold, thumb: ri?.url,
      desc: `${E('ui', 'exp')} **Cấp ${u.level}** — ${F.num(u.exp)}/${F.num(p.need)} EXP\n${F.bar(u.exp, p.need, 14)}\n${E('ui', 'coin')} **${F.xu(p.xu)}**`,
      fields: [
        { name: `${E('ui', 'rod')} Trang bị`, value: `Cần: ${rodInst ? K.rodName(rodInst) : '*chưa có*'}\nMồi: ${p.eq.bait_id ? K.itemLine(p.eq.bait_id, require('../../database/repositories/inventory').count(tid, p.eq.bait_id)) : '*không*'}\nThú: ${petDef ? `${petDef.name} Lv${pet.level}` : '*không*'}`, inline: true },
        { name: `${E('ui', 'fish')} Thành tích`, value: `Tổng cá: **${F.num(st.total_catch)}** (${F.kg(st.total_weight)})\nCá hiếm+: ${F.num(st.rare_catch)} · Huyền thoại+: ${F.num(st.legend_catch)}\nCá nặng nhất: ${best ? `${best.name} ${F.kg(st.best_weight)}` : '—'}`, inline: true },
        { name: `${E('ui', 'boss')} Khác`, value: `Boss hạ: ${st.boss_kills} · Sát thương: ${F.num(st.boss_damage)}\nCodex: ${p.codex}/${D.fishList.length}\nThành tựu: ${p.ach}/${D.achievements.length}`, inline: true },
        { name: `${E('ui', 'backpack')} Kho`, value: `${p.slots}/${p.cap} ô`, inline: true }, { name: `${E('ui', 'location')} Khu vực`, value: D.locations.get(u.location).name, inline: true }, { name: '📅 Điểm danh', value: `Chuỗi ${u.daily_streak} ngày`, inline: true },
        p.buffs?.length ? { name: '🧪 Hiệu ứng đang có', value: p.buffs.map((b) => `${b.stat} +${b.value} (${F.rel(b.until)})`).join('\n') } : null,
      ].filter(Boolean), footer: mine ? 'Dùng /cauca để bắt đầu câu cá!' : `Hồ sơ của ${u.name}`,
    });
    const comps = mine ? [K.button({ id: cid('v', c.uid, 'profile', 'daily'), label: 'Điểm danh', style: 'success', emoji: '📅' }), K.button({ id: cid('v', c.uid, 'profile', 'refresh'), label: 'Làm mới', emoji: '🔄' }), ...nav(c.uid, 'profile').slice(1)] : [];
    const titleSel = mine && p.titles.length ? K.select({ id: cid('v', c.uid, 'profile', 'title'), placeholder: 'Đổi danh hiệu…', options: [{ label: '(Bỏ danh hiệu)', value: '-' }, ...p.titles.slice(0, 24).map((t) => ({ label: D.titles[t], value: t, default: u.title === t }))] }) : null;
    return K.msg({ embeds: [e], files, components: K.rows([...comps, titleSel]) });
  },
  act(c, act, args, i) {
    if (act === 'daily') { const r = userSvc.daily(c.uid); return { notice: `📅 Điểm danh ngày ${r.streak}/7: +${F.xu(r.xu)}${Object.keys(r.items).length ? `, ${K.itemsText(r.items)}` : ''}. Ngày mai: ngày ${r.nextDay}.` }; }
    if (act === 'title') { const v = i.values[0]; const t = userSvc.setTitle(c.uid, v === '-' ? null : v); return { notice: t ? `🎖️ Đã đổi danh hiệu: ${t}` : 'Đã bỏ danh hiệu.' }; }
    return undefined;
  },
};
/* ------------------------------------------------------------------ NHIỆM VỤ */
const missions = {
  render(c, [tab = 'daily']) {
    const m = progSvc.list(c.uid); const list = m[tab === 'weekly' ? 'weekly' : tab === 'chain' ? 'chains' : 'daily'];
    const lines = list.map((x, i) => `${x.claimed ? '✅' : x.progress >= x.target ? '🎁' : '▫️'} **${x.title ? `${x.title} — ` : ''}${x.text}**\n　${F.bar(x.progress, x.target, 10)} ${F.num(x.progress)}/${F.num(x.target)} → ${K.rewardText(x.reward)}`);
    const e = K.embed({ title: `${E('ui', 'mission')} Nhiệm vụ ${tab === 'weekly' ? 'tuần' : tab === 'chain' ? 'chuỗi' : 'ngày'}`, desc: lines.join('\n\n') || 'Không có nhiệm vụ.', color: COLOR.info, footer: tab === 'daily' ? 'Làm mới mỗi ngày' : tab === 'weekly' ? 'Làm mới mỗi tuần' : 'Hoàn thành từng bước để mở bước tiếp theo' });
    const claimable = list.filter((x) => !x.claimed && x.progress >= x.target);
    return K.msg({ embeds: [e], components: K.rows([...['daily', 'weekly', 'chain'].map((t) => K.button({ id: cid('v', c.uid, 'missions', 'tab', t), label: { daily: 'Hằng ngày', weekly: 'Hằng tuần', chain: 'Chuỗi' }[t], style: t === tab ? 'primary' : 'secondary', disabled: t === tab })), K.button({ id: cid('v', c.uid, 'missions', 'claimall', tab), label: `Nhận thưởng (${claimable.length})`, style: 'success', disabled: !claimable.length, emoji: '🎁' })]) });
  },
  act(c, act, [a1]) {
    if (act === 'tab') return { args: [a1] };
    if (act === 'claimall') { const m = progSvc.list(c.uid); const list = m[a1 === 'weekly' ? 'weekly' : a1 === 'chain' ? 'chains' : 'daily']; let n = 0; for (const x of list) if (!x.claimed && x.progress >= x.target) { progSvc.claimMission(c.uid, x.id); n++; } if (!n) throw new GameError('Chưa có nhiệm vụ nào để nhận thưởng.'); return { notice: `🎁 Đã nhận thưởng ${n} nhiệm vụ!`, args: [a1] }; }
    return undefined;
  },
};
/* ------------------------------------------------------------------ THÀNH TỰU */
const achievements = {
  render(c, [page = '0', filter = 'all']) {
    let list = progSvc.achievementList(c.uid); if (filter === 'claim') list = list.filter((a) => a.unlocked && !a.claimed); else if (filter === 'done') list = list.filter((a) => a.unlocked); else if (filter === 'todo') list = list.filter((a) => !a.unlocked);
    const per = 6; const pages = Math.max(1, Math.ceil(list.length / per)); const p = Math.max(0, Math.min(pages - 1, +page)); const all = progSvc.achievementList(c.uid);
    const lines = list.slice(p * per, p * per + per).map((a) => `${a.claimed ? '✅' : a.unlocked ? '🎁' : '🔒'} **${a.name}** — ${a.desc}\n　${F.bar(a.value, a.target, 10)} ${F.num(a.value)}/${F.num(a.target)} → ${K.rewardText(a.reward)}`);
    const e = K.embed({ title: `${E('ui', 'achievement')} Thành tựu (${all.filter((a) => a.unlocked).length}/${all.length})`, desc: lines.join('\n\n') || 'Không có thành tựu nào trong mục này.', color: COLOR.gold });
    const claimN = all.filter((a) => a.unlocked && !a.claimed).length;
    return K.msg({ embeds: [e], components: K.rows([...K.pager(c.uid, 'achievements', 'pg', p, pages, [filter]), K.button({ id: cid('v', c.uid, 'achievements', 'claimall', p, filter), label: `Nhận tất cả (${claimN})`, style: 'success', disabled: !claimN, emoji: '🎁' }),
      K.select({ id: cid('v', c.uid, 'achievements', 'filter'), placeholder: 'Lọc thành tựu…', options: [['all', 'Tất cả'], ['claim', 'Có thể nhận thưởng'], ['done', 'Đã đạt'], ['todo', 'Chưa đạt']].map(([v, l]) => ({ label: l, value: v, default: v === filter })) })]) });
  },
  act(c, act, [a1, a2], i) {
    if (act === 'pgp') return { args: [a1, a2] }; if (act === 'filter') return { args: ['0', i.values[0]] };
    if (act === 'claimall') { const r = progSvc.claimAllAchievements(c.uid); if (!r.length) throw new GameError('Chưa có thành tựu nào để nhận.'); return { notice: `🏆 Đã nhận thưởng ${r.length} thành tựu${r.some((x) => x.title) ? ` (kèm danh hiệu mới)` : ''}!`, args: ['0', a2] }; }
    return undefined;
  },
};
/* ------------------------------------------------------------------ XẾP HẠNG */
const BOARD_ICON = { weight: '⚖️', count: '🐟', collection: '💎', rare: '🌟', level: '🆙', wealth: '🪙', achievements: '🏆', boss: '👹' };
const leaderboard = {
  render(c, [board = 'level']) {
    const r = progSvc.leaderboard(board, c.uid, 15); const medal = ['🥇', '🥈', '🥉'];
    const lines = r.rows.map((x) => `${medal[x.rank - 1] || `**${x.rank}.**`} ${x.name} — **${typeof x.value === 'number' ? F.num(x.value) : x.value}** ${r.unit}`);
    const e = K.embed({ title: `${BOARD_ICON[board]} Bảng xếp hạng: ${r.name}`, desc: lines.join('\n') || 'Chưa có ai trên bảng.', color: COLOR.gold, footer: r.me ? `Hạng của bạn: #${r.me.rank} (${typeof r.me.value === 'number' ? F.num(r.me.value) : r.me.value} ${r.unit}) · cập nhật mỗi phút` : 'Bạn chưa có thứ hạng · cập nhật mỗi phút' });
    return K.msg({ embeds: [e], components: K.rows([K.select({ id: cid('v', c.uid, 'leaderboard', 'board'), placeholder: 'Chọn bảng xếp hạng…', options: Object.entries(progRepo.BOARDS).map(([k, b]) => ({ label: b.name, value: k, emoji: BOARD_ICON[k], default: k === board })) })]) });
  },
  act(c, act, args, i) { if (act === 'board') return { args: [i.values[0]] }; return undefined; },
};
/* ------------------------------------------------------------------ CODEX */
const codex = {
  render(c, [locId, page = '0']) {
    const u = users.get(c.uid); locId = locId || u.location; const loc = D.locations.get(locId) || D.locList[0]; const have = fishRepo.codex(c.uid);
    const list = D.fishList.filter((f) => f.location === loc.id && !f.event).sort((a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name)); const per = 12; const pages = Math.ceil(list.length / per); const p = Math.max(0, Math.min(pages - 1, +page));
    const lines = list.slice(p * per, p * per + per).map((f) => { const r = have.get(f.id); return r ? `${E('fish', f.id)} **${f.name}** ${R.mark(f.rarity)} — ×${r.count} · kỷ lục ${F.kg(r.best_weight)}` : `❔ ??? ${R.mark(f.rarity)} — *chưa bắt được*`; });
    const li = K.img('locations', loc.id); const owned = list.filter((f) => have.has(f.id)).length;
    const e = K.embed({ title: `📖 Codex — ${loc.name}`, desc: `Đã sưu tầm **${owned}/${list.length}** loài ở đây · Tổng **${have.size}/${D.fishList.length}**\n\n${lines.join('\n')}`, color: COLOR.info, image: li?.url, footer: 'Cá Boss/Sự kiện hiển thị ở khu vực tương ứng khi bắt được' });
    return K.msg({ embeds: [e], files: li ? [li.file] : [], components: K.rows([...K.pager(c.uid, 'codex', 'pg', p, pages, [loc.id]), K.select({ id: cid('v', c.uid, 'codex', 'loc'), placeholder: 'Chọn khu vực…', options: D.locList.map((l) => ({ label: l.name, value: l.id, default: l.id === loc.id })) })]) });
  },
  act(c, act, [a1, a2], i) { if (act === 'pgp') return { args: [a2, a1] }; if (act === 'loc') return { args: [i.values?.[0] || a1, '0'] }; return undefined; },
};
/* ------------------------------------------------------------------ KHU VỰC */
const locations = {
  render(c, [sel]) {
    const st = locSvc.status(c.uid); const cur = st.find((x) => x.current) || st[0]; const s = st.find((x) => x.loc.id === sel) || cur; const l = s.loc; const wx = weather.WEATHER[fishing.currentWeather(l.id)]; const files = [];
    const li = K.img('locations', l.id); if (li) files.push(li.file); const boss = D.bosses.get(l.boss);
    const e = K.embed({ title: `${E('locations', l.id)} ${l.name} ${s.current ? '· 📍 đang ở đây' : ''}`, desc: `*${l.desc}*`, color: R.color(l.rarity), image: li?.url,
      fields: [{ name: 'Mở khoá', value: s.unlocked ? '✅ Đã mở' : `Cấp ${l.unlock.level} ${s.meetsLevel ? '✅' : '❌'} · Cần bậc ${D.tiers[l.unlock.rodTier - 1].name} ${s.meetsRod ? '✅' : '❌'} · ${F.xu(l.unlock.cost)}`, inline: false },
        { name: 'Cá chủ đạo', value: `${K.rar(Math.max(1, l.rarity - 1))} → ${K.rar(Math.min(9, l.rarity + 1))} · ${l.fishCount} loài`, inline: true }, { name: 'Thời tiết hiện tại', value: `${E('ui', `weather_${fishing.currentWeather(l.id)}`)} ${wx.name}`, inline: true },
        { name: 'Boss', value: boss ? `${boss.name} (cấp ${boss.level})` : '—', inline: true }, { name: 'Tài nguyên', value: l.resources.map((r) => K.itemLine(r.item)).join(', ') || '—' }], footer: `Khu vực ${l.order}/${D.locList.length}` });
    return K.msg({ embeds: [e], files, components: K.rows([K.button({ id: cid('v', c.uid, 'locations', 'go', l.id), label: s.current ? 'Đang ở đây' : 'Di chuyển', style: 'primary', disabled: !s.unlocked || s.current, emoji: '🧭' }), K.button({ id: cid('v', c.uid, 'locations', 'unlock', l.id), label: `Mở khoá (${F.num(l.unlock.cost)} xu)`, style: 'success', disabled: s.unlocked, emoji: K.emoji.btn('ui', 'coin') }), K.button({ id: cid('v', c.uid, 'codex', 'loc', l.id), label: 'Codex', emoji: '📖' }),
      K.select({ id: cid('v', c.uid, 'locations', 'pick'), placeholder: 'Xem khu vực khác…', options: st.map((x) => ({ label: `${x.loc.order}. ${x.loc.name}`, value: x.loc.id, description: x.unlocked ? 'Đã mở khoá' : `Cấp ${x.loc.unlock.level}`, emoji: x.unlocked ? '✅' : '🔒', default: x.loc.id === l.id })) })]) });
  },
  act(c, act, [a1], i) {
    if (act === 'pick') return { args: [i.values[0]] }; if (act === 'go') { const l = locSvc.travel(c.uid, a1); return { notice: `🧭 Đã di chuyển đến **${l.name}**.`, args: [a1] }; }
    if (act === 'unlock') { const l = locSvc.unlock(c.uid, a1); return { notice: `🔓 Đã mở khoá **${l.name}** và di chuyển đến đó!`, args: [a1] }; }
    return undefined;
  },
};
/* ------------------------------------------------------------------ SỰ KIỆN */
const events = {
  render(c) {
    const act = eventSvc.active(); const up = eventSvc.upcoming().filter((x) => x.status === 'scheduled'); const mods = eventSvc.modifiers();
    const lines = act.map((ev) => `🔥 **${ev.name}** — kết thúc ${F.rel(ev.end_at)}\n　${ev.data.desc || ''}`);
    const e = K.embed({ title: '🎪 Sự kiện', desc: lines.join('\n\n') || 'Hiện không có sự kiện nào đang diễn ra.', color: COLOR.gold, fields: [{ name: 'Sắp diễn ra', value: up.map((u) => `• **${u.name}** — ${F.abs(u.start_at)} (${F.rel(u.start_at)})`).join('\n') || 'Chưa có lịch.' }, Object.keys(mods).length ? { name: 'Hiệu ứng đang áp dụng', value: Object.entries(mods).filter(([, v]) => typeof v === 'number' && v).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`).join(' · ') || '—' } : null].filter(Boolean) });
    return K.msg({ embeds: [e], components: K.rows(act.slice(0, 5).map((ev) => K.button({ id: cid('v', c.uid, 'events', 'join', ev.id), label: `Tham gia: ${ev.name}`, style: 'success' }))) });
  },
  act(c, act, [a1]) { if (act === 'join') { eventSvc.join(c.uid, +a1); return { notice: '✅ Đã tham gia sự kiện! Điểm của bạn sẽ được tính khi câu cá.' }; } return undefined; },
};
/* ------------------------------------------------------------------ HƯỚNG DẪN */
const PAGES = {
  start: ['🎣 Bắt đầu', '1. `/cauca` – thả câu; chờ nút **GIẬT CẦN** hiện ra rồi bấm.\n2. Khi cá mắc câu, mỗi lượt cá làm một chiêu: **Lao đi → Thả dây**, **Vùng vẫy → Giữ**, **Mệt lả → Kéo**. Đúng thì cá mất sức, sai thì dây căng; căng 100% là đứt dây.\n3. `/ban_ca` bán cá lấy xu, `/cuahang` mua mồi, `/cancau` quản lý cần, `/daily` điểm danh mỗi ngày.\n4. Lên cấp để mở khoá khu vực mới (`/khuvuc`) và cần câu mạnh hơn.'],
  gear: ['🛠️ Cần câu', '• `/nangcap` tăng cấp cần (vật liệu + xu).\n• `/cuonghoa` cường hoá +1…+15 (từ +6 thất bại sẽ tụt cấp, dùng **Bùa Bảo Hộ** để giữ).\n• `/khamda` khảm ngọc, `/thuctinh` thức tỉnh (3 giai đoạn), `/chetao` chế tạo cần & vật phẩm.\n• Cần hỏng: `/cancau` → **Sửa** hoặc dùng Phù Sửa Cần.'],
  economy: ['🪙 Kinh tế', '• Bán cá: `/ban_ca` (có thể lọc theo phẩm cấp). Khoá cá quý bằng nút 🔒.\n• Thị trường người chơi `/thitruong` (phí theo cấu hình, hàng được ký quỹ an toàn), `/muamoi`, chuyển xu `/giaodich`.\n• Rương, bình hỗ trợ, trứng thú: `/sudung`.'],
  pets: ['🐾 Thú cưng & Boss', '• Ấp trứng bằng `/sudung`, quản lý ở `/thucung` (cho ăn, trang bị, tiến hoá).\n• `/boss` xem boss đang xuất hiện, `/toidau` tấn công; lập tổ đội để tăng sát thương, thưởng chia theo đóng góp.'],
};
const help = {
  render(c, [page = 'start']) {
    const [t, d] = PAGES[page] || PAGES.start;
    return K.msg({ embeds: [K.embed({ title: t, desc: d, color: COLOR.info, footer: 'Thiên Tông Fishing · Pixel Art RPG' })], components: K.rows([K.select({ id: cid('v', c.uid, 'help', 'page'), placeholder: 'Chọn chủ đề…', options: Object.entries(PAGES).map(([k, [l]]) => ({ label: l, value: k, default: k === page })) })]) });
  },
  act(c, act, a, i) { if (act === 'page') return { args: [i.values[0]] }; return undefined; },
};
module.exports = { profile, missions, achievements, leaderboard, codex, locations, events, help };
