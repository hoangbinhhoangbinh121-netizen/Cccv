'use strict';
/**
 * Lệnh tiền tố (mặc định `.`): gõ `.cauca`, `.kho`, `.cuahang mua …` thay cho slash command.
 * Không viết lại logic game: tin nhắn được đổi thành một "tương tác giả" (PrefixInteraction) có cùng giao diện với
 * ChatInputCommandInteraction, rồi đi qua đúng bộ định tuyến (giới hạn tốc độ, khoá theo người chơi, bắt lỗi) như slash command.
 * Tham số được đọc theo khai báo của chính lệnh slash: `.lệnh [lệnh-con] giá-trị1 giá-trị2 …` (dùng "dấu ngoặc kép" cho giá trị có dấu cách).
 * Cần bật Message Content Intent trong Developer Portal (xem README); thiếu thì bot vẫn chạy bình thường, chỉ không đọc được lệnh `.`.
 */
const config = require('./config');
const logger = require('./utils/logger');
const router = require('./interactions/router');
const ratelimit = require('./utils/ratelimit');
const K = require('./ui/kit');
const { GameError } = require('./utils/errors');

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const key = (s) => norm(s).replace(/[^a-z0-9]/g, ''); // bỏ _ và - : "ban_ca" ≡ "banca" ≡ "ban-ca"

/** Tên gọi tắt dễ gõ. Không dùng 1 chữ cái (dễ trùng với chat thường như ".k"). */
const ALIASES = {
  cauca: ['c', 'cau', 'fish'], khuvuc: ['kv', 'map'], codex: ['cdx'], sukien: ['sk', 'event'],
  thongtin: ['tt', 'me', 'profile'], daily: ['dd', 'diemdanh'], nhiemvu: ['nv', 'quest'], thanh_tuu: ['tht'], bangxephang: ['bxh', 'top'], huongdan: ['help', 'hd'],
  cancau: ['rod'], nangcap: ['nc'], cuonghoa: ['cuong'], khamda: ['kd', 'gem'], thuctinh: ['tinh'], chetao: ['ct', 'craft'],
  kho: ['bag', 'inv'], khoca: ['kc'], ban_ca: ['ban', 'sell'], sudung: ['sd', 'use'],
  cuahang: ['shop', 'ch'], giaodich: ['gd', 'pay'], thitruong: ['cho', 'market'], muamoi: ['mua', 'buy'],
  thucung: ['pet', 'tc'], boss: [], toidau: ['td', 'attack'],
  ngutruong: ['nt', 'giaitri', 'arcade'],
  backupdb: ['backup'], restore_db: ['restore'], 'fishing-admin': ['fa', 'admin'], 'fishing-event': ['fe'], 'fishing-config': ['fc', 'config'], 'fishing-backup': ['fb'], 'fishing-restore': [],
};

/** Lối tắt vào thẳng một lệnh con: `.dua` ≡ `.ngutruong dua`. */
const SUB_ALIASES = { dua: ['ngutruong', 'dua'], race: ['ngutruong', 'dua'], taixiu: ['ngutruong', 'taixiu'], tx: ['ngutruong', 'taixiu'], bihop: ['ngutruong', 'bihop'], hop: ['ngutruong', 'bihop'], quiz: ['ngutruong', 'quiz'], suutam: ['ngutruong', 'suutam'], nvgt: ['ngutruong', 'nhiemvu'], bxhgt: ['ngutruong', 'xephang'] };
let table = new Map(); // key → { name, cmd, sub? }
let commandsRef = new Map();
function setCommands(commands) {
  commandsRef = commands; table = new Map();
  for (const [name, cmd] of commands) {
    for (const k of [key(name), ...(ALIASES[name] || []).map(key)]) if (k && !table.has(k)) table.set(k, { name, cmd });
  }
  for (const [alias, [name, sub]] of Object.entries(SUB_ALIASES)) { const cmd = commands.get(name); if (cmd && !table.has(key(alias))) table.set(key(alias), { name, cmd, sub }); }
}

/* ------------------------------------------------------------------ đọc tham số */
function tokenize(s) {
  const out = []; const re = /"([^"]*)"|“([^”]*)”|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
function parseNumber(raw, integer) {
  let t = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.000.000 kiểu Việt Nam
  t = t.replace(/[_,]/g, '');
  const m = t.match(/^(\d+(?:\.\d+)?)(k|tr|m|b)?$/);
  if (!m) return null;
  const mult = { k: 1e3, tr: 1e6, m: 1e6, b: 1e9 }[m[2]] || 1; const v = parseFloat(m[1]) * mult;
  return integer ? Math.trunc(v) : v;
}
const TRUE = new Set(['1', 'true', 'yes', 'y', 'co', 'on', 'bat']); const FALSE = new Set(['0', 'false', 'no', 'n', 'khong', 'off', 'tat']);
const optLabel = (o) => (o.required ? `<${o.name}>` : `[${o.name}]`);
function usageText(name, json, sub) {
  const p = config.prefix;
  if (json.options?.some((o) => o.type === 1) && !sub) return `\`${p}${name} <${json.options.filter((o) => o.type === 1).map((o) => o.name).join(' | ')}> …\``;
  const opts = sub ? sub.options || [] : json.options || [];
  return `\`${p}${name}${sub ? ` ${sub.name}` : ''}${opts.map((o) => ` ${optLabel(o)}`).join('')}\``;
}
const usageErr = (name, json, sub, why) => new GameError(`${why ? `${why}\n` : ''}Cách dùng: ${usageText(name, json, sub)}\nGõ \`${config.prefix}lenh\` để xem danh sách lệnh.`, 'USAGE');

