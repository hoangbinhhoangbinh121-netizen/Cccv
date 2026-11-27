'use strict';
/**
 * Vòng đời một phiên câu: waiting → bite → reeling → (success | fail | escaped | timeout).
 * Mọi chuyển trạng thái chạy qua advance() (tính theo thời gian thực của máy chủ) nên kết quả đúng kể cả khi timer trễ/bot khởi động lại.
 */
const { D, item: itemDef } = require('./gameData');
const users = require('../database/repositories/users');
const rodRepo = require('../database/repositories/rods');
const fishRepo = require('../database/repositories/fish');
const sessRepo = require('../database/repositories/sessions');
const petRepo = require('../database/repositories/pets');
const settings = require('../database/repositories/settings');
const invRepo = require('../database/repositories/inventory');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const userSvc = require('./userService');
const progressSvc = require('./progressService');
const eventSvc = require('./eventService');
const rodSys = require('../systems/rods');
const fishSys = require('../systems/fish');
const fishingSys = require('../systems/fishing');
const petSys = require('../systems/fishing/pets');
const mg = require('../systems/minigame');
const weather = require('../systems/weather');
const rarity = require('../systems/rarity');
const progression = require('../systems/progression');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const logger = require('../utils/logger');
const { now } = require('../utils/time');
const { rand, randInt, chance, token } = require('../utils/rng');
const ctx = require('./context');

const SESSION_CAP_MS = 6 * 60000; const GRACE_MS = 3000; const CAST_COOLDOWN_MS = 2500; // GRACE_MS: bù độ trễ mạng/điện thoại
const DEEP_ORDER = 5;
const weatherOverride = (loc) => { const raw = settings.getRaw(`weather:${loc}`); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } };
const currentWeather = (loc, t = now()) => { const w = weather.weatherAt(loc, t, weatherOverride(loc)); return weather.WEATHER[w] ? w : weather.weatherAt(loc, t, null); }; // ghi đè thời tiết sai tên → dùng thời tiết tự nhiên
/** Chạy một bước phụ (thưởng thêm, nhiệm vụ…) trong savepoint: lỗi chỉ bị ghi log, không làm hỏng cả phiên câu của người chơi. */
function soft(label, fn, dflt = null) { try { return getDb().tx(fn); } catch (e) { logger.error(`[câu cá] bước phụ "${label}" lỗi: ${e.stack || e.message}`); return dflt; } }

/** Dựng toàn bộ thông tin trang bị + hệ số của người chơi (bait tuỳ chọn ghi đè ô mồi). */
function loadout(userId, { location, baitId, t = now() } = {}) {
  const user = users.get(userId); const eq = users.equipment(userId);
  const loc = location || user.location;
  const rodInst = eq.rod_id ? rodRepo.owned(userId, eq.rod_id) : null;
  const rod = rodInst ? { inst: rodInst, ...rodSys.computeStats(rodInst) } : null;
  const own = (id) => (id && invRepo.count(userId, id) > 0 ? itemDef(id) : null);
  const bId = baitId === undefined ? eq.bait_id : baitId; const bait = own(bId);
  const float = own(eq.float_id); const line = own(eq.line_id); const hook = own(eq.hook_id);
  let pet = null; if (eq.pet_id) { const inst = petRepo.owned(userId, eq.pet_id); if (inst) { const ps = petSys.petStats(inst); pet = { inst, def: ps.def, stats: ps.stats }; } }
  const buffs = {}; for (const b of settings.activeBuffs(userId, t)) buffs[b.stat] = b.value;
  const wxName = currentWeather(loc, t); const band = weather.timeBand(t);
  const ev = eventSvc.modifiers();
  return { user, eq, location: loc, rod, bait, float, line, hook, pet, buffs, weather: wxName, timeBand: band, ev, rates: { luck: settings.get('luck_rate'), exp: settings.get('exp_rate'), xu: settings.get('xu_rate') } };
}
function modsFor(L, skill = null) {
  return fishingSys.computeMods({ rod: L.rod ? L.rod.stats : {}, innate: L.rod?.innate, bait: L.bait, float: L.float, line: L.line, hook: L.hook, pet: L.pet?.stats, skill, buffs: L.buffs, wx: weather.WEATHER[L.weather].fx, tx: weather.TIME[L.timeBand].fx, ev: L.ev, rates: L.rates });
}
const sellMultiplier = (userId) => { const L = loadout(userId); return modsFor(L).coinMult; };

