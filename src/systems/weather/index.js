'use strict';
const config = require('../../config');
const { D } = require('../../services/gameData');
const { mulberry32, hashStr } = require('../../utils/rng');
const SLOT_MS = 2 * 3600000;
const WEATHER = {
  nang: { name: 'Nắng', fx: {} },
  mua: { name: 'Mưa', fx: { biteSpeed: 12 } },
  bao: { name: 'Bão', fx: { rareBonus: 20, biteSpeed: -5 } },
  suong_mu: { name: 'Sương mù', fx: { rareBonus: 8 } },
  tuyet: { name: 'Tuyết', fx: { rareBonus: 6, biteSpeed: -8 } },
  cuc_quang: { name: 'Cực quang', fx: { rareBonus: 25 } },
};
const TIME = {
  dawn: { name: 'Bình minh', fx: { biteSpeed: 5 } }, day: { name: 'Ban ngày', fx: {} },
  dusk: { name: 'Hoàng hôn', fx: { biteSpeed: 5 } }, night: { name: 'Ban đêm', fx: { rareBonus: 5 } },
};
/** Thời tiết xác định theo (khu vực, khung 2 giờ) → ổn định sau khi khởi động lại; admin có thể ghi đè. */
function weatherAt(locId, ms, override = null) {
  if (override && override.until > ms) return override.weather;
  const loc = D.locations.get(locId); if (!loc) return 'nang';
  const r = mulberry32(hashStr(`${locId}:${Math.floor(ms / SLOT_MS)}`))();
  const entries = Object.entries(loc.weather); const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = r * total; for (const [k, w] of entries) { x -= w; if (x < 0) return k; } return entries[0][0];
}
function timeBand(ms) {
  const h = new Date(ms + config.tzOffsetHours * 3600000).getUTCHours();
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}
const nextChange = (ms) => (Math.floor(ms / SLOT_MS) + 1) * SLOT_MS;
module.exports = { WEATHER, TIME, weatherAt, timeBand, nextChange };
