'use strict';
/**
 * Ngư Trường Giải Trí – các màn hình (view). Mỗi view có frame(c,args) → { payload, next }:
 * payload dựng từ DB + giờ máy chủ; next = ms tới khung hoạt ảnh kế (null = tĩnh). render() = frame().payload.
 * afterShow() khởi động bộ hẹn giờ cập nhật tin nhắn (router gọi sau khi gửi khung đầu).
 */
const K = require('../../ui/kit');
const U = require('../../ui/arcadeUI');
const svc = require('../../services/arcadeService');
const repo = require('../../database/repositories/arcade');
const { D } = require('../../services/gameData');
const dice = require('../../systems/arcade/dice');
const race = require('../../systems/arcade/race');
const R = require('../../systems/rarity');
const { GameError } = require('../../utils/errors');
const { now } = require('../../utils/time');
const { F, cid } = K;
const { E, B } = U;
const A = () => D.arcade;
const TRAIT_ICON = { nuoc_rut: 'trait_sprint', ben_bi: 'trait_endure', khoi_dau: 'trait_burst', may_man: 'trait_lucky', an_minh: 'trait_stealth', that_thuong: 'trait_wild' };
const fishName = (id) => D.fishes.get(id).name;
const fishE = (id) => K.E('fish', id);
const hexInt = (h) => parseInt(String(h).replace('#', ''), 16);
const btn = (uid, view, act, args, o) => K.button({ id: cid('v', uid, view, act, ...args), ...o });
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const img = (id, name) => K.img('arcade', id, name);

/** Gắn hàm tiện ích chung cho view: render/afterShow dựa trên frame(). */
function make(name, frame, act, extra = {}) {
  const v = {
    frame, act, ...extra,
    render(c, args = []) { U.stop(c.uid); return frame(c, args).payload; },
    afterShow(c, args, edit) { U.track(c.uid, edit, () => frame(c, args)); },
  };
  v.name = name; return v;
}
const stopFirst = (c) => U.stop(c.uid);

/* =================================================================== SẢNH */
function hubFrame(c, [mode]) {
  const uid = c.uid; const sm = svc.summary(uid); const a = A();
  if (mode === 'help') return { payload: helpPayload(uid) };
  const rk = sm.rank; const left = sm.left;
  const e = K.embed({
    title: `${E('hub_logo')} NGƯ TRƯỜNG GIẢI TRÍ`, color: U.COLOR.hub,
    desc: `Chơi vui, thắng **Linh Điểm** — *không cược xu, không mất tài sản.*\n${a.currency.note}`,
    fields: [
      { name: `${E('hub_points')} Hôm nay`, value: `**${F.num(sm.today)}** / ${F.num(sm.cap)} LĐ\n${U.pbar(sm.today, sm.cap, 12)}`, inline: true },
      { name: `${E('hub_rank')} Cấp bậc`, value: `**${rk.name}** · ${F.num(rk.life)} LĐ\n${rk.next ? `${U.pbar(rk.into, rk.span, 12)}\nCòn ${F.num(rk.need - rk.life)} LĐ → ${rk.next.name}` : '👑 Cấp cao nhất'}`, inline: true },
      { name: `${E('hub_board')} Tuần · Mùa ${sm.seasonKey}`, value: `Tuần: **${F.num(sm.week)}** LĐ\nMùa: **${F.num(sm.season)}** LĐ`, inline: true },
      { name: 'Lượt còn lại hôm nay', value: `${E('race_game')} Đua: **${left.race}**/${a.limits.race} · ${E('dice_game')} Xúc xắc: **${left.dice}**/${a.limits.dice}\n${E('quiz_game')} Đố: **${left.quiz}**/${a.limits.quiz} · ${E('box_game')} Hộp: **${left.box.reduce((x, y) => x + y, 0)}** lượt`, inline: false },
      sm.claimable ? { name: `${E('hub_claim')} Nhiệm vụ`, value: `Có **${sm.claimable}** nhiệm vụ đã xong — vào *Nhiệm vụ* để nhận thưởng!` } : null,
      (sm.active.race || sm.active.quiz) ? { name: '▶️ Đang chơi dở', value: [sm.active.race && `${E('race_game')} Cuộc đua đang chờ bạn`, sm.active.quiz && `${E('quiz_game')} Vòng đố đang chạy`].filter(Boolean).join('\n') } : null,
    ].filter(Boolean),
    footer: 'Điểm giải trí là điểm riêng — không đổi sang xu, không ảnh hưởng câu cá/kinh tế.',
  });
  const game = (view, label, ic) => btn(uid, view, 'show', [], { label, emoji: B(ic), style: 'primary' });
  return { payload: K.msg({ embeds: [e], components: K.rows([
    game('ngrace', 'Đoán Ngư Vương', 'race_game'), game('ngdice', 'Tài Xỉu', 'dice_game'), game('ngbox', 'Bí Hộp', 'box_game'), game('ngquiz', 'Truy Tìm', 'quiz_game'),
    K.selectRow([btn(uid, 'ngrank', 'show', [], { label: 'Xếp hạng', emoji: B('hub_board') }), btn(uid, 'ngme', 'show', ['mission'], { label: sm.claimable ? `Nhiệm vụ (${sm.claimable})` : 'Nhiệm vụ', emoji: B('hub_mission'), style: sm.claimable ? 'success' : 'secondary' }), btn(uid, 'ngme', 'show', ['ach'], { label: 'Thành tích', emoji: B('hub_ach') }), btn(uid, 'ngme', 'show', ['stats'], { label: 'Thống kê', emoji: B('hub_stats') }), btn(uid, 'ng', 'help', [], { label: 'Hướng dẫn', emoji: B('hub_help') })]),
  ]) }) };
}
function helpPayload(uid) {
  const a = A(); const P = a.race.points; const Q = a.quiz.points; const Dp = a.dice.points;
  const e = K.embed({
    title: `${E('hub_help')} Hướng dẫn Ngư Trường`, color: U.COLOR.hub,
    desc: `**Linh Điểm** là điểm giải trí riêng (tối đa **${a.dailyCap}** LĐ/ngày từ các trò chơi). Lên cấp bậc để mở hộp xịn hơn và leo bảng xếp hạng tuần/mùa. **Không có cược xu hay vật phẩm.**`,
    fields: [
      { name: `${E('race_game')} Đoán Ngư Vương`, value: `4–6 chú cá có Tốc/Bền/May và 1 đặc tính. Chọn cá bạn nghĩ sẽ thắng rồi bấm Xuất phát — đua ${a.race.rounds} vòng.\nĐoán đúng: **${P.win}** LĐ + thưởng "ngựa ô" (tới ${P.underdogMax}) + chuỗi. Vào top 3: ${P.podium} LĐ. Tối đa ${a.limits.race} cuộc/ngày.` },
      { name: `${E('dice_game')} Tài Xỉu Linh Vận`, value: `3 xúc xắc: **3–10 = Xỉu**, **11–18 = Tài**. Đoán đúng: **${Dp.win}** LĐ (+chuỗi). Chọn **Bão** (3 viên giống nhau) trúng được **${Dp.bao}** LĐ. Tối đa ${a.limits.dice} lượt/ngày.` },
      { name: `${E('box_game')} Linh Bảo Bí Hộp`, value: `Mở hộp miễn phí để sưu tầm ${a.box.items.length} Linh Bảo (6 phẩm) và nhận LĐ. 5 bậc hộp mở khoá theo cấp bậc, có **bảo hiểm may mắn** sau vài lần không ra phẩm tốt. Trùng thì quy đổi nửa điểm.` },
      { name: `${E('quiz_game')} Truy Tìm Linh Ngư`, value: `${a.quiz.perRound} câu đố từ chính dữ liệu cá, 4 đáp án, có giới hạn thời gian, càng về sau càng khó. Đúng được ${Q.base}+ LĐ/câu (+nhanh, +chuỗi); ≥80% đúng +${Q.round8}, tuyệt đối +${Q.perfect}. Tối đa ${a.limits.quiz} vòng/ngày.` },
      { name: `${E('hub_rank')} Cấp bậc`, value: a.ranks.map((r) => `**${r.name}** ≥ ${F.num(r.need)} LĐ`).join(' · ') },
      { name: 'Lệnh nhanh', value: '`/ngutruong` hoặc `.ngutruong` (`.nt`) · `.dua` · `.taixiu` · `.bihop` · `.quiz` · `.xephang` · `.nvgt` (nhiệm vụ)' },
    ],
  });
  return K.msg({ embeds: [e], components: K.rows([btn(uid, 'ng', 'show', [], { label: 'Về sảnh', emoji: B('hub_logo'), style: 'primary' })]) });
}
const ng = make('ng', hubFrame, (c, act) => { stopFirst(c); if (act === 'help') return { args: ['help'] }; return { args: [] }; });

