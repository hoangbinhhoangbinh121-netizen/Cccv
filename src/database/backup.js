'use strict';
/**
 * Backup / Restore SQLite:
 *  - Sao lưu nhất quán bằng VACUUM INTO, nén gzip, ghi sha256 + metadata vào backups/index.json.
 *  - Tự động theo chu kỳ (đổi trực tiếp bằng /fishing-config), bỏ qua nếu dữ liệu không đổi.
 *  - Tự dọn bản cũ: giữ N bản gần nhất + 1 bản/ngày trong N ngày, giới hạn tổng dung lượng, bản ghim không bao giờ bị xoá.
 *  - Khôi phục an toàn: xác minh toàn vẹn → sao lưu "prerestore" → thay file → migrate → rollback nếu lỗi.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const config = require('../config');
const logger = require('../utils/logger');
const { stamp, now } = require('../utils/time');
const { Db, state } = require('./connection');
const { migrate, status: migStatus } = require('./migrate');
const settings = require('./repositories/settings');
const { withLock } = require('../utils/lock');

const KINDS = ['auto', 'manual', 'prerestore', 'premigrate', 'shutdown'];
const REQUIRED_TABLES = ['users', 'currencies', 'inventory', 'rod_instances', 'fish_instances', 'schema_migrations', 'transactions'];
const FILE_RE = /^fishing-(\d{8}-\d{6})-([a-z]+)\.sqlite\.gz$/;
const hooks = { beforeRestore: [], afterRestore: [], created: [] };
const runtime = { restoring: false, lastAutoChanges: null, timer: null, lastResult: null, lastError: null, nextAt: null };

const dir = () => { fs.mkdirSync(config.backupDir, { recursive: true }); return config.backupDir; };
const indexFile = () => path.join(dir(), 'index.json');
const readIndex = () => { try { return JSON.parse(fs.readFileSync(indexFile(), 'utf8')); } catch { return {}; } };
const writeIndex = (idx) => { const tmp = `${indexFile()}.tmp`; fs.writeFileSync(tmp, JSON.stringify(idx, null, 1)); fs.renameSync(tmp, indexFile()); };
const sha256File = async (f) => { const h = crypto.createHash('sha256'); await pipeline(fs.createReadStream(f), h); return h.digest('hex'); };
const tmpDir = () => { const d = path.join(dir(), '.tmp'); fs.mkdirSync(d, { recursive: true }); return d; };

function parseName(file) {
  const m = FILE_RE.exec(file); if (!m) return null;
  const s = m[1]; const ms = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15)) - config.tzOffsetHours * 3600000;
  return { kind: m[2], createdAt: ms };
}

/** Danh sách backup (mới → cũ), kết hợp thông tin thực tế trên đĩa và index.json. */
function list() {
  const idx = readIndex(); const out = [];
  for (const f of fs.readdirSync(dir())) {
    const p = parseName(f); if (!p) continue;
    const st = fs.statSync(path.join(dir(), f)); const meta = idx[f] || {};
    out.push({ file: f, kind: p.kind, createdAt: meta.createdAt || p.createdAt || st.mtimeMs, bytes: st.size, sha256: meta.sha256 || null, pinned: !!meta.pinned, note: meta.note || '', by: meta.by || null, users: meta.users ?? null, schema: meta.schema ?? null });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt || (a.file < b.file ? 1 : -1));
}
const totalBytes = (l = list()) => l.reduce((a, b) => a + b.bytes, 0);
const resolve = (name) => { const l = list(); if (!name || name === 'moi_nhat' || name === 'latest') return l[0] || null; return l.find((x) => x.file === name || x.file.startsWith(name)) || null; };

