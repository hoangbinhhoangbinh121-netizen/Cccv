'use strict';
const config = require('../config');
let clock = () => Date.now();
const now = () => clock();
const setClock = (fn) => { clock = fn || (() => Date.now()); };
const offsetMs = () => config.tzOffsetHours * 3600000;
const local = (ms = now()) => new Date(ms + offsetMs());
const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' theo múi giờ cấu hình */
const dayKey = (ms = now()) => { const d = local(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
/** Khoá tuần (thứ Hai là đầu tuần): 'YYYY-MM-DD' của ngày thứ Hai */
const weekKey = (ms = now()) => { const d = local(ms); const dow = (d.getUTCDay() + 6) % 7; return dayKey(ms - dow * 86400000); };
const hourOfDay = (ms = now()) => local(ms).getUTCHours();
const dayOfWeek = (ms = now()) => local(ms).getUTCDay();
/** mốc 0h (UTC ms) của ngày địa phương chứa ms */
const startOfDay = (ms = now()) => { const d = local(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - offsetMs(); };
const stamp = (ms = now()) => { const d = local(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = { now, setClock, dayKey, weekKey, hourOfDay, dayOfWeek, startOfDay, stamp, sleep };