/* =================================================================== ĐOÁN NGƯ VƯƠNG */
function raceIntro(c, notice) {
  const uid = c.uid; const st = svc.stats(uid).race; const left = svc.limitLeft(uid, 'race'); const hist = repo.histRecent(uid, 'race', 5);
  const e = K.embed({
    title: `${E('race_game')} Đoán Ngư Vương`, color: U.COLOR.race,
    desc: `Mỗi cuộc đua có **4–6 chú cá** với Tốc độ ${E('race_speed')}, Thể lực ${E('race_stamina')}, May mắn ${E('race_luck')} và một **đặc tính** riêng. Chọn cá bạn tin sẽ về nhất, bấm **Xuất phát** và xem ${A().race.rounds} vòng đua!\nKết quả do máy chủ quyết định lúc xuất phát — không thể thay đổi.`,
    fields: [
      { name: 'Hôm nay', value: `Còn **${left}**/${A().limits.race} cuộc`, inline: true },
      { name: 'Thành tích', value: `Đoán đúng **${st.wins}**/${st.plays} (${pct(st.wins, st.plays)})\nChuỗi: ${st.streak} · Kỷ lục: ${st.best_streak}`, inline: true },
      hist.length ? { name: 'Gần đây', value: hist.map((h) => `${U.medal(h.detail.rank)} ${fishE(h.detail.field[h.detail.pick])} ${fishName(h.detail.field[h.detail.pick])} — ${h.detail.won ? '🎉 đúng' : `hạng ${h.detail.rank}`} · +${h.points} LĐ`).join('\n') } : null,
    ].filter(Boolean),
  });
  return K.msg({ embeds: [e], content: notice, components: K.rows([btn(uid, 'ngrace', 'open', [], { label: 'Vào đường đua', emoji: B('race_start'), style: 'success', disabled: left <= 0 }), U.navRow(uid, 'race')]) });
}
function racerField(s, k, { odds, pick, fav }) {
  const x = s.data.field[k]; const f = D.fishes.get(x.id); const tr = race.traitInfo(x.trait);
  return { name: `${k + 1}. ${fishE(x.id)} ${f.name} ${R.mark(f.rarity)}${fav === k ? ` ${E('race_fav')}` : ''}${pick === k ? ' ◀ BẠN CHỌN' : ''}`,
    value: `${E('race_speed')} ${x.speed}  ${E('race_stamina')} ${x.stamina}  ${E('race_luck')} ${x.luck}\n${E(TRAIT_ICON[x.trait])} **${tr.name}** — ${tr.desc}\nƯớc tính thắng: **${Math.round(odds[k] * 100)}%**` };
}
function raceFrame(c, [sid]) {
  const uid = c.uid; let s = null;
  try { if (sid) s = svc.raceGet(uid, sid); else { const cur = repo.sessionActive(uid, 'race'); if (cur) s = svc.raceAdvance(cur.id); } } catch (e) { if (!(e instanceof GameError)) throw e; }
  if (!s) return { payload: raceIntro(c) };
  const d = s.data; const nav = U.navRow(uid, 'race');
  if (s.phase === 'pick' || (s.status !== 'active' && !d.result)) {
    if (s.status !== 'active') return { payload: raceIntro(c, '⌛ Trường đua đã đóng vì bạn không chọn kịp — hãy mở lại.') };
    const fav = d.odds.indexOf(Math.max(...d.odds));
    const e = K.embed({ title: `${E('race_game')} Trường đua — chọn nhà vô địch`, color: U.COLOR.race, desc: `${d.field.length} chú cá đang vào vạch xuất phát. Chọn một chú rồi bấm **Xuất phát**.\n${E('race_fav')} = cá có ước tính thắng cao nhất · "ngựa ô" càng thấp, thưởng đoán đúng càng lớn.`, fields: d.field.map((_, k) => racerField(s, k, { odds: d.odds, pick: d.pick, fav })), footer: 'Chọn xong là chốt — hạn chọn 3 phút.' });
    const menu = K.select({ id: cid('v', uid, 'ngrace', 'pick', s.id), placeholder: d.pick == null ? 'Chọn cá bạn đặt niềm tin…' : 'Đổi lựa chọn…', options: d.field.map((x, k) => ({ label: `${k + 1}. ${fishName(x.id)}`, value: String(k), description: `Tốc ${x.speed} · Bền ${x.stamina} · May ${x.luck} · ${race.traitInfo(x.trait).name}`, emoji: K.emoji.btn('fish', x.id), default: d.pick === k })) });
    return { payload: K.msg({ embeds: [e], components: K.rows([menu, btn(uid, 'ngrace', 'go', [s.id], { label: 'Xuất phát!', emoji: B('race_start'), style: 'success', disabled: d.pick == null }), btn(uid, 'ngrace', 'cancel', [s.id], { label: 'Huỷ', style: 'secondary' }), nav]) }) };
  }
  /* đang chạy / đã xong */
  const RN = A().race.rounds; const rms = A().race.roundMs; const t = now(); const stage = Math.max(0, Math.min(RN, Math.floor((t - d.startAt) / rms)));
  const res = d.result; const maxFin = Math.max(...res.final); const files = []; let thumb = null; let next = null;
  const lead = stage > 0 ? res.cum[stage - 1].indexOf(Math.max(...res.cum[stage - 1])) : -1; let body;
  if (stage < RN) {
    body = d.field.map((x, k) => `${fishE(x.id)} **${fishName(x.id).slice(0, 18)}** ${U.pbar(stage ? res.cum[stage - 1][k] : 0, maxFin, 12)}${k === lead ? ` ${E('medal_1')}` : ''}${d.pick === k ? ' ◀' : ''}`).join('\n');
    next = d.startAt + (stage + 1) * rms - t + 60;
  } else {
    body = res.order.map((k, r) => `${U.medal(r + 1)} ${fishE(d.field[k].id)} **${fishName(d.field[k].id)}** — ${res.final[k].toFixed(1)}${d.pick === k ? ' ◀ BẠN' : ''}`).join('\n');
    const wf = K.img('fish', d.field[res.order[0]].id, 'winner'); if (wf) { files.push(wf.file); thumb = wf.url; }
  }
  const finished = s.status !== 'active'; const rw = d.reward;
  let foot = '';
  if (stage === RN) {
    if (finished && rw) foot = `\n\n${rw.won ? `🎉 **Đoán chuẩn Ngư Vương!** ${rw.underdog ? '(Ngựa ô!) ' : ''}` : `Cá bạn chọn về **hạng ${rw.rank}**. `}\n${U.pointsLine(rw.applied, rw.requested)}${U.notesText(rw.notes)}`;
    else { foot = '\n\n⏳ Đang chốt kết quả…'; next = svc.raceDueAt(s) - t + 80; }
  }
  const e = K.embed({ title: `${E('race_game')} Cuộc đua Ngư Vương — ${stage < RN ? `Vòng ${Math.max(1, stage + 1)}/${RN}` : `${E('race_finish')} Về đích`}`, color: U.COLOR.race, desc: `${stage === 0 ? '🚩 Xuất phát!\n\n' : ''}${body}${foot}`, thumb, footer: `Cuộc đua #${s.id}` });
  const comps = finished ? K.rows([btn(uid, 'ngrace', 'open', [], { label: 'Cuộc đua mới', emoji: B('race_start'), style: 'success', disabled: svc.limitLeft(uid, 'race') <= 0 }), btn(uid, 'ngrace', 'show', [s.id], { label: 'Làm mới', emoji: B('ui_refresh') }), nav]) : K.rows([btn(uid, 'ngrace', 'show', [s.id], { label: 'Làm mới', emoji: B('ui_refresh') }), nav]);
  return { payload: K.msg({ embeds: [e], components: comps, files }), next: finished ? null : next };
}
const ngrace = make('ngrace', raceFrame, (c, act, [a1], i) => {
  stopFirst(c);
  if (act === 'open') { const s = svc.raceOpen(c.uid); return { args: [String(s.id)] }; }
  if (act === 'pick') { const s = svc.racePick(c.uid, +a1, Number(i.values[0])); return { args: [String(s.id)] }; }
  if (act === 'go') { const s = svc.raceStart(c.uid, +a1); return { args: [String(s.id)] }; }
  if (act === 'cancel') { svc.raceCancel(c.uid, +a1); return { args: [] }; }
  return { args: a1 ? [a1] : [] };
});

