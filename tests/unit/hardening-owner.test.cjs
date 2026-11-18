/**
 * HARDENING R1 — the Owner Actions edit (docs/hardening/PLAN.md §2 WU-6; rulings K5 and S5 of 2026-11-18).
 *   S5: a handoff lock older than 30 days is released (the dashboard listed it and said "nothing to release").
 *   K5: the release also resets the session's turn count and pending confirm.
 * Kept, and asserted here: stage === 'handoff', the future-timestamp refusal (Codex CRT #11), and the exact last_updated
 * version token in the statement. The token's REFUSAL on Postgres is measured by tests/db/claim-race.test.sh (O1, with
 * its no-token mutant), which runs this statement verbatim from the staged export.
 * WHICH FILE: the staged export if it exists, else the committed one; argv[2] overrides it (mutants).
 * Measured: on the committed export the S5 and K5 tests are RED (the kept-bounds test is green, a guard);
 * tests/unit/hardening-owner-mutants.py kills 4 of 4 (the 30-day bound back, the future refusal, the reset, the token).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const S = join(__dirname, '..', '..', 'n8n', 'staged', 'workflow.owner-actions.sanitized.json');
const EXPORT = process.argv[2] || (existsSync(S) ? S : join(__dirname, '..', '..', 'n8n', 'workflow.owner-actions.sanitized.json'));
const wf = JSON.parse(readFileSync(EXPORT, 'utf8'));
const node = (n) => wf.nodes.find((x) => x.name === n);
const validate = (fields) => new Function('$', '$json', '$input', node('Validate Release Target').parameters.jsCode)(
  () => ({ first: () => ({ json: { action: 'release_handoff', record_id: 'r1', messageId: 'd-1', ts: 1 } }) }), {},
  { all: () => [{ json: { id: 'r1', fields } }] })[0].json;
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();

test('S5: a handoff lock older than 30 days is releasable (it was listed and refused)', () => {
  for (const d of [31, 90, 400]) assert.equal(validate({ stage: 'handoff', last_updated: ago(d) }).target_locked, true, `${d} days`);
});
test('S5 kept: only stage handoff, and a last_updated ahead of the clock (beyond the skew) is refused', () => {
  assert.equal(validate({ stage: 'booked', last_updated: ago(1) }).target_locked, false);
  assert.equal(validate({ stage: 'handoff', last_updated: new Date(Date.now() + 3600000).toISOString() }).target_locked, false);
  assert.equal(validate({ stage: 'handoff', last_updated: 'not a date' }).target_locked, false);
  assert.equal(validate({ stage: 'handoff', last_updated: ago(1) }).target_last_updated.length > 0, true, 'the version token is carried');
});
test('K5: the release resets turn_count and confirm_turn, and still writes only on the exact version token', () => {
  const q = node('Release Handoff Lock').parameters.query;
  assert.match(q, /SET stage = 'new', last_intent = '', turn_count = 0, confirm_turn = '' WHERE id = \$1 AND stage = 'handoff' AND salon\.at_ts\(last_updated\) = \$2 /);
});
