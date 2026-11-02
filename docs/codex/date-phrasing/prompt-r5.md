# DATE-PHRASING R2d — Codex RECHECK prompt (the r4 stop ruled: the structural defence)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks the R2d build against the ruling recorded in `docs/DATE-PHRASING-PLAN.md` →
"R2d".

**How the run is made:** `docs/codex/date-phrasing/run-r5.sh` — the R4 runner with this file's path in place of its prompt
path and its header comments rewritten (`diff` against `docs/codex/date-phrasing/run-r4.sh` shows it).

<!-- prompt -->
You are re-checking a change in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n
workflow JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of
the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) parses explicit calendar dates: `docs/DATE-PHRASING-PLAN.md`. Four
earlier audits are committed verbatim under `docs/codex/date-phrasing/` (`r1.md` … `r4.md`). The latest (`r4.md`, at
`7731b8e`) found two HIGH in one class: the model's `dateExpr` can drop part of a date the customer wrote, and the
text-side detector misses the phrasing ("haircut 5 november '27"; "May 5 of our anniversary year, 2027" with an empty
extraction). The owner then RULED (plan section "R2d", verbatim there): the guarantee is STRUCTURAL — the booking confirm
ask and the reschedule confirm ask show the full resolved date WITH its year, nothing is written without the customer's
"yes", and `bot.bookingHorizonDays` is 30; the text-side checks are not extended and stay only as best-effort; the r4
class is a recorded bound. The change is the commits after `267d9b1` up to {PIN} (`git log --oneline 267d9b1..HEAD`):
`Compute Availability` and `Compute Reschedule Availability` in `n8n/staged/workflow.main.sanitized.json`, the
`Load Config` horizon, comment labels in `Resolve Date`, the pins of the confirm text (site hero, its drift guard,
mockups, inventories), the tests, the mutants, the deploy tool's approved value, and the plan's R2d section.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. THE DEFENCE. Is there ANY path in the staged Main — booking or reschedule lane, any stage, any intent, any sequence
   of turns, an error or race branch (verify, race-lost, orphan, verify-unavailable), a duplicate or retried delivery,
   the kill-switch or a handoff — that writes a booking or a moved slot (the Google Calendar insert or move, the Postgres
   appointment row or its reschedule update) WITHOUT the year-bearing confirm ask having been shown to that customer
   first, or that writes a slot OTHER than the one the last such confirm ask showed? Either would be a HIGH. Trace the
   write nodes back to the confirm builders and say which paths you checked.
2. THE r4 HIGHs against the defence: for each, what does the customer see before any write, and is the recorded bound
   (plan "R2d" → "The bound") stated correctly and completely — including what the defence does NOT do?
3. THE DIFF: did the change alter anything beyond the ruling (the staged export against `267d9b1`'s: only the two confirm
   formats, the horizon value and comments in `Resolve Date`)? Does every other reply keep its wording? Does the 30-day
   horizon hold for every resolved date, ISO included, with day 30 inside and day 31 outside? Would the tests stay green
   if the year were dropped from either confirm, or the horizon changed? Is the hero drift guard able to fail?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report a finding of
`r1.md` … `r4.md` that is fixed or recorded.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds: an item the repository records as an accepted bound or cost with its reason is not a finding unless
  its stated scope is wrong or it breaks booking integrity; if so, say so with evidence. Another phrasing that the
  best-effort text-side checks miss is the recorded r4 class, not a finding — unless the year-bearing confirm ask does
  not show the resulting date before the write.
- The cancel confirm ask is outside the ruling (a cancel writes no new date); do not report its wording.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