/* =================================================================== TÀI XỈU */
const dieE = (n) => E(`die_${n}`);
function diceFrame(c, [mode, hid]) {
  const uid = c.uid; const a = A().dice; const left = svc.limitLeft(uid, 'dice'); const st = svc.stats(uid).dice;
  const h = mode === 'h' && hid ? repo.histGet(uid, +hid) : null; const t = now();
  const stage = h ? Math.min(3, Math.floor((t - h.detail.at) / a.stageMs)) : 3; const animating = h && stage < 3;
  const hist = svc.diceHistory(uid, a.history + 1).slice(h && animating ? 1 : 0, (h && animating ? 1 : 0) + a.history);
  const histText = hist.length ? hist.map((x) => `${x.detail.bao ? E('dice_bao') : E(x.detail.side === 'tai' ? 'dice_tai' : 'dice_xiu')}${x.detail.sum}`).join(' ') : '*Chưa có ván nào*';
  let rowText; let result = '';
  if (!h) rowText = `${E('dice_cup')}  ${E('die_q')} ${E('die_q')} ${E('die_q')}`;
  else { const dd = h.detail.dice; rowText = `${stage === 0 ? E('dice_cup') : E('dice_game')}  ${[0, 1, 2].map((k) => (k < stage ? dieE(dd[k]) : E('die_q'))).join(' ')}`; }
  if (h && stage >= 3) {
    const x = h.detail; const side = x.side === 'tai' ? 'TÀI' : 'XỈU';
    result = `\n\n**Tổng ${x.sum}** → ${E(x.side === 'tai' ? 'dice_tai' : 'dice_xiu')} **${side}**${x.bao ? ` · ${E('dice_bao')} **BÃO ${x.dice[0]}!**` : ''}\nBạn chọn **${dice.NAME[x.pick]}** → ${x.win ? `${E('quiz_ok')} **Đoán đúng!**` : `${E('quiz_no')} Chưa trúng`}\n${U.pointsLine(x.applied, x.requested)}${U.notesText(x.notes)}`;
  } else if (h) result = '\n\n*Đang lắc xúc xắc…*';
  const e = K.embed({
    title: `${E('dice_game')} Tài Xỉu Linh Vận`, color: h && stage >= 3 ? (h.detail.win ? K.COLOR.ok : K.COLOR.warn) : U.COLOR.dice,
    desc: `Đoán tổng 3 xúc xắc: ${E('dice_xiu')} **Xỉu** 3–10 · ${E('dice_tai')} **Tài** 11–18 · ${E('dice_bao')} **Bão** (3 viên giống nhau).\n*Chỉ là trò đoán vui lấy Linh Điểm — không cược xu hay vật phẩm.*\n\n${rowText}${result}`,
    fields: [{ name: 'Chuỗi đúng', value: `${animating ? st.streak : st.streak} (kỷ lục ${st.best_streak})`, inline: true }, { name: 'Còn hôm nay', value: `${left}/${A().limits.dice} lượt`, inline: true }, { name: `Lịch sử ${hist.length} ván gần nhất`, value: histText }],
  });
  const off = !!animating || left <= 0;
  const row = K.rows([btn(uid, 'ngdice', 'roll', ['xiu'], { label: 'Xỉu', emoji: B('dice_xiu'), style: 'primary', disabled: off }), btn(uid, 'ngdice', 'roll', ['bao'], { label: 'Bão', emoji: B('dice_bao'), style: 'danger', disabled: off }), btn(uid, 'ngdice', 'roll', ['tai'], { label: 'Tài', emoji: B('dice_tai'), style: 'success', disabled: off }), U.navRow(uid, 'dice')]);
  return { payload: K.msg({ embeds: [e], components: row }), next: animating ? h.detail.at + (stage + 1) * a.stageMs - t + 40 : null };
}
const ngdice = make('ngdice', diceFrame, (c, act, [a1]) => {
  stopFirst(c);
  if (act === 'roll') { const r = svc.diceRoll(c.uid, a1); return { args: ['h', String(r.id)] }; }
  return { args: [] };
});

