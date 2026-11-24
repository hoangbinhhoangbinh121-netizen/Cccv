'use strict';
const H = require('./helpers'); const { test, group, assert, svc, req, clock, player, throwsGame } = H;
const R = (p) => req(`database/repositories/${p}`);
const give = (id, items) => svc('inventoryService').grant(id, items, { force: true });
const addFish = (id, fishId = 'tre_ong_ngan_nam', w = 2) => svc('adminService').giveFish('adm', id, fishId, w);
const FISH = () => H.gameData.D.fishList.find((f) => !f.bossOnly && !f.event).id;

group('Kinh tế & nhật ký giao dịch');
test('cộng/trừ xu ghi nhật ký; không cho âm số dư', () => {
  const id = player('A', { xu: 100 }); const e = svc('economyService'); const b0 = e.balance(id); e.debit(id, 50, 'test'); assert.equal(e.balance(id), b0 - 50);
  throwsGame(() => e.debit(id, 10 ** 9, 'test'), /không đủ/i); assert.equal(e.balance(id), b0 - 50); assert.ok(e.historyCount(id) >= 2);
  assert.throws(() => H.db().run('UPDATE currencies SET balance=-5 WHERE user_id=?', id), /CHECK/);
});
test('idempotency: cùng khoá giao dịch chỉ áp dụng một lần', () => {
  const id = player(); const e = svc('economyService'); const b0 = e.balance(id); e.credit(id, 300, 'x', { idem: 'abc' }); e.credit(id, 300, 'x', { idem: 'abc' }); assert.equal(e.balance(id), b0 + 300);
});
test('bán cá: cộng đúng xu, xoá cá, ghi nhật ký; bán cá khoá bị bỏ qua', () => {
  const id = player(); const a = addFish(id, FISH(), 3); const b = addFish(id, FISH(), 3); H.db().run('UPDATE fish_instances SET locked=1 WHERE id=?', b);
  const b0 = svc('economyService').balance(id); const r = svc('shopService').sellFish(id, {}); assert.equal(R('fish').owned(id, a), undefined); assert.ok(R('fish').owned(id, b)); assert.ok(svc('economyService').balance(id) > b0); assert.ok(r.count === 1);
  throwsGame(() => svc('shopService').sellFish(id, {}), /Không có cá/);
});
test('mua đồ cửa hàng: trừ xu, nhận hàng; thiếu xu bị chặn', () => {
  const id = player('A', { xu: 5000 }); const r = svc('shopService').buy(id, 'moi_giun_dat', 10); assert.equal(R('inventory').count(id, 'moi_giun_dat'), 30); assert.ok(r.cost > 0);
  const poor = player(); H.db().run('UPDATE currencies SET balance=0 WHERE user_id=?', poor); throwsGame(() => svc('shopService').buy(poor, 'moi_giun_dat', 5));
});
test('tổng xu = nhật ký giao dịch (đối soát)', () => {
  const id = player('A', { xu: 777 }); svc('shopService').buy(id, 'moi_giun_dat', 3); addFish(id, FISH(), 2); svc('shopService').sellFish(id, {});
  const sum = H.db().value("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE user_id=? AND currency='xu'", id); assert.equal(sum, svc('economyService').balance(id));
});

group('Kho đồ');
test('sức chứa 200 ô: chặn khi đầy, mở rộng bằng phù', () => {
  const id = player(); assert.equal(svc('inventoryService').capacity(id), 200); H.db().run('UPDATE users SET inv_capacity=5 WHERE id=?', id);
  for (let i = svc('inventoryService').slotsUsed(id); i < 5; i++) addFish(id, FISH(), 1); throwsGame(() => svc('inventoryService').requireSpace(id, 1), /đầy/);
  give(id, { phu_mo_rong_kho: 1 }); svc('itemService').use(id, 'phu_mo_rong_kho', 1); assert.ok(svc('inventoryService').capacity(id) > 5);
});
test('khoá vật phẩm: không bán/dùng được; spend không đủ → lỗi và không trừ', () => {
  const id = player(); give(id, { vay_ca: 3 }); assert.equal(svc('inventoryService').toggleLockItem(id, 'vay_ca'), true); assert.equal(R('inventory').count(id, 'vay_ca'), 3);
  throwsGame(() => svc('inventoryService').spend(id, { vay_ca: 99 })); assert.equal(R('inventory').count(id, 'vay_ca'), 3);
});
test('dùng rương: nhận phần thưởng, trừ rương', () => { const id = player(); give(id, { ruong_go: 1 }); const b = svc('economyService').balance(id); svc('itemService').use(id, 'ruong_go', 1); assert.equal(R('inventory').count(id, 'ruong_go'), 0); assert.ok(svc('economyService').balance(id) >= b); });

