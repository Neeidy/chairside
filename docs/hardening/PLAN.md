# HARDENING — Phase B plan (/plan-flow) · 2026-11-18 · base `bb3f64b`

**⚠ Post verdict (corrects yesterday's report):** the post is not on HOLD because of L2 alone. Until F3/F5 are deployed,
sentences 2 ("the LLM only reads, code makes every decision") and 4 ("nothing is written to the calendar without a fresh
yes") in section F of the status report are FALSE (F3: "no" + model `confirm` cancels; F5: a late yes books a slot that
has passed). → Cowork must not use those two sentences before the deploy.

Inputs (scratchpad, committed under `docs/hardening/` in B5):
- `results/` — 12 reproductions + 12 independent verifications
- `plan-inputs/register.md`
- `plan-inputs/critic.md`
- `plan-inputs/text-impact.md`
- `plan-inputs/deploy.md`
- `a1-probe.log`
- `rerun-all.log`
- `ITEMS.md`

## ⚠ AS BUILT (B1, 2026-11-18) — read this first; the Phase A text below is kept as approved and is NOT the build

Where the build differs from the approved text below, the build is what holds (rulings in `docs/ARCHITECTURE-DECISIONS.md`,
2026-11-18 rows; per-item status in `register.md`: LIVE, COMMITTED, or partly live-drilled — since the 2026-11-18 deploy):
- **WU-1:** there is no `Check Consent` node. The clear-yes test is `Read Pending Answer` (before `Abort Cancel?`);
  `Abort Cancel?` / `Abort Reschedule?` act only on a clear yes the model also read as `confirm`; at the booking confirm
  `Classify Confirm Reply` tags a model `confirm` without a clear yes and `Route Consent` sends it back to `Slot Gate`
  (a second one → `Mark Handoff`, alert `consent_unclear`). A question or a correction at the booking confirm takes its
  normal route (accepted deviation). The turn cap resets on a session gap and on an owner release ONLY (K5 reversed in
  part: the terminal-stage reset is withdrawn).
- **WU-2:** "which one?" is cancel-only; a reschedule with several upcoming bookings moves the earliest and names the
  count (accepted deviation). RM-1979 is closed through `Read Pending Answer`'s next-turn rewrite (S1), with a stated bound.
- **WU-3:** F1 adds NO edges: the silent branches carry `handoff_alert_class` through `Build Reply Payload`, whose reply
  sibling sits above the alert on the canvas (S4). URL defang breaks every scheme and every dotted host.
- **WU-4:** NO schema `pattern` and no schema change (K3 as amended): `time` is normalised and `dateExpr` capped at 60 in
  `Resolve Date`. The empty-message exit sits AFTER `Check Bot Guards` (lock, kill-switch and turn cap answer first).
- **WU-6:** the 30-day release bound is removed (S5; reverses A7 condition 3).
- **WU-7:** the secret-scan phone rule judges committed patch lines only; no Airtable-id rule (false positives on ordinary
  words, Airtable retired). The edge-rule items are summarised only (K12).
- **Tests** (names differ from §7/§8 below): `tests/unit/hardening-main.test.cjs` + `hardening-main-mutants.py`,
  `hardening-owner.test.cjs` + mutants, `tests/db/booking-lookup.test.sh`, `tests/db/spend-meter.test.sh`,
  `tests/n8n-runtime/hardening-shapes/run.sh`, `tests/unit/content-parity-flags.test.py`,
  `tests/unit/cancel-validation-parity-hardening.test.py`, `tests/unit/reminder-dst.test.cjs`,
  `tests/unit/config-generated-fresh.test.sh`, `tests/snippet/double-insert.drill.sh`, `web/snippet/test/branding.test.ts`,
  `web/dashboard/lib/hardening-panels.test.ts`.

## 1. Goal
Close the 12 reproduced findings and the repo's open defects. Every item ends either FIXED (a red→green test plus a
mutant that turns it red) or RULED with a reason Yigitcan approved. No item disappears silently.

