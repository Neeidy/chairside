// Turnstile gate drill — the "couldn't verify this browser" notice must appear ONLY while no valid token can be
// obtained, and must clear on a later success (DATE-PHRASING R4, 2026-11-02: the owner saw it between two messages
// while nothing was blocked).
//
// HOW: headless Chromium over CDP against a LOCAL build of the site (and the snippet it serves). Cloudflare's api.js is
// intercepted and replaced by a STUB whose callbacks the drill drives (pass / error), so an error→success sequence is
// deterministic — real Turnstile cannot be made to fail and then succeed on demand. The engine host is answered
// locally with a 200 reply. EVERY other request to a host that is not loopback, Cloudflare's challenge host or the fake
// engine is FAILED in the browser and counted, so a run against a build that points at a real engine sends nothing.
// MODE `real-pass` / `real-block`: no stub — the REAL Turnstile script, with a build carrying Cloudflare's always-pass
// (1x…AA) or always-block (2x…AB) TEST sitekey; only the engine is intercepted.
//
// Usage: node tests/browser/turnstile-gate.drill.mjs <site|snippet> <url> <cdpPort> [stub|real-pass|real-block]
//   site    url = the built site's page (the live panel)      snippet url = a host page that loads barber-widget.js
// Needs: a Chromium binary at $CHROME (default: the Playwright cache path) and a build whose NEXT_PUBLIC_WEBHOOK_URL
// points at engine.example.test. Exit 0 = every case passed. Not in check-all: it needs a browser and a build.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [surface, url, port, mode = 'stub'] = process.argv.slice(2);
const REAL = mode !== 'stub';
const BIN = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOTICE = /couldn.t verify this browser/i;
const STUCK = /still (checking this browser|verifying)/i;
const ENGINE = 'engine.example.test';
const CHALLENGE = 'challenges.cloudflare.com';

const STUB = `(() => {
  const w = [];
  window.turnstile = {
    render(el, o) { w.push({ el, o, resets: 0 }); return 'w' + (w.length - 1); },
    reset() { if (w[0]) w[0].resets++; },
    remove() {},
  };
  window.__ts = {
    pass(t) { w[0].o.callback(t); },
    error() { w[0].o['error-callback'](); },
    rendered() { return w.length; },
    resets() { return w[0] ? w[0].resets : 0; },
  };
})();`;

const ROOT = surface === 'site' ? 'document' : `document.getElementById('barber-widget-root')?.shadowRoot`;
const Q = surface === 'site'
  ? { launcher: `document.getElementById('widget-launcher')`, input: `${ROOT}.querySelector('#site-panel .panel-input')`,
      send: `${ROOT}.querySelector('#site-panel .panel-send')`, thread: `${ROOT}.querySelector('#site-panel .thread')` }
  : { launcher: `${ROOT}?.querySelector('.launcher')`, input: `${ROOT}?.querySelector('[data-input]')`,
      send: `${ROOT}?.querySelector('[data-send]')`, thread: `${ROOT}?.querySelector('.thread')` };

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'ts-gate-'));
  const chrome = spawn(BIN, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { chrome.kill('SIGTERM'); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); };
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) { cleanup(); throw new Error('no CDP target'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  const b = { posts: [], foreign: [], failScript: false };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const cors = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'POST' },
    { name: 'Access-Control-Allow-Headers', value: 'content-type' }];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); return; }
    if (m.method !== 'Fetch.requestPaused') return;
    const r = m.params.request; const rid = m.params.requestId;
    const host = new URL(r.url).hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      send('Fetch.continueRequest', { requestId: rid });
    } else if (host === CHALLENGE) {
      if (b.failScript) send('Fetch.failRequest', { requestId: rid, errorReason: 'BlockedByClient' });
      else if (REAL) send('Fetch.continueRequest', { requestId: rid });
      else send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(STUB).toString('base64') });
    } else if (host === ENGINE) {
      if (r.method === 'OPTIONS') { send('Fetch.fulfillRequest', { requestId: rid, responseCode: 204, responseHeaders: cors }); return; }
      let token = '';
      try { token = JSON.parse(r.postData || '{}').turnstileToken || ''; } catch {}
      if (token) b.posts.push(token);   // chatClient's no-cors diagnostic ping carries no token and is not a send
      const body = JSON.stringify({ channel: 'widget', sender_key: 'widget:w-drill', reply: `FAKE REPLY ${b.posts.length}` });
      send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200,
        responseHeaders: [...cors, { name: 'Content-Type', value: 'application/json' }], body: Buffer.from(body).toString('base64') });
    } else {
      b.foreign.push(host);              // anything else never leaves the machine
      send('Fetch.failRequest', { requestId: rid, errorReason: 'BlockedByClient' });
    }
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  b.send = send;
  b.ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
  b.close = () => { try { ws.close(); } catch {} cleanup(); };
  return b;
}

