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

test('the config literal carries the ruled keys: business.dateOrder DMY (D-1), bot.bookingHorizonDays 30 (D-2 as amended by R2d), the D-3 text', () => {
  assert.equal(CONFIG.business.dateOrder, 'DMY');
  assert.equal(CONFIG.bot.bookingHorizonDays, 30);
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
  assert.equal(date(book('haircut 1/12', '1/12')), '2026-12-01', 'DMY (the demo)');
  assert.equal(reason(book('haircut 12/1', '12/1')), 'beyond_horizon', 'DMY reads 12 January: passed this year by more than the horizon, next year past it — too far (E1, R2e)');
  assert.equal(date(book('haircut 4/11', '4/11')), '2026-11-04', 'DMY (the demo)');
  assert.equal(date(book('haircut 25/11', '25/11', '11:00', { config: noOrder })), '2026-11-25', 'not ambiguous: 25 cannot be a month');
  assert.equal(date(book('haircut 11/11', '11/11', '11:00', { config: noOrder })), '2026-11-11', 'not ambiguous: both readings agree');
  assert.equal(date(book('haircut 4.11', '4.11', '11:00', { config: MDY })), '2026-11-04', 'a dot is ALWAYS day.month');
});

test('a past day+month rolls to next year only inside the horizon; otherwise it re-asks (passed within reach — E1 below)', () => {
  const r = book('haircut 4 october', '4 october');
  assert.equal(reason(r), 'date_past'); assert.equal(r.sg.computed_reply, T.datePast);
  assert.equal(date(book('haircut 2 january', '2 january', '11:00', { nowISO: '2026-12-30T10:00:00Z' })), '2027-01-02', 'year-end');
  assert.equal(reason(book('haircut 4 october 2026', '4 october 2026')), 'date_past', 'a year given is honoured, not moved');
});