## 2. Scope + NOT-build
Work units are grouped **by node**: fixes that touch the same node get one design and go in one put.

**WU-1 Confirm gate** — F3 + F5 + the confirm half of F4 + RM-2007 + A8. One Code node, `Check Consent`, placed after
`Route Intent[3]`, covers all three confirm stages.
- **Booking confirm:**
  - AGREE (an agreement word + closed filler + a stage-bound verb) AND the model says `confirm` → book.
  - DECLINE (a closed "no", or a text that starts with a negation) → N1 decline.
  - Anything else (a question, a correction, unrelated text) → the same confirm question again, `confirm_turn` re-stamped.
  - A second unclear answer in a row → `Mark Handoff` + alert.
  - The second-strike marker lives in `last_intent='consent_unclear'` (no DDL) → SPIKE S6.
- **Cancel/reschedule confirm (K1):** only AGREE + `confirm` executes. Anything else → abort with the existing "your
  booking stands" reply. No write; this keeps the public text "anything else to keep it" true (hero literal unchanged).
- **Clock:** `Booking Fresh?` / `Reschedule Fresh?` get "slot start > now" (zone from `cfg.business.timezone`).
  - Booking → existing `datePast` path ("pick a future time").
  - Reschedule → existing Reschedule-Aborted; the old booking stays.
- **Session (F4):** in `Merge State`, a new session (gap > `sessionGapMinutes`) → `turn_count=0`, `confirm_turn=null`.
  The gap computation has one source (drift test against `Build Reply Payload`).
- **Lists:** one constant in code. The prompt's agreement words must be ⊆ the code list (drift test). The prompt is NOT
  changed (K4).

**WU-2 Target selection** — F2 + RM-1979 + F1's cancel/reschedule branches.
- `Find Booking`, `Find Booking (Reschedule)`, `Find Old Booking (Reschedule)`: `AND end_utc > $N`, with now as a
  parameter (check-sql-params). The JS twins in `Cancel Lookup` / `Reschedule Lookup` use the same bound (K2).
- **Choice:**
  - A date was named → the future booking on that date. If it matches none, the bot asks; no `booked[0]` fallback.
  - No date + one future booking → that one.
  - No date + several → "which one?" (lists dates), **no lock** (F2 reproduction A) → SPIKE S2.
- **RM-1979:** the reschedule target is bound on the ask-slot turn via `cancel_target_id` + `last_intent` → SPIKE S1.
- The replay stub's `bookings()` is made to equal the SQL bound (a stub that was more correct than the SQL hid F2).

**WU-3 Alert builder** — F1 class fix + F7 + H3 + EN-CD-3 + RM-1971.
- **F1:** every node that writes `stage='handoff'` carries an explicit `handoff_reason`; `Build Owner Alert` reads it.
  - Three missing edges are added (in the APPROVED_DELTAS Main entry).
  - Order (measured): on `Reschedule Lookup` a direct edge would send the alert BEFORE the reply. That one alert is
    routed after Save State instead → SPIKE S4; fallback: the edge, recorded under the D-c limit.
  - A new test counts every handoff writer across all 5 workflows and asserts each has an alert path.
- **F7:** expired keys are pruned with the same `windowMin` as the reader. A PUT may also reset Main's live static data;
  not measured; at most one extra alert per key.
- **H3:** `oneLine()` on every customer- or model-derived value:
  - `[\s\u0085]+` → space;
  - strip C0/C1 and bidi controls;
  - defang URLs;
  - cap each value's length.

  Also: `disable_web_page_preview: true` written explicitly on Main's Telegram node, and Owner Actions' alert values get
  the same `oneLine()`.
- **EN-CD-3:** infra alerts fall back to known values for sender/channel/stage (K6).
- **RM-1971:** a tag node on `Resolve Date`'s error output → `date_resolver_failed`.