async function page(b, { failScript = false } = {}) {
  b.posts.length = 0; b.failScript = failScript;
  await b.send('Page.navigate', { url });
  for (let i = 0; i < 40; i++) { await sleep(250); if (await b.ev(`!!(${Q.launcher})`)) break; }
  await b.ev(`(${Q.launcher}).click()`);
  if (failScript) { await sleep(1500); return; }
  if (REAL) { for (let i = 0; i < 40; i++) { await sleep(250); if (await b.ev('!!window.turnstile')) return; } throw new Error('the Turnstile script never loaded'); }
  for (let i = 0; i < 40; i++) { await sleep(250); if (await b.ev('window.__ts && window.__ts.rendered() > 0')) return; }
  throw new Error('Turnstile was never rendered');
}
const state = (b) => b.ev(`(() => { const i = ${Q.input}, s = ${Q.send}, t = ${Q.thread};
  const msgs = [...t.querySelectorAll('.msg')];
  return { value: i.value, placeholder: i.placeholder, inputDisabled: i.disabled, sendDisabled: s.disabled,
    notices: msgs.filter((m) => /couldn.t verify this browser/i.test(m.textContent)).length,
    stuckNotes: msgs.filter((m) => /still checking this browser/i.test(m.textContent)).length,
    replies: msgs.filter((m) => /FAKE REPLY/.test(m.textContent)).length,
    resets: window.__ts ? window.__ts.resets() : null }; })()`);
async function type(b, text) {
  await b.ev(`(${Q.input}).focus()`);
  await b.send('Input.insertText', { text });
  await sleep(150);
}
async function enter(b) {   // a real Enter in the input: implicit submission, refused by the browser when the button is disabled
  // A DISABLED input cannot take focus, so a visitor cannot press Enter in it — and the key would land on whatever has
  // focus instead (measured: the snippet's launcher, which then closed the panel and voided the rest of the case).
  if (await b.ev(`(${Q.input}).disabled`)) { await sleep(600); return; }
  await b.ev(`(${Q.input}).focus()`);
  for (const type of ['keyDown', 'keyUp'])
    await b.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) });
  await sleep(600);
}
async function waitFor(b, pred, ms) { for (let i = 0; i < ms / 250; i++) { if (pred(await state(b))) return true; await sleep(250); } return false; }
const noticeShown = (s) => s.notices > 0 || NOTICE.test(s.placeholder);
const stuckShown = (s) => s.stuckNotes > 0 || STUCK.test(s.placeholder);
const tokenReady = (s) => (surface === 'site' ? s.sendDisabled === false : s.inputDisabled === false);

