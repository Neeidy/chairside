# NAME-CAPTURE R1 — Codex audit prompt (docs/NAME-CAPTURE-PLAN.md §7)

The exact text the Codex run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent, so the audit can be repeated from this file alone. One run, the plan's §7 targets: #1b
(re-audit for the changed booking write), the new name-handling target (CRT #16), #8 (re-audit for the reschedule
target's added field) — and the deploy route §11 names, because the edit cannot ship without it (the gate edit, ruling
D-4).

**How the run is made:** the Phase 8 harness unchanged (`docs/codex/phase-8/containment.md`), run by
`docs/codex/name-capture/run.sh` — the public-demo runner with this file's path in place of its prompt path and its
header comments rewritten; nothing else differs (`diff` against `docs/codex/public-demo/run.sh` shows it).

<!-- prompt -->
You are auditing a public repository: an n8n-based salon booking chatbot (the engine is exported n8n workflow JSON;
the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy of the repository
at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the committed lockfiles.
You may run the repository's own tests and offline commands there; anything you change in the copy is discarded and is
not a fix.

TARGET — one staged engine edit, not yet deployed: a booking must carry the customer's name (asked when missing, kept
across turns, written to the calendar event and the appointment, kept on reschedule). The plan, its rulings and the
record of what was built are `docs/NAME-CAPTURE-PLAN.md` (§3 design, §7 targets, §8 acceptance, "R1 — built offline"
with twelve declared deviations). The changed files:
- `n8n/staged/workflow.main.sanitized.json` vs the live `n8n/workflow.main.sanitized.json`, as declared in
  `n8n/staged/workflow.main.delta.json`: a new Code node `Fill Name From Reply` between `Validate Intent` and
  `Resolve Date` (before every uncertainty gate: `Invalid or Handoff Gate`, `Confirm Pending & Uncertain?`,
  `Uncertain Turn?`, `Repeat Uncertain?`), and edits to `Merge State`, `Merge Slots` (the one name sanitiser, copied
  byte-equal from `Fill Name From Reply`), `Slot Gate`, `Compute Availability`, `Build Event Request`, `Write
  Appointment`, `Validate Reschedule Target`, `Build Reschedule Event Request`, `Reschedule Lookup`, `Build Clarify
  State`, `Build LLM Request`, `Load State`, `Save State`, `Save State (Post-Write)`, `Capture Lead`, `Load Config`
  (one added template key) and two sticky notes.
- `n8n/staged/workflow.purge.sanitized.json` vs `n8n/workflow.purge.sanitized.json`: `Find Stale Conversations` and
  `Scrub Recent Messages` (the name emptied with the message text after 30 days).
- `db/schema/004_slot_name.sql` (not yet run): the new column.
- The deploy tool: `scripts/diff-workflow-copy.py` (`APPROVED_DELTAS`, `parse_delta`, `approved_errs`, `compare`,
  the new `gate_edit_errs`) and `scripts/workflow-step.py` (`put`): `Load Config` is a security-gate node that the tool
  never lets an edit change; the new `gate_edits` item is meant to let it GAIN exactly one approved key with exactly
  its approved text, and nothing else.
The tests: `tests/unit/name-capture.test.cjs` and its mutants `tests/unit/name-capture-mutants.py`,
`tests/unit/llm-schema-drift.test.cjs`, `tests/unit/render-client-askname.test.py`, `tests/unit/privacy-facts.test.cjs`,
`tests/unit/workflow-step.test.py`, `python3 scripts/diff-workflow-copy.py --selftest`, and `tests/db/slot-name.test.sh`
(needs Docker; you will not have it — read it). The repository's rules for this area: `.claude/rules/booking-integrity.md`,
`prompt-injection.md`, `handoff.md`, `contract-integrity.md`.

Answer these five questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Name handling (CRT #16). Is there a customer message on which `Fill Name From Reply` takes something that is not a
   name as the name, or acts outside its three stated bounds (only at the name ask; only over the model's `unknown` or
   a detail-less `book`; a name shape outside the deny list) — in particular over an explicit handoff, a cancel or
   reschedule, a jailbreak attempt, or during a pending cancel/reschedule confirmation? Does the sanitiser let a
   control, format, zero-width or bidi character, a digit, markup, or more than 40 characters through, or reject a name
   the rulings say it must keep (A2: two-word Turkish with ğ and Ü, Müller, a non-Latin name)? Can the kept name reach
   a later LLM request or an owner alert as text? Is D-3 (a second turn without a name → handoff) right, and can it
   fire when it should not or fail to fire?
2. Booking write (#1b, re-audit). Does the changed `Build Event Request` / `Write Appointment` (its upsert now
   `customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''), salon.appointments.customer_name)`) change anything in
   write-then-verify, the event id, or the race paths? Can a stored name be blanked, or a wrong person's name written?
3. Reschedule (#8, re-audit). Does the new `customer_name` in `Validate Reschedule Target`'s target, its use in
   `Build Reschedule Event Request`, or `Reschedule Lookup` keeping the stored slots change which booking is moved or
   validated, or carry another sender's name?
4. Store and retention. Do `Load State`, both `Save State`s and the Purge read, write and empty `slot_name` as stated
   (including a row whose messages were already erased)? Does `004_slot_name.sql` do what its header says, and is the
   stated order (migration before the Main deploy) enough to keep production from breaking?
5. The deploy tool's gate edit. Can a staged export and a delta file get past `approved_errs` + `compare` (and `put`)
   with ANY change to `Load Config` beyond adding exactly the approved key and text — another value, a second key, a
   comment, a changed Turnstile setting, the line placed elsewhere, an escaped form of the text, a trigger or another
   gate node named in `gate_edits`, or a delta that mixes items of the two entries `APPROVED_DELTAS['main']` holds?
And for all five: do the staged files differ from the live exports ONLY as stated, and would the tests stay green if
the property they name were broken (a test that cannot fail, a mutant that should exist and does not)?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors.

Rules for this run:
- Read only files inside this working directory. Do not access any path outside it, environment variables or /proc.
  Use only git history reachable from HEAD: no `--all`, reflog, branch or stash listing.
- No network.
- Write temporary files only under a directory you create inside the working directory or under the system temp
  directory, never into the repository's tracked paths.
- Recorded bounds: an item the repository records as an accepted bound with its reason (`docs/NAME-CAPTURE-PLAN.md`,
  the nodes' and tests' own comments) is not a finding unless its stated bound or scope is wrong; if it is, say so with
  evidence.
- Some suites need what this environment does not have (the live n8n instance, Docker, the host-leak guard's local
  file). Say which you could not run.
- End with a short summary: per question, a one-line answer, and the list of findings by severity.