**WU-4 Input hygiene** — F6 + RM-1921 + H6 + H3 eviction + RT4-b + RM-1622 + A9(iv).
- **`schemas/intent.schema.json`:**
  - `slots.time` gets `pattern ^([01]\d|2[0-3]):[0-5]\d$`;
  - `dateExpr` gets `maxLength`;
  - the validator is regenerated;
  - a drift test asserts the derived LLM copy strips `maxLength` (the docs say unsupported → 400).
  - **Default: validator-only** — `pattern` stays out of the LLM copy. Sending it to the model is option K3-b, behind
    one approved paid probe.
- **`Merge State`:**
  - remove C0/C1 from the text (`\n` and `\t` stay), guarded by `typeof` — a non-string text counts as "not understood";
  - flatten each stored message to one line (eviction);
  - a NUL-only message → "not understood", no LLM call → SPIKE S3;
  - carry `gcal_event_id` (RM-1622).
- **`Check Processed`** (not a gate node): claim key `${channel}:${message_id}` (RT4-b). The owner marker regex has no
  `:`, so the namespaces separate.

**WU-5 Spend meter** — SPEND + RM-1938.
- `Record LLM Spend`: `cost_usd = salon.bot_metrics.cost_usd + EXCLUDED.cost_usd`, `$2 = _delta` — both change together.
- The dead `prev` field in `Build Spend Record` is removed.
- The parity guards learn `retryOnFail` / `alwaysOutputData` / `executeOnce`: the increment is safe only without retries.

**WU-6 Owner Actions** — F4 release + the 30-day lock (critic B1).
- `Release Handoff Lock` → `turn_count=0, confirm_turn=NULL`.
- `Validate Release Target`'s 30-day bound → SPIKE S5.

**WU-7 Offline tooling:**
- RM-1413 · RM-185 (commit the DST test) · RM-1907 · RM-2123 · RM-1938.
- RM-1899 + RM-2299 (secret-scan):
  - split into sub-items;
  - the 17 "not re-measured" rows are re-measured with the selftest;
  - "is there a PII rule" is a policy question → K14.
- X2: `tests/db/*.sh` → `docker rm -f -v`.
- RM-1145: sub-items (e)(f)(h)(i), split in B1.

**WU-8 Web/snippet:** RM-2101, RM-2143. Token-free, so Claude runs the headless drills. The v2 rows ruled under DC-1
(EN-v2-3, EN-v2-8, RM-1392, RM-1397) are **not** reopened.

**WU-9 Live/ops** — each with its own ⚠ ONAY, §13:
- Cloudflare rule read and change (Cowork/Yigitcan);
- the edge-rule items (withheld, K12);
- the archived Main's static data (K11);
- operator DDL 005 (K8);
- A1: the oldest execution date, read-only through the API (execution retention).

**NOT-build:**
- Postgres throttle table (H5 → LIMIT).
- New stage/status DDL.
- A gate-code edit class (H4, RT5-2 → LIMIT, K7).
- Prompt change.
- Opening WhatsApp or Reminders sends (H5b → v2).
- Touching hero-quoted literals.
- Any Cloudflare/Vercel setting changed by CC.
- New external service or credential.
- New Load Config key: Load Config is a gate node; existing templates are reused.

## 3. Skeleton (nodes)
**Main** — one put, one APPROVED_DELTAS entry:
- add_nodes (types code/if/set only, all addable): `Check Consent`, `Build Consent Re-ask State`, the RM-1971 tag node,
  and the sticky notes for each.
- add_edges: the F1 edges + the edges of the new nodes.
- Code/IF/Postgres edits (`--allow`):
  - `Merge State`, `Booking Fresh?`, `Reschedule Fresh?`, `Abort Cancel?`, `Abort Reschedule?`,
    `Classify Confirm Reply`;
  - `Find Booking`, `Find Booking (Reschedule)`, `Find Old Booking (Reschedule)`, `Cancel Lookup`, `Reschedule Lookup`,
    `Compute Reschedule Availability`, `Build Cancel-Cutoff Reply`;
  - `Build Owner Alert`, `Check Processed`, `Record LLM Spend`, `Build Spend Record`, `Validate Intent` (regenerated);
  - the Airtable-era comments (EN-722-28).