/** Tự động hoàn thành giống slash command để gõ tên thay vì ID (vd. ".cauca ao lang" → ao_lang). */
async function viaAutocomplete(cmd, user, optName, raw, sub, vals) {
  if (typeof cmd.autocomplete !== 'function') return raw;
  const fake = { user, options: { getFocused: (full) => (full ? { name: optName, value: raw } : raw), getSubcommand: () => sub, getString: (k) => vals[k] ?? null }, commandName: cmd.data?.name };
  try {
    const list = await cmd.autocomplete(fake); if (!Array.isArray(list) || !list.length) return raw;
    const n = norm(raw); const exact = list.find((x) => norm(x.value) === n || norm(x.name) === n || norm(x.name).startsWith(n));
    return (exact || list[0]).value;
  } catch { return raw; }
}
async function parseArgs(name, cmd, tokens, msg) {
  const json = cmd.data.toJSON(); let opts = json.options || []; let sub = null; const vals = {};
  const subs = opts.filter((o) => o.type === 1);
  if (subs.length) {
    const t = tokens.shift(); const found = t && subs.find((s) => key(s.name) === key(t));
    if (!found) throw usageErr(name, json, null, t ? `Không có lệnh con **${t}**.` : 'Thiếu lệnh con.');
    sub = found; opts = found.options || [];
  }
  for (let idx = 0; idx < opts.length; idx++) {
    const o = opts[idx];
    if (o.type === 11) { const a = msg.attachments?.first?.(); if (a) vals[o.name] = a; else if (o.required) throw usageErr(name, json, sub, `Hãy đính kèm tệp vào tin nhắn (**${o.name}**).`); continue; }
    if (!tokens.length) { if (o.required) throw usageErr(name, json, sub, `Thiếu **${o.name}**.`); continue; }
    const restIsText = o.type === 3 && !o.choices?.length && opts.slice(idx + 1).every((x) => x.type === 11);
    const raw = restIsText ? tokens.splice(0).join(' ') : tokens.shift();
    if (o.type === 3) {
      if (o.choices?.length) { const c = o.choices.find((x) => key(x.value) === key(raw) || key(x.name) === key(raw)); if (!c) throw usageErr(name, json, sub, `**${o.name}** phải là một trong: ${o.choices.map((x) => `\`${x.value}\``).join(', ')}.`); vals[o.name] = String(c.value); }
      else vals[o.name] = o.autocomplete ? String(await viaAutocomplete(cmd, msg.author, o.name, raw, sub?.name, vals)) : raw;
    } else if (o.type === 4 || o.type === 10) {
      const v = parseNumber(raw, o.type === 4); if (v === null || !Number.isFinite(v)) throw usageErr(name, json, sub, `**${o.name}** phải là một số (nhận: "${raw}").`);
      const lo = o.min_value ?? o.min; const hi = o.max_value ?? o.max; // giữ đúng giới hạn như slash command
      if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) throw usageErr(name, json, sub, `**${o.name}** phải nằm trong khoảng ${lo ?? '…'} – ${hi ?? '…'}.`);
      vals[o.name] = v;
    } else if (o.type === 5) {
      const t = key(raw); if (TRUE.has(t)) vals[o.name] = true; else if (FALSE.has(t)) vals[o.name] = false; else throw usageErr(name, json, sub, `**${o.name}** chỉ nhận có/không.`);
    } else if (o.type === 6) {
      const id = (String(raw).match(/^<@!?(\d+)>$/) || String(raw).match(/^(\d{15,22})$/) || [])[1];
      let u = id && (msg.mentions?.users?.get?.(id) || null);
      if (id && !u) { try { u = await msg.client.users.fetch(id); } catch { u = null; } }
      if (!u) throw usageErr(name, json, sub, `Không tìm thấy người dùng "${raw}" (hãy @nhắc tên hoặc dán ID).`); vals[o.name] = u;
    } else vals[o.name] = raw;
  }
  return { sub: sub?.name || null, vals };
}

/* ------------------------------------------------------------------ "tương tác giả" từ tin nhắn */
const EPHEMERAL_BIT = 64;
function sendable(p, { first, msg } = {}) {
  const o = typeof p === 'string' ? { content: p } : { ...p };
  delete o.flags; delete o.ephemeral; delete o.attachments; // tin nhắn thường không có ephemeral
  if (first) o.reply = { messageReference: msg.id, failIfNotExists: false };
  o.allowedMentions = { parse: [], repliedUser: false };
  return o;
}
class PrefixInteraction {
  constructor(msg, commandName, sub, vals) {
    this.message = msg; this.isPrefix = true; this.commandName = commandName; this.user = msg.author; this.member = msg.member || null; this.guild = msg.guild; this.guildId = msg.guildId;
    this.channel = msg.channel; this.channelId = msg.channelId; this.client = msg.client; this.memberPermissions = msg.member?.permissions || null;
    this.deferred = false; this.replied = false; this._msg = null; this._first = true;
    const g = (k) => (vals[k] === undefined ? null : vals[k]);
    this.options = {
      getString: g, getInteger: g, getNumber: g, getBoolean: g, getUser: g, getAttachment: g, getChannel: g,
      getSubcommand: (req = true) => { if (!sub && req) throw new Error('Không có lệnh con'); return sub; }, getFocused: () => '',
    };
  }
  isChatInputCommand() { return true; } isAutocomplete() { return false; } isButton() { return false; } isStringSelectMenu() { return false; } isModalSubmit() { return false; } isFromMessage() { return false; }
  async _send(p) { const m = await this.channel.send(sendable(p, { first: this._first, msg: this.message })); this._first = false; return m; }
  async reply(p) { this.replied = true; this._msg = await this._send(p); return this._msg; }
  async deferReply() { this.deferred = true; try { await this.channel.sendTyping?.(); } catch { /* không bắt buộc */ } }
  async editReply(p) {
    this.replied = true;
    if (!this._msg) { this._msg = await this._send(p); return this._msg; }
    const o = sendable(p); delete o.reply; return this._msg.edit(o);
  }
  async followUp(p) { this.replied = true; return this._send(p); }
  async fetchReply() { return this._msg; }
  async deferUpdate() { /* không áp dụng cho tin nhắn */ }
}

/* ------------------------------------------------------------------ trợ giúp & bộ xử lý */
function helpPayload() {
  const p = config.prefix; const lines = [];
  for (const [name, cmd] of commandsRef) {
    const al = (ALIASES[name] || []).map((a) => `${p}${a}`); const d = cmd.data.toJSON().description || '';
    lines.push(`\`${p}${name}\`${al.length ? ` (${al.join(', ')})` : ''} — ${d}`);
  }
  let desc = `Gõ lệnh với tiền tố **\`${p}\`** thay cho \`/\`. Ví dụ: \`${p}cauca\`, \`${p}kho\`, \`${p}ban_ca\`, \`${p}giaodich @bạn 1k\`.\nGiá trị có dấu cách đặt trong "ngoặc kép". Số hỗ trợ \`1k\`, \`2.5m\`, \`1.000.000\`.\n\n${lines.join('\n')}`;
  if (desc.length > 4000) desc = `${desc.slice(0, 3990)}…`;
  return { embeds: [K.embed({ title: '⌨️ Lệnh tiền tố', desc, color: K.COLOR.info })] };
}
const HELP_WORDS = new Set(['lenh', 'lenhhelp', 'cmds', 'commands']);

