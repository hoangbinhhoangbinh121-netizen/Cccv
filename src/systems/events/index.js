'use strict';
/** Gộp hiệu ứng của các sự kiện đang diễn ra: cộng dồn bonus, nhân hệ số. */
function aggregate(active) {
  const out = { rareBonus: 0, biteSpeed: 0, expMult: 1, coinMult: 1, fishPool: [], names: [] };
  for (const ev of active) {
    const d = ev.data || {}; const m = d.modifiers || {};
    out.rareBonus += m.rareBonus || 0; out.biteSpeed += m.biteSpeed || 0; out.expMult *= m.expMult || 1; out.coinMult *= m.coinMult || 1;
    for (const f of d.fishPool || []) out.fishPool.push({ fishId: f, share: d.fishWeight || 5, eventId: ev.id });
    out.names.push(ev.name);
  }
  return out;
}
module.exports = { aggregate };