test('A1: the horizon (30 days, D-2 as amended by R2d) applies to EVERY resolved date — both directions, day+month and verbatim ISO', () => {
  assert.equal(date(book('haircut 1 december', '1 december')), '2026-12-01', 'day 30: inside');
  const out = book('haircut 2 december', '2 december');
  assert.equal(reason(out), 'beyond_horizon', 'day 31: outside');
  assert.equal(out.sg.computed_reply, 'We take bookings up to 30 days ahead — which date did you mean?');
  assert.equal(reason(book('haircut 31 october', '31 october')), 'date_past',
    'no year, one day behind us (within reach), next year past the horizon: passed (E1, R2e)');
  assert.equal(reason(book('haircut 2 december 2026', '2 december 2026')), 'beyond_horizon', 'a year given, one day too far');
  assert.equal(reason(book('haircut 4 november', '4 november', '11:00', { nowISO: '2026-03-01T10:00:00Z' })), 'beyond_horizon', 'this year, but 248 days ahead');
  assert.equal(date(book('haircut 25 march', '25 march', '11:00', { nowISO: '2026-03-01T10:00:00Z' })), '2026-03-25', 'this year, inside');
  assert.equal(date(book('haircut 2026-12-01', '2026-12-01')), '2026-12-01', 'ISO inside');
  assert.equal(reason(book('haircut 2026-12-02', '2026-12-02')), 'beyond_horizon', 'ISO outside');
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

test('Codex R1 HIGH-1: a weekday-only (or today/tomorrow/ISO) extraction while the message names a calendar date is refused', () => {
  for (const [text, dx, llm] of [['haircut thursday 4 november at 11', 'thursday', '2026-11-04'], ['haircut wednesday 4 november 2027', 'wednesday', '2027-11-04'],
    ['haircut tomorrow, 4 november', 'tomorrow', null], ['haircut 2026-11-04 or 5 november', '2026-11-04', null], ['haircut friday 6.11.', 'friday', null]]) {
    const r = book(text, dx, '11:00', { llmDate: llm });
    assert.equal(reason(r), 'calendar_clipped', dx); assert.equal(date(r), null, dx);
    assert.equal(r.sg.computed_reply, T.askDateTimeHint, dx);
  }
  assert.equal(date(book('haircut friday at 9.10', 'friday', '09:10')), '2026-11-06', 'a bare dot pair is a time, not a date: no refusal');
  assert.equal(date(book('may 2 of us come friday at 11', 'friday')), '2026-11-06', '"<month> N of" is not a date (resolve-date N1-d)');
  assert.equal(reason(book('may 2 people come friday at 11', 'friday')), 'calendar_clipped', 'the stated cost: one re-ask');
});

test('Codex R1 HIGH-1: a weekday ANYWHERE in the message counts against the date (not only right before it)', () => {
  const r = book('haircut thursday on 4 november', '4 november');
  assert.equal(reason(r), 'weekday_mismatch');
  assert.equal(r.sg.computed_reply, '4 November is a Wednesday — did you mean Wednesday 4 November, or a Thursday?');
  assert.equal(date(book('haircut on 4 november, a wednesday', '4 november')), '2026-11-04', 'the same weekday anywhere is fine');
});

test('Codex R1 HIGH-2: an empty extraction that names a calendar date never inherits the stored one', () => {
  const r = turn('5 november instead at 11:00', { time: '11:00' }, { stored: { serviceId: 'haircut', date: '2026-11-04', time: '11:00' } });
  assert.equal(r.rd.date_dropped, true); assert.equal(r.rd.date_resolution.outcome, 'day_named_not_extracted');
  assert.equal(date(r), null); assert.equal(r.sg.computed_reply, T.askDateTimeHint);
  const plain = turn('at 12:00 instead', { time: '12:00' }, { stored: { serviceId: 'haircut', date: '2026-11-04', time: '11:00' } });
  assert.equal(date(plain), '2026-11-04', 'no day named: the stored date stays, as before');
});

test('Codex R1 MEDIUM-3: a year written as 0000 is a year given (past), never replaced by this year', () => {
  assert.equal(reason(book('haircut 4 november 0000', '4 november 0000')), 'date_past');
});

test('Codex R2 HIGH-1: a year the model left out is caught ANYWHERE in the message; a compact time re-asks once (the stated cost of MEDIUM-4)', () => {
  // corrected in R2b: R2 narrowed the year to 19xx/20xx right after the date, which let other years through (Codex R2 HIGH-1)
  for (const text of ['haircut 5 november 0000', 'haircut 5 november 2100', 'haircut 5 november 1899', 'haircut 5 november in 2027', 'haircut 5 november, year 2027'])
    assert.equal(reason(book(text, '5 november')), 'calendar_clipped', text);
  for (const text of ['haircut 4 november 1100', 'haircut 4 november at 1930', 'haircut 4 november, 2000 please'])
    assert.equal(reason(book(text, '4 november')), 'calendar_clipped', `${text} — the stated cost`);
  assert.equal(date(book('haircut 4 november 11:00', '4 november')), '2026-11-04', 'the colon form passes');
  assert.equal(date(book('haircut 4 november at 19:30', '4 november', '19:30')), '2026-11-04');
  const resch = turn('move it to 5 november 2100', { dateExpr: '5 november', time: '11:00' }, { intent: 'reschedule', stage: 'booked' });
  assert.equal(resch.rd.date_resolution.reason, 'calendar_clipped', 'the reschedule lane too');
});

test('Codex R3 HIGH-1 + MEDIUM-4: a year followed by a colon, and a three-digit number, are caught; well-formed times are not', () => {
  for (const text of ['haircut 5 november 2100: at 11:00', 'haircut 5 november 0000: at 11:00', 'haircut 5 november 1899: please',
    'haircut 5 november in 2027: at 11:00', 'haircut 5 november 999 at 11:00'])
    assert.equal(reason(book(text, '5 november')), 'calendar_clipped', text);
  for (const text of ['haircut 4 november at 11:00', 'haircut 4 november at 11.30', 'haircut 4 november, 9:15 or 10:45'])
    assert.equal(date(book(text, '4 november')), '2026-11-04', text);
  // only the numeric-continuation check catches a two-digit year after a dot date: the time strip removes "4.11", and ".27"
  // has fewer than three digits
  assert.equal(reason(book('haircut 4.11.27 at 11:00', '4.11')), 'calendar_clipped', '4.11.27');
  const resch = turn('move it to 5 november 2100: at 11:00', { dateExpr: '5 november', time: '11:00' }, { intent: 'reschedule', stage: 'booked' });
  assert.equal(resch.rd.date_resolution.reason, 'calendar_clipped', 'the reschedule lane too');
});

test('Codex R3 HIGH-2: the "may N of" exemption only before a pronoun or possessive — "may 5 of the year 2027" is a date', () => {
  const stored = { serviceId: 'haircut', date: '2026-11-04', time: '11:00' };
  assert.equal(turn('may 5 of the year 2027 at 11:00', { time: '11:00' }, { stored }).rd.date_dropped, true);
  assert.equal(date(book('may 2 of my friends come friday at 11', 'friday')), '2026-11-06', 'a possessive: the modal');
});

test('Codex R2 HIGH-2: only "may N of <word>" is exempt — "november 5 of 2027" with an empty extraction never keeps the stored date', () => {
  const stored = { serviceId: 'haircut', date: '2026-11-04', time: '11:00' };
  const r = turn('november 5 of 2027 at 11:00', { time: '11:00' }, { stored });
  assert.equal(r.rd.date_dropped, true); assert.equal(date(r), null);
  const may = turn('may 2 of us come at 11:00', { time: '11:00' }, { stored });
  assert.equal(date(may), '2026-11-04', '"may 2 of us" is not a date: the stored date stays');
});

test('Codex R2 HIGH-3 + MEDIUM-7: a dot pair right after a weekday (no space, a comma, "the", bare) and "today" next to a written date are refused', () => {
  for (const text of ['haircut thursday,4.11 at 11', 'haircut thursday, 4.11 at 11', 'haircut thursday the 4.11', 'haircut thursday 4.11 at 11'])
    assert.equal(reason(book(text, 'thursday')), 'calendar_clipped', text);
  assert.equal(reason(book('haircut today, 5 november', 'today')), 'calendar_clipped');
});

test('Codex R2 MEDIUM-5: the expression\'s own weekday does not switch off the other weekdays in the message', () => {
  assert.equal(reason(book('haircut thursday on wednesday 4 november', 'wednesday 4 november')), 'weekday_mismatch');
});

test('E1 (R2e, ruling 2026-11-02): no year and passed this year — "passed" only when it is behind us within the horizon; otherwise the too-far reply', () => {
  const AT = '2026-11-03T10:00:00Z';   // Tuesday 3 Nov 2026 — the ruling's example day
  const far = book('haircut on 15 january', '15 january', '11:00', { nowISO: AT });
  assert.equal(reason(far), 'beyond_horizon', 'this January is behind us, next January beyond 30 days: too far, not passed');
  assert.equal(far.sg.computed_reply, 'We take bookings up to 30 days ahead — which date did you mean?');
  assert.equal(date(far), null);
  const past = book('haircut on 20 october', '20 october', '11:00', { nowISO: AT });
  assert.equal(reason(past), 'date_past', 'two weeks behind us: it really has passed');
  assert.equal(past.sg.computed_reply, T.datePast);
  assert.equal(reason(book('haircut 4 october', '4 october', '11:00', { nowISO: AT })), 'date_past', '30 days behind: within reach');
  assert.equal(reason(book('haircut 3 october', '3 october', '11:00', { nowISO: AT })), 'beyond_horizon', '31 days behind: out of reach');
  assert.equal(reason(book('haircut 15 january 2026', '15 january 2026', '11:00', { nowISO: AT })), 'date_past', 'a year given is honoured: past stays past');
  assert.equal(reason(book('haircut 29 february', '29 february', '11:00', { nowISO: '2027-11-03T10:00:00Z' })), 'beyond_horizon',
    'no 29 February in 2027, the next one (2028) beyond the horizon: too far, not passed');
  assert.equal(date(book('haircut 2 january', '2 january', '11:00', { nowISO: '2026-12-30T10:00:00Z' })), '2027-01-02', 'inside the horizon across the year end: resolves');
  const rs = turn('can I move it to 15 january', { dateExpr: '15 january', time: '11:00' }, { nowISO: AT, intent: 'reschedule', stage: 'idle' });
  assert.equal(reason(rs), 'beyond_horizon', 'the reschedule lane shares the resolver');
});

test('Codex R1 MEDIUM-5: the shop timezone decides the day — 23:30Z on Sunday is already Monday in Vienna', () => {
  const late = '2026-11-01T23:30:00Z';
  assert.equal(date(book('haircut tomorrow', 'tomorrow', '11:00', { nowISO: late })), '2026-11-03');
  const tsun = book('haircut this sunday', 'this sunday', '11:00', { nowISO: late });
  assert.equal(reason(tsun), 'anchored_week'); assert.equal(date(tsun), '2026-11-08', 'Monday in Vienna: the current week, not D-5');
  assert.equal(reason(book('haircut 1 november', '1 november', '11:00', { nowISO: late })), 'date_past', 'Vienna is past 1 November');
});

test('Codex R1 MEDIUM-5: A1 refuses a WEEKDAY too when the horizon is shorter than it (1 day)', () => {
  const one = { ...CONFIG, bot: { ...CONFIG.bot, bookingHorizonDays: 1 } };
  assert.equal(reason(book('haircut friday', 'friday', '11:00', { config: one })), 'beyond_horizon');
  assert.equal(date(book('haircut tomorrow', 'tomorrow', '11:00', { config: one })), '2026-11-02');
  assert.equal(reason(book('haircut this wednesday', 'this wednesday', '11:00', { config: one })), 'beyond_horizon', 'D-5\'s date too');
});

test('D-4 counts only when the date re-ask is what the customer sees: a booking with no known service does not strike', () => {
  const noSvc = turn('book me someday', { dateExpr: 'someday', time: '11:00' }, { prev: 'date_reask' });
  assert.equal(noSvc.rd.intent, 'book'); assert.equal(noSvc.rd.state.last_intent, 'book');
  assert.equal(noSvc.sg.next_ask, 'service');
  const svcStored = turn('someday please', { dateExpr: 'someday', time: '11:00' }, { prev: 'date_reask', stored: { serviceId: 'haircut' } });
  assert.equal(svcStored.rd.intent, 'handoff', 'a stored service counts');
});

test('a calendar date the customer did not type with a month never resolves: digits inside other numbers, a time', () => {
  assert.equal(reason(book('haircut 14.11', '4.11')), 'expr_not_in_text');
  assert.equal(date(book('haircut at 11.30', '11.30')), null, '11.30 read as a date is month 30: invalid, never a booking');
});

// ── R2d (ruling 2026-11-02): the structural guarantee — both confirm asks show the resolved date WITH its year ──────
const DEC20 = '2026-12-20T10:00:00Z';   // Sunday 20 Dec 2026: a slot in January is next year, the clock is this year
const FREE = { calendars: { c: { busy: [] } } };
const avail = (slots, cal = FREE, nowISO = DEC20) => runNode('Compute Availability',
  { 'Load Config': { config: CONFIG }, 'Slot Gate': { state: { stage: 'ready', slots } } }, cal, nowISO);
const reschedAvail = (slots, oldStartUtc, cal = FREE, nowISO = DEC20) => runNode('Compute Reschedule Availability',
  { 'Load Config': { config: CONFIG }, 'Reschedule Lookup': { state: { stage: 'reschedule_collecting', slots, turn_count: 4 },
    _reschedule_target: { recordId: 'r-fake', service: 'Haircut', start_utc: oldStartUtc } } }, cal, nowISO);

test('R2d: the booking confirm shows the slot WITH its year (the slot\'s year, not the clock\'s); other replies keep their wording', () => {
  const s = { serviceId: 'haircut', date: '2027-01-04', time: '11:00', customerName: 'Alex' };
  assert.equal(avail(s).computed_reply, 'Haircut, Monday 4 Jan 2027 11:00 for Alex — shall I book it? (yes / no)');
  assert.equal(avail({ ...s, date: '2026-12-21' }).computed_reply, 'Haircut, Monday 21 Dec 2026 11:00 for Alex — shall I book it? (yes / no)');
  const busy = avail(s, { calendars: { c: { busy: [{ start: '2027-01-04T09:30:00Z', end: '2027-01-04T11:00:00Z' }] } } });
  assert.equal(busy.availability.status, 'busy'); assert.match(busy.computed_reply, /^Monday 4 Jan 11:00 is taken/, 'the busy reply is unchanged');
  const past = avail({ ...s, date: '2026-12-15' });
  assert.equal(past.computed_reply, 'Tuesday 15 Dec 11:00 has already passed — give me a future day and time.', 'the past reply is unchanged');
});

test('R2d: the reschedule confirm shows BOTH dates WITH their years; the busy reply keeps its wording', () => {
  const s = { serviceId: 'haircut', date: '2027-01-04', time: '15:00', customerName: 'Alex' };
  assert.equal(reschedAvail(s, '2026-12-30T10:00:00Z').computed_reply,
    'Move your Haircut from Wednesday 30 Dec 2026 11:00 to Monday 4 Jan 2027 15:00? Reply "yes" to move it, or anything else to keep it.');
  const busy = reschedAvail(s, '2026-12-30T10:00:00Z', { calendars: { c: { busy: [{ start: '2027-01-04T13:30:00Z', end: '2027-01-04T15:00:00Z' }] } } });
  assert.equal(busy.computed_reply, 'Monday 4 Jan 15:00 is taken — a team member will help you find another time.');
});
