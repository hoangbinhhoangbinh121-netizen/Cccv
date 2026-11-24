'use strict';
/**
 * Bộ định tuyến tương tác: slash command, nút, menu chọn, modal, autocomplete.
 * Mọi tương tác đi qua cùng một cổng: giới hạn tốc độ → khoá theo người chơi → xử lý → bắt lỗi (GameError hiển thị thẳng, lỗi lạ ghi log).
 * custom_id: v|<uid>|<view>|<act>|<args…>  ·  m|… (modal)  ·  fs|<sessionId>|<nonce>|<action>  ·  fa|<uid>|<action>|<arg>
 */
const K = require('../ui/kit');
const H = require('./helpers');
const views = require('./registry');
const fishing = require('../services/fishingService');
const shopSvc = require('../services/shopService');
const bossSvc = require('../services/bossService');
const fishRepo = require('../database/repositories/fish');
const sessRepo = require('../database/repositories/sessions');
const fishingUI = require('../ui/fishingUI');
const ratelimit = require('../utils/ratelimit');
const { withLock } = require('../utils/lock');
const { GameError } = require('../utils/errors');
const logger = require('../utils/logger');
const ctxBus = require('../services/context');
const { F } = K;

let commands = new Map();
const setCommands = (m) => { commands = m; };
const SESSION_ACTIONS = new Set(['hook', 'pull', 'hold', 'release', 'cancel']);