const results = [];
function check(name, ok, detail) { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${surface} · ${name} — ${JSON.stringify(detail)}`); }

async function stubCases(b) {
  // 1. THE OWNER'S CASE: a message sent, its reply drawn, the next token not minted yet, and the visitor sends again.
  await page(b);
  await b.ev(`window.__ts.pass('t1')`); await sleep(200);
  await type(b, 'hello'); await enter(b);
  await waitFor(b, (s) => s.replies >= 1, 5000);
  await type(b, 'yes'); await enter(b);
  let s = await state(b);
  if (surface === 'site') {
    check('a send in the gap (no token yet, nothing blocked) is held: no notice, the draft kept, nothing sent',
      !noticeShown(s) && s.value === 'yes' && s.sendDisabled && b.posts.length === 1, { ...s, posts: b.posts.length });
  } else {
    check('the composer is disabled in the gap: no notice, nothing sent', !noticeShown(s) && s.inputDisabled && b.posts.length === 1, { ...s, posts: b.posts.length });
  }
  await b.ev(`window.__ts.pass('t2')`); await sleep(200);
  if (!(await state(b)).value) await type(b, 'yes');
  await enter(b);
  await waitFor(b, (x) => x.replies >= 2, 5000);
  s = await state(b);
  check('the next token arrives: the message goes out and is answered', b.posts.length === 2 && s.replies === 2 && !noticeShown(s), { ...s, posts: b.posts.length });

  // 2. A TRANSIENT ERROR, THEN SUCCESS (Cloudflare retries; the drill drives the outcome).
  await page(b);
  await b.ev(`window.__ts.error()`); await sleep(300);
  await type(b, 'hello'); await enter(b);
  const sentDuringError = b.posts.length;
  await sleep(2800);                            // the site's own retry fires after 2.5 s
  await b.ev(`window.__ts.pass('t3')`); await sleep(300);
  s = await state(b);
  check('error then success: no notice left once a token exists', !noticeShown(s) && tokenReady(s) && sentDuringError === 0, { ...s, sentDuringError });
  if (!s.value) await type(b, 'hello');
  const resetsBefore = (await state(b)).resets;
  await enter(b);
  await waitFor(b, (x) => x.replies >= 1, 5000);
  s = await state(b);
  check('error then success: a later send carries the token, and the send itself asks for the next one',
    b.posts.length === 1 && s.replies === 1 && s.resets === resetsBefore + 1, { ...s, resetsBefore, posts: b.posts.length });

  // 3. A REAL BLOCK: every attempt fails (the first and every retry). The notice must be on screen.
  await page(b);
  for (let k = 0; k < 3; k++) { await b.ev(`window.__ts.error()`); await sleep(2800); }
  await type(b, 'hello'); await enter(b);
  s = await state(b);
  check('a real block: the notice is shown and nothing is sent', noticeShown(s) && b.posts.length === 0, { ...s, posts: b.posts.length });
  // 3b. … and a success after it takes the notice away; the next single failure is retried again, not a block.
  await b.ev(`window.__ts.pass('t4')`); await sleep(400);
  s = await state(b);
  const clearedOnSuccess = !noticeShown(s) && tokenReady(s);
  await b.ev(`window.__ts.error()`); await sleep(400);
  const afterOneMore = await state(b);
  check('after a block, a success clears the notice and the next single failure is not a block',
    clearedOnSuccess && !noticeShown(afterOneMore), { clearedOnSuccess, afterOneMore });

  // 4. THE SCRIPT NEVER LOADS (a blocker, a network policy): nothing to retry — the notice at once.
  await page(b, { failScript: true });
  const shown = await waitFor(b, noticeShown, 6000);
  s = await state(b);
  check('the Turnstile script does not load: the notice is shown, nothing is sent', shown && b.posts.length === 0, { ...s, posts: b.posts.length });

  // 5. A WAIT THAT NEVER ENDS: a send, then the reset's callback never comes. Said after 20 s; gone with the token.
  await page(b);
  await b.ev(`window.__ts.pass('t5')`); await sleep(200);
  await type(b, 'hello'); await enter(b);
  await waitFor(b, (x) => x.replies >= 1, 5000);
  const quietAt15 = await (async () => { await sleep(15000); return !stuckShown(await state(b)); })();
  const saidBy25 = await waitFor(b, stuckShown, 10000);
  await b.ev(`window.__ts.pass('t6')`); await sleep(400);
  s = await state(b);
  const gone = surface === 'site' ? !stuckShown(s) : tokenReady(s) && !STUCK.test(s.placeholder);
  check('a wait that never ends: quiet at 15 s, said by 25 s, and the token takes it away', quietAt15 && saidBy25 && gone, { quietAt15, saidBy25, ...s });
}

async function realCases(b) {
  if (mode === 'real-block') {
    // Cloudflare's always-block key fails every attempt; the site retries twice (2.5 s apart) before it says so.
    await page(b);
    const shown = await waitFor(b, noticeShown, 20000);
    await type(b, 'hello'); await enter(b);
    const s = await state(b);
    check('always-block key: the notice is shown, nothing is sent', shown && noticeShown(s) && b.posts.length === 0, { ...s, posts: b.posts.length });
    return;
  }
  // Always-pass key: two messages back to back, the second typed the moment the first is answered (the owner's case).
  await page(b);
  if (surface === 'site') await type(b, 'hello');
  const first = await waitFor(b, tokenReady, 20000);
  if (surface === 'snippet') await type(b, 'hello');
  await enter(b);
  await waitFor(b, (s) => s.replies >= 1, 10000);
  await type(b, 'yes'); await enter(b);
  let s = await state(b);
  const noticeAfterQuickSend = noticeShown(s);
  await waitFor(b, tokenReady, 20000);
  if (!(await state(b)).value) await type(b, 'yes');
  if (b.posts.length < 2) await enter(b);
  await waitFor(b, (x) => x.replies >= 2, 10000);
  s = await state(b);
  check('always-pass key: a token, two sends back to back, no notice at any point',
    first && !noticeAfterQuickSend && !noticeShown(s) && b.posts.length === 2 && s.replies === 2, { ...s, posts: b.posts.length, noticeAfterQuickSend });
}

async function main() {
  const b = await browser();
  try { await (REAL ? realCases(b) : stubCases(b)); } finally { b.close(); }
  console.log(`  requests failed in the browser because their host was not allowed: ${b.foreign.length} ${JSON.stringify([...new Set(b.foreign)])}`);
  const failed = results.filter((x) => !x).length;
  console.log(`${surface} (${mode}): ${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => { console.log(`${surface}: harness error ${e.message}`); process.exitCode = 2; });
