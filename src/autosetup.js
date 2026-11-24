'use strict';
/**
 * Tự cài đặt khi khởi động (dành cho host không có terminal như VibeHost/Pterodactyl):
 *  - Đăng ký slash command nếu danh sách lệnh thay đổi so với lần trước.
 *  - Tải emoji Pixel Art lên làm Application Emoji nếu chưa có / có ảnh mới.
 * Tắt bằng AUTO_SETUP=0 trong .env. Lỗi ở đây không làm bot dừng.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const settings = require('./database/repositories/settings');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const enabled = () => String(process.env.AUTO_SETUP ?? '1') !== '0';

async function commands() {
  const { loadCommands } = require('./commands');
  const body = [...loadCommands().values()].map((c) => c.data.toJSON());
  const h = sha(JSON.stringify(body) + (config.guildId || 'global') + config.clientId);
  if (settings.getRaw('commands_hash') === h) { logger.info(`Lệnh slash đã đăng ký (${body.length} lệnh) – bỏ qua.`); return; }
  const rest = new REST({ version: '10' }).setToken(config.token);
  const route = config.guildId ? Routes.applicationGuildCommands(config.clientId, config.guildId) : Routes.applicationCommands(config.clientId);
  const res = await rest.put(route, { body });
  settings.set('commands_hash', h);
  logger.info(`Đã tự đăng ký ${res?.length || body.length} lệnh slash ${config.guildId ? `cho máy chủ ${config.guildId}` : '(toàn cầu, có thể mất tới 1 giờ)'}.`);
}

async function emojis(client) {
  const emoji = require('./ui/emoji');
  const mf = path.join(config.assetsDir, 'manifest.json');
  const h = sha(fs.readFileSync(mf, 'utf8'));
  const have = Object.keys(JSON.parse(settings.getRaw('emoji_ids') || '{}')).length;
  if (have && settings.getRaw('emoji_manifest_hash') === h) { logger.info('Emoji đã đồng bộ – bỏ qua.'); return; }
  logger.info('Đang tải emoji Pixel Art lên Discord (chạy nền, có thể mất vài phút)…');
  const r = await emoji.syncToDiscord(client, { onProgress: (p) => logger.info(`Emoji: ${p.created}/${p.total}`) });
  if (!r.failed.length) settings.set('emoji_manifest_hash', h);
  else logger.warn(`Emoji lỗi ${r.failed.length}/${r.total}: ${r.failed.slice(0, 3).join(' | ')}`);
}

/** Gọi sau khi bot ready. Không chặn luồng chính. */
function run(client) {
  if (!enabled()) return;
  (async () => {
    try { await commands(); } catch (e) { logger.error(`Tự đăng ký lệnh lỗi: ${e.message}`); }
    try { await emojis(client); } catch (e) { logger.error(`Tự tải emoji lỗi: ${e.message}`); }
  })();
}
module.exports = { run, commands, emojis };
