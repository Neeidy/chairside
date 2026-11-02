# DATE-PHRASING R2b — Codex RECHECK prompt (the fixes for the R2 recheck's findings)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks the fixes for the R2 recheck (`docs/codex/date-phrasing/r2.md`).

**How the run is made:** `docs/codex/date-phrasing/run-r3.sh` — the R2 runner with this file's path in place of its prompt
path and its header comments rewritten (`diff` against `docs/codex/date-phrasing/run-r2.sh` shows it).

<!-- prompt -->
You are re-checking fixes in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n workflow
JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of the
repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) parses explicit calendar dates: `docs/DATE-PHRASING-PLAN.md` (read §0–
§13, "R1", "R2" and "R2 recheck and R2b"). Two earlier audits are committed verbatim: `docs/codex/date-phrasing/r1.md`
(at `120ee52`) and `docs/codex/date-phrasing/r2.md` (the recheck at `719ac88`). The recheck found: HIGH-1 (a year the
model left out — 0000, 2100, 1899 — still resolved to this year), HIGH-2 (the "<month> N of" exemption kept a stale
date), HIGH-3 ("thursday,4.11" not detected), MEDIUM-4 (compact evening times refused), MEDIUM-5 (the expression's own
weekday switched off the message's others), MEDIUM-6 (D-4 never fired on the reschedule lane), MEDIUM-7 (two regressions
survived every suite). The fixes are the commits after `719ac88` up to {PIN} (`git log --oneline 719ac88..HEAD`): the
staged export (`Resolve Date`, and `Reschedule Lookup` by a ruling recorded in the plan), the delta file, the tests, the
mutants, and the plan's R2b section. MEDIUM-4 is resolved as a STATED COST (a compact time re-asks once), not by
accepting compact times.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Are HIGH-1, HIGH-2 and HIGH-3 closed? Can any path still book a date other than the full date the customer wrote —
   in the booking lane, the reschedule lane, the confirm lane, with a full, partial or empty extraction? Check the bounds
   and costs the R2b section states and say whether each is stated correctly and does not break booking integrity.
2. Are MEDIUM-5, MEDIUM-6 and MEDIUM-7 closed? Does the Reschedule Lookup change do exactly what the ruling says (carry
   only `last_intent` from Resolve Date's output) and nothing else? Does any fix refuse ordinary wording beyond the
   stated costs?
3. Did the fixes change anything beyond these targets (the staged export against `719ac88`'s), and would the tests stay
   green if a fixed property were broken?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report a finding of
`r1.md` or `r2.md` that is fixed.

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
