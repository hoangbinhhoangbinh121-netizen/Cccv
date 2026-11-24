'use strict';
const H = require('./helpers'); const { test, group, assert, svc, req, clock, player } = H;
const X = require('./fake');
const R = (p) => req(`database/repositories/${p}`);
const router = req('interactions/router'); const logger = req('utils/logger'); const config = req('config');
const { loadCommands } = req('commands'); const fishingUI = req('ui/fishingUI'); const mg = H.mg;

const commands = () => { const m = loadCommands(); router.setCommands(m); return m; };
const give = (id, items) => svc('inventoryService').grant(id, items, { force: true });
let errors = [];
const origErr = logger.error; logger.error = (...a) => { errors.push(a.join(' ')); };
const rl = req('utils/ratelimit');
const run = async (i) => { rl.reset(); await router.handle(i); X.check(i, i.commandName || i.customId); return i; };
const textOf = (p) => JSON.stringify((p?.embeds || []).map((e) => e.toJSON()));

/** Người chơi "đầy đủ": cấp cao, nhiều đồ, cần, thú, cá, chợ, boss, sự kiện – để quét mọi màn hình. */
function richWorld() {
  const id = player('Rich', { level: 70, xu: 50000000 }); const D = H.gameData.D;
  give(id, Object.fromEntries([...D.itemList, ...D.baitList].map((d) => [d.id, 12]))); for (const l of D.locList) R('users').unlockLocation(id, l.id);
  for (const r of D.rodList.slice(0, 8)) svc('rodService').grantRod(id, r.id);
  for (const f of D.fishList.slice(0, 30)) svc('adminService').giveFish('a', id, f.id, 3);
  svc('petService').hatch(id, 'trung_thu_thuong'); svc('petService').hatch(id, 'trung_thu_quy');
  const other = player('Seller', { level: 10 }); const fid = svc('adminService').giveFish('a', other, D.fishList[3].id, 2); svc('marketService').listItem(other, { kind: 'fish', refId: fid, price: 900 });
  give(other, { vay_ca: 5 }); svc('marketService').listItem(other, { kind: 'item', itemId: 'vay_ca', qty: 3, price: 100 }); svc('marketService').listItem(id, { kind: 'item', itemId: 'phoi_dong', qty: 2, price: 100 });
  svc('bossService').spawn(D.bossList[0].id); svc('eventService').startEvent(svc('eventService').createFromTemplate(D.events.templates[0].key));
  svc('progressService').track(id, 'catch', { count: 30 }); return { id, other };
}

group('Lệnh Discord');
test('toàn bộ lệnh hợp lệ theo giới hạn Discord & đủ lệnh theo đặc tả', () => {
  const m = commands(); const need = 'cauca khuvuc codex thongtin daily nhiemvu thanh_tuu bangxephang cancau nangcap cuonghoa khamda thuctinh chetao kho khoca ban_ca sudung cuahang muamoi thitruong giaodich thucung boss toidau fishing-admin fishing-event fishing-config fishing-backup fishing-restore backupdb restore_db'.split(' ');
  for (const n of need) assert.ok(m.has(n), `thiếu lệnh /${n}`); assert.ok(m.size <= 100);
  for (const c of m.values()) { const j = c.data.toJSON(); assert.ok(j.description && j.description.length <= 100, j.name); assert.ok(JSON.stringify(j).length < 6000, `${j.name} quá dài`); }
});
test('lệnh quản trị bị ẩn với người thường (default_member_permissions)', () => { const m = commands(); for (const n of ['fishing-admin', 'fishing-event', 'fishing-config', 'fishing-backup', 'fishing-restore', 'backupdb', 'restore_db']) assert.equal(m.get(n).data.toJSON().default_member_permissions, '8', n); });
test('mọi lệnh mở được màn hình hợp lệ (người mới & người đầy đủ)', async () => {
  commands(); errors = []; const { id } = richWorld(); const fresh = player('Newbie');
  for (const who of [fresh, id]) for (const [n, c] of loadCommands()) {
    if (['fishing-admin', 'fishing-event', 'fishing-config', 'fishing-backup', 'fishing-restore', 'backupdb', 'restore_db', 'cauca', 'toidau', 'giaodich', 'sudung', 'muamoi'].includes(n)) continue;
    const i = await run(X.slash(who, n, n === 'bangxephang' ? { bang: 'level' } : {})); assert.ok(X.last(i), `/${n} không phản hồi`);
  }
  assert.deepEqual(errors, []);
});
test('autocomplete trả về danh sách hợp lệ (≤25) và không lỗi', async () => {
  commands(); const { id } = richWorld();
  for (const [n, f] of [['cauca', 'khuvuc'], ['cauca', 'moi'], ['sudung', 'vatpham']]) { const i = X.auto(id, n, f, 'r'); await router.handle(i); const r = i.log.find((x) => x.kind === 'respond'); assert.ok(r && r.c.length <= 25, n); for (const c of r.c) assert.ok(c.name.length <= 100 && String(c.value).length <= 100); }
});

