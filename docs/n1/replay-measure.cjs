/**
 * N1 MEASUREMENT (docs/N1-CONFIRM-NO-PLAN.md §0) — what the COMMITTED Main does when a customer answers the booking
 * confirm "… shall I book it? (yes / no)" with something other than yes. Offline, through the committed chat-replay
 * harness (tests/unit/chat-replay.lib.cjs says what runs, what is stubbed and what it does not prove).
 *
 * THE ASSUMPTION, per row: the model's answer is GIVEN, never called. The first answer for each phrase is the one the
 * prompt instructs at stage `confirming` (Build LLM Request: "A DIFFERENT service/date/time means intent=book …
 * Decline/cancel means intent=cancel. Unclear means low confidence."); rows marked `alt` are plausible deviations.
 * Part C writes the PROPOSED post-decline state (stage `collecting`, slots and name kept, last_intent `declined`) into
 * the replay's in-memory store and measures what today's engine does from there — the export is not changed.
 * Synthetic identities only. Run: node docs/n1/replay-measure.cjs  (output committed beside it as replay-measure.out.txt)
 * Not part of check-all: a record of one measurement for a plan, not a guard.
 */
const { join } = require('node:path');
const ROOT = join(__dirname, '..', '..');
const { makeReplay, answer } = require(join(ROOT, 'tests/unit/chat-replay.lib.cjs'));
const EXPORT = join(ROOT, 'n8n/workflow.main.sanitized.json');
const AT = '2026-11-01T20:08:00Z';   // a Sunday evening, Vienna; "Wednesday" = 4 Nov 2026

const state = (db) => db.conv && ({ stage: db.conv.stage, last_intent: db.conv.last_intent, slots: [db.conv.slot_service, db.conv.slot_date,
  db.conv.slot_time, db.conv.slot_name].map((v) => v || '-').join(' '), appointments: db.appts.map((a) => `${a.service}@${a.start_utc}:${a.status}`),
  calendar_events: db.calendar.length, owner_alerts: db.alerts.slice() });
const KEY = new Set(['Uncertain Turn?', 'Repeat Uncertain?', 'Build Clarify State', 'Mark Handoff', 'Route Intent', 'Merge Slots', 'Availability Gate',
  'Find Booking', 'Cancel Route', 'Build No-Booking Reply', 'Build Cancel-Confirm State', 'Build Cancel-Aborted State', 'Answer FAQ',
  'Confirm Router', 'Build Event Request', 'Event ID Valid?', 'Book Appointment', 'Write Appointment', 'Extract Intent']);
const line = (label, o, r) => [`${label}`, `    reply : ${o.reply}`, `    route : ${o.path.filter((p) => KEY.has(p)).join(' > ')}`,
  `    after : ${JSON.stringify(state(r.db))}`].join('\n');
const desc = (m) => `${m.intent}/${m.confidence}${Object.entries(m.slots).filter(([, v]) => v !== null).map(([k, v]) => ` ${k}=${v}`).join('')}`;

function atConfirm({ existing = false } = {}) {
  const r = makeReplay(EXPORT, { nowISO: AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' }));
  const c = r.turn('Kim Moss', answer('unknown', 0.3));
  if (!existing) return { r, ask: c.reply };
  r.turn('yes', answer('confirm', 0.92));
  const c2 = r.turn('and a beard trim on Friday at 10:00', answer('book', 0.9, { serviceId: 'beard', dateExpr: 'friday', time: '10:00' }));
  return { r, ask: c2.reply };
}

const out = [];
{ const { r, ask } = atConfirm(); out.push(`SETUP  confirm ask: ${ask}\n       state: ${JSON.stringify(state(r.db))}`); }

out.push('\n== A. One turn at the booking confirm, then a later "yes" (confirm/0.92)');
const A = [
  ['no', answer('cancel', 0.9), 'prompt'], ['no', answer('unknown', 0.4), 'alt'], ['no', answer('confirm', 0.3), 'alt'],
  ['No thanks', answer('cancel', 0.9), 'prompt'], ['nope', answer('cancel', 0.85), 'prompt'],
  ['no, make it 12:00', answer('book', 0.9, { time: '12:00' }), 'prompt'], ['no, make it 12:00', answer('cancel', 0.8, { time: '12:00' }), 'alt'],
  ['actually Thursday', answer('book', 0.9, { dateExpr: 'thursday' }), 'prompt'], ['cancel', answer('cancel', 0.95), 'prompt'],
  ['how much is a beard trim?', answer('answer_faq', 0.9, { faqTopic: 'price', serviceId: 'beard' }), 'prompt'],
];
A.forEach(([text, m, why], i) => {
  const { r } = atConfirm();
  out.push(line(`A${i + 1} ${JSON.stringify(text)} · model ${desc(m)} (${why})`, r.turn(text, m), r));
  out.push(line(`   then "yes"`, r.turn('yes', answer('confirm', 0.92)), r));
});

out.push('\n== B. Wider cases');
{ const { r } = atConfirm({ existing: true });
  out.push(line('B1 an EXISTING booking (Haircut Wed), the confirm of a SECOND one (Beard Fri), "no" · cancel/0.9', r.turn('no', answer('cancel', 0.9)), r));
  out.push(line('   then "yes"', r.turn('yes', answer('confirm', 0.92)), r)); }
{ const { r } = atConfirm();
  out.push(line('B2 "no" · unknown/0.4', r.turn('no', answer('unknown', 0.4)), r));
  out.push(line('   "no" again · unknown/0.4', r.turn('no', answer('unknown', 0.4)), r)); }
{ const { r } = atConfirm(); r.turn('yes', answer('confirm', 0.92));
  out.push(line('B3 for comparison — the CANCEL confirm\'s own "no": "cancel my booking" · cancel/0.95', r.turn('cancel my booking', answer('cancel', 0.95)), r));
  out.push(line('   "no" · cancel/0.9', r.turn('no', answer('cancel', 0.9)), r)); }

out.push('\n== C. From the PROPOSED post-decline state (written into the in-memory store; the export is unchanged)');
const declined = (o) => { const { r } = atConfirm(o); r.db.conv.stage = 'collecting'; r.db.conv.last_intent = 'declined'; return r; };
const C = [
  ['12:00', answer('book', 0.9, { time: '12:00' })], ['actually Thursday', answer('book', 0.9, { dateExpr: 'thursday' })],
  ['a beard trim instead', answer('book', 0.9, { serviceId: 'beard' })], ['put it under Sam Lee', answer('book', 0.9, { customerName: 'Sam Lee' })],
  ['actually Wednesday 11:00 is fine', answer('book', 0.9, { dateExpr: 'wednesday', time: '11:00' })], ['yes', answer('confirm', 0.92)],
  ['no', answer('cancel', 0.9)], ['hmm', answer('unknown', 0.3)], ['how much is a beard trim?', answer('answer_faq', 0.9, { faqTopic: 'price', serviceId: 'beard' })],
];
C.forEach(([text, m], i) => { const r = declined(); out.push(line(`C${i + 1} ${JSON.stringify(text)} · model ${desc(m)}`, r.turn(text, m), r)); });
{ const r = declined({ existing: true }); out.push(line('C10 [existing booking] "cancel" · cancel/0.95', r.turn('cancel', answer('cancel', 0.95)), r)); }

console.log(out.join('\n'));
