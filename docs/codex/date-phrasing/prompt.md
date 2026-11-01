# DATE-PHRASING R1 — Codex prompt (CRT #12 re-opened, and the gate edits)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
Nothing else is sent. It audits the DATE-PHRASING R1 edit (docs/DATE-PHRASING-PLAN.md §7) at its R1 head.

**How the run is made:** `docs/codex/date-phrasing/run.sh` — the NAME-CAPTURE R3 runner
(`docs/codex/name-capture/run-r3.sh`) with this file's path in place of its prompt path and its header comments
rewritten (`diff` shows it).

<!-- prompt -->
You are auditing a staged engine edit in a public repository: an n8n-based salon booking chatbot (the engine is exported
n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy
of the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the
committed lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy
is discarded and is not a fix.

THE EDIT — `docs/DATE-PHRASING-PLAN.md` (read it in full: §0–§13, then "R1"). The staged export is
`n8n/staged/workflow.main.sanitized.json`; the committed (live) export is `n8n/workflow.main.sanitized.json`; the delta
file is `n8n/staged/workflow.main.delta.json`. The change: the `Resolve Date` node parses explicit calendar dates
("4 november", "wednesday 4 november", "4.11", "4/11"), applies a booking horizon to every resolved date (A1), reads
"this <weekday>" on a Sunday as the coming week (D-5) and hands off on a second consecutive dropped date (D-4); `Slot Gate`
picks the re-ask text by the reason; `Load Config` gains two config keys and six templates through "gate edits" of the
deploy tool, whose check (`scripts/diff-workflow-copy.py`, `gate_edit_errs`, `parse_delta`, `APPROVED_DELTAS`) was
extended in this round to accept a key added INLINE inside a one-line object and an integer value. The commits are
`git log --oneline 75c6165..{PIN}`.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Booking integrity — can any explicit-date form produce a date the customer did not name (a wrong-day booking)? Consider
   day/month order, the dot and slash rules and `business.dateOrder`, the year rule (given / not given / rolled to next
   year), leap days, year-end, the shop timezone (Europe/Vienna) against UTC, the weekday check, and the interaction with
   the existing rules (`occursIn` provenance, `week_ambiguous`, `llm_date_ignored`, `echo_of_validated_slot`, Merge Slots'
   handling of a dropped date).
2. Can the model's own output steer the result — its `date`, a `dateExpr` that trims or reorders the customer's words
   (a year, a weekday, a number left out), or text outside the customer's message? Are the two text checks
   (`calendar_clipped`, the weekday written before the date) correct and sufficient, and can they refuse ordinary
   wording?
3. A1 and D-5: does the horizon apply to EVERY resolved date (ISO, today/tomorrow, weekdays, calendar dates) and only
   refuse, never move? Is D-5 exactly "on a Sunday in the shop timezone, the prefix form `this <weekday>` → the coming
   week", every other anchored case unchanged?
4. D-4 and the re-asks: does every refusal reach a re-ask or the handoff (never a silent drop, never a loop without the
   forms named)? Is the two-strike marker free of collisions with the `name_reask` / `clarify` / `invalid` ladders, and
   is the handoff route the existing one with an owner alert? Are the re-ask texts filled only from the node's own
   values?
5. The deploy tool's extended gate-edit check: can a staged Load Config pass it while changing anything beyond exactly
   the approved keys and values (another value on the same line, a key in another object, a comment, a duplicate, a
   reordered line, a value of another type)? Is the approved entry exactly the plan's eight keys?
6. Tests: would they stay green if a property above were broken — a test that cannot fail, a mutant that should exist
   and does not (`tests/unit/date-phrasing.test.cjs`, `tests/unit/chat-replay.test.cjs` and its library,
   `tests/unit/date-phrasing-mutants.py`, `scripts/diff-workflow-copy.py --selftest`)? Is what the plan's "R1" section
   states accurate?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds and declared choices: an item the repository records as an accepted bound or a declared choice with
  its reason is not a finding unless its stated scope is wrong or it breaks booking integrity; if so, say so with
  evidence.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