- Load Config stays byte-equal (render example-b keeps rendering; measured on the sketches).

**Owner Actions** — separate put, before Main: `Release Handoff Lock`, `Validate Release Target`, and the `oneLine` alert
builder.

**Reminders, Purge, Drill State:** unchanged.

**Repo:**
- `scripts/diff-workflow-copy.py` (APPROVED_DELTAS)
- `scripts/compile-intent-validator.cjs` + `tests/unit/llm-schema-drift.test.cjs` (staged pick, K3)
- `scripts/check-cancel-validation-parity.py` (declare the new difference)
- `tests/unit/*` (new tests; owner-actions-tur2 O1, name-capture, validate-intent and main-tur2 updated on purpose)
- `chat-replay.lib.cjs` (moving clock, F2 stub, spend stub)
- `scripts/secret-scan.sh` + fixtures
- `tests/db/*.sh`
- `web/snippet/*`
- `docs/codex/hardening/*`

## 4. Integrations
| System | What this phase does with it |
|---|---|
| n8n (live 2.46.6, the same as the local image the runtime reproductions used) | Owner Actions + Main puts through `workflow-step.py` |
| Postgres | CC runs no DDL; the optional 005 is run by Yigitcan (K8) |
| Google Calendar | Only in B4: real events on the demo calendar |
| Telegram | B4: a real owner alert |
| Anthropic | Prompt unchanged; a few paid turns in B4 |
| Cloudflare | Dashboard work by Cowork/Yigitcan only |
| Vercel | A push deploys the site; site text unchanged |

## 5. Mock data
- Synthetic name Kim Moss; `mig-hd-` / `w-mig-hd-*` ids.
- Scratch containers labelled `c72=hardening-*`, `--network none`, removed with `rm -f -v`.
- B4 events are closed by the cancel flow and then read back read-only.
- No real customer data.

## 6. CRT (MASTER-BRIEF §9) — back under audit until Codex closes them
| CRT | Work unit |
|---|---|
| 1a | WU-4 claim key |
| 1b | WU-2 / RM-1979 |
| 2 | WU-1 |
| 4 | F7 / K11 / secret-scan |
| 5 | WU-1 / WU-3 |
| 6 | WU-3 / WU-4 |
| 8 | WU-1 / WU-2 |
| 11 | WU-6 |
| 12 | F5 / WU-4 |
| 13 | WU-8 |
| 14 | render example-b |
| 15 | WU-5 / F4 |

## 7. Acceptance
1. Every FIX NOW item has a red→green test and a mutant shown red (ITEMS.md). The 12 reproductions pass against the
   promoted export.
2. **check-all 0.** Committed-only guards are run by hand against the staged export in the staging commit and updated
   in the promotion commit.
3. **Codex:** at most 2 passes. HIGH fixed before deploy; the rest fixed or ruled in writing.
4. **After each put:** read-back == staged, published == draft, fake-token 403, and the A1-style allow-list over the
   window's executions. **start-gates "green" is claimed only after the promotion commit** (put → promotion is red by
   construction).
5. B4 is read back from the executions and the DB.
6. Docs commit, security-auditor GO, critic CLEAN, memory written and read back.