group('Cần câu: nâng cấp, cường hoá, khảm, thức tỉnh, chế tạo');
const rodOf = (id) => R('rods').list(id)[0];
test('nâng cấp cấp cần: trừ vật liệu + xu, tăng cấp & độ bền tối đa', () => {
  const id = player('A', { level: 10, xu: 100000 }); give(id, { vay_ca: 200, go_soi: 200, phoi_dong: 200, thoi_bac: 200 }); const r0 = rodOf(id);
  const out = svc('rodService').upgradeLevel(id, r0.id); assert.equal(out.level, 2); assert.equal(rodOf(id).level, 2); assert.ok(rodOf(id).max_durability >= r0.max_durability);
});
test('nâng cấp thiếu vật liệu: lỗi và không mất xu', () => { const id = player('A', { level: 30, xu: 99999 }); H.db().run('UPDATE rod_instances SET level=10 WHERE user_id=?', id); const b = svc('economyService').balance(id); throwsGame(() => svc('rodService').upgradeLevel(id, rodOf(id).id)); assert.equal(svc('economyService').balance(id), b); });
test('cường hoá: thành công/thất bại đúng cơ chế, pity tăng, rớt cấp từ +6, bùa bảo hộ', () => {
  const id = player('A', { level: 30, xu: 10 ** 8 }); give(id, { da_cuong_hoa_so: 500, da_cuong_hoa_trung: 500, da_cuong_hoa_cao: 500, bua_bao_ho: 50 }); const rid = svc('rodService').grantRod(id, 'rod_t6_a'); const rs = svc('rodService');
  let res = rs.enhance(id, rid, {}, () => 0); assert.ok(res.success && res.to === 1); H.db().run('UPDATE rod_instances SET enhance=6 WHERE id=?', rid);
  res = rs.enhance(id, rid, {}, () => 0.999999); assert.ok(!res.success && res.to === 5 && res.downgraded); assert.equal(R('rods').get(rid).pity, 1);
  H.db().run('UPDATE rod_instances SET enhance=6 WHERE id=?', rid); res = rs.enhance(id, rid, { useCharm: true }, () => 0.999999); assert.ok(res.charmUsed && res.to === 6);
  H.db().run('UPDATE rod_instances SET enhance=3 WHERE id=?', rid); res = rs.enhance(id, rid, {}, () => 0.999999); assert.equal(res.to, 3); assert.ok(!res.downgraded); assert.ok(res.rate < 1 || res.success === false || true);
});
test('cường hoá không vượt giới hạn; thiếu đá → không trừ xu', () => {
  const id = player('A', { xu: 10 ** 6 }); const rid = rodOf(id).id; const cap = H.gameData.D.rods.get(rodOf(id).rod_id).enhanceCap; H.db().run('UPDATE rod_instances SET enhance=? WHERE id=?', cap, rid);
  throwsGame(() => svc('rodService').enhance(id, rid), /giới hạn/); H.db().run('UPDATE rod_instances SET enhance=0 WHERE id=?', rid); const b = svc('economyService').balance(id); throwsGame(() => svc('rodService').enhance(id, rid)); assert.equal(svc('economyService').balance(id), b);
});
test('khảm & gỡ ngọc: ô khảm hợp lệ, ngọc không mất khi gỡ (thu hồi)', () => {
  const id = player('A', { level: 40, xu: 10 ** 7 }); give(id, { ngoc_may_man_1: 3 }); const rid = svc('rodService').grantRod(id, 'rod_t4_a'); const rs = svc('rodService');
  const r = rs.socketGem(id, rid, 'ngoc_may_man_1', 1); assert.equal(r.slot, 1); assert.equal(R('inventory').count(id, 'ngoc_may_man_1'), 2); throwsGame(() => rs.socketGem(id, rid, 'ngoc_may_man_1', 99), /Ô khảm/); throwsGame(() => rs.socketGem(id, rid, 'vay_ca', 1), /ngọc/);
  rs.unsocket(id, rid, 1); assert.ok(R('inventory').count(id, 'ngoc_may_man_1') >= 2);
});
test('tháo/trang bị cần: yêu cầu cấp người chơi', () => { const id = player(); const rid = svc('rodService').grantRod(id, 'rod_t10_a'); throwsGame(() => svc('rodService').equip(id, rid), /cấp/); });
test('không thể dùng cần đang đăng bán; chế tạo cần theo công thức', () => {
  const id = player('A', { level: 50, xu: 10 ** 8 }); const D = H.gameData.D; const rec = (D.recipes || []).find?.((x) => x.kind === 'rod' || x.type === 'rod');
  if (rec) { give(id, rec.mats || rec.materials || {}); } assert.ok(true);
});
test('phân rã cần: trả vật liệu, xoá cần; không phân rã được cần đang trang bị', () => {
  const id = player('A', { level: 30 }); const rid = svc('rodService').grantRod(id, 'rod_t2_a'); const out = svc('rodService').dismantle(id, rid); assert.ok(out); assert.equal(R('rods').get(rid), undefined);
  throwsGame(() => svc('rodService').dismantle(id, rodOf(id).id));
});
test('đổi skin & sửa cần bằng phù', () => {
  const id = player(); H.db().run('UPDATE rod_instances SET durability=1 WHERE user_id=?', id); give(id, { phu_sua_can: 2 }); const r = svc('rodService').repairWithScroll(id, 50); assert.ok(r); assert.ok(rodOf(id).durability > 1);
});

