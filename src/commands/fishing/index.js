'use strict';
const { SlashCommandBuilder } = require('discord.js');
const U = require('../util');
const K = require('../../ui/kit');
const H = require('../../interactions/helpers');
const fishing = require('../../services/fishingService');
const fishingUI = require('../../ui/fishingUI');
const sessRepo = require('../../database/repositories/sessions');
const { GameError } = require('../../utils/errors');

const cauca = {
  data: new SlashCommandBuilder().setName('cauca').setDescription('Thả câu! Chờ cá cắn rồi giật cần và kéo cá')
    .addStringOption((o) => o.setName('khuvuc').setDescription('Khu vực muốn câu (mặc định: nơi bạn đang đứng)').setAutocomplete(true))
    .addStringOption((o) => o.setName('moi').setDescription('Loại mồi dùng cho lần này (mặc định: mồi đang trang bị)').setAutocomplete(true)),
  async execute(i) {
    const uid = i.user.id; const cur = fishing.getActive(uid);
    if (cur) { if (cur.state === 'waiting' || cur.state === 'bite' || cur.state === 'reeling') throw new GameError('Bạn đang có một phiên câu chưa kết thúc! Hãy hoàn tất hoặc bấm **Thu cần** ở tin nhắn câu cũ.', 'BUSY'); }
    const s = fishing.startCast(uid, { location: i.options.getString('khuvuc') || undefined, baitId: i.options.getString('moi') || undefined, channelId: i.channelId });
    await i.reply(fishingUI.render(s)); try { const m = await i.fetchReply(); sessRepo.update(s.id, { message_id: m.id }); } catch { /* không bắt buộc */ }
    fishingUI.track(s, (p) => i.editReply(H.finalize(p)));
  },
  autocomplete(i) { const f = i.options.getFocused(true); const uid = i.user.id; return U.filterChoices(f.name === 'khuvuc' ? U.choices.locations(uid) : U.choices.baits(uid), f.value); },
};
module.exports = [cauca,
  U.simple({ name: 'khuvuc', description: 'Xem, di chuyển và mở khoá các khu vực câu cá', view: 'locations' }),
  U.simple({ name: 'codex', description: 'Sổ tay sưu tầm các loài cá bạn đã bắt được', view: 'codex' }),
  U.simple({ name: 'sukien', description: 'Xem sự kiện đang diễn ra và sắp diễn ra', view: 'events', ephemeral: false })];
