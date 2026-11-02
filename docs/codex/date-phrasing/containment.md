# DATE-PHRASING — how the Codex runs were contained

## R1 — the audit of the R1 head
**Harness:** the NAME-CAPTURE one, unchanged (`docs/codex/name-capture/containment.md`), run by
`docs/codex/date-phrasing/run.sh` — the NAME-CAPTURE R3 runner with the prompt path changed and its header comments
rewritten (`diff docs/codex/name-capture/run-r3.sh docs/codex/date-phrasing/run.sh` shows exactly that). One throwaway
container (label `c72=run`, all capabilities dropped, no new privileges) from the image `c72-codex-audit:r2`; a read-only
single-branch export of the pushed `main` at the pin `120ee52` (375 files), copied inside to a writable working
directory; a temporary Codex home holding only a copy of the CLI's login file and the prompt (57 lines).
**The network was OPEN for the Codex run** (Docker's default network, `--dns 1.1.1.1`), because the CLI reaches its model
API over it; "No network" in the prompt is an instruction to the auditor, not a control. Only the mount-check probes ran
with `--network none`.
**One attempt.** Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex exit 0,
container exit 0, 262 container seconds. The answer is committed verbatim as `r1.md` (byte-compared with the run's
output file). The export and the Codex home are deleted after this record is pushed (they hold the login copy).
**What the run did** — read from its own logs afterwards:
- `scripts/codex-containment.py`: commands 13 · passed 12 · flags 1. The flag is a `require('../tests/unit/chat-replay.lib.cjs')`
  in a probe the run wrote under its own `.audit-tmp/` — inside the working copy.
- A separate scan of the 13 command lines (the login file, the Codex home, `/proc`, `$HOME`, `~/`, the environment,
  network tools, history-widening git options): 0 hits; its positive control matched the four forbidden shapes and not
  the ordinary command.
- Codex reported "no tracked files were changed".

## R2 — the recheck of the R1 fixes
Same harness, run by `docs/codex/date-phrasing/run-r2.sh` (the R1 runner with the prompt path changed). Pin `719ac88`
(379 files), prompt 42 lines. Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex
exit 0, container exit 0, 272 container seconds. Answer verbatim as `r2.md`, byte-compared with the run's output file.
- `scripts/codex-containment.py`: commands 24 · passed 20 · flags 5, read one by one: four `require('../…')` (luxon, the
  chat-replay library) from probes the run wrote under its own `.audit-r2/` — inside the working copy; one "unparseable
  shell script", a heredoc editing its own `.audit-r2/extra-mutants.py`.
- The separate scan of the 24 command lines: 0 hits; its positive control matched the four forbidden shapes and not the
  ordinary command.
- The R1 export and Codex home were deleted after the R1 records were pushed; the R2 ones are deleted after these.

## R3 — the recheck of the R2b fixes
Same harness, run by `docs/codex/date-phrasing/run-r3.sh` (the R2 runner with the prompt path changed). Pin `e803474`
(382 files), prompt 43 lines. Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex
exit 0, container exit 0, 238 container seconds. Answer verbatim as `r3.md`, byte-compared with the run's output file.
- `scripts/codex-containment.py`: commands 27 · passed 26 · flags 2 — two `require('../…')` (luxon, the chat-replay
  library) from a probe the run wrote under its own `.audit-r3/`, inside the working copy.
- The separate scan of the 27 command lines: 0 hits; its positive control matched the four forbidden shapes and not the
  ordinary command.
- The R2 export and Codex home were deleted after the R2 records were pushed; the R3 ones are deleted after these.