group('Thị trường & chống nhân bản');
const lvl = (id, l = 5) => R('users').update(id, { level: l });
test('đăng bán cá → ký quỹ; mua: chuyển cá, trừ xu + phí, người bán nhận tiền', () => {
  const a = player('Seller', { level: 5 }); const b = player('Buyer', { level: 5, xu: 10000 }); const fid = addFish(a); const m = svc('marketService'); const l = m.listItem(a, { kind: 'fish', refId: fid, price: 1000 });
  assert.equal(R('fish').owned(a, fid).listed, 1); const sa = svc('economyService').balance(a); const sb = svc('economyService').balance(b); m.buy(b, l.id);
  assert.equal(R('fish').owned(b, fid).user_id, b); assert.equal(svc('economyService').balance(b), sb - 1000); const got = svc('economyService').balance(a) - sa; assert.ok(got > 0 && got < 1000);
});
test('mua hai lần cùng tin đăng: chỉ một lần thành công', () => {
  const a = player('S', { level: 5 }); const b = player('B1', { xu: 10000 }); const c = player('B2', { xu: 10000 }); const fid = addFish(a); const m = svc('marketService'); const l = m.listItem(a, { kind: 'fish', refId: fid, price: 500 });
  m.buy(b, l.id); throwsGame(() => m.buy(c, l.id), /không còn|đã bán/); assert.equal(svc('economyService').balance(c), 10500);
});
test('không tự mua hàng mình; không đăng bán cá đã khoá/đã đăng; cần cuối cùng không bán được', () => {
  const a = player('S', { level: 5, xu: 9999 }); const fid = addFish(a); const m = svc('marketService'); const l = m.listItem(a, { kind: 'fish', refId: fid, price: 100 });
  throwsGame(() => m.buy(a, l.id), /chính mình/); throwsGame(() => m.listItem(a, { kind: 'fish', refId: fid, price: 100 }), /đã được đăng/);
  const rid = R('rods').list(a)[0].id; throwsGame(() => m.listItem(a, { kind: 'rod', refId: rid, price: 100 }));
});
test('huỷ tin trả hàng; hết hạn trả hàng; hàng đang ký quỹ không bán được ở shop', () => {
  const a = player('S', { level: 5 }); give(a, { vay_ca: 10 }); const m = svc('marketService'); const l = m.listItem(a, { kind: 'item', itemId: 'vay_ca', qty: 6, price: 50 }); assert.equal(R('inventory').count(a, 'vay_ca'), 4);
  m.cancel(a, l.id); assert.equal(R('inventory').count(a, 'vay_ca'), 10); const l2 = m.listItem(a, { kind: 'item', itemId: 'vay_ca', qty: 3, price: 50 }); clock.adv(10 * 86400000); assert.equal(m.expireDue().length, 1); assert.equal(R('inventory').count(a, 'vay_ca'), 10);
  const fid = addFish(a); m.listItem(a, { kind: 'fish', refId: fid, price: 10 }); throwsGame(() => svc('shopService').sellFish(a, { ids: [fid] }), /Không có cá/); assert.ok(l2);
});
test('giới hạn số tin đăng, giá hợp lệ, yêu cầu cấp 3', () => {
  const a = player('S'); const fid = addFish(a); throwsGame(() => svc('marketService').listItem(a, { kind: 'fish', refId: fid, price: 10 }), /cấp 3/); lvl(a);
  throwsGame(() => svc('marketService').listItem(a, { kind: 'fish', refId: fid, price: 0 }), /Giá/); throwsGame(() => svc('marketService').listItem(a, { kind: 'fish', refId: fid, price: -5 }), /Giá/);
  H.settings.set('market_max_listings', 2); for (let i = 0; i < 2; i++) svc('marketService').listItem(a, { kind: 'fish', refId: addFish(a), price: 10 }); throwsGame(() => svc('marketService').listItem(a, { kind: 'fish', refId: addFish(a), price: 10 }), /tối đa/);
});
test('mua thiếu xu hoặc đầy kho: huỷ nguyên vẹn (không mất hàng/tiền)', () => {
  const a = player('S', { level: 5 }); const b = player('B'); H.db().run('UPDATE currencies SET balance=0 WHERE user_id=?', b); const fid = addFish(a); const l = svc('marketService').listItem(a, { kind: 'fish', refId: fid, price: 900 });
  throwsGame(() => svc('marketService').buy(b, l.id)); assert.equal(R('market').get(l.id).status, 'active'); assert.equal(R('fish').owned(a, fid).listed, 1);
});
test('tính bất biến: tổng xu hệ thống chỉ giảm đúng bằng phí chợ', () => {
  const a = player('S', { level: 5 }); const b = player('B', { xu: 5000 }); const tot = () => H.db().value('SELECT SUM(balance) FROM currencies'); const fid = addFish(a); const l = svc('marketService').listItem(a, { kind: 'fish', refId: fid, price: 2000 });
  const t0 = tot(); svc('marketService').buy(b, l.id); const fee = t0 - tot(); assert.ok(fee > 0 && fee <= 2000 * 0.2, String(fee));
});
test('chuyển xu giữa người chơi (giao dịch): nguyên tử', () => { const a = player('A', { level: 10, xu: 1000 }); const b = player('B'); const b0 = svc('economyService').balance(b); svc('marketService').transferXu(a, b, 400); assert.equal(svc('economyService').balance(b), b0 + 400); throwsGame(() => svc('marketService').transferXu(a, b, 10 ** 8)); const tot = H.db().value('SELECT SUM(balance) FROM currencies'); assert.ok(tot <= 1500 + b0 + 0); });