/** Tạo backup. kind: auto|manual|prerestore|premigrate|shutdown */
async function create({ kind = 'manual', note = '', by = null, db = state.db } = {}) {
  if (!KINDS.includes(kind)) throw new Error(`kind không hợp lệ: ${kind}`);
  return withLock('backup:create', async () => {
    if (!db || !db.isOpen) throw new Error('Database chưa mở');
    const t = now(); let file = `fishing-${stamp(t)}-${kind}.sqlite.gz`;
    for (let i = 1; fs.existsSync(path.join(dir(), file)); i++) file = `fishing-${stamp(t + i * 1000)}-${kind}.sqlite.gz`;
    const raw = path.join(tmpDir(), `snap-${crypto.randomBytes(4).toString('hex')}.sqlite`);
    const out = path.join(dir(), file); const part = `${out}.part`;
    try {
      db.snapshotTo(raw);
      const info = inspectFile(raw);
      await pipeline(fs.createReadStream(raw), zlib.createGzip({ level: 6 }), fs.createWriteStream(part));
      fs.renameSync(part, out);
      const sha = await sha256File(out); const bytes = fs.statSync(out).size;
      const idx = readIndex(); idx[file] = { kind, createdAt: t, sha256: sha, bytes, note, by, users: info.users, schema: info.schema, pinned: false }; writeIndex(idx);
      const res = { file, path: out, kind, bytes, sha256: sha, createdAt: t, users: info.users, schema: info.schema };
      try { db.run('INSERT INTO backup_log(file,kind,bytes,sha256,ok,note,created_at) VALUES(?,?,?,?,1,?,?)', file, kind, bytes, sha, note, t); } catch { /* bảng có thể chưa có */ }
      logger.info(`Backup ${kind}: ${file} (${(bytes / 1024).toFixed(1)} KB)`);
      hooks.created.forEach((h) => { try { h(res); } catch (e) { logger.warn('hook backup lỗi', e.message); } });
      return res;
    } finally { fs.rmSync(raw, { force: true }); fs.rmSync(`${raw}-wal`, { force: true }); fs.rmSync(`${raw}-shm`, { force: true }); fs.rmSync(part, { force: true }); }
  });
}

/** Mở file .sqlite (không gz) để đọc nhanh: toàn vẹn, bảng bắt buộc, phiên bản schema, số người chơi. */
function inspectFile(sqliteFile) {
  const d = new Db(sqliteFile, config.dbDriver).open();
  try {
    const ic = d.get('PRAGMA integrity_check'); const okIc = ic && Object.values(ic)[0] === 'ok';
    const tables = d.all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
    let schema = 0; try { schema = d.value('SELECT MAX(id) FROM schema_migrations') || 0; } catch { /* thiếu */ }
    let users = null; try { users = d.value('SELECT COUNT(*) FROM users'); } catch { /* thiếu */ }
    return { ok: okIc && !missing.length, integrity: okIc, missing, schema, users };
  } finally { d.close(); }
}

