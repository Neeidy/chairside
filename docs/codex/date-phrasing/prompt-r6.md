# DATE-PHRASING R2e — Codex RECHECK prompt (the r5 stop ruled: E1, the comment wording, the deploy precondition)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks the R2e diff only, against the ruling recorded in `docs/DATE-PHRASING-PLAN.md` →
"R2e".

**How the run is made:** `docs/codex/date-phrasing/run-r6.sh` — the R5 runner with this file's path in place of its prompt
path and its header comments rewritten (`diff` against `docs/codex/date-phrasing/run-r5.sh` shows it).

<!-- prompt -->
You are re-checking a change in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n
workflow JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of
the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) parses explicit calendar dates: `docs/DATE-PHRASING-PLAN.md`. Five
earlier audits are committed verbatim under `docs/codex/date-phrasing/` (`r1.md` … `r5.md`). The latest (`r5.md`) found
three HIGH; the owner then RULED them (plan section "R2e", verbatim there): finding 1 is handled by a read-only deploy
precondition (not by a code change), findings 2 and 3 are recorded bounds with corrected wording, and one wording edge
(E1) is changed. THIS RECHECK COVERS ONLY THE DIFF `3d445dd..{PIN}` (`git diff 3d445dd {PIN}`): three engine comments
(`Resolve Date`, `Compute Availability`, `Compute Reschedule Availability` in `n8n/staged/workflow.main.sanitized.json`),
one branch in `resolveCalendar` (`Resolve Date`), its tests and mutants, golden G24, and the plan's R2e section.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. E1. A day + month without a year, whose date this year is behind us and whose next-year date is beyond
   `bot.bookingHorizonDays`, now answers the too-far reply unless this year's date is at most the horizon behind us
   (then "has passed", as before). Is the branch correct in both directions and at the boundary (30 days behind → passed,
   31 → too far)? Can it ever RESOLVE a date that was refused before, or change any outcome other than `date_past` →
   `beyond_horizon` (a year given, an impossible day, 29 February, no horizon configured, the reschedule lane, the D-4
   second-strike handoff, the owner alert class)? Does the too-far reply always carry its day count?
2. THE COMMENTS. Do the three corrected comments state the guarantee accurately ("sent … in the confirm ask of the turn
   before the write, in turn order", the lost reply and concurrent turns as bounds), and are the code lines of those
   three nodes byte-equal to `3d445dd`'s apart from the E1 branch?
3. THE PRECONDITION'S PREMISE (plan "R2e" → "F1"). The deploy proceeds only if no conversation is in `confirming` with a
   non-blank `slot_name` and none is in `reschedule_confirming`. It rests on: a `confirming` row with a null, empty or
   blank `slot_name` cannot write a booking (`Build Event Request` → `name_missing` → `Event ID Valid?` false →
   `Mark Handoff`; `tests/unit/name-capture.test.cjs` lines 207 and 226). Is that premise true in the staged Main — is
   there ANY path from a `confirming` row with no kept name, or from a confirm stage the two counts do not cover, to a
   Google Calendar insert or move or a Postgres appointment write? Is the recorded bound (the seconds between the read
   and the put) stated correctly?
4. Would the tests stay green if E1 were removed, inverted, or its reach changed by a day? Did the diff change anything
   beyond the ruling?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report a finding of
`r1.md` … `r5.md` that is fixed or recorded.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds: an item the repository records as an accepted bound or cost with its reason is not a finding unless
  its stated scope is wrong or it breaks booking integrity; if so, say so with evidence. The r4 class (a phrasing the
  best-effort text-side checks miss), r5 findings 2 and 3 (concurrent turns of one sender, a lost reply) and the missing
  booking-confirm freshness check (a named v2 item) are recorded.
- The wording of "within reach" as the horizon counted back is a stated reading of the ruling, open to the owner; report
  it only if the code does not do what the plan says.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
