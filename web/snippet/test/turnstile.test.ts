/**
 * The snippet's Turnstile mount (src/turnstile.ts; DATE-PHRASING R4, 2026-11-02): a success ends a block, so the next
 * refresh asks for a token again; a real block (no success ever) keeps its notice. Driven with a fake `window.turnstile`
 * whose callbacks the test calls — real Turnstile cannot be made to fail and then succeed on demand.
 * The browser leg is tests/browser/turnstile-gate.drill.mjs.
 *
 * Run: node --test test/turnstile.test.ts   (Node strips the types; nothing is compiled)
 * SNIPPET_TURNSTILE_MODULE overrides the module under test (tests/unit/turnstile-gate-mutants.py).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

type Opts = Record<string, (...a: unknown[]) => void>;

function fakeTurnstile() {
  const w: { opts: Opts; resets: number }[] = [];
  return {
    api: {
      render: (_el: unknown, o: Opts) => { w.push({ opts: o, resets: 0 }); return 'w0'; },
      reset: () => { if (w[0]) w[0].resets++; },
      remove: () => {},
    },
    pass: (t: string) => w[0].opts.callback(t),
    error: () => w[0].opts['error-callback'](),
    resets: () => (w[0] ? w[0].resets : 0),
    rendered: () => w.length,
  };
}
const slot = { offsetParent: {}, getBoundingClientRect: () => ({ width: 300 }), classList: { add: () => {} } };
const tick = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mount() {
  const ts = fakeTurnstile();
  (globalThis as unknown as { window: unknown }).window = { turnstile: ts.api };
  const { mountTurnstile } = await import(process.env.SNIPPET_TURNSTILE_MODULE ?? '../src/turnstile.ts');
  const states: string[] = [];
  const h = mountTurnstile(slot as unknown as HTMLElement, 'test-key', (s: string) => states.push(s));
  for (let i = 0; i < 5 && !ts.rendered(); i++) await tick();
  assert.equal(ts.rendered(), 1, 'rendered once');
  return { ts, h, states };
}

test('one failure is retried, not a block: pending, our own reset after the retry delay, then a success and the next token', async () => {
  const { ts, h, states } = await mount();
  ts.error();
  assert.equal(states.at(-1), 'pending', 'a failure with retries left is not called a block');
  await wait(2600);
  assert.equal(ts.resets(), 1, 'the widget was reset once after the retry delay');
  ts.pass('t1');
  assert.equal(states.at(-1), 'ready'); assert.equal(h.token(), 't1');
  h.refresh();                                   // the token was spent on a send
  assert.equal(h.token(), null);
  assert.equal(ts.resets(), 2, 'refresh reset the widget — a new token is on its way');
  assert.equal(states.at(-1), 'pending');
  ts.pass('t2');
  assert.equal(states.at(-1), 'ready'); assert.equal(h.token(), 't2');
});

test('a real block (every attempt fails): blocked after the retries, refresh keeps it, no further reset', async () => {
  const { ts, h, states } = await mount();
  ts.error(); ts.error();
  assert.equal(states.at(-1), 'pending');
  ts.error();
  assert.equal(states.at(-1), 'blocked'); assert.equal(h.token(), null);
  h.refresh();
  assert.equal(states.at(-1), 'blocked');
  await wait(2600);
  assert.equal(ts.resets(), 0, 'the pending retry was cancelled by the block');
});

test('after a block, a success ends it, and the next single failure is retried again', async () => {
  const { ts, h, states } = await mount();
  ts.error(); ts.error(); ts.error();
  assert.equal(states.at(-1), 'blocked');
  ts.pass('t1');
  assert.equal(states.at(-1), 'ready'); assert.equal(h.token(), 't1');
  const r0 = ts.resets();
  h.refresh();                                   // the token spent on a send: the block is over, so a new one is asked for
  assert.equal(ts.resets(), r0 + 1, 'refresh reset the widget — the block did not outlive the success');
  ts.error();
  assert.equal(states.at(-1), 'pending', 'the count started again');
});

test('the ordinary path: a token, a refresh after the send, the next token', async () => {
  const { ts, h, states } = await mount();
  ts.pass('t1'); assert.equal(h.token(), 't1');
  h.refresh(); assert.equal(ts.resets(), 1); assert.equal(states.at(-1), 'pending');
  ts.pass('t2'); assert.equal(states.at(-1), 'ready');
});

test('the Turnstile script does not load (a blocker, a network policy): blocked, and refresh keeps it so', async () => {
  const g = globalThis as unknown as { window: unknown; document: unknown };
  g.window = {};   // no window.turnstile: the module appends Cloudflare's script, which fails
  g.document = { createElement: () => ({}), head: { appendChild: (s: { onerror: () => void }) => setTimeout(() => s.onerror(), 0) } };
  const { mountTurnstile } = await import(process.env.SNIPPET_TURNSTILE_MODULE ?? '../src/turnstile.ts');
  const states: string[] = [];
  const h = mountTurnstile(slot as unknown as HTMLElement, 'test-key', (s: string) => states.push(s));
  for (let i = 0; i < 10 && states.at(-1) !== 'blocked'; i++) await tick();
  assert.equal(states.at(-1), 'blocked'); assert.equal(h.token(), null);
  h.refresh();
  assert.equal(states.at(-1), 'blocked', 'no optimistic "Verifying…" over a script that never loaded');
});
