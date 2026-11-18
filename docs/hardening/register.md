# Hardening register (Phase A, merged)

Generated 2026-11-18 by `plan-inputs/build_register.py` from `inv-roadmap.json`, `inv-notes-closeout.json`, `inv-report.json`, the 12 finding results and their verification files. Repo HEAD bb3f64b, read-only; no live call.

**Classes.** FIX NOW = build in the hardening phase (a `(conditional)` tag names its trigger; counted as FIX NOW). RULE AS LIMIT = no standing ruling yet, propose to record it as a limit. RULED ALREADY = a standing ruling exists and still holds, nothing to decide. v2 = deferred feature or fix that WILL be built when its trigger fires. STALE TEXT = the item is closed or wrong in the docs; a docs edit (or no edit, closed record) is all that is left.

**Universal prerequisite, not repeated per row:** every live Main / Owner Actions / Purge / Reminders edit is an irreversible-actions.md approval (live write to a workflow with a database credential). The `needs` column lists only what comes on top: none / DDL / credential / Cloudflare dashboard / tooling change / ruling.

**Verification coverage.** verify-F1..F7, SPEND, H3, H4, H5, H6 exist and agree with the reproductions (none refuted). verify-H5.json was added after the first build of this file and agrees with the reproduction. There is no result file for the inventory-only items (they are static or offline measurements recorded in the inventories).

**Source refs.** ROADMAP refs are `docs/ROADMAP.md:<line>`. Notes / CLOSE-OUT / README refs carry the inventory ref in brackets plus a best-effort file:line found by text match (the inventories recorded no line numbers; where the match failed a section anchor is given). Finding rows cite the report line, the result file and the verify file; `results/...` and `results-F1-F2.json` live under the hardening scratchpad directory.

## A. Findings (F1-F7, SPEND, H3-H6) (13 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| F1 | Handoff locks that page nobody (7 branches, 3 nodes) | CHAIRSIDE-REDTEAM-REPORT.md:25; results-F1-F2.json; results/verify-F1.json; docs/ENGINEERING-NOTES.md:43 [EN-v2-9]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | LIVE (deployed 2026-11-18; B4 partly — see note) | FIX NOW | 7 branches write stage=handoff but Build Owner Alert never sees state (Build Reply Payload drops it); fix = 3 direct edges + explicit handoff_reason flag (verify prefers the flag over spreading `...vi`). No DDL. **RULED 2026-11-18: B1: tests/unit/hardening-main.test.cjs (F1, F1 order)** **RULED 2026-11-18: B4 green on ONE branch (a closed-day reschedule: handoff + alert class reschedule_closed read back); the other branches offline-proven only. (docs/hardening/B4-LIVE-DRILL.md)** | none |
| F2 | Cancel/reschedule pick earliest booked row, past rows included | CHAIRSIDE-REDTEAM-REPORT.md:84; results-F1-F2.json; results/verify-F2.json | LIVE (deployed 2026-11-18; B4 partly — see note) | FIX NOW | 3 lookups lack a time bound; a past booked row hijacks cancel/reschedule and locks the customer (also: customer with only a past row gets a false "too close to its time"). Fix: start/end_utc > now in SQL + JS twin; no DDL. **RULED 2026-11-18: K2 — target bound end_utc > now in SQL and the JS twin (in-progress booking stays a target).** **RULED 2026-11-18: DEVIATION accepted: "which one?" is cancel-only; a reschedule with several upcoming bookings takes the earliest and names the count in its confirm (a reschedule turn's day is the NEW day).** **RULED 2026-11-18: B1: hardening-main (F2 A, B/C, in progress, SQL, JS twin) + tests/db/booking-lookup.test.sh** **RULED 2026-11-18: B4 green: two upcoming bookings and no day -> "which one?", then the named day picked; the past-row exclusion offline-proven only (no past booking in the drill). (docs/hardening/B4-LIVE-DRILL.md)** | none |
| F3 | "Yes" decided by the model at all three confirms | CHAIRSIDE-REDTEAM-REPORT.md:125; results/F3.json; results/verify-F3.json; README.md:183 [RM-HL-6] | LIVE (deployed 2026-11-18; B4 partly — see note) | FIX NOW | No deterministic floor: text "no" + model confirm@0.99 executes cancel/reschedule/book; occurrence unmeasured. Fix: one consent node (DENY floor + widened affirmative set + re-stamp). Closed YES set misses 42/57 natural yeses. **RULED 2026-11-18: K1 — booking confirm: clear yes + model confirm books, decline declines, else re-ask, second unclear -> handoff + alert; cancel/reschedule confirm: only a clear yes acts, anything else keeps the booking (declared deviation from the brief, accepted).** **RULED 2026-11-18: DEVIATION accepted: the booking-confirm re-ask applies only when the model says confirm and the text is not a clear yes; a question or a correction at the booking confirm flows as before.** **RULED 2026-11-18: B1: hardening-main (7 F3 tests)** **RULED 2026-11-18: B4 green at the booking confirm (re-ask on a non-clear yes, then booked) and the cancel confirm ("no, keep it" kept the booking); the reschedule confirm offline-proven only, and B4 does not show the deny floor overriding a model confirm. (docs/hardening/B4-LIVE-DRILL.md)** | none |
| F4 | The turn cap is a lifetime cap (12 saved turns, then handoff-only) | CHAIRSIDE-REDTEAM-REPORT.md:170; results/F4.json; results/verify-F4.json; README.md (Honest limits / Not built yet, from line 165) [RM-X2] | LIVE (deployed 2026-11-18; offline-proven only) | FIX NOW | Nothing resets turn_count; sender goes silent-handoff after 12 lifetime turns. Fix: reset turn_count AND confirm_turn on a new session in Merge State (loosens the brake to ~12 per gap window, quantified by verify). No DDL. **RULED 2026-11-18: K5 — turn cap scoped to the session.** **RULED 2026-11-18: K5 final: reset on session gap and on owner release ONLY; the terminal-stage reset is withdrawn (verify-F4: 120/120 paid turns in a book-cancel loop).** **RULED 2026-11-18: B1: hardening-main (3 F4 tests) + hardening-owner (K5)** **RULED 2026-11-18: Not live-drilled in B4 (needs a session gap / a passing slot); offline tests only.** | none |
| F5 | A "yes" has no time bound and can book/move to a past slot | CHAIRSIDE-REDTEAM-REPORT.md:205; results/F5.json; results/verify-F5.json; README.md:183 [RM-HL-6] | LIVE (deployed 2026-11-18; offline-proven only) | FIX NOW | Booking lane = phantom past booking; reschedule lane deletes a real future booking for a past one, no alert. Cheapest fix: slot-start > now inside Booking Fresh?/Reschedule Fresh? (verify: (a) as first written hands off, not re-asks). No DDL. **RULED 2026-11-18: K2 — freshness bound start > now in Booking Fresh? and Reschedule Fresh?.** **RULED 2026-11-18: B1: hardening-main (F5 booking, reschedule) + cancel-validation-parity-hardening** **RULED 2026-11-18: Not live-drilled in B4 (needs a session gap / a passing slot); offline tests only.** | none |
| F6 | slots.time is unvalidated free text (prompt + alert injection) | CHAIRSIDE-REDTEAM-REPORT.md:224; results/F6.json; results/verify-F6.json | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | Free text persisted to slot_time, reaches next LLM prompt and owner alert; Luxon-accepted "10:00Z" books 11:00. Fix at entry points (Validate Intent, Merge State) via a schema `pattern` (Anthropic structured outputs accept a simple anchored pattern per docs, not measured live), regenerated validator, derive() must carry it. **RULED 2026-11-18: K3 changed — NO schema pattern; schema and validator unchanged. `time` normalised in Resolve Date (HH:MM kept, H:MM padded, else null -> Slot Gate re-asks). Location moved from Merge Slots to Resolve Date because Reschedule Lookup and Build Owner Alert (j.slots fallback) read Resolve Date output without passing Merge Slots (deviation accepted). Test: no node after Resolve Date reads raw model time, alert path included.** **RULED 2026-11-18: B1: hardening-main (F6 x4, K3 alert)** | none |
| F7 | Alert throttle map never shrinks; keys attacker-chosen, full sender_key stored | CHAIRSIDE-REDTEAM-REPORT.md:252; results/F7.json; results/verify-F7.json; docs/CLOSE-OUT-PLAN.md:1009 [PP-3a]; docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-RL-1] | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | Map grows one key per distinct sender, never pruned (253 expired keys already live); full sender_key (bearer) retained in n8n DB outside the 30-day scrub. Purge/Reminders half of the report is refuted. Fix: prune with the reader's own windowMin. No DDL. **RULED 2026-11-18: B1: hardening-main (F7)** | none |
| SPEND | Spend meter is an absolute upsert (lost update, non-monotonic cap) | results/SPEND.json; results/verify-SPEND.json; docs/CLOSE-OUT-PLAN.md:978 [PP-1a]; CHAIRSIDE-REDTEAM-REPORT.md:316 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | prev+delta in code + EXCLUDED.cost_usd: interleaved turns lose deltas and a late writer LOWERS an over-cap meter (Eval Spend re-opens the LLM). Fix: SQL increment + pass $json._delta as $2, BOTH together. No DDL. Record says "accepted TOCTOU": measured is wider than recorded. **RULED 2026-11-18: B1: hardening-main (SPEND) + tests/db/spend-meter.test.sh** | none (correct DATA-MODEL:86-88 wording, see D-SP) |
| H3 | Telegram owner alert: line/URL forging via customer text | CHAIRSIDE-REDTEAM-REPORT.md:278; results/H3.json; results/verify-H3.json | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | U+2028/2029/CR/NEL/bidi forge lines in the emitted text; bare URLs survive; one LF-bearing message evicts real recent_messages. Masked links and Markdown parse errors are closed. Fix: one oneLine() helper in Build Owner Alert + Merge State. Rides the F1/F7/EN-CD-3 edit of the same node. **RULED 2026-11-18: B1: hardening-main (H3, H3 eviction)** | none |
| H4 | Non-string sessionId throws before the dedupe claim (HTTP 500, no alert) | CHAIRSIDE-REDTEAM-REPORT.md:279; results/H4.json; results/verify-H4.json | reproduced (runtime; token spend/alert traced) | RULE AS LIMIT | Number/array/object/bool pass Normalize Inbound then throw in Validate Payload after siteverify: 500, errored execution, nothing written, no alert. null is NOT affected. Fix = typeof guard in Normalize Inbound, but that is a GATE node: jsCode edits are refused by the deploy tooling today. **RULED 2026-11-18: K7 — gate node (Normalize Inbound / Validate Payload); a fix needs a gate-code-edit tooling class (~6 files) out of proportion to a LOW with no write and no spend beyond one siteverify.** | none |
| H5 | Static-data throttle race (last writer wins) in owner alerts | CHAIRSIDE-REDTEAM-REPORT.md:281; results/H5.json; results/verify-H5.json; docs/CLOSE-OUT-PLAN.md:1009 [PP-3a]; docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-RL-1] | reproduced (runtime) / verified | RULE AS LIMIT | Webhook runs load static data per execution and write it back whole; concurrent runs overwrite each other, and even a throttled run writes. Failure direction is only EXTRA alerts, never a swallowed one. Real fix needs a new table + GRANT (operator). Class is MY proposal; no verification file. **RULED 2026-11-18: verify-H5 exists and agrees; limit kept (extra alerts only; the fix needs a new table + GRANT).** | DDL (only if ever fixed) |
| H5b | Reminders Concurrency Guard cannot see a concurrently running run | CHAIRSIDE-REDTEAM-REPORT.md:281; results/H5.json; results/verify-H5.json | reproduced (runtime) / verified | v2 | Guard stamp persists only when its run ends, so only a LATER run within 2 min is blocked; a truly overlapping run can double-send. Fix is a claim-before-send query edit, no DDL. v2 because no real recipient exists until the WhatsApp lane opens (CP4d-2). Split from H5 by me. **RULED 2026-11-18: K9 — v2, trigger: before WhatsApp reminders are enabled.** | none (when scheduled) |
| H6 | NUL byte in text fails Save State / Capture Lead after the LLM call | CHAIRSIDE-REDTEAM-REPORT.md:280; results/H6.json; results/verify-H6.json | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | U+0000 is not rejected before the paid model call; Save State, Save State (Post-Write) and Capture Lead fail (booking confirm turn: event+mirror written, state left confirming). Visible, throttled alert. Fix: strip C0/C1 controls in Normalize Inbound (typeof-guarded; explicit ranges, not \p{C}) + slots.time pattern. **RULED 2026-11-18: WU-4 — the strip lives in Merge State (not a gate node), typeof-guarded, explicit C0/C1 ranges; NUL-only text -> not understood, no LLM call. The slots.time half is covered by F6 (Resolve Date).** **RULED 2026-11-18: B1: hardening-main (H6)** | none |

