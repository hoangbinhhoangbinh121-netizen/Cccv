'use strict';
module.exports = {
  id: 1, name: 'init',
  sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'ao_lang', title TEXT, inv_capacity INTEGER NOT NULL DEFAULT 200,
  daily_streak INTEGER NOT NULL DEFAULT 0, last_daily TEXT, banned INTEGER NOT NULL DEFAULT 0, ban_reason TEXT,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL
);
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_catch INTEGER NOT NULL DEFAULT 0, total_weight REAL NOT NULL DEFAULT 0, rare_catch INTEGER NOT NULL DEFAULT 0,
  legend_catch INTEGER NOT NULL DEFAULT 0, ancient_catch INTEGER NOT NULL DEFAULT 0, unique_catch INTEGER NOT NULL DEFAULT 0,
  deep_catch INTEGER NOT NULL DEFAULT 0, boss_kills INTEGER NOT NULL DEFAULT 0, boss_damage INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0, coins_spent INTEGER NOT NULL DEFAULT 0, sales_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0, escaped_count INTEGER NOT NULL DEFAULT 0, best_weight REAL NOT NULL DEFAULT 0, best_fish TEXT,
  rod_upgrades INTEGER NOT NULL DEFAULT 0, rod_enhances INTEGER NOT NULL DEFAULT 0, crafts INTEGER NOT NULL DEFAULT 0,
  market_sales INTEGER NOT NULL DEFAULT 0, market_buys INTEGER NOT NULL DEFAULT 0, chests_opened INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE currencies (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, code TEXT NOT NULL DEFAULT 'xu',
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), PRIMARY KEY (user_id, code)
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'xu', amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL, type TEXT NOT NULL, ref TEXT, note TEXT, idem_key TEXT UNIQUE, created_at INTEGER NOT NULL
);
CREATE INDEX idx_tx_user ON transactions(user_id, id DESC);
CREATE TABLE inventory (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0), locked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, item_id)
);
CREATE TABLE fish_catalog (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, rarity INTEGER NOT NULL, category TEXT, location TEXT, min_weight REAL, max_weight REAL,
  price_per_kg INTEGER, exp INTEGER, difficulty INTEGER, spawn_weight REAL, data TEXT
);
CREATE TABLE fish_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, fish_id TEXT NOT NULL,
  weight REAL NOT NULL, variant TEXT NOT NULL DEFAULT 'thuong', rarity INTEGER NOT NULL, base_value INTEGER NOT NULL,
  location TEXT, caught_at INTEGER NOT NULL, locked INTEGER NOT NULL DEFAULT 0, listed INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'cau'
);
CREATE INDEX idx_fish_user ON fish_instances(user_id, rarity);
CREATE TABLE rod_catalog (id TEXT PRIMARY KEY, name TEXT NOT NULL, tier INTEGER NOT NULL, data TEXT);
CREATE TABLE rod_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, rod_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1, enhance INTEGER NOT NULL DEFAULT 0, durability INTEGER NOT NULL, max_durability INTEGER NOT NULL,
  awaken INTEGER NOT NULL DEFAULT 0, sockets TEXT NOT NULL DEFAULT '[]', skin TEXT, pity INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0, listed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX idx_rod_user ON rod_instances(user_id);