/* =================================================================== BÍ HỘP */
function boxMain(c) {
  const uid = c.uid; const tiers = svc.boxTiers(uid); const rk = svc.rankOfUser(uid);
  const e = K.embed({
    title: `${E('box_game')} Linh Bảo Bí Hộp`, color: U.COLOR.box,
    desc: `Mở hộp **miễn phí** để sưu tầm **${A().box.items.length} Linh Bảo** (6 phẩm) và nhận Linh Điểm. Hộp xịn mở khoá theo cấp bậc (bạn: **${rk.name}**).\nBấm **Tỉ lệ** để xem xác suất từng phẩm — không có gì ẩn.`,
    fields: tiers.map((t) => ({ name: `${t.unlocked ? E(`box_${t.id}`) : E('box_lock')} ${t.name}`, value: t.unlocked ? `Còn **${t.left}**/${t.daily} lượt hôm nay${t.pity.after ? `\n${E('box_pity')} Bảo hiểm: tối đa ${t.pity.after} lần là ra phẩm ${A().box.grades[t.pity.grade - 1].name}+` : ''}` : `🔒 Mở khoá ở cấp **${A().ranks[t.rank - 1].name}**`, inline: true })),
  });
  const open = tiers.map((t) => btn(uid, 'ngbox', 'open', [t.id], { label: t.name.replace('Hộp ', ''), emoji: t.unlocked ? B(`box_${t.id}`) : B('box_lock'), style: 'primary', disabled: !t.unlocked || t.left <= 0 }));
  return { payload: K.msg({ embeds: [e], components: K.rows([...open, K.selectRow([btn(uid, 'ngbox', 'rates', ['1'], { label: 'Tỉ lệ', emoji: B('hub_help') }), btn(uid, 'ngme', 'show', ['bag'], { label: 'Bộ sưu tập', emoji: B('grade_3') }), btn(uid, 'ngbox', 'hist', [], { label: 'Lịch sử', emoji: B('hub_stats') })]), U.navRow(uid, 'box')]) }) };
}
function boxRates(c, tierId) {
  const uid = c.uid; const t = A().box.tiers.find((x) => x.id === +tierId) || A().box.tiers[0]; const tot = t.weights.reduce((x, y) => x + y, 0);
  const e = K.embed({
    title: `${E(`box_${t.id}`)} Tỉ lệ — ${t.name}`, color: U.COLOR.box,
    desc: A().box.grades.map((g, i) => `${E(`grade_${g.id}`)} **${g.name}**: ${t.weights[i] > 0 ? `${(t.weights[i] / tot * 100).toFixed(t.weights[i] / tot < 0.01 ? 2 : 1)}%` : '—'} · ${Math.round(A().box.gradePoints[i] * t.mult)} LĐ`).join('\n')
      + `\n\n${t.pity.after ? `${E('box_pity')} **Bảo hiểm:** sau ${t.pity.after - 1} lần liên tiếp không ra phẩm **${A().box.grades[t.pity.grade - 1].name}** trở lên, lần kế tiếp chắc chắn ra.` : 'Hộp này không có bảo hiểm.'}\n${E('ui_dup')} Linh Bảo trùng quy đổi **${Math.round(A().box.dupeRatio * 100)}%** điểm.`,
  });
  const sel = K.select({ id: cid('v', uid, 'ngbox', 'rsel'), placeholder: 'Xem tỉ lệ hộp khác…', options: A().box.tiers.map((x) => ({ label: x.name, value: String(x.id), default: x.id === t.id, emoji: K.emoji.btn('arcade', `box_${x.id}`) })) });
  return { payload: K.msg({ embeds: [e], components: [...K.rows([sel]), ...K.rows([U.navRow(uid, 'box')])] }) };
}
function boxHistory(c) {
  const h = svc.boxHistory(c.uid);
  const e = K.embed({ title: `${E('hub_stats')} Lịch sử mở hộp`, color: U.COLOR.box, desc: h.length ? h.map((x) => { const it = D.arcadeItems.get(x.detail.item); return `${E(`i_${it.id}`)} **${it.name}** ${E(`grade_${x.detail.grade}`)} · ${A().box.tiers[x.detail.tier - 1].name} · +${x.points} LĐ${x.detail.isNew ? ` ${E('ui_new')}` : ` ${E('ui_dup')}`} ${F.rel(x.created_at)}`; }).join('\n') : '*Bạn chưa mở hộp nào.*' });
  return { payload: K.msg({ embeds: [e], components: K.rows([U.navRow(c.uid, 'box')]) } ) };
}
function boxFrame(c, [mode, x]) {
  const uid = c.uid; if (mode === 'r') return boxRates(c, x); if (mode === 'hist') return boxHistory(c);
  if (mode !== 'h') return boxMain(c);
  const h = repo.histGet(uid, +x); if (!h) return boxMain(c);
  const d = h.detail; const tier = A().box.tiers[d.tier - 1]; const it = D.arcadeItems.get(d.item); const g = A().box.grades[d.grade - 1];
  const t = now(); const stage = Math.min(2, Math.floor((t - d.at) / A().box.stageMs)); const files = []; let thumbId; let e;
  if (stage < 2) {
    thumbId = stage === 0 ? `box_${tier.id}` : 'box_crack';
    e = K.embed({ title: `${E(stage === 0 ? `box_${tier.id}` : 'box_crack')} ${tier.name}`, color: U.COLOR.box, desc: stage === 0 ? '🎁 Hộp đang rung lắc…' : `${E('box_spark')} Ánh sáng loé ra từ khe nắp… ${E('box_spark')}` });
  } else {
    thumbId = `i_${it.id}`; const ri = hexInt(D.rarities[d.grade - 1].color);
    e = K.embed({
      title: `${E(`box_${tier.id}_open`)} ${tier.name}`, color: ri,
      desc: `${E(`i_${it.id}`)} **${it.name}**\n${E(`grade_${d.grade}`)} Phẩm **${g.name}** ${d.grade >= 4 ? E('box_spark') : ''}\n${d.isNew ? `${E('ui_new')} Linh Bảo mới trong bộ sưu tập!` : `${E('ui_dup')} Đã có — quy đổi thành điểm.`}${d.pityUsed ? `\n${E('box_pity')} Bảo hiểm may mắn đã kích hoạt!` : ''}\n\n${U.pointsLine(d.applied, d.requested)}${U.notesText(d.notes)}`,
      footer: `Bộ sưu tập: ${repo.itemCount(uid)}/${A().box.items.length}`,
    });
  }
  const im = img(thumbId, 'box'); if (im) { files.push(im.file); e.setThumbnail(im.url); }
  const left = svc.boxLeft(uid, tier); const off = stage < 2;
  const comps = K.rows([btn(uid, 'ngbox', 'open', [tier.id], { label: left > 0 ? `Mở tiếp (${left})` : 'Hết lượt', emoji: B(`box_${tier.id}`), style: 'success', disabled: off || left <= 0 }), btn(uid, 'ngbox', 'menu', [], { label: 'Chọn hộp khác', emoji: B('box_game'), disabled: off }), btn(uid, 'ngme', 'show', ['bag'], { label: 'Bộ sưu tập', emoji: B('grade_3'), disabled: off }), U.navRow(uid, 'box')]);
  return { payload: K.msg({ embeds: [e], components: comps, files }), next: stage < 2 ? d.at + (stage + 1) * A().box.stageMs - t + 40 : null };
}
const ngbox = make('ngbox', boxFrame, (c, act, [a1], i) => {
  stopFirst(c);
  if (act === 'open') { const r = svc.boxOpen(c.uid, +a1); return { args: ['h', String(r.id)] }; }
  if (act === 'rates') return { args: ['r', a1] };
  if (act === 'rsel') return { args: ['r', i.values[0]] };
  if (act === 'hist') return { args: ['hist'] };
  return { args: [] }; // menu
});

