'use strict';
const { getDb } = require('../connection');
const db = () => getDb();
const parse = (r) => (r ? { ...r, data: JSON.parse(r.data || '{}') } : null);
const get = (id) => parse(db().get('SELECT * FROM fishing_sessions WHERE id=?', id));
const active = (userId) => parse(db().get("SELECT * FROM fishing_sessions WHERE user_id=? AND state IN ('waiting','bite','reeling')", userId));
const allActive = () => db().all("SELECT * FROM fishing_sessions WHERE state IN ('waiting','bite','reeling')").map(parse);
function create(s) { return db().run('INSERT INTO fishing_sessions(user_id,kind,location,rod_instance_id,bait_id,state,nonce,started_at,bite_at,deadline_at,channel_id,message_id,data) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', s.user_id, s.kind || 'fish', s.location ?? null, s.rod_instance_id ?? null, s.bait_id ?? null, s.state, s.nonce, s.started_at, s.bite_at ?? null, s.deadline_at ?? null, s.channel_id ?? null, s.message_id ?? null, JSON.stringify(s.data || {})).lastInsertRowid; }
const FIELDS = ['state', 'nonce', 'bite_at', 'deadline_at', 'ended_at', 'channel_id', 'message_id', 'result'];
function update(id, f) { const ks = Object.keys(f); const sets = []; const a = []; for (const k of ks) { if (k === 'data') { sets.push('data=?'); a.push(JSON.stringify(f[k])); } else if (FIELDS.includes(k)) { sets.push(`${k}=?`); a.push(f[k]); } else throw new Error(`Trường phiên không hợp lệ: ${k}`); } db().run(`UPDATE fishing_sessions SET ${sets.join(',')} WHERE id=?`, ...a, id); }
const purgeOld = (before) => db().run("DELETE FROM fishing_sessions WHERE ended_at IS NOT NULL AND ended_at<?", before).changes;
module.exports = { get, active, allActive, create, update, purgeOld };
