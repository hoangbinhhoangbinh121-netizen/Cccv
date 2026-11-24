'use strict';
/** Điểm vào: mở DB → migration (tự backup trước khi nâng cấp) → nạp dữ liệu → khởi động bot + tác vụ nền. */
const justCreatedEnv = require('./ensureEnv')(); // tự tạo .env mẫu ở lần chạy đầu
const config = require('./config');
const logger = require('./utils/logger');
const { Db, setDb } = require('./database/connection');
const { migrate } = require('./database/migrate');
const backup = require('./database/backup');
const gameData = require('./services/gameData');
const ctx = require('./services/context');

async function main() {
  if (!config.token || !config.clientId) {
    if (justCreatedEnv) logger.warn('Đã tự tạo file .env ở thư mục gốc của bot.');
    logger.error('Chưa điền DISCORD_TOKEN / CLIENT_ID trong file .env. Hãy mở file .env, điền DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWNER_IDS, lưu lại rồi bấm Start lại.');
    process.exit(0);
  }
  const db = setDb(new Db(config.dbPath).open()); logger.info(`Database: ${config.dbPath} (${db.driver.name})`);
  const st = require('./database/migrate').status(db);
  if (st.pending.length && st.applied.length) { logger.info(`Có ${st.pending.length} migration mới – sao lưu trước khi nâng cấp…`); await backup.create({ kind: 'premigrate', note: `trước migration ${st.pending.map((m) => m.id).join(',')}` }); }
  migrate(db);
  gameData.load(); gameData.syncCatalogs(db);
  const fishing = require('./services/fishingService'); const n = fishing.recoverSessions(); if (n) logger.info(`Đã huỷ ${n} phiên câu dang dở sau khi khởi động lại và hoàn mồi.`);
  const bot = require('./bot'); const { client } = bot.create();
  const scheduler = require('./services/scheduler'); const fishingUI = require('./ui/fishingUI');

  backup.onBeforeRestore(() => { ctx.restoring = true; scheduler.stop(); fishingUI.clearAll(); });
  backup.onAfterRestore(() => { gameData.syncCatalogs(require('./database/connection').getDb()); const k = fishing.recoverSessions(); require('./database/repositories/settings').clearCache(); require('./ui/emoji').reset(); require('./services/eventService').invalidate(); scheduler.start(); if (k) logger.info(`Sau khôi phục: huỷ ${k} phiên dang dở.`); });

  client.once('ready', async () => {
    logger.info(`Đã đăng nhập: ${client.user.tag}`);
    try { const synced = Object.keys(JSON.parse(require('./database/repositories/settings').getRaw('emoji_ids') || '{}')).length; if (!synced) logger.info('Chưa tải emoji Pixel Art lên Discord – dùng /fishing-admin upload-emojis (hoặc npm run emojis). Ảnh vẫn hiển thị qua tệp đính kèm.'); } catch { /* bỏ qua */ }
    scheduler.start(); logger.info('Thiên Tông Fishing đã sẵn sàng 🎣');
    require('./autosetup').run(client);
  });
  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return; closing = true; logger.info(`Nhận ${sig}, đang tắt an toàn…`);
    try { scheduler.stop(); fishingUI.clearAll(); fishing.recoverSessions(); await backup.create({ kind: 'shutdown', note: sig }); } catch (e) { logger.warn(`Backup khi tắt lỗi: ${e.message}`); }
    try { client.destroy(); require('./database/connection').getDb().close(); } catch { /* đã đóng */ }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (e) => logger.error('unhandledRejection:', e?.stack || e)); process.on('uncaughtException', (e) => logger.error('uncaughtException:', e.stack || e.message));
  await client.login(config.token);
}
main().catch((e) => { console.error(e); process.exit(1); });
