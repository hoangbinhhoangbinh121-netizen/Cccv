'use strict';
/** Hạ tầng kiểm thử: DB tạm, đồng hồ giả, RNG có seed, trình chạy test đơn giản (không phụ thuộc thư viện ngoài). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ttf-test-'));
process.env.DB_PATH = path.join(TMP, 'data', 'test.sqlite');
process.env.BACKUP_DIR = path.join(TMP, 'backups');
process.env.DB_DRIVER = process.env.DB_DRIVER || 'auto';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.SKIP_ASSET_CHECK = '';
process.removeAllListeners('warning');

/* discord.js: dùng bản giả lập (tests/mocks) để kiểm tra giới hạn payload khi không có thư viện thật. TEST_STUB=0 để dùng thư viện thật. */
if (process.env.TEST_STUB !== '0') {
  const Module = require('module'); const stub = path.join(__dirname, 'mocks', 'node_modules', 'discord.js', 'index.js'); const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) { return request === 'discord.js' ? stub : orig.call(this, request, ...rest); };
}
const SRC = path.join(__dirname, '..', 'src');
const req = (p) => require(path.join(SRC, p));
const { Db, setDb } = req('database/connection');
const { migrate } = req('database/migrate');
const gameData = req('services/gameData');
const time = req('utils/time');
const rng = req('utils/rng');
const settings = req('database/repositories/settings');
const mg = req('systems/minigame');

let db = null; let T = Date.UTC(2026, 10, 22, 5, 0, 0); let seq = 0;
function fresh() {
  if (db) db.close(); const file = path.join(TMP, 'data', `t${++seq}.sqlite`); process.env.DB_PATH = file; req('config').dbPath = file;
  db = setDb(new Db(file).open()); migrate(db); gameData.load(); gameData.syncCatalogs(db); settings.clearCache();
  T = Date.UTC(2026, 10, 22, 5, 0, 0); time.setClock(() => T); rng.setRng(null); require(path.join(SRC, 'services/eventService')).invalidate(); return db;
}
const clock = { get: () => T, set: (v) => { T = v; }, adv: (ms) => { T += ms; return T; } };
const svc = (n) => req(`services/${n}`);
let uid = 0;
function player(name = `P${++uid}`, { level = 1, xu = 0 } = {}) {
  const id = String(1000 + uid++); svc('userService').register(id, name);
  if (level > 1) req('database/repositories/users').update(id, { level, exp: 0 });
  if (xu) req('database/repositories/wallet').apply(id, xu, 'test');
  return id;
}
/** Chơi trọn một mẻ câu; actions: 'perfect' | 'bad' | 'idle' | 'miss'. */
function cast(userId, mode = 'perfect', opts = {}) {
  const f = svc('fishingService'); let s = f.startCast(userId, opts);
  clock.set(Math.max(clock.get(), s.bite_at)); s = f.advance(s.id);
  if (mode === 'miss') { clock.set(s.deadline_at + 5000); return f.advance(s.id); }
  if (s.state !== 'bite') return s;
  s = f.hook(userId, s.id, s.nonce);
  let guard = 0;
  while (s.state === 'reeling' && guard++ < 60) {
    const m = mg.MOVES[s.data.mini.move];
    if (mode === 'idle') { clock.adv(mg.ROUND_MS + 2000); s = f.advance(s.id); continue; }
    const wrong = ['pull', 'hold', 'release'].find((a) => a !== m.correct);
    s = f.reel(userId, s.id, s.nonce, mode === 'bad' ? wrong : m.correct); clock.adv(500);
  }
  clock.adv(10000); return s;
}
const tests = []; let current = '';
const test = (name, fn) => tests.push({ group: current, name, fn });
const group = (name) => { current = name; };
const assert = require('assert');
async function run(filter) {
  const results = []; let pass = 0; let failN = 0;
  for (const t of tests) {
    if (filter && !`${t.group} ${t.name}`.toLowerCase().includes(filter.toLowerCase())) continue;
    const t0 = process.hrtime.bigint();
    try { fresh(); await t.fn(); pass++; results.push({ ...t, ok: true, ms: Number(process.hrtime.bigint() - t0) / 1e6 }); process.stdout.write('.'); }
    catch (e) { failN++; results.push({ ...t, ok: false, ms: Number(process.hrtime.bigint() - t0) / 1e6, err: e }); process.stdout.write('F'); }
  }
  process.stdout.write('\n'); return { results, pass, failN };
}
const throwsGame = (fn, re) => { try { fn(); } catch (e) { assert.ok(e.name === 'GameError', `Kỳ vọng GameError, nhận: ${e.stack}`); if (re) assert.match(e.message, re); return e; } assert.fail('Kỳ vọng ném GameError nhưng không có lỗi'); };
module.exports = { TMP, SRC, req, svc, fresh, clock, player, cast, test, group, run, assert, throwsGame, db: () => db, mg, rng, time, gameData, settings };