/* =================================================================== TRUY TÌM LINH NGƯ */
function quizIntro(c, notice) {
  const uid = c.uid; const st = svc.stats(uid).quiz; const left = svc.limitLeft(uid, 'quiz'); const q = A().quiz;
  const e = K.embed({
    title: `${E('quiz_game')} Truy Tìm Linh Ngư`, color: U.COLOR.quiz,
    desc: `**${q.perRound} câu đố** về cá của Thiên Tông (khu vực, phẩm cấp, giá, độ khó, cân nặng…) — 4 đáp án, mỗi câu có **giới hạn thời gian** và càng về sau càng khó.\nĐúng được ${q.points.base}+ LĐ (+thưởng nhanh, +chuỗi đúng). ≥80% đúng: +${q.points.round8} · tuyệt đối: +${q.points.perfect}.\nBấm **Bắt đầu** thì đồng hồ mới chạy.`,
    fields: [{ name: 'Hôm nay', value: `Còn **${left}**/${A().limits.quiz} vòng`, inline: true }, { name: 'Thành tích', value: `Đúng ${st.correct}/${st.answered} (${pct(st.correct, st.answered)})\nTốt nhất: ${st.best_score} LĐ · Tuyệt đối: ${st.perfect}`, inline: true }],
  });
  return K.msg({ embeds: [e], content: notice, components: K.rows([btn(uid, 'ngquiz', 'start', [], { label: 'Bắt đầu', emoji: B('quiz_q'), style: 'success', disabled: left <= 0 }), U.navRow(uid, 'quiz')]) });
}
function quizFrame(c, [sid]) {
  const uid = c.uid; let s = null;
  try { if (sid) s = svc.quizGet(uid, sid); else { const cur = repo.sessionActive(uid, 'quiz'); if (cur) s = svc.quizAdvance(cur.id); } } catch (e) { if (!(e instanceof GameError)) throw e; }
  if (!s) return { payload: quizIntro(c) };
  const d = s.data; const nav = U.navRow(uid, 'quiz'); const N = d.qs.length; const fb = d.last
    ? `${E(d.last.ok ? 'quiz_ok' : 'quiz_no')} ${d.last.timeout ? '**Hết giờ!**' : d.last.ok ? '**Đúng!**' : '**Sai.**'} ${d.last.ok ? `+${d.last.pts} LĐ${d.last.parts && d.last.parts.speed ? ` (nhanh +${d.last.parts.speed}` : ''}${d.last.parts && d.last.parts.streak ? `${d.last.parts.speed ? ', ' : ' ('}chuỗi +${d.last.parts.streak}` : ''}${d.last.parts && (d.last.parts.speed || d.last.parts.streak) ? ')' : ''}` : `Đáp án: **${d.last.right}**`}\n\n` : '';
  if (s.status !== 'active') {
    const fin = d.final; const strip = d.answers.map((a) => (a.ok ? '✅' : '❌')).join('');
    const e = K.embed({ title: `${E('quiz_game')} Kết thúc vòng đố — ${d.correct}/${N} câu đúng`, color: d.correct >= N ? K.COLOR.gold : U.COLOR.quiz,
      desc: `${fb}${strip}\n\nĐiểm các câu: **${d.pts}** · Thưởng vòng: **${fin ? fin.bonus : 0}**\n${fin ? U.pointsLine(fin.applied, fin.requested) : ''}${fin ? U.notesText(fin.notes) : ''}` });
    return { payload: K.msg({ embeds: [e], components: K.rows([btn(uid, 'ngquiz', 'start', [], { label: 'Chơi vòng mới', emoji: B('quiz_q'), style: 'success', disabled: svc.limitLeft(uid, 'quiz') <= 0 }), nav]) }), next: null };
  }
  const q = d.qs[d.i]; const t = now(); const dl = d.qStart + d.limitMs;
  const e = K.embed({
    title: `${E('quiz_q')} Câu ${d.i + 1}/${N} ${E(`quiz_lv${q.lv}`)}`, color: U.COLOR.quiz,
    desc: `${fb}${q.t}\n\n${q.o.map((o, k) => `${E(`quiz_${'abcd'[k]}`)} ${o}`).join('\n')}\n\n${E('quiz_time')} Hết giờ ${F.rel(dl)}`,
    fields: [{ name: 'Điểm vòng', value: String(d.pts), inline: true }, { name: `${E('quiz_streak')} Chuỗi`, value: String(d.streak), inline: true }, { name: 'Đúng', value: `${d.correct}/${d.i}`, inline: true }],
  });
  const opts = q.o.map((o, k) => btn(uid, 'ngquiz', 'ans', [s.id, d.i, k], { label: F.clip(o, 78), emoji: B(`quiz_${'abcd'[k]}`), style: 'primary' }));
  return { payload: K.msg({ embeds: [e], components: K.rows([K.selectRow(opts.slice(0, 2)), K.selectRow(opts.slice(2, 4)), nav]) }), next: dl + A().quiz.graceMs - t + 120 };
}
const ngquiz = make('ngquiz', quizFrame, (c, act, [a1, a2, a3]) => {
  stopFirst(c);
  if (act === 'start') { const s = svc.quizStart(c.uid); return { args: [String(s.id)] }; }
  if (act === 'ans') { const s = svc.quizAnswer(c.uid, +a1, +a2, +a3); return { args: [String(s.id)] }; }
  return { args: a1 ? [a1] : [] };
});

