#!/usr/bin/env node
/*
 * Guard: the hero's demo bot lines must stay ENGINE-VERBATIM, and its sample booking must read like the engine today.
 *
 * WHY: the public marketing page shows the bot talking. Those bubbles are not decoration — a visitor
 * reads them as what the product actually says. Inventing or drifting that copy is a logged defect class
 * in this repo. Two of the four scenarios use strings that live as LITERALS inside n8n Code nodes, so
 * web/site/lib/heroScenarios.ts necessarily holds a DERIVED copy of engine wording
 * (.claude/rules/contract-integrity.md allows a derived copy only with a drift guard — this is it).
 *
 * What this checks, against the Main export the repo is heading to — the STAGED one while a staged edit exists
 * (`n8n/staged/workflow.main.sanitized.json`), else the committed export — and the committed example config:
 *   1. every engine LITERAL shape the hero reproduces still exists in its named node (the name in the confirm included)
 *   2. every messageTemplates key the hero fills still exists in the config (askName included)
 *   3. the booking flow shows the NAME STEP and the NAMED confirm, in the engine's order — in the hero's 'booking'
 *      scenario and in the static SitePanel, both through heroScenarios.ts `bookingLines`
 *   4. the sample DATE: lib/heroSlot.ts is loaded and run for 400 consecutive days plus the DST and year-end edges;
 *      every output must equal Luxon's own engine formatting of a Friday 15:30 that is AFTER today in the shop
 *      timezone (never in the past, weekday agreeing with the date). No fixed date may sit in the hero or the panel,
 *      and app/page.tsx must stay `force-dynamic` — a prerendered page freezes the date at deploy time.
 *   5. EMBEDDED MUTANTS, on every run: each of checks 3–4 is fed a broken input (no name ask, no name in the confirm,
 *      a fixed past date, a wrong weekday, the panel without its name step, the page prerendered again, a literal
 *      date back in the hero) and must go RED. A mutant that passes fails this guard: a check that cannot go red
 *      proves nothing.
 *      (Why the mutants live here and not in a test file: ruling 2 of the CLOSE-OUT hero round — check-all runs this
 *      script, and scripts/package.json is not touched.)
 * WHY the staged export when there is one: the hero source moves in the same commit as the staged engine edit, and
 * the site is redeployed only after that edit is live and promoted (the R3 live plan states the order) — so the
 * page never quotes a wording the live engine does not yet say.
 * Exit 1 = the engine's wording moved (or the hero no longer shows it), and the marketing page is now quoting
 * something the bot no longer says.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STAGED = path.join(ROOT, "n8n/staged/workflow.main.sanitized.json");
const WF = process.env.SANITIZED_PATH || (fs.existsSync(STAGED) ? STAGED : path.join(ROOT, "n8n/workflow.main.sanitized.json"));
const CONFIRM_FMT = "cccc d LLL yyyy HH:mm";   // Compute Availability's confirm format (R2d)
const WHEN_FMT = "cccc d LLL HH:mm";           // Build Cancel-Confirm State / Build Cancelled State
const DATE_FMT = "cccc d LLL";                 // bookingConfirmed's {date} (Build Booked State)
const CFG = process.env.CONFIG_EXAMPLE || path.join(ROOT, "config/client.config.example.json");
const HERO_PATH = path.join(ROOT, "web/site/lib/heroScenarios.ts");
const PANEL_PATH = path.join(ROOT, "web/site/components/site/SitePanel.tsx");
const PAGE_PATH = path.join(ROOT, "web/site/app/page.tsx");
const SLOT_PATH = path.join(ROOT, "web/site/lib/heroSlot.ts");
const CUSTOMER = "Kim Moss";                   // the synthetic demo name the hero must show

// [node name, exact substring that must appear in that node's jsCode, which hero bubble depends on it]
const LITERALS = [
  ["Compute Availability", "— shall I book it? (yes / no)", "W12 booking confirm-ask"],
  ["Compute Availability", `const fmtConfirm = start.toFormat('${CONFIRM_FMT}');`, "W12 date format (the year, R2d)"],
  ["Compute Availability", "${svcName}, ${fmtConfirm}", "W12 reads the year-bearing format"],
  ["Compute Availability", "${slots.customerName ? ' for ' + slots.customerName : ''} — shall I book it? (yes / no)",
    "W12 names the customer (NAME-CAPTURE)"],
  ["Slot Gate", "next_ask === 'datetime' ? datetimeAsk() : t.askName", "the name ask, after service and date/time"],
  ["Build Cancel-Confirm State", `toFormat('${WHEN_FMT}')`, "W19 cancel date format"],
  ["Build Cancel-Confirm State", 'Reply "yes" to cancel, or anything else to keep it.', "W19 cancel confirm-ask"],
  ["Answer FAQ", "is ${money(one)}.", "W3 single-service price"],
  ["Answer FAQ", "'Opening hours — '", "W5 opening hours"],
  ["Answer FAQ", "' · '", "W5 hours separator"],
  ["Answer FAQ", "'closed'", "W5 closed-day word"],
];
const TEMPLATE_KEYS = [
  ["askName", "the name step"], ["bookingConfirmed", "W13"], ["cancelDone", "W20"], ["handoff", "W44"],
  ["handoffLocked", "W47"],
];

// ── 3. the name step and the named confirm (pure: takes source text, returns the errors) ─────────────────────
function checkHero(src) {
  const errs = [];
  const fnStart = src.indexOf("export function bookingLines(");
  const fn = fnStart >= 0 ? src.slice(fnStart, src.indexOf("\n}\n", fnStart)) : "";
  if (!fn) errs.push("heroScenarios.ts has no bookingLines()");
  if (!/askName:\s*t\.askName,/.test(fn)) errs.push("bookingLines() does not take the name ask from messageTemplates.askName");
  if (!fn.includes("confirm: `${svc.name}, ${slot.whenConfirm} for ${DEMO_CUSTOMER} — shall I book it? (yes / no)`"))
    errs.push("bookingLines() confirm is not the engine's W12 with the year-bearing date AND the customer's name");
  if (!src.includes(`export const DEMO_CUSTOMER = '${CUSTOMER}';`)) errs.push(`DEMO_CUSTOMER is not the synthetic '${CUSTOMER}'`);
  const b0 = src.indexOf("id: 'booking'"), b1 = src.indexOf("id: 'cancel'");
  const block = b0 >= 0 && b1 > b0 ? src.slice(b0, b1) : "";
  const iAsk = block.indexOf("text: lines.askName"), iName = block.indexOf("text: DEMO_CUSTOMER"),
    iConfirm = block.indexOf("text: lines.confirm"), iBooked = block.indexOf("text: lines.booked");
  if (iAsk < 0) errs.push("the 'booking' scenario has no name-ask bubble (lines.askName)");
  if (iName < 0) errs.push("the 'booking' scenario has no customer bubble answering with the name");
  if (iConfirm < 0) errs.push("the 'booking' scenario has no W12 confirm bubble (lines.confirm)");
  if (iBooked < 0) errs.push("the 'booking' scenario has no W13 booked bubble (lines.booked)");
  if (iAsk >= 0 && iName >= 0 && iConfirm >= 0 && !(iAsk < iName && iName < iConfirm && iConfirm < iBooked))
    errs.push("the 'booking' scenario is not in the engine's order: name ask → name → confirm → booked");
  if (!/const slot = heroSlot\(now, cfg\.business\.timezone\);/.test(src)) errs.push("heroScenarios() does not derive the slot from heroSlot(now, shop timezone)");
  return errs.concat(noFixedDate(src, "heroScenarios.ts"));
}

function checkPanel(src) {
  const errs = [];
  if (!src.includes("bookingLines(config, heroSlot(new Date(), config.business.timezone))"))
    errs.push("SitePanel.tsx does not take its lines from bookingLines() with the request-time slot");
  const iAsk = src.indexOf("{lines.askName}"), iName = src.indexOf("{DEMO_CUSTOMER}"),
    iConfirm = src.indexOf("{lines.confirm}"), iBooked = src.indexOf("{lines.booked}");
  if (iAsk < 0) errs.push("SitePanel.tsx has no name-ask step");
  if (iName < 0) errs.push("SitePanel.tsx has no customer step answering with the name");
  if (iConfirm < 0 || iBooked < 0) errs.push("SitePanel.tsx lacks the named W12 confirm or the W13 line");
  if (iAsk >= 0 && iName >= 0 && iConfirm >= 0 && !(iAsk < iName && iName < iConfirm && iConfirm < iBooked))
    errs.push("SitePanel.tsx is not in the engine's order: name ask → name → confirm → booked");
  return errs.concat(noFixedDate(src, "SitePanel.tsx"));
}

function noFixedDate(src, label) {
  const m = src.match(/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
  return m ? [`${label} holds a fixed date ("${m[0]}") — the sample date must come from heroSlot()`] : [];
}

function checkPage(src) {
  return /^export const dynamic = 'force-dynamic';$/m.test(src) ? []
    : ["app/page.tsx is not force-dynamic — a prerendered page freezes the sample date at deploy time"];
}

// ── 4. the date: run the slot function and compare with Luxon's engine formatting ────────────────────────────
function checkSlot(slotFn, DateTime, tz) {
  const errs = [];
  const probe = (at) => {
    const s = slotFn(at, tz);
    const today = DateTime.fromJSDate(at).setZone(tz).startOf("day");
    const d = DateTime.fromFormat(s.whenConfirm || "", CONFIRM_FMT, { zone: tz, locale: "en-US" });
    const where = `at ${at.toISOString()}`;
    if (!d.isValid || d.toFormat(CONFIRM_FMT) !== s.whenConfirm) return errs.push(`${where}: "${s.whenConfirm}" is not the engine's '${CONFIRM_FMT}' (or its weekday disagrees with its date)`);
    if (d.weekday !== 5 || d.toFormat("HH:mm") !== "15:30") return errs.push(`${where}: "${s.whenConfirm}" is not a Friday at 15:30 — the customer asks for "Friday at 15:30"`);
    const ahead = d.startOf("day").diff(today, "days").days;
    if (!(ahead >= 1 && ahead <= 7)) return errs.push(`${where}: "${s.whenConfirm}" is ${ahead} day(s) from today in ${tz} — must be the next Friday after today, never today or the past`);
    if (s.when !== d.toFormat(WHEN_FMT) || s.date !== d.toFormat(DATE_FMT) || s.time !== "15:30")
      return errs.push(`${where}: when/date/time disagree with the engine formats of the same date`);
  };
  const start = Date.now();
  for (let i = 0; i < 400 && errs.length < 3; i++) probe(new Date(start + i * 86400000));
  // the drill matrix: a Friday before and after 15:30, the shop-midnight edge, both DST weeks, the year end
  for (const iso of ["2026-11-06T08:00:00Z", "2026-11-06T16:00:00Z", "2026-11-05T22:59:00Z", "2026-11-05T23:01:00Z",
    "2026-03-27T12:00:00Z", "2026-03-29T00:30:00Z", "2026-10-23T12:00:00Z", "2026-10-25T00:30:00Z",
    "2026-12-31T12:00:00Z", "2027-01-01T12:00:00Z"]) { if (errs.length < 3) probe(new Date(iso)); }
  return errs;
}

function main() {
  const wf = JSON.parse(fs.readFileSync(WF, "utf8"));
  const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
  const nodeCode = (name) => {
    const n = (wf.nodes || []).find((x) => x.name === name);
    return n ? (n.parameters && n.parameters.jsCode) || "" : null;
  };
  const errors = [];
  for (const [node, needle, why] of LITERALS) {
    const code = nodeCode(node);
    if (code === null) { errors.push(`node "${node}" not found (${why})`); continue; }
    if (!code.includes(needle)) errors.push(`${node}: literal moved — ${why}\n      expected to find: ${needle}`);
  }
  for (const [key, w] of TEMPLATE_KEYS) {
    if (!cfg.messageTemplates || typeof cfg.messageTemplates[key] !== "string") errors.push(`messageTemplates.${key} missing (${w})`);
  }
  const { DateTime } = require(path.join(ROOT, "scripts/node_modules/luxon"));
  const { heroSlot } = require(SLOT_PATH);   // plain Node type stripping — heroSlot.ts imports nothing on purpose
  const tz = cfg.business && cfg.business.timezone;
  const hero = fs.readFileSync(HERO_PATH, "utf8");
  const panel = fs.readFileSync(PANEL_PATH, "utf8");
  const page = fs.readFileSync(PAGE_PATH, "utf8");
  errors.push(...checkHero(hero), ...checkPanel(panel), ...checkPage(page), ...checkSlot(heroSlot, DateTime, tz));

  // 5. the embedded mutants — each must make its check go RED
  const FIXED = { whenConfirm: "Friday 4 Sep 2026 15:30", when: "Friday 4 Sep 15:30", date: "Friday 4 Sep", time: "15:30" };
  const MUTANTS = [
    ["hero without the name-ask bubble", () => checkHero(hero.replace(/\n.*text: lines\.askName.*\n/, "\n"))],
    ["hero confirm without the name", () => checkHero(hero.replace(" for ${DEMO_CUSTOMER} — shall", " — shall"))],
    ["hero customer bubble without the name", () => checkHero(hero.replace("text: DEMO_CUSTOMER", "text: 'ok'"))],
    ["hero with a literal date back in it", () => checkHero(hero.replace("const when = slot.when;", "const when = 'Friday 4 Sep 15:30';"))],
    ["panel without the name step", () => checkPanel(panel.replace("{lines.askName}", ""))],
    ["page prerendered again", () => checkPage(page.replace("export const dynamic = 'force-dynamic';", ""))],
    ["a fixed past date", () => checkSlot(() => FIXED, DateTime, tz)],
    ["a wrong weekday", () => checkSlot((at, z) => { const s = heroSlot(at, z); return { ...s, whenConfirm: s.whenConfirm.replace("Friday", "Thursday") }; }, DateTime, tz)],
    ["today instead of the next Friday", () => checkSlot((at, z) => { const d = DateTime.fromJSDate(at).setZone(z);
      return { whenConfirm: d.toFormat("cccc d LLL yyyy") + " 15:30", when: d.toFormat("cccc d LLL") + " 15:30", date: d.toFormat("cccc d LLL"), time: "15:30" }; }, DateTime, tz)],
  ];
  const survivors = MUTANTS.filter(([, run]) => run().length === 0).map(([name]) => name);
  for (const s of survivors) errors.push(`mutant SURVIVED — the check cannot go red for: ${s}`);

  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`HERO TEXT DRIFT: ${errors.length} problem(s) — the public hero no longer quotes what the engine says, the way it says it.`);
    console.error("  → update web/site to the engine's wording and order (never the reverse).");
    process.exit(1);
  }
  const now = heroSlot(new Date(), tz).whenConfirm;
  console.log(`hero engine-text OK — ${LITERALS.length} engine literals and ${TEMPLATE_KEYS.length} messageTemplates keys present; ` +
    `name step + named confirm in hero and panel; the slot matches the engine's formats over 400 days + 10 edge instants ` +
    `(today: "${now}"); ${MUTANTS.length}/${MUTANTS.length} embedded mutants red (engine: ${path.relative(ROOT, WF)})`);
}

if (require.main === module) main();
module.exports = { checkHero, checkPanel, checkPage, checkSlot };
