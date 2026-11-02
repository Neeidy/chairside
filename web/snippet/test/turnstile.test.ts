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

test('error, then a success: ready with a token, and the next refresh asks for a new token', async () => {
  const { ts, h, states } = await mount();
  ts.error();
  assert.equal(states.at(-1), 'blocked');
  ts.pass('t1');
  assert.equal(states.at(-1), 'ready'); assert.equal(h.token(), 't1');
  h.refresh();                                   // the token was spent on a send
  assert.equal(h.token(), null);
  assert.equal(ts.resets(), 1, 'refresh reset the widget — a new token is on its way');
  assert.equal(states.at(-1), 'pending');
  ts.pass('t2');
  assert.equal(states.at(-1), 'ready'); assert.equal(h.token(), 't2');
});

test('a real block (no success ever): refresh keeps the blocked notice and does not pretend to verify', async () => {
  const { ts, h, states } = await mount();
  ts.error();
  h.refresh();
  assert.equal(states.at(-1), 'blocked'); assert.equal(h.token(), null);
  assert.equal(ts.resets(), 0);
});

test('the ordinary path: a token, a refresh after the send, the next token', async () => {
  const { ts, h, states } = await mount();
  ts.pass('t1'); assert.equal(h.token(), 't1');
  h.refresh(); assert.equal(ts.resets(), 1); assert.equal(states.at(-1), 'pending');
  ts.pass('t2'); assert.equal(states.at(-1), 'ready');
});
