# CLOSE-OUT R2 — Codex prompt (pass 1 of at most 2 per surface)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
Nothing else is sent. It audits the CLOSE-OUT R1 edits (docs/CLOSE-OUT-PLAN.md §3, §8, "R1") at their R1 head.

**How the run is made:** `docs/codex/close-out/run.sh` — the N1 runner (`docs/codex/n1/run.sh`) with this file's path in
place of its prompt path and its header comments rewritten (`diff` shows it).

<!-- prompt -->
You are auditing staged and offline edits in a public repository: an n8n-based salon booking chatbot (the engine is
exported n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings), its Next.js demo site and
embeddable widget, and its owner dashboard. Your working directory is a writable copy of the repository at commit {PIN},
with the git history of `main` up to it and the dependencies installed from the committed lockfiles. You may run the
repository's own tests and offline commands there; anything you change in the copy is discarded and is not a fix.

THE EDITS — read `docs/CLOSE-OUT-PLAN.md` in full (§0–§13, then "R1": the rulings asked and answered in R1 and seven
declared deviations). The commits are `git log --oneline 5d8dacf..{PIN}`. Surfaces:
- MAIN (staged: `n8n/staged/workflow.main.sanitized.json` vs the committed `n8n/workflow.main.sanitized.json`; delta
  `n8n/staged/workflow.main.delta.json`; `scripts/diff-workflow-copy.py` APPROVED_DELTAS): M1 in `Resolve Date` — at a
  pending confirm the owner ping for a model date equal to the STORED date with no `dateExpr` is withheld, the date still
  drops; M2 — `Compute Availability` stamps `confirm_turn = String(turn_count + 1)` on stage `confirming`, a new IF
  `Booking Fresh?` on `Reschedule Router`'s false output (stage `confirming` only; the expression of `Confirm Fresh?`)
  sends a fresh "yes" to `Build Event Request` and a stale one back to `Slot Gate` (availability re-read, confirm asked
  again, nothing written). Tests: `tests/unit/close-out-main.test.cjs`, `tests/unit/close-out-main-mutants.py`.
- PURGE (staged `n8n/staged/workflow.purge.sanitized.json`): P1 — `Purge Error (leads)` drops a `no_candidates`
  refusal; P2 — two comments. Test: `tests/unit/close-out-purge.test.cjs`.
- SITE + SNIPPET (`web/site`, `web/snippet`, `web/shared`): S1 — Turnstile `retry: 'never'` on both render sites (our
  own two retries remain); S2 — message times formatted in the config's `business.timezone`, the zone named once.
  Drills under `tests/browser/`.
- DASHBOARD (`web/dashboard`): D1 — the handoff queue's "re-masked" counter counts only a stored `sender_masked` the
  column's own formula could not produce; the DISPLAY is unchanged by ruling. D2 — the "Today" block counts only today's
  rows (shop timezone).
- OPS: G1 — `scripts/start-gates.sh` refuses inside the Vienna minutes :55–:05 (`scripts/vienna-window.py`).

Answer each, with evidence (the code at {PIN}, or an offline command you ran and what it showed). Put every finding
under its SURFACE heading and give it HIGH / MEDIUM / LOW:
1. MAIN, CRT #1b / #2 (booking integrity; `.claude/rules/booking-integrity.md`): can any route now write a booking
   (Book Appointment / Write Appointment) without a "yes" on the turn right after the confirm ask it answers? Can a
   genuinely fresh "yes" be judged stale (the stamp's turn arithmetic, a stamp written by another path, a re-ask that
   does not re-stamp)? Does the stale branch through `Slot Gate` reach any write, lose or alter a stored slot, or loop?
   What happens to a `confirming` row saved before this edit, to N1's decline paths, and to the cancel and reschedule
   confirms (their own `Confirm Fresh?` / `Reschedule Fresh?`)?
2. MAIN, CRT #12 / #5 (dates; handoff ladder): can M1's withheld ping hide a case where a wrong date is written or a
   handoff is skipped? Is `echoAtPendingConfirm` ever true outside a pending confirm, or for a date that differs from
   the stored one? Does M2 change the uncertainty ladder (`Confirm Pending & Uncertain?`, `Extraction Transient?`'s stage
   list and its drift test) in a way `.claude/rules/handoff.md` (as corrected at {PIN}) does not describe?
3. PURGE: can P1 silence a real fault (an error item, a capped run, an unreadable shape, no retention configured)?
4. SITE + SNIPPET, CRT #13: with `retry: 'never'`, is there a transient Turnstile failure from which the widget no longer
   recovers on its own, or a path where the visitor is told to reload when a token could still be obtained? For S2: DST,
   an unknown zone, and whether any runtime fetch or new external request was added.
5. DASHBOARD, CRT #9: does D1 or D2 expose any more of a sender key or of PII than at 5d8dacf? Is the counter right for
   both lanes? Is D2's day boundary right across DST?
6. OPS G1: can the window check misfire (DST, the zone, the boundary minutes) or be bypassed by the gate script itself?
7. TESTS: for each guard above, does a test fail when the guard is broken? Name any assertion that cannot go red, and say
   whether the "equivalent mutant" in `tests/unit/close-out-main-mutants.py` is truly equivalent.
Do not report style. If you find nothing in a surface, say so for that surface.
