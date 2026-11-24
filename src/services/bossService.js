'use strict';
const { D } = require('./gameData');
const bossRepo = require('../database/repositories/bosses');
const sessRepo = require('../database/repositories/sessions');
const rodRepo = require('../database/repositories/rods');
const fishRepo = require('../database/repositories/fish');
const users = require('../database/repositories/users');
const settings = require('../database/repositories/settings');
const economy = require('./economyService');
const invSvc = require('./inventoryService');
const userSvc = require('./userService');
const fishing = require('./fishingService');
const progressSvc = require('./progressService');
const mg = require('../systems/minigame');
const fishSys = require('../systems/fish');
const { getDb } = require('../database/connection');
const { GameError } = require('../utils/errors');
const { now } = require('../utils/time');
const { chance, token } = require('../utils/rng');
const ctx = require('./context');

const MAX_PARTY = 5;
function applyRegen(b) {
  const def = D.bosses.get(b.boss_id); if (!def || b.status !== 'active' || !def.regenPctPerMin || b.hp >= b.max_hp) return b;
  const t = now(); const mins = Math.floor((t - b.last_regen) / 60000); if (mins < 1) return b;
  const hp = Math.min(b.max_hp, b.hp + Math.round(b.max_hp * (def.regenPctPerMin / 100) * mins)); bossRepo.setHp(b.id, hp, null, b.last_regen + mins * 60000); return bossRepo.get(b.id);
}
function spawn(bossId, { rewardMult = 1, eventId = null, durationMs } = {}) {
  const def = D.bosses.get(bossId); if (!def) throw new GameError('Boss không tồn tại.');
  return getDb().tx(() => {
    if (bossRepo.activeAt(def.location)) throw new GameError(`Đã có boss đang hoạt động tại ${D.locations.get(def.location).name}.`);
    const t = now(); const id = bossRepo.create({ boss_id: bossId, location: def.location, hp: def.hp, started_at: t, ends_at: t + (durationMs || def.durationMin * 60000), reward_mult: rewardMult, event_id: eventId });
    const inst = bossRepo.get(id); ctx.emit('bossSpawned', { instance: inst, def }); return inst;
  });
}
const status = (id) => { const b = bossRepo.get(id); return b ? applyRegen(b) : null; };
const activeList = () => bossRepo.active().map(applyRegen);
function partyBonus(bossId, userId) { const p = bossRepo.party(bossId, userId); if (!p) return { members: 1, bonus: 0 }; const n = bossRepo.partyMembers(bossId, p.leader_id).length; return { members: n, bonus: n >= 2 ? Math.min(0.4, 0.08 * (n - 1)) : 0, leader: p.leader_id }; }
function createParty(userId, bossId) { return getDb().tx(() => { const b = bossRepo.get(bossId); if (!b || b.status !== 'active') throw new GameError('Boss không còn hoạt động.'); if (bossRepo.party(bossId, userId)) throw new GameError('Bạn đã ở trong một tổ đội.'); bossRepo.joinParty(bossId, userId, userId); return partyBonus(bossId, userId); }); }
function joinParty(userId, bossId, leaderId) {
  return getDb().tx(() => {
    const b = bossRepo.get(bossId); if (!b || b.status !== 'active') throw new GameError('Boss không còn hoạt động.'); if (bossRepo.party(bossId, userId)) throw new GameError('Bạn đã ở trong một tổ đội.');
    const lp = bossRepo.party(bossId, leaderId); if (!lp || lp.leader_id !== leaderId) throw new GameError('Người này chưa lập tổ đội.'); if (bossRepo.partyMembers(bossId, leaderId).length >= MAX_PARTY) throw new GameError(`Tổ đội đã đủ ${MAX_PARTY} người.`);
    bossRepo.joinParty(bossId, userId, leaderId); return partyBonus(bossId, userId);
  });
}
function leaveParty(userId, bossId) { return getDb().tx(() => { const p = bossRepo.party(bossId, userId); if (!p) throw new GameError('Bạn chưa ở trong tổ đội nào.'); if (p.leader_id === userId) bossRepo.disband(bossId, userId); else bossRepo.leaveParty(bossId, userId); return true; }); }

