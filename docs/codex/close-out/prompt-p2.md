# CLOSE-OUT R2 — Codex prompt, pass 2 (the last by the cap)

The exact text the run receives: the block below, with `{PIN}` replaced by the SHA of the commit that added this file.
It rechecks the pass-1 fixes (docs/CLOSE-OUT-PLAN.md "R2"). **How the run is made:** `docs/codex/close-out/run-p2.sh`
— the pass-1 runner with this file's path in place of its prompt path and its header comments rewritten.

<!-- prompt -->
You are rechecking fixes in a public repository: an n8n-based salon booking chatbot. Your working directory is a
writable copy of the repository at commit {PIN}, with the git history of `main` up to it and the dependencies installed
from the committed lockfiles. You may run the repository's own tests and offline commands; anything you change is
discarded and is not a fix.

Your previous pass is committed verbatim as `docs/codex/close-out/p1.md` (at commit 2519887). Read it, then read
`docs/CLOSE-OUT-PLAN.md` "R2": its triage table and the owner's ruling on your MAIN HIGH (recorded as a bound, pinned by
a test, no Main change). The changes since your pass are `git log --oneline 2519887..{PIN}` and `git diff 2519887..{PIN}`:
a replay-harness hook (`tests/unit/chat-replay.lib.cjs`: a model answer with `__llmError: true` makes `Extract Intent`
fail on its error output), the BOUND test in `tests/unit/close-out-main.test.cjs`, the live-clock case in
`tests/unit/start-gates-window.test.py`, `tests/unit/close-out-main-mutants.py` executing its equivalent mutant, and the
bound's sentence in `.claude/rules/handoff.md`. No engine export, site, snippet or dashboard file changed since your pass.

Answer, with evidence (code at {PIN}, or an offline command you ran and what it showed):
1. Does the harness hook model n8n's error output faithfully enough that the BOUND test exercises the real
   `LLM Unavailable Reply` route of the staged Main, and does it leave every other replay test's behaviour unchanged?
2. Does the BOUND test pin the bound as ruled (an unsaved turn does not advance `turn_count`; the next "yes" books the
   slot shown) — and would it go red if the bound changed in either direction?
3. Does the live-clock case in G1's test now go red for a zone change (try `TZ = 'UTC'`), and can it flake at a minute
   boundary?
4. Is `handoff.md`'s new sentence true of the staged Main?
5. Anything NEW the fixes introduced. Do not re-report your pass-1 findings that the plan records as bounds.
Give each finding HIGH / MEDIUM / LOW. If there is nothing, say so.
