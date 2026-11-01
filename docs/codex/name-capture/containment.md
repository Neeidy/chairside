# NAME-CAPTURE R1 — how the Codex run was contained

**Harness:** the Phase 8 one, unchanged (`docs/codex/phase-8/containment.md`), run by `docs/codex/name-capture/run.sh` —
the committed public-demo runner with one line changed (the prompt path) and its header comments rewritten; `diff
docs/codex/public-demo/run.sh docs/codex/name-capture/run.sh` shows exactly that. One throwaway container (label
`c72=run`, all capabilities dropped, no new privileges) from the image `c72-codex-audit:r2`; a read-only single-branch
export of the pushed `main` at the pin `da164ff` (no remote, no reflog, no hooks; 361 files, `.git` included), copied
inside to a writable working directory; a temporary Codex home holding only a copy of the CLI's login file and the
prompt (72 lines); the same Codex features off as in Phase 8.

**The network was OPEN for the Codex run, as in Phase 8:** Docker's default network with `--dns 1.1.1.1`, because the
Codex CLI reaches its model API over it. "No network" in the prompt is an instruction to the auditor, not a control;
only the mount-check probes ran with `--network none`.

**One attempt.** The mount check's two controls first — one extra host directory mounted → exit 97, the intended mounts →
exit 0 — then the run: mount check OK, Codex exit 0, container exit 0, 375 container seconds. The answer is committed
verbatim as `r1.md` (byte-compared with the run's output file). The export and the Codex home are deleted after this
record is pushed (they hold the login copy).

**What the run did** — read from its own logs afterwards, as information:
- `scripts/codex-containment.py` (the run's events and session log): commands 27 · passed 26 · flags 1, read: the one
  ".." flag is a `require('../scripts/node_modules/luxon')` in a probe file the run wrote under its own `audit-tmp/` —
  inside the working copy.
- A separate scan of all 27 command lines for the login file, the Codex home, `/proc`, `$HOME`, the environment, network
  tools and history-widening git options: 0 hits. The scan was shown able to match first (a positive control of five
  lines: the four forbidden shapes matched, an ordinary test command did not).
- Codex wrote its probes under `audit-tmp/` in the working copy and reported "No tracked files were changed".

## R2 — the recheck run

Same harness, run by `docs/codex/name-capture/run-r2.sh` (the R1 runner with the prompt path changed). Pin `5c452e6`
(365 files), prompt 48 lines. Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex
exit 0, container exit 0, 144 container seconds. Answer verbatim as `r2.md`, byte-compared with the run's output file.
- `scripts/codex-containment.py`: commands 10 · passed 9 · flags 1. The flag is again a
  `require('../scripts/node_modules/luxon')`, from the run's own `audit-r2/` directory — inside the working copy.
- The separate scan of the 10 command lines: 0 hits. Its positive control matched the four forbidden shapes and not the
  ordinary command.
- The R1 export and Codex home were deleted after the R1 records were pushed; the R2 ones are deleted after these.
