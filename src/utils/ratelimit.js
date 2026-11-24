'use strict';
/** Token bucket theo người chơi: chống spam lệnh/nút bấm. */
const buckets = new Map();
function take(key, { capacity = 8, perSec = 1.2 } = {}, nowMs = Date.now()) {
  let b = buckets.get(key);
  if (!b) { b = { tokens: capacity, at: nowMs }; buckets.set(key, b); }
  b.tokens = Math.min(capacity, b.tokens + ((nowMs - b.at) / 1000) * perSec); b.at = nowMs;
  if (b.tokens < 1) return { ok: false, retryMs: Math.ceil(((1 - b.tokens) / perSec) * 1000) };
  b.tokens -= 1; return { ok: true };
}
setInterval(() => { const cut = Date.now() - 600000; for (const [k, b] of buckets) if (b.at < cut) buckets.delete(k); }, 300000).unref();
module.exports = { take, reset: () => buckets.clear() };
