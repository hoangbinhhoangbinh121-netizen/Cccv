'use strict';
const { SlashCommandBuilder } = require('discord.js');
const U = require('../util');
const shopSvc = require('../../services/shopService');
module.exports = [
  U.simple({ name: 'cuahang', description: 'Cửa hàng NPC: mồi, phao, dây, lưỡi, bình, rương, trứng, cần câu', view: 'shop', build: (b) => b.addStringOption((o) => o.setName('danhmuc').setDescription('Danh mục').addChoices(...Object.entries(shopSvc.CATS).map(([k, v]) => ({ name: v, value: k })))), args: (i) => [i.options.getString('danhmuc') || undefined] }),
  { data: new SlashCommandBuilder().setName('giaodich').setDescription('Chuyển xu cho người chơi khác (có phí và hạn mức/ngày)')
      .addUserOption((o) => o.setName('nguoi').setDescription('Người nhận').setRequired(true)).addIntegerOption((o) => o.setName('soxu').setDescription('Số xu muốn chuyển (tối thiểu 100)').setRequired(true).setMinValue(100).setMaxValue(2000000000)),
    execute(i) { const to = i.options.getUser('nguoi'); const { GameError } = require('../../utils/errors'); if (to.bot) throw new GameError('Không thể chuyển xu cho bot.'); if (to.id === i.user.id) throw new GameError('Không thể tự chuyển cho chính mình.'); return U.open(i, 'trade', [to.id, String(i.options.getInteger('soxu'))]); } },
];