group('Phiên câu cá qua giao diện');
test('chu trình đầy đủ: thả câu → cá cắn → giật → kéo đúng nhịp → thành công → câu tiếp', async () => {
  commands(); errors = []; const id = player('Fisher'); const i0 = await run(X.slash(id, 'cauca')); const p0 = X.last(i0).p; assert.match(textOf(p0), /chờ cá cắn/); let s = R('sessions').active(id); assert.equal(s.state, 'waiting');
  assert.ok(X.comps(p0).some((c) => /cancel$/.test(c.custom_id || '')));
  clock.set(s.bite_at); s = svc('fishingService').advance(s.id); assert.equal(s.state, 'bite'); fishingUI.render(s);
  let i = await run(X.click(id, `fs|${s.id}|${s.nonce}|hook`)); assert.match(textOf(X.last(i).p), /đang/); let guard = 0;
  while (guard++ < 40) { s = R('sessions').get(s.id); if (s.state !== 'reeling') break; const act = mg.MOVES[s.data.mini.move].correct; i = await run(X.click(id, `fs|${s.id}|${s.nonce}|${act}`)); clock.adv(400); }
  s = R('sessions').get(s.id); assert.equal(s.state, 'success'); const p = X.last(i).p; assert.match(textOf(p), /Câu thành công/); assert.ok(p.files.length >= 1);
  const again = X.comps(p).find((c) => /\|again$/.test(c.custom_id)); assert.ok(again); clock.adv(10000); i = await run(X.click(id, again.custom_id)); assert.equal(R('sessions').active(id).state, 'waiting'); assert.deepEqual(errors, []);
});
test('nút của người khác / nonce cũ / phiên hết hiệu lực đều bị từ chối an toàn', async () => {
  commands(); const a = player('A'); const b = player('B'); await run(X.slash(a, 'cauca')); let s = R('sessions').active(a); clock.set(s.bite_at); s = svc('fishingService').advance(s.id);
  let i = await run(X.click(b, `fs|${s.id}|${s.nonce}|hook`)); assert.match(textOf(X.last(i).p), /không phải phiên/);
  i = await run(X.click(a, `fs|${s.id}|saisai|hook`)); assert.match(textOf(X.last(i).p), /hiệu lực/); i = await run(X.click(b, `v|${a}|profile|show`)); assert.match(textOf(X.last(i).p), /thuộc về người khác/);
});
test('không mở được hai phiên; giao diện báo rõ', async () => { commands(); const id = player(); await run(X.slash(id, 'cauca')); const i = await run(X.slash(id, 'cauca')); assert.match(textOf(X.last(i).p), /phiên câu chưa kết thúc/); });
test('bộ hẹn giờ làm mới: cá cắn câu & hết hạn tự cập nhật tin nhắn', async () => {
  commands(); const id = player(); const i = await run(X.slash(id, 'cauca')); const s = R('sessions').active(id); clock.set(s.bite_at + 100); await fishingUI.tick(s.id);
  const e = i.log.filter((x) => x.kind === 'edit'); assert.ok(e.length >= 1, 'chưa cập nhật'); assert.match(textOf(e.pop().p), /CÁ CẮN CÂU/); fishingUI.clearAll();
});
test('đánh boss qua giao diện: tấn công → 5 lượt → kết quả có nút đánh tiếp', async () => {
  commands(); errors = []; const { id } = richWorld(); const b = svc('bossService').activeList()[0]; let i = await run(X.slash(id, 'toidau', { boss: b.id })); let s = R('sessions').active(id); assert.equal(s.kind, 'boss'); assert.match(textOf(X.last(i).p), /HP/);
  let g = 0; while (g++ < 20) { s = R('sessions').get(s.id); if (s.state !== 'reeling') break; i = await run(X.click(id, `fs|${s.id}|${s.nonce}|${mg.MOVES[s.data.mini.move].correct}`)); clock.adv(300); }
  assert.notEqual(R('sessions').get(s.id).state, 'reeling'); assert.ok(X.comps(X.last(i).p).some((c) => /boss/.test(c.custom_id))); assert.deepEqual(errors, []); fishingUI.clearAll();
});

