'use strict';
const LV = { debug: 10, info: 20, warn: 30, error: 40 };
const min = LV[process.env.LOG_LEVEL || 'info'] || 20;
const ts = () => new Date().toISOString();
const out = (lv, args) => { if (LV[lv] >= min) (lv === 'error' ? console.error : console.log)(`[${ts()}] ${lv.toUpperCase()}`, ...args); };
module.exports = { debug: (...a) => out('debug', a), info: (...a) => out('info', a), warn: (...a) => out('warn', a), error: (...a) => out('error', a) };
