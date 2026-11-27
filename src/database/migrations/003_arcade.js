'use strict';
/** Ngư Trường Giải Trí: điểm giải trí riêng (không phải ví xu), phiên chơi, lịch sử, sưu tầm, thành tích. */
module.exports = {
  id: 3, name: 'arcade',
  sql: `
CREATE TABLE arcade_player (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL
);
CREATE TABLE arcade_points (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('all','d','w','s')), pkey TEXT NOT NULL,
  pts INTEGER NOT NULL DEFAULT 0 CHECK (pts >= 0), PRIMARY KEY (user_id, kind, pkey)
);
CREATE INDEX idx_arcade_points_rank ON arcade_points(kind, pkey, pts DESC);
CREATE TABLE arcade_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL, ref TEXT NOT NULL, requested INTEGER NOT NULL, applied INTEGER NOT NULL, note TEXT, created_at INTEGER NOT NULL,
  UNIQUE (user_id, game, ref)
);
CREATE INDEX idx_arcade_ledger_user ON arcade_ledger(user_id, id DESC);
CREATE TABLE arcade_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', phase TEXT NOT NULL, nonce TEXT NOT NULL, data TEXT NOT NULL,
  started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX uq_arcade_active ON arcade_sessions(user_id, game) WHERE status = 'active';
CREATE INDEX idx_arcade_sessions_open ON arcade_sessions(status, expires_at);
CREATE TABLE arcade_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL, ref TEXT NOT NULL, detail TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  UNIQUE (user_id, game, ref)
);
CREATE INDEX idx_arcade_history ON arcade_history(user_id, game, id DESC);
CREATE TABLE arcade_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1, first_at INTEGER NOT NULL, PRIMARY KEY (user_id, item_id)
);
CREATE TABLE arcade_counter (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, k)
);
CREATE TABLE arcade_ach (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, ach_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, ach_id)
);
`,
};
