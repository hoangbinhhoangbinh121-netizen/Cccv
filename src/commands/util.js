'use strict';
/** Tiện ích dựng lệnh: lệnh "mở một màn hình" + tự động hoàn thành. */
const { SlashCommandBuilder } = require('discord.js');
const views = require('../interactions/registry');
const H = require('../interactions/helpers');
const K = require('../ui/kit');
const { D, item: itemDef } = require('../services/gameData');
const invRepo = require('../database/repositories/inventory');
const users = require('../database/repositories/users');
const rodRepo = require('../database/repositories/rods');

async function open(i, view, args = [], { ephemeral = true, notice } = {}) {
  const payload = await views[view].render(H.ctxOf(i), args); const p = { ...payload }; if (notice) p.content = notice; if (ephemeral) p.flags = K.EPHEMERAL; return i.reply(p);
}
/** Lệnh đơn giản: mở đúng một view. build(builder) thêm tuỳ chọn; args(i) trả mảng đối số của view. */
function simple({ name, description, view, args = () => [], build = (b) => b, ephemeral = true, skipEnsure = false }) {
  const data = build(new SlashCommandBuilder().setName(name).setDescription(description));
  return { data, skipEnsure, execute: (i) => open(i, view, args(i), { ephemeral }) };
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
/** Lọc danh sách {name,value} theo từ khoá gõ dở (không dấu). */
const filterChoices = (list, q) => { const n = norm(q); return list.filter((x) => !n || norm(x.name).includes(n) || norm(x.value).includes(n)).slice(0, 25).map((x) => ({ name: x.name.slice(0, 100), value: String(x.value).slice(0, 100) })); };
const choices = {
  baits: (uid) => invRepo.all(uid).filter((r) => D.baits.has(r.item_id)).map((r) => ({ name: `${D.baits.get(r.item_id).name} ×${r.qty}`, value: r.item_id })),
  locations: (uid) => users.unlockedLocations(uid).map((id) => ({ name: D.locations.get(id).name, value: id })),
  items: (uid, pred = () => true) => invRepo.all(uid).map((r) => ({ r, d: itemDef(r.item_id) })).filter((x) => x.d && pred(x.d)).map((x) => ({ name: `${x.d.name} ×${x.r.qty}`, value: x.d.id })),
  allItems: () => [...D.itemList, ...D.baitList].map((d) => ({ name: d.name, value: d.id })),
  rods: () => D.rodList.map((d) => ({ name: `${d.name} (${d.tierName})`, value: d.id })),
  fishes: () => D.fishList.map((d) => ({ name: d.name, value: d.id })),
  bosses: () => D.bossList.map((d) => ({ name: d.name, value: d.id })),
  templates: () => D.events.templates.map((t) => ({ name: t.name, value: t.key })),
  myRods: (uid) => rodRepo.list(uid).map((r) => ({ name: K.rodName(r), value: String(r.id) })),
};
module.exports = { open, simple, filterChoices, choices, norm };
