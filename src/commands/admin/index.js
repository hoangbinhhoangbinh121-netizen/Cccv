'use strict';
/** Lệnh quản trị: /fishing-admin, /fishing-event, /fishing-config, /fishing-backup, /fishing-restore, /backupdb, /restore_db. */
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');
const U = require('../util');
const K = require('../../ui/kit');
const H = require('../../interactions/helpers');
const config = require('../../config');
const backup = require('../../database/backup');
const settings = require('../../database/repositories/settings');
const users = require('../../database/repositories/users');
const walletRepo = require('../../database/repositories/wallet');
const adminSvc = require('../../services/adminService');
const eventSvc = require('../../services/eventService');
const bossSvc = require('../../services/bossService');
const fishing = require('../../services/fishingService');
const { D } = require('../../services/gameData');
const gameData = require('../../services/gameData');
const emoji = require('../../ui/emoji');
const weather = require('../../systems/weather');
const ctxBus = require('../../services/context');
const adminViews = require('../../interactions/views/admin');
const { getDb, state } = require('../../database/connection');
const { GameError } = require('../../utils/errors');
const { F, COLOR } = K;

const PERM_ADMIN = 8n; // Administrator – chỉ để ẩn lệnh với người thường; quyền thật được kiểm tra lại trong mã
const reply = (i, content, extra = {}) => i.reply({ content, flags: K.EPHEMERAL, ...extra });
const emb = (i, e) => i.reply({ embeds: [e], flags: K.EPHEMERAL });
const target = (i) => i.options.getUser('nguoi');
const userOpt = (o, d = 'Người chơi') => o.setName('nguoi').setDescription(d).setRequired(true);