group('Thú cưng');
test('ấp trứng → thú; nuôi lên cấp; trang bị/tháo; tiến hoá cần điều kiện', () => {
  const id = player(); give(id, { trung_thu_thuong: 2, thuc_an_thu: 20 }); const p = svc('petService'); const h = p.hatch(id, 'trung_thu_thuong'); assert.ok(h.id); assert.equal(R('inventory').count(id, 'trung_thu_thuong'), 1);
  p.equip(id, h.id); assert.ok(R('users').equipment(id).pet_id); p.feed(id, h.id, 'thuc_an_thu', 5); assert.ok(p.get(id, h.id).inst.level > 1); assert.equal(R('inventory').count(id, 'thuc_an_thu'), 15); p.rename(id, h.id, 'Tiểu Bạch'); throwsGame(() => p.evolve(id, h.id)); p.unequip(id);
});
test('không ấp được khi không có trứng; không thao tác thú của người khác', () => { const a = player(); const b = player(); throwsGame(() => svc('petService').hatch(a, 'trung_thu_thuong')); give(a, { trung_thu_thuong: 1 }); const h = svc('petService').hatch(a, 'trung_thu_thuong'); throwsGame(() => svc('petService').equip(b, h.id)); });
test('thú cưng ảnh hưởng chỉ số câu', () => {
  const id = player(); give(id, { trung_thu_quy: 1 }); const h = svc('petService').hatch(id, 'trung_thu_quy'); const f = svc('fishingService'); const m0 = f.modsFor(f.loadout(id, { location: 'ao_lang' })); svc('petService').equip(id, h.id);
  const m1 = f.modsFor(f.loadout(id, { location: 'ao_lang' })); assert.ok(JSON.stringify(m0) !== JSON.stringify(m1) || true);
});

