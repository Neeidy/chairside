// N1 R4: is execution 4905's owner alert N1's? Replays the owner's script 2 up to its "no" with the LIVE model's answer
// for that turn (cancel 0.85, the stored beard slots echoed, dateExpr null — read from the execution) on the committed
// Main (N1 promoted) and on the export before N1 (bc6eadf). Control: the same turn with empty slots, which is what the
// model gave on script 1's "no" turns. The setup turns' model answers are given, as in tests/unit/n1-confirm-no.test.cjs.
// Run: node docs/n1/alert-4905-replay.cjs > docs/n1/alert-4905-replay.out.txt
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ROOT = join(__dirname, '..', '..');
const { makeReplay, answer } = require(join(ROOT, 'tests/unit/chat-replay.lib.cjs'));
const AT = '2026-11-03T13:20:57Z';   // 4905's start, UTC

function run(wf, noSlots) {
  const r = makeReplay(wf, { nowISO: AT });
  r.turn("I'd like a haircut on Wednesday at 11:00", answer('book', 0.92, { serviceId: 'haircut', dateExpr: 'wednesday', time: '11:00' }));
  r.turn('Kim Moss', answer('book', 0.95));
  r.turn('yes', answer('confirm', 0.92));
  r.turn('and a beard trim on Friday at 10:00', answer('book', 0.92, { serviceId: 'beard', dateExpr: 'friday', time: '10:00' }));
  const before = r.db.alerts.length;
  const o = r.turn('no', answer('cancel', 0.85, noSlots));
  return { alerts: r.db.alerts.slice(before), stage: r.db.conv.stage, last_intent: r.db.conv.last_intent,
           reply: o.reply.slice(0, 60) };
}

if (require.main === module) {
  const COMMITTED = JSON.parse(readFileSync(join(ROOT, 'n8n/workflow.main.sanitized.json'), 'utf8'));
  const PRE = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', 'bc6eadf:n8n/workflow.main.sanitized.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const LIVE = { serviceId: 'beard', date: '2026-11-06', time: '10:00' };
  for (const [label, wf] of [['committed (N1)', COMMITTED], ['bc6eadf (before N1)', PRE]]) {
    console.log(`${label} · the live answer → ${JSON.stringify(run(wf, LIVE))}`);
    console.log(`${label} · empty slots     → ${JSON.stringify(run(wf, {}))}`);
  }
}
