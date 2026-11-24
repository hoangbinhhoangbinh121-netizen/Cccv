'use strict';
module.exports = {
  id: 2, name: 'settings_audit',
  sql: `
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT, created_at INTEGER NOT NULL);
CREATE INDEX idx_admin_log ON admin_log(id DESC);
CREATE TABLE backup_log (id INTEGER PRIMARY KEY AUTOINCREMENT, file TEXT NOT NULL, kind TEXT NOT NULL, bytes INTEGER, sha256 TEXT, ok INTEGER NOT NULL DEFAULT 1, note TEXT, created_at INTEGER NOT NULL);
`,
};