function checkLocationAccess(userId, locId) {
  const loc = D.locations.get(locId); if (!loc) throw new GameError('Khu vực không tồn tại.');
  if (!users.unlockedLocations(userId).includes(locId)) throw new GameError(`Bạn chưa mở khoá **${loc.name}** (cấp ${loc.unlock.level}, cần cần câu bậc ${loc.unlock.rodTier}, phí ${loc.unlock.cost} xu).`, 'LOCKED');
  return loc;
}
function startCast(userId, { location, baitId, channelId = null, messageId = null } = {}) {
  userSvc.assertCanPlay(userId);
  return getDb().tx(() => {
    const t = now(); const act = sessRepo.active(userId);
    if (act) { const cur = advance(act.id, t); if (cur && ['waiting', 'bite', 'reeling'].includes(cur.state)) throw new GameError('Bạn đang có một phiên câu cá chưa kết thúc! Gõ `/cauca` (hoặc `.cauca`) để mở lại phiên đó.', 'BUSY'); }
    const cd = settings.cooldownLeft(userId, 'cast', t); if (cd) throw new GameError(`Cần nghỉ tay một chút… (${Math.ceil(cd / 1000)}s)`, 'COOLDOWN');
    const user = users.get(userId); let locId = location || user.location;
    if (!location) { const open = users.unlockedLocations(userId); if (!open.includes(locId)) locId = open[0] || 'ao_lang'; } // đang đứng ở khu chưa mở (dữ liệu cũ) → về khu đã mở
    const loc = checkLocationAccess(userId, locId);
    let L = loadout(userId, { location: locId, baitId, t });
    if (!L.rod) throw new GameError('Bạn chưa trang bị cần câu! Dùng `/cancau trang-bi`.');
    if (L.rod.inst.durability <= 0) throw new GameError('Cần câu đã hỏng hết độ bền! Dùng `/cancau sua` hoặc **Phù Sửa Cần**.', 'BROKEN');
    if (baitId && !L.bait) throw new GameError('Bạn không còn loại mồi này.');
    invSvc.requireSpace(userId, 2);
    // chọn thú kỹ năng, tính hệ số, chọn cá
    const skill = fishingSys.skillProc(L.pet);
    const mods = modsFor(L, skill);
    const table = fishSys.spawnTable({ location: locId, timeBand: L.timeBand, weather: L.weather, rareBonus: mods.rareBonus, bait: L.bait, eventPool: L.ev.fishPool });
    const fish = fishSys.pickFish(table); if (!fish) throw new GameError('Khu vực này chưa có cá.');
    const variant = fishSys.rollVariant(mods.rareBonus); const weight = fishSys.rollWeight(fish, mods.weightBonus, variant);
    // tiêu hao mồi + độ bền
    if (L.bait && !invRepo.consume(userId, L.bait.id, 1)) throw new GameError('Không thể dùng mồi (hết?).');
    const wear = chance(mods.durabilitySave / 100) ? 0 : 1; if (wear) rodRepo.update(L.rod.inst.id, { durability: Math.max(0, L.rod.inst.durability - wear) });
    const wait = fishingSys.waitMs(loc, mods); const windowMs = fishingSys.biteWindowMs(mods);
    const revealChance = mods.detect / (mods.detect + 60);
    const data = { fishId: fish.id, variant: variant.id, weight, baseValue: fishSys.baseValue(fish, weight, variant), exp: fishSys.expFor(fish, weight, variant), eventId: table.find((r) => r.fish.id === fish.id)?.event || null, rarity: fish.rarity, revealed: chance(revealChance), windowMs, skill: skill ? skill.name : null, weather: L.weather, timeBand: L.timeBand, baitName: L.bait?.name || null, mods: { power: mods.power, reel: mods.reel, resist: mods.resist, tensionDown: mods.tensionDown, expMult: mods.expMult, rareBonus: mods.rareBonus, luck: mods.rareBonus } };
    users.update(userId, { location: locId });
    settings.setCooldown(userId, 'cast', wait + CAST_COOLDOWN_MS, t);
    const id = sessRepo.create({ user_id: userId, kind: 'fish', location: locId, rod_instance_id: L.rod.inst.id, bait_id: L.bait?.id || null, state: 'waiting', nonce: token(6), started_at: t, bite_at: t + wait, deadline_at: t + wait + windowMs, channel_id: channelId, message_id: messageId, data });
    return sessRepo.get(id);
  });
}
function getActive(userId) { const s = sessRepo.active(userId); return s ? advance(s.id) : null; }

