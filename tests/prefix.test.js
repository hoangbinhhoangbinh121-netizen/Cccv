'use strict';
/** Lệnh tiền tố "." – tin nhắn giả đi qua cùng bộ định tuyến như slash command. */
const H = require('./helpers'); const { test, group, assert, svc, req, clock, player } = H;
const R = (p) => req(`database/repositories/${p}`);
const router = req('interactions/router'); const prefix = req('prefix'); const config = req('config'); const logger = req('utils/logger');
const { loadCommands } = req('commands'); const fishingUI = req('ui/fishingUI'); const rl = req('utils/ratelimit'); const stub = require('./mocks/node_modules/discord.js');
const errs = []; const origErr = logger.error; logger.error = (...a) => { errs.push(a.join(' ')); };

const setup = () => { const m = loadCommands(); router.setCommands(m); prefix.setCommands(m); return m; };
function msg(userId, content, extra = {}) {
  const sent = []; const channel = {
    send: async (p) => { const m = { id: `m${sent.length + 1}`, p, edits: [], edit: async (q) => { m.edits.push(q); return m; } }; sent.push(m); return m; }, sendTyping: async () => {},
  };
  return {
    sent, id: 'orig', content, author: { id: userId, username: `u${userId}`, globalName: `U${userId}`, bot: !!extra.bot }, member: { displayName: `U${userId}`, roles: { cache: new Map() }, permissions: { has: () => !!extra.admin } },
    guild: extra.dm ? null : { id: 'g' }, guildId: 'g', channel, channelId: 'c1', attachments: { first: () => extra.attachment || null }, mentions: { users: new Map(extra.mentions || []) },
    client: { users: { fetch: async (id) => ({ id, username: `u${id}` }) } },
  };
}
const go = async (m) => { rl.reset(); await prefix.onMessage(m); return m; };
const txt = (p) => JSON.stringify([p.content || '', (p.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e))]);

