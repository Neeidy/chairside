# HARDENING B2 — Codex prompt (pass 1 of at most 2)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
Nothing else is sent. It audits the hardening B1 edits (docs/hardening/PLAN.md, docs/hardening/register.md, and the
2026-11-18 rows of docs/ARCHITECTURE-DECISIONS.md) at their staging head.

**How the run is made:** `docs/codex/hardening/run.sh` — the CLOSE-OUT runner (`docs/codex/close-out/run.sh`) with this
file's path in place of its prompt path and its header comments rewritten (`diff` shows it).

<!-- prompt -->
You are auditing staged and offline edits in a public repository: an n8n-based salon booking chatbot (the engine is
exported n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings), its Next.js demo site and
embeddable widget, and its owner dashboard. Your working directory is a writable copy of the repository at commit {PIN},
with the git history of `main` up to it and the dependencies installed from the committed lockfiles. You may run the
repository's own tests and offline commands there; anything you change in the copy is discarded and is not a fix.

WHY THESE EDITS EXIST — `CHAIRSIDE-REDTEAM-REPORT.md` (a red-team report; findings F1–F7 and hypotheses H3–H6) and
`docs/hardening/register.md` (every open item, its class and the ruling on it). The plan is `docs/hardening/PLAN.md`; the
rulings are the four 2026-11-18 rows of `docs/ARCHITECTURE-DECISIONS.md` (K1–K14, the K3 location, S5, the K5 reversal and
four accepted deviations). The commits are `git log --oneline bb3f64b..{PIN}`. Surfaces:
- MAIN (staged `n8n/staged/workflow.main.sanitized.json` vs the committed `n8n/workflow.main.sanitized.json`; delta
  `n8n/staged/workflow.main.delta.json`; `scripts/diff-workflow-copy.py` APPROVED_DELTAS, the last `main` entry):
  `Read Pending Answer` (a deterministic clear-yes test at the three confirms; RM-1979's next-turn rewrite),
  `Abort Cancel?` / `Abort Reschedule?`, `Classify Confirm Reply` + `Route Consent` (booking re-ask, second strike →
  handoff), `Booking Fresh?` / `Reschedule Fresh?` (slot in the future), `Merge State` (control-character strip, one-line
  history, session reset of `turn_count` / `confirm_turn`, `gcal_event_id` carried), `Empty Message?`, `Resolve Date`
  (`time` normalised, `dateExpr` capped at 60), `Merge Slots` (`time_dropped`), the three booking lookups
  (`end_utc > $2`) and their JS twins, `Cancel Lookup` ("which one?"), `Reschedule Lookup`, `Build Owner Alert`
  (`handoff_alert_class`, prune, `oneLine`, inbound fallback, no raw slots), `Tag Date Resolver Failed`, `Check Processed`
  (`channel:message_id`), `Record LLM Spend` (SQL increment), `Build Clarify State` (RM-2007). Tests:
  `tests/unit/hardening-main.test.cjs`, `tests/unit/hardening-main-mutants.py`, `tests/db/booking-lookup.test.sh`,
  `tests/db/spend-meter.test.sh`, `tests/db/claim-race.test.sh` (Docker: you may not be able to run these three; read them).
- OWNER ACTIONS (staged `n8n/staged/workflow.owner-actions.sanitized.json`): the release also resets `turn_count` and
  `confirm_turn`; `Validate Release Target`'s 30-day bound is removed (ruling S5). Tests: `tests/unit/hardening-owner.test.cjs`
  and its mutants.
- TOOLING: `scripts/secret-scan.sh` (two new identifier rules, a phone rule judged on patch lines only, 13 history
  fingerprints in `scripts/secret-scan-ignore`), `scripts/check-cancel-validation-parity.py`, `scripts/check-content-parity.py`
  (three execution flags), `scripts/check-client-imports.cjs` (sentinels), `web/site/scripts/build-config.mjs --check`.
- WIDGET (`web/snippet`): brand colours from `config.branding` (`branding.mjs`), the double-insert guard's mount marker.
- DASHBOARD (`web/dashboard`): `maskedOrWithheld`, the shop config checked inside `page.tsx`'s try, `.env.example`,
  the `types.ts` ↔ schema drift test.

Answer each, with evidence (the code at {PIN}, or an offline command you ran and what it showed). Put every finding under
its SURFACE heading and give it HIGH / MEDIUM / LOW:
1. MAIN, CRT #2 / #8 / #1b (`.claude/rules/booking-integrity.md`, `handoff.md` as corrected at {PIN}): can any route
   still book, cancel or move on a turn whose TEXT is not a clear yes — including a model `confirm` on a question, a
   correction, a second line, a non-ASCII look-alike, or a long string? Can a genuine clear yes be refused at the
   three confirms in a way the register does not state? Does the booking re-ask through `Slot Gate` re-stamp the confirm,
   reach any write, or loop? Does the second strike hand off with an owner alert every time? Can the RM-1979 rewrite turn
   a turn that is NOT the answer to our reschedule question into a reschedule?
2. MAIN, CRT #8 / #12 (targets and time): can a booking that has ended be cancelled or moved, or an in-progress one be
   missed? Can "which one?" lock the customer or pick a booking the customer did not name? Can a yes book or move to a slot
   that has started? Can the model's raw `time` reach state, a prompt, a Calendar request or an alert after `Resolve Date`
   (the K3 claim)? Does `time_dropped` or the 60-character `dateExpr` cap break the date ladder (D-4, `date_reask`)?
3. MAIN, CRT #15 / spend: with the session reset, is there a loop that runs paid turns without bound inside one session or
   across sessions faster than the register states? Is the SQL increment safe with this node's settings (retries,
   `alwaysOutputData`), and does any reader still treat the meter as an absolute value?
4. MAIN, CRT #5 / #6 (visible failures): does every branch that writes `stage = 'handoff'` now alert the owner exactly once
   (the seven the red-team named, and any other)? Can `Build Owner Alert` throw (and stop the reply) on any input shape,
   and does the prune or `oneLine` drop or merge an alert that should be sent? Does the empty-message exit or the
   control-character strip hide a message the engine should have answered or alerted on?
5. MAIN, CRT #1a: does the `channel:message_id` claim key change idempotency for any reader of
   `salon.processed_messages` (Owner Actions' marker, Drill State, Purge), or allow one delivery to be processed twice?
6. OWNER ACTIONS, CRT #11: with the 30-day bound removed, what can a holder of a valid signed request now do that it could
   not before? Is the version token still the only key to the write, and is the future-timestamp refusal intact?
7. TOOLING: can a real secret or a real phone number now pass `secret-scan.sh` in a pushed patch, commit message or tag
   that the comments say is caught? Do the parity changes accept a drift they should refuse (for example one
   `Fresh?` node changed alone)? Can `build-config.mjs --check` pass a stale or hand-edited file?
8. WIDGET, CRT #13 / DASHBOARD, CRT #9: can a `config.branding` value inject CSS into the host page? Can the mount marker
   produce two widgets or none? Does any dashboard change expose more PII or a fuller sender key than at bb3f64b?
9. TESTS: for each guard above, does a test fail when the guard is broken? Name any assertion that cannot go red (the test
   files state which ones are guards of the fix rather than defect tests — check that claim).
Do not report style. If you find nothing in a surface, say so for that surface.
