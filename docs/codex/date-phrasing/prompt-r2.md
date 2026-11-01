# DATE-PHRASING R2 — Codex RECHECK prompt (the fixes for the R1 findings)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks the fixes for Codex R1's answer (`docs/codex/date-phrasing/r1.md`).

**How the run is made:** `docs/codex/date-phrasing/run-r2.sh` — the R1 runner with this file's path in place of its prompt
path and its header comments rewritten (`diff` against `docs/codex/date-phrasing/run.sh` shows it).

<!-- prompt -->
You are re-checking fixes in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n workflow
JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of the
repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) parses explicit calendar dates: `docs/DATE-PHRASING-PLAN.md` (read §0–
§13, "R1" and "R2"). An earlier audit of it, at commit `120ee52`, is committed verbatim as `docs/codex/date-phrasing/r1.md`.
It found: HIGH-1 (a weekday-only extraction bypassed the explicit date and its year; a weekday not right before the date
was not seen), HIGH-2 (an empty extraction naming a calendar date inherited the stored date), MEDIUM-3 (year "0000" read
as no year), MEDIUM-4 (a compact time read as a trimmed year), MEDIUM-5 (the shop timezone, the horizon on relative days
and the handoff route were untested), and a note that a dropped date with no known service struck D-4 while the customer
was asked the service. The fixes are the commits after `120ee52` up to {PIN} (`git log --oneline 120ee52..HEAD`):
`n8n/staged/workflow.main.sanitized.json` (`Resolve Date`), `tests/unit/date-phrasing.test.cjs`,
`tests/unit/chat-replay.test.cjs`, `tests/unit/date-phrasing-mutants.py`, and the plan's "R2" section.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Are HIGH-1 and HIGH-2 closed? Can any path still book a date other than the full date the customer wrote — a
   weekday, today/tomorrow or an ISO expression next to a written calendar date; a weekday elsewhere in the message; an
   empty or partial extraction while a date is stored; the confirm and reschedule lanes? Check the bounds and costs the
   R2 section states (the "<month> N of" exemption, the dot-pair rule) and say whether they are stated correctly.
2. Are MEDIUM-3, MEDIUM-4 and MEDIUM-5 closed, and the D-4 note? Does any fix refuse ordinary wording the R2 section
   does not state as a cost?
3. Did the fixes change anything beyond these targets (the staged export against `120ee52`'s), and would the tests stay
   green if a fixed property were broken (a test that cannot fail, a mutant that should exist and does not)?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report an R1 finding
that is fixed.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds: an item the repository records as an accepted bound or cost with its reason is not a finding unless
  its stated scope is wrong or it breaks booking integrity; if so, say so with evidence.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
