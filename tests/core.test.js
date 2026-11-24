'use strict';
const H = require('./helpers'); const { test, group, assert, svc, req, clock, player, cast, throwsGame } = H;
const R = (p) => req(`database/repositories/${p}`);

group('Đăng ký người chơi');
test('đăng ký tặng quà tân thủ & trang bị cần Gỗ', () => {
  const id = player('An'); const u = R('users').get(id); const eq = R('users').equipment(id);
  assert.equal(u.level, 1); assert.equal(svc('economyService').balance(id), 500); assert.equal(R('inventory').count(id, 'moi_giun_dat'), 20);
  assert.ok(eq.rod_id); assert.equal(R('rods').get(eq.rod_id).rod_id, 'rod_t1_a'); assert.deepEqual(R('users').unlockedLocations(id), ['ao_lang']);
  assert.ok(R('users').stats(id)); assert.equal(svc('progressService').list(id).chains.length, 1);
});
test('đăng ký hai lần không nhân đôi quà', () => { const id = player(); svc('userService').register(id, 'x'); svc('userService').register(id, 'x'); assert.equal(svc('economyService').balance(id), 500); assert.equal(R('rods').list(id).length, 1); });
test('điểm danh: chuỗi ngày, chặn nhận lần hai, đứt chuỗi', () => {
  const id = player(); const d1 = svc('userService').daily(id); assert.equal(d1.streak, 1); throwsGame(() => svc('userService').daily(id), /đã nhận/);
  clock.adv(86400000); assert.equal(svc('userService').daily(id).streak, 2); clock.adv(3 * 86400000); assert.equal(svc('userService').daily(id).streak, 1);
});
test('người chơi bị khoá không chơi được; bảo trì chặn', () => {
  const id = player(); svc('adminService').ban('a', id, 'test'); throwsGame(() => svc('userService').assertCanPlay(id), /khoá/); svc('adminService').unban('a', id);
  H.settings.set('maintenance', 1); throwsGame(() => svc('userService').assertCanPlay(id), /bảo trì/); H.settings.set('maintenance', 0);
});

group('Câu cá');
test('câu thành công: nhận cá, EXP, thống kê, codex, giảm độ bền & mồi', () => {
  const id = player(); const before = R('rods').list(id)[0].durability; const s = cast(id, 'perfect'); assert.equal(s.state, 'success'); const r = s.result;
  const f = R('fish').owned(id, r.fishInstanceId); assert.ok(f); assert.ok(f.weight > 0 && f.base_value > 0); assert.equal(R('inventory').count(id, 'moi_giun_dat'), 19);
  assert.equal(R('users').stats(id).total_catch, 1); assert.equal(R('fish').codexCount(id), 1); assert.ok(R('users').get(id).exp > 0 || R('users').get(id).level > 1);
  assert.ok(R('rods').list(id)[0].durability <= before); assert.equal(R('fish').recentHistory(id, 5)[0].result, 'success');
});
test('không cho nhiều phiên câu đồng thời', () => { const id = player(); svc('fishingService').startCast(id); throwsGame(() => svc('fishingService').startCast(id), /phiên câu/); assert.equal(H.db().value("SELECT COUNT(*) FROM fishing_sessions WHERE state IN ('waiting','bite','reeling')"), 1); });
test('ràng buộc DB chặn phiên đồng thời kể cả khi bỏ qua kiểm tra ứng dụng', () => {
  const id = player(); const sid = svc('fishingService').startCast(id).id;
  assert.throws(() => R('sessions').create({ user_id: id, state: 'waiting', nonce: 'x', started_at: 1 }), /UNIQUE/); assert.ok(sid);
});
test('trạng thái Cá thoát: không giật cần kịp', () => { const id = player(); const s = cast(id, 'miss'); assert.equal(s.state, 'escaped'); assert.equal(R('users').stats(id).escaped_count, 1); assert.equal(R('users').stats(id).total_catch, 0); });
test('trạng thái Thất bại (đứt dây) khi thao tác sai liên tục', () => {
  H.rng.setRng(H.rng.mulberry32(7)); const id = player(); let outs = {}; for (let i = 0; i < 12; i++) { const s = cast(id, 'bad'); outs[s.state] = (outs[s.state] || 0) + 1; H.db().run('UPDATE rod_instances SET durability=500,max_durability=500'); clock.adv(60000); }
  assert.ok(outs.fail || outs.escaped, JSON.stringify(outs)); assert.equal(outs.success || 0, 0);
});
test('trạng thái Hết thời gian khi không thao tác', () => { const id = player(); const s = cast(id, 'idle'); assert.equal(s.state, 'timeout'); });
test('nút cũ (nonce sai) bị từ chối', () => { const id = player(); const f = svc('fishingService'); let s = f.startCast(id); clock.set(s.bite_at); s = f.advance(s.id); assert.equal(s.state, 'bite'); throwsGame(() => f.hook(id, s.id, 'sai'), /hiệu lực/); });
test('người khác không điều khiển được phiên của bạn', () => { const a = player(); const b = player(); const f = svc('fishingService'); let s = f.startCast(a); clock.set(s.bite_at); s = f.advance(s.id); throwsGame(() => f.hook(b, s.id, s.nonce), /không tồn tại/); });
test('thu cần: huỷ phiên, có thể câu lại', () => { const id = player(); const f = svc('fishingService'); const s = f.startCast(id); assert.equal(f.cancel(id, s.id).state, 'cancelled'); clock.adv(60000); f.startCast(id); });
test('cần hỏng không câu được; sửa bằng xu', () => {
  const id = player('A', { xu: 1000 }); H.db().run('UPDATE rod_instances SET durability=0 WHERE user_id=?', id); throwsGame(() => svc('fishingService').startCast(id), /độ bền/);
  const rid = R('rods').list(id)[0].id; const r = svc('rodService').repair(id, rid); assert.ok(r.restored > 0); svc('fishingService').startCast(id);
});
test('khởi động lại bot: phiên dang dở bị huỷ và hoàn mồi', () => {
  const id = player(); svc('fishingService').startCast(id); assert.equal(R('inventory').count(id, 'moi_giun_dat'), 19);
  const file = H.db().file; H.db().close(); H.db().open(); assert.equal(svc('fishingService').recoverSessions(), 1); assert.equal(R('inventory').count(id, 'moi_giun_dat'), 20); assert.equal(R('sessions').active(id), null); assert.ok(file);
});
test('kho đầy chặn thả câu', () => { const id = player(); H.db().run('UPDATE users SET inv_capacity=3 WHERE id=?', id); for (const i of ['vay_ca', 'go_soi']) R('inventory').add(id, i, 1); throwsGame(() => svc('fishingService').startCast(id), /Kho đồ/); });
test('khu vực chưa mở khoá bị chặn', () => { const id = player(); throwsGame(() => svc('fishingService').startCast(id, { location: 'bien_sau' }), /chưa mở khoá/); });

