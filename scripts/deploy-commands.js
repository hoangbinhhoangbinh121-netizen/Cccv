'use strict';
/** Đăng ký slash command lên Discord. Có GUILD_ID → đăng ký theo máy chủ (hiệu lực ngay); không có → toàn cầu (≤1 giờ). Dùng: npm run deploy [-- --clear] */
const { REST, Routes } = require('discord.js');
const config = require('../src/config');
const gameData = require('../src/services/gameData');
(async () => {
  if (!config.token || !config.clientId) { console.error('Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong .env'); process.exit(1); }
  gameData.load(); const { loadCommands } = require('../src/commands');
  const body = process.argv.includes('--clear') ? [] : [...loadCommands().values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);
  const route = config.guildId ? Routes.applicationGuildCommands(config.clientId, config.guildId) : Routes.applicationCommands(config.clientId);
  const res = await rest.put(route, { body });
  console.log(`✔ Đã đăng ký ${res?.length || body.length} lệnh ${config.guildId ? `cho máy chủ ${config.guildId}` : '(toàn cầu)'}`);
})().catch((e) => { console.error(e); process.exit(1); });
