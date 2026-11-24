'use strict';
const U = require('../util');
const K = require('../../ui/kit');
const itemSvc = require('../../services/itemService');
const { SlashCommandBuilder } = require('discord.js');
const { describeUse } = require('../../ui/describe');
module.exports = [
  U.simple({ name: 'kho', description: 'Mở kho đồ (vật phẩm, nguyên liệu, mồi…)', view: 'inventory' }),
  U.simple({ name: 'khoca', description: 'Kho cá: tìm kiếm, sắp xếp, khoá, bán, đăng chợ', view: 'fishbag' }),
  U.simple({ name: 'ban_ca', description: 'Bán cá hàng loạt theo phẩm cấp / khu vực', view: 'sell' }),
  { data: new SlashCommandBuilder().setName('sudung').setDescription('Dùng rương, bình, trứng thú, thức ăn thú, phù…')
      .addStringOption((o) => o.setName('vatpham').setDescription('Vật phẩm muốn dùng (bỏ trống để mở danh sách)').setAutocomplete(true))
      .addIntegerOption((o) => o.setName('soluong').setDescription('Số lượng (mặc định 1)').setMinValue(1).setMaxValue(999)),
    async execute(i) {
      const id = i.options.getString('vatpham'); if (!id) return U.open(i, 'inventory', ['usable', '0']);
      const r = itemSvc.use(i.user.id, id, i.options.getInteger('soluong') || 1); return i.reply({ content: describeUse(r), flags: K.EPHEMERAL });
    },
    autocomplete(i) { return U.filterChoices(U.choices.items(i.user.id, (d) => ['chest', 'potion', 'egg', 'petfood', 'misc'].includes(d.type)), i.options.getFocused()); } },
];