/** Giải nén (nếu gz) vào thư mục tạm → trả đường dẫn .sqlite. */
async function materialize(src) {
  const out = path.join(tmpDir(), `cand-${crypto.randomBytes(4).toString('hex')}.sqlite`);
  const fd = fs.openSync(src, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
  if (head[0] === 0x1f && head[1] === 0x8b) await pipeline(fs.createReadStream(src), zlib.createGunzip(), fs.createWriteStream(out));
  else if (head.toString('latin1', 0, 15) === 'SQLite format 3') await fsp.copyFile(src, out);
  else throw new Error('Tệp không phải backup hợp lệ (không phải .sqlite hoặc .gz)');
  return out;
}

/** Xác minh một backup (theo tên hoặc đường dẫn). Không thay đổi dữ liệu thật. */
async function verify(nameOrPath) {
  const entry = fs.existsSync(nameOrPath) ? { file: path.basename(nameOrPath), full: nameOrPath, sha256: null } : (() => { const e = resolve(nameOrPath); return e ? { ...e, full: path.join(dir(), e.file) } : null; })();
  if (!entry) return { ok: false, reasons: ['Không tìm thấy backup'] };
  const reasons = []; let cand;
  try {
    if (entry.sha256) { const sha = await sha256File(entry.full); if (sha !== entry.sha256) reasons.push('Checksum SHA-256 không khớp (tệp đã bị sửa/hỏng)'); }
    cand = await materialize(entry.full);
    const info = inspectFile(cand);
    if (!info.integrity) reasons.push('PRAGMA integrity_check thất bại');
    if (info.missing.length) reasons.push(`Thiếu bảng: ${info.missing.join(', ')}`);
    const latest = migStatus(state.db && state.db.isOpen ? state.db : new Db(':memory:', config.dbDriver).open()).latest;
    if (info.schema > latest) reasons.push(`Schema ${info.schema} mới hơn bot (${latest})`);
    return { ok: reasons.length === 0, reasons, info, file: entry.file, candidate: cand, entry };
  } catch (e) { if (cand) fs.rmSync(cand, { force: true }); return { ok: false, reasons: [...reasons, e.message], file: entry.file }; }
}

/* ------------------------------------------------------------------ DỌN DẸP */
/** Hàm thuần: nhận danh sách + chính sách → trả về danh sách file cần xoá (dễ kiểm thử). */
function planPrune(files, policy, tNow = now()) {
  const p = { keepAuto: 48, keepManual: 15, maxAgeDays: 7, maxTotalMb: 500, keepSafety: 5, ...policy };
  const del = new Map(); const mark = (f, why) => { if (!f.pinned && !del.has(f.file)) del.set(f.file, why); };
  const sorted = [...files].sort((a, b) => b.createdAt - a.createdAt);
  const newest = sorted[0]?.file;
  const dayOf = (ms) => new Date(ms + config.tzOffsetHours * 3600000).toISOString().slice(0, 10);
  const rolling = sorted.filter((f) => f.kind === 'auto' || f.kind === 'shutdown');
  const dayKept = new Set();
  rolling.forEach((f, i) => {
    if (i < p.keepAuto) return;
    const age = (tNow - f.createdAt) / 86400000; const d = dayOf(f.createdAt);
    if (age <= p.maxAgeDays && !dayKept.has(d)) { dayKept.add(d); return; }
    mark(f, age > p.maxAgeDays ? `quá ${p.maxAgeDays} ngày` : 'vượt số lượng (đã có bản trong ngày)');
  });
  sorted.filter((f) => f.kind === 'manual').forEach((f, i) => { if (i >= p.keepManual) mark(f, `vượt ${p.keepManual} bản thủ công`); });
  sorted.filter((f) => f.kind === 'prerestore' || f.kind === 'premigrate').forEach((f, i) => { if (i >= p.keepSafety || (i >= 2 && (tNow - f.createdAt) / 86400000 > 30)) mark(f, 'bản an toàn cũ'); });
  // giới hạn dung lượng
  const cap = p.maxTotalMb * 1048576;
  let total = sorted.reduce((a, f) => a + (del.has(f.file) ? 0 : f.bytes), 0);
  const order = [...sorted].reverse().filter((f) => !del.has(f.file) && !f.pinned && f.file !== newest);
  const rank = (f) => (f.kind === 'auto' || f.kind === 'shutdown' ? 0 : f.kind === 'prerestore' || f.kind === 'premigrate' ? 1 : 2);
  for (const r of [0, 1, 2]) {
    for (const f of order.filter((x) => rank(x) === r)) {
      if (total <= cap) break;
      if (r === 2 && sorted.filter((x) => x.kind === 'manual' && !del.has(x.file)).length <= 2) break;
      del.set(f.file, 'vượt giới hạn dung lượng'); total -= f.bytes;
    }
  }
  return [...del].map(([file, reason]) => ({ file, reason, bytes: files.find((f) => f.file === file).bytes }));
}
function policyFromSettings() {
  return { keepAuto: settings.get('backup_keep_auto'), keepManual: settings.get('backup_keep_manual'), maxAgeDays: settings.get('backup_max_age_days'), maxTotalMb: settings.get('backup_max_total_mb') };
}
function prune({ dryRun = false, policy } = {}) {
  const files = list(); const plan = planPrune(files, policy || policyFromSettings());
  if (!dryRun) { const idx = readIndex(); for (const d of plan) { fs.rmSync(path.join(dir(), d.file), { force: true }); delete idx[d.file]; } writeIndex(idx); if (plan.length) logger.info(`Đã dọn ${plan.length} backup cũ (${plan.reduce((a, b) => a + b.bytes, 0)} bytes)`); }
  return { deleted: plan, kept: files.length - plan.length, freed: plan.reduce((a, b) => a + b.bytes, 0) };
}
function remove(name) { const e = resolve(name); if (!e) throw new Error('Không tìm thấy backup'); if (e.pinned) throw new Error('Backup đang được ghim – hãy bỏ ghim trước'); fs.rmSync(path.join(dir(), e.file), { force: true }); const idx = readIndex(); delete idx[e.file]; writeIndex(idx); return e; }
function pin(name, v = true) { const e = resolve(name); if (!e) throw new Error('Không tìm thấy backup'); const idx = readIndex(); idx[e.file] = { ...(idx[e.file] || { kind: e.kind, createdAt: e.createdAt, bytes: e.bytes }), pinned: v }; writeIndex(idx); return e; }

/* ------------------------------------------------------------------ KHÔI PHỤC */
/** Khôi phục DB đang chạy từ backup (tên trong thư mục backups, hoặc đường dẫn tệp tải lên). Trả về báo cáo. */
async function restore(src, { by = null, db = state.db } = {}) {
  if (runtime.restoring) throw new Error('Đang có một tiến trình khôi phục khác');
  runtime.restoring = true;
  let cand = null; let safety = null; let closed = false; let touched = false;
  try {
    const v = await verify(src);
    if (!v.ok) throw new Error(`Backup không hợp lệ: ${v.reasons.join('; ')}`);
    cand = v.candidate;
    for (const h of hooks.beforeRestore) await h();
    safety = await create({ kind: 'prerestore', note: `trước khi khôi phục ${v.file}`, by, db });
    const before = { users: db.value('SELECT COUNT(*) FROM users') };
    db.checkpoint(); db.close(); closed = true; touched = true;
    const target = db.file;
    for (const ext of ['-wal', '-shm']) fs.rmSync(target + ext, { force: true });
    const staging = `${target}.restoring`;
    await fsp.copyFile(cand, staging); fs.renameSync(staging, target);
    db.open(); closed = false;
    const mig = migrate(db);
    const chk = db.get('PRAGMA integrity_check');
    if (Object.values(chk)[0] !== 'ok') throw new Error('integrity_check sau khôi phục thất bại');
    settings.clearCache();
    for (const h of hooks.afterRestore) await h();
    const after = { users: db.value('SELECT COUNT(*) FROM users') };
    logger.warn(`ĐÃ KHÔI PHỤC từ ${v.file} bởi ${by}`);
    return { ok: true, from: v.file, safety: safety.file, before, after, migrated: mig.applied };
  } catch (e) {
    logger.error('Khôi phục thất bại:', e.message);
    if (safety && touched) {
      try { // rollback về bản trước khi khôi phục
        db.close(); const back = await materialize(safety.path); for (const ext of ['-wal', '-shm']) fs.rmSync(db.file + ext, { force: true }); fs.copyFileSync(back, db.file); fs.rmSync(back, { force: true }); db.open(); migrate(db); settings.clearCache();
        for (const h of hooks.afterRestore) await h();
        e.message += ' (đã tự động hoàn tác về dữ liệu trước đó)';
      } catch (e2) { e.message += ` | HOÀN TÁC LỖI: ${e2.message} – dùng bản ${safety.file}`; }
    }
    throw e;
  } finally { if (cand) fs.rmSync(cand, { force: true }); runtime.restoring = false; }
}

/* ------------------------------------------------------------------ TỰ ĐỘNG */
async function autoTick(db = state.db) {
  if (!settings.get('backup_auto_enabled') || runtime.restoring || !db || !db.isOpen) return null;
  const changes = db.value('SELECT total_changes()');
  if (runtime.lastAutoChanges !== null && changes === runtime.lastAutoChanges) { logger.debug('Backup tự động: không có thay đổi, bỏ qua'); return null; }
  try {
    const r = await create({ kind: 'auto', note: 'tự động', db }); runtime.lastAutoChanges = db.value('SELECT total_changes()'); runtime.lastResult = r; runtime.lastError = null;
    const p = prune(); r.pruned = p.deleted.length; return r;
  } catch (e) { runtime.lastError = e.message; logger.error('Backup tự động lỗi:', e.message); return null; }
}
function startAuto() {
  stopAuto();
  const loop = () => {
    const ms = Math.max(1, settings.get('backup_interval_min')) * 60000; runtime.nextAt = now() + ms;
    runtime.timer = setTimeout(async () => { await autoTick(); loop(); }, ms); runtime.timer.unref?.();
  };
  const l = list(); const lastAt = l[0]?.createdAt || 0; const interval = Math.max(1, settings.get('backup_interval_min')) * 60000;
  if (now() - lastAt > interval) { const t = setTimeout(() => autoTick(), 20000); t.unref?.(); }
  loop();
}
const stopAuto = () => { if (runtime.timer) clearTimeout(runtime.timer); runtime.timer = null; };
const onCreated = (fn) => hooks.created.push(fn);
const onBeforeRestore = (fn) => hooks.beforeRestore.push(fn);
const onAfterRestore = (fn) => hooks.afterRestore.push(fn);
const info = () => ({ restoring: runtime.restoring, nextAt: runtime.nextAt, lastResult: runtime.lastResult, lastError: runtime.lastError, enabled: !!settings.get('backup_auto_enabled'), intervalMin: settings.get('backup_interval_min'), count: list().length, bytes: totalBytes() });
module.exports = { create, list, resolve, verify, restore, prune, planPrune, remove, pin, startAuto, stopAuto, autoTick, onCreated, onBeforeRestore, onAfterRestore, info, inspectFile, materialize, runtime, totalBytes, parseName };
