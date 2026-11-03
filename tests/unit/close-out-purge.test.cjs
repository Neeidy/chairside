/**
 * CLOSE-OUT P1 (ruling 2026-11-03, asked and answered in R1): "nothing old to delete" no longer pages the owner. The read
 * that decided it: 3 of 3 nightly Purge runs after go-live alerted `no_candidates` with 0 candidates and 4 leads.
 * Runs `Purge Error (leads)` — the leads branch's error + refusal collector, whose items become the owner alert — as code.
 *   · a no_candidates refusal → no item (no alert);
 *   · every other refusal (capped, an unreadable shape, no retention configured) and every error item → one item each,
 *     tagged with the branch, exactly as before.
 * WHICH EXPORT: the staged Purge if it exists, else the committed one; argv[2] overrides it.
 * NEGATIVE CONTROL: the export before CLOSE-OUT (5d8dacf) still forwards the no_candidates refusal.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

const ROOT = join(__dirname, '..', '..');
const pick = () => { const s = join(ROOT, 'n8n/staged/workflow.purge.sanitized.json'); return existsSync(s) ? s : join(ROOT, 'n8n/workflow.purge.sanitized.json'); };
const EXPORT = JSON.parse(readFileSync(process.argv[2] || pick(), 'utf8'));
const BEFORE = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', '5d8dacf:n8n/workflow.purge.sanitized.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));

function collect(wf, items) {
  const code = wf.nodes.find((n) => n.name === 'Purge Error (leads)').parameters.jsCode;
  return new Function('$input', code)({ all: () => items.map((json) => ({ json })) }).map((i) => i.json);
}
const NONE = { _purge_branch: 'leads', _leads_refused: 'no_candidates', candidates: 0, cap: 0, total: 4 };
const OTHERS = [
  { _purge_branch: 'leads', _leads_refused: 'leads_purge_capped', candidates: 9, cap: 0, total: 4 },
  { _purge_branch: 'leads', _leads_refused: 'leads_read_shape_invalid' },
  { _purge_branch: 'leads', _leads_refused: 'leads_retention_unconfigured' },
  { error: { message: 'connection refused' }, message: 'connection refused' },
];

test('P1: a no_candidates refusal reaches no alert', () => {
  assert.deepEqual(collect(EXPORT, [NONE]), []);
});
test('P1: every other refusal and every error item still alerts, one each, tagged with the branch', () => {
  const out = collect(EXPORT, OTHERS);
  assert.equal(out.length, OTHERS.length);
  assert.ok(out.every((j) => j._purge_branch === 'leads'));
});
test('P1: mixed — only the no_candidates item is dropped', () => {
  assert.equal(collect(EXPORT, [NONE, ...OTHERS]).length, OTHERS.length);
});
test('P2: the two stale comments are corrected', () => {
  const code = (n) => EXPORT.nodes.find((x) => x.name === n).parameters.jsCode;
  assert.ok(!/a lexicographic '<' compare is chronological\.\n/.test(code('Compute Purge Cutoff')));
  assert.ok(!/— and Airtable has no undo\.$/m.test(code('Compute Leads Cutoff')));
});
test('CONTROL (5d8dacf): the export before CLOSE-OUT forwards the no_candidates refusal to the alert', () => {
  assert.equal(collect(BEFORE, [NONE]).length, 1);
});
