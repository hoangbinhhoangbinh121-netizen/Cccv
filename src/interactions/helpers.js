'use strict';
const config = require('../config');
const userSvc = require('../services/userService');
const K = require('../ui/kit');
const { GameError } = require('../utils/errors');

const display = (i) => i.member?.displayName || i.user.globalName || i.user.username;
const ctxOf = (i) => ({ uid: i.user.id, name: display(i), i });
/** Người chơi phải đăng ký trước: tự đăng ký lần đầu dùng lệnh (kèm quà tân thủ). */
function ensureUser(i) { const r = userSvc.ensureReady(i.user.id, display(i)); return r; }
const isOwner = (i) => config.ownerIds.includes(i.user.id);
function isAdmin(i) {
  if (isOwner(i)) return true; const p = i.memberPermissions; if (p && p.has && p.has(8n)) return true;
  if (config.adminRoleId && i.member?.roles?.cache?.has?.(config.adminRoleId)) return true; return false;
}
function requireAdmin(i) { if (!isAdmin(i)) throw new GameError('Chỉ quản trị viên mới dùng được lệnh này.', 'PERM'); }
function requireOwner(i) {
  if (!config.ownerIds.length) throw new GameError('Chưa cấu hình `OWNER_IDS` trong .env nên lệnh nhạy cảm này đang bị khoá. Hãy thêm ID Discord của chủ bot rồi khởi động lại.', 'PERM');
  if (!isOwner(i)) throw new GameError('Chỉ **chủ bot** (OWNER_IDS) mới dùng được lệnh này.', 'PERM');
}
/** Gắn content/attachments chuẩn cho tin nhắn cập nhật. */
const finalize = (payload, notice) => ({ ...payload, content: notice || '', attachments: [] });
const errorPayload = (msg) => ({ embeds: [K.embed({ title: '⚠️ Không thực hiện được', desc: msg, color: K.COLOR.err })], components: [], flags: K.EPHEMERAL });
module.exports = { display, ctxOf, ensureUser, isOwner, isAdmin, requireAdmin, requireOwner, finalize, errorPayload };
