'use strict';
/** Khởi tạo client Discord, đăng ký bộ định tuyến, nối sự kiện game → thông báo kênh. */
const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const ctx = require('./services/context');
const router = require('./interactions/router');
const { loadCommands } = require('./commands');
const K = require('./ui/kit');
const { D } = require('./services/gameData');
const { F, COLOR } = K;

let client = null;
async function sendTo(channelId, payload) {
  if (!client || !channelId) return false;
  try { const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId); if (!ch || !ch.send) return false; await ch.send(payload); return true; } catch (e) { logger.warn(`Không gửi được vào kênh ${channelId}: ${e.message}`); return false; }
}
const announce = (payload) => sendTo(config.announceChannelId, payload);
const logChannel = (payload) => sendTo(config.logChannelId || config.announceChannelId, payload);

/** Game phát sự kiện qua ctx → bot đăng thông báo (chỉ chạy khi có kênh cấu hình). */
function wireAnnouncements() {
  ctx.on('bossSpawned', ({ instance, def }) => announce({ embeds: [K.embed({ title: `👹 ${def.name} xuất hiện!`, color: COLOR.err, desc: `Tại **${D.locations.get(instance.location).name}** · HP ${F.num(instance.max_hp)}\nRời đi ${F.rel(instance.ends_at)} — dùng \`/boss\` hoặc \`/toidau\` để tham chiến!` })] }));
  ctx.on('bossDefeated', ({ def, winners, lastHitBy }) => announce({ embeds: [K.embed({ title: `🏆 ${def.name} đã bị hạ!`, color: COLOR.gold, desc: winners.slice(0, 5).map((w, i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} **${w.name}** — ${F.num(w.damage)} sát thương (+${F.xu(w.xu)})`).join('\n') + `\n\nĐòn kết liễu: <@${lastHitBy}>` })] }));
  ctx.on('bossExpired', ({ def }) => announce({ content: `💨 **${def.name}** đã bỏ đi vì không bị hạ kịp thời.` }));
  ctx.on('eventStarted', ({ event }) => announce({ embeds: [K.embed({ title: `🎪 Sự kiện bắt đầu: ${event.name}`, color: COLOR.gold, desc: `${event.data.desc || ''}\nKết thúc ${F.rel(event.end_at)}. Dùng \`/sukien\` để tham gia.` })] }));
  ctx.on('eventEnded', ({ event, result }) => announce({ embeds: [K.embed({ title: `🏁 Sự kiện kết thúc: ${event.name}`, color: COLOR.info, desc: result?.winners?.length ? result.winners.slice(0, 5).map((w) => `${w.rank}. **${w.name}** — ${F.num(w.score)} điểm`).join('\n') : 'Cảm ơn mọi người đã tham gia!' })] }));
  ctx.on('sessionEnded', (s) => { const r = s.result; if (s.kind !== 'boss' && r?.outcome === 'success') { const f = D.fishes.get(r.fishId); if (f && f.rarity >= 7) announce({ content: `🎣 <@${s.user_id}> vừa câu được **${f.name}** [${require('./systems/rarity').name(f.rarity)}] nặng ${F.kg(r.weight)}! 🎉` }); } });
}
const prefix = require('./prefix');
let readyFns = []; let wantContent = config.prefixEnabled;
/** Dựng client. Có Message Content Intent (đặc quyền) thì đọc được lệnh tiền tố; nếu Discord từ chối intent này, login() dựng lại không có nó. */
function build() {
  const intents = [GatewayIntentBits.Guilds]; if (wantContent) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  client = new Client({ intents }); ctx.client = client;
  client.on(Events.InteractionCreate, (i) => { router.handle(i).catch((e) => logger.error('router lỗi không bắt được:', e.stack || e.message)); });
  if (wantContent) client.on(Events.MessageCreate, (m) => { prefix.onMessage(m); });
  client.on(Events.Error, (e) => logger.error('Discord client lỗi:', e.message));
  for (const f of readyFns) client.once(Events.ClientReady, f);
  return client;
}
function create() {
  const commands = loadCommands(); router.setCommands(commands); prefix.setCommands(commands);
  build(); wireAnnouncements();
  return { client, commands };
}
const onReady = (fn) => { readyFns.push(fn); if (client) client.once(Events.ClientReady, fn); };
async function login() {
  try { return await client.login(config.token); }
  catch (e) {
    const denied = /disallowed intents/i.test(String(e && e.message)) || (e && (e.code === 'DisallowedIntents' || e.code === 4014));
    if (!(wantContent && denied)) throw e;
    logger.warn(`Chưa bật "Message Content Intent" nên tạm tắt lệnh tiền tố (${config.prefix}). Bật tại discord.com/developers/applications → ứng dụng → Bot → Privileged Gateway Intents → Message Content Intent, rồi khởi động lại bot. Lệnh / vẫn dùng bình thường.`);
    wantContent = false; try { client.destroy(); } catch { /* đã đóng */ }
    build(); return client.login(config.token);
  }
}
const getClient = () => client;
module.exports = { create, login, onReady, announce, logChannel, getClient };