/** Bắt đầu một đợt tấn công (5 lượt thao tác). Dùng chung hạ tầng phiên để mỗi người chỉ có một phiên cùng lúc. */
function attack(userId, bossInstanceId, { channelId = null, messageId = null } = {}) {
  userSvc.assertCanPlay(userId);
  return getDb().tx(() => {
    let b = bossRepo.get(bossInstanceId); if (!b || b.status !== 'active') throw new GameError('Boss này đã biến mất.'); if (b.ends_at <= now()) { expire(b.id); throw new GameError('Boss đã rời đi (hết thời gian).'); }
    b = applyRegen(b); const def = D.bosses.get(b.boss_id); const t = now();
    if (sessRepo.active(userId)) throw new GameError('Bạn đang có một phiên câu/chiến đấu chưa kết thúc!', 'BUSY');
    fishing.checkLocationAccess(userId, b.location);
    const cd = settings.cooldownLeft(userId, `boss:${b.id}`, t); if (cd) throw new GameError(`Hồi sức… còn ${Math.ceil(cd / 1000)}s nữa mới tấn công tiếp được.`, 'COOLDOWN');
    const L = fishing.loadout(userId, { location: b.location, baitId: null, t }); if (!L.rod) throw new GameError('Bạn chưa trang bị cần câu.');
    if (L.rod.inst.durability <= 0) throw new GameError('Cần câu đã hỏng, hãy sửa trước khi chiến đấu.');
    const mods = fishing.modsFor(L); const user = L.user; const pb = partyBonus(b.id, userId);
    let dmg = (mods.power * 3 + mods.reel * 1.5 + user.level * 2 + 40) * (1 + pb.bonus) * (1 + (mods.rareBonus >= 100 ? 0.1 : 0));
    dmg = Math.max(1, Math.round(dmg * (1 - def.armorPct / 100)));
    if (!chance(mods.durabilitySave / 100)) rodRepo.update(L.rod.inst.id, { durability: Math.max(0, L.rod.inst.durability - 1) });
    settings.setCooldown(userId, `boss:${b.id}`, def.stanceSeconds * 1000, t);
    const mini = mg.initBoss({ damage: dmg });
    const id = sessRepo.create({ user_id: userId, kind: 'boss', location: b.location, rod_instance_id: L.rod.inst.id, state: 'reeling', nonce: token(6), started_at: t, channel_id: channelId, message_id: messageId, data: { bossInstanceId: b.id, bossId: b.boss_id, mini, roundDeadline: t + mg.ROUND_MS, party: pb, dmg } });
    return sessRepo.get(id);
  });
}
function afterRound(s, r, t) {
  const data = { ...s.data, last: r, roundDeadline: t + mg.ROUND_MS };
  if (r.done) { sessRepo.update(s.id, { data }); return fishing.finish(sessRepo.get(s.id), r.done === 'timeout' ? 'timeout' : 'success'); }
  sessRepo.update(s.id, { nonce: token(6), data }); return sessRepo.get(s.id);
}
/** Kết thúc đợt tấn công: áp sát thương lên boss, ghi đóng góp, xử lý boss bị hạ. */
function finishAttack(s, outcome, reason) {
  const t = now(); const mini = s.data.mini; const total = mini.total || 0; const out = { outcome: outcome === 'success' ? 'success' : outcome, reason, damage: total, hits: mini.hits, combo: mini.combo, kind: 'boss' };
  let b = bossRepo.get(s.data.bossInstanceId);
  if (total > 0 && b && b.status === 'active') {
    b = applyRegen(b); const applied = Math.min(total, b.hp); const hp = b.hp - applied;
    bossRepo.setHp(b.id, hp, s.user_id); bossRepo.addContribution(b.id, s.user_id, applied); users.bumpStats(s.user_id, { boss_damage: applied }); out.applied = applied; out.hp = hp; out.maxHp = b.max_hp;
    progressSvc.track(s.user_id, 'boss_hit', { count: 1 });
    if (hp <= 0) out.defeated = defeat(b.id, s.user_id);
  } else if (b) { out.hp = b.hp; out.maxHp = b.max_hp; if (b.status !== 'active') out.ended = true; }
  out.newAch = progressSvc.checkAchievements(s.user_id);
  const st = total > 0 ? 'success' : outcome === 'timeout' ? 'timeout' : 'fail';
  sessRepo.update(s.id, { state: st, ended_at: t, nonce: token(6), result: JSON.stringify(out) });
  const res = sessRepo.get(s.id); res.result = out; ctx.emit('sessionEnded', res); return res;
}
function sharesOf(bossId) { const rows = bossRepo.contributions(bossId, 500); const tot = rows.reduce((a, r) => a + r.damage, 0) || 1; return rows.map((r) => ({ ...r, share: r.damage / tot })); }
/** Boss bị hạ: chia thưởng theo đóng góp, cá chiến lợi phẩm cho người kết liễu + người đóng góp cao nhất. */
function defeat(bossInstanceId, lastHitBy) {
  return getDb().tx(() => {
    const b = bossRepo.get(bossInstanceId); if (!bossRepo.finish(b.id, 'defeated', now())) return null; const def = D.bosses.get(b.boss_id); const shares = sharesOf(b.id);
    const pool = def.rewards.xu * b.reward_mult; const expPool = def.rewards.exp * b.reward_mult; const winners = [];
    for (const [i, r] of shares.entries()) {
      const xu = Math.round((pool * r.share + 300) * settings.get('xu_rate')); const exp = Math.round(expPool * r.share + 50);
      economy.credit(r.user_id, xu, 'boss_reward', { ref: `boss:${b.id}`, idem: `boss:${b.id}:${r.user_id}`, note: def.name }); userSvc.addExp(r.user_id, exp);
      const items = {}; if (r.share >= 0.02 || i === 0) items[def.rewards.chest] = Math.max(1, Math.round(b.reward_mult)) + (i === 0 ? 1 : 0); invSvc.grant(r.user_id, items, { force: true });
      users.bumpStats(r.user_id, { boss_kills: 1 }); progressSvc.checkAchievements(r.user_id);
      const trophy = [];
      for (const [who, cond] of [['mvp', i === 0], ['last', r.user_id === lastHitBy]]) if (cond) trophy.push(who);
      for (const who of [...new Set(trophy)]) giveTrophy(r.user_id, def, b.location);
      winners.push({ user_id: r.user_id, name: r.name, damage: r.damage, share: r.share, xu, exp, items, trophy });
    }
    const res = { instance: bossRepo.get(b.id), def, winners, lastHitBy }; ctx.emit('bossDefeated', res); return res;
  });
}
function giveTrophy(userId, def, location) {
  const fish = D.fishes.get(def.trophyFish); const variant = fishSys.variantById('thuong'); const w = Math.round((fish.minWeight + (fish.maxWeight - fish.minWeight) * 0.6) * 100) / 100;
  fishRepo.create(userId, { fish_id: fish.id, weight: w, variant: variant.id, rarity: fish.rarity, base_value: fishSys.baseValue(fish, w, variant), location, source: 'boss' }); fishRepo.codexUpsert(userId, fish.id, w, variant.id);
}
/** Hết giờ: thưởng an ủi 25% theo đóng góp. */
function expire(bossInstanceId) {
  return getDb().tx(() => {
    const b = bossRepo.get(bossInstanceId); if (!b || !bossRepo.finish(b.id, 'expired', now())) return null; const def = D.bosses.get(b.boss_id); const shares = sharesOf(b.id);
    for (const r of shares) economy.credit(r.user_id, Math.round(def.rewards.xu * b.reward_mult * 0.25 * r.share + 100), 'boss_reward', { ref: `boss:${b.id}`, idem: `boss:${b.id}:${r.user_id}`, note: `${def.name} (an ủi)` });
    const res = { instance: bossRepo.get(b.id), def, shares }; ctx.emit('bossExpired', res); return res;
  });
}
/** Định kỳ: đóng boss hết hạn; tự tạo boss mới theo chu kỳ hồi sinh. */
function tick() {
  for (const b of bossRepo.active()) if (b.ends_at <= now()) expire(b.id); else applyRegen(b);
  if (!settings.get('boss_auto_spawn')) return; const t = now(); const act = bossRepo.active(); if (act.length >= 2) return;
  const respawn = settings.get('boss_respawn_hours') * 3600000;
  const cands = D.bossList.filter((d) => !act.some((a) => a.boss_id === d.id)).map((d) => ({ d, last: bossRepo.lastOf(d.id) })).filter((x) => !x.last || (x.last.status !== 'active' && t - (x.last.defeated_at || x.last.ends_at) >= respawn));
  cands.sort((a, b) => (a.last ? a.last.started_at : 0) - (b.last ? b.last.started_at : 0));
  if (cands[0]) { try { spawn(cands[0].d.id); } catch (e) { /* đã có boss ở khu vực */ } }
}
module.exports = { spawn, status, activeList, attack, afterRound, finishAttack, defeat, expire, tick, createParty, joinParty, leaveParty, partyBonus, sharesOf, applyRegen, MAX_PARTY, contributions: bossRepo.contributions, get: bossRepo.get };
