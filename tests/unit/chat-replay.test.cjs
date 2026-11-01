/**
 * The R3 test gap, closed (DATE-PHRASING R1, plan §10): conversations are REPLAYED offline through the Main export,
 * turn by turn, with the model's answer GIVEN — recorded ones (tests/fixtures/chat-replay/recorded-model-answers.json,
 * owner runs 1 and 2 of 2026-11-01) or ones written here. tests/unit/chat-replay.lib.cjs says exactly what runs, what is
 * stubbed and what it does not prove.
 *   1 CONTROL: owner run 1 on the export BEFORE DATE-PHRASING (git, 75c6165) reproduces the live defect — the date is
 *     dropped and the plain datetime question comes back. A replay that could not show this would prove nothing.
 *   2 owner run 1 on the export under test: the same recorded answer now reaches the name ask.
 *   3 owner run 2 (the seven recorded turns) gives the replies the owner saw, on BOTH exports — NAME-CAPTURE's flow is
 *     unchanged by the date edit — and the store ends as it did live (the name kept through the move, cancelled).
 *   4 NAME-CAPTURE: a bare name with a typographic apostrophe; the reschedule keeps the name.
 *   5 the golden set's stage-`new` booking cases, end to end, from their table text and expected JSON.
 * WHICH EXPORT: the staged Main if it exists, else the committed one; argv[2] overrides it (mutants).
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

const RUN2_REPLIES = [ASK_NAME,
  "Haircut, Wednesday 4 Nov 11:00 for Mara O'Test — shall I book it? (yes / no)",
  "You're booked: Haircut, Wednesday 4 Nov 11:00. See you then!",
  'Move your Haircut from Wednesday 4 Nov 11:00 to Thursday 5 Nov 15:00? Reply "yes" to move it, or anything else to keep it.',
  'Moved — your Haircut is now Thursday 5 Nov 15:00.',
  'Cancel your Haircut on Thursday 5 Nov 15:00? Reply "yes" to cancel, or anything else to keep it.',
  'Done — your Haircut on Thursday 5 Nov 15:00 is cancelled.'];
for (const [label, wf] of [['the export under test', EXPORT], ['the pre-DATE-PHRASING export', PRE_DATE]]) {
  test(`3 owner run 2, seven recorded turns, on ${label}: the replies the owner saw, and the store as it ended live`, () => {
    const r = makeReplay(wf, { nowISO: RUN2_AT });
    FX.owner_run_2.forEach((t, i) => assert.equal(r.turn(t.text, t.model).reply, RUN2_REPLIES[i], `turn ${i + 1} (execution ${t.execution})`));
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
  assert.equal(r.turn('Sam O’Neil', answer('unknown', 0.3)).reply, "Haircut, Wednesday 4 Nov 11:00 for Sam O'Neil — shall I book it? (yes / no)");
  r.turn('yes', answer('confirm', 0.92));
  r.turn('Can I move it to Friday at 12:00?', answer('reschedule', 0.9, { dateExpr: 'friday', time: '12:00' }));
  assert.equal(r.turn('yes', answer('confirm', 0.92)).reply, 'Moved — your Haircut is now Friday 6 Nov 12:00.');
  assert.equal(r.db.appts[0].customer_name, "Sam O'Neil");
  assert.deepEqual(r.db.calendar.map((e) => e.summary), ["Haircut — Sam O'Neil (bot)", "Haircut — Sam O'Neil (bot)"]);
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
  G15: 'We take bookings up to 90 days ahead — which date did you mean?',   // A1
  G16: 'Haircut, Monday 2 Nov 15:00 for Alex — shall I book it? (yes / no)',
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
