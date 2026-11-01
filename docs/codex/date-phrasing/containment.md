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