/* --------------------------------------------------------------- chuyển trạng thái theo thời gian */
function advance(sessionId, t = now()) {
  const s = sessRepo.get(sessionId); if (!s) return null;
  if (!['waiting', 'bite', 'reeling'].includes(s.state)) return s;
  if (t - s.started_at > SESSION_CAP_MS) return finish(s, 'timeout', 'Phiên câu quá lâu, cá đã bỏ đi.');
  if (s.state === 'waiting' && t >= s.bite_at) {
    if (t > s.deadline_at + GRACE_MS) return finish(s, 'escaped', 'Cá cắn câu nhưng bạn không giật cần kịp!');
    sessRepo.update(s.id, { state: 'bite', nonce: token(6) }); return sessRepo.get(s.id);
  }
  if (s.state === 'bite' && t > s.deadline_at + GRACE_MS) return finish(s, 'escaped', 'Cá đã thoát vì bạn giật cần quá chậm!');
  if (s.state === 'reeling' && t > s.data.roundDeadline + GRACE_MS) return reelStep(s, null, t);
  return s;
}
/** Giật cần khi cá cắn câu. */
function hook(userId, sessionId, nonce) {
  return getDb().tx(() => {
    let s = advance(sessionId); if (!s || s.user_id !== userId) throw new GameError('Phiên câu không tồn tại.');
    if (s.state === 'waiting') { finish(s, 'escaped', 'Bạn giật cần quá sớm, cá giật mình bỏ chạy!'); return sessRepo.get(sessionId); }
    if (s.state !== 'bite') return s; if (s.nonce !== nonce) throw new GameError('Nút này đã hết hiệu lực.', 'STALE');
    const fish = D.fishes.get(s.data.fishId); const rod = rodRepo.get(s.rod_instance_id);
    const st = rod ? rodSys.computeStats(rod).stats : { power: 10, reel: 10, resist: 5 };
    const mini = mg.initFish({ fish, stats: { power: s.data.mods.power || st.power, reel: s.data.mods.reel || st.reel, resist: s.data.mods.resist || st.resist }, tensionDown: s.data.mods.tensionDown });
    const data = { ...s.data, mini, roundDeadline: now() + mg.ROUND_MS };
    sessRepo.update(s.id, { state: 'reeling', nonce: token(6), data }); return sessRepo.get(s.id);
  });
}
function reel(userId, sessionId, nonce, action) {
  if (!mg.ACTIONS[action]) throw new GameError('Thao tác không hợp lệ.');
  return getDb().tx(() => {
    let s = advance(sessionId); if (!s || s.user_id !== userId) throw new GameError('Phiên câu không tồn tại.');
    if (s.state !== 'reeling') return s; if (s.nonce !== nonce) throw new GameError('Nút này đã hết hiệu lực.', 'STALE');
    return reelStep(s, action, now());
  });
}
function reelStep(s, action, t) {
  const mini = s.data.mini; const r = mg.resolve(mini, action);
  if (s.kind === 'boss') return require('./bossService').afterRound(s, r, t);
  const data = { ...s.data, mini, last: r, roundDeadline: t + mg.ROUND_MS };
  if (r.done === 'success') { sessRepo.update(s.id, { data }); return finish(sessRepo.get(s.id), 'success'); }
  if (r.done === 'snap') { sessRepo.update(s.id, { data }); return finish(sessRepo.get(s.id), 'fail', 'Dây câu đứt phựt! Cá đã chạy mất.'); }
  if (r.done === 'timeout') { sessRepo.update(s.id, { data }); return finish(sessRepo.get(s.id), 'timeout', 'Bạn không phản ứng, cá tuột mất.'); }
  if (r.done === 'escaped') { sessRepo.update(s.id, { data }); return finish(sessRepo.get(s.id), 'escaped', 'Cá đã vùng thoát khỏi lưỡi câu!'); }
  sessRepo.update(s.id, { nonce: token(6), data }); return sessRepo.get(s.id);
}
function cancel(userId, sessionId) {
  return getDb().tx(() => { const s = sessRepo.get(sessionId); if (!s || s.user_id !== userId) throw new GameError('Phiên câu không tồn tại.'); if (!['waiting', 'bite', 'reeling'].includes(s.state)) return s; return finish(s, 'cancel', 'Bạn đã thu cần.'); });
}

