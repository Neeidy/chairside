/**
 * CLOSE-OUT M1–M3 (docs/CLOSE-OUT-PLAN.md §3, §10; rulings DC-13 and the plan's approval, 2026-11-03), replayed turn by turn
 * through the Main export with the committed chat-replay harness (tests/unit/chat-replay.lib.cjs: what runs, what is
 * stubbed, what it does not prove). THE ASSUMPTION, per turn: the model's answer is GIVEN — the LLM is never called.
 *   M1  at a pending confirm, the model repeating the STORED date with no dateExpr does not ping the owner (4905);
 *       a different date, or the same echo with no pending confirm, still does.
 *   M2  a booking-confirm "yes" counts only on the turn right after its ask; a stale one shows the confirm again and
 *       writes nothing (DC-13); at any other stage the route is today's (N1's D-6 handoff kept).
 *   M3  "yes" sent twice after one confirm books once.
 * WHICH EXPORT: the staged Main if it exists, else the committed one; argv[2] overrides it (close-out-main-mutants.py).
 * NEGATIVE CONTROL: the committed export from before CLOSE-OUT (5d8dacf) must show both defects.
 * NOT covered offline: a slot taken between the ask and a stale "yes" — the harness's freeBusy stub is always free; that
 * answer is Compute Availability's existing "taken" branch, unchanged by M2. Synthetic names only.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { makeReplay, answer } = require('./chat-replay.lib.cjs');

const ROOT = join(__dirname, '..', '..');
const pick = () => { const s = join(ROOT, 'n8n/staged/workflow.main.sanitized.json'); return existsSync(s) ? s : join(ROOT, 'n8n/workflow.main.sanitized.json'); };
const EXPORT = JSON.parse(readFileSync(process.argv[2] || pick(), 'utf8'));
const BEFORE = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', '5d8dacf:n8n/workflow.main.sanitized.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const AT = '2026-11-03T13:20:57Z';   // Tuesday afternoon, Vienna: "Wednesday" = 4 Nov 2026
const CONFIRM_11 = 'Haircut, Wednesday 4 Nov 2026 11:00 for Kim Moss — shall I book it? (yes / no)';
const BOOKED = "You're booked: Haircut, Wednesday 4 Nov 11:00. See you then!";
const DECLINED = 'No problem — nothing is booked. What would you like to change: the service, the day, the time or the name?';
const HANDOFF = "I'm passing you to a team member — we'll get back to you shortly.";
const STORED = { serviceId: 'haircut', date: '2026-11-04', time: '11:00' };
const book = answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' });

function atConfirm(wf = EXPORT) {
  const r = makeReplay(wf, { nowISO: AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", book);
  assert.equal(r.turn('Kim Moss', answer('book', 0.95)).reply, CONFIRM_11, 'setup: the confirm ask');
  return r;
}
const newAlerts = (r, f) => { const n = r.db.alerts.length; const o = f(); return [o, r.db.alerts.slice(n)]; };

// ── M1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('M1: 4905 — a "no" answered as cancel with the stored slots echoed: the change question, the slots kept, NO alert', () => {
  const r = atConfirm();
  const [o, al] = newAlerts(r, () => r.turn('no', answer('cancel', 0.85, STORED)));
  assert.equal(o.reply, DECLINED);
  assert.deepEqual(al, [], 'no owner alert');
  assert.deepEqual([r.db.conv.slot_service, r.db.conv.slot_date, r.db.conv.slot_time], ['haircut', '2026-11-04', '11:00']);
});
test('M1: a question at the confirm with the stored date echoed: no alert either (the echo rule is not intent-bound)', () => {
  const r = atConfirm();
  const [, al] = newAlerts(r, () => r.turn('how much is it?', answer('answer_faq', 0.9, { ...STORED, faqTopic: 'price' })));
  assert.deepEqual(al, []);
});
test('M1: a DIFFERENT date with no expression at the confirm still alerts', () => {
  const r = atConfirm();
  const [, al] = newAlerts(r, () => r.turn('no', answer('cancel', 0.85, { ...STORED, date: '2026-11-05' })));
  assert.deepEqual(al, ['date_expr_missing']);
});
test('M1: the same echo with NO confirmation pending still alerts', () => {
  const r = makeReplay(EXPORT, { nowISO: AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", book);
  assert.equal(r.db.conv.stage, 'collecting');
  const [, al] = newAlerts(r, () => r.turn('hmm', answer('book', 0.9, STORED)));
  assert.deepEqual(al, ['date_expr_missing']);
});

// ── M2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('M2: the confirm ask is stamped for the next turn; a "yes" on that turn books (write-then-verify unchanged)', () => {
  const r = atConfirm();
  assert.match(String(r.db.conv.confirm_turn), /^[1-9][0-9]*$/, 'a stamp is stored with the confirm');
  const o = r.turn('yes', answer('confirm', 0.92));
  assert.equal(o.reply, BOOKED);
  assert.ok(o.path.includes('Booking Fresh?') && o.path.includes('Book Appointment') && o.path.includes('Verify Slot'));
  assert.equal(r.db.appts.length, 1);
});
test('M2: a question between the ask and the "yes" → the confirm is shown again, nothing is written; the next "yes" books', () => {
  const r = atConfirm();
  r.turn('how much is it?', answer('answer_faq', 0.9, { faqTopic: 'price' }));
  assert.equal(r.db.conv.stage, 'confirming');
  const o = r.turn('yes', answer('confirm', 0.92));
  assert.equal(o.reply, CONFIRM_11);
  assert.ok(!o.path.includes('Book Appointment') && !o.path.includes('Write Appointment'), 'no write on the stale "yes"');
  assert.ok(o.path.includes('Slot Gate') && o.path.includes('Get Calendar Busy'), 'availability read again');
  assert.equal(r.db.appts.length, 0);
  assert.equal(r.db.calendar.length, 0);
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, BOOKED);
  assert.equal(r.db.appts.length, 1);
});
test('M2: a confirm saved without a stamp (before this edit) → its "yes" re-asks; nothing is written', () => {
  const r = atConfirm();
  r.db.conv.confirm_turn = '';
  const o = r.turn('yes', answer('confirm', 0.92));
  assert.equal(o.reply, CONFIRM_11);
  assert.equal(r.db.appts.length, 0);
});
test('M2: an old nameless confirm (the row 13 case) → its "yes" asks for the name instead of handing off; nothing is written', () => {
  const r = atConfirm();
  r.db.conv.confirm_turn = '';
  r.db.conv.slot_name = '';
  const o = r.turn('yes', answer('confirm', 0.92));
  assert.match(o.reply, /name/i);
  assert.notEqual(o.reply, HANDOFF);
  assert.equal(r.db.appts.length, 0);
});
test('M2: at a stage other than confirming the route is today\'s — N1 D-6: a second bare "yes" after a decline hands off', () => {
  const r = atConfirm();
  assert.equal(r.turn('no', answer('cancel', 0.9)).reply, DECLINED);
  r.turn('yes', answer('confirm', 0.9));
  assert.equal(r.turn('yes', answer('confirm', 0.9)).reply, HANDOFF);
  assert.equal(r.db.appts.length, 0);
});

// ── the recorded bound (ruling 2026-11-03, Codex CLOSE-OUT pass 1 HIGH) ───────────────────────────────────────────
// The stamp counts SAVED turns. A turn that saves no state — an LLM-unavailable reply, a guard trip — does not advance
// turn_count, so it does not stale the confirm: the next "yes" books the slot that was shown (write-then-verify
// unchanged). The cancel and reschedule confirms' count-based TTL has the same bound. Pinned so a change is seen.
test('BOUND: an unsaved transient turn between the ask and the "yes" does not stale the confirm; the "yes" books the slot shown', () => {
  const r = atConfirm();
  const turns = r.db.conv.turn_count;
  const o = r.turn('how much is it?', { __llmError: true });
  assert.ok(o.path.includes('LLM Unavailable Reply'), 'the turn took the LLM-unavailable route');
  assert.equal(r.db.conv.turn_count, turns, 'the failed turn saved no state');
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, BOOKED);
  assert.equal(r.db.appts.length, 1);
});

// ── M3 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('M3: "yes" sent twice after one confirm books ONCE (the second meets stage booked)', () => {
  const r = atConfirm();
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, BOOKED);
  const o = r.turn('yes', answer('confirm', 0.92));
  assert.ok(!o.path.includes('Book Appointment'), 'the second "yes" does not reach the calendar write');
  assert.equal(r.db.appts.length, 1);
  assert.equal(r.db.calendar.length, 1);
});

// ── the graph ────────────────────────────────────────────────────────────────────────────────────────────────────
test('graph: Reschedule Router false → Booking Fresh?; fresh → Build Event Request, stale → Slot Gate', () => {
  const C = EXPORT.connections;
  assert.deepEqual(C['Reschedule Router'].main[1].map((t) => t.node), ['Booking Fresh?']);
  assert.deepEqual(C['Booking Fresh?'].main.map((b) => b.map((t) => t.node)), [['Build Event Request'], ['Slot Gate']]);
});

// ── the negative control: the export before CLOSE-OUT shows both defects ────────────────────────────────────────
test('CONTROL (5d8dacf): 4905 alerts, and a "yes" after a question books the confirm asked two turns ago', () => {
  const a = atConfirm(BEFORE);
  const [, al] = newAlerts(a, () => a.turn('no', answer('cancel', 0.85, STORED)));
  assert.deepEqual(al, ['date_expr_missing']);
  const b = atConfirm(BEFORE);
  b.turn('how much is it?', answer('answer_faq', 0.9, { faqTopic: 'price' }));
  assert.equal(b.turn('yes', answer('confirm', 0.92)).reply, BOOKED);
});