async function onMessage(msg) {
  try {
    const p = config.prefix;
    if (!config.prefixEnabled || !p || msg.author?.bot || !msg.guild || typeof msg.content !== 'string' || !msg.content.startsWith(p)) return;
    const body = msg.content.slice(p.length); if (!body || /^[\s.\-_~*!?,;:]/.test(body)) return; // ".", "...", ". abc" … là chat thường
    const tokens = tokenize(body); const word = key(tokens.shift() || ''); if (!word) return;
    const help = HELP_WORDS.has(word); const ent = help ? null : table.get(word); if (!help && !ent) return; // không phải lệnh → im lặng
    if (!ratelimit.take(`p:${msg.author.id}`, { capacity: 6, perSec: 1 }).ok) return;
    const reply = (payload) => msg.channel.send(sendable(payload, { first: true, msg })).catch((e) => logger.warn(`Không gửi được trả lời lệnh ${p}: ${e.message}`));
    if (help) return void (await reply(helpPayload()));
    if (ent.sub) tokens.unshift(ent.sub);
    let parsed;
    try { parsed = await parseArgs(ent.name, ent.cmd, tokens, msg); }
    catch (e) { if (e instanceof GameError) return void (await reply(require('./interactions/helpers').errorPayload(e.message))); throw e; }
    const i = new PrefixInteraction(msg, ent.name, parsed.sub, parsed.vals);
    await router.runCommand(i, ent.cmd);
  } catch (e) { logger.error(`Lệnh tiền tố lỗi: ${e.stack || e.message}`); }
}
module.exports = { onMessage, setCommands, parseArgs, tokenize, parseNumber, PrefixInteraction, ALIASES, SUB_ALIASES, key, _table: () => table };
