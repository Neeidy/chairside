# NAME-CAPTURE R2 — Codex RECHECK prompt (the fixes for the R1 findings)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks ONLY the fixed targets: Codex's R1 answer (`docs/codex/name-capture/r1.md`) found
two MEDIUM and made two notes under question 4; each was fixed, and the fixes are what this run audits.

**How the run is made:** `docs/codex/name-capture/run-r2.sh` — the R1 runner with this file's path in place of its
prompt path and its header comments rewritten (`diff` against `docs/codex/name-capture/run.sh` shows it).

<!-- prompt -->
You are re-checking fixes in a public repository: an n8n-based salon booking chatbot (the engine is exported n8n workflow
JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of the
repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed
lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy is
discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) makes every booking carry the customer's name:
`docs/NAME-CAPTURE-PLAN.md`. An earlier audit of it, at commit `da164ff`, is committed verbatim as
`docs/codex/name-capture/r1.md`. It found:
- M1 (MEDIUM): a conversation already `confirming` with no kept name (from before the deploy, or emptied by the 30-day
  Purge) skips `Slot Gate`, and `Build Event Request` booked it nameless.
- M2 (MEDIUM): `Compute Availability`'s confirm question names the customer, Save State persists it as
  `computed_reply`, and the Purge left it there — contradicting the privacy page's "erased with the messages".
- Two notes under its question 4: the Save States' RETURNING does not include `slot_name` (the plan's §3.2 said it
  would); `004_slot_name.sql` checked only UPDATE for `salon_ro` while the record said "cannot write".
The fixes are the commits after `da164ff` up to {PIN} (`git log --oneline da164ff..HEAD`): `n8n/staged/workflow.main.sanitized.json`
(`Build Event Request`), `n8n/staged/workflow.purge.sanitized.json` (`Scrub Recent Messages`), `db/schema/004_slot_name.sql`,
the tests `tests/unit/name-capture.test.cjs`, `tests/unit/name-capture-mutants.py`, `tests/unit/privacy-facts.test.cjs`,
`tests/db/slot-name.test.sh` (needs Docker; read it), and the plan's "R2" section.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Is M1 closed? Can any path still write a booking (a calendar event or an appointment row) without a name — the
   confirm lane, the reschedule lane, a reconcile, a dry run? Does the new refusal route to a visible handoff with an
   owner alert, and can it fire on a booking that HAS a name?
2. Is M2 closed? After the 30-day scrub, can the kept name survive anywhere in the conversation row? Can the new
   `replace(computed_reply, slot_name, '…')` damage a reply wrongly in a way the record does not state, or fail on a
   NULL / empty value? Is what the record states about the Purge's own run data correct?
3. Are the two question-4 notes handled correctly (fixed, or the text corrected)?
4. Did the fixes change anything beyond these targets (the staged files against `da164ff`'s staged files), and would the
   tests stay green if the fixed property were broken (a test that cannot fail, a mutant that should exist and does
   not)?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report an R1 finding
that is fixed.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds: an item the repository records as an accepted bound with its reason is not a finding unless its
  stated bound or scope is wrong; if it is, say so with evidence.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
