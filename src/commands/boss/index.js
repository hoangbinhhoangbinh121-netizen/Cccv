'use strict';
const { SlashCommandBuilder } = require('discord.js');
const U = require('../util');
const H = require('../../interactions/helpers');
const bossSvc = require('../../services/bossService');
const fishingUI = require('../../ui/fishingUI');
const { GameError } = require('../../utils/errors');
module.exports = [
  U.simple({ name: 'boss', description: 'Xem boss đang xuất hiện, bảng đóng góp và tổ đội', view: 'boss', ephemeral: false }),
  { data: new SlashCommandBuilder().setName('toidau').setDescription('Tấn công boss đang xuất hiện (hoặc vào tổ đội của bạn bè)')
      .addUserOption((o) => o.setName('tothoi').setDescription('Vào tổ đội của người này (nếu họ đã lập)')).addIntegerOption((o) => o.setName('boss').setDescription('Mã boss (bỏ trống = boss đang hoạt động)').setMinValue(1)),
    async execute(i) {
      const list = bossSvc.activeList(); const id = i.options.getInteger('boss') || list.find((b) => { try { require('../../services/fishingService').checkLocationAccess(i.user.id, b.location); return true; } catch { return false; } })?.id || list[0]?.id;
      if (!id) throw new GameError('Hiện chưa có boss nào xuất hiện. Dùng `/boss` để xem lịch.'); const leader = i.options.getUser('tothoi');
      if (leader) { bossSvc.joinParty(i.user.id, id, leader.id); }
      const s = bossSvc.attack(i.user.id, id, { channelId: i.channelId }); await i.reply(fishingUI.render(s)); fishingUI.track(s, (p) => i.editReply(H.finalize(p)));
    } },
];
