'use strict';
/** Chạy migration tuần tự, ghi checksum vào schema_migrations. Có thể gắn hook `beforeApply` để tự backup trước khi nâng cấp. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const DIR = path.join(__dirname, 'migrations');
const load = () => fs.readdirSync(DIR).filter((f) => /^\d+_.*\.js$/.test(f)).sort().map((f) => require(path.join(DIR, f)));
const checksum = (m) => crypto.createHash('sha256').update(m.sql).digest('hex').slice(0, 16);

function status(db) {
  const hasTable = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'");
  const applied = hasTable ? db.all('SELECT id, name, checksum FROM schema_migrations ORDER BY id') : [];
  const all = load();
  return { applied, pending: all.filter((m) => !applied.some((a) => a.id === m.id)), latest: all[all.length - 1].id, all };
}

function migrate(db, { beforeApply } = {}) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const st = status(db);
  const maxApplied = st.applied.reduce((a, b) => Math.max(a, b.id), 0);
  if (maxApplied > st.latest) throw new Error(`Database mới hơn bot (schema ${maxApplied} > ${st.latest}). Hãy cập nhật bot.`);
  for (const a of st.applied) { const m = st.all.find((x) => x.id === a.id); if (m && a.checksum !== checksum(m)) logger.warn(`Migration ${a.id} đã bị sửa sau khi áp dụng (checksum lệch).`); }
  if (!st.pending.length) return { applied: [], version: maxApplied };
  if (beforeApply && st.applied.length) beforeApply(st.pending);
  const done = [];
  for (const m of st.pending) {
    db.tx(() => { db.exec(m.sql); db.run('INSERT INTO schema_migrations (id, name, checksum, applied_at) VALUES (?,?,?,?)', m.id, m.name, checksum(m), Date.now()); });
    logger.info(`Migration ${m.id}_${m.name} đã áp dụng`); done.push(m.id);
  }
  return { applied: done, version: st.latest };
}
module.exports = { migrate, status, load };
