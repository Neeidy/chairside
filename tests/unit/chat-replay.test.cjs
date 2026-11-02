/**
 * The R3 test gap, closed (DATE-PHRASING R1, plan §10): conversations are REPLAYED offline through the Main export,
 * turn by turn, with the model's answer GIVEN — recorded ones (tests/fixtures/chat-replay/recorded-model-answers.json,
 * owner runs 1 and 2 of 2026-11-01) or ones written here. tests/unit/chat-replay.lib.cjs says exactly what runs, what is
 * stubbed and what it does not prove.
 *   1 CONTROL: owner run 1 on the export BEFORE DATE-PHRASING (git, 75c6165) reproduces the live defect — the date is
 *     dropped and the plain datetime question comes back. A replay that could not show this would prove nothing.
 *   2 owner run 1 on the export under test: the same recorded answer now reaches the name ask.
 *   3 owner run 2 (the seven recorded turns) gives the replies the owner saw on the pre-DATE-PHRASING export, and the
 *     same replies with the YEAR in both confirm asks on the export under test (R2d, ruling 2026-11-02) — NAME-CAPTURE's
 *     flow is otherwise unchanged by the date edit — and the store ends as it did live (the name kept through the move,
 *     cancelled).
 *   4 NAME-CAPTURE: a bare name with a typographic apostrophe; the reschedule keeps the name.
 *   5 the golden set's stage-`new` booking cases, end to end, from their table text and expected JSON.
 *   6 D-4 end to end: the hint, then the existing handoff route with the owner alert (Codex R1 MEDIUM-5).
 *   7 a calendar-date correction with an empty extraction never inherits the stored date (Codex R1 HIGH-2).
 *   8 D-4 on the reschedule lane: the strike marker is saved and the second unreadable date hands off (Codex R2 MEDIUM-6).
 *   9 R2d (ruling 2026-11-02): the structural guarantee — after a year-bearing confirm ask, whatever one turn comes in
 *     between, a "yes" writes only the slot of the LAST confirm ask shown, on the booking and the reschedule lane alike.
 *  10 R2d: across the year end the confirm shows the slot's year (2027 on 20 Dec 2026), and that is what is written.
 * WHICH EXPORT: the staged Main if it exists, else the committed one; argv[2] overrides it (mutants).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { makeReplay, answer } = require('./chat-replay.lib.cjs');
const { DateTime } = require(join(__dirname, '../../scripts/node_modules/luxon'));

const ROOT = join(__dirname, '..', '..');
const pick = () => { const s = join(ROOT, 'n8n/staged/workflow.main.sanitized.json'); return existsSync(s) ? s : join(ROOT, 'n8n/workflow.main.sanitized.json'); };
const EXPORT = JSON.parse(readFileSync(process.argv[2] || pick(), 'utf8'));
const PRE_DATE = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', '75c6165:n8n/workflow.main.sanitized.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const FX = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/chat-replay/recorded-model-answers.json'), 'utf8'));
const RUN1_AT = '2026-11-01T19:40:00Z';   // owner run 1, Sunday 20:40 Vienna
const RUN2_AT = '2026-11-01T20:08:00Z';   // owner run 2, Sunday 21:08 Vienna
const ASK_NAME = 'What name should I put the booking under? (Any name is fine for this demo.)';

test('1 CONTROL: owner run 1 on the pre-DATE-PHRASING export reproduces the live defect (date dropped, the plain question)', () => {
  const r = makeReplay(PRE_DATE, { nowISO: RUN1_AT });
  for (const t of FX.owner_run_1) {
    const o = r.turn(t.text, t.model);
    assert.equal(o.reply, 'What day and time works for you?', `execution ${t.execution}`);
    assert.equal(o.out['Resolve Date'][0].date_resolution.reason, 'unparsed');
  }
});

test('2 owner run 1 on the export under test: the recorded answer ("wednesday 4 november") reaches the name ask', () => {
  const r = makeReplay(EXPORT, { nowISO: RUN1_AT });
  const o = r.turn(FX.owner_run_1[0].text, FX.owner_run_1[0].model);
  assert.equal(o.out['Resolve Date'][0].date_resolution.reason, 'calendar_date');
  assert.equal(o.reply, ASK_NAME);
});

// What the owner saw live (the pre-DATE-PHRASING engine) …
const RUN2_SEEN = [ASK_NAME,
  "Haircut, Wednesday 4 Nov 11:00 for Mara O'Test — shall I book it? (yes / no)",
  "You're booked: Haircut, Wednesday 4 Nov 11:00. See you then!",
  'Move your Haircut from Wednesday 4 Nov 11:00 to Thursday 5 Nov 15:00? Reply "yes" to move it, or anything else to keep it.',
  'Moved — your Haircut is now Thursday 5 Nov 15:00.',
  'Cancel your Haircut on Thursday 5 Nov 15:00? Reply "yes" to cancel, or anything else to keep it.',
  'Done — your Haircut on Thursday 5 Nov 15:00 is cancelled.'];
// … and on the export under test: the same, except that both confirm asks carry the year (R2d, ruling 2026-11-02).
const RUN2_R2D = RUN2_SEEN.slice();
RUN2_R2D[1] = "Haircut, Wednesday 4 Nov 2026 11:00 for Mara O'Test — shall I book it? (yes / no)";
RUN2_R2D[3] = 'Move your Haircut from Wednesday 4 Nov 2026 11:00 to Thursday 5 Nov 2026 15:00? Reply "yes" to move it, or anything else to keep it.';
for (const [label, wf, want] of [['the export under test', EXPORT, RUN2_R2D], ['the pre-DATE-PHRASING export', PRE_DATE, RUN2_SEEN]]) {
  test(`3 owner run 2, seven recorded turns, on ${label}: the expected replies, and the store as it ended live`, () => {
    const r = makeReplay(wf, { nowISO: RUN2_AT });
    FX.owner_run_2.forEach((t, i) => assert.equal(r.turn(t.text, t.model).reply, want[i], `turn ${i + 1} (execution ${t.execution})`));
    assert.equal(r.db.appts.length, 1);
    assert.equal(r.db.appts[0].customer_name, "Mara O'Test"); assert.equal(r.db.appts[0].status, 'cancelled');
    assert.equal(r.db.appts[0].start_utc, '2026-11-05T14:00:00.000Z');
    assert.equal(r.db.conv.slot_name, "Mara O'Test");
    assert.deepEqual(r.db.alerts, [], 'no owner alert');
  });
}

test('4 NAME-CAPTURE through the replay: a bare name typed with ’ is stored with \' and the move keeps it', () => {
  const r = makeReplay(EXPORT, { nowISO: RUN2_AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' }));
  assert.equal(r.turn('Sam O’Neil', answer('unknown', 0.3)).reply, "Haircut, Wednesday 4 Nov 2026 11:00 for Sam O'Neil — shall I book it? (yes / no)");
  r.turn('yes', answer('confirm', 0.92));
  r.turn('Can I move it to Friday at 12:00?', answer('reschedule', 0.9, { dateExpr: 'friday', time: '12:00' }));
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, 'Moved — your Haircut is now Friday 6 Nov 12:00.');
  assert.equal(r.db.appts[0].customer_name, "Sam O'Neil");
  assert.deepEqual(r.db.calendar.map((e) => e.summary), ["Haircut — Sam O'Neil (bot)", "Haircut — Sam O'Neil (bot)"]);
});

test('6 D-4 end to end: two dropped dates in a row — the hint, then the existing handoff route with the owner alert', () => {
  const r = makeReplay(EXPORT, { nowISO: RUN2_AT });
  const first = r.turn('a haircut someday at 11', answer('book', 0.9, { serviceId: 'haircut', dateExpr: 'someday', time: '11:00' }));
  assert.equal(first.reply, 'Which day and time? You can write e.g. "Wednesday at 11:00", "tomorrow at 15:00" or "4 November at 11:00".');
  const second = r.turn('whenever suits at 11', answer('book', 0.9, { dateExpr: 'whenever suits', time: '11:00' }));
  assert.equal(second.reply, "I'm passing you to a team member — we'll get back to you shortly.");
  assert.ok(second.path.includes('Mark Handoff'), 'through Mark Handoff');
  assert.equal(r.db.conv.stage, 'handoff');
  assert.ok(r.db.alerts.includes('date_handoff'), `the owner alert (${JSON.stringify(r.db.alerts)})`);
});

test('7 Codex R1 HIGH-2 end to end: "5 november instead" with an empty extraction re-asks — it never books the stored 4 November', () => {
  const r = makeReplay(EXPORT, { nowISO: RUN2_AT });
  assert.equal(r.turn('haircut 4 november 11:00', answer('book', 0.92, { serviceId: 'haircut', dateExpr: '4 november', time: '11:00' })).reply, ASK_NAME);
  const o = r.turn('5 november instead at 11:00', answer('book', 0.9, { time: '11:00' }));
  assert.equal(o.reply, 'Which day and time? You can write e.g. "Wednesday at 11:00", "tomorrow at 15:00" or "4 November at 11:00".');
  assert.equal(r.db.conv.slot_date, '');
});

test('8 D-4 on the RESCHEDULE lane end to end (ruling 2026-11-01, Codex R2 MEDIUM-6): two unreadable new dates → the handoff', () => {
  const r = makeReplay(EXPORT, { nowISO: RUN2_AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' }));
  r.turn('Kim Moss', answer('unknown', 0.3));
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, "You're booked: Haircut, Wednesday 4 Nov 11:00. See you then!");
  const first = r.turn('move it to someday', answer('reschedule', 0.9, { dateExpr: 'someday', time: '11:00' }));
  assert.equal(first.reply, 'Sure — what new day and time would you like to move it to?');
  assert.equal(r.db.conv.last_intent, 'date_reask', 'the strike marker is SAVED (it was lost before the ruling)');
  const second = r.turn('move it to whenever', answer('reschedule', 0.9, { dateExpr: 'whenever', time: '11:00' }));
  assert.equal(second.reply, "I'm passing you to a team member — we'll get back to you shortly.");
  assert.ok(second.path.includes('Mark Handoff')); assert.ok(r.db.alerts.includes('date_handoff'));
  assert.equal(r.db.appts[0].status, 'booked', 'the booking itself is untouched');
});

// 9 — R2d. The confirm asks parsed back into an instant: a write is checked against what the customer was SHOWN.
const BOOK_ASK = /^.+?, (\w+ \d{1,2} \w{3} \d{4} \d{2}:\d{2})(?: for .+)? — shall I book it\?/;
const MOVE_ASK = /^Move your .+ from \w+ \d{1,2} \w{3} \d{4} \d{2}:\d{2} to (\w+ \d{1,2} \w{3} \d{4} \d{2}:\d{2})\?/;
const shownUtc = (s) => DateTime.fromFormat(s, 'cccc d LLL yyyy HH:mm', { zone: 'Europe/Vienna', locale: 'en-US' }).toUTC().toISO();
const BETWEEN = [
  ['nothing', null],
  ['an uncertain turn naming another date', ['actually 5 november?', answer('unknown', 0.3, { dateExpr: '5 november', time: '11:00' })]],
  ['an uncertain turn', ['hmm', answer('unknown', 0.3)]],
  ['another date', ['make it 5 november', answer('book', 0.9, { dateExpr: '5 november', time: '11:00' })]],
  ['another time', ['make it 15:00', answer('book', 0.9, { time: '15:00' })]],
  ['a date the model dropped (empty extraction)', ['5 november instead', answer('book', 0.9, {})]],
  ['another name', ['put it under Alex Rowe', answer('book', 0.9, { customerName: 'Alex Rowe' })]],
  ['a question', ['how much is it?', answer('faq', 0.9)]],
  ['a yes naming another date', ['yes but 5 november', answer('confirm', 0.9, { dateExpr: '5 november', time: '11:00' })]],
  ['a reschedule', ['move it to friday', answer('reschedule', 0.9, { dateExpr: 'friday', time: '12:00' })]],
  ['a cancel', ['cancel', answer('cancel', 0.9)]],
];
test('9 R2d: a write is always the slot of the LAST year-bearing confirm ask shown — one turn of any kind between, both lanes', () => {
  let writes = 0;
  for (const [label, mid] of BETWEEN) {
    // booking lane: the confirm ask, one turn, "yes"
    const b = makeReplay(EXPORT, { nowISO: RUN2_AT, sender: 'widget:w-replay-b' });
    let last = null;
    const see = (o) => { const m = (o.reply || '').match(BOOK_ASK); if (m) last = shownUtc(m[1]);
      else assert.ok(!/shall I book it/.test(o.reply || ''), `${label}: a booking confirm without the year: ${o.reply}`); return o; };
    see(b.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' })));
    see(b.turn('Kim Moss', answer('unknown', 0.3)));
    if (mid) see(b.turn(mid[0], mid[1]));
    see(b.turn('yes', answer('confirm', 0.92)));
    for (const a of b.db.appts) { writes++; assert.equal(a.start_utc, last, `booking lane, ${label}: wrote what was not the last confirm shown`); }
    for (const e of b.db.calendar) assert.equal(DateTime.fromISO(e.start.dateTime).toUTC().toISO(), last, `booking lane, ${label}: calendar`);
    // reschedule lane: a booking, the move confirm ask, one turn, "yes"
    const r = makeReplay(EXPORT, { nowISO: RUN2_AT, sender: 'widget:w-replay-r' });
    r.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' }));
    r.turn('Kim Moss', answer('unknown', 0.3)); r.turn('yes', answer('confirm', 0.92));
    const booked = r.db.appts[0].start_utc;
    let move = null;
    const seeMove = (o) => { const m = (o.reply || '').match(MOVE_ASK); if (m) move = shownUtc(m[1]);
      else assert.ok(!/^Move your/.test(o.reply || ''), `${label}: a move confirm without the years: ${o.reply}`); return o; };
    seeMove(r.turn('Can I move it to Thursday at 15:00?', answer('reschedule', 0.9, { dateExpr: 'thursday', time: '15:00' })));
    assert.ok(move, 'the move confirm ask was shown');
    if (mid) seeMove(r.turn(mid[0], mid[1]));
    seeMove(r.turn('yes', answer('confirm', 0.92)));
    const now = r.db.appts.filter((a) => a.status === 'booked').map((a) => a.start_utc);
    assert.ok(now.every((t) => t === booked || t === move), `reschedule lane, ${label}: ${JSON.stringify(now)} (booked ${booked}, shown ${move})`);
    if (now.includes(move)) writes++;
  }
  assert.ok(writes >= 10, `the property was exercised by real writes (${writes})`);
});

test('10 R2d: across the year end the confirm shows the slot\'s year — 20 Dec 2026, "4 January" → Monday 4 Jan 2027, and that is written', () => {
  const r = makeReplay(EXPORT, { nowISO: '2026-12-20T10:00:00Z' });
  assert.equal(r.turn('haircut on 4 january at 11:00', answer('book', 0.92, { serviceId: 'haircut', dateExpr: '4 january', time: '11:00' })).reply, ASK_NAME);
  assert.equal(r.turn('Kim Moss', answer('unknown', 0.3)).reply, 'Haircut, Monday 4 Jan 2027 11:00 for Kim Moss — shall I book it? (yes / no)');
  r.turn('yes', answer('confirm', 0.92));
  assert.equal(r.db.appts[0].start_utc, '2027-01-04T10:00:00.000Z');
});

// 5 — the golden set, end to end: every stage-`new` booking case, from its table text and expected JSON.
const md = readFileSync(join(ROOT, 'tests/golden-set.md'), 'utf8');
const GOLD = JSON.parse(md.match(/```json golden\n([\s\S]*?)\n```/)[1]);
const ROWS = Object.fromEntries([...md.matchAll(/^\| (G\d+) \| ([^|]+) \| "([^"]+)" \|/gm)].map((m) => [m[1], { stage: m[2].trim(), text: m[3] }]));
// The first reply each case must reach on Sunday 1 Nov 2026, 21:08 Vienna, a new conversation, an empty calendar.
const GOLD_FIRST = {
  G1: ASK_NAME,                                                       // tomorrow 15:00: complete but the name
  G4: 'Which service would you like? (Haircut / Beard Trim / Haircut + Beard)',
  G6: ASK_NAME,                                                       // "this friday" on a Sunday → D-5 → Friday 6 Nov
  G15: 'We take bookings up to 30 days ahead — which date did you mean?',   // A1, D-2 as amended by R2d
  G16: 'Haircut, Monday 2 Nov 2026 15:00 for Alex — shall I book it? (yes / no)',
  G24: ASK_NAME, G25: ASK_NAME,
  G26: '4 November is a Wednesday — did you mean Wednesday 4 November, or a Thursday?',
  G27: ASK_NAME,
};
test('5 golden: every stage-new booking case reaches its expected first reply, end to end (no case left out)', () => {
  const ids = Object.keys(GOLD).filter((id) => GOLD[id].intent === 'book' && ROWS[id] && ROWS[id].stage === 'new');
  assert.deepEqual(ids.sort(), Object.keys(GOLD_FIRST).sort(), 'the stage-new booking cases and this table name the same cases');
  for (const id of ids) {
    const r = makeReplay(EXPORT, { nowISO: RUN2_AT });
    // the golden JSON keeps date null for a relative day (a run compares dateExpr); the replay gives the model's slots as written
    assert.equal(r.turn(ROWS[id].text, GOLD[id]).reply, GOLD_FIRST[id], id);
  }
});
