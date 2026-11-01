/**
 * DATE-PHRASING R1 (docs/DATE-PHRASING-PLAN.md; rulings D-1…D-5, A1). Every case runs the customer's WORDS through the
 * staged chain Resolve Date → Merge Slots → Slot Gate — never a pre-resolved ISO date as input, which is how the R3
 * owner run's "wednesday 4 november" reached production unrefused-by-tests (NAME-CAPTURE-PLAN, "The owner run of
 * 2026-11-01"). The config is the Load Config literal itself, executed from the same export, so the templates, the
 * horizon and the date order under test are the ones that ship. `now` is pinned per case (a real Luxon with only the
 * clock replaced).
 *
 * WHICH FILE: n8n/staged/workflow.main.sanitized.json if it exists, else the committed export; argv[2] overrides it
 * (tests/unit/date-phrasing-mutants.py). What it does NOT prove: the model's own extraction (the replay test feeds
 * recorded and given model answers), n8n's runtime, or the live calendar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { DateTime } = require(join(__dirname, '../../scripts/node_modules/luxon'));

const ROOT = join(__dirname, '..', '..');
const pick = () => { const s = join(ROOT, 'n8n/staged/workflow.main.sanitized.json'); return existsSync(s) ? s : join(ROOT, 'n8n/workflow.main.sanitized.json'); };
const EXPORT = process.argv[2] || pick();
const wf = JSON.parse(readFileSync(EXPORT, 'utf8'));
const body = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
const clock = (nowISO) => new Proxy(DateTime, { get: (t, p) => (p === 'now' ? () => DateTime.fromISO(nowISO, { zone: 'utc' }) : Reflect.get(t, p)) });
const CONFIG = new Function('$', '$json', 'DateTime', body('Load Config'))(() => { throw new Error('Load Config reads no node'); }, {}, DateTime)[0].json.config;
const stub = (refs) => (name) => { if (!(name in refs)) throw new Error(`unexecuted ref ${name}`); return { first: () => ({ json: refs[name] }) }; };
const runNode = (name, refs, j, nowISO) => new Function('$', '$json', 'DateTime', '$now', body(name))(stub(refs), j, clock(nowISO), clock(nowISO).now())[0].json;

const SUN = '2026-11-01T10:00:00Z';   // Sunday 1 Nov 2026, 11:00 Vienna — the owner run's day
const MON = '2026-11-02T08:00:00Z';   // Monday 2 Nov, 09:00
const SAT = '2026-10-31T10:00:00Z';   // Saturday 31 Oct, 11:00
const BASE = { serviceId: null, date: null, dateExpr: null, time: null, customerName: null, notes: null, faqTopic: null };
/** One turn through the chain. Returns {rd, ms, sg}. `stored` is the conversation's slots before the turn. */
function turn(text, slots, { nowISO = SUN, intent = 'book', stage = 'collecting', stored = {}, prev = 'book', config = CONFIG } = {}) {
  const state = { stage, slots: { serviceId: null, date: null, time: null, customerName: null, ...stored }, last_intent: intent, turn_count: 2 };
  const vi = { channel: 'widget', sender_key: 'widget:w-fake', text, intent, confidence: 0.95, valid: true, slots: { ...BASE, ...slots }, state };
  const refs = { 'Load Config': { config }, 'Merge State': { state: { ...state, last_intent: prev } } };
  const rd = runNode('Resolve Date', refs, vi, nowISO);
  const ms = runNode('Merge Slots', refs, rd, nowISO);
  const sg = runNode('Slot Gate', refs, ms, nowISO);
  return { rd, ms, sg };
}
const T = CONFIG.messageTemplates;
const book = (text, dateExpr, time = '11:00', o = {}) => turn(text, { serviceId: 'haircut', dateExpr, date: o.llmDate ?? null, time }, o);
const date = (r) => r.sg.state.slots.date;
const reason = (r) => r.rd.date_resolution && r.rd.date_resolution.reason;

test('the config literal carries the ruled keys: business.dateOrder DMY (D-1), bot.bookingHorizonDays 90 (D-2), the D-3 text', () => {
  assert.equal(CONFIG.business.dateOrder, 'DMY');
  assert.equal(CONFIG.bot.bookingHorizonDays, 90);
  assert.equal(T.askDateTimeHint, 'Which day and time? You can write e.g. "Wednesday at 11:00", "tomorrow at 15:00" or "4 November at 11:00".');
  for (const k of ['dateWeekdayMismatch', 'dateAmbiguous', 'datePast', 'dateInvalid', 'dateTooFar']) assert.equal(typeof T[k], 'string', k);
});

