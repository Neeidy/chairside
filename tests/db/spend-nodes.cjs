// spend-nodes.cjs — runs Main's Load Config, Eval Spend and Build Spend Record jsCode VERBATIM from one Main export
// (SPEND_EXPORT; default: the staged Main if it exists, else the committed one),
// with only $ / $json / $input / $now stubbed. Offline: no network, no DB (the caller does the SQL in a scratch Postgres).
// Usage:
//   node spend-nodes.cjs eval   '<Read Spend output item as JSON, {} for no row>'          -> prints Eval Spend's _spend
//   node spend-nodes.cjs record '<_spend JSON from eval>' <input_tokens> <output_tokens>   -> prints Build Spend Record's item
//   node spend-nodes.cjs sql    '<node name>'                                               -> prints that node's query verbatim
//   node spend-nodes.cjs param2 '<Build Spend Record item>'                                 -> Record LLM Spend's $2 for it
'use strict';
const { readFileSync } = require('node:fs');
const { join, existsSync } = { ...require('node:path'), ...require('node:fs') };
const REPO = join(__dirname, '..', '..');
const { DateTime } = require(REPO + '/scripts/node_modules/luxon');
const STAGED = join(REPO, 'n8n/staged/workflow.main.sanitized.json');
// SPEND_EXPORT=PRE reads Main as it was BEFORE the hardening edit (bb3f64b) straight from git — the control suite; it is
// a fixed commit so the control still shows the defect after the promotion.
const src = process.env.SPEND_EXPORT === 'PRE'
  ? require('node:child_process').execFileSync('git', ['-C', REPO, 'show', 'bb3f64b:n8n/workflow.main.sanitized.json'], { encoding: 'utf8' })
  : readFileSync(process.env.SPEND_EXPORT || (existsSync(STAGED) ? STAGED : join(REPO, 'n8n/workflow.main.sanitized.json')), 'utf8');
const wf = JSON.parse(src);
const node = (name) => { const n = wf.nodes.find((x) => x.name === name); if (!n) throw new Error('no node ' + name); return n; };
const NOW = DateTime.fromISO('2030-01-15T12:00:00Z', { zone: 'utc' });   // pinned: period key 2030-01 (synthetic)

function run(name, { refs = {}, json = {}, input = [] } = {}) {
  const $ = (r) => {
    if (!(r in refs)) throw new Error(`stub: unexpected ref ${r} from ${name}`);
    const v = refs[r];
    return { first: () => ({ json: v.out[0] }), all: (k) => {
      if (k === 1) { if (v.err === undefined) throw new Error('no output 1'); return v.err.map((j) => ({ json: j })); }
      return v.out.map((j) => ({ json: j }));
    } };
  };
  const $input = { all: () => input.map((j) => ({ json: j })), first: () => ({ json: input[0] }), item: { json: input[0] } };
  const f = new Function('$', '$json', '$input', '$now', 'DateTime', node(name).parameters.jsCode);
  const r = f($, json, $input, NOW, DateTime);
  return r.map((x) => x.json);
}

function config() { return run('Load Config', { json: {}, input: [{}], refs: {} })[0].config; }

if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'sql') { process.stdout.write(node(a).parameters.query); process.exit(0); }
  if (cmd === 'param2') {   // the export's own queryReplacement decides what $2 is (cost_usd before, _delta after)
    const e = node('Record LLM Spend').parameters.options.queryReplacement.replace(/^=\{\{/, '').replace(/\}\}$/, '');
    console.log(new Function('$json', `return (${e});`)(JSON.parse(a))[1]); process.exit(0);
  }
  const cfg = config();
  const refsBase = { 'Load Config': { out: [{ config: cfg }] }, 'Merge State': { out: [{ channel: 'widget', sender_key: 'widget:w-hd-spend', text: 'hi', state: {} }] } };
  if (cmd === 'eval') {
    const item = JSON.parse(a);
    const out = run('Eval Spend', { refs: { ...refsBase, 'Read Spend': { out: [item], err: [] } }, input: [item] })[0];
    console.log(JSON.stringify(out._spend));
  } else if (cmd === 'record') {
    const spend = JSON.parse(a);
    const out = run('Build Spend Record', {
      refs: { ...refsBase, 'Eval Spend': { out: [{ _spend: spend }] } },
      json: { usage: { input_tokens: Number(b), output_tokens: Number(c) } },
    })[0];
    console.log(JSON.stringify(out));
  } else { console.error('usage: eval|record|sql'); process.exit(2); }
}
