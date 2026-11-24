'use strict';
/** Bộ dựng Embed / Nút / Menu / Modal theo giới hạn của Discord (cắt gọn tự động) + định dạng chung. */
const dj = require('discord.js');
const emoji = require('./emoji');
const R = require('../systems/rarity');
const { D } = require('../services/gameData');
const F = require('../utils/format');

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = dj;
const EPHEMERAL = 64;
const STYLE = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
const COLOR = { info: 0x4aa3df, ok: 0x57c37a, warn: 0xf0b840, err: 0xe5534b, dark: 0x2b2d31, gold: 0xffc83d };

/** custom_id: v|<uid>|<view>|<act>|<args…> (≤100 ký tự). */
function cid(...parts) { const s = parts.map((x) => (x === undefined || x === null ? '' : x)).join('|'); if (s.length > 100) throw new Error(`custom_id quá dài (${s.length}): ${s}`); return s; }
function embed({ title, desc, color = COLOR.info, fields = [], thumb, image, footer, author, timestamp } = {}) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(F.clip(title, 256)); if (desc) e.setDescription(F.clip(desc, 4000));
  const fs = fields.filter((f) => f && f.value !== undefined && f.value !== '').slice(0, 25).map((f) => ({ name: F.clip(f.name, 256) || '​', value: F.clip(String(f.value), 1024) || '​', inline: !!f.inline }));
  if (fs.length) e.addFields(fs); if (thumb) e.setThumbnail(thumb); if (image) e.setImage(image); if (footer) e.setFooter({ text: F.clip(footer, 2048) }); if (author) e.setAuthor({ name: F.clip(author, 256) }); if (timestamp) e.setTimestamp();
  return e;
}
function button({ id, label, style = 'secondary', emoji: em, disabled = false, url }) {
  const b = new ButtonBuilder().setStyle(url ? ButtonStyle.Link : STYLE[style]); if (url) b.setURL(url); else b.setCustomId(id);
  if (label) b.setLabel(F.clip(label, 80)); if (em) b.setEmoji(em); return b.setDisabled(!!disabled);
}
/** Gom các nút vào tối đa 5 hàng (5 nút/hàng). */
function rows(items) { const out = []; let cur = []; for (const it of items.filter(Boolean)) { if (it.__row) { if (cur.length) out.push(cur); cur = []; out.push(it.items); continue; } cur.push(it); if (cur.length === 5) { out.push(cur); cur = []; } } if (cur.length) out.push(cur); return out.slice(0, 5).map((r) => new ActionRowBuilder().addComponents(...r)); }
const selectRow = (items) => ({ __row: true, items });
function select({ id, placeholder, options, min = 1, max = 1, disabled = false }) {
  const opts = options.slice(0, 25).map((o) => { const x = { label: F.clip(o.label, 100), value: String(o.value).slice(0, 100) }; if (o.description) x.description = F.clip(o.description, 100); if (o.emoji) x.emoji = o.emoji; if (o.default) x.default = true; return x; });
  if (!opts.length) return null; const m = new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(F.clip(placeholder || 'Chọn…', 150)).setMinValues(Math.min(min, opts.length)).setMaxValues(Math.min(max, opts.length)).addOptions(opts).setDisabled(disabled);
  return selectRow([m]);
}
function modal({ id, title, fields }) {
  const m = new ModalBuilder().setCustomId(id).setTitle(F.clip(title, 45));
  for (const f of fields) { const row = new ActionRowBuilder(); const ti = (new TextInputBuilder().setCustomId(f.id).setLabel(F.clip(f.label, 45)).setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(f.required !== false).setMaxLength(f.max || 100)); if (f.placeholder) ti.setPlaceholder(F.clip(f.placeholder, 100)); row.addComponents(ti); m.addComponents(row); };
  return m;
}
/** Phân trang chuẩn: [◀] trang/tổng [▶] */
function pager(uid, view, act, page, pages, extra = []) {
  return [button({ id: cid('v', uid, view, `${act}p`, page - 1, ...extra), label: '◀', disabled: page <= 0 }), button({ id: cid('v', uid, view, 'noop'), label: `${page + 1}/${Math.max(1, pages)}`, disabled: true }), button({ id: cid('v', uid, view, `${act}p`, page + 1, ...extra), label: '▶', disabled: page >= pages - 1 })];
}
/** Gói payload gửi đi: embeds + components + files (loại trùng tên tệp). */
function msg({ embeds = [], components = [], files = [], content } = {}) {
  const seen = new Set(); const fl = []; for (const f of files.filter(Boolean)) { const n = f.name || f.attachment; if (seen.has(n)) continue; seen.add(n); fl.push(f); }
  const p = { embeds: (Array.isArray(embeds) ? embeds : [embeds]).slice(0, 10), components, files: fl }; if (content !== undefined) p.content = content; return p;
}
/** Ảnh pixel art dưới dạng {url, file} để gắn vào embed. */
const img = (kind, id, name) => emoji.attach(kind, id, name);
const E = emoji.e;
const rar = (r) => `${R.mark(r)} ${R.name(r)}`;
const rodName = (inst) => { const d = D.rods.get(inst.rod_id); return `${d.name} Lv${inst.level}${inst.enhance ? ` +${inst.enhance}` : ''}${inst.awaken ? ` ${'✦'.repeat(inst.awaken)}` : ''}`; };
const itemName = (id) => { const d = require('../services/gameData').item(id); return d ? d.name : id; };
const itemLine = (id, q) => `${itemEmoji(id)} ${itemName(id)}${q != null ? ` ×${F.num(q)}` : ''}`;
function itemEmoji(id) { if (D.baits.has(id)) return E('baits', id); return E('items', id); }
const itemsText = (obj) => Object.entries(obj || {}).map(([k, v]) => itemLine(k, v)).join(', ') || '—';
const rewardText = (rw) => [rw.xu && `${E('ui', 'coin')} ${F.num(rw.xu)} xu`, rw.exp && `${E('ui', 'exp')} ${F.num(rw.exp)} EXP`, rw.items && itemsText(rw.items), rw.title && `🎖️ ${D.titles[rw.title]}`].filter(Boolean).join(' · ') || '—';
module.exports = { dj, COLOR, EPHEMERAL, cid, embed, button, rows, select, selectRow, modal, pager, msg, img, E, rar, rodName, itemName, itemLine, itemEmoji, itemsText, rewardText, F, emoji };
