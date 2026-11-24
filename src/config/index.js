'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

/** Đọc .env (không phụ thuộc thư viện ngoài). Biến môi trường thật luôn được ưu tiên. */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));
const e = process.env;
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const abs = (p, d) => path.resolve(ROOT, p || d);

module.exports = {
  ROOT,
  token: e.DISCORD_TOKEN || '',
  clientId: e.CLIENT_ID || '',
  guildId: e.GUILD_ID || '',
  ownerIds: list(e.OWNER_IDS),
  adminRoleId: e.ADMIN_ROLE_ID || '',
  announceChannelId: e.ANNOUNCE_CHANNEL_ID || '',
  logChannelId: e.LOG_CHANNEL_ID || '',
  dbPath: abs(e.DB_PATH, 'data/fishing.sqlite'),
  backupDir: abs(e.BACKUP_DIR, 'backups'),
  dbDriver: e.DB_DRIVER || 'auto',
  tzOffsetHours: int(e.TZ_OFFSET_HOURS, 7),
  assetsDir: path.join(ROOT, 'assets'),
  dataDir: path.join(ROOT, 'data'),
  /** Giá trị mặc định – có thể ghi đè trực tiếp trên Discord bằng /fishing-config (lưu trong bảng settings). */
  defaults: {
    backup_interval_min: int(e.BACKUP_INTERVAL_MIN, 60),
    backup_keep_auto: int(e.BACKUP_KEEP_AUTO, 48),
    backup_keep_manual: int(e.BACKUP_KEEP_MANUAL, 15),
    backup_max_age_days: int(e.BACKUP_MAX_AGE_DAYS, 7),
    backup_max_total_mb: int(e.BACKUP_MAX_TOTAL_MB, 500),
    backup_auto_enabled: 1,
    backup_upload_log: 0,
    market_fee_pct: 5,
    market_max_listings: 20,
    market_expire_hours: 72,
    transfer_fee_pct: 3,
    transfer_daily_cap: 500000,
    transfer_min_level: 5,
    daily_xu_base: 300,
    exp_rate: 1,
    xu_rate: 1,
    luck_rate: 1,
    boss_auto_spawn: 1,
    boss_respawn_hours: 6,
    maintenance: 0,
    announce_channel: e.ANNOUNCE_CHANNEL_ID || '',
    log_channel: e.LOG_CHANNEL_ID || '',
  },
};