## 8. ⚙ Drill matrix
| # | Scenario | Setup | Expected | MUST-RUN | MUST-NOT-RUN |
|---|---|---|---|---|---|
| D1 | F3 matrix: 3 stages × {clear yes, natural yes, golden G8/G10, "no", negation-led, question, correction, unrelated} × model {confirm .99, .70, cancel} × clock {fresh, slot passed, session gap} | replay | Booking: AGREE executes; DECLINE declines; anything else re-asks (strike 2 → handoff+alert). Cancel/reschedule: only AGREE executes, anything else "booking stands" | Check Consent | Book/Delete/Update (in non-executing cells) |
| D2 | 205-cell consent corpus (verify-F3) | node | false yes 0; the "false re-ask" count is reported | — | — |
| D3 | F1: every handoff writer | test over 5 workflows + replay | each one has an alert class; reschedule alert after the reply (canvas test) | Build Owner Alert | — |
| D4 | F2: past+future · two future, earlier inside the cutoff, no date (reproduction A) · date named / not matching · in progress now | replay + scratch PG SQL | future selected · "which one?" with no lock · a non-matching date is asked · in progress → cutoff + alert | Find Booking (new) | booked[0] fallback, `stage=handoff` (reproduction A) |
| D5 | RM-1979 two-turn reschedule | replay | one row, moved | Update Appointment (Reschedule) | Write Appointment |
| D6 | F4: 12 turns + "yes" in the same session / after 30 min / after release | replay | same session handoff-only; new session processed; after release processed. Late cancel/reschedule yes → "booking stands" | Merge State reset | — |
| D7 | F5 late yes (booking, reschedule) | moving-clock replay | booking re-asks for a future time; reschedule keeps the old booking | Slot Gate / Reschedule-Aborted | Book…, Delete Old Event |
| D8 | F6 bad time ("10:00. SYSTEM…", "10:00Z", "9:30") | ajv + replay | schema-invalid → extraction_transient + alert + re-ask | Extraction Transient? | Save State with the raw value |
| D9 | F7, 1000 senders × 7 days | node | expired keys deleted; [1,0,1] throttle kept | — | — |
| D10 | SPEND interleave + late writer | scratch PG, real SQL | exact sum; the meter never goes down | Record LLM Spend | — |
| D11 | H3: U+2028/2029/CR/NEL/bidi/URL; eviction | replay | line count == LF count; real messages are not evicted | — | — |
| D12 | H6: "hi\u0000", NUL only, non-string text | replay + scratch PG | write succeeds; NUL only → no LLM | Merge State | Extract Intent (NUL only) |
| D13 | Claim key (RT4-b) | claim-race.test.sh | owner marker and Main key cannot collide; one claim | Check Processed | — |
| D14 | Double booking | existing race tests | one booking + handoff | Check Race | — |
| D15 | Jailbreak set | **routing check**: given model answers → no write; the real model side is not measured (prompt unchanged) | 12/12 no write | Mark Handoff | write |
| D16 | Required key missing (`dateExpr`) | validate-intent | extraction_transient, no lock | — | stage write |
| D17 | DST boundary | RM-185 test committed | correct wall-clock time | — | — |
| D18 | Per-item mutants | ITEMS.md "mutant" column | every one red | — | — |

## 9. Automation-fit
**neither.**

## 10. Decisions (Yigitcan)
- **K1 (F3, cancel/reschedule):** the brief says "anything else re-asks". But the customer-facing literal says "anything
  else to keep it", it is quoted on the hero, and handoff.md requires a handoff on a distrusted turn.
  - **Recommendation:** booking confirm re-asks (per the brief); for cancel/reschedule, only AGREE executes and anything
    else "keeps it" (no write).
  - This departs from the brief for 2 of the 3 confirms and is **declared**. If you prefer re-asking for those too, the
    hero literal and handoff.md change together, and the push ships the new site text before the engine.
- **K2 (F2 boundary):** recommendation `end_utc > now`. F5's freshness check is "start > now".
- **K3 (F6):**
  - **a) recommended:** pattern + maxLength only in the committed schema and the validator, plus the staged pick in
    `compile-intent-validator --check` / `llm-schema-drift` (a one-line tooling change each).
  - **b)** also send the pattern to the model, after one approved paid probe.
  - Measured: stored slot_time 10/10 HH:MM; 203/203 HH:MM in tests and docs (small sample).
  - Behaviour change: "9:30" → extraction_transient.
- **K4 (prompt):** do not touch it.
- **K5 (F4 brake):** the cap becomes per session.
  - It loosens noticeably on the WhatsApp side only (verify-F4, offline: about 420 paid turns/day/sender at one message
    a minute, the lane is closed). On the widget it never bound anyone.
  - Turnstile + the edge rule + the monthly cap stay as the binders.
  - **Recommendation: accept.** Reset after a booking/cancel is rejected.
  - Side effects: a late booking yes is re-asked; a late cancel/reschedule yes gets "booking stands".
