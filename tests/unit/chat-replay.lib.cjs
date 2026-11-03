/**
 * chat-replay — an OFFLINE multi-turn replay of a chat through a Main export (DATE-PHRASING R1, plan §10: the test gap of
 * 2026-11-01 — an owner script was handed out without ever being run through the staged path, and its first line hit a
 * date phrasing the resolver refused).
 *
 * WHAT RUNS: every Code node from the export as written; IF, Switch and Set nodes evaluated from their own parameters
 * (the n8n expression `={{ … }}` as JavaScript; the IF/Switch operators this workflow uses); the graph walked depth-first
 * in connection order, as n8n's v1 execution order does.
 * WHAT IS STUBBED, and how: every Postgres, Calendar, LLM and Telegram node, by name, backed by an in-memory store — one
 * conversation row (written from Save State's own `queryReplacement`, read back in Load State's shape), an appointments
 * list (Write Appointment / the reschedule update / the cancel update, from their own parameters), a calendar (empty
 * unless a booking was made in the replay). The webhook-to-dedupe front is a synthetic `Normalize Inbound` item.
 * WHAT IS GIVEN: the model's answer for every turn (a recorded one, or one written in the test) — the LLM is never
 * called. That is the one assumption, and the test states it per turn.
 * WHAT IT DOES NOT PROVE: the model's own extraction, n8n's runtime, Postgres or Google executing anything, the Turnstile
 * front (the replay starts after it). Synthetic identities only.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DateTime } = require(join(__dirname, '../../scripts/node_modules/luxon'));

const UPSTREAM_LIMIT = 400;   // node runs per turn: a loop in the walk is a defect of the replay, never silent

function makeReplay(exportJson, { nowISO, sender = 'widget:w-replay', configPatch = null } = {}) {
  const wf = typeof exportJson === 'string' ? JSON.parse(readFileSync(exportJson, 'utf8')) : exportJson;
  const N = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const C = wf.connections;
  // The clock: `DateTime.now()` AND a bare `DateTime.utc()` (Build Reply Payload's session gap reads the latter) are the
  // pinned instant; everything else is the real Luxon. A replay that pinned only `now` greeted every second turn with
  // "Welcome back!" — the gap was measured against the machine's real clock.
  const pinned = () => DateTime.fromISO(nowISO, { zone: 'utc' });
  const clock = nowISO ? new Proxy(DateTime, { get: (t, p) => (p === 'now' ? pinned
    : p === 'utc' ? (...a) => (a.length ? DateTime.utc(...a) : pinned()) : Reflect.get(t, p)) }) : DateTime;
  const now = () => clock.now();
  const db = { conv: null, appts: [], calendar: [], alerts: [] };
  const staticData = {};
  let out, outAll, path, replies, model, turnNo = 0;

  const $ = (name) => {
    if (!(name in out)) throw new Error(`replay: unexecuted ref ${name}`);
    const items = out[name], br = (k) => (k === undefined ? items : (outAll[name][k] || []));
    return { first: (k) => ({ json: br(k)[0] }), last: (k) => ({ json: br(k)[br(k).length - 1] }), all: (k) => br(k).map((j) => ({ json: j })),
      item: { json: items[0] }, isExecuted: true };
  };
  const ev = (s, j) => {
    if (typeof s !== 'string' || !s.startsWith('=')) return s;
    const body = s.slice(1);
    const f = (e) => new Function('$', '$json', '$now', 'DateTime', `return (${e});`)($, j, now(), clock);
    const whole = body.match(/^\s*\{\{([\s\S]*)\}\}\s*$/);
    if (whole) return f(whole[1]);
    return body.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => String(f(e)));
  };
  const cond = (c, j) => {
    const l = ev(c.leftValue, j), r = ev(c.rightValue, j), op = c.operator;
    switch (`${op.type}:${op.operation}`) {
      case 'boolean:true': return l === true;
      case 'boolean:false': return l === false;
      case 'string:equals': return l === r;
      case 'string:notEquals': return l !== r;
      case 'string:notEmpty': return typeof l === 'string' && l.length > 0;
      case 'string:regex': { const m = String(r).match(/^\/(.*)\/([a-z]*)$/s); return new RegExp(m ? m[1] : r, m ? m[2] : '').test(String(l ?? '')); }
      case 'number:lte': return Number(l) <= Number(r);
      case 'number:lt': return Number(l) < Number(r);
      default: throw new Error(`replay: operator ${op.type}:${op.operation} is not implemented`);
    }
  };
  const all = (cs, j) => (cs.conditions || []).every((c) => cond(c, j));
  const fields = (row) => Object.fromEntries(Object.entries(row).filter(([k, v]) => k !== 'id' && v !== '' && v !== null && v !== undefined));
  const convRow = () => ({ id: 'conv-replay', createdTime: '2026-01-01T00:00:00.000Z', fields: fields(db.conv) });
  const apptRow = (a) => ({ id: a.id, createdTime: a.created_at, fields: fields(a) });
  const params = (name, j) => ev(N[name].parameters.options.queryReplacement, j);
  const event = (b) => ({ kind: 'calendar#event', id: b.eventId, status: 'confirmed', summary: b.summary,
    start: { dateTime: b.startUTC, timeZone: 'UTC' }, end: { dateTime: b.endUTC, timeZone: 'UTC' } });
  const cfg = () => out['Load Config'][0].config;
  function saveConv(p) {
    const keys = ['sender_key', 'stage', 'turn_count', 'last_updated', 'last_intent', 'slot_service', 'slot_date', 'slot_time',
      'gcal_event_id', 'cancel_target_id', 'confirm_turn', 'computed_reply', 'recent_messages', 'slot_name'];
    db.conv = { ...(db.conv || {}), ...Object.fromEntries(keys.map((k, i) => [k, p[i]])) };
    return [convRow()];
  }
  const bookings = () => { const rows = db.appts.filter((a) => a.status === 'booked' && a.start_utc > now().toUTC().toISO()).map(apptRow); return rows.length ? rows : [{}]; };

  const STUB = {
    'Load State': () => [db.conv ? convRow() : {}],
    'Save State': (j) => saveConv(params('Save State', j)),
    'Save State (Post-Write)': (j) => saveConv(params('Save State (Post-Write)', j)),
    'Find Conversation Row': () => (db.conv ? [convRow()] : []),          // no alwaysOutputData: no row → no item
    'Re-read Cancel State': () => [db.conv ? convRow() : {}],
    'Read Spend': () => [{ id: 'm-replay', createdTime: '2026-01-01T00:00:00.000Z', fields: { period_key: now().toUTC().toFormat('yyyy-MM'), cost_usd: 0 } }],
    'Record LLM Spend': (j) => [{ id: 'm-replay', fields: { period_key: j.period_key, cost_usd: j.cost_usd } }],
    'Record Alert Class': () => [convRow()],
    'Send Owner Alert (Telegram)': (j) => { db.alerts.push(j._alert_class || null); return [{ ok: true }]; },
    // A model answer carrying `__llmError: true` makes the call FAIL: n8n's error item on output 1, as continueErrorOutput
    // routes it (CLOSE-OUT R2, to pin the unsaved-transient-turn bound; no other test uses the field).
    'Extract Intent': () => (model && model.__llmError
      ? { __outputs: [[], [{ error: { message: 'replay: the LLM call failed' }, message: 'replay: the LLM call failed' }]] }
      : [{ model: 'replay', type: 'message', role: 'assistant', content: [{ type: 'text', text: JSON.stringify(model) }],
        stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }]),
    'Get Calendar Busy': () => [{ kind: 'calendar#freeBusy', calendars: { [cfg().googleCalendarId]: { busy: [] } } }],
    'Get Reschedule Busy': () => [{ kind: 'calendar#freeBusy', calendars: { [cfg().googleCalendarId]: { busy: [] } } }],
    'Book Appointment': (j) => { db.calendar.push(event(j.booking)); return [event(j.booking)]; },
    'Book Reschedule Appointment': (j) => { db.calendar.push(event(j.booking)); return [event(j.booking)]; },
    'Verify Slot': () => [{ kind: 'calendar#events', timeZone: cfg().business.timezone, items: db.calendar.slice(-1) }],
    'Verify Slot (Reschedule)': () => [{ kind: 'calendar#events', timeZone: cfg().business.timezone, items: db.calendar.slice(-1) }],
    'Write Appointment': (j) => {
      const p = params('Write Appointment', j);
      let a = db.appts.find((x) => x.gcal_event_id === p[4]);
      if (!a) { a = { id: `appt-${db.appts.length + 1}`, created_at: now().toUTC().toISO() }; db.appts.push(a); }
      // the node's own upsert: a NULL or '' name never blanks a stored one (COALESCE(NULLIF(EXCLUDED.customer_name, ''), …))
      Object.assign(a, { sender_key: p[0], service: p[1], start_utc: p[2], end_utc: p[3], gcal_event_id: p[4], channel: p[5],
        customer_name: (p[6] === null || p[6] === '') ? (a.customer_name ?? p[6]) : p[6], status: 'booked', calendar_id: p[8] });
      return [apptRow(a)];
    },
    'Find Booking': () => bookings(),
    'Find Booking (Reschedule)': () => bookings(),
    'Find Old Booking (Reschedule)': () => bookings(),
    'Delete Booking Event': (j) => { db.calendar = db.calendar.filter((e) => e.id !== (j._cancel_target || {}).eventId); return [{ statusCode: 204, statusMessage: 'No Content', headers: {} }]; },
    'Delete Old Event (Reschedule)': () => [{ statusCode: 204, statusMessage: 'No Content', headers: {} }],
    'Update Appointment Cancelled': (j) => { const a = db.appts.find((x) => x.id === params('Update Appointment Cancelled', j)[0]); a.status = 'cancelled'; return [apptRow(a)]; },
    'Update Appointment (Reschedule)': (j) => { const p = params('Update Appointment (Reschedule)', j); const a = db.appts.find((x) => x.id === p[0]);
      Object.assign(a, { gcal_event_id: p[1], start_utc: p[2], end_utc: p[3], calendar_id: p[4] }); return [apptRow(a)]; },
  };

  function runNode(name, items) {
    const n = N[name], t = n.type.split('.').pop(), j = items[0] || {};
    path.push(name);
    if (path.length > UPSTREAM_LIMIT) throw new Error('replay: the walk did not end');
    if (STUB[name]) { const r = STUB[name](j); return r && r.__outputs ? r.__outputs : [r]; }
    if (t === 'code') {
      const r = new Function('$', '$json', '$input', 'DateTime', '$now', '$getWorkflowStaticData', n.parameters.jsCode)(
        $, j, { all: () => items.map((x) => ({ json: x })), first: () => ({ json: j }), item: { json: j } }, clock, now(), () => staticData);
      return [r.map((x) => x.json)];
    }
    if (t === 'if') { const tr = [], fa = []; for (const it of items) (all(n.parameters.conditions, it) ? tr : fa).push(it); return [tr, fa]; }
    if (t === 'switch') {
      const rules = n.parameters.rules.values, outs = rules.map(() => []).concat([[]]);
      for (const it of items) { const k = rules.findIndex((r) => all(r.conditions, it)); outs[k >= 0 ? k : rules.length].push(it); }
      return outs;
    }
    if (t === 'set') return [items.map((it) => Object.fromEntries(n.parameters.assignments.assignments.map((a) => [a.name, ev(a.value, it)])))];
    if (t === 'respondToWebhook') { replies.push(j); return [items]; }
    if (t === 'noOp') return [items];
    throw new Error(`replay: no stub for ${name} (${t}) — the walk reached a node the replay does not model`);
  }
  function walk(name, items) {
    const outs = runNode(name, items);
    out[name] = outs.find((o) => o && o.length) || [];
    outAll[name] = outs;
    (C[name]?.main || []).forEach((targets, k) => { const its = outs[k] || []; if (its.length) for (const tg of targets || []) walk(tg.node, its); });
  }
  /** One customer turn: `text` as typed, `modelAnswer` the model's JSON for it. Returns {reply, path, out, db}. */
  function turn(text, modelAnswer) {
    model = modelAnswer; out = {}; outAll = {}; path = []; replies = []; turnNo += 1;
    const lc = runNode('Load Config', [{}])[0][0];
    out['Load Config'] = [configPatch ? { ...lc, config: configPatch(JSON.parse(JSON.stringify(lc.config))) } : lc];
    path = [];
    const norm = { channel: 'widget', message_id: `m-replay-${turnNo}`, senderId: sender.split(':')[1], sender_key: sender, text };
    for (const u of ['Normalize Inbound', 'Validate Payload']) { out[u] = [norm]; outAll[u] = [out[u]]; }
    for (const u of ['Dedupe Gate', 'Is Duplicate']) { out[u] = [{ ...norm, _duplicate: false }]; outAll[u] = [out[u]]; }
    out['Receive Inbound Message'] = [{ body: { text } }]; outAll['Receive Inbound Message'] = [out['Receive Inbound Message']];
    walk('Load State', out['Is Duplicate']);
    const reply = (replies.find((r) => r && r.reply) || {}).reply ?? null;
    return { reply, path: path.slice(), out, db };
  }
  return { turn, db };
}

const BASE = { serviceId: null, date: null, dateExpr: null, time: null, customerName: null, notes: null, faqTopic: null };
/** A model answer with every slot key present (the schema requires them). */
const answer = (intent, confidence, slots = {}) => ({ intent, confidence, slots: { ...BASE, ...slots }, reply: null });

module.exports = { makeReplay, answer };
