# CLOSE-OUT — how the Codex runs were contained

## Pass 1 — the audit of the R1 head
**Harness:** the N1 one, unchanged (`docs/codex/n1/containment.md`), run by `docs/codex/close-out/run.sh` — the N1 runner
with the prompt path changed and its header comments rewritten (`diff docs/codex/n1/run.sh docs/codex/close-out/run.sh`
shows exactly that). One throwaway container (label `c72=run`, all capabilities dropped, no new privileges) from the image
`c72-codex-audit:r2`; a read-only single-branch export of the pushed `main` at the pin `2519887` (430 files), copied
inside to a writable working directory; a temporary Codex home holding only a copy of the CLI's login file and the prompt
(47 lines).
**The network was OPEN for the Codex run** (Docker's default network, `--dns 1.1.1.1`), because the CLI reaches its model
API over it; only the mount-check probes ran with `--network none`.

**Two attempts, one answer.** The FIRST attempt stopped part-way and produced no answer: the build host's `/tmp`
(a memory-backed filesystem) filled up while an unrelated offline probe of this round copied build dependencies there.
Its Codex home, which held the login copy, was deleted and its absence read back; its partial log was discarded unread.
Space was freed (an approved deletion of old scratch copies) and the run was repeated from an empty directory.
**The second attempt:** mount-check controls one extra mount → 97, as intended → 0; then mount check OK, Codex exit 0,
container exit 0, 315 container seconds. The answer is committed verbatim as `p1.md` (byte-compared with the run's output
file).

**What the run did** — read from its own logs afterwards:
- `scripts/codex-containment.py`: commands 36 · passed 36 · search patterns that name no path 3 · flags 0.
- A separate scan of the 36 command lines (the login file, the Codex home, `/proc`, `$HOME`, `~/`, the environment,
  network tools, history-widening git options): 0 hits; its positive control matched the four forbidden shapes and not
  the ordinary command.
- Its MAIN HIGH was measured by editing the replay harness's `Extract Intent` stub inside the run's own working copy (a
  timeout injected); that copy is discarded, so the edit is no fix and reached nothing else.
- The export and the Codex home are deleted after this record is pushed (they hold the login copy).
