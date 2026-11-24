'use strict';
const U = require('../util');
const H = require('../../interactions/helpers');
const userSvc = require('../../services/userService');
const progRepo = require('../../database/repositories/progress');
const K = require('../../ui/kit');
const { F } = K;
module.exports = [
  U.simple({ name: 'thongtin', description: 'Xem hồ sơ người chơi (của bạn hoặc người khác)', view: 'profile', ephemeral: false, build: (b) => b.addUserOption((o) => o.setName('nguoi').setDescription('Người chơi muốn xem')), args: (i) => [i.options.getUser('nguoi')?.id] }),
  { data: U.simple({ name: 'daily', description: 'Nhận quà điểm danh hằng ngày', view: 'profile' }).data,
    async execute(i) { const r = userSvc.daily(i.user.id); return i.reply({ embeds: [K.embed({ title: `📅 Điểm danh ngày ${r.streak}/7`, color: K.COLOR.ok, desc: `Nhận **${F.xu(r.xu)}**${Object.keys(r.items).length ? ` và ${K.itemsText(r.items)}` : ''}.\nNgày mai là ngày ${r.nextDay}/7 — đừng bỏ lỡ để giữ chuỗi!` })], flags: K.EPHEMERAL }); } },
  U.simple({ name: 'nhiemvu', description: 'Nhiệm vụ ngày, tuần và chuỗi nhiệm vụ', view: 'missions' }),
  U.simple({ name: 'thanh_tuu', description: 'Danh sách thành tựu và nhận thưởng', view: 'achievements' }),
  U.simple({ name: 'bangxephang', description: 'Xem 8 bảng xếp hạng của máy chủ', view: 'leaderboard', ephemeral: false, build: (b) => b.addStringOption((o) => o.setName('bang').setDescription('Bảng muốn xem').addChoices(...Object.entries(progRepo.BOARDS).map(([k, v]) => ({ name: v.name, value: k })))), args: (i) => [i.options.getString('bang') || undefined] }),
  U.simple({ name: 'huongdan', description: 'Hướng dẫn chơi nhanh', view: 'help' }),
];