test('the owner run phrase: "Wednesday 4 November" resolves to 2026-11-04 and the turn moves on to the name ask', () => {
  const r = book("I'd like a haircut on Wednesday 4 November at 11:00", 'wednesday 4 november', '11:00', { llmDate: '2026-11-04' });
  assert.equal(reason(r), 'calendar_date'); assert.equal(date(r), '2026-11-04');
  assert.equal(r.sg.next_ask, 'name'); assert.equal(r.sg.computed_reply, T.askName);
  assert.equal(r.rd.date_alert, false);
});

test('every in-scope form resolves to the same day (shop timezone, DMY)', () => {
  for (const [text, dx] of [['haircut 4 november at 11', '4 november'], ['haircut on 4th november', '4th november'],
    ['haircut 4th of nov', '4th of nov'], ['haircut november 4', 'november 4'], ['haircut nov 4th', 'nov 4th'], ['haircut 4 nov.', '4 nov.'],
    ['haircut wed, 4 nov', 'wed, 4 nov'], ['haircut 4 november 2026', '4 november 2026'], ['haircut 4.11', '4.11'], ['haircut 4.11.', '4.11.'],
    ['haircut 4.11.2026 at 11', '4.11.2026'], ['haircut 4/11', '4/11'], ['haircut 4/11/2026', '4/11/2026'], ['haircut on the 4 november', 'the 4 november']]) {
    const r = book(text, dx);
    assert.equal(date(r), '2026-11-04', `${dx} → ${reason(r)}`);
  }
});

test('"4 november 11:00" is NOT taken for a clipped year (a time right after the date)', () => {
  assert.equal(date(book('haircut 4 november 11:00', '4 november')), '2026-11-04');
});

test('weekday mismatch: "Thursday 4 November" never books — it re-asks naming both', () => {
  const r = book('haircut thursday 4 november', 'thursday 4 november');
  assert.equal(reason(r), 'weekday_mismatch'); assert.equal(date(r), null);
  assert.equal(r.sg.next_ask, 'datetime');
  assert.equal(r.sg.computed_reply, '4 November is a Wednesday — did you mean Wednesday 4 November, or a Thursday?');
  assert.equal(r.rd.date_alert_class, 'date_weekday_mismatch');
});

test('weekday mismatch when the MODEL drops the weekday the customer wrote: the text before the date still counts', () => {
  const r = book('haircut thursday 4 november', '4 november');
  assert.equal(reason(r), 'weekday_mismatch'); assert.equal(date(r), null);
});

test('a year the model trims away is not resolved to this year (refused in the forged-expression class)', () => {
  for (const [text, dx, why] of [['haircut 4 november 2027', '4 november', 'calendar_clipped'], ['haircut 4.11.2027', '4.11', 'calendar_clipped'],
    ['haircut 4/11/2027', '4/11', 'expr_not_in_text']]) {   // '/' is a word character: "4/11" does not even occur in "4/11/2027"
    const r = book(text, dx);
    assert.equal(reason(r), why, dx); assert.equal(date(r), null, dx);
    assert.equal(r.rd.date_resolution.outcome, 'expr_not_from_customer', dx);
  }
});

test('a day no calendar holds re-asks: 31 November, 30.2, 29 February outside a leap year', () => {
  for (const [text, dx] of [['haircut 31 november', '31 november'], ['haircut 30.2', '30.2'], ['haircut 0.11', '0.11'], ['haircut 4.13', '4.13']]) {
    const r = book(text, dx);
    assert.equal(reason(r), 'invalid_date', dx); assert.equal(r.sg.computed_reply, T.dateInvalid, dx);
  }
  const leap = book('haircut 29 february 2027', '29 february 2027');
  assert.equal(reason(leap), 'invalid_date');
});

test('ambiguous numeric (D-1): with no date order a slash pair whose parts are both ≤ 12 re-asks naming both readings', () => {
  const noOrder = { ...CONFIG, business: { ...CONFIG.business, dateOrder: undefined } };
  const r = book('haircut 4/11', '4/11', '11:00', { config: noOrder });
  assert.equal(reason(r), 'ambiguous_numeric'); assert.equal(date(r), null);
  assert.equal(r.sg.computed_reply, 'Did you mean 4 November or 11 April?');
  const MDY = { ...noOrder, business: { ...noOrder.business, dateOrder: 'MDY' } };
  assert.equal(date(book('haircut 12/1', '12/1', '11:00', { config: MDY })), '2026-12-01', 'MDY');
  assert.equal(date(book('haircut 12/1', '12/1')), '2027-01-12', 'DMY (the demo)');
  assert.equal(date(book('haircut 4/11', '4/11')), '2026-11-04', 'DMY (the demo)');
  assert.equal(date(book('haircut 25/11', '25/11', '11:00', { config: noOrder })), '2026-11-25', 'not ambiguous: 25 cannot be a month');
  assert.equal(date(book('haircut 11/11', '11/11', '11:00', { config: noOrder })), '2026-11-11', 'not ambiguous: both readings agree');
  assert.equal(date(book('haircut 4.11', '4.11', '11:00', { config: MDY })), '2026-11-04', 'a dot is ALWAYS day.month');
});

