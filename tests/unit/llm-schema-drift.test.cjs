/**
 * Drift guard for the structured-output schema `Build LLM Request` hands the model (contract-integrity.md, "Derived
 * copies"). The node carries a DERIVED copy of schemas/intent.schema.json — the API's safe subset: no minimum/maximum,
 * a ["string","null"] type written as anyOf, every key required, additionalProperties false. A derived copy is allowed
 * only with a parity check; none existed (found while writing docs/NAME-CAPTURE-PLAN.md §10). This test derives the
 * subset FROM the committed schema and requires the node's copy to equal it — in the committed Main export and in a
 * staged one, if any.
 *
 * Negative controls run first: a property dropped from the node's copy, an enum value added, a min/max left in, and a
 * nullable slot written as a plain string must each come out different, or this test measures nothing.
 * Run: node tests/unit/llm-schema-drift.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { DateTime } = require(join(__dirname, '../../scripts/node_modules/luxon'));

const ROOT = join(__dirname, '..', '..');
const canonical = JSON.parse(readFileSync(join(ROOT, 'schemas', 'intent.schema.json'), 'utf8'));

// The safe-subset rules, applied to the committed schema. `top`-level and nested objects alike: all keys required.
function derive(s) {
  const t = s.type;
  if (t === 'object') {
    const props = Object.fromEntries(Object.entries(s.properties || {}).map(([k, v]) => [k, derive(v)]));
    return { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props };
  }
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== 'null');
    if (!t.includes('null') || nonNull.length !== 1) throw new Error(`a type union this derivation does not know: ${JSON.stringify(t)}`);
    const base = { type: nonNull[0] };
    if (s.enum) base.enum = s.enum.filter((x) => x !== null);
    return { anyOf: [base, { type: 'null' }] };
  }
  const out = { type: t };
  if (s.enum) out.enum = s.enum;
  return out;   // minimum / maximum / description / $id … are dropped: the API's subset does not take them
}
const norm = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : (k === 'required' && Array.isArray(v) ? [...v].sort() : v)));

function nodeSchema(exportPath) {
  const wf = JSON.parse(readFileSync(exportPath, 'utf8'));
  const code = wf.nodes.find((n) => n.name === 'Build LLM Request').parameters.jsCode;
  const cfg = { business: { name: 'x', timezone: 'Europe/Vienna' }, services: [], workingHours: {} };
  const $ = (name) => { if (name !== 'Load Config') throw new Error(name); return { first: () => ({ json: { config: cfg } }) }; };
  return new Function('$', '$json', '$now', 'DateTime', code)($, { text: 't', state: {} }, DateTime.now(), DateTime)[0].json.request.output_config.format.schema;
}

const want = derive(canonical);
const exportsToCheck = [join(ROOT, 'n8n', 'workflow.main.sanitized.json')];
const staged = join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json');
if (existsSync(staged)) exportsToCheck.push(staged);

test('negative controls: each defect in a copy is seen', () => {
  const got = nodeSchema(exportsToCheck[0]);
  const m1 = JSON.parse(JSON.stringify(got)); delete m1.properties.slots.properties.notes;
  const m2 = JSON.parse(JSON.stringify(got)); m2.properties.intent.enum.push('pay');
  const m3 = JSON.parse(JSON.stringify(got)); m3.properties.confidence.maximum = 1;
  const m4 = JSON.parse(JSON.stringify(got)); m4.properties.slots.properties.customerName = { type: 'string' };
  for (const m of [m1, m2, m3, m4]) assert.notEqual(norm(m), norm(want));
});
for (const p of exportsToCheck) {
  test(`Build LLM Request's structured-output schema is the safe subset OF the committed schema (${p.includes('staged') ? 'staged' : 'committed'} Main)`, () => {
    assert.equal(norm(nodeSchema(p)), norm(want));
  });
}
