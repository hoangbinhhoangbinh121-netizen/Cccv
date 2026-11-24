'use strict';
/** Nếu chưa có file .env thì tự tạo từ .env.example (hoặc mẫu dựng sẵn) để người dùng mở ra điền. Không phụ thuộc module nào. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FALLBACK = `# ===== Bắt buộc =====
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=

# ===== Quản trị =====
# ID Discord của chủ bot (phân tách bằng dấu phẩy) – được dùng /restore_db
OWNER_IDS=
ADMIN_ROLE_ID=
ANNOUNCE_CHANNEL_ID=
LOG_CHANNEL_ID=

# ===== Dữ liệu =====
DB_PATH=./data/fishing.sqlite
BACKUP_DIR=./backups
DB_DRIVER=auto

# ===== Backup tự động =====
BACKUP_INTERVAL_MIN=60
BACKUP_KEEP_AUTO=48
BACKUP_KEEP_MANUAL=15
BACKUP_MAX_AGE_DAYS=7
BACKUP_MAX_TOTAL_MB=500

# ===== Khác =====
TZ_OFFSET_HOURS=7
LOG_LEVEL=info
AUTO_SETUP=1
`;
/** @returns {boolean} true nếu vừa tạo mới */
function ensureEnv() {
  const target = path.join(ROOT, '.env');
  try {
    if (fs.existsSync(target)) return false;
    const ex = path.join(ROOT, '.env.example');
    fs.writeFileSync(target, fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : FALLBACK, { flag: 'wx' });
    return true;
  } catch (e) { console.warn(`Không tự tạo được .env: ${e.message}`); return false; }
}
module.exports = ensureEnv;