test('a past day+month rolls to next year only inside the horizon; otherwise it re-asks as passed', () => {
  const r = book('haircut 4 october', '4 october');
  assert.equal(reason(r), 'date_past'); assert.equal(r.sg.computed_reply, T.datePast);
  assert.equal(date(book('haircut 2 january', '2 january', '11:00', { nowISO: '2026-12-30T10:00:00Z' })), '2027-01-02', 'year-end');
  assert.equal(reason(book('haircut 4 october 2026', '4 october 2026')), 'date_past', 'a year given is honoured, not moved');
});

test('A1: the horizon (90 days) applies to EVERY resolved date — both directions, day+month and verbatim ISO', () => {
  assert.equal(date(book('haircut 30 january', '30 january')), '2027-01-30', 'day 90: inside');
  assert.equal(reason(book('haircut 31 january', '31 january')), 'date_past',
    'no year, passed this year, next year past the horizon: the plan\'s rule says "passed" (see the R1 record)');
  const out = book('haircut 31 january 2027', '31 january 2027');
  assert.equal(reason(out), 'beyond_horizon'); assert.equal(out.sg.computed_reply, 'We take bookings up to 90 days ahead — which date did you mean?');
  assert.equal(reason(book('haircut 4 november', '4 november', '11:00', { nowISO: '2026-03-01T10:00:00Z' })), 'beyond_horizon', 'this year, but 248 days ahead');
  assert.equal(date(book('haircut 4 april', '4 april', '11:00', { nowISO: '2026-03-01T10:00:00Z' })), '2026-04-04', 'this year, inside');
  assert.equal(date(book('haircut 2027-01-30', '2027-01-30')), '2027-01-30', 'ISO inside');
  assert.equal(reason(book('haircut 2027-01-31', '2027-01-31')), 'beyond_horizon', 'ISO outside');
  assert.equal(reason(book('haircut 2031-11-04', '2031-11-04')), 'beyond_horizon', 'an ISO date years ahead no longer books');
  assert.equal(reason(book('haircut 4 november 2027', '4 november 2027')), 'beyond_horizon', 'a year given, too far');
  assert.equal(date(book('haircut tomorrow', 'tomorrow')), '2026-11-02', 'today/tomorrow are inside');
});

test('D-5: on a Sunday "this <weekday>" is the coming week\'s day; Saturday "this friday" still re-asks; Monday unchanged', () => {
  const sun = book('haircut this wednesday', 'this wednesday');
  assert.equal(reason(sun), 'anchored_sunday'); assert.equal(date(sun), '2026-11-04');
  assert.equal(date(book('haircut this sunday at 15:00', 'this sunday', '15:00')), '2026-11-01', '"this sunday" on a Sunday is today (today\'s rule)');
  assert.equal(reason(book('haircut wednesday this week', 'wednesday this week')), 'anchored_past', 'the suffix form keeps today\'s rule');
  const sat = book('haircut this friday', 'this friday', '11:00', { nowISO: SAT });
  assert.equal(reason(sat), 'anchored_past'); assert.equal(date(sat), null);
  assert.equal(reason(book('haircut this wednesday', 'this wednesday', '11:00', { nowISO: MON })), 'anchored_week');
  assert.equal(date(book('haircut this wednesday', 'this wednesday', '11:00', { nowISO: MON })), '2026-11-04');
});

test('D-3: any other dropped date re-asks with the accepted forms named (never the plain question again)', () => {
  for (const [text, dx] of [['haircut someday soon', 'someday soon'], ['haircut next wednesday', 'next wednesday'],
    ['haircut friday the week after', 'friday the week after']]) {
    const r = book(text, dx);
    assert.equal(r.sg.next_ask, 'datetime', dx); assert.equal(r.sg.computed_reply, T.askDateTimeHint, dx);
  }
  const plain = turn('a haircut please', { serviceId: 'haircut' });
  assert.equal(plain.sg.computed_reply, T.askDateTime, 'no date named: the plain ask');
});

test('a dropped date while a stored date exists does NOT fall back to the stored one (Merge Slots, unchanged): it re-asks, naming why', () => {
  const r = book('haircut 31 november', '31 november', '11:00', { stored: { serviceId: 'haircut', date: '2026-11-04', time: '11:00' } });
  assert.equal(date(r), null); assert.equal(r.sg.computed_reply, T.dateInvalid);
});

