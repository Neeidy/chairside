# N1 — how the Codex runs were contained

## Pass 1 — the audit of the R1 head
**Harness:** the DATE-PHRASING one, unchanged (`docs/codex/date-phrasing/containment.md`), run by `docs/codex/n1/run.sh`
— the DATE-PHRASING R2e runner with the prompt path changed and its header comments rewritten
(`diff docs/codex/date-phrasing/run-r6.sh docs/codex/n1/run.sh` shows exactly that). One throwaway container (label
`c72=run`, all capabilities dropped, no new privileges) from the image `c72-codex-audit:r2`; a read-only single-branch
export of the pushed `main` at the pin `819982f` (405 files), copied inside to a writable working directory; a temporary
Codex home holding only a copy of the CLI's login file and the prompt (58 lines).
**The network was OPEN for the Codex run** (Docker's default network, `--dns 1.1.1.1`), because the CLI reaches its model
API over it; "No network" in the prompt is an instruction to the auditor, not a control. Only the mount-check probes ran
with `--network none`.
**One attempt.** Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex exit 0,
container exit 0, 169 container seconds. The answer is committed verbatim as `p1.md` (byte-compared with the run's output
file).
**What the run did** — read from its own logs afterwards:
- `scripts/codex-containment.py`: commands 18 · passed 17 · flags 2, both on ONE command, read one by one: a probe the run
  wrote under its own `.audit-n1/` that requires `../tests/unit/chat-replay.lib.cjs` (from `.audit-n1/`, i.e. inside the
  working copy), and `//`, a JavaScript comment in the same probe.
- A separate scan of the 18 command lines (the login file, the Codex home, `/proc`, `$HOME`, `~/`, the environment,
  network tools, history-widening git options): 0 hits; its positive control matched the four forbidden shapes and not
  the ordinary command.
- Codex reported "no tracked files were changed".
- The export and the Codex home are deleted after this record is pushed (they hold the login copy).

## Pass 2 — the recheck of the pass-1 fixes (the last pass, by ruling)
Same harness, run by `docs/codex/n1/run-p2.sh` (the pass-1 runner with the prompt path changed). Pin `a0779a7` (409
files), prompt 37 lines. Mount-check controls: one extra mount → 97, as intended → 0. Then: mount check OK, Codex exit 0,
container exit 0, 118 container seconds. Answer verbatim as `p2.md`, byte-compared with the run's output file.
- `scripts/codex-containment.py`: commands 14 · passed 12 · flags 4, read one by one: three JavaScript regex literals
  (`/[a-z]/i`, `/[a-z]/.test`, `/[a-z]/g`) read as paths, and a `require('../tests/unit/chat-replay.lib.cjs')` from a
  probe under the run's own `.audit-n1-p2/` — all inside the working copy.
- The separate scan of the 14 command lines: 0 hits; its positive control matched the four forbidden shapes and not the
  ordinary command.
- The pass-1 login copy was deleted after the pass-1 record was pushed (its absence read back); the pass-2 one is deleted
  after this record is pushed.