/* =================================================================== XẾP HẠNG */
function rankFrame(c, [kind = 'w', pkey = '']) {
  const uid = c.uid; const b = svc.board(kind, pkey, uid, 10); const names = { w: 'Tuần này', s: `Mùa ${b.pkey}`, all: 'Tích luỹ' };
  const e = K.embed({ title: `${E('hub_board')} Bảng xếp hạng — ${names[kind] || kind}`, color: U.COLOR.hub,
    desc: b.rows.length ? b.rows.map((r, k) => `${U.medal(k + 1)} **${r.name || 'Ẩn danh'}**${r.user_id === uid ? ' ◀' : ''} — ${F.num(r.pts)} LĐ`).join('\n') : '*Chưa có ai trên bảng — hãy chơi để lên top!*',
    fields: [b.mine ? { name: 'Bạn', value: b.mine.rank ? `Hạng **#${b.mine.rank}** · ${F.num(b.mine.pts)} LĐ` : 'Chưa có điểm kỳ này' } : null].filter(Boolean),
    footer: 'Tuần bắt đầu thứ Hai · Mùa = một tháng · Chỉ tính điểm từ trò chơi (đã trừ phần vượt trần ngày).' });
  const opts = [{ label: 'Tuần này', value: 'w~' }, { label: `Mùa này (${repo.seasonKey()})`, value: `s~${repo.seasonKey()}` }, ...b.seasons.filter((x) => x !== repo.seasonKey()).slice(0, 2).map((x) => ({ label: `Mùa ${x}`, value: `s~${x}` })), { label: 'Tích luỹ', value: 'all~' }]
    .map((o) => ({ ...o, default: o.value === `${kind}~${kind === 's' ? b.pkey : ''}` }));
  return { payload: K.msg({ embeds: [e], components: [...K.rows([K.select({ id: cid('v', uid, 'ngrank', 'sel'), placeholder: 'Chọn bảng…', options: opts })]), ...K.rows([btn(uid, 'ng', 'show', [], { label: 'Về sảnh', emoji: B('hub_logo') })])] }) };
}
const ngrank = make('ngrank', rankFrame, (c, act, args, i) => { stopFirst(c); if (act === 'sel') return { args: i.values[0].split('~') }; return { args: args || [] }; });