test('D-4: the first dropped date marks date_reask; the second in a row hands off (handoff_reason date_not_resolved, owner alert)', () => {
  const first = book('haircut someday', 'someday');
  assert.equal(first.rd.state.last_intent, 'date_reask'); assert.equal(first.rd.intent, 'book');
  const second = book('haircut whenever', 'whenever', '11:00', { prev: 'date_reask' });
  assert.equal(second.rd.intent, 'handoff'); assert.equal(second.rd.handoff_reason, 'date_not_resolved');
  assert.equal(second.rd.state.last_intent, 'handoff');
  assert.equal(second.rd.date_alert, true); assert.equal(second.rd.date_alert_class, 'date_handoff');
  assert.equal(book('haircut 4 november', '4 november', '11:00', { prev: 'date_reask' }).rd.intent, 'book', 'a resolved date resets nothing into a handoff');
  const resch = turn('move it to someday', { dateExpr: 'someday', time: '11:00' }, { intent: 'reschedule', prev: 'date_reask', stage: 'new' });
  assert.equal(resch.rd.intent, 'handoff', 'the reschedule lane counts too');
});

test('D-4 never counts on a confirm turn, a non-booking intent, or a turn with no dropped date', () => {
  const conf = turn('yes, thursday 4 november', { dateExpr: 'thursday 4 november' }, { intent: 'confirm', stage: 'confirming', prev: 'date_reask',
    stored: { serviceId: 'haircut', date: '2026-11-04', time: '11:00' } });
  assert.equal(conf.rd.intent, 'confirm'); assert.notEqual(conf.rd.state.last_intent, 'date_reask');
  // the STAGE condition on its own: a booking/reschedule intent while a confirmation is pending does not count either
  for (const [intent, stage] of [['book', 'confirming'], ['reschedule', 'reschedule_confirming'], ['book', 'cancel_confirming']]) {
    const r = turn('make it 31 november', { serviceId: 'haircut', dateExpr: '31 november', time: '11:00' }, { intent, stage, prev: 'date_reask',
      stored: { serviceId: 'haircut', date: '2026-11-04', time: '11:00' } });
    assert.equal(r.rd.intent, intent, `${intent} at ${stage}`); assert.notEqual(r.rd.state.last_intent, 'date_reask', `${intent} at ${stage}`);
  }
  const faq = turn('are you open on 31 november?', { dateExpr: '31 november' }, { intent: 'answer_faq', prev: 'date_reask' });
  assert.equal(faq.rd.intent, 'answer_faq');
  assert.equal(book('haircut tomorrow', 'tomorrow', '11:00', { prev: 'date_reask' }).rd.state.last_intent, 'book');
});

test('the D-4 marker does not collide with NAME-CAPTURE\'s markers (name_reask, clarify), in both directions', () => {
  for (const prev of ['name_reask', 'clarify']) {
    const r = book('haircut someday', 'someday', '11:00', { prev });
    assert.equal(r.rd.intent, 'book', prev); assert.equal(r.rd.state.last_intent, 'date_reask', prev);
  }
  // Fill Name From Reply reads its own markers only: a previous date_reask at the name ask is a first name refusal
  const fwf = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
  const state = { stage: 'collecting', slots: { serviceId: 'haircut', date: '2026-11-04', time: '11:00', customerName: null }, last_intent: 'book' };
  const j = { channel: 'widget', sender_key: 'widget:w-fake', text: '??', intent: 'book', confidence: 0.9, valid: true, slots: { ...BASE }, state };
  const out = new Function('$', '$json', 'DateTime', fwf('Fill Name From Reply'))(stub({ 'Load Config': { config: CONFIG }, 'Merge State': { state: { ...state, last_intent: 'date_reask' } } }), j, DateTime)[0].json;
  assert.notEqual(out.intent, 'handoff'); assert.equal(out.state.last_intent, 'name_reask');
});

test('the model\'s own date has no authority on a calendar date (the cross-check stays a signal, not a value)', () => {
  const r = book('haircut 4 november', '4 november', '11:00', { llmDate: '2026-11-05' });
  assert.equal(date(r), '2026-11-04'); assert.equal(r.rd.date_resolution.outcome, 'llm_date_ignored');
  const forged = book('haircut on wednesday', '4 november');
  assert.equal(reason(forged), 'expr_not_in_text'); assert.equal(date(forged), null);
});

test('a calendar date the customer did not type with a month never resolves: digits inside other numbers, a time', () => {
  assert.equal(reason(book('haircut 14.11', '4.11')), 'expr_not_in_text');
  assert.equal(date(book('haircut at 11.30', '11.30')), null, '11.30 read as a date is month 30: invalid, never a booking');
});