group('Lệnh tiền tố');
test('đọc số: 1k, 2.5m, 1.000.000, chữ → null', () => {
  assert.equal(prefix.parseNumber('1k', true), 1000); assert.equal(prefix.parseNumber('2.5m', true), 2500000); assert.equal(prefix.parseNumber('1.000.000', true), 1000000); assert.equal(prefix.parseNumber('12', true), 12); assert.equal(prefix.parseNumber('abc', true), null); assert.equal(prefix.parseNumber('1tr', true), 1000000);
});
test('tách từ có ngoặc kép', () => { assert.deepEqual(prefix.tokenize('cauca "ao lang" giun'), ['cauca', 'ao lang', 'giun']); });
test('mọi lệnh slash đều gọi được bằng tiền tố (tên gốc, bỏ _ / -, và bí danh)', () => {
  const cmds = setup(); for (const name of cmds.keys()) assert.ok(prefix._table().get(prefix.key(name)), `thiếu ${name}`);
  for (const [n, al] of Object.entries(prefix.ALIASES)) { assert.ok(cmds.has(n), `bí danh cho lệnh không tồn tại: ${n}`); for (const a of al) assert.equal(prefix._table().get(prefix.key(a)).name, n, `bí danh ${a} bị trùng`); }
});
test('.cauca mở phiên câu, trả lời dạng tin nhắn thường và tự làm mới bằng message.edit', async () => {
  setup(); const id = player(); const m = await go(msg(id, '.cauca')); assert.equal(m.sent.length, 1); assert.match(txt(m.sent[0].p), /đang chờ cá cắn/); assert.equal(m.sent[0].p.flags, undefined); assert.equal(m.sent[0].p.reply.messageReference, 'orig'); assert.deepEqual(m.sent[0].p.allowedMentions.parse, []);
  const s = R('sessions').active(id); assert.equal(s.message_id, 'm1'); clock.set(s.bite_at + 100); await fishingUI.tick(s.id);
  assert.equal(m.sent[0].edits.length, 1); assert.match(txt(m.sent[0].edits[0]), /CÁ CẮN CÂU/); fishingUI.clearAll();
  const stubErrs = stub.validatePayload(m.sent[0].p, '.cauca'); assert.deepEqual(stubErrs, []);
});
test('.cauca lần hai khi đang có phiên → mở lại đúng phiên, không lỗi', async () => {
  setup(); const id = player(); await go(msg(id, '.cauca')); const first = R('sessions').active(id); const m = await go(msg(id, '.c')); assert.match(m.sent[0].p.content, /đã mở lại/); assert.equal(R('sessions').active(id).id, first.id); fishingUI.clearAll();
});
test('.cauca ao → tự hoàn thành tên khu vực như slash', async () => {
  setup(); const id = player(); await go(msg(id, '.cauca ao')); assert.equal(R('sessions').active(id).location, 'ao_lang'); fishingUI.clearAll();
});
test('.kho, .thongtin, .daily, .bangxephang, .nhiemvu trả lời bằng embed hợp lệ', async () => {
  setup(); const id = player(); for (const c of ['.kho', '.tt', '.daily', '.bxh', '.nv', '.khoca', '.help', '.cuahang', '.sukien']) { const m = await go(msg(id, c)); assert.ok(m.sent.length >= 1, `${c} không trả lời`); const t = txt(m.sent[0].p); assert.doesNotMatch(t, /undefined|NaN|\[object Object\]/, c); assert.deepEqual(stub.validatePayload(m.sent[0].p, c), [], c); }
});
test('không phải lệnh / chat thường / bot / tin nhắn riêng → im lặng', async () => {
  setup(); const id = player(); for (const c of ['.', '...', '. cauca', '.khongco', 'cauca', '.ok', '.k', 'xin chào .cauca']) assert.equal((await go(msg(id, c))).sent.length, 0, c);
  assert.equal((await go(msg(id, '.cauca', { bot: true }))).sent.length, 0); assert.equal((await go(msg(id, '.cauca', { dm: true }))).sent.length, 0); assert.equal(R('sessions').active(id), undefined);
});
test('thiếu tham số → báo cách dùng; lệnh con sai → báo cách dùng', async () => {
  setup(); const a = player('A'); const m = await go(msg(a, '.giaodich')); assert.match(txt(m.sent[0].p), /Cách dùng[\s\S]*giaodich/); const m2 = await go(msg(a, '.fishing-admin xyz', { admin: true })); assert.match(txt(m2.sent[0].p), /Không có lệnh con/);
  const m3 = await go(msg(a, '.giaodich @x abc')); assert.match(txt(m3.sent[0].p), /số|Cách dùng|Không tìm thấy/);
});
test('chuyển xu: .giaodich @người 1k (đọc mention và số rút gọn)', async () => {
  setup(); const a = player('A', { level: 30, xu: 100000 }); const b = player('B', { level: 5 }); const before = R('users').get(b).xu ?? null;
  const m = await go(msg(a, `.giaodich <@${b}> 1k`)); assert.ok(m.sent.length >= 1); assert.doesNotMatch(txt(m.sent[0].p), /Cách dùng/); void before;
});
test('quyền: người thường bị chặn lệnh quản trị, admin chạy được', async () => {
  setup(); const u = player('U'); const m = await go(msg(u, '.fishing-admin stats')); assert.match(txt(m.sent[0].p), /quản trị viên/); const a = player('Adm'); const m2 = await go(msg(a, '.fa stats', { admin: true })); assert.doesNotMatch(txt(m2.sent[0].p), /Chỉ quản trị viên/);
});
test('.restore_db chỉ chủ bot và cần tệp đính kèm hợp lệ', async () => {
  setup(); const u = player('U'); const m = await go(msg(u, '.restore_db')); assert.ok(m.sent.length === 1); assert.match(txt(m.sent[0].p), /chủ bot|OWNER/);
});
test('.lenh liệt kê lệnh và tiền tố', async () => { setup(); const id = player(); const m = await go(msg(id, '.lenh')); assert.match(txt(m.sent[0].p), /cauca[\s\S]*backupdb/); });
test('giới hạn tốc độ: spam lệnh tiền tố bị bỏ qua, không treo', async () => {
  setup(); const id = player(); let n = 0; rl.reset(); for (let k = 0; k < 20; k++) { const m = msg(id, '.kho'); await prefix.onMessage(m); n += m.sent.length; } assert.ok(n < 20 && n >= 1);
});
test('PREFIX_ENABLED=0 tắt hẳn', async () => { setup(); const id = player(); config.prefixEnabled = false; try { assert.equal((await go(msg(id, '.kho'))).sent.length, 0); } finally { config.prefixEnabled = true; } });
test('sau khi chạy lệnh tiền tố không có lỗi hệ thống nào bị ghi log', () => { assert.deepEqual(errs.filter((e) => !/Lệnh tiền tố lỗi: GameError/.test(e)), []); });
test('.giaodich mở màn xác nhận với đúng số xu (1k = 1000) và giữ giới hạn tối thiểu của lệnh', async () => {
  setup(); const a = player('A2', { level: 30, xu: 100000 }); const b = player('B2', { level: 5 });
  const m = await go(msg(a, `.giaodich <@${b}> 1k`)); assert.match(txt(m.sent[0].p), /1[.,\s]?000/); assert.doesNotMatch(txt(m.sent[0].p), /Cách dùng/);
  const m2 = await go(msg(a, `.giaodich <@${b}> 50`)); assert.match(txt(m2.sent[0].p), /khoảng|Cách dùng/);
});
