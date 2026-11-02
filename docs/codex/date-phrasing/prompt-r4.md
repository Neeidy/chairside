# DATE-PHRASING R2c — Codex RECHECK prompt (the fixes for the R3 recheck's findings)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks the fixes for the R3 recheck (`docs/codex/date-phrasing/r3.md`).

**How the run is made:** `docs/codex/date-phrasing/run-r4.sh` — the R3 runner with this file's path in place of its prompt
path and its header comments rewritten (`diff` against `docs/codex/date-phrasing/run-r3.sh` shows it).

<!-- prompt -->
You are re-checking fixes in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n workflow
JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of the
repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) parses explicit calendar dates: `docs/DATE-PHRASING-PLAN.md` (read §0–
§13 and every section from "R1" on). Three earlier audits are committed verbatim under `docs/codex/date-phrasing/`
(`r1.md`, `r2.md`, `r3.md`). The latest (`r3.md`, at `e803474`) found: HIGH-1 ("5 november 2100: at 11:00" — a year
followed by a colon — resolved to this year), HIGH-2 ("may 5 of the year 2027" matched the modal exemption), HIGH-3 (the
confirm turn books the stored slot — pre-existing and recorded) and MEDIUM-4 (three-digit numbers untested). The fixes are
the commits after `e803474` up to {PIN} (`git log --oneline e803474..HEAD`): `Resolve Date` in the staged export, the
tests, the mutants, and the plan's "R3 recheck and R2c" section. The year check is now structural: the message's
well-formed times are taken out, then any number of three or more digits refuses while the expression has no year.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Are HIGH-1 and HIGH-2 closed? Can any path still book a date other than the full date the customer wrote — booking or
   reschedule lane; full, partial or empty extraction — OUTSIDE the confirm-turn behaviour the repository records
   (HIGH-3)? Is each stated cost and bound in the plan stated correctly and free of a wrong-date path?
2. Is MEDIUM-4 closed, and do the time strip and the narrowed exemption refuse ordinary wording beyond the stated costs?
3. Did the fixes change anything beyond these targets (the staged export against `e803474`'s), and would the tests stay
   green if a fixed property were broken?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report a finding of
`r1.md`, `r2.md` or `r3.md` that is fixed or recorded.

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
