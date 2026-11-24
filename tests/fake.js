'use strict';
/** Tương tác Discord giả để chạy toàn bộ luồng giao diện trong kiểm thử. */
const H = require('./helpers');
const stub = require('./mocks/node_modules/discord.js');
const OPT = (o) => ({ getString: (k) => o[k] ?? null, getInteger: (k) => o[k] ?? null, getNumber: (k) => o[k] ?? null, getBoolean: (k) => o[k] ?? null, getUser: (k) => o[k] ?? null, getAttachment: (k) => o[k] ?? null, getSubcommand: () => o.__sub, getFocused: (full) => (full ? { name: o.__focus, value: o.__value || '' } : o.__value || '') });
function base(user, extra = {}) {
  const log = []; const i = {
    user: { id: user, username: `u${user}`, globalName: `U${user}`, bot: false }, member: { displayName: `U${user}`, roles: { cache: new Map() } }, memberPermissions: { has: (b) => !!extra.admin }, channelId: 'chan1', client: { application: { emojis: { fetch: async () => new Map(), create: async () => ({ id: '1' }) } } }, log, replied: false, deferred: false,
    isChatInputCommand: () => false, isButton: () => false, isStringSelectMenu: () => false, isModalSubmit: () => false, isAutocomplete: () => false, isFromMessage: () => true,
    async reply(p) { i.replied = true; log.push({ kind: 'reply', p }); return { id: 'msg1' }; }, async update(p) { i.replied = true; log.push({ kind: 'update', p }); }, async editReply(p) { log.push({ kind: 'edit', p }); }, async followUp(p) { log.push({ kind: 'follow', p }); },
    async deferReply() { i.deferred = true; }, async deferUpdate() { i.deferred = true; }, async showModal(m) { log.push({ kind: 'modal', m }); }, async fetchReply() { return { id: 'msg1' }; }, async respond(c) { log.push({ kind: 'respond', c }); },
    ...extra.props,
  }; return i;
}
const slash = (user, name, opts = {}, extra = {}) => { const i = base(user, extra); i.commandName = name; i.isChatInputCommand = () => true; i.options = OPT(opts); return i; };
const auto = (user, name, focus, value = '', extra = {}) => { const i = base(user, extra); i.commandName = name; i.isAutocomplete = () => true; i.options = OPT({ __focus: focus, __value: value, ...(extra.opts || {}) }); return i; };
const click = (user, customId, extra = {}) => { const i = base(user, extra); i.customId = customId; i.isButton = () => true; return i; };
const pick = (user, customId, values, extra = {}) => { const i = base(user, extra); i.customId = customId; i.values = values; i.isStringSelectMenu = () => true; return i; };
const submit = (user, customId, fields, extra = {}) => { const i = base(user, extra); i.customId = customId; i.isModalSubmit = () => true; i.fields = { getTextInputValue: (k) => fields[k] ?? '' }; return i; };
const last = (i) => i.log.filter((x) => ['reply', 'update', 'edit', 'follow'].includes(x.kind)).pop();
/** Kiểm tra payload cuối theo giới hạn Discord; trả về payload. */
function check(i, label) { for (const x of i.log) if (x.p && (x.p.embeds || x.p.components || x.p.files || x.p.content)) { const errs = stub.validatePayload(x.p, label); if (errs.length) throw new Error(errs.join(' | '));
    const txt = JSON.stringify([(x.p.embeds || []).map((e) => (e.toJSON ? e.toJSON() : e)), x.p.content]); const m = txt.match(/.{0,40}(undefined|NaN|\[object Object\]|Infinity).{0,30}/); if (m) throw new Error(`Văn bản lỗi định dạng (${label}): ${m[0]}`); } return last(i)?.p; }
const comps = (p) => (p?.components || []).flatMap((r) => (r.toJSON ? r.toJSON() : r).components.map((c) => (c.toJSON ? c.toJSON() : c)));
module.exports = { slash, auto, click, pick, submit, last, check, comps, validatePayload: stub.validatePayload };
