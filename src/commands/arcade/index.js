'use strict';
/** /ngutruong – Ngư Trường Giải Trí (đua cá, tài xỉu, hộp, đố…). Gõ `.ngutruong …` hoặc lối tắt `.dua` `.taixiu` `.bihop` `.quiz` cũng được. */
const { SlashCommandBuilder } = require('discord.js');
const views = require('../../interactions/registry');
const H = require('../../interactions/helpers');
const K = require('../../ui/kit');

const SUBS = [
  ['menu', 'Mở sảnh Ngư Trường Giải Trí', 'ng', []],
  ['dua', 'Đoán Ngư Vương – chọn cá thắng cuộc đua', 'ngrace', []],
  ['taixiu', 'Tài Xỉu Linh Vận – đoán Tài/Xỉu lấy Linh Điểm', 'ngdice', []],
  ['bihop', 'Linh Bảo Bí Hộp – mở hộp sưu tầm', 'ngbox', []],
  ['quiz', 'Truy Tìm Linh Ngư – đố vui về cá', 'ngquiz', []],
  ['xephang', 'Bảng xếp hạng Linh Điểm (tuần/mùa/tích luỹ)', 'ngrank', []],
  ['nhiemvu', 'Nhiệm vụ giải trí hằng ngày', 'ngme', ['mission']],
  ['thanhtich', 'Thành tích giải trí', 'ngme', ['ach']],
  ['suutam', 'Bộ sưu tập Linh Bảo', 'ngme', ['bag']],
  ['thongke', 'Thống kê & hồ sơ giải trí', 'ngme', ['stats']],
  ['huongdan', 'Hướng dẫn Ngư Trường', 'ng', ['help']],
];
const data = new SlashCommandBuilder().setName('ngutruong').setDescription('Ngư Trường Giải Trí: đua cá, tài xỉu, hộp, đố vui');
for (const [name, desc] of SUBS) data.addSubcommand((s) => s.setName(name).setDescription(desc));

/** Mở một view rồi bật hoạt ảnh (nếu view có). Tin nhắn riêng tư (ephemeral) để không làm ồn kênh. */
async function openView(i, name, args) {
  const view = views[name]; const c = H.ctxOf(i); const payload = await view.render(c, args);
  await i.reply({ ...payload, flags: K.EPHEMERAL });
  if (view.afterShow) view.afterShow(c, args, (p) => i.editReply(p));
}
module.exports = {
  data,
  async execute(i) {
    const sub = (i.options.getSubcommand(false)) || 'menu'; const row = SUBS.find((x) => x[0] === sub) || SUBS[0];
    return openView(i, row[2], row[3]);
  },
  openView, SUBS,
};
