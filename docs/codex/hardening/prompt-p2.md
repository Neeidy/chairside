# HARDENING B2 — Codex prompt, pass 2 (the last by the cap)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
Pass 1 (pin `20acf85`) reported itself INCOMPLETE and raised one HIGH, two MEDIUM and one LOW, all fixed at {PIN}. This
pass rechecks those fixes AND completes the surfaces pass 1 named as not finished. **How the run is made:**
`docs/codex/hardening/run-p2.sh` — the pass-1 runner with this file's path in place of its prompt path and its header
comments rewritten.

<!-- prompt -->
You are auditing fixes and staged edits in a public repository: an n8n-based salon booking chatbot (the engine is
exported n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings), its demo site and widget, and its
owner dashboard. Your working directory is a writable copy of the repository at commit {PIN}, with the git history of
`main` up to it and the dependencies installed from the committed lockfiles. You may run the repository's own tests and
offline commands; anything you change is discarded and is not a fix. Take the time the questions need: the previous pass
stopped early and said so — an incomplete answer must say which question it did not finish.

Context: `docs/hardening/PLAN.md` (read its "AS BUILT" section first), `docs/hardening/register.md`, the 2026-11-18 rows of
`docs/ARCHITECTURE-DECISIONS.md`, `CHAIRSIDE-REDTEAM-REPORT.md`. Commits: `git log --oneline bb3f64b..{PIN}`; the pass-1
fixes are `git log --oneline 20acf85..{PIN}`. The staged engine is `n8n/staged/workflow.main.sanitized.json` and
`n8n/staged/workflow.owner-actions.sanitized.json` (vs the committed `n8n/workflow.*.sanitized.json`).

PART A — the pass-1 findings, each: CLOSED / NOT CLOSED, with evidence.
1. HIGH: `Read Pending Answer` now refuses consent when the ORIGINAL text (`Normalize Inbound`) holds a control character.
   Can any other transformation between the customer's text and the consent test (trimming, whitespace collapsing, the
   one-line fold, Unicode look-alikes, a zero-width or format character, an RTL mark) still turn a non-yes into a yes?
2. MEDIUM: `Merge State` drops the `reschedule_ask` marker on a new session. Can the RM-1979 rewrite still fire on a turn
   that does not answer our reschedule question (same session, an unrelated booking request)?
3. MEDIUM: `Cancel Lookup` splits same-day bookings by the named time and asks for day and time. Can it still loop, or
   pick a booking the customer did not name?
4. LOW: `Build Owner Alert` type-checks `recent_messages`. Is any other value it reads able to throw on a non-string?

PART B — complete what pass 1 did not (each a heading; give HIGH / MEDIUM / LOW findings or "none found" with evidence):
5. MAIN alerts (CRT #5/#6): does every branch that writes `stage = 'handoff'` alert the owner exactly once? (The D3 test
   in `tests/unit/hardening-main.test.cjs` names its rule — check that rule and its named exceptions.) Can
   `Build Owner Alert` or `Alert Context` throw on any reachable input?
6. MAIN idempotency (CRT #1a): the `channel:message_id` claim key against every reader and writer of
   `salon.processed_messages` (Owner Actions, Drill State, Purge, `scripts/seed-workflow.py`, `tests/run-d11.sh`).
7. MAIN spend (CRT #15): the SQL increment with the node's settings; any reader that still treats the meter as an
   absolute value; any paid-turn loop inside one session or across sessions faster than the register states.
8. MAIN dates (CRT #12): `time_dropped`, the 60-character `dateExpr` cap and the D-4 `date_reask` ladder together.
9. TOOLING: can a real secret or phone number pass `scripts/secret-scan.sh` in a pushed patch where the comments say it
   is caught? Do the parity guards accept a drift they should refuse?
10. WIDGET mount marker (CRT #13) and DASHBOARD (CRT #9): two widgets or none; any PII or sender key exposed beyond
    bb3f64b.
11. TESTS: for each guard above, does a test fail when the guard is broken? Run `python3 tests/unit/hardening-main-mutants.py`
    and `python3 tests/unit/hardening-owner-mutants.py` if time allows and report survivors; name any assertion that
    cannot go red.
Do not report style. Put every finding under its numbered heading.
