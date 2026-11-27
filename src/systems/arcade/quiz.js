'use strict';
/**
 * Truy Tìm Linh Ngư – sinh câu đố từ chính dữ liệu cá của game (không có ngân hàng câu hỏi riêng nên luôn khớp dữ liệu hiện hành).
 * Mỗi câu: { k: loại, lv: độ khó 1–3, t: nội dung, o: 4 đáp án, a: chỉ số đáp án đúng, f?: id cá }.
 */
const { D } = require('../../services/gameData');
const rng = require('../../utils/rng');
const F = require('../../utils/format');

const cfg = () => D.arcade.quiz;
const pool = () => D.fishList.filter((f) => !f.bossOnly && !f.event && D.locations.has(f.location));
const CAT = { nuoc_ngot: 'Nước ngọt', vung_bang: 'Vùng băng', huyen_thoai: 'Huyền thoại', nuoc_man: 'Nước mặn', sinh_vat_than_thoai: 'Sinh vật thần thoại', co_dai: 'Cổ đại', sinh_vat_doc_nhat: 'Sinh vật độc nhất' };
const SLOT = { dawn: 'Bình minh', day: 'Ban ngày', dusk: 'Hoàng hôn', night: 'Ban đêm' };
const one = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const many = (arr, n, rnd) => rng.shuffle(arr, rnd).slice(0, n);
const uniq = (arr) => new Set(arr).size === arr.length;
/** Ghép đáp án đúng + 3 đáp án sai (đã khác nhau) rồi xáo trộn. */
function mk(k, lv, t, right, wrong, rnd, f) {
  const o = [right, ...wrong]; if (o.length !== 4 || !uniq(o)) return null;
  const sh = rng.shuffle(o, rnd); const q = { k, lv, t, o: sh, a: sh.indexOf(right) }; if (f) q.f = f; return q;
}
const rarName = (id) => D.rarities[id - 1].name;
const locName = (id) => D.locations.get(id).name;
const realLocs = () => D.locList.filter((l) => l.id !== 'event').map((l) => l.id);

