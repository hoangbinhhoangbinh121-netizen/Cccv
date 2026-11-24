'use strict';
const { SlashCommandBuilder } = require('discord.js');
const U = require('../util');
module.exports = [
  U.simple({ name: 'thitruong', description: 'Chợ người chơi: duyệt, đăng bán, huỷ tin, lịch sử', view: 'market', ephemeral: false, build: (b) => b.addStringOption((o) => o.setName('loai').setDescription('Loại hàng').addChoices({ name: 'Cá', value: 'fish' }, { name: 'Cần câu', value: 'rod' }, { name: 'Vật phẩm', value: 'item' })), args: (i) => ['browse', i.options.getString('loai') || 'all'] }),
  { data: new SlashCommandBuilder().setName('muamoi').setDescription('Mua nhanh một tin đăng trên chợ theo mã số').addIntegerOption((o) => o.setName('ma').setDescription('Mã tin đăng (số sau dấu #)').setRequired(true).setMinValue(1)),
    execute(i) { return U.open(i, 'market', ['browse', 'all', 'moi', '0', String(i.options.getInteger('ma'))]); } },
];