/* --------------------------------------------------------------- kết thúc phiên */
function finish(s, outcome, reason = '') {
  return getDb().tx(() => {
    const fresh = sessRepo.get(s.id); if (!['waiting', 'bite', 'reeling'].includes(fresh.state)) return fresh; // đã kết thúc (chống xử lý hai lần)
    const t = now(); const d = fresh.data;
    if (fresh.kind === 'boss') return require('./bossService').finishAttack(fresh, outcome, reason);
    const fish = D.fishes.get(d.fishId);
    if (!fish) { // loài cá đã bị xoá khỏi dữ liệu giữa chừng → đóng phiên, hoàn mồi, không để người chơi kẹt
      if (fresh.bait_id) invRepo.add(fresh.user_id, fresh.bait_id, 1);
      const res = { outcome: 'cancel', reason: 'Loài cá này không còn trong dữ liệu nên phiên đã được đóng. Mồi đã được hoàn lại.' };
      sessRepo.update(fresh.id, { state: 'cancelled', ended_at: t, nonce: token(6), result: JSON.stringify(res) });
      const o = sessRepo.get(fresh.id); o.result = res; ctx.emit('sessionEnded', o); return o;
    }
    const result = { outcome, reason };
    let oc = outcome;
    if (outcome === 'success') {
      try { Object.assign(result, getDb().tx(() => award(fresh, fish))); }
      catch (e) {
        logger.error(`[câu cá] trao thưởng phiên #${fresh.id} (user ${fresh.user_id}) lỗi: ${e.stack || e.message}`);
        try { Object.assign(result, getDb().tx(() => awardMinimal(fresh, fish))); }
        catch (e2) { logger.error(`[câu cá] trao thưởng tối thiểu cũng lỗi: ${e2.stack || e2.message}`); oc = 'escaped'; result.outcome = 'escaped'; result.reason = `Lỗi hệ thống khi trao thưởng nên phiên đã được đóng (mã #${fresh.id}). Hãy báo quản trị viên.`; }
      }
    }
    if (oc !== 'success') {
      soft('thống kê', () => { users.bumpStats(fresh.user_id, oc === 'fail' ? { fail_count: 1 } : oc === 'cancel' ? {} : { escaped_count: 1 });
        if (oc !== 'cancel') fishRepo.addHistory({ user_id: fresh.user_id, session_id: fresh.id, fish_id: fish.id, location: fresh.location, rarity: fish.rarity, result: oc }); });
      result.lost = { fishId: fish.id, rarity: fish.rarity, revealed: d.revealed };
    }
    sessRepo.update(fresh.id, { state: oc === 'cancel' ? 'cancelled' : oc, ended_at: t, nonce: token(6), result: JSON.stringify(result) });
    if (settings.cooldownLeft(fresh.user_id, 'cast', t) > 1000) settings.setCooldown(fresh.user_id, 'cast', 1000, t); // kết thúc sớm (thu cần…) thì không bắt chờ hết thời gian chờ cũ
    const out = sessRepo.get(fresh.id); out.result = result; ctx.emit('sessionEnded', out); return out;
  });
}
/** Trao thưởng khi bắt được cá. Toàn bộ nằm trong giao dịch của finish(). */
function award(s, fish) {
  const userId = s.user_id; const d = s.data; const variant = fishSys.variantById(d.variant); const loc = D.locations.get(s.location);
  const fid = fishRepo.create(userId, { fish_id: fish.id, weight: d.weight, variant: d.variant, rarity: fish.rarity, base_value: d.baseValue, location: s.location });
  const cdx = fishRepo.codexUpsert(userId, fish.id, d.weight, d.variant);
  const exp = Math.max(1, Math.round(d.exp * d.mods.expMult));
  const lv = soft('exp', () => userSvc.addExp(userId, exp), { up: false });
  const st = users.stats(userId);
  users.bumpStats(userId, { total_catch: 1, total_weight: d.weight, rare_catch: fish.rarity >= 3 ? 1 : 0, legend_catch: fish.rarity >= 5 ? 1 : 0, ancient_catch: fish.rarity >= 7 ? 1 : 0, unique_catch: fish.rarity >= 9 ? 1 : 0, deep_catch: loc && loc.order >= DEEP_ORDER ? 1 : 0 });
  if (d.weight > st.best_weight) getDb().run('UPDATE user_stats SET best_weight=?, best_fish=? WHERE user_id=?', d.weight, fish.id, userId);
  // tài nguyên đặc trưng + rương kho báu
  const drops = {};
  for (const r of loc?.resources || []) if (chance(Math.min(0.5, r.chance * (1 + d.mods.rareBonus / 200)))) drops[r.item] = (drops[r.item] || 0) + 1;
  const chestId = ['ruong_go', 'ruong_go', 'ruong_bac', 'ruong_bac', 'ruong_vang', 'ruong_vang', 'ruong_kim_cuong', 'ruong_kim_cuong'][(loc?.order || 1) - 1];
  if (chance(0.012 * (1 + d.mods.rareBonus / 200))) drops[chestId] = (drops[chestId] || 0) + 1;
  soft('rơi đồ', () => invSvc.grant(userId, drops, { force: true }));
  // thú cưng nhận EXP
  const eq = users.equipment(userId); let petUp = null; if (eq.pet_id) petUp = soft('exp thú cưng', () => require('./petService').gainExp(userId, eq.pet_id, Math.round(10 + exp * 0.12), 1));
  fishRepo.addHistory({ user_id: userId, session_id: s.id, fish_id: fish.id, fish_instance_id: fid, location: s.location, weight: d.weight, rarity: fish.rarity, variant: d.variant, result: 'success', exp, value: d.baseValue });
  soft('nhiệm vụ', () => progressSvc.track(userId, 'catch', { rarity: fish.rarity, category: fish.category, location: s.location, weight: d.weight, count: 1 }));
  soft('điểm sự kiện', () => eventSvc.score(userId, { weight: d.weight }));
  const newAch = soft('thành tựu', () => progressSvc.checkAchievements(userId), []);
  return { fishInstanceId: fid, fishId: fish.id, weight: d.weight, variant: d.variant, rarity: fish.rarity, baseValue: d.baseValue, exp, level: lv, drops, codex: cdx, petUp, newAch, record: d.weight > st.best_weight, skill: d.skill };
}

