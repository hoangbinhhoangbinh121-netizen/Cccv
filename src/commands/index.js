'use strict';
/** Nạp mọi lệnh trong commands/<nhóm>/index.js (mỗi file export một lệnh hoặc mảng lệnh). */
const fs = require('fs');
const path = require('path');
function loadCommands() {
  const map = new Map();
  for (const dir of fs.readdirSync(__dirname, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of fs.readdirSync(path.join(__dirname, dir.name)).filter((x) => x.endsWith('.js') && x !== 'util.js')) {
      const exp = require(path.join(__dirname, dir.name, f)); for (const cmd of [].concat(exp)) { const n = cmd.data.name; if (map.has(n)) throw new Error(`Lệnh trùng tên: ${n}`); map.set(n, cmd); }
    }
  }
  return map;
}
module.exports = { loadCommands };