async function safeReply(i, payload) {
  try { if (i.deferred || i.replied) return await i.followUp({ ...payload, flags: K.EPHEMERAL }); return await i.reply({ ...payload, flags: K.EPHEMERAL }); } catch (e) { logger.warn(`Không gửi được phản hồi: ${e.message}`); return null; }
}
async function fail(i, err) {
  if (err instanceof GameError) return safeReply(i, H.errorPayload(err.message));
  logger.error(`Lỗi tương tác (${i.customId || i.commandName}):`, err.stack || err.message);
  return safeReply(i, H.errorPayload('Có lỗi hệ thống. Dữ liệu của bạn vẫn an toàn — hãy thử lại sau giây lát.'));
}
function gate(i) {
  if (ctxBus.restoring) throw new GameError('Hệ thống đang khôi phục dữ liệu, vui lòng thử lại sau ít phút.', 'MAINT');
  const r = ratelimit.take(`u:${i.user.id}`, { capacity: 10, perSec: 1.5 }); if (!r.ok) throw new GameError(`Bạn thao tác quá nhanh, thử lại sau ${Math.ceil(r.retryMs / 1000)}s.`, 'RATE');
}
/** Hiển thị kết quả của act()/modal() lên tin nhắn tương tác. */
async function present(i, view, c, out, args) {
  out = out || {};
  if (out.handled) return null;
  if (out.modal) return i.showModal(out.modal);
  if (out.reply) return safeReply(i, typeof out.reply === 'string' ? { content: out.reply } : out.reply);
  if (out.payload) return i.update(H.finalize(out.payload));
  if (out.confirm) {
    const k = out.confirm; const e = K.embed({ title: '❓ Xác nhận', desc: k.text, color: K.COLOR.warn });
    return i.update(H.finalize(K.msg({ embeds: [e], components: K.rows([K.button({ id: K.cid('v', c.uid, ...k.yes), label: 'Xác nhận', style: 'danger', emoji: '✅' }), K.button({ id: K.cid('v', c.uid, ...k.no), label: 'Huỷ', style: 'secondary' })]) })));
  }
  const nextArgs = out.args !== undefined ? out.args : args;
  const payload = await view.render(c, nextArgs); return i.update(H.finalize(payload, out.notice));
}
async function onView(i, parts) {
  const [uid, name, act = 'show', ...rest] = parts;
  if (uid !== i.user.id) throw new GameError('Menu này thuộc về người khác. Hãy dùng lệnh `/` để mở menu của riêng bạn.', 'OWNER');
  const view = views[name]; if (!view) throw new GameError('Menu này đã cũ, hãy dùng lại lệnh.', 'STALE');
  H.ensureUser(i); const c = H.ctxOf(i); const args = rest.map((x) => (x === '' ? undefined : x));
  const out = act === 'show' ? { args } : await view.act(c, act, args, i);
  return present(i, view, c, out, args);
}
async function onModal(i, parts) {
  const [uid, name, act, ...rest] = parts; if (uid !== i.user.id) throw new GameError('Biểu mẫu này thuộc về người khác.', 'OWNER');
  const view = views[name]; if (!view || !view.modal) throw new GameError('Biểu mẫu đã cũ, hãy dùng lại lệnh.', 'STALE');
  H.ensureUser(i); const c = H.ctxOf(i); const f = { get: (id) => String(i.fields.getTextInputValue(id) ?? '') };
  const out = await view.modal(c, act, rest.map((x) => (x === '' ? undefined : x)), f);
  if (i.isFromMessage && i.isFromMessage()) return present(i, view, c, out, []);
  const payload = await view.render(c, out.args || []); return i.reply({ ...H.finalize(payload, out.notice), flags: K.EPHEMERAL });
}
/* ---- phiên câu cá ---- */
async function onSession(i, parts) {
  const [sid, nonce, action] = parts; const s0 = sessRepo.get(+sid);
  if (!s0 || s0.user_id !== i.user.id) throw new GameError('Đây không phải phiên câu của bạn.', 'OWNER');
  if (!SESSION_ACTIONS.has(action)) throw new GameError('Thao tác không hợp lệ.');
  let s;
  if (action === 'cancel') s = fishing.cancel(i.user.id, +sid);
  else if (s0.kind === 'boss' && action !== 'cancel') s = (action === 'hook') ? s0 : fishing.reel(i.user.id, +sid, nonce, action);
  else if (action === 'hook') s = fishing.hook(i.user.id, +sid, nonce); else s = fishing.reel(i.user.id, +sid, nonce, action);
  await i.update(H.finalize(fishingUI.render(s))); fishingUI.track(s, (p) => i.editReply(H.finalize(p)));
}
async function onQuick(i, parts) {
  const [uid, action, arg] = parts; if (uid !== i.user.id) throw new GameError('Nút này thuộc về người khác.', 'OWNER'); H.ensureUser(i);
  if (action === 'again') { const s = fishing.startCast(uid, { channelId: i.channelId }); await i.update(H.finalize(fishingUI.render(s))); fishingUI.track(s, (p) => i.editReply(H.finalize(p))); return; }
  if (action === 'boss') { const s = bossSvc.attack(uid, +arg, { channelId: i.channelId }); await i.update(H.finalize(fishingUI.render(s))); fishingUI.track(s, (p) => i.editReply(H.finalize(p))); return; }
  if (action === 'sell') { const r = shopSvc.sellFish(uid, { ids: [+arg] }); return safeReply(i, { content: `💰 Đã bán cá được **${F.xu(r.total)}**.` }); }
  if (action === 'lock') { const f = fishRepo.owned(uid, +arg); if (!f) throw new GameError('Không tìm thấy con cá (có thể đã bán).'); const v = f.locked ? 0 : 1; fishRepo.setLocked(uid, f.id, v); return safeReply(i, { content: v ? '🔒 Đã khoá cá này.' : '🔓 Đã mở khoá cá.' }); }
  throw new GameError('Nút đã cũ.', 'STALE');
}
/* ---- cổng vào ---- */
async function handle(i) {
  try {
    if (i.isAutocomplete?.()) { const cmd = commands.get(i.commandName); try { const r = cmd?.autocomplete ? await cmd.autocomplete(i) : []; return await i.respond((r || []).slice(0, 25)); } catch (e) { logger.debug(`autocomplete lỗi: ${e.message}`); try { return await i.respond([]); } catch { return null; } } }
    gate(i);
    return await withLock(`u:${i.user.id}`, async () => {
      if (i.isChatInputCommand?.()) { const cmd = commands.get(i.commandName); if (!cmd) throw new GameError('Lệnh không tồn tại.'); if (!cmd.skipEnsure) H.ensureUser(i); return cmd.execute(i); }
      if (i.isModalSubmit?.()) { const p = i.customId.split('|'); return p[0] === 'm' ? onModal(i, p.slice(1)) : (() => { throw new GameError('Biểu mẫu không hợp lệ.'); })(); }
      if (i.isButton?.() || i.isStringSelectMenu?.()) {
        const p = i.customId.split('|'); const t = p.shift();
        if (t === 'v') return onView(i, p); if (t === 'fs') return onSession(i, p); if (t === 'fa') return onQuick(i, p);
        const ext = require('./external'); if (ext[t]) return ext[t](i, p);
        throw new GameError('Nút này đã cũ.', 'STALE');
      }
      return null;
    });
  } catch (e) { return fail(i, e); }
}
module.exports = { handle, setCommands, onView, fail };