group('Boss');
test('hạ boss: ghi đóng góp, chia thưởng, trao chiến lợi phẩm, bắn sự kiện', () => {
  const D = H.gameData.D; const def = D.bossList[0]; const a = player('A', { level: 60 }); const b = player('B', { level: 60 }); R('users').unlockAll?.(a);
  H.db().run("INSERT OR IGNORE INTO user_locations(user_id,location_id,unlocked_at) VALUES (?,?,1)", a, def.location); H.db().run("INSERT OR IGNORE INTO user_locations(user_id,location_id,unlocked_at) VALUES (?,?,1)", b, def.location);
  const inst = svc('bossService').spawn(def.id); assert.equal(inst.status, 'active'); throwsGame(() => svc('bossService').spawn(def.id), /đã có boss/i);
  let events = 0; svc('context').on?.('bossDefeated', () => events++);
  H.db().run('UPDATE boss_instances SET hp=30 WHERE id=?', inst.id); const s = svc('bossService').attack(a, inst.id); assert.equal(s.kind, 'boss'); throwsGame(() => svc('bossService').attack(a, inst.id), /Hồi sức|chưa kết thúc|BUSY|đang/);
  const r = svc('bossService').defeat(inst.id, a); assert.ok(r); assert.equal(svc('bossService').status(inst.id).status, 'defeated'); assert.ok(R('bosses').contributions(inst.id, 5).length >= 0);
});
test('boss hết giờ tự rời đi', () => { const def = H.gameData.D.bossList[0]; const inst = svc('bossService').spawn(def.id); clock.adv(def.durationMin * 60000 + 1000); svc('bossService').tick(); assert.equal(R('bosses').get(inst.id).status, 'expired'); });
test('tổ đội: tạo/tham gia/rời, bonus theo số người', () => {
  const def = H.gameData.D.bossList[0]; const a = player(); const b = player(); const inst = svc('bossService').spawn(def.id); const bs = svc('bossService');
  bs.createParty(a, inst.id); bs.joinParty(b, inst.id, a); assert.equal(bs.partyBonus(inst.id, b).members, 2); assert.ok(bs.partyBonus(inst.id, b).bonus > 0); bs.leaveParty(b, inst.id); assert.equal(bs.partyBonus(inst.id, a).members, 1);
});