CREATE TABLE equipment (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, rod_id INTEGER, bait_id TEXT, float_id TEXT, line_id TEXT, hook_id TEXT, pet_id INTEGER
);
CREATE TABLE baits (id TEXT PRIMARY KEY, name TEXT NOT NULL, tier INTEGER, price INTEGER, data TEXT);
CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT NOT NULL, ord INTEGER, data TEXT);
CREATE TABLE user_locations (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, location_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, location_id));
CREATE TABLE user_skins (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, skin_id TEXT NOT NULL, PRIMARY KEY (user_id, skin_id));
CREATE TABLE fishing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'fish', location TEXT, rod_instance_id INTEGER, bait_id TEXT,
  state TEXT NOT NULL, nonce TEXT NOT NULL, started_at INTEGER NOT NULL, bite_at INTEGER, deadline_at INTEGER, ended_at INTEGER,
  channel_id TEXT, message_id TEXT, data TEXT NOT NULL DEFAULT '{}', result TEXT
);
CREATE UNIQUE INDEX uq_session_active ON fishing_sessions(user_id) WHERE state IN ('waiting','bite','reeling');
CREATE TABLE fishing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, session_id INTEGER, fish_id TEXT, fish_instance_id INTEGER, location TEXT,
  weight REAL, rarity INTEGER, variant TEXT, result TEXT NOT NULL, exp INTEGER NOT NULL DEFAULT 0, value INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX idx_hist_user ON fishing_history(user_id, id DESC);
CREATE TABLE pets (id TEXT PRIMARY KEY, name TEXT NOT NULL, rarity INTEGER, data TEXT);
CREATE TABLE pet_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, pet_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0, bond INTEGER NOT NULL DEFAULT 0, stage INTEGER NOT NULL DEFAULT 1,
  nickname TEXT, locked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX idx_pet_user ON pet_instances(user_id);
CREATE TABLE missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, mission_key TEXT NOT NULL,
  period_key TEXT NOT NULL, target REAL NOT NULL, progress REAL NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0, meta TEXT NOT NULL DEFAULT '{}',
  UNIQUE (user_id, kind, mission_key, period_key)
);
CREATE TABLE achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, unlocked_at INTEGER, claimed_at INTEGER, PRIMARY KEY (user_id, achievement_id)
);
CREATE TABLE user_titles (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_id, title_id));
CREATE TABLE codex (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, fish_id TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, best_weight REAL NOT NULL DEFAULT 0,
  first_at INTEGER NOT NULL, variants TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (user_id, fish_id)
);
CREATE TABLE market_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id INTEGER, item_id TEXT, qty INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL CHECK (price > 0), fee_pct REAL NOT NULL DEFAULT 5, status TEXT NOT NULL DEFAULT 'active', buyer_id TEXT,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, closed_at INTEGER, summary TEXT
);
CREATE INDEX idx_market_active ON market_listings(status, kind, price);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', data TEXT NOT NULL DEFAULT '{}', created_by TEXT, finalized INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  UNIQUE (key, start_at)
);
CREATE TABLE event_scores (event_id INTEGER NOT NULL, user_id TEXT NOT NULL, score REAL NOT NULL DEFAULT 0, joined INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (event_id, user_id));
CREATE TABLE boss_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, boss_id TEXT NOT NULL, location TEXT NOT NULL, hp INTEGER NOT NULL, max_hp INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', started_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, defeated_at INTEGER, last_hit_by TEXT,
  reward_mult REAL NOT NULL DEFAULT 1, event_id INTEGER, last_regen INTEGER
);
CREATE TABLE boss_contributions (boss_instance_id INTEGER NOT NULL, user_id TEXT NOT NULL, damage INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (boss_instance_id, user_id));
CREATE TABLE boss_party_members (boss_instance_id INTEGER NOT NULL, user_id TEXT NOT NULL, leader_id TEXT NOT NULL, PRIMARY KEY (boss_instance_id, user_id));
CREATE TABLE leaderboards (board TEXT NOT NULL, user_id TEXT NOT NULL, value REAL NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (board, user_id));
CREATE INDEX idx_lb ON leaderboards(board, value DESC);
CREATE TABLE cooldowns (user_id TEXT NOT NULL, key TEXT NOT NULL, until INTEGER NOT NULL, PRIMARY KEY (user_id, key));
CREATE TABLE buffs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, stat TEXT NOT NULL, value REAL NOT NULL, until INTEGER NOT NULL, PRIMARY KEY (user_id, stat));
`,
};
