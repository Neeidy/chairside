#!/usr/bin/env node
/*
 * Guard: the hero's demo bot lines must stay ENGINE-VERBATIM.
 *
 * WHY: the public marketing page shows the bot talking. Those bubbles are not decoration — a visitor
 * reads them as what the product actually says. Inventing or drifting that copy is a logged defect class
 * in this repo. Two of the four scenarios use strings that live as LITERALS inside n8n Code nodes, so
 * web/site/lib/heroScenarios.ts necessarily holds a DERIVED copy of engine wording
 * (.claude/rules/contract-integrity.md allows a derived copy only with a drift guard — this is it).
 *
 * What this checks, against the Main export the repo is heading to — the STAGED one while a staged edit exists
 * (`n8n/staged/workflow.main.sanitized.json`), else the committed export — and the committed example config:
 *   1. every engine LITERAL shape the hero reproduces still exists in its named node
 *   2. every messageTemplates key the hero fills still exists in the config
 *   3. the hero's W12 sample date (`whenConfirm`) parses with the engine's confirm format, its weekday agrees with
 *      its date, and the static SitePanel shows the same W12 line (DATE-PHRASING R2d: the year in the confirm)
 * WHY the staged export when there is one: the hero source moves in the same commit as the staged engine edit, and
 * the site is redeployed only after that edit is live and promoted (the R3 live plan states the order) — so the
 * page never quotes a wording the live engine does not yet say.
 * Exit 1 = the engine's wording moved and the marketing page is now quoting something the bot no
 * longer says.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STAGED = path.join(ROOT, "n8n/staged/workflow.main.sanitized.json");
const WF = process.env.SANITIZED_PATH || (fs.existsSync(STAGED) ? STAGED : path.join(ROOT, "n8n/workflow.main.sanitized.json"));
const CONFIRM_FMT = "cccc d LLL yyyy HH:mm";   // Compute Availability's confirm format (R2d)
const CFG = process.env.CONFIG_EXAMPLE || path.join(ROOT, "config/client.config.example.json");

// [node name, exact substring that must appear in that node's jsCode, which hero bubble depends on it]
const LITERALS = [
  ["Compute Availability", "— shall I book it? (yes / no)", "W12 booking confirm-ask"],
  ["Compute Availability", `const fmtConfirm = start.toFormat('${CONFIRM_FMT}');`, "W12 date format (the year, R2d)"],
  ["Compute Availability", "${svcName}, ${fmtConfirm}", "W12 reads the year-bearing format"],
  ["Build Cancel-Confirm State", 'Reply "yes" to cancel, or anything else to keep it.', "W19 cancel confirm-ask"],
  ["Answer FAQ", "is ${money(one)}.", "W3 single-service price"],
  ["Answer FAQ", "'Opening hours — '", "W5 opening hours"],
  ["Answer FAQ", "' · '", "W5 hours separator"],
  ["Answer FAQ", "'closed'", "W5 closed-day word"],
];
const TEMPLATE_KEYS = [
  ["bookingConfirmed", "W13"], ["cancelDone", "W20"], ["handoff", "W44"], ["handoffLocked", "W47"],
];

const wf = JSON.parse(fs.readFileSync(WF, "utf8"));
const cfg = JSON.parse(fs.readFileSync(CFG, "utf8"));
const nodeCode = (name) => {
  const n = (wf.nodes || []).find((x) => x.name === name);
  return n ? (n.parameters && n.parameters.jsCode) || "" : null;
};

let bad = 0;
for (const [node, needle, why] of LITERALS) {
  const code = nodeCode(node);
  if (code === null) { console.error(`  ✗ node "${node}" not found (${why})`); bad++; continue; }
  if (!code.includes(needle)) { console.error(`  ✗ ${node}: literal moved — ${why}\n      expected to find: ${needle}`); bad++; }
}
for (const [key, w] of TEMPLATE_KEYS) {
  if (!cfg.messageTemplates || typeof cfg.messageTemplates[key] !== "string") {
    console.error(`  ✗ messageTemplates.${key} missing (${w})`); bad++;
  }
}
// 3. the W12 sample date in the hero and the static panel
const { DateTime } = require(path.join(ROOT, "scripts/node_modules/luxon"));
const hero = fs.readFileSync(path.join(ROOT, "web/site/lib/heroScenarios.ts"), "utf8");
const panel = fs.readFileSync(path.join(ROOT, "web/site/components/site/SitePanel.tsx"), "utf8");
const wc = (hero.match(/const whenConfirm = '([^']+)';/) || [])[1];
const parsed = wc ? DateTime.fromFormat(wc, CONFIRM_FMT, { locale: "en-US" }) : null;
if (!parsed || !parsed.isValid || parsed.toFormat(CONFIRM_FMT) !== wc) {
  console.error(`  ✗ heroScenarios.ts whenConfirm ${JSON.stringify(wc)} is not a date in the engine's confirm format '${CONFIRM_FMT}'`); bad++;
} else if (!panel.includes(`Haircut, ${wc} — shall I book it? (yes / no)`)) {
  console.error(`  ✗ SitePanel.tsx does not show the W12 line with ${JSON.stringify(wc)}`); bad++;
}
if (bad) {
  console.error(`HERO TEXT DRIFT: ${bad} engine source(s) no longer match what the public hero quotes.`);
  console.error("  → update web/site/lib/heroScenarios.ts to the engine's new wording (never the reverse).");
  process.exit(1);
}
console.log(`hero engine-text OK — all ${LITERALS.length} engine literals and ${TEMPLATE_KEYS.length} messageTemplates keys the hero quotes still exist; the W12 sample date is in the confirm format and the panel matches (engine: ${path.relative(ROOT, WF)})`);