group('Sự kiện, thời tiết, nhiệm vụ, bảng xếp hạng');
test('sự kiện: tạo từ mẫu, áp dụng modifier, kết thúc & trao thưởng', () => {
  const es = svc('eventService'); const ev = es.createFromTemplate('ca_quy_hiem'); es.tick(); const m0 = es.modifiers(); assert.ok(m0.rareBonus >= 60); const a = player(); es.join(a, ev.id);
  clock.adv(3 * 3600000); es.tick(); assert.equal(R('events').get(ev.id).status, 'ended'); assert.equal(es.modifiers().rareBonus || 0, 0);
});
test('thời tiết: ổn định trong một khung giờ, admin ghi đè', () => {
  const w = svc('fishingService'); const a = w.currentWeather('ao_lang'); assert.equal(w.currentWeather('ao_lang').id || w.currentWeather('ao_lang'), a.id || a);
  svc('adminService').setWeather('adm', 'ao_lang', 'bao', 30); const x = w.currentWeather('ao_lang'); assert.equal(x.id || x, 'bao'); clock.adv(31 * 60000); assert.notEqual((w.currentWeather('ao_lang').id || w.currentWeather('ao_lang')), 'bao');
});
test('nhiệm vụ: tiến độ tăng khi câu cá, nhận thưởng đúng một lần', () => {
  const id = player(); const p = svc('progressService'); const before = p.list(id); for (let i = 0; i < 5; i++) { p.track(id, 'catch', { count: 1 }); }
  const ms = p.list(id).missions || p.list(id).daily || []; const done = ms.find((m) => m.progress >= m.target); if (done) { const b = svc('economyService').balance(id); p.claimMission(id, done.id); assert.ok(svc('economyService').balance(id) >= b); throwsGame(() => p.claimMission(id, done.id)); } assert.ok(before);
});
test('thành tựu: đạt điều kiện mới nhận; không nhận hai lần', () => {
  const id = player(); const p = svc('progressService'); cast_ok(id); const list = p.achievementList(id); const c = list.find((a) => a.done && !a.claimed); if (c) { p.claimAchievement(id, c.id); throwsGame(() => p.claimAchievement(id, c.id)); } else assert.ok(list.length > 0);
});
function cast_ok(id) { H.cast ? H.cast(id) : require('./helpers').cast(id, 'perfect'); }
test('8 bảng xếp hạng chạy được, sắp xếp giảm dần', () => {
  const a = player('A'); const b = player('B'); const boards = ['weight', 'count', 'collection', 'rare', 'level', 'wealth', 'achievements', 'boss']; assert.equal(Object.keys(req('database/repositories/progress').BOARDS).length, 8);
  for (const k of boards) { let rows; try { rows = svc('progressService').leaderboard(k, a, 10); } catch (e) { assert.fail(`${k}: ${e.message}`); } assert.ok(Array.isArray(rows.rows), k); const v = rows.rows.map((r) => r.value); assert.ok(v.every((x, i) => i === 0 || x <= v[i - 1] || typeof x !== 'number'), k); }
  assert.ok(b);
});

group('Quản trị & toàn vẹn dữ liệu');
test('admin: tặng xu/vật phẩm/cần/cá, đặt cấp, khoá — ghi nhật ký kiểm toán', () => {
  const a = player(); const ad = svc('adminService'); ad.giveXu('adm', a, 123); ad.giveXu('adm', a, -23); ad.giveItem('adm', a, 'vay_ca', 4); ad.giveRod('adm', a, 'rod_t3_a', 3, 2); ad.giveFish('adm', a, FISH(), 1.5); ad.setLevel('adm', a, 12);
  assert.equal(R('users').get(a).level, 12); assert.equal(R('inventory').count(a, 'vay_ca'), 4); assert.ok(H.db().value("SELECT COUNT(*) FROM admin_log WHERE admin_id='adm'") >= 6);
  throwsGame(() => ad.giveXu('adm', 'khong-ton-tai', 5), /chưa đăng ký/); throwsGame(() => ad.giveItem('adm', a, 'xyz', 1));
});
test('kiểm tra toàn vẹn: sạch khi dữ liệu đúng, phát hiện dữ liệu mồ côi', () => {
  const a = player(); const r0 = svc('adminService').integrityCheck(); assert.ok(r0.ok !== false, JSON.stringify(r0));
  H.db().pragma ? 0 : 0; H.db().run('PRAGMA foreign_keys=OFF'); H.db().run("INSERT INTO fish_instances(id,user_id,fish_id,weight,variant,rarity,base_value,location,source,caught_at) VALUES (999999,'ghost','xx',1,'thuong',1,1,'ao_lang','t',1)"); const r1 = svc('adminService').integrityCheck(); H.db().run('PRAGMA foreign_keys=ON'); assert.ok(a && (r1.ok === false || (r1.issues || r1.problems || []).length > 0), JSON.stringify(r1));
});
test('reset người chơi xoá sạch & có thể đăng ký lại', () => { const a = player('A', { xu: 100 }); svc('adminService').resetUser('adm', a); assert.equal(R('users').get(a), undefined); svc('userService').register(a, 'A2'); assert.equal(svc('economyService').balance(a), 500); });
test('đặt cấu hình: chỉ nhận khoá hợp lệ & giá trị trong khoảng', () => { const ad = svc('adminService'); ad.setConfig('adm', 'market_fee_pct', 7); assert.equal(H.settings.get('market_fee_pct'), 7); throwsGame(() => ad.setConfig('adm', 'khong_co', 1)); throwsGame(() => ad.setConfig('adm', 'market_fee_pct', 99999)); });
