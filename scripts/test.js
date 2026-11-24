'use strict';
/** Chạy toàn bộ kiểm thử (tests/*.test.js) và ghi báo cáo vào tests/REPORT.md. Dùng: node scripts/test.js [từ-khoá-lọc] */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'tests');
const H = require(path.join(dir, 'helpers'));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
const t0 = Date.now();
for (const f of files) require(path.join(dir, f));
H.run(process.argv[2]).then(({ results, pass, failN }) => {
  const groups = {}; for (const r of results) (groups[r.group] = groups[r.group] || []).push(r);
  let md = `# Báo cáo kiểm thử – Thiên Tông Fishing Bot\n\n- Thời điểm: ${new Date().toISOString()}\n- Node: ${process.version} · SQLite driver: ${H.db() ? H.db().driver?.name : '?'}\n- Kết quả: **${pass} đạt / ${failN} lỗi / ${results.length} tổng** (${((Date.now() - t0) / 1000).toFixed(1)} giây)\n\n`;
  for (const [g, rs] of Object.entries(groups)) { md += `## ${g}\n\n| | Kiểm thử | ms |\n|---|---|---|\n`; for (const r of rs) md += `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.ms.toFixed(0)} |\n`; md += '\n'; }
  if (failN) { md += '## Lỗi chi tiết\n\n'; for (const r of results.filter((x) => !x.ok)) md += `### ${r.group} › ${r.name}\n\`\`\`\n${r.err.stack}\n\`\`\`\n`; }
  if (!process.argv[2]) fs.writeFileSync(path.join(dir, 'REPORT.md'), md);
  for (const r of results.filter((x) => !x.ok)) console.log(`\n✖ ${r.group} › ${r.name}\n${r.err.stack.split('\n').slice(0, 6).join('\n')}`);
  console.log(`\n${pass} đạt, ${failN} lỗi / ${results.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(failN ? 1 : 0);
});
