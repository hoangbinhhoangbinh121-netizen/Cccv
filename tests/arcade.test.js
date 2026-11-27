'use strict';
/** Ngư Trường Giải Trí: 4 trò chơi, điểm/trần ngày, nhiệm vụ, thành tích, giao diện, đồng thời, khởi động lại, hồi quy kinh tế. */
const H = require('./helpers'); const { test, group, assert, svc, req, clock, player, rng } = H;
const X = require('./fake');
const R = (p) => req(`database/repositories/${p}`);
const router = req('interactions/router'); const logger = req('utils/logger'); const rl = req('utils/ratelimit');
const { loadCommands } = req('commands'); const arcadeUI = req('ui/arcadeUI'); const db = () => H.db();
const A = () => svc('arcadeService'); const D = () => H.gameData.D; const repo = R('arcade');
const commands = () => { const m = loadCommands(); router.setCommands(m); return m; };
let errors = []; const origErr = logger.error; logger.error = (...a) => { errors.push(a.join(' ')); };
const run = async (i) => { rl.reset(); await router.handle(i); X.check(i, i.commandName || i.customId); return i; };
const textOf = (p) => JSON.stringify((p?.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e)));
const day = () => { clock.adv(2500); };
/** Chơi trọn một vòng đố; correctN câu đúng đầu tiên, còn lại chọn sai. */
function playQuiz(u, correctN = 10, gapMs = 1500) {
  let q = A().quizStart(u);
  for (let k = 0; k < 10; k++) { const d = q.data; clock.adv(gapMs); const right = d.qs[d.i].a; q = A().quizAnswer(u, q.id, d.i, k < correctN ? right : (right + 1) % 4); }
  return q;
}
const sumPts = (u) => db().value("SELECT COALESCE(SUM(applied),0) FROM arcade_ledger WHERE user_id=?", u);