- **K6:**
  - **EN-CD-3: FIX** (a node already being edited).
  - **EN-CD-7: reply first on the new edges**; the existing paths stay a LIMIT under DC-1.
- **K7 (gate nodes, H4 + RT5-2): RULE AS LIMIT.**
  - Both are LOW.
  - A gate-code edit class overrides a standing ruling (GATE/R1c) and costs a tooling change in about 6 files plus
    tests.
  - RT4-b is not a gate node, so it is FIXED in WU-4.
- **K8 (operator DDL 005, optional, Yigitcan runs it):** `REVOKE DELETE ON salon.appointments FROM salon_app` (X1) plus
  the `lead_no` comment (CO-18). Recommendation: yes.
  - `statement_timeout` (A3) is split out as a LIMIT: it is not engine-neutral, and a value would need measuring.
  - The Telegram node timeout (A3) is a LIMIT: the node has no timeout field.
- **K9 (H5b):** claim-per-row turns at-least-once into at-most-once, which is a product decision. Sends are off.
  **v2**, trigger: before WhatsApp reminders go live.
- **K10 (`.claude/rules/`):** the brief says "rules unchanged", but the fixes make sentences in three files false
  (governance-sync §6). Recommendation: correct only those sentences, in place:
  - `spend-safety.md` "per-conversation" → session;
  - `handoff.md` confirm wording per K1;
  - `booking-integrity.md` future-only target, slot not passed.
- **K11 (A2):** the archived Main's static data: 253 expired keys, with full sender_key and WhatsApp numbers.
  Recommendation: clear the static data only (⚠ ONAY).
- **K12 (committing the red-team report):** H1/H2 stay summarized until resolved.
- **K13 (A1 and the post):**
  - the live probe results are withheld (K12); public text records pass/fail and the date only;

  **The post stays on HOLD: L2 + the F3/F5 deploy.**

  Order: withheld (K12).
- **K14 (secret-scan "a PII rule"):** recommendation: one E.164 rule with a fingerprint exception for the documented
  sandbox number.
- **Approvals:** "approved" approves the plan and the build. **Every live write gets its own ⚠ ONAY at execution time**
  (§13): an approval for one context does not cover another.

## 11. Spikes (the first tasks of B1; each has a fallback)
| | Question | Fallback |
|---|---|---|
| S1 | Does RM-1979 close without DDL (`cancel_target_id` + `last_intent`)? | RULE AS LIMIT + a v2 trigger with DDL |
| S2 | F2 "which one?" with no lock, no DDL? | earliest future + an explanatory reply |
| S3 | H6 NUL-only → "not understood" without a new edge? | an edge in APPROVED_DELTAS |
| S4 | F1 reschedule alert after the reply? | the edge + recorded under D-c |
| S5 | How is the 30-day lock bound fixed? | bound kept + an explanatory error on the dashboard + LIMIT |
| S6 | Second-strike marker in `last_intent` without breaking clarify/extraction-transient? | booking confirm hands off on the first unclear answer |

## 12. Codex audit scope
- `docs/codex/hardening/{prompt.md, run.sh, prompt-p2.md, run-p2.sh, containment.md}`, as a copy of the close-out runner.
- **Pass 1:** `git log bb3f64b..PIN` + the CRT surfaces.
- **Pass 2:** p1 + `git diff <p1>..PIN`.
- Raw answers committed, plus the containment record.
- **⚠ Disclosure window:** Codex needs `HEAD == origin/main`, so the fixes and tests become public before the engine is
  patched. Staging push → p1 → fixes → p2 → deploy happens on the same day.

## 13. Deploy + live actions (each with its own ⚠ ONAY + reviewer GO; outside :55–:05 and away from 04:00)
1. (K8) DDL 005 — Yigitcan runs it, after a dry run.
2. **Owner Actions put:** snapshot (0600, outside the repo) → rehearse-rollback → deactivate → put → activate → body
   probe → read-back.
