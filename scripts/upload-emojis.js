'use strict';
/** Tải toàn bộ ảnh Pixel Art (assets/manifest.json) lên làm Application Emoji của bot. Chạy: npm run emojis */
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../src/config');
const { Db, setDb } = require('../src/database/connection');
const { migrate } = require('../src/database/migrate');
const gameData = require('../src/services/gameData');
const emoji = require('../src/ui/emoji');
(async () => {
  if (!config.token) { console.error('Thiếu DISCORD_TOKEN'); process.exit(1); }
  const db = setDb(new Db(config.dbPath).open()); migrate(db); gameData.load();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] }); await client.login(config.token);
  await new Promise((r) => client.once('ready', r));
  const r = await emoji.syncToDiscord(client, { onProgress: (p) => console.log(`… ${p.created}/${p.total}`) });
  console.log(`✔ Emoji: mới ${r.created}, dùng lại ${r.reused}, lỗi ${r.failed.length}/${r.total}`); r.failed.slice(0, 10).forEach((f) => console.log('  ✖', f));
  client.destroy(); db.close(); process.exit(r.failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
