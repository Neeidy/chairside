/**
 * HARDENING RM-185 (ROADMAP CP5 R5 "timezone/DST = ◐ inherited, NOT independently DST-drilled"): Build Reminder
 * Payload's {when} across both Vienna DST boundaries of 2026, from the committed Reminders export's own node code
 * (Load Config (Reminders) + Build Reminder Payload, run as written; offline). The evidence used to live only in a
 * session scratchpad. A mutant (the time formatted in UTC instead of the shop's zone) must turn it red:
 * `node tests/unit/reminder-dst.test.cjs --mutant-utc` exits non-zero.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DateTime } = require(join(__dirname, '../../scripts/node_modules/luxon'));

const wf = JSON.parse(readFileSync(join(__dirname, '../../n8n/workflow.reminders.sanitized.json'), 'utf8'));
const N = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
let payloadCode = N['Build Reminder Payload'].parameters.jsCode;
if (process.argv.includes('--mutant-utc')) {
  const tz = /setZone\(([^)]*)\)/.exec(payloadCode);
  if (!tz) throw new Error('mutant anchor: no setZone( in Build Reminder Payload');
  payloadCode = payloadCode.replace(tz[0], "setZone('UTC')");
}
const cfgOut = new Function('$', '$json', 'DateTime', N['Load Config (Reminders)'].parameters.jsCode)(() => ({}), {}, DateTime)[0].json;
const $ = (name) => ({ first: () => ({ json: name === 'Load Config (Reminders)' ? cfgOut : { reminder: { tz: cfgOut.config.business.timezone } } }) });
const when = (utc) => new Function('$', '$json', 'DateTime', payloadCode)($,
  { id: 'appt-hd-dst', fields: { service: 'Haircut', start_utc: utc, sender_key: 'widget:w-hd-dst', channel: 'widget' } }, DateTime).json.reminder_payload.text;

test('the shop zone is Europe/Vienna (the cases below assume it)', () => assert.equal(cfgOut.config.business.timezone, 'Europe/Vienna'));
for (const [utc, want] of [
  ['2026-10-24T09:00:00Z', 'Saturday 24 Oct 11:00'],   // CEST, +2 — the day before autumn's change
  ['2026-10-25T09:00:00Z', 'Sunday 25 Oct 10:00'],     // CET,  +1 — the day of it
  ['2026-03-28T10:00:00Z', 'Saturday 28 Mar 11:00'],   // CET,  +1 — the day before spring's change
  ['2026-03-29T10:00:00Z', 'Sunday 29 Mar 12:00'],     // CEST, +2 — the day of it
]) test(`${utc} is shown as ${want} (Vienna wall clock)`, () => assert.match(when(utc), new RegExp(`booked for ${want}\\.`)));
