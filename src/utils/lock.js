'use strict';
/** Khoá bất đồng bộ theo khoá (userId, listingId…) – tuần tự hoá các thao tác của cùng một người chơi. */
const tails = new Map();
async function withLock(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  let release; const next = new Promise((r) => { release = r; });
  const mine = prev.then(() => next);
  tails.set(key, mine);
  await prev.catch(() => {});
  try { return await fn(); } finally { release(); if (tails.get(key) === mine) tails.delete(key); }
}
const withLocks = async (keys, fn) => { const ks = [...new Set(keys)].sort(); const run = (i) => (i >= ks.length ? fn() : withLock(ks[i], () => run(i + 1))); return run(0); };
module.exports = { withLock, withLocks, size: () => tails.size };