3. **Main put:** the same cycle; the APPROVED_DELTAS entry; dummy-token probe; A1-style allow-list.
4. **Promotion commit** → check-all 0 → push → start-gates green → re-run the 12 reproductions (they must pass) →
   delete the snapshots.
5. **B4:** Yigitcan's browser run (~5 min script).
   - Real events + a Telegram alert.
   - Covers:
     - F3: "no" at a cancel confirm keeps the booking; a non-yes at a booking confirm re-asks;
     - F1: moving to a closed day sends an alert;
     - F2: cancel picks the upcoming booking;
     - F4: a returning session is not locked.
6. **Separately:**
   - K11 (clear the archived static data);
   - K13: the edge-rule items (withheld, K12);
   - A1 execution-date read (read-only).

**Rollback:**
- If a put fails: rollback from the snapshot → activate → start-gates → STOP.
- If inactive for more than 5 min: activate as is → STOP.

## 14. Public text (ITEMS.md §text; source: text-impact.md, reconciled for K1/K3/K7/K9)
- **README:**
  - R1: confirm sentence;
  - R2: "no";
  - R3: turn cap → per session + bound;
  - R4: meter atomic + bounded overshoot;
  - R5: late yes;
  - R6: per session;
  - R8: handoff class always alerts;
  - R11: release scope;
  - R12: "parameterised" → client-side quoting, safe with `standard_conforming_strings=on` (measured);
  - R13: new honest limits.
  - R7, R9, R10: **no change** (K3-a, K7, K9).
- **CASE-STUDY:**
  - C2 "per-session";
  - C3 meter;
  - C4 "a yes checked in code";
  - C5 "nothing is written without a yes" + evidence, **after the deploy**;
  - C6 F1 dated pointer;
  - C8 "a stub more correct than the SQL hid the defect" (learned).
- **ENGINEERING-NOTES:**
  - E1 D-c (per S4);
  - E2 the reschedule lane's lock asymmetry;
  - E3 a change request attached to a yes is re-asked;
  - E4 new rows: H5 limit, H5b v2, K7 limits, A3.
- **Other:**
  - DATA-MODEL:29 and :86-88;
  - UX-ARCHITECTURE:468;
  - FLOW-DIAGRAM;
  - MASTER-BRIEF §9 (+ the row 8 / ROADMAP:2544 marker made consistent);
  - RUNBOOK;
  - jailbreak-cases:20 and J6;
  - MIGRATION-PLAN: only "superseded" notes;
  - the 3 rule files (K10).
- **For Cowork (outside the repo, not edited here):**
  - post "safe to say" #2 and #4: do not use before the deploy;
  - #3, #5, #7: stay true; #7 can add the atomic meter;
  - "Do NOT say" list: "rate limit verified" stays;
  - case study: F3/F4/F5 limit sentences and "nothing is written without a yes".

## 15. Rounds
4–6:
- R1: register rebuild + spikes + WU-1..6 staged + WU-7/8.
- R2: Codex p1 + fixes.
- R3: Codex p2 + deploy.
- R4: B4 + docs + gates.

## 16. Phase A's own measurements (this session)
- **Rerun:** the 12 reproductions in one loop (`rerun-all.log`). F1–F7, SPEND, H3, H4 and H5 showed the defect again.
  For H6 the replay half was shown again; the Postgres half did not run in my rerun because of a socket directory left
  by a previous container (another uid), so that half rests on the reproducer's and the verifier's runs. Leftover
  containers 0, dangling volumes 0.
- **Read-only measurements:**
  - production n8n 2.46.6;
  - `standard_conforming_strings = on` (default);
  - stored slot_time 10/10 HH:MM;
  - start-gates green (01:28);
  - `git status`: only the untracked report.
- **Register:** 215 rows (286 source refs → 0 dropped). The critic added 9 uncovered items, classified in ITEMS.md; X2
  and B1 were added. The register is regenerated as the first task of B1.
