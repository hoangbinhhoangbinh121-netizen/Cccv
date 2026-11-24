'use strict';
/** Bảng điều khiển sao lưu/khôi phục dùng trực tiếp trên Discord (/fishing-backup, /backupdb, /restore_db). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const K = require('../../ui/kit');
const H = require('../helpers');
const backup = require('../../database/backup');
const settings = require('../../database/repositories/settings');
const config = require('../../config');
const ctxBus = require('../../services/context');
const { GameError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { F, COLOR, cid } = K;

const KIND = { auto: '🤖 tự động', manual: '🖐️ thủ công', prerestore: '🛡️ trước khôi phục', premigrate: '🧱 trước nâng cấp DB', shutdown: '🔌 khi tắt bot' };
const PENDING = new Map(); // token → { file, by, at } – tệp .sqlite tải lên chờ xác nhận khôi phục
const TTL = 10 * 60000;
function sweep() { const t = Date.now(); for (const [k, v] of PENDING) if (t - v.at > TTL) { fs.rmSync(v.file, { force: true }); PENDING.delete(k); } }
function addPending(file, by) { sweep(); const token = crypto.randomBytes(4).toString('hex'); PENDING.set(token, { file, by, at: Date.now() }); return token; }

/* ------------------------------------------------------------------ BẢNG BACKUP */
const adminbk = {
  render(c, [page = '0', sel]) {
    H.requireAdmin(c.i); const list = backup.list(); const per = 8; const pages = Math.max(1, Math.ceil(list.length / per)); const p = Math.max(0, Math.min(pages - 1, +page)); const inf = backup.info(); const one = sel ? backup.resolve(sel) : null;
    let e; let comps = [];
    if (one) {
      e = K.embed({ title: `💾 ${one.file}`, color: COLOR.info, desc: `Loại: ${KIND[one.kind] || one.kind}${one.pinned ? ' · 📌 đã ghim' : ''}\nTạo lúc: ${F.abs(one.createdAt)} (${F.rel(one.createdAt)})\nDung lượng: **${F.bytes(one.bytes)}** (nén gzip)\nSố người chơi: **${one.users ?? '?'}** · Schema v${one.schema ?? '?'}\nSHA-256: \`${(one.sha256 || '—').slice(0, 16)}…\`${one.note ? `\nGhi chú: ${one.note}` : ''}${one.by ? `\nBởi: <@${one.by}>` : ''}` });
      comps = [K.button({ id: cid('v', c.uid, 'adminbk', 'dl', p, one.file), label: 'Tải về', emoji: '⬇️' }), K.button({ id: cid('v', c.uid, 'adminbk', 'verify', p, one.file), label: 'Kiểm tra', emoji: '🔍' }), K.button({ id: cid('v', c.uid, 'adminbk', 'pin', p, one.file), label: one.pinned ? 'Bỏ ghim' : 'Ghim', emoji: '📌' }), K.button({ id: cid('v', c.uid, 'adminbk', 'del', p, one.file), label: 'Xoá', style: 'danger', disabled: one.pinned, emoji: '🗑️' }), K.button({ id: cid('v', c.uid, 'restore', 'show', one.file), label: 'Khôi phục…', style: 'danger', emoji: '♻️' }), K.selectRow([K.button({ id: cid('v', c.uid, 'adminbk', 'show', p), label: '← Danh sách', emoji: '↩️' })])];
    } else {
      const total = backup.totalBytes(list);
      e = K.embed({ title: '💾 Sao lưu cơ sở dữ liệu', color: COLOR.info, desc: list.slice(p * per, p * per + per).map((b) => `${b.pinned ? '📌' : (KIND[b.kind] || b.kind).split(' ')[0]} \`${b.file.replace('fishing-', '').replace('.sqlite.gz', '')}\` · ${F.bytes(b.bytes)} · ${F.rel(b.createdAt)}`).join('\n') || '*Chưa có bản sao lưu nào.*',
        fields: [{ name: 'Tự động', value: `${inf.enabled ? '✅ Bật' : '⛔ Tắt'} · mỗi **${inf.intervalMin}** phút${inf.nextAt ? ` · lần tới ${F.rel(inf.nextAt)}` : ''}\nLần cuối: ${inf.lastResult ? F.rel(inf.lastResult.createdAt) : '—'}${inf.lastError ? `\n⚠️ Lỗi gần nhất: ${inf.lastError}` : ''}`, inline: true }, { name: 'Dọn dẹp tự động', value: `Giữ ${settings.get('backup_keep_auto')} bản tự động mới nhất + 1 bản/ngày trong ${settings.get('backup_max_age_days')} ngày\nGiữ ${settings.get('backup_keep_manual')} bản thủ công · tối đa ${settings.get('backup_max_total_mb')} MB`, inline: true }, { name: 'Hiện có', value: `${list.length} bản · ${F.bytes(total)}`, inline: true }],
        footer: 'Chỉnh chu kỳ/số lượng giữ lại bằng /fishing-config' });
      comps = [K.button({ id: cid('v', c.uid, 'adminbk', 'create', p), label: 'Sao lưu ngay', style: 'success', emoji: '💾' }), K.button({ id: cid('v', c.uid, 'adminbk', 'prune', p), label: 'Dọn bản cũ', emoji: '🧹' }), K.button({ id: cid('v', c.uid, 'adminbk', 'toggle', p), label: inf.enabled ? 'Tắt tự động' : 'Bật tự động', emoji: '⏱️' }), K.selectRow(K.pager(c.uid, 'adminbk', 'pg', p, pages))];
      const slice = list.slice(p * per, p * per + per); if (slice.length) comps.push(K.select({ id: cid('v', c.uid, 'adminbk', 'sel', p), placeholder: 'Chọn một bản sao lưu…', options: slice.map((b) => ({ label: b.file.replace('fishing-', '').replace('.sqlite.gz', ''), value: b.file, description: `${F.bytes(b.bytes)} · ${b.users ?? '?'} người chơi${b.pinned ? ' · ghim' : ''}` })) }));
    }
    return K.msg({ embeds: [e], components: K.rows(comps) });
  },
  async act(c, act, [a1, a2], i) {
    H.requireAdmin(i);
    if (act === 'pgp') return { args: [a1] }; if (act === 'sel') return { args: [a1, i.values[0]] };
    if (act === 'create') { await i.deferUpdate(); const r = await backup.create({ kind: 'manual', by: c.uid, note: 'tạo từ Discord' }); const p = await adminbk.render(c, ['0']); await i.editReply(H.finalize(p, `✅ Đã tạo \`${r.file}\` (${F.bytes(r.bytes)}, ${r.users} người chơi).`)); return { handled: true }; }
    if (act === 'prune') { const r = backup.prune(); return { notice: `🧹 Đã xoá ${r.deleted.length} bản cũ, giải phóng ${F.bytes(r.freed)}.`, args: [a1] }; }
    if (act === 'toggle') { const v = settings.get('backup_auto_enabled') ? 0 : 1; settings.set('backup_auto_enabled', v); settings.log(c.uid, 'config', 'backup_auto_enabled', String(v)); return { notice: v ? '✅ Đã bật backup tự động.' : '⛔ Đã tắt backup tự động.', args: [a1] }; }
    if (act === 'pin') { const e = backup.resolve(a2); backup.pin(a2, !e.pinned); return { notice: e.pinned ? 'Đã bỏ ghim.' : '📌 Đã ghim — bản này sẽ không bị tự dọn.', args: [a1, a2] }; }
    if (act === 'del') return { confirm: { text: `Xoá vĩnh viễn \`${a2}\`?`, yes: ['adminbk', 'delyes', a1, a2], no: ['adminbk', 'show', a1, a2] } };
    if (act === 'delyes') { backup.remove(a2); settings.log(c.uid, 'backup_delete', a2, ''); return { notice: '🗑️ Đã xoá bản sao lưu.', args: [a1] }; }
    if (act === 'verify') { await i.deferUpdate(); const v = await backup.verify(a2); if (v.candidate) fs.rmSync(v.candidate, { force: true }); const p = await adminbk.render(c, [a1, a2]); await i.editReply(H.finalize(p, v.ok ? `✅ Hợp lệ: toàn vẹn dữ liệu OK · ${v.info.users} người chơi · schema v${v.info.schema}.` : `❌ Không hợp lệ: ${v.reasons.join('; ')}`)); return { handled: true }; }
    if (act === 'dl') { const e = backup.resolve(a2); const full = path.join(config.backupDir, e.file); if (e.bytes > 24 * 1024 * 1024) return { reply: `Tệp ${F.bytes(e.bytes)} vượt giới hạn tải của Discord. Lấy trực tiếp trên máy chủ: \`${full}\`` }; return { reply: { content: `⬇️ \`${e.file}\``, files: [{ attachment: full, name: e.file }] } }; }
    return undefined;
  },
};
/* ------------------------------------------------------------------ KHÔI PHỤC */
const CONFIRM_CODE = 'KHOI PHUC';
const restore = {
  async render(c, [source]) {
    H.requireOwner(c.i); if (!source) throw new GameError('Chưa chọn bản sao lưu.');
    const pend = source.startsWith('up:') ? PENDING.get(source.slice(3)) : null; if (source.startsWith('up:') && !pend) throw new GameError('Tệp tải lên đã hết hạn (10 phút). Hãy chạy lại `/restore_db`.');
    const v = await backup.verify(pend ? pend.file : source); if (v.candidate) fs.rmSync(v.candidate, { force: true });
    const now = require('../../database/connection').state.db; const cur = now.value('SELECT COUNT(*) FROM users');
    const lines = v.ok ? [`✅ Kiểm tra: **hợp lệ** (toàn vẹn dữ liệu OK${v.entry?.sha256 ? ', checksum khớp' : ''}).`, `Bản sao lưu: **${v.info.users}** người chơi · schema v${v.info.schema}`, `Hiện tại: **${cur}** người chơi`] : [`❌ **Không thể khôi phục:** ${v.reasons.join('; ')}`];
    const e = K.embed({ title: '♻️ Khôi phục cơ sở dữ liệu', color: v.ok ? COLOR.warn : COLOR.err, desc: `Nguồn: \`${v.file}\`\n\n${lines.join('\n')}\n\n⚠️ **Toàn bộ dữ liệu hiện tại sẽ bị thay bằng bản sao lưu.** Bot tạm dừng nhận lệnh trong lúc khôi phục.\nBot tự tạo bản **trước khi khôi phục** và tự hoàn tác nếu có lỗi.` });
    return K.msg({ embeds: [e], components: K.rows([K.button({ id: cid('v', c.uid, 'restore', 'go', source), label: 'Khôi phục (nhập mã xác nhận)', style: 'danger', disabled: !v.ok, emoji: '♻️' }), K.button({ id: cid('v', c.uid, 'restore', 'cancel', source), label: 'Huỷ', style: 'secondary' })]) });
  },
  act(c, act, [source], i) {
    H.requireOwner(i);
    if (act === 'cancel') { if (source?.startsWith('up:')) { const p = PENDING.get(source.slice(3)); if (p) fs.rmSync(p.file, { force: true }); PENDING.delete(source.slice(3)); } return { payload: K.msg({ embeds: [K.embed({ title: 'Đã huỷ khôi phục.', color: COLOR.dark })], components: [] }) }; }
    if (act === 'go') return { modal: K.modal({ id: cid('m', c.uid, 'restore', 'run', source), title: 'Xác nhận khôi phục', fields: [{ id: 'code', label: `Gõ ${CONFIRM_CODE} để xác nhận`, placeholder: CONFIRM_CODE, max: 20 }] }) };
    return undefined;
  },
  async modal(c, act, [source], f) {
    H.requireOwner(c.i); if (f.get('code').trim().toUpperCase() !== CONFIRM_CODE) throw new GameError(`Mã xác nhận sai (cần gõ đúng "${CONFIRM_CODE}"). Chưa có gì bị thay đổi.`);
    const pend = source.startsWith('up:') ? PENDING.get(source.slice(3)) : null; const src = pend ? pend.file : source; if (source.startsWith('up:') && !pend) throw new GameError('Tệp tải lên đã hết hạn.');
    await c.i.deferUpdate(); ctxBus.restoring = true;
    try {
      const r = await backup.restore(src, { by: c.uid }); settings.log(c.uid, 'restore', r.from, `${r.before.users}→${r.after.users} người chơi`);
      if (pend) { fs.rmSync(pend.file, { force: true }); PENDING.delete(source.slice(3)); }
      await c.i.editReply(H.finalize(K.msg({ embeds: [K.embed({ title: '✅ Khôi phục thành công', color: COLOR.ok, desc: `Nguồn: \`${r.from}\`\nNgười chơi: ${r.before.users} → **${r.after.users}**\nBản an toàn trước khôi phục: \`${r.safety}\`${r.migrated?.length ? `\nĐã nâng cấp schema: ${r.migrated.join(', ')}` : ''}\n\nCác phiên câu đang dở đã được huỷ và hoàn mồi.` })], components: [] })));
    } catch (e) { logger.error('Khôi phục lỗi:', e.message); await c.i.editReply(H.finalize(K.msg({ embeds: [K.embed({ title: '❌ Khôi phục thất bại', color: COLOR.err, desc: e.message })], components: [] }))); }
    finally { ctxBus.restoring = false; }
    return { handled: true };
  },
};
module.exports = { adminbk, restore, addPending, PENDING };
