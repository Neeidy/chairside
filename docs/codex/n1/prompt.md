# N1 R1 — Codex prompt (pass 1 of at most 2: CRT #5, #8, #1b/#2 on the N1 delta)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
Nothing else is sent. It audits the N1 R1 edit (docs/N1-CONFIRM-NO-PLAN.md §7) at its R1 head.

**How the run is made:** `docs/codex/n1/run.sh` — the DATE-PHRASING R2e runner (`docs/codex/date-phrasing/run-r6.sh`)
with this file's path in place of its prompt path and its header comments rewritten (`diff` shows it).

<!-- prompt -->
You are auditing a staged engine edit in a public repository: an n8n-based salon booking chatbot (the engine is exported
n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy
of the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the
committed lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy
is discarded and is not a fix.

THE EDIT — `docs/N1-CONFIRM-NO-PLAN.md` (read it in full: §0–§13, then "R1"; §0 is the measurement of the defect, "R1"
lists six declared deviations). The staged export is `n8n/staged/workflow.main.sanitized.json`; the committed (live)
export is `n8n/workflow.main.sanitized.json`; the delta file is `n8n/staged/workflow.main.delta.json`. The change: on
`Abort Reschedule?`'s false output (in front of `Uncertain Turn?`), a Code node `Classify Confirm Reply` tags a turn
`declined` (stage `confirming`: a closed "no" by text, or a model `cancel` at or above the confidence threshold),
`decline_reask` (stage `collecting` right after a decline: a closed "yes" or a confident model `confirm` — the first one
only) or `dropped` (stage `collecting` right after a decline or its re-ask: a closed "no"); an IF `Booking Declined?`
reads the tag; `Build Booking-Declined State` writes the state through the existing `Save State` (declined / re-ask:
stage `collecting`, slots and name kept; dropped: stage `new`, service/date/time emptied, name kept). `Load Config` gains
two templates through the deploy tool's gate edits (`scripts/diff-workflow-copy.py`, `APPROVED_DELTAS`). The commits are
`git log --oneline bc6eadf..{PIN}`.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. CRT #5 (handoff threshold; `.claude/rules/handoff.md`): is there any route where a pending booking confirmation is
   dropped on an UNCERTAIN classification — a model answer below the threshold, `unknown`, a missing or non-numeric
   confidence — other than the closed-text "no" the plan rules deterministic? Can the closed sets match a message that is
   not a plain yes/no (case, spacing, punctuation, Unicode look-alikes, a prefix or suffix)? Does an uncertain cancel at
   the confirm still clarify with the confirm kept? Is the two-strike clarify ladder and the confirm-pending handoff for
   the cancel and reschedule confirms unchanged?
2. CRT #8 (booking mutation via the bot): can a reply to the BOOKING confirm still reach `Find Booking` / `Cancel Lookup`
   / a cancel ask or a cancel of an existing booking in the same turn? Can the new previous-turn markers (`declined`,
   `decline_reask`, `dropped`, read from `Merge State`) be set or carried in a way that makes a later turn on the cancel
   or reschedule lane behave differently than before?
3. CRT #1b / #2 (the booking write): can any sequence through the new path reach `Book Appointment` / `Write Appointment`
   with a slot the customer declined, or without the confirm ask of the turn before? Can `Build Booking-Declined State`
   leave `stage = confirming`, or write slots that differ from the stored ones? Does the new path ever call Calendar,
   write an appointment or raise an owner alert? Is a pass-through turn byte-for-byte unchanged for the nodes after it?
4. D-6 as amended (the first bare "yes" after a decline re-asks once; the second goes to today's route): is the "once"
   exact (no loop, no second re-ask, no lock), and is the second one's outcome what the plan states — never a booking?
5. The deploy tool: does the approved N1 entry hold exactly the plan's nodes, edges and two texts, and does the staged
   export match it with nothing else changed (`diff-workflow-copy.py --phase edit`, `tests/unit/staged-sanitised.test.py`)?
6. Tests: would they stay green if a property above were broken — a test that cannot fail, a mutant that should exist
   and does not (`tests/unit/n1-confirm-no.test.cjs`, `tests/unit/n1-confirm-no-mutants.py`,
   `tests/unit/render-client-n1.test.py`, the chat-replay library `tests/unit/chat-replay.lib.cjs`)? Is what the plan's
   "R1" section states accurate?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds and declared choices: an item the repository records as an accepted bound or a declared choice with
  its reason (the plan's §3.7, "R1", and the v2 items it names) is not a finding unless its stated scope is wrong or it
  breaks booking integrity; if so, say so with evidence.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