/* ------------------------------------------------------------------ /fishing-admin */
const SUBS = {
  'give-xu': { d: 'Tặng/trừ xu của người chơi', b: (s) => s.addUserOption((o) => userOpt(o)).addIntegerOption((o) => o.setName('soxu').setDescription('Số xu (âm = trừ)').setRequired(true).setMinValue(-1000000000).setMaxValue(1000000000)).addStringOption((o) => o.setName('lydo').setDescription('Ghi chú')),
    run: (i) => { const r = adminSvc.giveXu(i.user.id, target(i).id, i.options.getInteger('soxu'), i.options.getString('lydo')); return reply(i, `✅ ${target(i)}: số dư mới **${F.xu(r.balance ?? r)}**.`); } },
  'give-item': { d: 'Tặng vật phẩm', b: (s) => s.addUserOption((o) => userOpt(o)).addStringOption((o) => o.setName('vatpham').setDescription('Vật phẩm').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('soluong').setDescription('Số lượng').setRequired(true).setMinValue(1).setMaxValue(9999)),
    run: (i) => { adminSvc.giveItem(i.user.id, target(i).id, i.options.getString('vatpham'), i.options.getInteger('soluong')); return reply(i, `✅ Đã tặng ${K.itemLine(i.options.getString('vatpham'), i.options.getInteger('soluong'))} cho ${target(i)}.`); } },
  'give-rod': { d: 'Tặng cần câu', b: (s) => s.addUserOption((o) => userOpt(o)).addStringOption((o) => o.setName('can').setDescription('Cần câu').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('cap').setDescription('Cấp cần').setMinValue(1).setMaxValue(60)).addIntegerOption((o) => o.setName('cuonghoa').setDescription('Cường hoá').setMinValue(0).setMaxValue(15)),
    run: (i) => { adminSvc.giveRod(i.user.id, target(i).id, i.options.getString('can'), i.options.getInteger('cap') || 1, i.options.getInteger('cuonghoa') || 0); return reply(i, `✅ Đã tặng cần cho ${target(i)}.`); } },
  'give-fish': { d: 'Tặng một con cá', b: (s) => s.addUserOption((o) => userOpt(o)).addStringOption((o) => o.setName('ca').setDescription('Loài cá').setRequired(true).setAutocomplete(true)).addNumberOption((o) => o.setName('cannang').setDescription('Cân nặng (kg)').setMinValue(0.01).setMaxValue(100000)),
    run: (i) => { adminSvc.giveFish(i.user.id, target(i).id, i.options.getString('ca'), i.options.getNumber('cannang') || undefined); return reply(i, `✅ Đã tặng cá cho ${target(i)}.`); } },
  'set-level': { d: 'Đặt cấp người chơi', b: (s) => s.addUserOption((o) => userOpt(o)).addIntegerOption((o) => o.setName('cap').setDescription('Cấp (1–100)').setRequired(true).setMinValue(1).setMaxValue(100)),
    run: (i) => { adminSvc.setLevel(i.user.id, target(i).id, i.options.getInteger('cap')); return reply(i, `✅ ${target(i)} giờ là cấp ${i.options.getInteger('cap')}.`); } },
  ban: { d: 'Khoá tài khoản người chơi', b: (s) => s.addUserOption((o) => userOpt(o)).addStringOption((o) => o.setName('lydo').setDescription('Lý do')), run: (i) => { adminSvc.ban(i.user.id, target(i).id, i.options.getString('lydo')); return reply(i, `⛔ Đã khoá ${target(i)}.`); } },
  unban: { d: 'Mở khoá tài khoản', b: (s) => s.addUserOption((o) => userOpt(o)), run: (i) => { adminSvc.unban(i.user.id, target(i).id); return reply(i, `✅ Đã mở khoá ${target(i)}.`); } },
  'reset-user': { d: 'XOÁ toàn bộ dữ liệu một người chơi', b: (s) => s.addUserOption((o) => userOpt(o)).addStringOption((o) => o.setName('xacnhan').setDescription('Gõ XOA để xác nhận').setRequired(true)),
    run: (i) => { if (i.options.getString('xacnhan').trim().toUpperCase() !== 'XOA') throw new GameError('Chưa xác nhận: hãy gõ đúng `XOA` ở tuỳ chọn xacnhan.'); H.requireOwner(i); adminSvc.resetUser(i.user.id, target(i).id); return reply(i, `🗑️ Đã xoá dữ liệu ${target(i)}.`); } },
  'user-info': { d: 'Xem chi tiết người chơi', b: (s) => s.addUserOption((o) => userOpt(o)), run: (i) => { const p = require('../../services/userService').profile(target(i).id); if (!p) throw new GameError('Người này chưa đăng ký.'); const act = require('../../database/repositories/sessions').active(target(i).id); return emb(i, K.embed({ title: `🔎 ${p.user.name} (${p.user.id})`, color: COLOR.info, desc: `Cấp ${p.user.level} · ${F.xu(p.xu)} · kho ${p.slots}/${p.cap}\nTổng cá ${p.stats.total_catch} · boss ${p.stats.boss_kills}\nKhoá: ${p.user.banned ? `**CÓ** (${p.user.ban_reason || '—'})` : 'không'}\nPhiên đang chạy: ${act ? `#${act.id} (${act.state}) từ ${F.rel(act.started_at)}` : 'không'}\nTạo lúc ${F.abs(p.user.created_at)} · lần cuối ${F.rel(p.user.last_seen)}` })); } },
  unstick: { d: 'Đóng phiên câu kẹt và xoá hồi chiêu của người chơi', b: (s) => s.addUserOption((o) => userOpt(o)), run: (i) => { const ended = fishing.forceEnd(target(i).id); settings.clearCooldowns(target(i).id); settings.log(i.user.id, 'unstick', target(i).id, ended ? 'closed' : 'none'); return reply(i, `✅ ${ended ? 'Đã đóng phiên kẹt' : 'Không có phiên nào'} và xoá hồi chiêu cho ${target(i)}.`); } },
  'boss-spawn': { d: 'Triệu hồi một boss', b: (s) => s.addStringOption((o) => o.setName('boss').setDescription('Boss').setRequired(true).setAutocomplete(true)).addNumberOption((o) => o.setName('thuong').setDescription('Hệ số thưởng (mặc định 1)').setMinValue(0.5).setMaxValue(10)),
    run: (i) => { const b = bossSvc.spawn(i.options.getString('boss'), { rewardMult: i.options.getNumber('thuong') || 1 }); settings.log(i.user.id, 'boss_spawn', String(b.id), b.boss_id); return reply(i, `👹 Đã triệu hồi **${D.bosses.get(b.boss_id).name}** (#${b.id}).`); } },
  'weather-set': { d: 'Đặt thời tiết một khu vực trong một thời gian', b: (s) => s.addStringOption((o) => o.setName('khuvuc').setDescription('Khu vực').setRequired(true).addChoices(...D.locList.map((l) => ({ name: l.name, value: l.id })))).addStringOption((o) => o.setName('thoitiet').setDescription('Thời tiết').setRequired(true).addChoices(...Object.entries(weather.WEATHER).map(([k, v]) => ({ name: v.name, value: k })))).addIntegerOption((o) => o.setName('phut').setDescription('Số phút (mặc định 60)').setMinValue(1).setMaxValue(1440)),
    run: (i) => { adminSvc.setWeather(i.user.id, i.options.getString('khuvuc'), i.options.getString('thoitiet'), i.options.getInteger('phut') || 60); return reply(i, '🌦️ Đã đặt thời tiết.'); } },
  announce: { d: 'Gửi thông báo vào kênh thông báo', b: (s) => s.addStringOption((o) => o.setName('noidung').setDescription('Nội dung').setRequired(true).setMaxLength(1500)), run: async (i) => { const ok = await require('../../bot').announce({ embeds: [K.embed({ title: '📢 Thông báo', desc: i.options.getString('noidung'), color: COLOR.gold })] }); settings.log(i.user.id, 'announce', null, i.options.getString('noidung').slice(0, 200)); return reply(i, ok ? '✅ Đã gửi thông báo.' : '⚠️ Chưa cấu hình `ANNOUNCE_CHANNEL_ID` hoặc bot không gửi được.'); } },
  stats: { d: 'Thống kê toàn hệ thống', b: (s) => s, run: (i) => { const g = adminSvc.globalStats(); return emb(i, K.embed({ title: '📊 Thống kê', color: COLOR.info, desc: Object.entries(g).map(([k, v]) => `**${k}**: ${typeof v === 'number' ? F.num(v) : v}`).join('\n'), footer: `Bộ nhớ ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB · chạy ${F.dur(process.uptime() * 1000)}` })); } },
  'audit-log': { d: 'Nhật ký thao tác quản trị', b: (s) => s.addIntegerOption((o) => o.setName('so').setDescription('Số dòng (mặc định 15)').setMinValue(1).setMaxValue(40)), run: (i) => { const rows = settings.recentLog(i.options.getInteger('so') || 15); return emb(i, K.embed({ title: '🧾 Nhật ký quản trị', color: COLOR.dark, desc: rows.map((r) => `${F.rel(r.created_at)} <@${r.admin_id}> **${r.action}** ${r.target ?? ''} ${r.detail ?? ''}`).join('\n').slice(0, 3900) || 'Trống.' })); } },
  transactions: { d: 'Lịch sử giao dịch xu của người chơi', b: (s) => s.addUserOption((o) => userOpt(o)).addIntegerOption((o) => o.setName('so').setDescription('Số dòng').setMinValue(1).setMaxValue(30)), run: (i) => { const rows = walletRepo.history(target(i).id, i.options.getInteger('so') || 15, 0); return emb(i, K.embed({ title: `🪙 Giao dịch của ${target(i).username}`, color: COLOR.gold, desc: rows.map((r) => `${F.rel(r.created_at)} \`${r.type}\` **${r.amount > 0 ? '+' : ''}${F.num(r.amount)}** → ${F.num(r.balance_after)} ${r.note ? `· ${r.note}` : ''}`).join('\n').slice(0, 3900) || 'Trống.' })); } },
  'integrity-check': { d: 'Kiểm tra toàn vẹn dữ liệu (số dư, hàng ký quỹ, phiên trùng…)', b: (s) => s, run: (i) => { const r = adminSvc.integrityCheck(); return emb(i, K.embed({ title: r.ok ? '✅ Dữ liệu toàn vẹn' : '⚠️ Phát hiện vấn đề', color: r.ok ? COLOR.ok : COLOR.err, desc: r.ok ? 'Số dư khớp sổ cái, không có hàng mồ côi, không có phiên trùng.' : r.issues.slice(0, 20).map((x) => `• ${x}`).join('\n') })); } },
  maintenance: { d: 'Bật/tắt chế độ bảo trì (chặn người chơi)', b: (s) => s.addBooleanOption((o) => o.setName('bat').setDescription('true = bật bảo trì').setRequired(true)), run: (i) => { const v = i.options.getBoolean('bat') ? 1 : 0; settings.set('maintenance', v); settings.log(i.user.id, 'maintenance', null, String(v)); return reply(i, v ? '🛠️ Đã BẬT bảo trì.' : '✅ Đã tắt bảo trì.'); } },
  'reload-data': { d: 'Nạp lại data/*.json và đồng bộ danh mục', b: (s) => s, run: (i) => { gameData.load(); gameData.syncCatalogs(getDb()); emoji.reset(); settings.log(i.user.id, 'reload', null, ''); return reply(i, `🔄 Đã nạp lại: ${D.fishList.length} cá, ${D.rodList.length} cần, ${D.itemList.length} vật phẩm.`); } },
  'upload-emojis': { d: 'Tải toàn bộ ảnh Pixel Art lên làm emoji của bot', b: (s) => s, run: async (i) => { H.requireOwner(i); await i.deferReply({ flags: K.EPHEMERAL }); const r = await emoji.syncToDiscord(i.client); settings.log(i.user.id, 'upload_emojis', null, `${r.created} mới`); return i.editReply(`😀 Emoji: tạo mới **${r.created}**, dùng lại ${r.reused}, lỗi ${r.failed.length}/${r.total}.${r.failed.length ? `\n${r.failed.slice(0, 5).join('\n')}` : ''}`); } },
};
const adminCmd = {
  data: (() => { const b = new SlashCommandBuilder().setName('fishing-admin').setDescription('Quản trị Thiên Tông Fishing').setDefaultMemberPermissions(PERM_ADMIN); for (const [n, s] of Object.entries(SUBS)) b.addSubcommand((x) => s.b(x.setName(n).setDescription(s.d))); return b; })(),
  execute(i) { H.requireAdmin(i); const sub = i.options.getSubcommand(); return SUBS[sub].run(i); },
  autocomplete(i) { const f = i.options.getFocused(true); const m = { vatpham: U.choices.allItems, can: U.choices.rods, ca: U.choices.fishes, boss: U.choices.bosses }[f.name]; return m && H.isAdmin(i) ? U.filterChoices(m(), f.value) : []; },
};
/* ------------------------------------------------------------------ /fishing-event */
const evLine = (e) => `\`#${e.id}\` **${e.name}** · ${e.status} · ${F.abs(e.start_at)} → ${F.abs(e.end_at)}`;
const eventCmd = {
  data: new SlashCommandBuilder().setName('fishing-event').setDescription('Quản lý sự kiện câu cá').setDefaultMemberPermissions(PERM_ADMIN)
    .addSubcommand((s) => s.setName('tao').setDescription('Tạo và bắt đầu một sự kiện từ mẫu').addStringOption((o) => o.setName('mau').setDescription('Mẫu sự kiện').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('phut').setDescription('Thời lượng (phút, mặc định theo mẫu)').setMinValue(5).setMaxValue(10080)).addIntegerOption((o) => o.setName('batdausau').setDescription('Bắt đầu sau bao nhiêu phút (mặc định 0 = ngay)').setMinValue(0).setMaxValue(10080)))
    .addSubcommand((s) => s.setName('danh-sach').setDescription('Sự kiện đang chạy và sắp tới'))
    .addSubcommand((s) => s.setName('xem').setDescription('Xem chi tiết & bảng điểm một sự kiện').addIntegerOption((o) => o.setName('id').setDescription('Mã sự kiện').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('ket-thuc').setDescription('Kết thúc sớm và trao thưởng').addIntegerOption((o) => o.setName('id').setDescription('Mã sự kiện').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('huy').setDescription('Huỷ sự kiện (không trao thưởng)').addIntegerOption((o) => o.setName('id').setDescription('Mã sự kiện').setRequired(true).setMinValue(1))),
  async execute(i) {
    H.requireAdmin(i); const sub = i.options.getSubcommand();
    if (sub === 'tao') { const delay = (i.options.getInteger('batdausau') || 0) * 60000; const ev = eventSvc.createFromTemplate(i.options.getString('mau'), { startAt: Date.now() + delay, durationMin: i.options.getInteger('phut') || undefined, by: i.user.id }); if (!delay) { eventSvc.startEvent(ev); require('../../services/context').emit('eventStarted', { type: 'started', event: eventSvc.get(ev.id) }); } settings.log(i.user.id, 'event_create', String(ev.id), ev.key); return reply(i, `🎪 Đã tạo sự kiện:\n${evLine(ev)}`); }
    if (sub === 'danh-sach') { const l = eventSvc.upcoming(); return emb(i, K.embed({ title: '🎪 Sự kiện', color: COLOR.gold, desc: l.map(evLine).join('\n') || 'Không có sự kiện nào.' })); }
    const id = i.options.getInteger('id'); const ev = eventSvc.get(id); if (!ev) throw new GameError('Không tìm thấy sự kiện.');
    if (sub === 'xem') { const rk = eventSvc.ranking(id, 10); return emb(i, K.embed({ title: ev.name, color: COLOR.gold, desc: `${evLine(ev)}\n\n${ev.data.desc || ''}`, fields: [{ name: 'Bảng điểm', value: rk.map((r, k) => `${k + 1}. ${r.name} — ${F.num(r.score)}`).join('\n') || 'Chưa có điểm.' }] })); }
    if (sub === 'ket-thuc') { const r = eventSvc.finalize(id); settings.log(i.user.id, 'event_end', String(id), ''); require('../../services/context').emit('eventEnded', { type: 'ended', event: ev, result: r }); return reply(i, r ? `🏁 Đã kết thúc & trao thưởng cho ${r.rewarded} người.` : 'Sự kiện đã được xử lý trước đó.'); }
    if (sub === 'huy') { eventSvc.cancel(id); settings.log(i.user.id, 'event_cancel', String(id), ''); return reply(i, '🚫 Đã huỷ sự kiện.'); }
    return null;
  },
  autocomplete(i) { return H.isAdmin(i) ? U.filterChoices(U.choices.templates(), i.options.getFocused()) : []; },
};
/* ------------------------------------------------------------------ /fishing-config */
const configCmd = {
  data: new SlashCommandBuilder().setName('fishing-config').setDescription('Cấu hình bot ngay trên Discord').setDefaultMemberPermissions(PERM_ADMIN)
    .addSubcommand((s) => s.setName('xem').setDescription('Xem toàn bộ cấu hình hiện tại'))
    .addSubcommand((s) => s.setName('dat').setDescription('Đặt một giá trị cấu hình').addStringOption((o) => o.setName('khoa').setDescription('Khoá cấu hình').setRequired(true).setAutocomplete(true)).addNumberOption((o) => o.setName('giatri').setDescription('Giá trị mới').setRequired(true))),
  execute(i) {
    H.requireAdmin(i);
    if (i.options.getSubcommand() === 'xem') { const all = settings.all(); const lines = Object.entries(adminSvc.CONFIG_KEYS).map(([k, r]) => `\`${k}\` = **${all[k]}**${r ? ` (${r[0]}–${r[1]})` : ''}`); return emb(i, K.embed({ title: '⚙️ Cấu hình', color: COLOR.info, desc: lines.join('\n').slice(0, 3900), footer: 'Đổi bằng /fishing-config dat' })); }
    const v = adminSvc.setConfig(i.user.id, i.options.getString('khoa'), i.options.getNumber('giatri')); if (/^backup_/.test(i.options.getString('khoa'))) backup.startAuto();
    return reply(i, `✅ \`${i.options.getString('khoa')}\` = **${v}**`);
  },
  autocomplete(i) { return H.isAdmin(i) ? U.filterChoices(Object.keys(adminSvc.CONFIG_KEYS).map((k) => ({ name: k, value: k })), i.options.getFocused()) : []; },
};
/* ------------------------------------------------------------------ BACKUP / RESTORE trên Discord */
const nameOpt = (o, d) => o.setName('ten').setDescription(d).setAutocomplete(true);
const backupAuto = (i) => { if (!H.isAdmin(i)) return []; const q = i.options.getFocused(); return [{ name: '⭐ Bản mới nhất', value: 'moi_nhat' }, ...backup.list().map((b) => ({ name: `${b.file.replace('fishing-', '').replace('.sqlite.gz', '')} · ${F.bytes(b.bytes)}`, value: b.file }))].filter((x) => !q || x.name.includes(q)).slice(0, 25); };
async function createBackup(i, note) {
  const r = await backup.create({ kind: 'manual', by: i.user.id, note: note || 'tạo từ Discord' }); settings.log(i.user.id, 'backup_create', r.file, `${r.bytes}B`); const p = backup.prune();
  return { r, p };
}
const backupdb = {
  data: new SlashCommandBuilder().setName('backupdb').setDescription('Sao lưu cơ sở dữ liệu ngay lập tức (quản trị)').setDefaultMemberPermissions(PERM_ADMIN)
    .addStringOption((o) => o.setName('ghichu').setDescription('Ghi chú cho bản sao lưu').setMaxLength(100)).addBooleanOption((o) => o.setName('taive').setDescription('Gửi kèm tệp để tải về (nếu ≤ 24 MB)')),
  async execute(i) {
    H.requireAdmin(i); await i.deferReply({ flags: K.EPHEMERAL }); const { r, p } = await createBackup(i, i.options.getString('ghichu')); const files = []; const dl = i.options.getBoolean('taive') && r.bytes <= 24 * 1048576;
    if (dl) files.push({ attachment: r.path, name: r.file });
    return i.editReply({ embeds: [K.embed({ title: '💾 Đã sao lưu', color: COLOR.ok, desc: `\`${r.file}\`\nDung lượng **${F.bytes(r.bytes)}** · **${r.users}** người chơi · schema v${r.schema}\nSHA-256 \`${r.sha256.slice(0, 16)}…\`\n\n🧹 Dọn tự động: xoá ${p.deleted.length} bản cũ (${F.bytes(p.freed)}). Còn ${p.kept} bản.${!dl && i.options.getBoolean('taive') ? '\n⚠️ Tệp quá lớn để gửi qua Discord — lấy trực tiếp trên máy chủ.' : ''}` })], files });
  },
};
const backupCmd = {
  data: new SlashCommandBuilder().setName('fishing-backup').setDescription('Quản lý sao lưu cơ sở dữ liệu').setDefaultMemberPermissions(PERM_ADMIN)
    .addSubcommand((s) => s.setName('tao').setDescription('Tạo bản sao lưu ngay').addStringOption((o) => o.setName('ghichu').setDescription('Ghi chú').setMaxLength(100)))
    .addSubcommand((s) => s.setName('danh-sach').setDescription('Bảng điều khiển sao lưu (chọn, kiểm tra, ghim, xoá, khôi phục)'))
    .addSubcommand((s) => s.setName('tai-ve').setDescription('Tải một bản sao lưu về').addStringOption((o) => nameOpt(o, 'Tên bản sao lưu').setRequired(true)))
    .addSubcommand((s) => s.setName('xoa').setDescription('Xoá một bản sao lưu').addStringOption((o) => nameOpt(o, 'Tên bản sao lưu').setRequired(true)))
    .addSubcommand((s) => s.setName('ghim').setDescription('Ghim/bỏ ghim (bản ghim không bị tự dọn)').addStringOption((o) => nameOpt(o, 'Tên bản sao lưu').setRequired(true)).addBooleanOption((o) => o.setName('ghim').setDescription('true = ghim, false = bỏ ghim')))
    .addSubcommand((s) => s.setName('don-dep').setDescription('Dọn bản cũ theo chính sách giữ lại').addBooleanOption((o) => o.setName('xemtruoc').setDescription('Chỉ xem sẽ xoá gì')))
    .addSubcommand((s) => s.setName('trang-thai').setDescription('Trạng thái backup tự động')),
  async execute(i) {
    H.requireAdmin(i); const sub = i.options.getSubcommand();
    if (sub === 'tao') return backupdb.execute({ ...i, options: { getString: () => i.options.getString('ghichu'), getBoolean: () => false }, deferReply: (o) => i.deferReply(o), editReply: (o) => i.editReply(o), user: i.user, member: i.member, memberPermissions: i.memberPermissions });
    if (sub === 'danh-sach') return U.open(i, 'adminbk', ['0']);
    if (sub === 'trang-thai') { const f = backup.info(); const l = backup.list(); return emb(i, K.embed({ title: '⏱️ Backup tự động', color: COLOR.info, desc: `${f.enabled ? '✅ Đang bật' : '⛔ Đang tắt'} · mỗi **${f.intervalMin}** phút\nLần tới: ${f.nextAt ? F.rel(f.nextAt) : '—'}\nLần cuối: ${f.lastResult ? `${F.rel(f.lastResult.createdAt)} (\`${f.lastResult.file}\`)` : '—'}\n${f.lastError ? `⚠️ Lỗi gần nhất: ${f.lastError}\n` : ''}Hiện có **${l.length}** bản · **${F.bytes(backup.totalBytes(l))}**\nChính sách: giữ ${settings.get('backup_keep_auto')} bản tự động + 1/ngày × ${settings.get('backup_max_age_days')} ngày · ${settings.get('backup_keep_manual')} bản thủ công · tối đa ${settings.get('backup_max_total_mb')} MB · bản ghim không bị xoá.` })); }
    if (sub === 'don-dep') { const dry = !!i.options.getBoolean('xemtruoc'); const r = backup.prune({ dryRun: dry }); if (!dry) settings.log(i.user.id, 'backup_prune', null, `${r.deleted.length}`); return reply(i, `${dry ? '👀 Sẽ xoá' : '🧹 Đã xoá'} **${r.deleted.length}** bản (${F.bytes(r.freed)}), còn lại ${r.kept}.${r.deleted.length ? `\n${r.deleted.slice(0, 8).map((d) => `• \`${d.file}\` – ${d.reason}`).join('\n')}` : ''}`); }
    const e = backup.resolve(i.options.getString('ten')); if (!e) throw new GameError('Không tìm thấy bản sao lưu đó.');
    if (sub === 'tai-ve') { if (e.bytes > 24 * 1048576) throw new GameError(`Tệp ${F.bytes(e.bytes)} quá lớn để gửi qua Discord. Đường dẫn: ${path.join(config.backupDir, e.file)}`); return i.reply({ content: `⬇️ \`${e.file}\``, files: [{ attachment: path.join(config.backupDir, e.file), name: e.file }], flags: K.EPHEMERAL }); }
    if (sub === 'xoa') { backup.remove(e.file); settings.log(i.user.id, 'backup_delete', e.file, ''); return reply(i, `🗑️ Đã xoá \`${e.file}\`.`); }
    if (sub === 'ghim') { const v = i.options.getBoolean('ghim') ?? true; backup.pin(e.file, v); return reply(i, v ? `📌 Đã ghim \`${e.file}\`.` : `Đã bỏ ghim \`${e.file}\`.`); }
    return null;
  },
  autocomplete: backupAuto,
};
/** Khôi phục: chọn bản trong danh sách hoặc tải tệp .sqlite/.gz lên → hiện báo cáo kiểm tra → nút xác nhận + nhập mã. */
async function startRestore(i) {
  H.requireOwner(i); const att = i.options.getAttachment('tep'); let source;
  if (att) {
    if (att.size > 100 * 1048576) throw new GameError('Tệp quá lớn (tối đa 100 MB).'); if (!/\.(sqlite|db|gz)$/i.test(att.name)) throw new GameError('Chỉ nhận tệp .sqlite, .db hoặc .sqlite.gz.');
    await i.deferReply({ flags: K.EPHEMERAL }); const res = await fetch(att.url); if (!res.ok) throw new GameError(`Không tải được tệp (HTTP ${res.status}).`);
    const tmp = path.join(config.backupDir, '.tmp'); fs.mkdirSync(tmp, { recursive: true }); const file = path.join(tmp, `upload-${Date.now()}-${att.name.replace(/[^A-Za-z0-9._-]/g, '_')}`); fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    source = `up:${adminViews.addPending(file, i.user.id)}`;
    const payload = await require('../../interactions/registry').restore.render(H.ctxOf(i), [source]); return i.editReply(payload);
  }
  const e = backup.resolve(i.options.getString('ten') || 'moi_nhat'); if (!e) throw new GameError('Chưa có bản sao lưu nào để khôi phục.'); source = e.file;
  return U.open(i, 'restore', [source]);
}
const restoreOpts = (b) => b.addStringOption((o) => nameOpt(o, 'Bản sao lưu trong máy chủ (bỏ trống = mới nhất)')).addAttachmentOption((o) => o.setName('tep').setDescription('…hoặc tải lên tệp .sqlite / .sqlite.gz'));
const restoreDb = { data: restoreOpts(new SlashCommandBuilder().setName('restore_db').setDescription('Khôi phục dữ liệu từ bản sao lưu (CHỈ chủ bot)').setDefaultMemberPermissions(PERM_ADMIN)), execute: startRestore, autocomplete: backupAuto };
const fishingRestore = { data: restoreOpts(new SlashCommandBuilder().setName('fishing-restore').setDescription('Khôi phục dữ liệu từ bản sao lưu (CHỈ chủ bot)').setDefaultMemberPermissions(PERM_ADMIN)), execute: startRestore, autocomplete: backupAuto };
module.exports = [adminCmd, eventCmd, configCmd, backupCmd, backupdb, restoreDb, fishingRestore];
