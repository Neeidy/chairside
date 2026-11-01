# NAME-CAPTURE R3 — Codex RECHECK prompt (the sanitiser diff of ruling R3-1 only)

The exact text the recheck run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this
file. Nothing else is sent. It rechecks ONLY one change: ruling R3-1 (Yigitcan, 2026-11-01) made the name sanitiser turn
a typographic apostrophe `’` (U+2019) into `'` (U+0027) before its character check. The change is commit `9e5d875`; the
audited state before it is `4334a1c` (the R2 recheck's records, `docs/codex/name-capture/r2.md`).

**How the run is made:** `docs/codex/name-capture/run-r3.sh` — the R2 runner with this file's path in place of its
prompt path and its header comments rewritten (`diff` against `docs/codex/name-capture/run-r2.sh` shows it).

<!-- prompt -->
You are re-checking ONE small change in a public repository: an n8n-based salon booking chatbot (the engine is exported
n8n workflow JSON; the store is Postgres; Google Calendar holds the bookings). Your working directory is a writable copy
of the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed from the
committed lockfiles. You may run the repository's own tests and offline commands there; anything you change in the copy
is discarded and is not a fix.

CONTEXT — a staged engine edit (not yet deployed) makes every booking carry the customer's name:
`docs/NAME-CAPTURE-PLAN.md` (design 3.3/3.4; the "R1" and "R2" sections). It was audited twice (verbatim:
`docs/codex/name-capture/r1.md`, `docs/codex/name-capture/r2.md`). Since then ONE ruling changed the name sanitiser
`sanitiseName`, which exists as two byte-equal copies in `n8n/staged/workflow.main.sanitized.json` (nodes
`Fill Name From Reply` and `Merge Slots`): a typographic apostrophe U+2019 is replaced by U+0027 right after NFC and
before the character check, so `O’Neil` is accepted and kept as `O'Neil`. The ruling says nothing else in the character
set changes. The change is commit `9e5d875` (`git show 9e5d875`): the two node copies, `tests/unit/name-capture.test.cjs`,
`tests/unit/name-capture-mutants.py`, and the plan text.

Answer these questions, each with evidence (the code or text at {PIN}, or an offline command you ran and what it
showed):
1. Does the change do exactly what the ruling says — U+2019 becomes U+0027 before the check, in BOTH copies, and no other
   character becomes acceptable? Consider the order against NFC, the `\p{C}` strip, the whitespace collapse and the
   40-character cap; and the name's later uses (`Fill Name From Reply`'s prefix match, word shape and deny list;
   `Merge Slots`; the confirm question, the calendar title, the appointment row, the Purge's `replace` of the kept name in
   `computed_reply`).
2. Can the normalisation be used to get a value past the sanitiser or the deny list that was refused before, or to make a
   deny-listed word count as a name? Is there any input whose result changed other than by U+2019 → U+0027?
3. Would the tests stay green if the normalisation were broken or removed in one copy, or widened to other characters
   (a test that cannot fail, a mutant that should exist and does not)?
4. Is the plan text changed by `9e5d875` accurate against the code?

For each finding give a severity (HIGH / MEDIUM / LOW), the file and line (or node name), a concrete failing input or
scenario, and the offline command that shows it. Do not report style or refactors, and do not re-report a finding of
`r1.md` or `r2.md`.

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