group('Tỷ lệ xuất hiện, phẩm cấp, cân nặng, giá bán');
test('mọi cá: cân nặng trong [min, 1.6×max], giá > 0, phẩm cấp hợp lệ', () => {
  const fish = req('systems/fish'); const D = H.gameData.D; H.rng.setRng(H.rng.mulberry32(11));
  for (const f of D.fishList) for (const v of fish.VARIANTS) for (const bonus of [0, 50]) { const w = fish.rollWeight(f, bonus, v); assert.ok(w >= f.minWeight - 0.01 && w <= f.maxWeight * 1.6 + 0.01, `${f.id} ${w}`); assert.ok(fish.baseValue(f, w, v) >= 1); assert.ok(f.rarity >= 1 && f.rarity <= 9); }
});
test('phân bố phẩm cấp theo khu vực đúng thiết kế & may mắn làm tăng cá hiếm', () => {
  const fish = req('systems/fish'); const D = H.gameData.D;
  for (const loc of D.locList) {
    const t0 = fish.spawnTable({ location: loc.id, timeBand: 'day', weather: 'nang', rareBonus: 0 }); const t1 = fish.spawnTable({ location: loc.id, timeBand: 'day', weather: 'nang', rareBonus: 150 });
    assert.ok(Math.abs(t0.reduce((a, r) => a + r.chance, 0) - 1) < 1e-9); const top = (t) => t.filter((r) => r.fish.rarity > loc.rarity).reduce((a, r) => a + r.chance, 0);
    assert.ok(top(t1) > top(t0) - 1e-9, `${loc.id}: may mắn phải tăng cá hiếm`); assert.ok(t0.every((r) => r.fish.rarity >= Math.max(1, loc.rarity - 1) && r.fish.rarity <= Math.min(9, loc.rarity + 1)));
  }
});
test('mô phỏng 20.000 lần chọn cá khớp xác suất lý thuyết (sai số < 1.5%)', () => {
  const fish = req('systems/fish'); H.rng.setRng(H.rng.mulberry32(99)); const t = fish.spawnTable({ location: 'bien_sau', timeBand: 'day', weather: 'nang', rareBonus: 40 }); const cnt = {}; const N = 20000;
  for (let i = 0; i < N; i++) { const f = fish.pickFish(t); cnt[f.id] = (cnt[f.id] || 0) + 1; }
  for (const r of t) assert.ok(Math.abs((cnt[r.fish.id] || 0) / N - r.chance) < 0.015, `${r.fish.id}`);
});
test('thời tiết/giờ ảnh hưởng bảng cá; mồi đúng loại tăng tỷ lệ', () => {
  const fish = req('systems/fish'); const D = H.gameData.D; const a = fish.spawnTable({ location: 'ao_lang', timeBand: 'day', weather: 'nang' }); const b = fish.spawnTable({ location: 'ao_lang', timeBand: 'night', weather: 'mua' });
  assert.ok(a.some((r, i) => Math.abs(r.chance - b[i].chance) > 1e-6)); const bait = D.baits.get('moi_tom_nho'); const c = fish.spawnTable({ location: 'bien_sau', timeBand: 'day', weather: 'nang', bait }); const d = fish.spawnTable({ location: 'bien_sau', timeBand: 'day', weather: 'nang' });
  const sum = (t) => t.filter((r) => r.fish.category === 'nuoc_man').reduce((x, r) => x + r.chance, 0); assert.ok(sum(c) >= sum(d));
});
test('biến thể đặc biệt hiếm đúng kỳ vọng', () => { const fish = req('systems/fish'); H.rng.setRng(H.rng.mulberry32(5)); let n = 0; for (let i = 0; i < 20000; i++) if (fish.rollVariant(0).id !== 'thuong') n++; assert.ok(n / 20000 > 0.07 && n / 20000 < 0.13, String(n / 20000)); });
test('giá trị cá tăng theo phẩm cấp & khu vực (kinh tế nhất quán)', () => {
  const D = H.gameData.D; const avg = (f) => f.pricePerKg * (f.minWeight + f.maxWeight) / 2; const by = {}; for (const f of D.fishList.filter((x) => !x.bossOnly && !x.event)) (by[f.location] = by[f.location] || []).push(avg(f));
  let prev = 0; for (const l of D.locList) { const m = by[l.id].reduce((a, b) => a + b, 0) / by[l.id].length; assert.ok(m > prev, `${l.id}`); prev = m; }
});
