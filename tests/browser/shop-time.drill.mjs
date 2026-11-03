// Shop-time drill (CLOSE-OUT S2, ruling DC-2) — a message time is the SHOP's wall clock whatever zone the visitor's
// browser is in, and the panel names that zone once.
//
// HOW: headless Chromium over CDP against a LOCAL build of the site (and the snippet it serves). The page's clock is
// FIXED at one instant (2026-11-03 13:07 UTC: 14:07 in Vienna, 08:07 in New York, 22:07 in Tokyo) and the browser's
// zone is overridden (Emulation.setTimezoneOverride) — once to America/New_York, once to Asia/Tokyo. The welcome
// bubble's stamp must be the shop's time in both, and the same text in both. A control reads the browser's own local
// hour in each run, so a zone override that did not take effect cannot pass as a result. Every request to a host that
// is not loopback is FAILED in the browser (Turnstile included — this drill needs no token and sends nothing).
//
// Usage: node tests/browser/shop-time.drill.mjs <site|snippet> <url> <cdpPort>
//   site    url = the built site's page          snippet url = a host page that loads barber-widget.js
// The shop's zone is read from web/site/config.generated.json, the config the build used. Exit 0 = every case passed.
// Not in check-all: it needs a browser and a build.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [surface, url, port] = process.argv.slice(2);
const BIN = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INSTANT = Date.UTC(2026, 10, 3, 13, 7);
const VISITOR_ZONES = ['America/New_York', 'Asia/Tokyo'];

const FIXED_CLOCK = `(() => {
  const T = ${INSTANT}; const D = Date;
  class FixedDate extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
  window.Date = FixedDate;
})();`;

const ROOT = surface === 'site' ? 'document' : `document.getElementById('barber-widget-root')?.shadowRoot`;
const PANEL = surface === 'site' ? `${ROOT}.querySelector('#site-panel')` : `${ROOT}?.querySelector('.panel')`;

async function run(zone) {
  const profile = mkdtempSync(join(tmpdir(), 'shop-time-'));
  const chrome = spawn(BIN, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { chrome.kill('SIGTERM'); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); };
  try {
    let target;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
    }
    if (!target) throw new Error('no CDP target');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); setTimeout(() => j(new Error('CDP socket never opened')), 10000); });
    let id = 0; const pending = new Map(); const foreign = [];
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); return; }
      if (m.method !== 'Fetch.requestPaused') return;
      const host = new URL(m.params.request.url).hostname;
      if (host === '127.0.0.1' || host === 'localhost') send('Fetch.continueRequest', { requestId: m.params.requestId });
      else { foreign.push(host); send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }); }
    });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }))?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setTimezoneOverride', { timezoneId: zone });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: FIXED_CLOCK });
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Page.navigate', { url });
    let out;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      out = await ev(`(() => { const p = ${PANEL}; if (!p) return null;
        const stamp = p.querySelector('.thread .msg .stamp')?.textContent || '';
        const notes = [...p.querySelectorAll('*')].filter((e) => e.children.length === 0 && /shop time \\(/i.test(e.textContent || ''));
        return { stamp, notes: notes.map((e) => e.textContent), localHour: new Date().getHours(), now: Date.now() }; })()`);
      if (out && out.stamp) break;
    }
    ws.close();
    return { ...out, foreign: [...new Set(foreign)] };
  } finally { cleanup(); }
}

const results = [];
function check(name, ok, detail) { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${surface} · ${name} — ${JSON.stringify(detail)}`); }

async function main() {
  const shopZone = JSON.parse(readFileSync(join(ROOT_DIR, 'web/site/config.generated.json'), 'utf8')).business.timezone;
  // The shop's hour and minute at the fixed instant, from Node's own tz data: digits only, so the browser's locale
  // (12- or 24-hour) does not matter. 14:07 → "14:07" or "02:07 PM".
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: shopZone })
    .formatToParts(new Date(INSTANT)).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  const shopClock = new RegExp(`\\b0?(${h}|${h % 12 || 12})[:.]${p.minute}\\b`);
  const runs = [];
  for (const zone of VISITOR_ZONES) runs.push({ zone, ...(await run(zone)) });
  for (const r of runs) {
    check(`browser in ${r.zone}: the clock is fixed and the zone override took effect (control)`,
      r.now === INSTANT && r.localHour === Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: r.zone }).format(new Date(INSTANT))), r);
    check(`browser in ${r.zone}: the message time is the shop's wall clock (${shopZone} ${p.hour}:${p.minute})`, shopClock.test(r.stamp || ''), r);
    const label = shopZone.replace(/_/g, ' ');
    check(`browser in ${r.zone}: the panel names the shop's zone exactly once`, r.notes?.length === 1 && r.notes[0].includes(label), r);
    console.log(`  ${r.zone}: requests failed in the browser because their host was not loopback: ${JSON.stringify(r.foreign)}`);
  }
  check('the same time label under both browser zones', runs[0].stamp && runs[0].stamp === runs[1].stamp, runs.map((r) => r.stamp));
  const failed = results.filter((x) => !x).length;
  console.log(`${surface} (shop time): ${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => { console.log(`${surface}: harness error ${e.message}`); process.exitCode = 2; });