/* =================================================================== HỒ SƠ GIẢI TRÍ (thống kê · thành tích · nhiệm vụ · bộ sưu tập · nhật ký) */
const PAGES = [['stats', 'Thống kê', 'hub_stats'], ['mission', 'Nhiệm vụ', 'hub_mission'], ['ach', 'Thành tích', 'hub_ach'], ['bag', 'Sưu tầm', 'grade_3'], ['log', 'Nhật ký', 'hub_points']];
function meFrame(c, [page = 'stats']) {
  const uid = c.uid; const sm = svc.summary(uid); const st = svc.stats(uid); const fields = []; let title; let desc = ''; let extra = [];
  const rk = sm.rank;
  if (page === 'mission') {
    const ms = svc.missionsOf(uid); title = `${E('hub_mission')} Nhiệm vụ giải trí hôm nay`;
    desc = 'Mỗi ngày có 3 nhiệm vụ ngẫu nhiên + 1 nhiệm vụ cố định. Thưởng nhiệm vụ **không bị tính vào trần điểm ngày**.';
    for (const m of ms) fields.push({ name: `${m.claimed ? E('ui_ok') : m.done ? E('hub_claim') : '▫️'} ${m.name}`, value: `${m.desc}\n${U.pbar(m.progress, m.target, 10)} ${m.progress}/${m.target} · thưởng **${m.reward}** LĐ${m.claimed ? ' · ✅ đã nhận' : ''}` });
    extra = ms.filter((m) => m.done && !m.claimed).map((m) => btn(uid, 'ngme', 'claim', [m.id], { label: `Nhận: ${F.clip(m.name, 30)}`, emoji: B('hub_claim'), style: 'success' }));
  } else if (page === 'ach') {
    const as = svc.achievements(uid); title = `${E('hub_ach')} Thành tích giải trí — ${as.filter((a) => a.unlocked).length}/${as.length}`;
    if (st.titles.length) desc = `Danh hiệu: ${st.titles.map((x) => `«${x}»`).join(' · ')}`;
    for (let k = 0; k < as.length; k += 7) fields.push({ name: k ? '​' : 'Danh sách', value: as.slice(k, k + 7).map((a) => `${a.unlocked ? E('ui_ok') : E('ui_lock')} **${a.name}** — ${a.desc}${a.unlocked ? '' : ` *(${F.num(a.value)}/${F.num(a.target)})*`} · +${a.reward} LĐ${a.title ? ` · «${a.title}»` : ''}`).join('\n') });
  } else if (page === 'bag') {
    const col = svc.collection(uid); const have = col.filter((x) => x.qty > 0).length; title = `${E('box_game')} Bộ sưu tập Linh Bảo — ${have}/${col.length}`;
    for (const g of A().box.grades) { const list = col.filter((x) => x.grade === g.id); fields.push({ name: `${E(`grade_${g.id}`)} ${g.name} (${list.filter((x) => x.qty).length}/${list.length})`, value: list.map((x) => (x.qty ? `${E(`i_${x.id}`)} ${x.name}${x.qty > 1 ? ` ×${x.qty}` : ''}` : `${E('ui_lock')} ???`)).join('\n') }); }
  } else if (page === 'log') {
    const lg = repo.ledgerRecent(uid, 12); title = `${E('hub_points')} Nhật ký Linh Điểm`;
    desc = lg.length ? lg.map((x) => `${E('hub_points')} **${x.applied >= 0 ? '+' : ''}${x.applied}** · ${{ race: 'Đua cá', dice: 'Tài xỉu', box: 'Bí hộp', quiz: 'Đố cá', mission: 'Nhiệm vụ', ach: 'Thành tích' }[x.game] || x.game}${x.note ? ` · ${x.note}` : ''}${x.applied < x.requested ? ' *(chạm trần)*' : ''} ${F.rel(x.created_at)}`).join('\n') : '*Chưa có giao dịch điểm nào.*';
  } else {
    title = `${E('hub_stats')} Hồ sơ giải trí`; const r = st.race; const dc = st.dice; const b = st.box; const q = st.quiz;
    const favFish = Object.entries(r.fish).sort((x, y) => y[1] - x[1])[0];
    desc = `${E('hub_rank')} **${rk.name}** · ${F.num(rk.life)} LĐ tích luỹ${rk.next ? ` (còn ${F.num(rk.need - rk.life)} → ${rk.next.name})` : ''}\nHôm nay **${F.num(sm.today)}**/${F.num(sm.cap)} · Tuần **${F.num(sm.week)}** · Mùa **${F.num(sm.season)}**${st.titles.length ? `\nDanh hiệu: ${st.titles.map((x) => `«${x}»`).join(' · ')}` : ''}`;
    fields.push(
      { name: `${E('race_game')} Đoán Ngư Vương`, value: `Cuộc đua: ${r.plays} · Đúng: ${r.wins} (${pct(r.wins, r.plays)})\nTop 3: ${r.podium} · Chuỗi tốt nhất: ${r.best_streak}\nNgựa ô thắng: ${r.underdog_wins}${favFish ? `\nHay chọn: ${fishE(favFish[0])} ${fishName(favFish[0])} (${favFish[1]}×)` : ''}`, inline: true },
      { name: `${E('dice_game')} Tài Xỉu`, value: `Lượt: ${dc.plays} · Đúng: ${dc.wins} (${pct(dc.wins, dc.plays)})\nChuỗi tốt nhất: ${dc.best_streak} · Bão trúng: ${dc.bao_hits}\nChọn Xỉu/Tài/Bão: ${dc.xiu}/${dc.tai}/${dc.bao}`, inline: true },
      { name: `${E('box_game')} Bí Hộp`, value: `Đã mở: ${b.opens} · Trùng: ${b.dupes}\nSưu tầm: ${repo.itemCount(uid)}/${A().box.items.length}\nPhẩm: ${A().box.grades.map((g) => `${E(`grade_${g.id}`)}${b.byGrade[g.id] || 0}`).join(' ')}`, inline: true },
      { name: `${E('quiz_game')} Truy Tìm`, value: `Vòng: ${q.rounds} · Đúng: ${q.correct}/${q.answered} (${pct(q.correct, q.answered)})\nChuỗi tốt nhất: ${q.best_streak} · Tuyệt đối: ${q.perfect}\nĐiểm vòng cao nhất: ${q.best_score}`, inline: true },
    );
  }
  const e = K.embed({ title, desc, fields, color: U.COLOR.hub });
  const nav = K.selectRow(PAGES.map(([id, label, ic]) => btn(uid, 'ngme', 'show', [id], { label, emoji: B(ic), disabled: page === id, style: page === id ? 'primary' : 'secondary' })));
  return { payload: K.msg({ embeds: [e], components: K.rows([...(extra.length ? [K.selectRow(extra.slice(0, 5))] : []), nav, btn(uid, 'ng', 'show', [], { label: 'Về sảnh', emoji: B('hub_logo') })]) }) };
}
const ngme = make('ngme', meFrame, (c, act, [a1]) => {
  stopFirst(c);
  if (act === 'claim') { const r = svc.claimMission(c.uid, a1); return { args: ['mission'], notice: `${E('hub_claim')} Nhận **+${r.points} LĐ** từ nhiệm vụ **${r.mission.name}**!${r.notes.length ? `\n${r.notes.join('\n')}` : ''}` }; }
  return { args: a1 ? [a1] : [] };
});

module.exports = { ng, ngrace, ngdice, ngbox, ngquiz, ngrank, ngme };
