'use strict';
/** Bối cảnh chạy chung: client Discord (nếu có), cờ bảo trì/khôi phục và bus thông báo để UI đăng ký. */
const listeners = {};
const ctx = {
  client: null,
  restoring: false,
  on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
  emit(evt, payload) { for (const fn of listeners[evt] || []) { try { fn(payload); } catch (e) { require('../utils/logger').warn(`listener ${evt} lỗi: ${e.message}`); } } },
  reset() { for (const k of Object.keys(listeners)) delete listeners[k]; },
};
module.exports = ctx;
