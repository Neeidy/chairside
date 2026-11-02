/**
 * The live panel's send gate (lib/turnstileGate.ts; DATE-PHRASING R4, 2026-11-02): the "couldn't verify" notice only
 * while no token can be obtained, cleared by a success; a missing token alone only holds the send.
 * The browser leg — the panel actually wired to this — is tests/browser/turnstile-gate.drill.mjs.
 *
 * Run: node --test lib/turnstileGate.test.ts   (Node strips the types; nothing is compiled)
 * TURNSTILE_GATE_MODULE overrides the module under test (tests/unit/turnstile-gate-mutants.py).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const g = await import(process.env.TURNSTILE_GATE_MODULE ?? './turnstileGate.ts');
const { composerGate, shouldRetry, TURNSTILE_MAX_RETRIES, BLOCKED_PLACEHOLDER, RETRYING_PLACEHOLDER, DEFAULT_PLACEHOLDER } = g;

test('the gap after a send (no token yet, nothing failed) holds the send and shows no notice — the owner run', () => {
  for (const state of ['loading', 'ready']) {
    const r = composerGate(false, state, 0);
    assert.deepEqual(r, { canSend: false, blocked: false, placeholder: DEFAULT_PLACEHOLDER }, state);
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
  assert.deepEqual(r, { canSend: false, blocked: true, placeholder: BLOCKED_PLACEHOLDER });
  assert.equal(composerGate(false, 'error', 9).blocked, true);
});

test('a token clears it: after any number of failures, a success (token, ready, the count reset) shows no notice', () => {
  assert.deepEqual(composerGate(true, 'ready', 0), { canSend: true, blocked: false, placeholder: DEFAULT_PLACEHOLDER });
  assert.equal(composerGate(true, 'error', 9).blocked, false, 'a token in hand is never a block');
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