group('Quét toàn bộ giao diện (crawler)');
test('bấm mọi nút/menu/biểu mẫu tới độ sâu 6: không lỗi hệ thống, mọi payload hợp lệ', async () => {
  commands(); errors = []; const { id } = richWorld(); const fill = { qty: '1', price: '777', name: 'Bé Bự', q: 'ro', code: 'x' };
  const queue = []; const seen = new Set(); let clicks = 0; const bad = []; const errMsgs = {}; let okN = 0; const stat = (i) => { const p = X.last(i)?.p; const t = textOf(p); const m = t.match(/Không thực hiện được","description":"([^"]{0,90})/); if (m) errMsgs[m[1]] = (errMsgs[m[1]] || 0) + 1; else if (p?.content && /^(✅|🔨|⬆️|💰|🛒|🔧|🎁|🏆|🐾|💎|🧭|🔓|♻️|📅|🥚|🍖|✨|🎨|🏪|↩️|📦|🧪|🔒|😀|🌟|🗑️)/.test(p.content)) okN++; };
  const startCmds = ['thongtin', 'nhiemvu', 'thanh_tuu', 'bangxephang', 'cancau', 'nangcap', 'cuonghoa', 'khamda', 'thuctinh', 'chetao', 'kho', 'khoca', 'ban_ca', 'cuahang', 'thitruong', 'thucung', 'boss', 'khuvuc', 'codex', 'sukien', 'huongdan'];
  for (const n of startCmds) { const i = await run(X.slash(id, n)); const p = X.last(i).p; if (p) queue.push({ p, d: 0 }); }
  const handleResult = async (i, d) => {
    X.check(i, i.customId); stat(i); const m = i.log.find((x) => x.kind === 'modal');
    if (m) { const mj = m.m.toJSON(); const f = {}; for (const row of mj.rows) for (const c of (row.toJSON ? row.toJSON() : row).components) { const cc = c.toJSON ? c.toJSON() : c; f[cc.custom_id] = fill[cc.custom_id] ?? '1'; } const si = X.submit(id, mj.custom_id, f); rl.reset(); await router.handle(si); X.check(si, 'modal ' + mj.custom_id); const p = X.last(si)?.p; if (p && d < 6) queue.push({ p, d: d + 1 }); return; }
    const p = X.last(i)?.p; if (p && d < 6) queue.push({ p, d: d + 1 });
  };
  while (queue.length && clicks < 2600) {
    const { p, d } = queue.shift(); for (const c of X.comps(p)) {
      if (c.disabled || c.style === 5) continue; const targets = c.type === 3 ? [...new Set([c.options[0], c.options[c.options.length - 1]].map((o) => o.value))].map((v) => ({ key: `${c.custom_id}#${v}`, make: () => X.pick(id, c.custom_id, [v]) })) : [{ key: c.custom_id, make: () => X.click(id, c.custom_id) }];
      for (const t of targets) { if (seen.has(t.key)) continue; seen.add(t.key); if (/^fs\||\|boss\|?/.test(t.key) && /\|(cancel)$/.test(t.key)) continue; clicks++; const i = t.make(); try { rl.reset(); await router.handle(i); await handleResult(i, d); } catch (e) { bad.push(`${t.key}: ${e.message}`); } }
    }
  }
  console.log(`\n   crawler: ${clicks} thao tác, ${seen.size} điểm chạm, ${okN} hành động thành công`); if (process.env.CRAWL_DEBUG) console.log(errMsgs); assert.deepEqual(bad.slice(0, 5), []); assert.deepEqual(errors.slice(0, 5), []); assert.ok(clicks > 150, `chỉ quét ${clicks}`);
});

group('Sao lưu & khôi phục trên Discord');
const admin = (id) => ({ admin: true });
test('/backupdb tạo bản sao lưu, có kiểm tra checksum & dọn dẹp; người thường bị chặn', async () => {
  commands(); const a = player('Adm', { xu: 1000 }); const u = player('Usr');
  let i = await run(X.slash(u, 'backupdb', {}, {})); assert.match(textOf(X.last(i).p), /quản trị viên/);
  i = await run(X.slash(a, 'backupdb', { ghichu: 'thử nghiệm', taive: true }, admin())); const e = i.log.find((x) => x.kind === 'edit').p; assert.match(textOf(e), /Đã sao lưu/); assert.equal(e.files.length, 1); assert.equal(req('database/backup').list().length, 1);
});
test('/fishing-backup: danh sách, kiểm tra, ghim, xoá, dọn dẹp, trạng thái', async () => {
  commands(); const a = player('Adm'); await run(X.slash(a, 'backupdb', {}, admin())); const bk = req('database/backup'); const f = bk.list()[0].file;
  let i = await run(X.slash(a, 'fishing-backup', { __sub: 'danh-sach' }, admin())); assert.match(textOf(X.last(i).p), /Sao lưu cơ sở dữ liệu/);
  i = await run(X.pick(a, `v|${a}|adminbk|sel|0`, [f], admin())); assert.match(textOf(X.last(i).p), /SHA-256/);
  i = await run(X.click(a, `v|${a}|adminbk|verify|0|${f}`, admin())); assert.match(JSON.stringify(i.log.find((x) => x.kind === 'edit').p.content), /Hợp lệ/);
  await run(X.click(a, `v|${a}|adminbk|pin|0|${f}`, admin())); assert.ok(bk.list()[0].pinned); i = await run(X.click(a, `v|${a}|adminbk|del|0|${f}`, admin())); assert.match(textOf(X.last(i).p), /Xác nhận/);
  i = await run(X.slash(a, 'fishing-backup', { __sub: 'trang-thai' }, admin())); assert.match(textOf(X.last(i).p), /Backup tự động/); i = await run(X.slash(a, 'fishing-backup', { __sub: 'don-dep', xemtruoc: true }, admin())); assert.match(String(X.last(i).p.content), /Sẽ xoá/);
});
test('/restore_db: chỉ chủ bot; xác nhận bằng mã; sai mã không đổi gì; đúng mã khôi phục & tự tạo bản an toàn', async () => {
  commands(); const owner = player('Owner', { xu: 1000 }); const mod = player('Mod'); config.ownerIds.push(owner); const bal = () => svc('economyService').balance(owner); const bk = req('database/backup');
  await run(X.slash(owner, 'backupdb', {}, admin())); const before = bal(); svc('economyService').credit(owner, 5000, 'test'); assert.equal(bal(), before + 5000);
  let i = await run(X.slash(mod, 'restore_db', {}, admin())); assert.match(textOf(X.last(i).p), /chủ bot/);
  i = await run(X.slash(owner, 'restore_db', {}, admin())); const p = X.last(i).p; assert.match(textOf(p), /Khôi phục cơ sở dữ liệu/); assert.match(textOf(p), /hợp lệ/); const go = X.comps(p).find((c) => /\|go\|/.test(c.custom_id)); assert.ok(go && !go.disabled);
  i = await run(X.click(owner, go.custom_id, admin())); const m = i.log.find((x) => x.kind === 'modal'); assert.ok(m); const mj = m.m.toJSON();
  i = await run(X.submit(owner, mj.custom_id, { code: 'sai' }, admin())); assert.match(textOf(X.last(i).p), /Mã xác nhận sai/); assert.equal(bal(), before + 5000);
  i = await run(X.submit(owner, mj.custom_id, { code: 'khoi phuc' }, admin())); assert.match(textOf(i.log.find((x) => x.kind === 'edit').p), /Khôi phục thành công/); assert.equal(bal(), before);
  assert.ok(bk.list().some((b) => b.kind === 'prerestore'), 'phải có bản an toàn trước khôi phục'); assert.equal(req('services/context').restoring, false); config.ownerIds.length = 0;
});
test('/restore_db: tệp hỏng/không hợp lệ bị từ chối, DB không đổi', async () => {
  commands(); const owner = player('Owner', { xu: 777 }); config.ownerIds.push(owner); const bk = req('database/backup'); const cfg = req('config'); const fs = require('fs'); const path = require('path');
  fs.mkdirSync(cfg.backupDir, { recursive: true }); fs.writeFileSync(path.join(cfg.backupDir, 'fishing-20261122-010101-manual.sqlite.gz'), 'khong phai gzip');
  const i = await run(X.slash(owner, 'restore_db', { ten: 'fishing-20261122-010101-manual.sqlite.gz' }, admin())); const go = X.comps(X.last(i).p).find((c) => /\|go\|/.test(c.custom_id)); assert.ok(!go || go.disabled, 'không được cho phép khôi phục tệp hỏng');
  assert.equal(svc('economyService').balance(owner), 1277); config.ownerIds.length = 0; assert.ok(bk);
});
test('khi đang khôi phục, người chơi nhận thông báo bảo trì thay vì lỗi', async () => { commands(); const id = player(); req('services/context').restoring = true; const i = await run(X.slash(id, 'thongtin')); req('services/context').restoring = false; assert.match(textOf(X.last(i).p), /khôi phục dữ liệu/); });

group('Quản trị trên Discord');
test('/fishing-admin: give-xu, give-item, set-level, ban/unban, stats, integrity-check, user-info, audit-log', async () => {
  commands(); const a = player('Adm'); const u = player('Usr'); const tgt = { id: u, username: 'usr', toString: () => `<@${u}>` };
  for (const [sub, o, re] of [['give-xu', { soxu: 500 }, /số dư mới/], ['give-item', { vatpham: 'vay_ca', soluong: 3 }, /Đã tặng/], ['set-level', { cap: 9 }, /cấp 9/], ['ban', { lydo: 'test' }, /Đã khoá/], ['unban', {}, /Đã mở khoá/], ['user-info', {}, /Cấp 9/], ['stats', {}, /Thống kê/], ['integrity-check', {}, /toàn vẹn/], ['audit-log', {}, /Nhật ký/], ['transactions', {}, /Giao dịch/], ['unstick', {}, /hồi chiêu/], ['maintenance', { bat: false }, /tắt bảo trì/], ['reload-data', {}, /nạp lại/]]) {
    const i = await run(X.slash(a, 'fishing-admin', { __sub: sub, nguoi: tgt, ...o }, admin())); assert.match(JSON.stringify(X.last(i).p), re, sub + ' → ' + JSON.stringify(X.last(i).p).slice(0, 300));
  }
  assert.equal(R('users').get(u).level, 9); const bad = await run(X.slash(u, 'fishing-admin', { __sub: 'stats' }, {})); assert.match(textOf(X.last(bad).p), /quản trị viên/);
});
test('/fishing-event & /fishing-config & weather & boss-spawn', async () => {
  commands(); const a = player('Adm'); const D = H.gameData.D; const A = (n, o) => run(X.slash(a, n, o, admin()));
  let i = await A('fishing-event', { __sub: 'tao', mau: D.events.templates[0].key, phut: 30 }); assert.match(String(X.last(i).p.content), /Đã tạo/); i = await A('fishing-event', { __sub: 'danh-sach' }); assert.match(textOf(X.last(i).p), /Sự kiện/);
  const evId = R('events').list(['active'])[0].id; i = await A('fishing-event', { __sub: 'xem', id: evId }); assert.ok(X.last(i).p); i = await A('fishing-event', { __sub: 'ket-thuc', id: evId }); assert.match(String(X.last(i).p.content), /kết thúc/);
  i = await A('fishing-config', { __sub: 'xem' }); assert.match(textOf(X.last(i).p), /Cấu hình/); i = await A('fishing-config', { __sub: 'dat', khoa: 'market_fee_pct', giatri: 8 }); assert.equal(H.settings.get('market_fee_pct'), 8);
  i = await A('fishing-config', { __sub: 'dat', khoa: 'khong_co', giatri: 1 }); assert.match(textOf(X.last(i).p), /Không thực hiện/); i = await A('fishing-config', { __sub: 'dat', khoa: 'backup_interval_min', giatri: 30 }); assert.equal(H.settings.get('backup_interval_min'), 30);
  i = await A('fishing-admin', { __sub: 'weather-set', khuvuc: 'ao_lang', thoitiet: 'bao', phut: 10 }); assert.match(String(X.last(i).p.content), /thời tiết/); i = await A('fishing-admin', { __sub: 'boss-spawn', boss: D.bossList[1].id }); assert.match(String(X.last(i).p.content), /triệu hồi/);
});

group('Đồng thời & tải');
test('50 người cùng bấm mua một tin đăng: đúng một người mua được, tiền & hàng nhất quán', async () => {
  commands(); const seller = player('S', { level: 10 }); const fid = svc('adminService').giveFish('a', seller, H.gameData.D.fishList[5].id, 2); const l = svc('marketService').listItem(seller, { kind: 'fish', refId: fid, price: 1000 });
  const buyers = Array.from({ length: 50 }, (_, k) => player(`B${k}`, { xu: 1000 })); const tot0 = H.db().value('SELECT SUM(balance) FROM currencies');
  const outs = await Promise.all(buyers.map(async (b) => { const i = X.click(b, `v|${b}|market|buyyes|browse|all|moi|0|${l.id}`); rl.reset(); await router.handle(i); return /Mua thành công/.test(JSON.stringify(X.last(i).p)); }));
  assert.equal(outs.filter(Boolean).length, 1); const owner = R('fish').owned(buyers.find((_, k) => outs[k]), fid); assert.ok(owner); assert.equal(H.db().value("SELECT COUNT(*) FROM fish_instances WHERE id=?", fid), 1);
  const fee = tot0 - H.db().value('SELECT SUM(balance) FROM currencies'); assert.ok(fee > 0 && fee <= 100, `phí ${fee}`); assert.ok(svc('adminService').integrityCheck().ok);
});
test('một người spam 30 lần nút Giật cần/Kéo cùng lúc: không lỗi, không cộng thưởng hai lần', async () => {
  commands(); errors = []; const id = player('Spam'); await run(X.slash(id, 'cauca')); let s = R('sessions').active(id); clock.set(s.bite_at); s = svc('fishingService').advance(s.id);
  await Promise.all(Array.from({ length: 30 }, async () => { const i = X.click(id, `fs|${s.id}|${s.nonce}|hook`); rl.reset(); await router.handle(i); }));
  assert.equal(R('sessions').get(s.id).state, 'reeling'); assert.deepEqual(errors, []); assert.equal(H.db().value("SELECT COUNT(*) FROM fishing_sessions WHERE user_id=?", id), 1);
});
test('chịu tải: 300 người chơi × 5 mẻ câu đồng thời, nhanh & dữ liệu toàn vẹn', async () => {
  commands(); errors = []; const ps = Array.from({ length: 300 }, (_, k) => player(`L${k}`)); const t0 = Date.now(); let ok = 0;
  await Promise.all(ps.map(async (id) => { for (let k = 0; k < 5; k++) { rl.reset(); const s = H.cast(id, 'perfect'); if (s.state === 'success') ok++; H.clock.adv(5000); } }));
  const ms = Date.now() - t0; console.log(`\n   tải: ${ps.length * 5} mẻ câu trong ${ms} ms (${(ps.length * 5 / (ms / 1000)).toFixed(0)} mẻ/giây), thành công ${ok}`);
  assert.ok(ok > 1000); assert.ok(ms < 20000, `quá chậm: ${ms}ms`); const ic = svc('adminService').integrityCheck(); assert.ok(ic.ok, JSON.stringify(ic.issues)); assert.equal(H.db().value('SELECT SUM(total_catch) FROM user_stats'), ok);
});
test('nút bán/khoá nhanh sau khi câu được cá hoạt động và chống bán hai lần', async () => {
  commands(); const id = player('Q'); const s = H.cast(id, 'perfect'); assert.equal(s.state, 'success'); const fid = s.result.fishInstanceId;
  let i = await run(X.click(id, `fa|${id}|lock|${fid}`)); assert.match(String(X.last(i).p.content), /khoá/); assert.equal(R('fish').owned(id, fid).locked, 1); await run(X.click(id, `fa|${id}|lock|${fid}`));
  const b = svc('economyService').balance(id); i = await run(X.click(id, `fa|${id}|sell|${fid}`)); assert.match(String(X.last(i).p.content), /Đã bán/); const b2 = svc('economyService').balance(id); assert.ok(b2 > b);
  i = await run(X.click(id, `fa|${id}|sell|${fid}`)); assert.equal(svc('economyService').balance(id), b2);
});

group('Tự cài đặt khi khởi động (host không có terminal)');
test('tự đăng ký lệnh một lần, lần sau bỏ qua; tải emoji khi chưa có', async () => {
  const auto = require('../src/autosetup'); const Dj = require('discord.js'); const S = req('database/repositories/settings'); let puts = 0;
  const orig = Dj.REST.prototype.put; Dj.REST.prototype.put = function (...a) { puts++; return orig.apply(this, a); };
  try {
    S.unset('commands_hash'); await auto.commands(); assert.equal(puts, 1); assert.ok(S.getRaw('commands_hash')); await auto.commands(); assert.equal(puts, 1);
    const emoji = req('ui/emoji'); let synced = 0; const o = emoji.syncToDiscord; emoji.syncToDiscord = async () => { synced++; return { created: 1, reused: 0, failed: [], total: 1 }; };
    S.unset('emoji_ids'); S.unset('emoji_manifest_hash'); await auto.emojis({}); assert.equal(synced, 1); assert.ok(S.getRaw('emoji_manifest_hash')); emoji.syncToDiscord = o;
  } finally { Dj.REST.prototype.put = orig; }
});