/** Loại "tìm cực trị": chọn 4 loài có giá trị khác nhau đủ xa, đáp án = loài lớn nhất. */
function extreme(k, lv, label, val, gap, rnd, ps) {
  for (let tries = 0; tries < 30; tries++) {
    const four = many(ps, 4, rnd); const sorted = four.slice().sort((a, b) => val(b) - val(a));
    if (!(val(sorted[0]) >= val(sorted[1]) * (1 + gap) || val(sorted[0]) - val(sorted[1]) >= gap * 100)) continue;
    const r = mk(k, lv, label, sorted[0].name, sorted.slice(1).map((x) => x.name), rnd, sorted[0].id); if (r) return r;
  }
  return null;
}
const KINDS = {
  loc: { lv: 1, make: (rnd, ps) => { const f = one(ps, rnd); return mk('loc', 1, `Loài **${f.name}** sinh sống ở khu vực nào?`, locName(f.location), many(realLocs().filter((x) => x !== f.location), 3, rnd).map(locName), rnd, f.id); } },
  rarity: { lv: 1, make: (rnd, ps) => { const f = one(ps, rnd); return mk('rarity', 1, `Loài **${f.name}** thuộc phẩm cấp nào?`, rarName(f.rarity), many(D.rarities.filter((r) => r.id !== f.rarity), 3, rnd).map((r) => r.name), rnd, f.id); } },
  cat: { lv: 1, make: (rnd, ps) => { const f = one(ps, rnd); if (!CAT[f.category]) return null; return mk('cat', 1, `Loài **${f.name}** thuộc nhóm nào?`, CAT[f.category], many(Object.keys(CAT).filter((c) => c !== f.category), 3, rnd).map((c) => CAT[c]), rnd, f.id); } },
  fish_loc: { lv: 2, make: (rnd, ps) => { const loc = one(realLocs(), rnd); const right = one(ps.filter((f) => f.location === loc), rnd); if (!right) return null; return mk('fish_loc', 2, `Loài nào sống ở **${locName(loc)}**?`, right.name, many(ps.filter((f) => f.location !== loc), 3, rnd).map((f) => f.name), rnd, right.id); } },
  top_rarity: { lv: 2, make: (rnd, ps) => extreme('top_rarity', 2, 'Trong bốn loài, loài nào có **phẩm cấp cao nhất**?', (f) => f.rarity, 0.01, rnd, ps) },
  price: { lv: 2, make: (rnd, ps) => extreme('price', 2, 'Loài nào có **giá bán mỗi kg cao nhất**?', (f) => f.pricePerKg, 0.15, rnd, ps) },
  hard: { lv: 3, make: (rnd, ps) => extreme('hard', 3, 'Loài nào **khó câu nhất** (độ khó cao nhất)?', (f) => f.difficulty, 0.05, rnd, ps) },
  exp: { lv: 3, make: (rnd, ps) => extreme('exp', 3, 'Loài nào cho **nhiều EXP nhất** khi câu được?', (f) => f.exp, 0.2, rnd, ps) },
  maxw: { lv: 3, make: (rnd, ps) => {
    const f = one(ps, rnd); const right = F.kg(f.maxWeight); const mul = rng.shuffle([0.4, 0.6, 1.7, 2.6], rnd).slice(0, 3);
    return mk('maxw', 3, `Loài **${f.name}** nặng **tối đa** khoảng bao nhiêu?`, right, mul.map((m) => F.kg(f.maxWeight * m)), rnd, f.id);
  } },
  time: { lv: 3, make: (rnd, ps) => { const f = one(ps.filter((x) => x.times.length === 1), rnd); if (!f) return null; return mk('time', 3, `Loài **${f.name}** chỉ xuất hiện vào lúc nào?`, SLOT[f.times[0]], Object.keys(SLOT).filter((s) => s !== f.times[0]).map((s) => SLOT[s]), rnd, f.id); } },
};
const levelOf = (i) => { for (const l of cfg().levels) if (i < l.upTo) return l.level; return cfg().levels[cfg().levels.length - 1].level; };
const secondsOf = (lv) => Math.max(cfg().minSeconds, cfg().baseSeconds - 2 * (lv - 1));

function make(lv, rnd, ps, used) {
  const ids = Object.keys(KINDS).filter((k) => KINDS[k].lv === lv || (KINDS[k].lv === lv - 1 && rnd() < 0.3));
  for (let tries = 0; tries < 60; tries++) {
    const q = KINDS[one(ids, rnd)].make(rnd, ps); if (!q) continue;
    const sig = `${q.k}:${q.f || q.t}`; if (used.has(sig) || used.has(q.t)) continue; used.add(sig); used.add(q.t); q.lv = lv; return q;
  }
  throw new Error('Không sinh được câu đố');
}
function generate(rnd = rng.rand, n = cfg().perRound) {
  const ps = pool(); const used = new Set(); const out = [];
  for (let i = 0; i < n; i++) out.push(make(levelOf(i), rnd, ps, used));
  return out;
}
/** Điểm một câu trả lời đúng: cơ bản + độ khó + tốc độ + chuỗi đúng liên tiếp (streak = chuỗi SAU khi tính câu này). */
function scoreAnswer({ lv, elapsedMs, limitMs, streak }) {
  const P = cfg().points; const r = elapsedMs / limitMs;
  const speed = r <= 1 / 3 ? P.speedMax : r <= 0.55 ? Math.max(0, P.speedMax - 1) : r <= 0.8 ? Math.max(0, P.speedMax - 2) : 0;
  const stk = Math.min(P.streakMax, Math.max(0, streak - 1)) * P.streakStep;
  return { base: P.base + P.perLevel * lv, speed, streak: stk, total: P.base + P.perLevel * lv + speed + stk };
}
const roundBonus = (correct, total) => { const P = cfg().points; return correct >= total ? P.perfect : correct >= Math.ceil(total * 0.8) ? P.round8 : 0; };
module.exports = { generate, make, scoreAnswer, roundBonus, levelOf, secondsOf, KINDS, CAT, SLOT };