/** Phương án dự phòng khi award() lỗi: vẫn giao con cá + ít EXP để người chơi không mất công sức. */
function awardMinimal(s, fish) {
  const d = s.data; const fid = fishRepo.create(s.user_id, { fish_id: fish.id, weight: d.weight, variant: d.variant, rarity: fish.rarity, base_value: d.baseValue, location: s.location });
  const exp = Math.max(1, Math.round(d.exp || 1)); const lv = soft('exp', () => userSvc.addExp(s.user_id, exp), { up: false });
  return { fishInstanceId: fid, fishId: fish.id, weight: d.weight, variant: d.variant, rarity: fish.rarity, baseValue: d.baseValue, exp, level: lv, drops: {}, codex: null, petUp: null, newAch: [], record: false, skill: null };
}

/** Khôi phục sau khi bot khởi động lại: phiên dang dở bị huỷ, hoàn lại mồi. */
function recoverSessions() {
  let n = 0;
  for (const s of sessRepo.allActive()) {
    getDb().tx(() => { if (s.bait_id) invRepo.add(s.user_id, s.bait_id, 1); sessRepo.update(s.id, { state: 'cancelled', ended_at: now(), result: JSON.stringify({ outcome: 'cancel', reason: 'Bot khởi động lại – đã hoàn mồi.' }) }); });
    n++;
  }
  return n;
}
const forceEnd = (userId) => { const s = sessRepo.active(userId); if (!s) return false; getDb().tx(() => { if (s.bait_id && s.kind === 'fish' && s.state === 'waiting') invRepo.add(userId, s.bait_id, 1); sessRepo.update(s.id, { state: 'cancelled', ended_at: now(), result: JSON.stringify({ outcome: 'cancel', reason: 'Quản trị viên đã đóng phiên.' }) }); }); return true; };
module.exports = { loadout, modsFor, sellMultiplier, currentWeather, weatherOverride, startCast, getActive, advance, hook, reel, cancel, finish, recoverSessions, forceEnd, checkLocationAccess, SESSION_CAP_MS };
