/**
 * The live panel's send gate (lib/turnstileGate.ts; DATE-PHRASING R4, 2026-11-02): the "couldn't verify" notice only
 * while no token can be obtained, cleared by a success; a missing token alone only holds the send; a wait that never
 * ends is said after VERIFY_STUCK_MS.
 * The browser leg — the panel actually wired to this — is tests/browser/turnstile-gate.drill.mjs.
 *
 * Run: node --test lib/turnstileGate.test.ts   (Node strips the types; nothing is compiled)
 * TURNSTILE_GATE_MODULE overrides the module under test (tests/unit/turnstile-gate-mutants.py).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const g = await import(process.env.TURNSTILE_GATE_MODULE ?? './turnstileGate.ts');
const { composerGate, shouldRetry, waitingForToken, TURNSTILE_MAX_RETRIES, VERIFY_STUCK_MS,
  BLOCKED_PLACEHOLDER, RETRYING_PLACEHOLDER, STUCK_PLACEHOLDER, DEFAULT_PLACEHOLDER } = g;

test('the gap after a send (no token yet, nothing failed) holds the send and shows no notice — the owner run', () => {
  for (const state of ['loading', 'ready']) {
    const r = composerGate(false, state, 0);
    assert.deepEqual(r, { canSend: false, blocked: false, stuck: false, placeholder: DEFAULT_PLACEHOLDER }, state);
  }
});

test('a failure while retries remain is not a block: no notice, the retrying placeholder', () => {
  for (let errors = 1; errors <= TURNSTILE_MAX_RETRIES; errors++) {
    const r = composerGate(false, 'error', errors);
    assert.equal(r.blocked, false, `errors=${errors}`); assert.equal(r.canSend, false);
    assert.equal(r.placeholder, RETRYING_PLACEHOLDER);
  }
});

test('the retries failed too: the notice is shown and the send stays held — a real block is never hidden', () => {
  const r = composerGate(false, 'error', TURNSTILE_MAX_RETRIES + 1);
  assert.deepEqual(r, { canSend: false, blocked: true, stuck: false, placeholder: BLOCKED_PLACEHOLDER });
  assert.equal(composerGate(false, 'error', 9).blocked, true);
});

test('the script could not load or render (unavailable): blocked AT ONCE, never retried', () => {
  assert.deepEqual(composerGate(false, 'unavailable', 0), { canSend: false, blocked: true, stuck: false, placeholder: BLOCKED_PLACEHOLDER });
  assert.equal(composerGate(false, 'unavailable', 1).blocked, true);
  for (let errors = 0; errors <= 3; errors++) assert.equal(shouldRetry('unavailable', errors), false, `errors=${errors}`);
});

test('a token clears it: after any number of failures, a success shows no notice', () => {
  assert.deepEqual(composerGate(true, 'ready', 0), { canSend: true, blocked: false, stuck: false, placeholder: DEFAULT_PLACEHOLDER });
  assert.equal(composerGate(true, 'error', 9).blocked, false, 'a token in hand is never a block');
  assert.equal(composerGate(true, 'unavailable', 0).blocked, false);
});

test('stuck: a wait that outlasted the timer says so; a token or a block takes precedence over it', () => {
  assert.equal(VERIFY_STUCK_MS, 20000);
  assert.deepEqual(composerGate(false, 'ready', 0, true), { canSend: false, blocked: false, stuck: true, placeholder: STUCK_PLACEHOLDER });
  assert.deepEqual(composerGate(true, 'ready', 0, true), { canSend: true, blocked: false, stuck: false, placeholder: DEFAULT_PLACEHOLDER });
  const b = composerGate(false, 'unavailable', 0, true);
  assert.equal(b.blocked, true); assert.equal(b.stuck, false); assert.equal(b.placeholder, BLOCKED_PLACEHOLDER);
});

test('the stuck timer runs only while Turnstile has been rendered, no token is in hand, and nothing has failed', () => {
  assert.equal(waitingForToken(true, false, 'ready'), true, 'after a send: the reset is pending');
  assert.equal(waitingForToken(true, false, 'loading'), true, 'the first token after render');
  assert.equal(waitingForToken(false, false, 'loading'), false, 'not rendered: the visitor has not opened the panel');
  assert.equal(waitingForToken(true, true, 'ready'), false, 'a token in hand');
  assert.equal(waitingForToken(true, false, 'error'), false, 'a failure has its own retry and notice');
  assert.equal(waitingForToken(true, false, 'unavailable'), false);
});

test('retry: once per failure up to the limit, never after it, never without a failure', () => {
  assert.equal(TURNSTILE_MAX_RETRIES, 2);
  assert.equal(shouldRetry('error', 0), false);
  assert.equal(shouldRetry('error', 1), true);
  assert.equal(shouldRetry('error', TURNSTILE_MAX_RETRIES), true);
  assert.equal(shouldRetry('error', TURNSTILE_MAX_RETRIES + 1), false);
  assert.equal(shouldRetry('ready', 1), false);
  assert.equal(shouldRetry('loading', 1), false);
});