## B. Engine / product defects from ROADMAP and notes (14 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| CR-B1 | A handoff lock older than 30 days cannot be released from the dashboard | plan-inputs/critic.md B1, A9(i) | LIVE (deployed 2026-11-18; B4 partly — see note) | FIX NOW | Critic B1 / A9(i): Validate Release Target MAX_AGE_DAYS=30 and a message on a locked thread does not refresh last_updated. Split from RM-1991 (whose TTL question stays v2). Owner Actions is edited anyway for K5. Spike S5 fixes the bound. **RULED 2026-11-18: B1: tests/unit/hardening-owner.test.cjs (S5) + claim-race (token)** **RULED 2026-11-18: B4 released a FRESH lock (signed owner release, the next turn reached the cancel confirm); the >30-day bound (S5) and the K5 counter reset were not read back live — offline-proven only. (docs/hardening/B4-LIVE-DRILL.md)** | none |
| EN-722-28 | Main: node names still say "Airtable" | docs/ENGINEERING-NOTES.md:82 [EN-722-28]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | the row is stale as written (names are clean), but the Airtable-era COMMENTS in live Main code mislead (code-style: comments explain why) — comment-only, rides the hardening Main edit · recorded reason: "a node rename is a Main … **RULED 2026-11-18: B1: hardening-main (EN-722-28)** | none |
| EN-CD-3 | The infra owner alerts take `sender` / `channel` / `stage` from the … | docs/ENGINEERING-NOTES.md:98 [EN-74B-6]; docs/CLOSE-OUT-PLAN.md:35 [EN-CD-3]; docs/CLOSE-OUT-PLAN.md:35 [CO-3] | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | the only blocker DC-1 names is "edits Main twice / breaks short" — if hardening edits Main anyway, that reason lapses (flag: contradicts DC-1, needs his ruling). Fix: Build Owner Alert falls back to $('Normalize Inbound') / … **RULED 2026-11-18: K6 — FIX (fallback values from the inbound item).** **RULED 2026-11-18: B1: hardening-main (EN-CD-3)** | none |
| EN-CD-7 | D-c: an alert can run ahead of the reply on a few … | docs/ENGINEERING-NOTES.md:83 [EN-722-29]; docs/CLOSE-OUT-PLAN.md:39 [EN-CD-7]; docs/CLOSE-OUT-PLAN.md:39 [CO-7] | still true | FIX NOW | flag: contradicts DC-1, whose only stated reason is the Main edit; a hung Telegram send delays the customer reply on the post-write paths **RULED 2026-11-18: K6 — reply-first on the NEW alert edges; the existing post-write paths stay a DC-1 limit.** | none |
| RM-1145 | OWNED OPEN ITEMS carried out of CP 6c-1 (mixed sub-items) | docs/ROADMAP.md:1145 | COMMITTED (the running dashboard was NOT rebuilt in this phase; not live) | FIX NOW | FIX NOW only the unruled small residue (e), (f), (h), (i). (g) is RULED v2: ENGINEERING-NOTES.md 7-2 CONVERGE table "masking: … a 7–8 digit number shows four digits / data minimisation for the owner's own screen, not a security … **RULED 2026-11-18: B1: web/dashboard/lib/hardening-panels.test.ts (e, h, i) + web/dashboard/.env.example (f)** | none |
| RM-1622 | conversations.gcal_event_id is write-only and blanked by every non-booking turn | docs/ROADMAP.md:1622 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | Shown to lose the only pointer after a mirror failure; small and replay-testable: carry the loaded value through Merge State into Save State. Main edit → ⚠ ONAY live write. **RULED 2026-11-18: B1: hardening-main (RM-1622)** | none |
| RM-1921 | dateExpr has no maxLength in the committed schema | docs/ROADMAP.md:1921 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | One schema keyword + regenerated validator + validate-intent test case; pairs naturally with the red-team F6 time pattern. **RULED 2026-11-18: K3 principle — dateExpr length enforced in code in Resolve Date (its only consumer; date_resolution.expr reaches the alert from there), not in the schema.** **RULED 2026-11-18: dateExpr limit = 60 characters (accepted).** **RULED 2026-11-18: B1: hardening-main (RM-1921)** | none |
| RM-1971 | Resolve Date's error output is classified as state_unavailable | docs/ROADMAP.md:1971 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | One tagging Code node between Resolve Date[1] and the outbound (class e.g. date_resolver_failed); replay-testable via an error item. **RULED 2026-11-18: B1: hardening-main (RM-1971)** | none |
| RM-1979 | Two-turn reschedule creates a SECOND booking (ROADMAP F2, not report F2) | docs/ROADMAP.md:1979; CHAIRSIDE-REDTEAM-REPORT.md:323 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | Reproduced (engine side), irreversible shared-state write, unruled since 2026-09-07 (not in CLOSE-OUT §0; its F2/F3 row 15 are DATE-PHRASING's, a different F2); the Airtable-schema premise is stale. Proposed fix without DDL (to … **RULED 2026-11-18: BOUND accepted, documented in Reschedule Lookup: when the reschedule ask is also a D-4 date re-ask, the date_reask marker holds the one last_intent slot and a next answer labelled book is not read as the new slot.** **RULED 2026-11-18: B1: hardening-main (RM-1979)** | none |
| RM-2007 | askIntent is stage-agnostic (collecting / ready) | docs/ROADMAP.md:2007 | still true | FIX NOW | Wording only, small: in collecting/ready reuse existing templates (askDateTime / the confirm question) — no new config key needed. | none |
| RM-2101 | Bulgu 7 — double-insert guard edge cases (host already uses the id; … | docs/ROADMAP.md:2101 | COMMITTED (the site deploys from main; the live bundle not re-measured) | FIX NOW | Token-free, so headless-drillable by Claude (remote-operator.md); small guard change (data-attribute marker + visible console warning). **RULED 2026-11-18: B1: tests/snippet/double-insert.drill.sh (old bundle: 3 red)** | none |
| RM-2123 | config.generated.json FRESHNESS is not measured | docs/ROADMAP.md:2122; docs/ROADMAP.md:2123; docs/ROADMAP.md:2124; docs/ROADMAP.md:2126 | COMMITTED (build tooling; runs at the next site build) | FIX NOW | Small: build-config.mjs writes a hash of (resolved config + schema); build.mjs recomputes and refuses on mismatch; testable offline. **RULED 2026-11-18: B1: tests/unit/config-generated-fresh.test.sh** | tooling change |
| RM-2143 | styles.ts --ink/--oxide hardcoded, equal to config.branding | docs/ROADMAP.md:2143 | COMMITTED (the site deploys from main; the live bundle not re-measured) | FIX NOW | A second truth (contract-integrity.md) in a resellable template: a client with other branding gets the demo colours. Small: bake branding via build define + parity test. **RULED 2026-11-18: B1: web/snippet/test/branding.test.ts** | none |
| RT4-b | Shared message_id namespace, held by entropy only | CHAIRSIDE-REDTEAM-REPORT.md:301 | LIVE (deployed 2026-11-18, promoted fa46307; offline-proven, not live-drilled) | FIX NOW | Small, and it makes the property structural. `Check Processed` claims `${channel}:${message_id}`. The owner regex contains no ':', so a Main key can never equal an owner marker, and WhatsApp and widget ids become disjoint too. … **RULED 2026-11-18: B1: hardening-main (RT4-b) + tests/db/claim-race.test.sh** | none |

## C. Ops / tooling / edge (15 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| A1-b | Edge-rule item — withheld until resolved (K12) | — | open | FIX NOW | Withheld (K12). | — |
| CR-A1 | n8n execution retention not measured (customer text, Access JWT in errored runs) | plan-inputs/critic.md A1 | needs live read | FIX NOW | Critic A1: read-only measurement of the oldest kept execution per workflow; the result is recorded, a retention change would be a separate ruling. | none (read-only) |
| CX2-2 | Codex p2 §2 MEDIUM: RM-1979 rewrite on an unrelated same-session booking |  | Codex p2 | FIX NOW | FIXED: an answer naming ANOTHER service than the bound booking's own (read from that booking's row in Reschedule Lookup; the first attempt compared the state's last-collected service and flow-reviewer reproduced it booking a second appointment) is asked about, never moved (tests + mutant). BOUND: after that question, a plain reschedule answer takes the earliest booking (the bound one in the common case), not the bound target. | none |
| CX2-3 | Codex p2 §3 MEDIUM: named time not matching the only same-day booking |  | Codex p2 | FIX NOW | FIXED: a named time always filters; no match → "which one?" (test + mutant). BOUND (as L4): the "which one?" ask binds no marker; the next answer needs the model to read it as cancel. | none |
| CX2-4 | Codex p2 §4 LOW: Alert Context sender.includes on a non-string |  | Codex p2 | FIX NOW | FIXED: typeof guard. Reachability not shown (Postgres sender keys are text). | none |
| EDGE-RL | Edge-rule item — withheld until resolved (K12) | — | open | FIX NOW | Withheld (K12). | — |
| RM-1413 | Eight selftest cases no longer discriminate anything (lexer-era) | docs/ROADMAP.md:1413 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Small, offline, testable: label the eight as sentinels and exclude them from the printed fail-proof count. **RULED 2026-11-18: B1: check-client-imports --selftest (sentinel count asserted)** | tooling change |
| RM-185 | CP5 Reminders: "R5 timezone/DST = ◐ inherited, NOT independently DST-drilled" | docs/ROADMAP.md:185 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | The behaviour is correct (measured offline on the committed export) but the evidence lives only in the scratchpad; FIX NOW = commit reminder-dst as a unit test so the ◐ can close on repo evidence. Extra: the node comment still … **RULED 2026-11-18: B1: tests/unit/reminder-dst.test.cjs** | none |
| RM-1899 | secret-scan.sh does not recognise calendar id / Telegram chatId / Airtable id … | docs/ROADMAP.md:1899 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Two value-shape rules + fixtures, RED-proven, are small; this is the leak class that actually happened twice. **RULED 2026-11-18: B1: tests/unit/guards-tur2.test.py (hd_*)** | tooling change |
| RM-1907 | No byte-compare between Event ID Valid? and Reschedule Event ID Valid? | docs/ROADMAP.md:1907 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Small (~8 lines, same shape as the Fresh? block), with a mutant (typeValidation→loose) to prove RED. **RULED 2026-11-18: B1: tests/unit/cancel-validation-parity-hardening.test.py** | tooling change |
| RM-1938 | Parity guards still ignore alwaysOutputData / retryOnFail / executeOnce | docs/ROADMAP.md:1938 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Small: add three normalised flags to the canon + one mutant each. **RULED 2026-11-18: B1: tests/unit/content-parity-flags.test.py** | tooling change |
| RM-2299 | secret-scan.sh — capability gaps (payload-less 0, origin/main only, encryption key, sk-proj, no … | docs/ROADMAP.md:2299 | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Residual only: one E.164-shaped rule with a fingerprint exception for the documented sandbox bot number; RED-proven fixture. **RULED 2026-11-18: B1: guards-tur2 (hd_phone) + 13 fingerprints** | tooling change |
| X2 | tests/db/*.sh cleanup removes containers without their anonymous volumes | rerun-all.log; tests/db/*.sh | COMMITTED (repo guard / test; nothing to deploy) | FIX NOW | Found in Phase A (same class as 2f961fd): `docker rm -f` without `-v`. Fix: `-v` + a 0-dangling-volume assertion after each run. **RULED 2026-11-18: B1: tests/db/*.sh trap docker rm -f -v; 0 dangling after runs** | none |
| RT4-c | Edge-rule item — withheld until resolved (K12) | — | open | FIX NOW | Withheld (K12). | — |
| CR-A2 | Archived Main still holds attacker-keyed static data incl. WhatsApp numbers | plan-inputs/critic.md A2; results/verify-F7.json | stale (already done in Phase 7) | STALE TEXT | Critic A2 / verify-F7. K11: clear the archived Main's static data only, read back that it is empty. Live write, own ONAY. **RULED 2026-11-18: K11 measured 2026-11-18 before any write: the archived Main original no longer exists — it was DELETED in Phase 7 (PHASE-7-PLAN #7: GET 404, 10 → 9 workflows); the API lists 9 workflows today and none is an archived Main. The premise came from verify-F7, which read MIGRATION-PLAN #11 (the 253 keys) and §7a (archived) but not PHASE-7-PLAN #7. Nothing was written; the approved clear had no target.** | none |

## D. Docs-only stale text (75 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| A1-c | Edge-rule item — withheld until resolved (K12) | — | open | FIX NOW | Withheld (K12). | — |
| CO-1 | `date_expr_missing` false alert at a pending confirm (4905) | docs/CLOSE-OUT-PLAN.md:33 [CO-1] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-11 | Does a re-sent `yes` book twice? (an open QUESTION) | docs/CLOSE-OUT-PLAN.md:43 [CO-11] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-13 | The old nameless `confirming` row ("its yes hands off") | docs/CLOSE-OUT-PLAN.md:45 [CO-13] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-17 | The nightly Purge "no_candidates" alert (recorded when the leads table was empty) | docs/CLOSE-OUT-PLAN.md:49 [CO-17] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-18 | Stale comments in two Purge nodes and `001_init.sql`'s `lead_no` comment | docs/CLOSE-OUT-PLAN.md:50 [CO-18] | still true (partly) | STALE TEXT | the ruled route ("the SQL comment goes in the next schema file") has not fired; ride it on the next schema file the hardening phase writes, else it stays as ruled — the close statement over-claims this row | none |
| CO-2 | Booking-confirm freshness check | docs/CLOSE-OUT-PLAN.md:34 [CO-2] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-22 | Cloudflare's own Turnstile retry beside ours | docs/CLOSE-OUT-PLAN.md:54 [CO-22] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-23 | Widget message times in the visitor's zone (two sites: the site panel … | docs/CLOSE-OUT-PLAN.md:55 [CO-23] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-27 | Dashboard (i): two mask formulas, so every widget row counts as "re-masked" | docs/CLOSE-OUT-PLAN.md:59 [CO-27] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-28 | Dashboard (ii): the "Today" block after a cancel | docs/CLOSE-OUT-PLAN.md:60 [CO-28] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-39 | Vercel token revocation + `~/.vercel-demo.env` deletion | docs/CLOSE-OUT-PLAN.md:70 [CO-39] | stale text | STALE TEXT | done 2026-11-04 | none |
| CO-46 | GitHub About fields (Website, description, topics) | docs/CLOSE-OUT-PLAN.md:77 [CO-46] | stale text | STALE TEXT | done 2026-11-04 | none |
| CO-48 | Broken link `../n8n/workflow.sanitized.json` | docs/CLOSE-OUT-PLAN.md:79 [CO-48] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-49 | Rulings missing from ARCHITECTURE-DECISIONS: public-demo D1–D6, the RENAME and ruling C, ruling … | docs/CLOSE-OUT-PLAN.md:80 [CO-49] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-50 | README D1 (shorten "Honest status"), D2 ("How this was built"), D3 (one … | docs/CLOSE-OUT-PLAN.md:81 [CO-50] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-52 | STALE: OPS-4 "NOT done" vs ROADMAP K1 closed 2026-09-11 | docs/CLOSE-OUT-PLAN.md:83 [CO-52] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-53 | STALE: OPS-5 "STILL OPEN at 2026-10-18" | docs/CLOSE-OUT-PLAN.md:84 [CO-53] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-54 | STALE: two unticked rows of the 6b hand-over table | docs/CLOSE-OUT-PLAN.md:85 [CO-54] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-55 | STALE: "one DoD item recorded as open" after the DoD rows went … | docs/CLOSE-OUT-PLAN.md:86 [CO-55] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-56 | STALE: PUBLIC-DEMO's header hostname list; "the older deployments" not closed in ROADMAP:20 | docs/CLOSE-OUT-PLAN.md:87 [CO-56] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-57 | The go-live alert volume, "to be measured at R3" and never reported | docs/CLOSE-OUT-PLAN.md:88 [CO-57] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-58 | PHASE-6-BACKLOG has no per-item disposition | docs/CLOSE-OUT-PLAN.md:89 [CO-58] | stale text | STALE TEXT | A row closed in CLOSE-OUT | none |
| CO-FD-2 | Found #2: backup verify leaves anonymous volumes behind | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-FD-2] | stale text | STALE TEXT | L3 done | none |
| CO-FD-3 | Found #3: W1/W2 need one ruling | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-FD-3] | stale text | STALE TEXT | L1 done | none |
| D-F2 | Wrong text: "next-upcoming booking" (node comments, FLOW-DIAGRAM, ROADMAP, UX-ARCH) | results-F1-F2.json (F1/F2 extras) | stale text | STALE TEXT | New from F2: docs/FLOW-DIAGRAM.md:370,417; docs/ROADMAP.md:176,178; docs/UX-ARCHITECTURE.md §2.6 and node title comments say next-upcoming; code takes the earliest booked row incl. past. | none (docs; correct in place with the F2 fix) |
| D-F3 | tests/jailbreak-cases.md:20 overstates "a booking needs a real yes turn" | results/F3.json (extra) | stale text | STALE TEXT | New from F3: the turn is structural, the yes is model-decided; also the prompt names "go ahead"/"do it" that the YES regex lacks. | none (docs; with the F3 fix) |
| D-F4 | Wrong text: max-turns "guard-trip writes no state so it never locks" | results/F4.json (extra) | stale text | STALE TEXT | New from F4: handoff.md class table row, docs/UX-ARCHITECTURE.md:239 and Main Sticky Note CP6 are false for max-turns (not writing state is exactly why it never recovers). | none (docs; with the F4 fix, correct in place) |
| D-F7 | MIGRATION-PLAN #11 says "every class expires" but is silent on retention | results/F7.json (extra) | stale text | STALE TEXT | New from F7: the 253 live non-pruned keys (incl. WhatsApp sender keys) are recorded as an expiry fact, not as a retention/PII fact. | none (docs; with the F7 fix) |
| D-SP | DATA-MODEL:86-88 and Build Spend Record comment describe the spend race too softly | results/SPEND.json; inv-report §5-4 | stale text | STALE TEXT | New from SPEND: the recorded bound says undercount; measured also lowers an over-cap meter. Note inv-report says "accepted at tier, NOT ruled" while SPEND repro says "ruled 2026-11-16": check which before editing. | none (docs; with the SPEND fix) |
| EN-SEC-1 | The LLM webhook was found publicly reachable with no rate limit or … | docs/ENGINEERING-NOTES.md:108 [EN-SEC-1] | stale text | STALE TEXT | a record of a fixed finding; but its sibling (edge rate limit) is not re-verified — see CO-L2 | none |
| EN-SEC-4 | Cancel identity: session-token strength on the widget; edge rate limit "whose blocking … | docs/ENGINEERING-NOTES.md (section from line 106) [EN-SEC-4] | still true (partly) | STALE TEXT | doc-only: add the L2 result next to the 2026-10-30 claim (as README L4 already did); the identity part is H4 and stays a limit | none |
| EN-v2-12 | The reschedule orphan alert does not say which old slot to clean … | docs/ENGINEERING-NOTES.md:46 [EN-v2-12]; docs/CLOSE-OUT-PLAN.md:82 [CO-51] | stale text | STALE TEXT | done since 784cdd8; only the table row is stale · recorded reason: "the fix is written and tested offline; it changes the Main workflow, and Main is not edited before this release (ruled v2, 2026-10-25)" | none |
| PP-2a | A checksum shows a dump is intact, not that it restores | docs/CLOSE-OUT-PLAN.md:979 [PP-2a] | stale text | STALE TEXT | W5 done | none |
| PP-2b | Main had an unpublished draft (2026-11-08); start gates red | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-2b] | stale text | STALE TEXT | L1 done | none |
| PP-O1 | Open #1: Main's unpublished draft — publish or revert | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-O1] | stale text | STALE TEXT | L1 | none |
| PP-O2 | Open #2: CC has no emergency stop it can use alone | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-O2] | stale text | STALE TEXT | W7 + L1 | none |
| PP-O3 | Open #3: stale texts (BOT_KILL_SWITCH, RUNBOOK §8 pause, ROADMAP:1924 length cap) | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-O3] | stale text | STALE TEXT | W7; but README's "Pause" bullet was not in W7's list — see RM-X1 | none |
| PP-O4 | Open #4: three backup dumps with no recorded trigger; no restore tested | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-O4] | stale text | STALE TEXT | W4/W5 | none |
| RM-1122 | L2 fix round 2026-09-12 (◐): K1–K6/S3/S4 closed in one pass | docs/ROADMAP.md:1122 | stale text | STALE TEXT | Round record; residuals tracked at ROADMAP:1145. | none |
| RM-1284 | EMPTY APPOINTMENT ROWS (Airtable UI artefacts) | docs/ROADMAP.md:1284 | stale text | STALE TEXT | Airtable-era; cannot recur on Postgres. | none |
| RM-1348 | Airtable quota cannot be measured from the API | docs/ROADMAP.md:1348 | stale text | STALE TEXT | Airtable-era. | none |
| RM-1379 | AIRTABLE_BASE_ID in web/dashboard/.env.local is wrong | docs/ROADMAP.md:1379 | stale text | STALE TEXT | Airtable-era. Extra: root .env.example still lists AIRTABLE_API_KEY / AIRTABLE_BASE_ID (fold into ROADMAP:2322 fix). | none |
| RM-168 | CP2 note: "This line read ▶ IN PROGRESS until 2026-09-13" | docs/ROADMAP.md:168 | stale text | STALE TEXT | Quoted history. | none |
| RM-17 | Top table: 6→7 Migration Airtable→Postgres row marked ◐ | docs/ROADMAP.md:17 | stale text | STALE TEXT | Stale marker: every D-step closed; the two residuals are ruled elsewhere (C-6 done, DC-8 B). | none |
| RM-18 | Top table Phase 7 row (✅) carries historical ◐/▶/⏸ markers | docs/ROADMAP.md:18 | stale text | STALE TEXT | Not an open item; residuals already ruled. | none |
| RM-180 | CP4 sub-step 3 (a) reschedule execute new-event core — ◐ though "(DONE … | docs/ROADMAP.md:180 | stale text | STALE TEXT | Stale sub-phase marker; (c) finished, Phase 3 ✅. | none |
| RM-181 | CP4 sub-step 3 (b) verify/race on the NEW slot — ◐ though … | docs/ROADMAP.md:181 | stale text | STALE TEXT | Stale marker. | none |
| RM-1924 | LLM input length is uncapped (☑, "was ☐") | docs/ROADMAP.md:1924 | stale text | STALE TEXT | Already closed; ☐ only in the history text. | none |
| RM-195 | CP4b note: "it had read ▶ while every child was ✅" | docs/ROADMAP.md:195 | stale text | STALE TEXT | Quoted history. | none |
| RM-20 | Top table Public-demo row (✅) carries ⏸ STOPPED markers | docs/ROADMAP.md:20 | stale text | STALE TEXT | History, not open work. | none |
| RM-2025 | Restore Find Conversation Row.limit = 1 on the LIVE workflow | docs/ROADMAP.md:2025 | stale text | STALE TEXT | Airtable-era; impossible on Postgres. | none |
| RM-21 | Top table CLOSE-OUT row mentions "the row was ▶ until the close" | docs/ROADMAP.md:21 | stale text | STALE TEXT | Marker is quoted history. | none |
| RM-2146 | esc() does not escape the single quote | docs/ROADMAP.md:2146 | stale text | STALE TEXT | Closed. | none |
| RM-23 | Legend line | docs/ROADMAP.md:23 | stale text | STALE TEXT | Not an item. | none |
| RM-2322 | .env.example has no TURNSTILE_SECRET entry | docs/ROADMAP.md:2322 | still true | STALE TEXT | Trivial doc fix; fold in the stale Airtable/BOT_KILL_SWITCH lines and the dashboard-only names (CLIENT_CONFIG_JSON, DASHBOARD_EXPORT_ENABLED). | none |
| RM-2327 | 6d — D11 release-handoff-lock (◐) | docs/ROADMAP.md:2327 | stale text | STALE TEXT | Stale marker. | none |
| RM-2329 | CP 6d-1 write path built and drilled (◐) | docs/ROADMAP.md:2329 | stale text | STALE TEXT | Stale marker. | none |
| RM-2543 | CRT 1a idempotency — Codex audit not separately run (☐) | docs/ROADMAP.md:2543 | stale text | STALE TEXT | Stale: §9 is the single source of CRT status (K-6). | none |
| RM-2544 | CRT 8 booking mutation — Codex re-audit pending (◐) | docs/ROADMAP.md:2544 | stale text | STALE TEXT | Stale marker; but F2 is CRT-8-class and should be fed to the CRT 8 surface when fixed. | none |
| RM-267 | 6a closure note quoting "6a ▶ kalır, 7 bitince kapanır" | docs/ROADMAP.md:267 | stale text | STALE TEXT | Quoted history. | none |
| RM-315 | 6a-2 slice 1 note: "Marker flipped ▶ → ✅ on 2026-09-13" | docs/ROADMAP.md:315; docs/ROADMAP.md:317 | stale text | STALE TEXT | Quoted history. | none |
| RM-362 | 6a-2 slice 2 — the widget is LIVE (▶) | docs/ROADMAP.md:362 | stale text | STALE TEXT | Stale marker. | none |
| RM-384 | 6b note: "Marker flipped ▶ → ✅ … The single ◐ (Privacy … | docs/ROADMAP.md:384 | stale text | STALE TEXT | Quoted history. | none |
| RM-675 | Privacy Addendum moved to the public-deploy gate (mentions ◐) | docs/ROADMAP.md:675 | stale text | STALE TEXT | Quoted history. | none |
| RM-676 | Privacy Addendum obligation — HALF closed (demo site privacy text lacks it) | docs/ROADMAP.md:676; docs/ROADMAP.md:678 | stale text | STALE TEXT | Closed by the public-demo /privacy page. | none |
| RM-681 | 6c — dashboard read-only + handoff queue (☐) | docs/ROADMAP.md:681 | stale text | STALE TEXT | Stale parent marker. | none |
| RM-X1 | (found outside the named sections) README "Pause: the site can be paused … | README.md (Honest limits / Not built yet, from line 165) [RM-X1] | stale text | STALE TEXT | doc-only: say who can pause (the owner, in Vercel) and name the engine stop | none |
| SG-12 | Ship gate #12: ✅ closed | docs/ROADMAP.md:2198 [SG-12] | stale text | STALE TEXT | doc-only: the status cell must carry "not re-verified 2026-11-16 (L2)"; the underlying measurement is CO-L2 | none |
| SG-13 | Ship gate #13: ✅ closed | docs/ROADMAP.md:2199 [SG-13] | stale text | STALE TEXT | closed | none |
| SG-14 | Ship gate #14: ✅ closed | docs/ROADMAP.md:2200 [SG-14] | stale text | STALE TEXT | closed | none |
| SG-15 | Ship gate #15: ⚠ open — **v2** (ruling 3, 2026-11-01) | docs/ROADMAP.md:2201 [SG-15] | still true | STALE TEXT | doc-only: correct the bound to "Turnstile, the spend cap and the emergency stop (deactivate Main)"; the item itself stays as DC-6 rules (EN-CD-24) | none |
| SG-16 | Ship gate #16: ✅ closed — (c) under a new criterion (2026-11-06) | docs/ROADMAP.md:2202 [SG-16] | stale text | STALE TEXT | closed 2026-11-06 | none |
| SG-19 | Ship gate #19: ✅ closed, by the store | docs/ROADMAP.md:2205 [SG-19] | stale text | STALE TEXT | closed | none |
| SG-21 | Ship gate #21: ✅ closed | docs/ROADMAP.md:2207 [SG-21] | stale text | STALE TEXT | closed | none |

## E. Ruled limits kept (99 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| CO-L3e-2 | Pre-post FINAL L3e (2, 3): two September Main workflow-definition JSON files older … | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-L3e-2] | needs live read | RULE AS LIMIT | outside the published retention text by its own scope; a raw export may still carry credential ids or the chat id, so if kept it should sit behind the X1 deny rules — his ruling (keep or delete, ⚠ ONAY) **RULED 2026-11-18: still awaiting Yigitcan (keep / delete the two September JSONs); not decided by this approval.** | ruling |
| CR-A3 | Postgres statement_timeout and Telegram node timeout absent | plan-inputs/critic.md A3 | still true | RULE AS LIMIT | Critic A3 / K8: no default measured, the Telegram node has no timeout field; recorded as a limit in spend-safety.md (already stated there). | none |
| CR-A8 | Lost week context may propose the wrong week's day; only the confirm catches it | plan-inputs/critic.md A8; docs/ROADMAP.md:1527 | still true | RULE AS LIMIT | Critic A8 (ROADMAP:1527). With WU-1 the confirm check that catches it runs in code (F3), which restores the stated compensating control. | none |
| CX2-1 | Codex p2 §1 HIGH: boundary whitespace trimmed before the consent test |  | Codex p2 | RULE AS LIMIT | FIXED: an interior line break never consents (test + mutant). RULED BOUND (proposed; same class Yigitcan ruled in N1 pass 2): leading/trailing whitespace is trimmed, so `yes`+Enter is a clear yes, as `no`+Enter is the closed no. Unicode look-alikes and interior zero-width/RTL characters never match (tested). **RULED 2026-11-18: ruled limit (Yigitcan, 2026-11-18).** | none |
| CX2-10 | Codex p2 §10 LOW: a host page can set the mount marker itself |  | Codex p2 | RULE AS LIMIT | Proposed: the host controls its own page; stated in index.ts. **RULED 2026-11-18: ruled limit (Yigitcan, 2026-11-18).** | none |
| CX2-5 | Codex p2 §5 MEDIUM: the D3 test is structural, not proof of exactly-once delivery |  | Codex p2 | RULE AS LIMIT | Proposed: D3 is a structural guard (every handoff writer has an alert route); behaviour is driven end to end for 4 of the 7 F1 branches + the consent handoff; "exactly once" is bounded by the 30-min throttle and ownerAlert.enabled by design. The live B4 run reads one real alert. **RULED 2026-11-18: ruled limit (Yigitcan, 2026-11-18).** | none |
| CX2-9 | Codex p2 §9 MEDIUM: lockfile integrity/resolved values stripped whole |  | Codex p2 | RULE AS LIMIT | Pre-existing exclusion (written by npm, not by hand); secret-scan.sh carries only a pointer to this row. **RULED 2026-11-18: ruled limit (Yigitcan, 2026-11-18).** **RULED 2026-11-18: the public code comment no longer describes the gap; the detail lives here only.** | none |
| RM-1048 | L2 round on 6c-3 (◐): M1/M2/M3 closed; E4 CRT #10b prop path … | docs/ROADMAP.md:1048 | still true | RULE AS LIMIT | Prop-path is rule-covered only; a real gate needs an RSC render harness. | none |
| RM-1613 | date_expr_forged alert RATE unmeasured (20% split threshold declared) | docs/ROADMAP.md:1613 | still true | RULE AS LIMIT | Needs representative traffic; the demo has none, and adversarial drill sets are not a rate. Threshold already declared in advance. | none |
| RM-1886 | STILL UNDRILLED after the round-3 window (five behaviours, live) | docs/ROADMAP.md:1886 | still true | RULE AS LIMIT | Live LLM spend in a window; the deterministic halves are covered by the replay. (0) the collecting echo rate depends on the model and has no offline answer. | none |
| RM-1925 | webhookId UUID committed on Receive Inbound Message | docs/ROADMAP.md:1925 | still true | RULE AS LIMIT | Already in every public revision (masking is forward-only); useless without the host, which is a redaction target. Masking forward buys little; rotating it is a live edit. | none |
| RM-1934 | MEASURE THE RE-ASK RATE ON A REPRESENTATIVE SET | docs/ROADMAP.md:1934 | still true | RULE AS LIMIT | Needs representative traffic (none on a demo). | none |
| RM-1976 | 09/11-style dates are a LOCALE ambiguity | docs/ROADMAP.md:1976 | still true | RULE AS LIMIT | Tied to the business.locale bound; a DD/MM default is right for the Vienna demo; the full-date confirm is the safety net. | none |
| RM-1983 | tests/run-regression.sh runnable for drills only (◐), no real-token path | docs/ROADMAP.md:1983 | still true | RULE AS LIMIT | Measured capability limit; drill windows follow the Turnstile window protocol. | none |
| RM-2097 | Bulgu 5 — drills are not a regression harness | docs/ROADMAP.md:2097 | still true | RULE AS LIMIT | Converting all token-free DRILLS.md rows into runnable headless drills is mid-size infra, not a defect fix. | none |
| RM-2109 | Font guard upstream-blob comparison | docs/ROADMAP.md:2109 | still true | RULE AS LIMIT | Comparing against the authors' repository needs a network fetch, so it cannot be an offline check-all gate; provenance was pinned at fetch time. | none |
| RM-719 | NAMED DEBT: two TypeScript versions (web 7.0.2, scripts 5.9.3) | docs/ROADMAP.md:719 | still true | RULE AS LIMIT | Already a named debt with its removal trigger ("the day web/ moves to a TypeScript whose public API returns, this pin should go"); contained by the workspace boundary. | none |
| RM-734 | Import walk stops at third-party packages (named limit) | docs/ROADMAP.md:734 | still true | RULE AS LIMIT | Walking node_modules is out of scope by design; count is printed every run. | none |
| RM-767 | Bundle byte counts constrain the production host length — stop recording them | docs/ROADMAP.md:767 | still true | RULE AS LIMIT | A standing writing discipline, not a buildable fix; the historic leak cannot be undone (forward-only). | none |
| RT4-a | Turnstile token reuse rests on Cloudflare's single-use rule | CHAIRSIDE-REDTEAM-REPORT.md:300 | still true | RULE AS LIMIT | A repo-side replay store would add a table (DDL) and a write per turn to guarantee what siteverify already enforces. That Cloudflare enforces single use is product behaviour, not verified in this phase (no request to Cloudflare … | DDL |
| RT5-2 | Engine does not read siteverify hostname / action | docs/CLOSE-OUT-PLAN.md:38 [EN-CD-6]; docs/CLOSE-OUT-PLAN.md:38 [CO-6]; docs/ROADMAP.md:2197 [SG-11]; CHAIRSIDE-REDTEAM-REPORT.md:314 | still true | RULE AS LIMIT | The ruling names its own trigger: the next GATE-touching Main edit. If this phase edits `Normalize Inbound` or `Validate Payload` (H4/H6), the trigger fires and the hostname check rides along. If no gate node is edited, the bound … **RULED 2026-11-18: K7 — gate node (Verify Turnstile / Turnstile Valid?); same tooling-class reason as H4.** | none |
| SPEND-b | LLM timeout/error records no spend; meter can undercount without concurrency | results/SPEND.json (extra) | still true (unmeasured) | RULE AS LIMIT | New from SPEND: Extract Intent error output writes no spend although a 60 s-timed-out call may still be billed. Not measured; record next to the SPEND limit. | none |
| X1 | salon_app holds DELETE on salon.appointments; no node uses it | results-F1-F2.json (F2 side note) | still true | RULE AS LIMIT | New from F2 (measured SELECT,INSERT,UPDATE,DELETE; no appointments DELETE in any of the five exports). Least-privilege REVOKE. Optional: drop to RULE AS LIMIT if the operator step is not wanted. **RULED 2026-11-18: K8.** **RULED 2026-11-18: K8 final (Yigitcan, 2026-11-18): REVOKE dropped, DDL 005 not run — the seed tool's drill cleanup deletes from salon.appointments as salon_app (scripts/seed-workflow.py, three statements), so the revoke would break it.** | none |
| CO-RL-2 | Ruled limit: no Anthropic-side spend limit; the engine cap is the brake | docs/CLOSE-OUT-PLAN.md:992 [PP-1c]; docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [PP-O5]; docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-RL-2] | needs live read | RULED ALREADY | already ruled; note the engine meter itself undercounts under concurrency (SPEND) | none |
| CO-RL-3 | Ruled limit: whether .vercelignore applies to Git deploys is not measured | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-RL-3] | needs live read | RULED ALREADY | already ruled | none |
| CX2-11 | Codex p2 §11: D3 instrument assertion tests literals |  | Codex p2 | RULED ALREADY | By design: it proves the regex can tell a SET from a WHERE; the workflow side is tested by the D3 tests beside it. | none |
| CX2-6 | Codex p2 §6/§7/§8: idempotency, spend, dates — no finding; Codex incomplete |  | Codex p2 | RULED ALREADY | Codex found nothing in what it read and said it did not finish; L2 flow-reviewer traced the readers (M1) and the docker tests ran (claim-race, spend-meter, booking-lookup). **RULED 2026-11-18: No third Codex round (ruling 2026-11-18): the independent checks for what Codex did not cover are the post-deploy B4 run on live executions and the Mythos re-attack on the promoted commit.** **RULED 2026-11-18: B4 ran 2026-11-18: 21/21 green (docs/hardening/B4-LIVE-DRILL.md); the Mythos re-attack is the other independent check (docs/hardening/MYTHOS-HANDOVER.md).** | none |
| EN-722-1 | deploy tool: a snapshot's age is not checked | docs/ENGINEERING-NOTES.md:55 [EN-722-1]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "snapshots are deleted once an edit closes (`remote-operator.md`), and any snapshot must still pass the webhook invariants before a rollback" | none |
| EN-722-10 | deploy tool: `settings` does not enforce running after the probes | docs/ENGINEERING-NOTES.md:64 [EN-722-10]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "the runbook orders it last, and the check after it is a body probe that counts no executions" | none |
| EN-722-11 | deploy tool: pre-snapshot parity cannot see an IF/Switch condition's option fields | docs/ENGINEERING-NOTES.md:65 [EN-722-11]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "no gate decision depends on them today (R2b)" | none |
| EN-722-12 | secret scan: an agent could commit a secret together with its own … | docs/ENGINEERING-NOTES.md:66 [EN-722-12]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "the exception file is a committed, reviewed file, and every push is audited by `security-auditor` first" | none |
| EN-722-13 | secret scan: UTF-16 content and a key in a file name are … | docs/ENGINEERING-NOTES.md:67 [EN-722-13]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "no UTF-16 file in the repo; file names are read in the pre-push audit" | none |
| EN-722-14 | secret scan: replace refs can hide a pushed object | docs/ENGINEERING-NOTES.md:68 [EN-722-14]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "no replace ref exists here (counted at R4); `--no-replace-objects` was measured to work" | none |
| EN-722-15 | secret scan: C-quoted path names skip the JSON header-pair check | docs/ENGINEERING-NOTES.md:69 [EN-722-15]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "no tracked path needs C-quoting (counted at R4)" | none |
| EN-722-16 | secret scan: `SECRET_SCAN_API=3` also matches `=30`; `--remotes=<name>` trusts that namespace | docs/ENGINEERING-NOTES.md:70 [EN-722-16]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "an internal marker; one remote" | none |
| EN-722-17 | secret scan: fingerprint corner cases (a non-UTF-8 path, a path with a … | docs/ENGINEERING-NOTES.md:71 [EN-722-17]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "each fails strict: the hit stays a hit" | none |
| EN-722-18 | secret scan: a hard link from an installed copy, a symlinked hooks … | docs/ENGINEERING-NOTES.md:72 [EN-722-18]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "the installer writes fresh files from HEAD; one worktree, no symlinked hook (counted at R4); an absent ignore file means no exceptions" | none |
| EN-722-19 | secret scan: labels print the file path unmasked; a second secret on … | docs/ENGINEERING-NOTES.md:73 [EN-722-19]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "paths are repository paths, public already; the shown line redacts every 12+ character token, and the line is blocked either way" | none |
| EN-722-2 | deploy tool: the Turnstile-window helper reads its spec from any path (D6c … | docs/ENGINEERING-NOTES.md:56 [EN-722-2]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "its one caller passes `db/copies/main.json`; `workflow-step.py` requires `db/copies/` for every live write" | none |
| EN-722-20 | secret scan: manual mode resolves paths against the cwd; a long placeholder … | docs/ENGINEERING-NOTES.md:74 [EN-722-20]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "run from the repo root by habit; the placeholder case fails safe" | none |
| EN-722-21 | masking: NFKC folds some symbols into letters, non-`Nd` digits are not digits, … | docs/ENGINEERING-NOTES.md:75 [EN-722-21]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted; the U+2028/lone-\r half overlaps H3 (owner-alert text) for the Telegram surface · recorded reason: "data minimisation for the owner's own screen, not a security boundary; the golden … | none |
| EN-722-22 | masking: `maskName`'s fallback keeps runs under seven digits whole; a lone `\r`, … | docs/ENGINEERING-NOTES.md:76 [EN-722-22]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted; the U+2028/lone-\r half overlaps H3 (owner-alert text) for the Telegram surface · recorded reason: "below the seven-digit rule by design, or rare input on the owner's screen" | none |
| EN-722-24 | secret scan: the n8n-key rule misses a human-chosen passphrase with dots or … | docs/ENGINEERING-NOTES.md:78 [EN-722-24]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "generated keys and URL-embedded passwords are caught; a false block is visible and a committed line can be excepted by fingerprint" | none |
| EN-722-25 | secret scan: the git pre-push gate can be bypassed by `--no-verify` (or … | docs/ENGINEERING-NOTES.md:79 [EN-722-25]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "ruled 7-2 R4: a command-line check was built in three versions and each later one let through forms an earlier one caught; the habit is wri…" | none |
| EN-722-26 | secret scan: busybox awk ends a working-tree line at a NUL byte | docs/ENGINEERING-NOTES.md:80 [EN-722-26]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "manual mode only — the gate reads committed patches in its Python engine; this machine's awk handles NUL (measured by the R4 review)" | none |
| EN-722-27 | secret scan: the PLACEHOLDER strip is quadratic on a very long run … | docs/ENGINEERING-NOTES.md:81 [EN-722-27]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "it fails closed (a slow scan blocks the push, never passes it); no such line in the repo" | none |
| EN-722-3 | deploy tool: the Turnstile window's holder check has no fallback for a … | docs/ENGINEERING-NOTES.md:57 [EN-722-3]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "such a listing gives 0 holders, which is red, never a pass" | none |
| EN-722-4 | deploy tool: a snapshot directory inside another git work tree is accepted | docs/ENGINEERING-NOTES.md:58 [EN-722-4]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "snapshots live in the session scratchpad by procedure; only this repo is refused, which is the leak that matters" | none |
| EN-722-5 | deploy tool: the helper's `api` raises on an empty curl output | docs/ENGINEERING-NOTES.md:59 [EN-722-5]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "a traceback still stops the run; every next step reads the copy's state before writing" | none |
| EN-722-6 | deploy tool: `activate` does not re-check the Turnstile literal | docs/ENGINEERING-NOTES.md:60 [EN-722-6]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "`put` checks the literal on the export and in its live read-back before any activate" | none |
| EN-722-7 | deploy tool: spec and WORKFLOWS are read from the working tree | docs/ENGINEERING-NOTES.md:61 [EN-722-7]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "`check-all` and the pre-push audit run on a clean tree before every live step" | none |
| EN-722-8 | deploy tool: nodes sharing a name are invisible to name-keyed comparisons | docs/ENGINEERING-NOTES.md:62 [EN-722-8]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "no committed export has a repeated node name (counted at 7-2 R4)" | none |
| EN-722-9 | deploy tool: put's read-back re-verifies only the trigger's webhookId | docs/ENGINEERING-NOTES.md:63 [EN-722-9]; docs/CLOSE-OUT-PLAN.md:69 [EN-CD-38]; docs/CLOSE-OUT-PLAN.md:69 [CO-38] | still true (not re-measured) | RULED ALREADY | ruled 7-2 R4 / DC-1; premise not contradicted · recorded reason: "only the trigger's id routes inbound traffic; the Telegram nodes' ids are kept by name" | none |
| EN-CD-12 | The second uncertain turn live; golden G8 / G10 / G11 not … | docs/CLOSE-OUT-PLAN.md:44 [EN-CD-12]; docs/CLOSE-OUT-PLAN.md:44 [CO-12] | needs live read | RULED ALREADY | keep: LLM spend in an approved window | none |
| EN-CD-14 | A name that needs combining marks (`\p{M}`) is refused; a ZWNJ is … | docs/CLOSE-OUT-PLAN.md:46 [EN-CD-14]; docs/CLOSE-OUT-PLAN.md:46 [CO-14] | still true | RULED ALREADY | NAME-CAPTURE R3-2 bound; trigger: non-Latin-name client · reopens when: "a client whose customers have non-Latin names" | none |
| EN-CD-15 | DATE-PHRASING's and N1's recorded bounds: the r4 text class (R2d), F2 and … | docs/ENGINEERING-NOTES.md (section from line 106) [EN-SEC-2]; docs/CLOSE-OUT-PLAN.md:47 [EN-CD-15]; docs/CLOSE-OUT-PLAN.md:47 [CO-15] | still true (not re-measured) | RULED ALREADY | standing bounds, no trigger named · reopens when: "no trigger named — standing bounds. If M2 (the booking-confirm freshness check) is built, F1's prem…" | none |
| EN-CD-16 | EUR only, English customer text, two dead config keys (`instagram`, `business.locale`) | docs/ENGINEERING-NOTES.md:41 [EN-v2-7]; docs/CLOSE-OUT-PLAN.md:48 [EN-CD-16]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:48 [CO-16]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true | RULED ALREADY | recorded bounds · reopens when: "a client in another currency or language" | none |
| EN-CD-19 | A reminder for an appointment cancelled while the database mirror was failing | docs/ENGINEERING-NOTES.md:45 [EN-v2-11]; docs/CLOSE-OUT-PLAN.md:51 [EN-CD-19]; docs/CLOSE-OUT-PLAN.md:51 [CO-19] | still true | RULED ALREADY | keep K4 | credential |
| EN-CD-20 | Real WhatsApp reminder-template delivery (CP4d-2) | docs/ROADMAP.md:200; docs/ROADMAP.md:202; docs/CLOSE-OUT-PLAN.md:52 [EN-CD-20]; docs/CLOSE-OUT-PLAN.md:52 [CO-20] | needs live read | RULED ALREADY | trigger: a client's own number · reopens when: "a client's own WhatsApp Business number" | none |
| EN-CD-21 | Release's one-second resend window (Owner Actions) | docs/CLOSE-OUT-PLAN.md:53 [EN-CD-21]; docs/CLOSE-OUT-PLAN.md:53 [CO-21] | still true (not re-measured) | RULED ALREADY | written bound · reopens when: "no trigger named; the bound assumes the dashboard's and n8n's clocks agree to about a second (same …" | none |
| EN-CD-24 | Ship gate #15, the hidden-container check in Managed mode | docs/CLOSE-OUT-PLAN.md:56 [EN-CD-24]; docs/CLOSE-OUT-PLAN.md:56 [CO-24] | needs live read | RULED ALREADY | DC-6; but ROADMAP #15's bound text ("rate limit … and the pause") is stale — see SG-15 · reopens when: "no trigger named by DC-6; the earlier ruling (RENAME (3)) names what a run needs: a hidden-containe…" | none |
| EN-CD-25 | The watchdog's five unswept axes (ROADMAP 6b hand-over #9) | docs/CLOSE-OUT-PLAN.md:57 [EN-CD-25]; docs/CLOSE-OUT-PLAN.md:57 [CO-25] | needs live read | RULED ALREADY | not a defect · reopens when: "a client reports a stuck widget" | none |
| EN-CD-30 | Dashboard security: `salon_ro` reads every column; a cached write check; raw driver … | docs/ENGINEERING-NOTES.md:97 [EN-74B-5]; docs/CLOSE-OUT-PLAN.md:61 [EN-CD-30]; docs/CLOSE-OUT-PLAN.md:61 [CO-30] | still true | RULED ALREADY | role read-only, dashboard behind Access | none |
| EN-CD-33 | Ship gate #18: Access's configuration is not in the repo | docs/CLOSE-OUT-PLAN.md:64 [EN-CD-33]; docs/CLOSE-OUT-PLAN.md:64 [CO-33]; docs/ROADMAP.md:2204 [SG-18] | still true | RULED ALREADY | K-6: a service inventory in a public repo · reopens when: "no trigger named" | none |
| EN-CD-34 | Per-client Turnstile provisioning | docs/CLOSE-OUT-PLAN.md:65 [EN-CD-34]; docs/CLOSE-OUT-PLAN.md:65 [CO-34]; README.md (Honest limits / Not built yet, from line 165) [RM-NB-2] | still true | RULED ALREADY | required before the SECOND real client, not for the demo · reopens when: "the second real client" | none |
| EN-CD-35 | A real second deployment | docs/CLOSE-OUT-PLAN.md:66 [EN-CD-35]; docs/CLOSE-OUT-PLAN.md:66 [CO-35]; README.md:200 [RM-HL-7]; README.md (Honest limits / Not built yet, from line 165) [RM-NB-1] | still true | RULED ALREADY | trigger: a real client · reopens when: "a real client" | none |
| EN-CD-36 | WhatsApp end to end on Postgres (K-5) | docs/ENGINEERING-NOTES.md:102 [EN-v2-P2]; docs/CLOSE-OUT-PLAN.md:67 [EN-CD-36]; docs/CLOSE-OUT-PLAN.md:67 [CO-36]; README.md:174 [RM-HL-2]; README.md (Honest limits / Not built yet, from line 165) [RM-NB-3] | still true | RULED ALREADY | trigger: channel turned on for a client · reopens when: "the WhatsApp channel turned on for a client" | none |
| EN-CD-4 | A stale line in the intent prompt (reschedule "routed to a human") | docs/ENGINEERING-NOTES.md:98 [EN-74B-6]; docs/CLOSE-OUT-PLAN.md:36 [EN-CD-4]; docs/CLOSE-OUT-PLAN.md:36 [CO-4] | still true | RULED ALREADY | keep: a prompt change needs a paid golden re-run (its second blocker, independent of the Main edit) | none |
| EN-CD-40 | #17b–d: the `/api` Access service token, the owner-path Access service token, the … | docs/ENGINEERING-NOTES.md:93 [EN-74B-1]; docs/CLOSE-OUT-PLAN.md:71 [EN-CD-40]; docs/CLOSE-OUT-PLAN.md:71 [CO-40]; docs/ROADMAP.md:2203 [SG-17] | needs live read | RULED ALREADY | respect the decline (trigger: first real client / anyone else on the server); flag the weakened premise for his ruling, do not change the ruling text | none |
| EN-CD-41 | Revoking the existing Access sessions (C-4's first half; its second half, the … | docs/ENGINEERING-NOTES.md:94 [EN-74B-2]; docs/CLOSE-OUT-PLAN.md:72 [EN-CD-41]; docs/CLOSE-OUT-PLAN.md:72 [CO-41] | needs live read | RULED ALREADY | declined; the leaked session material was deleted (T-4, 91 → 0) | none |
| EN-CD-42 | The tunnel credential into a root-only file (C-5; row 42's A half, … | docs/ENGINEERING-NOTES.md:96 [EN-74B-4]; docs/CLOSE-OUT-PLAN.md:73 [EN-CD-42]; docs/CLOSE-OUT-PLAN.md:73 [CO-42] | needs live read | RULED ALREADY | closed by decision, trigger: first real client | none |
| EN-CD-43 | An off-server backup target; a pinned backup script | docs/ENGINEERING-NOTES.md:96 [EN-74B-4]; docs/CLOSE-OUT-PLAN.md:74 [EN-CD-43]; docs/CLOSE-OUT-PLAN.md:74 [CO-43] | needs live read | RULED ALREADY | DC-8; trigger: first real client · reopens when: "the first real client, unless the owner names a target earlier" | none |
| EN-CD-44 | Airtable: the Gate 1 export and deleting the base (C-6 steps 1 … | docs/ENGINEERING-NOTES.md:95 [EN-74B-3]; docs/CLOSE-OUT-PLAN.md:75 [EN-CD-44]; docs/CLOSE-OUT-PLAN.md:75 [CO-44] | needs live read | RULED ALREADY | base kept, synthetic data | none |
| EN-CD-47 | A second owner-alert channel | docs/ENGINEERING-NOTES.md:47 [EN-v2-13]; docs/CLOSE-OUT-PLAN.md:78 [EN-CD-47]; docs/CLOSE-OUT-PLAN.md:78 [CO-47] | still true | RULED ALREADY | trigger: a real client · reopens when: "a real client — an alert that cannot reach the owner is a business risk then" | none |
| EN-CD-5 | The few-shot's fixed "no hair colouring" example | docs/CLOSE-OUT-PLAN.md:37 [EN-CD-5]; docs/CLOSE-OUT-PLAN.md:37 [CO-5] | still true | RULED ALREADY | trigger not fired (no client offers colouring) · reopens when: "a client that offers colouring" | none |
| EN-CD-9 | A verify read with no `items` key counts as an empty list | docs/ENGINEERING-NOTES.md:77 [EN-722-23]; docs/CLOSE-OUT-PLAN.md:41 [EN-CD-9]; docs/CLOSE-OUT-PLAN.md:41 [CO-9] | still true | RULED ALREADY | ruled carve-out (7-2 R2); trigger not seen · reopens when: "Calendar is seen omitting the key" | none |
| EN-SEC-3 | The extraction-retry path has never been TRIGGERED in production | docs/ROADMAP.md:1643; docs/ENGINEERING-NOTES.md:122 [EN-SEC-3] | needs live read | RULED ALREADY | the trigger (a model omitting a required key) cannot be induced on demand | none |
| EN-v2-1 | F5 — the deploy-separation guard checks import *spelling*, not reachability | docs/ENGINEERING-NOTES.md:35 [EN-v2-1]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true (not re-measured) | RULED ALREADY | premise "Codex found no dashboard-reaching import" not contradicted; a guard gap, not a leak · recorded reason: "a guard that can miss, not a present leak: Codex found no dashboard-reaching import in the public packages" | none |
| EN-v2-2 | F6 — the hardlink identity check is a substring match | docs/ENGINEERING-NOTES.md:36 [EN-v2-2]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true (not re-measured) | RULED ALREADY | fails toward a false positive, never a miss · recorded reason: "it can over-report (a false positive), never miss a leak" | none |
| EN-v2-3 | F9 — the client-import gate does not enumerate `.mts` / `.cts` | docs/ENGINEERING-NOTES.md:37 [EN-v2-3]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true | RULED ALREADY | the premise (no such file exists) still holds; DC-1 re-affirmed it · recorded reason: "no such files exist today; a coverage gap for a future refactor" | none |
| EN-v2-4 | F10 — the dashboard's runtime browser guard is a DOM-presence heuristic | docs/ENGINEERING-NOTES.md:38 [EN-v2-4]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true (not re-measured) | RULED ALREADY | a diagnostic, not the control · recorded reason: "the build-time server/client boundary is the real control; the runtime check is a diagnostic" | none |
| EN-v2-5 | F11 — the database schema accepts an empty id, an infinite timestamp … | docs/ENGINEERING-NOTES.md:39 [EN-v2-5]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true | RULED ALREADY | "no writer produces them today" — not contradicted by the exports read; tightening needs a migration + operator apply · recorded reason: "no writer produces them today; tightening needs a migration file and an operator apply" | DDL |
| EN-v2-6 | F13 — a capped appointment window can say "Nothing booked ahead" | docs/ENGINEERING-NOTES.md:40 [EN-v2-6]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true (not re-measured) | RULED ALREADY | needs >100 cancellations inside the window · recorded reason: "inherited 1:1 from the Airtable dashboard; it needs more than a hundred cancellations inside the window to show" | none |
| EN-v2-P1 | What the regression covers on Postgres (ruled 2026-10-25) | docs/ENGINEERING-NOTES.md:100 [EN-v2-P1] | needs live read | RULED ALREADY | a coverage record, not a defect | none |
| PP-1b | A spent cap makes the bot handoff-only for the rest of the … | docs/CLOSE-OUT-PLAN.md:978 [PP-1b] | still true | RULED ALREADY | by design (fail-closed brake); monthly cap | none |
| PP-3b | Owner Actions' two alerts bypass the ownerAlert switch | docs/CLOSE-OUT-PLAN.md:980 [PP-3b] | still true | RULED ALREADY | the owner's own release action reporting its failure is wanted even with alerts off; low volume (owner-triggered) | none |
| PP-4 | Kill switch is a literal; no measured duration / Postgres-era proof | docs/CLOSE-OUT-PLAN.md:1006 [PP-4] | still true | RULED ALREADY | standing ruling 2026-11-16: "botu durdur" → CC deactivates Main | none |
| PP-6 | Origin default-deny firewall is an operator statement | docs/CLOSE-OUT-PLAN.md:983 [PP-6] | needs live read | RULED ALREADY | root-only; needs an operator run | none |
| RM-1822 | OPEN AFTER CODEX ROUND 4: (1) day-vocabulary residue inherits the stored date; … | docs/ROADMAP.md:1822 | still true | RULED ALREADY | Respect the declined-scope ruling; the confirm shows weekday + full date + year (R2d structural guarantee). | none |
| RM-1940 | tests execute committed workflow code unsandboxed (new Function) | docs/ROADMAP.md:1940 | still true | RULED ALREADY | Trigger (CI) has not fired; respect the recorded acceptance. | none |
| RM-2018 | conversations.last_alert_class is lost on a conversation's FIRST turn | docs/ROADMAP.md:2018 | still true | RULED ALREADY | RULED: PHASE-7-PLAN.md:726 PHASE-7 bucket item (4) (Yigitcan 2026-10-23) "on a session's FIRST turn an owner alert's Find Conversation Row runs before Save State … Record Alert Class does not run" with the 7-F1 correction "What … | none |
| RM-2289 | Turnstile secret lives in a NODE PARAMETER, not an n8n Credential | docs/ROADMAP.md:2289; docs/CLOSE-OUT-PLAN.md:38 [EN-CD-6]; docs/CLOSE-OUT-PLAN.md:38 [CO-6]; docs/ROADMAP.md:2197 [SG-11] | still true | RULED ALREADY | Respect the recorded bound (with per-client provisioning). | credential |
| RM-HL-1 | No real customers, no paying client | README.md:173 [RM-HL-1] | still true | RULED ALREADY | a fact of the demo | none |
| RM-HL-5 | Dates: English only, no ranges, 30-day horizon | README.md:182 [RM-HL-5] | still true (not re-measured) | RULED ALREADY | recorded bound (B #16 for language) | none |
| RT5-1 | Widget identity is session-strength (sessionId is a bearer) | README.md:180 [RM-HL-4]; CHAIRSIDE-REDTEAM-REPORT.md:313 | still true | RULED ALREADY | A verified identity needs a login or OTP channel. That is a product decision outside tier T1. The client mints `w-<randomUUID>`, so guessing a session is infeasible. | none |
| RT5-10 | Leads purge refuses when candidates exceed 20 % (never under five rows) | CHAIRSIDE-REDTEAM-REPORT.md:322 | still true | RULED ALREADY | The refusal IS the safety property: a mis-computed cutoff costs a Telegram message, not the table. Deleting up to the cap instead would trade a visible refusal for a silent partial delete. The attack costs one Turnstile-passing … | none |
| RT5-3 | Owner-alert flood: per-sender throttle, no global cap, rotating sessionId | docs/CLOSE-OUT-PLAN.md:1009 [PP-3a]; docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) [CO-RL-1]; CHAIRSIDE-REDTEAM-REPORT.md:315 | still true | RULED ALREADY | Ruled 2026-11-16 and accepted as it stands. Each rotating-sender turn still has to pass Turnstile, and the spend cap bounds the total. The related defects (F7 map growth, H5 static-data race) are separate items and do not reopen … | none |
| RT5-7 | A turn that saves no state does not stale a confirm | README.md:183 [RM-HL-6]; CHAIRSIDE-REDTEAM-REPORT.md:319 | still true | RULED ALREADY | Ruled. Cross-reference F5: a wall-clock bound on the confirm, if F5's fix adds one, also narrows this limit. Decide it there, not here. | none |
| RT5-8 | Booking race is bounded, not locked; a failed verify can leave two … | README.md:176 [RM-HL-3]; CHAIRSIDE-REDTEAM-REPORT.md:320 | still true | RULED ALREADY | Ruled. A real lock would need a Postgres slot-reservation row (UNIQUE slot) taken before the Calendar write, which redesigns CRT 1b. The failure is visible (owner alert) and recoverable. | DDL |

## F. v2 (deferred, trigger-bound) (14 rows)

| id | title | source refs | status today | final class | reason | needs |
|---|---|---|---|---|---|---|
| EN-CD-10 | A change request during a confirm (the "change" intent) | docs/ROADMAP.md:1912; docs/CLOSE-OUT-PLAN.md:42 [EN-CD-10]; docs/CLOSE-OUT-PLAN.md:42 [CO-10] | still true | v2 | a product feature with its own phase (ARCH-DEC 2026-09-09e) | none |
| EN-CD-26 | A phone / e-mail field in the widget, per client | docs/CLOSE-OUT-PLAN.md:58 [EN-CD-26]; docs/CLOSE-OUT-PLAN.md:58 [CO-26] | still true | v2 | a per-client product decision (call-backs) · reopens when: "a client that wants call-backs from the widget" | none |
| EN-CD-31 | The older v2 / LATER bucket (the idempotent replay's stored reply, required … | docs/ENGINEERING-NOTES.md:48 [EN-v2-14]; docs/CLOSE-OUT-PLAN.md:62 [EN-CD-31]; docs/CLOSE-OUT-PLAN.md:62 [CO-31] | still true | v2 | product improvements (a Customers table, transcript retention) need product decisions | none |
| EN-CD-37 | Instagram DMs (config-gated; no adapter built) | docs/CLOSE-OUT-PLAN.md:68 [EN-CD-37]; docs/CLOSE-OUT-PLAN.md:68 [CO-37] | still true | v2 | a product decision: build a channel adapter · reopens when: "a client asks for Instagram" | none |
| EN-CD-45 | The Loom (#20) and the "CC builds" exception review it carries | docs/CLOSE-OUT-PLAN.md:76 [EN-CD-45]; docs/CLOSE-OUT-PLAN.md:76 [CO-45]; docs/ROADMAP.md:2206 [SG-20] | needs live read | v2 | deferred by the owner: his decision on the approach | none |
| EN-CD-8 | Rebooking a slot you just cancelled is handed off | docs/ENGINEERING-NOTES.md:44 [EN-v2-10]; docs/CLOSE-OUT-PLAN.md:40 [EN-CD-8]; docs/CLOSE-OUT-PLAN.md:40 [CO-8]; CHAIRSIDE-REDTEAM-REPORT.md:321 | still true | v2 | keep K3/DC-1: proof needs a real calendar write (forbidden offline) | none |
| EN-v2-8 | The `handoffShown` twin in `web/snippet` | docs/ROADMAP.md:1085; docs/ENGINEERING-NOTES.md:42 [EN-v2-8]; docs/CLOSE-OUT-PLAN.md:63 [EN-CD-32]; docs/CLOSE-OUT-PLAN.md:63 [CO-32] | still true | v2 | a test blind spot, not a runtime defect; DC-1 re-affirmed v2 · recorded reason: "the snippet and the site each record "lock line shown" at their own call site; deleting that line from one caller leaves the parity suite green — a … | none |
| RM-1392 | BULGU-4: tsconfig paths alias in a walked-but-unscanned package is invisible | docs/ROADMAP.md:1392 | still true | v2 | Respect v2 ruling. | none |
| RM-1397 | R2: isClientEntry reads only statements[0] | docs/ROADMAP.md:1397 | still true | v2 | Respect v2 ruling (fix is ~5 lines + 1 selftest case if reopened). | none |
| RM-1991 | Handoff lock TTL + D11 automation | docs/ROADMAP.md:1991 | still true | v2 | Auto-expiry vs owner-only release is a product decision the later design answered "owner-only"; TTL needs a ruling, not a fix. EXTRA (not in ROADMAP): Validate Release Target refuses a lock whose last_updated is older than … | none |
| RM-2013 | Dropped-date re-ask wording (date_ambiguous "next tuesday") | docs/ROADMAP.md:2013 | still true | v2 | Needs a new template + config key and a UX decision on what "next" offers; item says "deliberately not fixed … does not close any error class". | none |
| RM-2255 | Visitor-visible transcript lost on same-tab navigation; engine conversation continues | docs/ROADMAP.md:2255; docs/ROADMAP.md:2324 | still true | v2 | Respect v2 ruling. | none |
| RM-2263 | SCREEN-INVENTORY §2.10.1 decided texts ≠ FRONTEND_TEXT (W57/W58/W60) | docs/ROADMAP.md:2263 | still true | v2 | Respect v2 ruling; which side wins is Yigitcan's call. | none |
| RT5-6 | Claim-first dedupe is at-most-once; a duplicate gets no stored reply | docs/ROADMAP.md:2278; CHAIRSIDE-REDTEAM-REPORT.md:318 | still true | v2 | What a duplicate delivery should receive (the first reply re-sent, or a neutral ack) is a product decision. Storing the reply needs a column (DDL) and a write after the reply. At-most-once is the deliberate price of an atomic … | DDL |

## Counts

**Rows out: 230.**

| class | rows | of which conditional |
|---|---|---|
| FIX NOW | 38 | 1 |
| RULE AS LIMIT | 25 | 0 |
| v2 | 15 | 0 |
| STALE TEXT | 76 | 0 |
| RULED ALREADY | 76 | 0 |
| **total** | **230** | |

| group | rows |
|---|---|
| A. Findings (F1-F7, SPEND, H3-H6) | 13 |
| B. Engine / product defects from ROADMAP and notes | 14 |
| C. Ops / tooling / edge | 15 |
| D. Docs-only stale text | 75 |
| E. Ruled limits kept | 99 |
| F. v2 (deferred, trigger-bound) | 14 |
| **total** | **230** |

Class by group:

| group | FIX NOW | RULE AS LIMIT | v2 | STALE TEXT | RULED ALREADY |
|---|---|---|---|---|---|
| A | 10 | 2 | 1 | 0 | 0 |
| B | 14 | 0 | 0 | 0 | 0 |
| C | 14 | 0 | 0 | 1 | 0 |
| D | 0 | 0 | 0 | 75 | 0 |
| E | 0 | 23 | 0 | 0 | 76 |
| F | 0 | 0 | 14 | 0 | 0 |

STALE TEXT split (heuristic from the inventories' fix_cost: empty / none / n/a = closed record, no edit): 25 rows need a docs edit, 51 are closed records that need none. The 7 rows added from the findings (D-*) and the 6 reclassified doc-only rows need an edit.

## Reconciliation: count in vs rows out

Every input ref maps to at least one row (asserted by the generator: no unmapped DUPLICATE, no ref without a target). A ref that points at several rows is a pointer row (EN-CD-32, EN-CD-38, EN-74B-4/-6, PP-3a, CO-RL-1, EN-CD-6, CO-6, SG-11, RM-HL-6) and is counted once in `count in`.

| inventory | count in | refs that own a row under their own id | refs merged into another ref's row | distinct register rows touched |
|---|---|---|---|---|
| inv-roadmap (ROADMAP markers) | 77 | 64 | 13 | 70 |
| inv-notes-closeout (ENG-NOTES + CLOSE-OUT + ROADMAP ship gate + README) | 192 | 116 | 76 | 131 |
| inv-report (REDTEAM report §4/§5 + A1 probe) | 17 | 11 | 6 | 16 |
| **inventories total** | **286** | | | |
| 12 findings | 12 | 12 | 0 | 13 rows (H5 split into H5 + H5b by me) |
| rows added from the findings' extras (X1, SPEND-b, D-F2, D-F3, D-F4, D-SP, D-F7) | n/a | n/a | n/a | 7 |

Arithmetic: 286 inventory refs = 191 refs that own a row under their own id + 95 refs merged into another row. The 4 merge targets with no ref of their own id (EDGE-RL, EN-v2-12, RM-1979, RT5-6) are rows opened by the merged refs: 191 + 4 = **195 inventory rows**. Plus 13 finding rows (12 findings, H5 split in two) plus 7 rows from the findings' extras = **230 rows out**.

Unmapped input refs (a ref whose target row does not exist): **0** []. Appendix rows: 286 (= count in 286).

## Every change I made to an inventory classification, merge or judgement

Rules applied globally (not repeated per row):

- Inventory `ALREADY CLOSED / STALE TEXT` -> `STALE TEXT`. Inventory `RULE AS LIMIT` -> `RULED ALREADY` when the item's own recorded classification or reason cites a standing ruling / recorded bound / decision (regex on existing_classification + reason); otherwise it stays `RULE AS LIMIT`. This relabel splits the inventories' single "RULE AS LIMIT" bucket: of the 89 inventory rows that stay limits, 74 are RULED ALREADY and the rest stay RULE AS LIMIT.
- A ref with `proposed = DUPLICATE` is merged into the row named by `duplicate_of`. Where the inventory left `duplicate_of` empty or pointed at an item that is not a row, I chose the target (see below).

- RM-2322: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- EN-v2-8: class RULED ALREADY -> v2. EN-v2-8 said RULE AS LIMIT, ROADMAP:1085 said v2; DC-1 re-affirmation is worded v2.
- EN-SEC-4: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- EN-CD-8: class RULED ALREADY -> v2. EN-CD-8 and EN-v2-10 said RULE AS LIMIT, §5-9 said v2; the ruling (K3, 2026-10-25) is worded v2.
- CO-18: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- SG-12: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- SG-15: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- RM-X1: class FIX NOW -> STALE TEXT. inventory said FIX NOW; the fix is a documentation/comment edit only.
- RM-1979 (= §5-11): the report inventory and the roadmap inventory both said FIX NOW; merged as the same defect. NOT merged with finding F2 (different defect in the same node, per §5-11's own note); the ROADMAP "F2" and the red-team "F2" are different items with the same name.
- ROADMAP:1912 -> EN-CD-10; ROADMAP:2324 -> RM-2255; ROADMAP:200/202 -> EN-CD-20; ROADMAP:1643 -> EN-SEC-3; ROADMAP:1085 -> EN-v2-8; ROADMAP:2278/§5-6 -> RT5-6; §5-9, EN-v2-10 -> EN-CD-8; EN-v2-11 -> EN-CD-19; EN-v2-7 -> EN-CD-16; CO-51 -> EN-v2-12: cross-inventory or intra-inventory same-item merges the inventories had NOT marked as duplicates (judgement, same wording or same ruling).
- RM-HL-3 -> RT5-8, RM-HL-4 -> RT5-1, RM-HL-6 -> RT5-7 (+F5, F3): the notes inventory pointed these at F-ids; the report inventory already holds the ruled-limit row that says the same sentence, so the pointer goes there with the F-id kept as a second target. PP-3a / CO-RL-1 -> RT5-3 (+F7, H5) for the same reason.
- EN-CD-6 / CO-6 / SG-11 split to two rows: RT5-2 (engine does not read siteverify hostname/action; FIX NOW conditional, Ruling (d) names the trigger) and RM-2289 (Turnstile secret in a node parameter; recorded bound). The notes inventory classed the union as RULE AS LIMIT; the report inventory classed the hostname half FIX NOW (conditional). Both kept on their own half.
- RT5-2 / H4 / H6 / F6 interplay: Normalize Inbound, Validate Payload (and, per Ruling (d), the Turnstile Valid? hostname check) are GATE nodes. verify-H4 measured that the deploy tooling refuses a jsCode edit of a gate node (only config literals may gain keys). So H4, H6 part 1 and RT5-2 share ONE prerequisite: a new gate-code-edit class in the tooling plus a ruling. Plan them as one gate round, or none.
- SPEND vs §5-4: inv-report says the DATA-MODEL record is "accepted at tier, NOT ruled on 2026-11-16"; the SPEND repro says "ruled 2026-11-16". Not resolved offline (needs a read of DATA-MODEL:86-88 and the CLOSE-OUT rulings). Class FIX NOW kept either way; the extra measured behaviour (an over-cap meter can be lowered) is outside both wordings.
- A1-b: withheld (K12).
- EN-722-21 / EN-722-22 (masking LOWs, ruled limits): their U+2028 / lone-CR half is now owned by H3 (FIX NOW). The rows stay RULED ALREADY for the digit/NFKC half.
- EN-CD-3 and EN-CD-7 stay FIX NOW as the notes inventory said, but they contradict DC-1 (its only stated reason was "edits Main twice"): they need Yigitcan's ruling, and only make sense if the hardening phase edits Main anyway (it does: F1, F7, H3 all edit Build Owner Alert).
- F4 -> RM-X2 (README "turn cap ends a runaway conversation") pointer: docs text to correct with D-F4.
- Findings: classes for F1-F7, SPEND, H3-H6 are mine (the inventories held no class for them, only pointers). H5 / H5b classes rest on a reproduction with no verification file. H5 split into two rows because the fix, the cost and the failure direction differ (alert throttle: extra alerts, needs DDL; Reminders guard: possible double send, query edit only).
- Items I did NOT carry as separate rows although the findings mention them: F3 extras D7 / correction-confirm / coverage gap (folded into F3); F4 kill-switch carry-over and Record Alert Class note (F4); F5 reschedule-lane destruction (F5); F6 Luxon-accepted variants and Build Reply Payload "ready" echo residual (F6); F7 Reminders guard scalar (bounded, not affected); H3 informational surrogate-slice and Purge/Reminders `detail:` newline (H3); H4 non-string text/messageId and the WhatsApp lane truthiness check (H4); H6 NUL after char 80 failing Capture Lead (H6); H5 throttled run still writes static data (H5).

## Appendix: every input ref -> register row

`->` shows the row(s) a ref was merged into; an own row shows itself. Inventory: R = roadmap, N = notes/close-out/README, P = report/probe.

| inv | input ref | location | maps to |
|---|---|---|---|
| R | ROADMAP:17 | docs/ROADMAP.md:17 | own row RM-17 |
| R | ROADMAP:18 | docs/ROADMAP.md:18 | own row RM-18 |
| R | ROADMAP:20 | docs/ROADMAP.md:20 | own row RM-20 |
| R | ROADMAP:21 | docs/ROADMAP.md:21 | own row RM-21 |
| R | ROADMAP:23 | docs/ROADMAP.md:23 | own row RM-23 |
| R | ROADMAP:168 | docs/ROADMAP.md:168 | own row RM-168 |
| R | ROADMAP:180 | docs/ROADMAP.md:180 | own row RM-180 |
| R | ROADMAP:181 | docs/ROADMAP.md:181 | own row RM-181 |
| R | ROADMAP:185 | docs/ROADMAP.md:185 | own row RM-185 |
| R | ROADMAP:195 | docs/ROADMAP.md:195 | own row RM-195 |
| R | ROADMAP:200 | docs/ROADMAP.md:200 | -> EN-CD-20 |
| R | ROADMAP:202 | docs/ROADMAP.md:202 | -> EN-CD-20 |
| R | ROADMAP:267 | docs/ROADMAP.md:267 | own row RM-267 |
| R | ROADMAP:315 | docs/ROADMAP.md:315 | own row RM-315 |
| R | ROADMAP:317 | docs/ROADMAP.md:317 | -> RM-315 |
| R | ROADMAP:362 | docs/ROADMAP.md:362 | own row RM-362 |
| R | ROADMAP:384 | docs/ROADMAP.md:384 | own row RM-384 |
| R | ROADMAP:675 | docs/ROADMAP.md:675 | own row RM-675 |
| R | ROADMAP:676 | docs/ROADMAP.md:676 | own row RM-676 |
| R | ROADMAP:678 | docs/ROADMAP.md:678 | -> RM-676 |
| R | ROADMAP:681 | docs/ROADMAP.md:681 | own row RM-681 |
| R | ROADMAP:719 | docs/ROADMAP.md:719 | own row RM-719 |
| R | ROADMAP:734 | docs/ROADMAP.md:734 | own row RM-734 |
| R | ROADMAP:767 | docs/ROADMAP.md:767 | own row RM-767 |
| R | ROADMAP:1048 | docs/ROADMAP.md:1048 | own row RM-1048 |
| R | ROADMAP:1085 | docs/ROADMAP.md:1085 | -> EN-v2-8 |
| R | ROADMAP:1122 | docs/ROADMAP.md:1122 | own row RM-1122 |
| R | ROADMAP:1145 | docs/ROADMAP.md:1145 | own row RM-1145 |
| R | ROADMAP:1284 | docs/ROADMAP.md:1284 | own row RM-1284 |
| R | ROADMAP:1348 | docs/ROADMAP.md:1348 | own row RM-1348 |
| R | ROADMAP:1379 | docs/ROADMAP.md:1379 | own row RM-1379 |
| R | ROADMAP:1392 | docs/ROADMAP.md:1392 | own row RM-1392 |
| R | ROADMAP:1397 | docs/ROADMAP.md:1397 | own row RM-1397 |
| R | ROADMAP:1413 | docs/ROADMAP.md:1413 | own row RM-1413 |
| R | ROADMAP:1613 | docs/ROADMAP.md:1613 | own row RM-1613 |
| R | ROADMAP:1622 | docs/ROADMAP.md:1622 | own row RM-1622 |
| R | ROADMAP:1643 | docs/ROADMAP.md:1643 | -> EN-SEC-3 |
| R | ROADMAP:1822 | docs/ROADMAP.md:1822 | own row RM-1822 |
| R | ROADMAP:1886 | docs/ROADMAP.md:1886 | own row RM-1886 |
| R | ROADMAP:1899 | docs/ROADMAP.md:1899 | own row RM-1899 |
| R | ROADMAP:1907 | docs/ROADMAP.md:1907 | own row RM-1907 |
| R | ROADMAP:1912 | docs/ROADMAP.md:1912 | -> EN-CD-10 |
| R | ROADMAP:1921 | docs/ROADMAP.md:1921 | own row RM-1921 |
| R | ROADMAP:1924 | docs/ROADMAP.md:1924 | own row RM-1924 |
| R | ROADMAP:1925 | docs/ROADMAP.md:1925 | own row RM-1925 |
| R | ROADMAP:1934 | docs/ROADMAP.md:1934 | own row RM-1934 |
| R | ROADMAP:1938 | docs/ROADMAP.md:1938 | own row RM-1938 |
| R | ROADMAP:1940 | docs/ROADMAP.md:1940 | own row RM-1940 |
| R | ROADMAP:1971 | docs/ROADMAP.md:1971 | own row RM-1971 |
| R | ROADMAP:1976 | docs/ROADMAP.md:1976 | own row RM-1976 |
| R | ROADMAP:1979 | docs/ROADMAP.md:1979 | -> RM-1979 |
| R | ROADMAP:1983 | docs/ROADMAP.md:1983 | own row RM-1983 |
| R | ROADMAP:1991 | docs/ROADMAP.md:1991 | own row RM-1991 |
| R | ROADMAP:2007 | docs/ROADMAP.md:2007 | own row RM-2007 |
| R | ROADMAP:2013 | docs/ROADMAP.md:2013 | own row RM-2013 |
| R | ROADMAP:2018 | docs/ROADMAP.md:2018 | own row RM-2018 |
| R | ROADMAP:2025 | docs/ROADMAP.md:2025 | own row RM-2025 |
| R | ROADMAP:2097 | docs/ROADMAP.md:2097 | own row RM-2097 |
| R | ROADMAP:2101 | docs/ROADMAP.md:2101 | own row RM-2101 |
| R | ROADMAP:2109 | docs/ROADMAP.md:2109 | own row RM-2109 |
| R | ROADMAP:2122 | docs/ROADMAP.md:2122 | -> RM-2123 |
| R | ROADMAP:2123 | docs/ROADMAP.md:2123 | own row RM-2123 |
| R | ROADMAP:2124 | docs/ROADMAP.md:2124 | -> RM-2123 |
| R | ROADMAP:2126 | docs/ROADMAP.md:2126 | -> RM-2123 |
| R | ROADMAP:2143 | docs/ROADMAP.md:2143 | own row RM-2143 |
| R | ROADMAP:2146 | docs/ROADMAP.md:2146 | own row RM-2146 |
| R | ROADMAP:2255 | docs/ROADMAP.md:2255 | own row RM-2255 |
| R | ROADMAP:2263 | docs/ROADMAP.md:2263 | own row RM-2263 |
| R | ROADMAP:2278 | docs/ROADMAP.md:2278 | -> RT5-6 |
| R | ROADMAP:2289 | docs/ROADMAP.md:2289 | own row RM-2289 |
| R | ROADMAP:2299 | docs/ROADMAP.md:2299 | own row RM-2299 |
| R | ROADMAP:2322 | docs/ROADMAP.md:2322 | own row RM-2322 |
| R | ROADMAP:2324 | docs/ROADMAP.md:2324 | -> RM-2255 |
| R | ROADMAP:2327 | docs/ROADMAP.md:2327 | own row RM-2327 |
| R | ROADMAP:2329 | docs/ROADMAP.md:2329 | own row RM-2329 |
| R | ROADMAP:2543 | docs/ROADMAP.md:2543 | own row RM-2543 |
| R | ROADMAP:2544 | docs/ROADMAP.md:2544 | own row RM-2544 |
| N | EN-v2-1 | docs/ENGINEERING-NOTES.md:35 | own row EN-v2-1 |
| N | EN-v2-2 | docs/ENGINEERING-NOTES.md:36 | own row EN-v2-2 |
| N | EN-v2-3 | docs/ENGINEERING-NOTES.md:37 | own row EN-v2-3 |
| N | EN-v2-4 | docs/ENGINEERING-NOTES.md:38 | own row EN-v2-4 |
| N | EN-v2-5 | docs/ENGINEERING-NOTES.md:39 | own row EN-v2-5 |
| N | EN-v2-6 | docs/ENGINEERING-NOTES.md:40 | own row EN-v2-6 |
| N | EN-v2-7 | docs/ENGINEERING-NOTES.md:41 | -> EN-CD-16 |
| N | EN-v2-8 | docs/ENGINEERING-NOTES.md:42 | own row EN-v2-8 |
| N | EN-v2-9 | docs/ENGINEERING-NOTES.md:43 | -> F1 |
| N | EN-v2-10 | docs/ENGINEERING-NOTES.md:44 | -> EN-CD-8 |
| N | EN-v2-11 | docs/ENGINEERING-NOTES.md:45 | -> EN-CD-19 |
| N | EN-v2-12 | docs/ENGINEERING-NOTES.md:46 | own row EN-v2-12 |
| N | EN-v2-13 | docs/ENGINEERING-NOTES.md:47 | -> EN-CD-47 |
| N | EN-v2-14 | docs/ENGINEERING-NOTES.md:48 | -> EN-CD-31 |
| N | EN-v2-P1 | docs/ENGINEERING-NOTES.md:100 | own row EN-v2-P1 |
| N | EN-v2-P2 | docs/ENGINEERING-NOTES.md:102 | -> EN-CD-36 |
| N | EN-722-1 | docs/ENGINEERING-NOTES.md:55 | own row EN-722-1 |
| N | EN-722-2 | docs/ENGINEERING-NOTES.md:56 | own row EN-722-2 |
| N | EN-722-3 | docs/ENGINEERING-NOTES.md:57 | own row EN-722-3 |
| N | EN-722-4 | docs/ENGINEERING-NOTES.md:58 | own row EN-722-4 |
| N | EN-722-5 | docs/ENGINEERING-NOTES.md:59 | own row EN-722-5 |
| N | EN-722-6 | docs/ENGINEERING-NOTES.md:60 | own row EN-722-6 |
| N | EN-722-7 | docs/ENGINEERING-NOTES.md:61 | own row EN-722-7 |
| N | EN-722-8 | docs/ENGINEERING-NOTES.md:62 | own row EN-722-8 |
| N | EN-722-9 | docs/ENGINEERING-NOTES.md:63 | own row EN-722-9 |
| N | EN-722-10 | docs/ENGINEERING-NOTES.md:64 | own row EN-722-10 |
| N | EN-722-11 | docs/ENGINEERING-NOTES.md:65 | own row EN-722-11 |
| N | EN-722-12 | docs/ENGINEERING-NOTES.md:66 | own row EN-722-12 |
| N | EN-722-13 | docs/ENGINEERING-NOTES.md:67 | own row EN-722-13 |
| N | EN-722-14 | docs/ENGINEERING-NOTES.md:68 | own row EN-722-14 |
| N | EN-722-15 | docs/ENGINEERING-NOTES.md:69 | own row EN-722-15 |
| N | EN-722-16 | docs/ENGINEERING-NOTES.md:70 | own row EN-722-16 |
| N | EN-722-17 | docs/ENGINEERING-NOTES.md:71 | own row EN-722-17 |
| N | EN-722-18 | docs/ENGINEERING-NOTES.md:72 | own row EN-722-18 |
| N | EN-722-19 | docs/ENGINEERING-NOTES.md:73 | own row EN-722-19 |
| N | EN-722-20 | docs/ENGINEERING-NOTES.md:74 | own row EN-722-20 |
| N | EN-722-21 | docs/ENGINEERING-NOTES.md:75 | own row EN-722-21 |
| N | EN-722-22 | docs/ENGINEERING-NOTES.md:76 | own row EN-722-22 |
| N | EN-722-23 | docs/ENGINEERING-NOTES.md:77 | -> EN-CD-9 |
| N | EN-722-24 | docs/ENGINEERING-NOTES.md:78 | own row EN-722-24 |
| N | EN-722-25 | docs/ENGINEERING-NOTES.md:79 | own row EN-722-25 |
| N | EN-722-26 | docs/ENGINEERING-NOTES.md:80 | own row EN-722-26 |
| N | EN-722-27 | docs/ENGINEERING-NOTES.md:81 | own row EN-722-27 |
| N | EN-722-28 | docs/ENGINEERING-NOTES.md:82 | own row EN-722-28 |
| N | EN-722-29 | docs/ENGINEERING-NOTES.md:83 | -> EN-CD-7 |
| N | EN-74B-1 | docs/ENGINEERING-NOTES.md:93 | -> EN-CD-40 |
| N | EN-74B-2 | docs/ENGINEERING-NOTES.md:94 | -> EN-CD-41 |
| N | EN-74B-3 | docs/ENGINEERING-NOTES.md:95 | -> EN-CD-44 |
| N | EN-74B-4 | docs/ENGINEERING-NOTES.md:96 | -> EN-CD-42, EN-CD-43 |
| N | EN-74B-5 | docs/ENGINEERING-NOTES.md:97 | -> EN-CD-30 |
| N | EN-74B-6 | docs/ENGINEERING-NOTES.md:98 | -> EN-CD-3, EN-CD-4 |
| N | EN-SEC-1 | docs/ENGINEERING-NOTES.md:108 | own row EN-SEC-1 |
| N | EN-SEC-2 | docs/ENGINEERING-NOTES.md (section from line 106) | -> EN-CD-15 |
| N | EN-SEC-3 | docs/ENGINEERING-NOTES.md:122 | own row EN-SEC-3 |
| N | EN-SEC-4 | docs/ENGINEERING-NOTES.md (section from line 106) | own row EN-SEC-4 |
| N | EN-CD-5 | docs/CLOSE-OUT-PLAN.md:37 | own row EN-CD-5 |
| N | EN-CD-6 | docs/CLOSE-OUT-PLAN.md:38 | -> RT5-2, RM-2289 |
| N | EN-CD-9 | docs/CLOSE-OUT-PLAN.md:41 | own row EN-CD-9 |
| N | EN-CD-14 | docs/CLOSE-OUT-PLAN.md:46 | own row EN-CD-14 |
| N | EN-CD-15 | docs/CLOSE-OUT-PLAN.md:47 | own row EN-CD-15 |
| N | EN-CD-16 | docs/CLOSE-OUT-PLAN.md:48 | own row EN-CD-16 |
| N | EN-CD-20 | docs/CLOSE-OUT-PLAN.md:52 | own row EN-CD-20 |
| N | EN-CD-21 | docs/CLOSE-OUT-PLAN.md:53 | own row EN-CD-21 |
| N | EN-CD-24 | docs/CLOSE-OUT-PLAN.md:56 | own row EN-CD-24 |
| N | EN-CD-25 | docs/CLOSE-OUT-PLAN.md:57 | own row EN-CD-25 |
| N | EN-CD-26 | docs/CLOSE-OUT-PLAN.md:58 | own row EN-CD-26 |
| N | EN-CD-33 | docs/CLOSE-OUT-PLAN.md:64 | own row EN-CD-33 |
| N | EN-CD-34 | docs/CLOSE-OUT-PLAN.md:65 | own row EN-CD-34 |
| N | EN-CD-35 | docs/CLOSE-OUT-PLAN.md:66 | own row EN-CD-35 |
| N | EN-CD-36 | docs/CLOSE-OUT-PLAN.md:67 | own row EN-CD-36 |
| N | EN-CD-37 | docs/CLOSE-OUT-PLAN.md:68 | own row EN-CD-37 |
| N | EN-CD-43 | docs/CLOSE-OUT-PLAN.md:74 | own row EN-CD-43 |
| N | EN-CD-47 | docs/CLOSE-OUT-PLAN.md:78 | own row EN-CD-47 |
| N | EN-CD-3 | docs/CLOSE-OUT-PLAN.md:35 | own row EN-CD-3 |
| N | EN-CD-4 | docs/CLOSE-OUT-PLAN.md:36 | own row EN-CD-4 |
| N | EN-CD-7 | docs/CLOSE-OUT-PLAN.md:39 | own row EN-CD-7 |
| N | EN-CD-8 | docs/CLOSE-OUT-PLAN.md:40 | own row EN-CD-8 |
| N | EN-CD-10 | docs/CLOSE-OUT-PLAN.md:42 | own row EN-CD-10 |
| N | EN-CD-12 | docs/CLOSE-OUT-PLAN.md:44 | own row EN-CD-12 |
| N | EN-CD-19 | docs/CLOSE-OUT-PLAN.md:51 | own row EN-CD-19 |
| N | EN-CD-30 | docs/CLOSE-OUT-PLAN.md:61 | own row EN-CD-30 |
| N | EN-CD-31 | docs/CLOSE-OUT-PLAN.md:62 | own row EN-CD-31 |
| N | EN-CD-32 | docs/CLOSE-OUT-PLAN.md:63 | -> EN-v2-1, EN-v2-2, EN-v2-3, EN-v2-4, EN-v2-5, EN-v2-6, EN-v2-8, EN-CD-16, F1 |
| N | EN-CD-38 | docs/CLOSE-OUT-PLAN.md:69 | -> EN-722-1, EN-722-2, EN-722-3, EN-722-4, EN-722-5, EN-722-6, EN-722-7, EN-722-8, EN-722-9, EN-722-10, EN-722-11, EN-722-12, EN-722-13, EN-722-14, EN-722-15, EN-722-16, EN-722-17, EN-722-18, EN-722-19, EN-722-20, EN-722-21, EN-722-22, EN-722-24, EN-722-25, EN-722-26, EN-722-27, EN-722-28 |
| N | EN-CD-40 | docs/CLOSE-OUT-PLAN.md:71 | own row EN-CD-40 |
| N | EN-CD-41 | docs/CLOSE-OUT-PLAN.md:72 | own row EN-CD-41 |
| N | EN-CD-42 | docs/CLOSE-OUT-PLAN.md:73 | own row EN-CD-42 |
| N | EN-CD-44 | docs/CLOSE-OUT-PLAN.md:75 | own row EN-CD-44 |
| N | EN-CD-45 | docs/CLOSE-OUT-PLAN.md:76 | own row EN-CD-45 |
| N | CO-1 | docs/CLOSE-OUT-PLAN.md:33 | own row CO-1 |
| N | CO-2 | docs/CLOSE-OUT-PLAN.md:34 | own row CO-2 |
| N | CO-3 | docs/CLOSE-OUT-PLAN.md:35 | -> EN-CD-3 |
| N | CO-4 | docs/CLOSE-OUT-PLAN.md:36 | -> EN-CD-4 |
| N | CO-5 | docs/CLOSE-OUT-PLAN.md:37 | -> EN-CD-5 |
| N | CO-6 | docs/CLOSE-OUT-PLAN.md:38 | -> RT5-2, RM-2289 |
| N | CO-7 | docs/CLOSE-OUT-PLAN.md:39 | -> EN-CD-7 |
| N | CO-8 | docs/CLOSE-OUT-PLAN.md:40 | -> EN-CD-8 |
| N | CO-9 | docs/CLOSE-OUT-PLAN.md:41 | -> EN-CD-9 |
| N | CO-10 | docs/CLOSE-OUT-PLAN.md:42 | -> EN-CD-10 |
| N | CO-11 | docs/CLOSE-OUT-PLAN.md:43 | own row CO-11 |
| N | CO-12 | docs/CLOSE-OUT-PLAN.md:44 | -> EN-CD-12 |
| N | CO-13 | docs/CLOSE-OUT-PLAN.md:45 | own row CO-13 |
| N | CO-14 | docs/CLOSE-OUT-PLAN.md:46 | -> EN-CD-14 |
| N | CO-15 | docs/CLOSE-OUT-PLAN.md:47 | -> EN-CD-15 |
| N | CO-16 | docs/CLOSE-OUT-PLAN.md:48 | -> EN-CD-16 |
| N | CO-17 | docs/CLOSE-OUT-PLAN.md:49 | own row CO-17 |
| N | CO-18 | docs/CLOSE-OUT-PLAN.md:50 | own row CO-18 |
| N | CO-19 | docs/CLOSE-OUT-PLAN.md:51 | -> EN-CD-19 |
| N | CO-20 | docs/CLOSE-OUT-PLAN.md:52 | -> EN-CD-20 |
| N | CO-21 | docs/CLOSE-OUT-PLAN.md:53 | -> EN-CD-21 |
| N | CO-22 | docs/CLOSE-OUT-PLAN.md:54 | own row CO-22 |
| N | CO-23 | docs/CLOSE-OUT-PLAN.md:55 | own row CO-23 |
| N | CO-24 | docs/CLOSE-OUT-PLAN.md:56 | -> EN-CD-24 |
| N | CO-25 | docs/CLOSE-OUT-PLAN.md:57 | -> EN-CD-25 |
| N | CO-26 | docs/CLOSE-OUT-PLAN.md:58 | -> EN-CD-26 |
| N | CO-27 | docs/CLOSE-OUT-PLAN.md:59 | own row CO-27 |
| N | CO-28 | docs/CLOSE-OUT-PLAN.md:60 | own row CO-28 |
| N | CO-30 | docs/CLOSE-OUT-PLAN.md:61 | -> EN-CD-30 |
| N | CO-31 | docs/CLOSE-OUT-PLAN.md:62 | -> EN-CD-31 |
| N | CO-32 | docs/CLOSE-OUT-PLAN.md:63 | -> EN-v2-1, EN-v2-2, EN-v2-3, EN-v2-4, EN-v2-5, EN-v2-6, EN-v2-8, EN-CD-16, F1 |
| N | CO-33 | docs/CLOSE-OUT-PLAN.md:64 | -> EN-CD-33 |
| N | CO-34 | docs/CLOSE-OUT-PLAN.md:65 | -> EN-CD-34 |
| N | CO-35 | docs/CLOSE-OUT-PLAN.md:66 | -> EN-CD-35 |
| N | CO-36 | docs/CLOSE-OUT-PLAN.md:67 | -> EN-CD-36 |
| N | CO-37 | docs/CLOSE-OUT-PLAN.md:68 | -> EN-CD-37 |
| N | CO-38 | docs/CLOSE-OUT-PLAN.md:69 | -> EN-722-1, EN-722-2, EN-722-3, EN-722-4, EN-722-5, EN-722-6, EN-722-7, EN-722-8, EN-722-9, EN-722-10, EN-722-11, EN-722-12, EN-722-13, EN-722-14, EN-722-15, EN-722-16, EN-722-17, EN-722-18, EN-722-19, EN-722-20, EN-722-21, EN-722-22, EN-722-24, EN-722-25, EN-722-26, EN-722-27, EN-722-28 |
| N | CO-39 | docs/CLOSE-OUT-PLAN.md:70 | own row CO-39 |
| N | CO-40 | docs/CLOSE-OUT-PLAN.md:71 | -> EN-CD-40 |
| N | CO-41 | docs/CLOSE-OUT-PLAN.md:72 | -> EN-CD-41 |
| N | CO-42 | docs/CLOSE-OUT-PLAN.md:73 | -> EN-CD-42 |
| N | CO-43 | docs/CLOSE-OUT-PLAN.md:74 | -> EN-CD-43 |
| N | CO-44 | docs/CLOSE-OUT-PLAN.md:75 | -> EN-CD-44 |
| N | CO-45 | docs/CLOSE-OUT-PLAN.md:76 | -> EN-CD-45 |
| N | CO-46 | docs/CLOSE-OUT-PLAN.md:77 | own row CO-46 |
| N | CO-47 | docs/CLOSE-OUT-PLAN.md:78 | -> EN-CD-47 |
| N | CO-48 | docs/CLOSE-OUT-PLAN.md:79 | own row CO-48 |
| N | CO-49 | docs/CLOSE-OUT-PLAN.md:80 | own row CO-49 |
| N | CO-50 | docs/CLOSE-OUT-PLAN.md:81 | own row CO-50 |
| N | CO-51 | docs/CLOSE-OUT-PLAN.md:82 | -> EN-v2-12 |
| N | CO-52 | docs/CLOSE-OUT-PLAN.md:83 | own row CO-52 |
| N | CO-53 | docs/CLOSE-OUT-PLAN.md:84 | own row CO-53 |
| N | CO-54 | docs/CLOSE-OUT-PLAN.md:85 | own row CO-54 |
| N | CO-55 | docs/CLOSE-OUT-PLAN.md:86 | own row CO-55 |
| N | CO-56 | docs/CLOSE-OUT-PLAN.md:87 | own row CO-56 |
| N | CO-57 | docs/CLOSE-OUT-PLAN.md:88 | own row CO-57 |
| N | CO-58 | docs/CLOSE-OUT-PLAN.md:89 | own row CO-58 |
| N | SG-11 | docs/ROADMAP.md:2197 | -> RT5-2, RM-2289 |
| N | SG-12 | docs/ROADMAP.md:2198 | own row SG-12 |
| N | SG-13 | docs/ROADMAP.md:2199 | own row SG-13 |
| N | SG-14 | docs/ROADMAP.md:2200 | own row SG-14 |
| N | SG-15 | docs/ROADMAP.md:2201 | own row SG-15 |
| N | SG-16 | docs/ROADMAP.md:2202 | own row SG-16 |
| N | SG-17 | docs/ROADMAP.md:2203 | -> EN-CD-40 |
| N | SG-18 | docs/ROADMAP.md:2204 | -> EN-CD-33 |
| N | SG-19 | docs/ROADMAP.md:2205 | own row SG-19 |
| N | SG-20 | docs/ROADMAP.md:2206 | -> EN-CD-45 |
| N | SG-21 | docs/ROADMAP.md:2207 | own row SG-21 |
| N | PP-1a | docs/CLOSE-OUT-PLAN.md:978 | -> SPEND |
| N | PP-1b | docs/CLOSE-OUT-PLAN.md:978 | own row PP-1b |
| N | PP-1c | docs/CLOSE-OUT-PLAN.md:992 | -> CO-RL-2 |
| N | PP-2a | docs/CLOSE-OUT-PLAN.md:979 | own row PP-2a |
| N | PP-2b | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row PP-2b |
| N | PP-3a | docs/CLOSE-OUT-PLAN.md:1009 | -> RT5-3, F7, H5 |
| N | PP-3b | docs/CLOSE-OUT-PLAN.md:980 | own row PP-3b |
| N | PP-4 | docs/CLOSE-OUT-PLAN.md:1006 | own row PP-4 |
| N | PP-5 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | -> EDGE-RL |
| N | PP-6 | docs/CLOSE-OUT-PLAN.md:983 | own row PP-6 |
| N | PP-O1 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row PP-O1 |
| N | PP-O2 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row PP-O2 |
| N | PP-O3 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row PP-O3 |
| N | PP-O4 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row PP-O4 |
| N | PP-O5 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | -> CO-RL-2 |
| N | CO-RL-1 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | -> RT5-3, F7, H5 |
| N | CO-RL-2 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row CO-RL-2 |
| N | CO-RL-3 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row CO-RL-3 |
| N | CO-FD-1 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | -> EDGE-RL |
| N | CO-FD-2 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row CO-FD-2 |
| N | CO-FD-3 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row CO-FD-3 |
| N | CO-L2 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | -> EDGE-RL |
| N | CO-L3e-2 | docs/CLOSE-OUT-PLAN.md (Pre-post live check / FINAL, from line 963) | own row CO-L3e-2 |
| N | RM-HL-1 | README.md:173 | own row RM-HL-1 |
| N | RM-HL-2 | README.md:174 | -> EN-CD-36 |
| N | RM-HL-3 | README.md:176 | -> RT5-8 |
| N | RM-HL-4 | README.md:180 | -> RT5-1 |
| N | RM-HL-5 | README.md:182 | own row RM-HL-5 |
| N | RM-HL-6 | README.md:183 | -> RT5-7, F5, F3 |
| N | RM-HL-7 | README.md:200 | -> EN-CD-35 |
| N | RM-NB-1 | README.md (Honest limits / Not built yet, from line 165) | -> EN-CD-35 |
| N | RM-NB-2 | README.md (Honest limits / Not built yet, from line 165) | -> EN-CD-34 |
| N | RM-NB-3 | README.md (Honest limits / Not built yet, from line 165) | -> EN-CD-36 |
| N | RM-X1 | README.md (Honest limits / Not built yet, from line 165) | own row RM-X1 |
| N | RM-X2 | README.md (Honest limits / Not built yet, from line 165) | -> F4 |
| P | §5-1 | CHAIRSIDE-REDTEAM-REPORT.md:313 | own row RT5-1 |
| P | §5-2 | CHAIRSIDE-REDTEAM-REPORT.md:314 | own row RT5-2 |
| P | §5-3 | CHAIRSIDE-REDTEAM-REPORT.md:315 | own row RT5-3 |
| P | §5-4 | CHAIRSIDE-REDTEAM-REPORT.md:316 | -> SPEND |
| P | §5-5 | CHAIRSIDE-REDTEAM-REPORT.md §5-5 | -> EDGE-RL |
| P | §5-6 | CHAIRSIDE-REDTEAM-REPORT.md:318 | -> RT5-6 |
| P | §5-7 | CHAIRSIDE-REDTEAM-REPORT.md:319 | own row RT5-7 |
| P | §5-8 | CHAIRSIDE-REDTEAM-REPORT.md:320 | own row RT5-8 |
| P | §5-9 | CHAIRSIDE-REDTEAM-REPORT.md:321 | -> EN-CD-8 |
| P | §5-10 | CHAIRSIDE-REDTEAM-REPORT.md:322 | own row RT5-10 |
| P | §5-11 | CHAIRSIDE-REDTEAM-REPORT.md:323 | -> RM-1979 |
| P | §4-a | CHAIRSIDE-REDTEAM-REPORT.md:300 | own row RT4-a |
| P | §4-b | CHAIRSIDE-REDTEAM-REPORT.md:301 | own row RT4-b |
| P | §4-c | CHAIRSIDE-REDTEAM-REPORT.md:303 | own row RT4-c |
| P | A1-a | a1-probe.log (A1-a) | -> EDGE-RL |
| P | A1-b | a1-probe.log (A1-b) | own row A1-b |
| P | A1-c | a1-probe.log (A1-c) | own row A1-c |

Findings and extras:

| input | maps to |
|---|---|
| F1 (results/F1.json via results-F1-F2.json) | F1 |
| F2 (results/F2.json via results-F1-F2.json) | F2 |
| F3 (results/F3.json) | F3 |
| F4 (results/F4.json) | F4 |
| F5 (results/F5.json) | F5 |
| F6 (results/F6.json) | F6 |
| F7 (results/F7.json) | F7 |
| SPEND (results/SPEND.json) | SPEND |
| H3 (results/H3.json) | H3 |
| H4 (results/H4.json) | H4 |
| H5 (results/H5.json) | H5 |
| H6 (results/H6.json) | H6 |
| F2 side note (DELETE grant) | X1 |
| SPEND extra (timeout records no spend) | SPEND-b |
| F1/F2 extra (next-upcoming wording) | D-F2 |
| F3 extra (jailbreak-cases:20, prompt/regex drift) | D-F3 |
| F4 extra (guard-trip wording) | D-F4 |
| SPEND fix wording (DATA-MODEL:86-88) | D-SP |
| F7 extra (MIGRATION-PLAN #11) | D-F7 |
| H5 Reminders half | H5b |

Locator coverage (best-effort text match for notes/README refs): 263 exact file:line, 23 section anchor only.