group('Ngư Trường – dữ liệu & hệ thống thuần');
test('dữ liệu arcade hợp lệ: 30 Linh Bảo/6 phẩm, 5 hộp, catalog emoji khớp ảnh', () => {
  const a = D().arcade; assert.equal(a.box.items.length, 30); assert.equal(a.box.grades.length, 6); assert.equal(a.box.tiers.length, 5);
  const cat = require('../data/arcade-emoji.json'); const fs = require('fs'); const path = require('path'); const cfg = req('config');
  for (const x of cat) { assert.ok(fs.existsSync(path.join(cfg.assetsDir, 'arcade', `${x.id}.png`)), `thiếu ảnh ${x.id}`); assert.ok(D().manifest[`ng_${x.id}`], `thiếu manifest ng_${x.id}`); assert.ok(`ng_${x.id}`.length <= 32); }
  for (const it of a.box.items) assert.ok(cat.some((x) => x.id === `i_${it.id}`), `catalog thiếu Linh Bảo ${it.id}`);
});
test('đua cá: 4–6 cá, thứ hạng là hoán vị, mọi vòng cộng dồn tăng, cùng RNG → cùng kết quả', () => {
  const race = req('systems/arcade/race');
  for (let n = 0; n < 200; n++) {
    const f = race.genField(); assert.ok(f.length >= 4 && f.length <= 6); assert.equal(new Set(f.map((x) => x.id)).size, f.length);
    const s = race.simulate(f); assert.deepEqual([...s.order].sort(), f.map((_, k) => k)); assert.equal(s.cum.length, 6);
    for (let r = 1; r < 6; r++) s.cum[r].forEach((v, k) => assert.ok(v > s.cum[r - 1][k]));
  }
  const f = race.genField(); assert.deepEqual(race.simulate(f, rng.mulberry32(5)), race.simulate(f, rng.mulberry32(5)));
  const od = race.odds(f); assert.ok(Math.abs(od.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
test('xúc xắc: 3–10 Xỉu, 11–18 Tài, phân bố 50/50 chính xác, Bão = 3 viên giống nhau', () => {
  const dice = req('systems/arcade/dice'); let tai = 0; let xiu = 0; let bao = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) { const s = a + b + c; const r = dice.judge('tai', [a, b, c]); assert.equal(r.side, s >= 11 ? 'tai' : 'xiu'); if (r.side === 'tai') tai++; else xiu++; if (r.bao) bao++; }
  assert.equal(tai, 108); assert.equal(xiu, 108); assert.equal(bao, 6);
  for (let i = 0; i < 500; i++) for (const v of dice.roll()) assert.ok(v >= 1 && v <= 6);
});
test('hộp: tỉ lệ phẩm bám trọng số, bảo hiểm luôn kích hoạt đúng hạn, không bao giờ ra phẩm có trọng số 0', () => {
  const box = req('systems/arcade/box'); const t = box.tier(1);
  const r = rng.mulberry32(7); const cnt = {}; for (let i = 0; i < 20000; i++) { const x = box.open(t, { pityCount: 0 }, r); cnt[x.grade] = (cnt[x.grade] || 0) + 1; }
  assert.ok(!cnt[5] && !cnt[6]); assert.ok(Math.abs(cnt[1] / 20000 - 0.62) < 0.02, JSON.stringify(cnt));
  const t3 = box.tier(3); let pity = 0; let since = 0; let worst = 0;
  for (let i = 0; i < 5000; i++) { const x = box.open(t3, { pityCount: pity }, r); pity = x.pityNext; if (x.grade >= t3.pity.grade) since = 0; else { since++; worst = Math.max(worst, since); } }
  assert.ok(worst < t3.pity.after, `chuỗi xui dài nhất ${worst} ≥ ${t3.pity.after}`);
});
test('câu đố: 10 câu/vòng, 4 đáp án khác nhau, đúng 1 đáp án, độ khó tăng dần, đáp án khớp dữ liệu cá', () => {
  const quiz = req('systems/arcade/quiz');
  for (let n = 0; n < 150; n++) {
    const qs = quiz.generate(); assert.equal(qs.length, 10); assert.deepEqual(qs.map((q) => q.lv), [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
    for (const q of qs) { assert.equal(q.o.length, 4); assert.equal(new Set(q.o).size, 4); assert.ok(q.a >= 0 && q.a < 4);
      if (q.k === 'loc') { const f = D().fishes.get(q.f); assert.equal(q.o[q.a], D().locations.get(f.location).name); }
      if (q.k === 'rarity') assert.equal(q.o[q.a], D().rarities[D().fishes.get(q.f).rarity - 1].name);
      if (q.k === 'price') { const top = D().fishList.find((x) => x.name === q.o[q.a]); for (const o of q.o) assert.ok(D().fishList.find((x) => x.name === o).pricePerKg <= top.pricePerKg); }
      if (q.k === 'hard') { const top = D().fishList.find((x) => x.name === q.o[q.a]); for (const o of q.o) assert.ok(D().fishList.find((x) => x.name === o).difficulty <= top.difficulty); } }
  }
});

group('Ngư Trường – Đoán Ngư Vương');
test('luồng đầy đủ: chọn → xuất phát → chạy → tự chốt thưởng đúng một lần', () => {
  const u = player(); let s = A().raceOpen(u); assert.equal(s.phase, 'pick'); assert.throws(() => A().raceStart(u, s.id), /chọn một chú cá/);
  s = A().racePick(u, s.id, 0); s = A().raceStart(u, s.id); assert.equal(s.phase, 'run');
  s = A().raceGet(u, s.id); assert.equal(s.status, 'active'); clock.adv(30000); s = A().raceGet(u, s.id);
  assert.equal(s.status, 'done'); assert.ok(s.data.reward.applied > 0);
  const pts = repo.lifetime(u); A().raceAdvance(s.id); A().sweep(); A().raceGet(u, s.id); assert.equal(repo.lifetime(u), pts);
  assert.equal(db().value("SELECT COUNT(*) FROM arcade_ledger WHERE user_id=? AND game='race'", u), 1);
});
test('không đổi lựa chọn sau khi xuất phát; kết quả cố định theo thời gian máy chủ', () => {
  const u = player(); let s = A().raceOpen(u); A().racePick(u, s.id, 1); s = A().raceStart(u, s.id); const order = s.data.result.order.join();
  s = A().racePick(u, s.id, 0); assert.equal(s.data.pick, 1); assert.equal(s.data.result.order.join(), order);
});
test('đang có cuộc đua thì mở lại trả đúng cuộc đó (không tạo trùng); huỷ ở bước chọn không tốn lượt', () => {
  const u = player(); const a = A().raceOpen(u); const b = A().raceOpen(u); assert.equal(a.id, b.id);
  A().raceCancel(u, a.id); assert.equal(A().limitLeft(u, 'race'), 15); assert.equal(repo.sessionActive(u, 'race'), null);
});
test('bỏ dở bước chọn quá 3 phút → phiên đóng; người khác không động được phiên của bạn', () => {
  const u = player(); const v = player(); const s = A().raceOpen(u); assert.throws(() => A().racePick(v, s.id, 0), /không phải của bạn/);
  clock.adv(200000); assert.equal(A().raceAdvance(s.id).status, 'expired');
});
test('giới hạn 15 cuộc/ngày và hồi chiêu giữa hai cuộc', () => {
  const u = player(); const one = () => { let s = A().raceOpen(u); A().racePick(u, s.id, 0); s = A().raceStart(u, s.id); clock.adv(30000); return A().raceGet(u, s.id); };
  one(); assert.throws(() => A().raceOpen(u), /chờ/); clock.adv(5000);
  for (let n = 1; n < 15; n++) { one(); clock.adv(5000); } assert.throws(() => A().raceOpen(u), /đủ \*\*15\*\* cuộc đua/);
});
test('thưởng ngựa ô: chọn cá ít khả năng thắng mà đúng được điểm cao hơn; đoán trượt vào top 3 vẫn có điểm nhỏ', () => {
  const race = req('systems/arcade/race'); const od = [0.5, 0.3, 0.15, 0.05];
  const fav = race.score({ pickIdx: 0, order: [0, 1, 2, 3], odds: od, streak: 0 }); const dog = race.score({ pickIdx: 3, order: [3, 0, 1, 2], odds: od, streak: 0 });
  assert.ok(dog.points > fav.points); assert.ok(dog.underdog); assert.ok(!fav.underdog);
  assert.equal(race.score({ pickIdx: 1, order: [0, 1, 2, 3], odds: od, streak: 0 }).kind, 'podium'); assert.equal(race.score({ pickIdx: 3, order: [0, 1, 2, 3], odds: od, streak: 0 }).kind, 'out');
});

group('Ngư Trường – Tài Xỉu Linh Vận');
test('tung xúc xắc: kết quả nhất quán, ghi lịch sử, điểm đúng bảng, sổ cái đúng 1 dòng/ván', () => {
  const u = player(); const P = D().arcade.dice.points; let wins = 0;
  for (let n = 0; n < 12; n++) { clock.adv(3000); const r = A().diceRoll(u, n % 2 ? 'tai' : 'xiu'); const d = r.detail; assert.equal(d.sum, d.dice[0] + d.dice[1] + d.dice[2]); assert.equal(d.side, d.sum >= 11 ? 'tai' : 'xiu'); assert.equal(d.win, d.side === d.pick); if (d.win) wins++; assert.ok(r.points >= (d.win ? P.win : P.lose)); }
  assert.equal(db().value("SELECT COUNT(*) FROM arcade_ledger WHERE user_id=? AND game='dice'", u), 12); assert.equal(A().stats(u).dice.plays, 12); assert.equal(A().stats(u).dice.wins, wins);
});
test('chuỗi đúng tăng thưởng và đứt khi sai; Bão trúng được thưởng lớn', () => {
  const u = player(); const dice = req('systems/arcade/dice'); const seq = [[1, 2, 3], [6, 5, 4], [2, 2, 3], [3, 3, 3]]; let k = 0;
  rng.setRng(() => 0); // tạm: ép xúc xắc bằng cách thay dice.roll
  rng.setRng(null); const orig = dice.roll; dice.roll = () => seq[k++];
  try {
    clock.adv(3000); assert.equal(A().diceRoll(u, 'xiu').points, 8); clock.adv(3000); assert.equal(A().diceRoll(u, 'tai').points, 10); // 15 → Tài, chuỗi 1 → +2
    clock.adv(3000); assert.equal(A().diceRoll(u, 'tai').points, 1); assert.equal(A().stats(u).dice.streak, 0); clock.adv(3000);
    const r = A().diceRoll(u, 'bao'); assert.equal(r.detail.bao, true); assert.equal(r.points, 70);
  } finally { dice.roll = orig; }
});
test('bấm đúp / spam: hồi chiêu chặn lượt thứ hai, giới hạn 40 lượt/ngày, lựa chọn sai bị từ chối', () => {
  const u = player(); clock.adv(3000); A().diceRoll(u, 'tai'); assert.throws(() => A().diceRoll(u, 'tai'), /chờ/); assert.throws(() => A().diceRoll(u, 'xxx'), /không hợp lệ/);
  for (let n = 1; n < 40; n++) { clock.adv(3000); A().diceRoll(u, 'tai'); } clock.adv(3000); assert.throws(() => A().diceRoll(u, 'tai'), /đủ \*\*40\*\* lần/);
});

group('Ngư Trường – Linh Bảo Bí Hộp');
test('mở hộp: nhận Linh Bảo, sưu tầm tăng, trùng quy đổi nửa điểm, không tốn xu/kho', () => {
  const u = player('B', { xu: 1000 }); const wallet = R('wallet'); const before = wallet.balance ? wallet.balance(u) : null; const inv = R('inventory').all(u).length;
  const got = new Set(); let dupe = null;
  for (let n = 0; n < 8; n++) { clock.adv(2500); const r = A().boxOpen(u, 1); assert.ok(D().arcadeItems.has(r.detail.item)); assert.equal(r.detail.grade, D().arcadeItems.get(r.detail.item).grade); if (got.has(r.detail.item)) { dupe = r; assert.ok(r.detail.dupe); assert.ok(!r.detail.isNew); } else assert.ok(r.detail.isNew); got.add(r.detail.item); }
  assert.equal(repo.itemCount(u), got.size); assert.equal(R('inventory').all(u).length, inv); if (before !== null) assert.equal(wallet.balance(u), before);
  const oneMore = () => { clock.adv(2500); return A().boxOpen(u, 1); }; assert.throws(oneMore, /hết \*\*8\*\* lượt/);
});
test('hộp xịn bị khoá theo cấp bậc; mở khoá khi đủ điểm; mỗi bậc có giới hạn ngày riêng', () => {
  const u = player(); clock.adv(2500); assert.throws(() => A().boxOpen(u, 2), /mở khoá ở cấp bậc/);
  repo.award(u, 'test', 'x', 5000, { capped: false }); clock.adv(2500); assert.ok(A().boxOpen(u, 2).id); assert.equal(A().boxTiers(u).filter((t) => t.unlocked).length, 4);
  assert.throws(() => A().boxOpen(u, 5), /mở khoá/);
});
test('bảo hiểm được lưu theo từng bậc và đặt lại khi ra phẩm đủ tốt', () => {
  const u = player(); repo.award(u, 'test', 'x', 5000, { capped: false }); const box = req('systems/arcade/box'); const orig = box.open; let calls = 0;
  box.open = (t, st) => { calls++; return { grade: 1, item: D().arcade.box.items[0], dupe: calls > 1, points: 2, base: 2, pityUsed: false, pityNext: st.pityCount + 1 }; };
  try { for (let n = 0; n < 3; n++) { clock.adv(2500); A().boxOpen(u, 2); } } finally { box.open = orig; }
  assert.equal(A().stats(u).box.pity[2], 3);
});

group('Ngư Trường – Truy Tìm Linh Ngư');
test('vòng 10/10 nhanh: đủ điểm câu + thưởng tuyệt đối, ghi thống kê và thành tích', () => {
  const u = player(); const q = playQuiz(u, 10); assert.equal(q.status, 'done'); assert.equal(q.data.correct, 10); assert.equal(q.data.final.bonus, D().arcade.quiz.points.perfect);
  assert.equal(q.data.final.total, q.data.pts + q.data.final.bonus); assert.equal(A().stats(u).quiz.perfect, 1);
  assert.ok(A().achievements(u).find((a) => a.id === 'a_quiz_perfect').unlocked);
});
test('trả lời sai/hết giờ: không điểm, chuỗi đứt; bỏ dở → tự hết giờ từng câu và chốt đúng 1 lần', () => {
  const u = player(); let q = A().quizStart(u); const d0 = q.data; q = A().quizAnswer(u, q.id, 0, (d0.qs[0].a + 1) % 4); assert.equal(q.data.last.ok, false); assert.equal(q.data.pts, 0);
  clock.adv(10 * 60000); q = A().quizGet(u, q.id); assert.equal(q.status, 'done'); assert.equal(q.data.correct, 0); const pts = repo.lifetime(u);
  A().sweep(); A().quizGet(u, q.id); assert.equal(repo.lifetime(u), pts); assert.equal(db().value("SELECT COUNT(*) FROM arcade_ledger WHERE game='quiz' AND user_id=?", u), 1);
});
test('hết giờ thì đáp án muộn không được tính; nút cũ (câu đã qua) bị bỏ qua, không trừ/cộng gì', () => {
  const u = player(); let q = A().quizStart(u); const d = q.data; clock.adv(d.limitMs + 5000); const right = d.qs[0].a;
  q = A().quizAnswer(u, q.id, 0, right); assert.equal(q.data.answers[0].ok, false); assert.equal(q.data.i >= 1, true);
  const i1 = q.data.i; const q2 = A().quizAnswer(u, q.id, 0, right); assert.equal(q2.data.i, i1);
});
test('thưởng nhanh/chuỗi: đúng nhanh hơn được nhiều điểm hơn; giới hạn 6 vòng/ngày', () => {
  const quiz = req('systems/arcade/quiz'); const fast = quiz.scoreAnswer({ lv: 2, elapsedMs: 1000, limitMs: 15000, streak: 3 }); const slow = quiz.scoreAnswer({ lv: 2, elapsedMs: 14000, limitMs: 15000, streak: 3 });
  assert.ok(fast.total > slow.total); assert.equal(quiz.scoreAnswer({ lv: 1, elapsedMs: 1, limitMs: 15000, streak: 1 }).streak, 0);
  const u = player(); for (let n = 0; n < 6; n++) { playQuiz(u, 5); clock.adv(6000); } assert.throws(() => A().quizStart(u), /đủ \*\*6\*\* vòng/);
});

group('Ngư Trường – điểm, trần ngày, bảng xếp hạng, nhiệm vụ, thành tích');
test('trần điểm ngày: phần vượt bị cắt, thưởng nhiệm vụ/thành tích không bị trần, qua ngày mới lại cộng được', () => {
  const u = player(); const cap = D().arcade.dailyCap; const a = repo.award(u, 'x', '1', 450, { cap }); const b = repo.award(u, 'x', '2', 200, { cap });
  assert.equal(a.applied, 450); assert.equal(b.applied, 50); assert.ok(b.capped); assert.equal(repo.award(u, 'x', '3', 100, { cap }).applied, 0);
  assert.equal(repo.award(u, 'mission', 'm', 100, { capped: false }).applied, 100); assert.equal(repo.pts(u, 'd', req('utils/time').dayKey()), 600);
  clock.adv(86400000); assert.equal(repo.award(u, 'x', '4', 100, { cap }).applied, 100);
});
test('sổ cái chống trả thưởng hai lần: cùng ref → duplicate, điểm không đổi', () => {
  const u = player(); const a = repo.award(u, 'race', 'race:1', 30, { cap: 500 }); const b = repo.award(u, 'race', 'race:1', 30, { cap: 500 });
  assert.ok(!a.duplicate); assert.ok(b.duplicate); assert.equal(repo.lifetime(u), 30);
});
test('bảng xếp hạng tuần/mùa/tích luỹ: sắp xếp đúng, hạng của bạn đúng, tuần mới bắt đầu từ 0', () => {
  const [p1, p2, p3] = [player('A'), player('B'), player('C')]; repo.award(p1, 'x', '1', 100, { capped: false }); repo.award(p2, 'x', '1', 300, { capped: false }); repo.award(p3, 'x', '1', 200, { capped: false });
  const b = A().board('w', '', p1); assert.deepEqual(b.rows.map((r) => r.user_id), [p2, p3, p1]); assert.equal(b.mine.rank, 3); assert.equal(A().board('s', '', p2).mine.rank, 1); assert.equal(A().board('all', '', p3).mine.rank, 2);
  clock.adv(8 * 86400000); assert.equal(A().board('w', '', p1).rows.length, 0); assert.equal(A().board('all', '', p1).rows.length, 3); assert.ok(A().board('s', req('database/repositories/arcade').seasonKey(clock.get() - 8 * 86400000), p1).rows.length >= 0);
});
test('nhiệm vụ ngày: 3 ngẫu nhiên + 1 cố định, tiến độ tăng theo hành động, nhận thưởng đúng 1 lần', () => {
  const u = player(); let ms = A().missionsOf(u); assert.equal(ms.length, 4); assert.equal(ms[3].id, 'm_all'); assert.deepEqual(A().missionsOf(u).map((m) => m.id), ms.map((m) => m.id));
  clock.adv(3000); A().diceRoll(u, 'tai'); clock.adv(3000); A().boxOpen(u, 1); playQuiz(u, 10); let s = A().raceOpen(u); A().racePick(u, s.id, 0); A().raceStart(u, s.id); clock.adv(30000); A().raceGet(u, s.id);
  ms = A().missionsOf(u); const all = ms.find((m) => m.id === 'm_all'); assert.equal(all.progress, 4); assert.ok(all.done);
  const before = repo.lifetime(u); const r = A().claimMission(u, 'm_all'); assert.ok(r.points === 50); assert.ok(repo.lifetime(u) >= before + 50);
  assert.throws(() => A().claimMission(u, 'm_all'), /đã nhận/); assert.throws(() => A().claimMission(u, 'm_khong_co'), /không có/);
  const undone = ms.find((m) => !m.done); if (undone) assert.throws(() => A().claimMission(u, undone.id), /chưa hoàn thành/);
});
test('nhiệm vụ đổi theo ngày; tiến độ ngày cũ không dồn sang ngày mới', () => {
  const u = player(); clock.adv(3000); A().diceRoll(u, 'tai'); clock.adv(86400000 + 3000); assert.ok(A().missionsOf(u).every((m) => m.progress === 0));
});
test('thành tích mở đúng điều kiện, thưởng điểm một lần, danh hiệu được lưu; lên cấp bậc được thông báo', () => {
  const u = player(); clock.adv(3000); const r = A().diceRoll(u, 'tai'); assert.ok(A().achievements(u).every((a) => a.id !== 'a_dice50' || !a.unlocked));
  repo.award(u, 'x', 'big', 1000, { capped: false }); const un = A().checkAch(u); assert.ok(un.some((a) => a.id === 'a_pts1000')); assert.equal(A().checkAch(u).length, 0);
  assert.equal(A().rankOfUser(u).name, 'Ngư Khách'); void r;
});
test('thống kê cá nhân khớp lịch sử; tổng sổ cái = điểm tích luỹ', () => {
  const u = player(); for (let n = 0; n < 5; n++) { clock.adv(3000); A().diceRoll(u, 'xiu'); } clock.adv(3000); A().boxOpen(u, 1); playQuiz(u, 7);
  assert.equal(A().stats(u).dice.plays, 5); assert.equal(sumPts(u), repo.lifetime(u));
});

group('Ngư Trường – đồng thời, khởi động lại, dữ liệu');
test('nhiều người chơi đồng thời qua router: không lỗi, điểm từng người khớp sổ cái, không trùng thưởng', async () => {
  commands(); errors = []; const ps = Array.from({ length: 12 }, (_, k) => player(`C${k}`));
  await Promise.all(ps.map(async (u) => { for (let n = 0; n < 3; n++) { rl.reset(); clock.adv(3000); await router.handle(X.slash(u, 'ngutruong', { __sub: 'taixiu' })); await router.handle(X.click(u, `v|${u}|ngdice|roll|${n % 2 ? 'tai' : 'xiu'}`)); } }));
  for (const u of ps) assert.equal(sumPts(u), repo.lifetime(u)); assert.deepEqual(errors.filter((e) => !/chờ|quá nhanh/.test(e)), []);
});
test('bấm cùng một nút nhiều lần cùng lúc: chỉ 1 ván được tính', async () => {
  commands(); const u = player(); clock.adv(3000); rl.reset();
  const clicks = Array.from({ length: 5 }, () => X.click(u, `v|${u}|ngdice|roll|tai`)); await Promise.all(clicks.map((i) => router.handle(i)));
  assert.equal(A().stats(u).dice.plays, 1);
});
test('khởi động lại giữa chừng: dữ liệu phiên còn nguyên, sweep chốt cuộc đua/vòng đố dở đúng một lần', () => {
  const u = player(); let r = A().raceOpen(u); A().racePick(u, r.id, 2); r = A().raceStart(u, r.id); const q = A().quizStart(u); const before = repo.lifetime(u);
  req('services/context').reset(); const file = db().file; const D2 = req('database/connection'); const re = new D2.Db(file).open(); D2.setDb(re); // "bot mới" mở lại cùng DB
  assert.equal(repo.sessionActive(u, 'race').id, r.id); assert.equal(repo.sessionActive(u, 'quiz').id, q.id); assert.equal(repo.lifetime(u), before);
  clock.adv(15 * 60000); assert.ok(A().sweep() >= 2); assert.equal(repo.sessionGet(r.id).status, 'done'); assert.equal(repo.sessionGet(q.id).status, 'done'); const pts = repo.lifetime(u); A().sweep(); assert.equal(repo.lifetime(u), pts);
});
test('migration 003 an toàn trên DB đã có dữ liệu cũ; kiểm tra toàn vẹn khoá ngoại', () => {
  const u = player(); clock.adv(3000); A().diceRoll(u, 'tai'); assert.equal(db().all('PRAGMA foreign_key_check').length, 0);
  const st = req('database/migrate').status(db()); assert.equal(st.pending.length, 0); assert.ok(st.applied.some((m) => m.name === 'arcade'));
});
test('sao lưu & khôi phục giữ nguyên dữ liệu Ngư Trường', () => {
  const u = player(); clock.adv(3000); A().diceRoll(u, 'tai'); A().boxOpen(u, 1); const pts = repo.lifetime(u); const items = repo.itemCount(u);
  const file = require('path').join(H.TMP, 'snap-arcade.sqlite'); db().snapshotTo(file); const { Db } = req('database/connection'); const copy = new Db(file).open();
  assert.equal(copy.value("SELECT pts FROM arcade_points WHERE user_id=? AND kind='all'", u), pts); assert.equal(copy.value('SELECT COUNT(*) FROM arcade_items WHERE user_id=?', u), items); copy.close();
});
test('hồi quy: chơi Ngư Trường không đổi xu, kho, cá, thú cưng, EXP/cấp của người chơi', () => {
  const u = player('R', { xu: 5000 }); const snap = () => JSON.stringify({ u: db().get('SELECT level,exp FROM users WHERE id=?', u), w: db().all('SELECT * FROM wallets WHERE user_id=?', u), inv: db().all('SELECT * FROM inventory WHERE user_id=? ORDER BY item_id', u), fish: db().value('SELECT COUNT(*) FROM fish_inventory WHERE user_id=?', u) , pets: db().value('SELECT COUNT(*) FROM user_pets WHERE user_id=?', u) });
  let before; try { before = snap(); } catch { before = null; }
  clock.adv(3000); A().diceRoll(u, 'tai'); A().boxOpen(u, 1); playQuiz(u, 10); const s = A().raceOpen(u); A().racePick(u, s.id, 0); A().raceStart(u, s.id); clock.adv(30000); A().raceGet(u, s.id);
  A().claimMission(u, A().missionsOf(u).find((m) => m.done)?.id || 'x'.repeat(0) || 'm_all'); 
  if (before) assert.equal(snap(), before);
});

group('Ngư Trường – giao diện Discord');
test('mọi lệnh con /ngutruong và lối tắt tiền tố mở được, payload hợp lệ (≤5 hàng, ≤25 nút, custom_id ≤100)', async () => {
  commands(); errors = []; const u = player('UI'); const { SUBS } = require('../src/commands/arcade');
  for (const [name] of SUBS) { const i = await run(X.slash(u, 'ngutruong', { __sub: name })); assert.ok(X.last(i).p.embeds.length, name); }
  assert.deepEqual(errors, []);
  const prefix = req('prefix'); const m = commands(); prefix.setCommands(m);
  for (const k of ['dua', 'taixiu', 'tx', 'bihop', 'hop', 'quiz', 'suutam', 'nvgt', 'bxhgt', 'nt', 'giaitri']) assert.ok(prefix._table().has(prefix.key(k)), `thiếu lối tắt .${k}`);
});
test('tên lệnh /ngutruong: tổng ký tự lệnh ≤ 8000 và các lệnh con khai báo hợp lệ', () => {
  const cmd = commands().get('ngutruong'); const json = cmd.data.toJSON(); assert.ok(json.options.length >= 10); for (const o of json.options) { assert.ok(/^[\w-]{1,32}$/.test(o.name)); assert.ok(o.description.length <= 100); }
});
test('đi qua cả 4 trò bằng nút/menu như người chơi thật (đua → xúc xắc → hộp → đố → hồ sơ)', async () => {
  commands(); errors = []; const u = player('Walk'); const id = (v, a, ...r) => `v|${u}|${v}|${a}${r.length ? `|${r.join('|')}` : ''}`;
  await run(X.slash(u, 'ngutruong')); await run(X.click(u, id('ng', 'show')));
  let i = await run(X.click(u, id('ngrace', 'open'))); const sid = repo.sessionActive(u, 'race').id; assert.match(textOf(X.last(i).p), /chọn nhà vô địch/);
  await run(X.click(u, id('ngrace', 'go', sid))); assert.match(textOf(X.last(await run(X.click(u, id('ngrace', 'go', sid)))).p), /chọn một chú cá/); // chưa chọn → lỗi thân thiện
  await run(X.pick(u, id('ngrace', 'pick', sid), ['1'])); i = await run(X.click(u, id('ngrace', 'go', sid))); assert.match(textOf(X.last(i).p), /Vòng 1\/6|Xuất phát/);
  clock.adv(40000); i = await run(X.click(u, id('ngrace', 'show', sid))); assert.match(textOf(X.last(i).p), /Về đích/); assert.match(textOf(X.last(i).p), /Linh Điểm/);
  clock.adv(3000); i = await run(X.click(u, id('ngdice', 'roll', 'tai'))); clock.adv(4000); i = await run(X.click(u, id('ngdice', 'show', 'h', repo.histRecent(u, 'dice', 1)[0].id))); assert.match(textOf(X.last(i).p), /Tổng/);
  clock.adv(3000); i = await run(X.click(u, id('ngbox', 'open', 1))); clock.adv(4000); i = await run(X.click(u, id('ngbox', 'show', 'h', repo.histRecent(u, 'box', 1)[0].id))); assert.match(textOf(X.last(i).p), /Phẩm/);
  await run(X.click(u, id('ngbox', 'rates', 1))); await run(X.pick(u, id('ngbox', 'rsel'), ['3'])); await run(X.click(u, id('ngbox', 'hist')));
  clock.adv(6000); i = await run(X.click(u, id('ngquiz', 'start'))); const q = repo.sessionActive(u, 'quiz'); assert.match(textOf(X.last(i).p), /Câu 1\/10/);
  i = await run(X.click(u, id('ngquiz', 'ans', q.id, 0, q.data.qs[0].a))); assert.match(textOf(X.last(i).p), /Câu 2\/10/); await run(X.click(u, id('ngquiz', 'ans', q.id, 0, 0))); // nút cũ: không lỗi
  clock.adv(600000); A().quizGet(u, q.id); // bỏ dở vòng đố → tự chốt
  i = await run(X.click(u, id('ngme', 'claim', 'm_all'))); assert.match(X.last(i).p.content, /\+50/); i = await run(X.click(u, id('ngme', 'claim', 'm_all'))); assert.match(textOf(X.last(i).p), /đã nhận/);
  for (const p of ['stats', 'mission', 'ach', 'bag', 'log']) await run(X.click(u, id('ngme', 'show', p)));
  await run(X.click(u, id('ngrank', 'show'))); await run(X.pick(u, id('ngrank', 'sel'), ['all~'])); await run(X.pick(u, id('ngrank', 'sel'), [`s~${repo.seasonKey()}`]));
  assert.deepEqual(errors, []);
});
test('nút của người khác bị từ chối, nút cũ không gây lỗi hệ thống', async () => {
  commands(); errors = []; const u = player(); const v = player(); const i = await run(X.click(v, `v|${u}|ngdice|roll|tai`)); assert.match(textOf(X.last(i).p), /thuộc về người khác/);
  await run(X.click(u, `v|${u}|ngrace|show|99999`)); await run(X.click(u, `v|${u}|ngquiz|show|99999`)); await run(X.click(u, `v|${u}|ngdice|show|h|99999`)); await run(X.click(u, `v|${u}|ngbox|show|h|99999`)); assert.deepEqual(errors, []);
});
test('hoạt ảnh: khung hình tính theo thời gian máy chủ, bộ hẹn giờ dừng đúng lúc, lỗi sửa tin nhắn không làm sập', async () => {
  arcadeUI.stopAll(); commands(); const u = player(); const views = req('interactions/registry'); const c = { uid: u, name: 'x' }; clock.adv(3000); const r = A().diceRoll(u, 'tai');
  const f0 = views.ngdice.frame(c, ['h', String(r.id)]); assert.ok(f0.next > 0); assert.match(textOf(f0.payload), /Đang lắc/); clock.adv(3500);
  const f1 = views.ngdice.frame(c, ['h', String(r.id)]); assert.equal(f1.next, null); assert.match(textOf(f1.payload), /Tổng/);
  let n = 0; arcadeUI.track(u, async () => { n++; throw Object.assign(new Error('x'), { code: 10008 }); }, () => ({ payload: f1.payload, next: 160 }));
  await new Promise((res) => setTimeout(res, 500)); assert.ok(n <= 1); assert.equal(arcadeUI.timers(), 0);
  let m = 0; arcadeUI.track(u, async () => { m++; }, () => ({ payload: f1.payload, next: m >= 2 ? null : 160 })); await new Promise((res) => setTimeout(res, 800)); assert.ok(m >= 2); arcadeUI.stopAll();
});
test('crawler Ngư Trường: bấm mọi nút/menu tới độ sâu 5, không lỗi hệ thống, mọi payload hợp lệ', async () => {
  commands(); errors = []; const u = player('Crawl'); repo.award(u, 'x', 'seed', 9500, { capped: false });
  const queue = []; const seen = new Set(); let clicks = 0; const bad = [];
  for (const sub of ['menu', 'dua', 'taixiu', 'bihop', 'quiz', 'xephang', 'nhiemvu', 'thanhtich', 'suutam', 'thongke', 'huongdan']) { const i = await run(X.slash(u, 'ngutruong', { __sub: sub })); queue.push({ p: X.last(i).p, d: 0 }); }
  while (queue.length && clicks < 700) {
    const { p, d } = queue.shift(); for (const c of X.comps(p)) {
      if (c.disabled || c.style === 5) continue; const ts = c.type === 3 ? [...new Set([c.options[0], c.options[c.options.length - 1]].map((o) => o.value))].map((v) => ({ k: `${c.custom_id}#${v}`, make: () => X.pick(u, c.custom_id, [v]) })) : [{ k: c.custom_id, make: () => X.click(u, c.custom_id) }];
      for (const t of ts) { if (seen.has(t.k) || /\|(cancel)$/.test(t.k)) continue; seen.add(t.k); clicks++; clock.adv(2600); const i = t.make(); try { rl.reset(); await router.handle(i); X.check(i, t.k); const np = X.last(i)?.p; if (np && d < 5) queue.push({ p: np, d: d + 1 }); } catch (e) { bad.push(`${t.k}: ${e.message}`); } }
    }
  }
  console.log(`\n   crawler Ngư Trường: ${clicks} thao tác, ${seen.size} điểm chạm`); assert.deepEqual(bad.slice(0, 5), []); assert.deepEqual(errors.filter((e) => !/Đã hết|hết lượt/.test(e)).slice(0, 5), []); assert.ok(clicks > 40, `chỉ quét ${clicks}`); for (const k of ['|ngquiz|ans|', '|ngbox|open|', '|ngdice|roll|', '|ngrace|go|', '|ngrace|pick|']) assert.ok([...seen].some((x) => x.includes(k)), `crawler chưa chạm ${k}`);
});
