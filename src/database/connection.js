'use strict';
/**
 * Lớp bọc SQLite dùng chung API cho cả `better-sqlite3` (mặc định) và `node:sqlite` (Node ≥ 22.5, tự dùng khi
 * không có better-sqlite3). Mọi thay đổi dữ liệu quan trọng phải đi qua db.tx() (BEGIN IMMEDIATE, lồng bằng SAVEPOINT).
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

function loadDriver(want) {
  // require() thành công chưa đủ: thiếu file nhị phân (.node) trên host/Node mới thì lỗi chỉ xuất hiện khi mở DB → thử mở DB tạm trước.
  const tryBetter = () => { const D = require('better-sqlite3'); new D(':memory:').close(); return { name: 'better-sqlite3', open: (f) => new D(f) }; };
  const tryNode = () => { const { DatabaseSync } = require('node:sqlite'); return { name: 'node-sqlite', open: (f) => new DatabaseSync(f) }; };
  if (want === 'better-sqlite3') return tryBetter();
  if (want === 'node-sqlite') return tryNode();
  try { return tryBetter(); } catch (e) { logger.warn('Không tải được better-sqlite3, dùng node:sqlite (cần Node ≥ 22.5).'); return tryNode(); }
}

const norm = (args) => args.map((a) => (a === undefined ? null : a === true ? 1 : a === false ? 0 : typeof a === 'bigint' ? Number(a) : a));

class Db {
  constructor(file = config.dbPath, driver = config.dbDriver) { this.file = file; this.driverName = driver; this.raw = null; this.stmts = new Map(); this.depth = 0; this.sp = 0; }
  open() {
    if (this.file !== ':memory:') fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.driver = loadDriver(this.driverName);
    this.raw = this.driver.open(this.file);
    this.raw.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.stmts.clear(); this.depth = 0;
    return this;
  }
  close() { if (this.raw) { this.stmts.clear(); try { this.raw.close(); } catch { /* đã đóng */ } this.raw = null; } }
  get isOpen() { return !!this.raw; }
  exec(sql) { this.raw.exec(sql); }
  stmt(sql) { let s = this.stmts.get(sql); if (!s) { s = this.raw.prepare(sql); this.stmts.set(sql, s); } return s; }
  run(sql, ...a) { const r = this.stmt(sql).run(...norm(a)); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; }
  get(sql, ...a) { return this.stmt(sql).get(...norm(a)); }
  all(sql, ...a) { return this.stmt(sql).all(...norm(a)); }
  value(sql, ...a) { const r = this.get(sql, ...a); return r ? Object.values(r)[0] : undefined; }
  /** Giao dịch đồng bộ. fn KHÔNG được async (cấm await trong giao dịch để không giữ khoá). */
  tx(fn) {
    if (this.depth > 0) {
      const name = `sp${++this.sp}`; this.raw.exec(`SAVEPOINT ${name}`); this.depth++;
      try { const r = fn(); if (r && typeof r.then === 'function') throw new Error('db.tx không hỗ trợ async'); this.raw.exec(`RELEASE ${name}`); return r; }
      catch (e) { this.raw.exec(`ROLLBACK TO ${name}; RELEASE ${name}`); throw e; } finally { this.depth--; }
    }
    this.raw.exec('BEGIN IMMEDIATE'); this.depth = 1;
    try { const r = fn(); if (r && typeof r.then === 'function') throw new Error('db.tx không hỗ trợ async'); this.raw.exec('COMMIT'); return r; }
    catch (e) { try { this.raw.exec('ROLLBACK'); } catch { /* đã rollback */ } throw e; } finally { this.depth = 0; }
  }
  /** Bản sao nhất quán (VACUUM INTO) – an toàn khi đang ghi. */
  snapshotTo(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); if (fs.existsSync(file)) fs.unlinkSync(file); this.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
  checkpoint() { try { this.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* bỏ qua */ } }
}

/** Singleton dùng cho toàn bot (tests có thể tạo Db riêng). */
const state = { db: null };
const getDb = () => { if (!state.db || !state.db.isOpen) throw new Error('Database chưa mở'); return state.db; };
const setDb = (db) => { state.db = db; return db; };
module.exports = { Db, getDb, setDb, state };
