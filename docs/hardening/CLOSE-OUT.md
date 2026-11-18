# HARDENING — close-out record (2026-11-18)

The close brief ("MASTER — HARDENING CLOSE") listed W1–W6, with W1, W3 and W4 under one ⚠ ONAY, each step only after a
fresh Live-GO. This file records what each step did, with its evidence, and where it stopped. Probe details (burst size,
timing, hour) are withheld by ruling K12; the edge result is recorded as pass/fail and the date.

| Step | Result | Evidence |
|---|---|---|
| **W1** K13 re-run (after the edge rule was widened the same day) | **done — PASS** on both checks | Live-GO GO (unchanged probe, two earlier NO-GO rounds fixed). Every answer was either n8n's 404 for an unregistered path or the edge's block; executions started since the probe began, across all five active workflows: **0** (Owner Actions saves no successful execution, so for it the evidence is structural: an unregistered path starts no workflow). |
| **W2** push the K13/K11 records, then the "re-verified" follow-up | **done** | `372b740` pushed after security-auditor GO (K12 option 1); the follow-up is this commit. |
| **W3** seed clean of the drill rows | **stopped** — nothing deleted | The seed tool's `clean` removes every drill-prefixed row AND every `d11-` dashboard marker. One such marker (2026-11-01) is not from this phase: it was written by the dashboard's own release button (its id has the button's shape), consistent with ship gate #19 — the owner releasing a seeded synthetic conversation from the internet. Nothing in the row ties it to that conversation, so it is **not proven** a test artefact and must stay. Deleting only this phase's rows needs a new, narrower action in the seed tool — a change outside the brief, so the step stopped. The rows left: this phase's 2 drill conversations, 3 cancelled drill appointments, 19 message claims and 1 release marker, plus the 2026-11-01 marker. **Ruled 2026-11-18 (Yigitcan): no new seed action; the remaining synthetic rows — 2 scrubbed conversations and 3 cancelled appointments — are kept as PERMANENT DEMO DATA.** What the Purge workflow actually does to them (read from its committed SQL): the 19 claims and both markers are DELETED after 30 days; the 2 conversations are only SCRUBBED (message text and name cleared), not deleted; the 3 cancelled appointments are never purged and stay. *(The first draft of this cell said the TTL removes all of them — that was my premise, given to the ruling, and it was wrong for the conversations and appointments.)* |
| **W4** dashboard rebuild (RM-1145 live) | **stopped, then DONE after the Next.js upgrade below** | Built in an isolated copy (OPS-10): the dashboard check passed 248/248 (session measurement; evidence not committed). `next build` then refused to finish, twice, with `SecurityFatalError` ("affected by a known security vulnerability"): it compiled and generated the pages but exited 1. An exit-1 build is not swapped in. Going further needs a Next.js upgrade — a dependency change outside this brief. At the time of the stop, the running dashboard was still the 2026-11-03 build on the same pinned Next.js. |
| **W5** close-out docs | **done** (this commit) | ROADMAP row, this record, the register regenerated (ROADMAP line refs now mapped from the inventory's base to the current file: 179 refs, 154 remapped to the same text, 25 already current, 0 mismatches — session measurement; evidence not committed), REPO-MAP, the resume note. |
| **W6** final report + Cowork list | in the session report | — |

## The Next.js upgrade (approved 2026-11-18, K-a 16.4.5, K-b, K-c)

- **Why:** the pinned `next` 16.4.1 is affected by GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 (both moderate,
  `<=16.4.4`; read from the npm advisory endpoint). The code uses neither `use cache` nor `unstable_cache` (grep), so they
  are most likely not reachable here — a reading, not an attack. `next build` refuses to finish only when it detects an
  AI agent (read from Next's own source); that is why the Vercel builds kept working and the local one did not.
- **Change:** `next` 16.4.1 → **16.4.5** (the first fixed release; 0 advisories) in `web/site` and `web/dashboard`;
  the lockfile changes only `next`, `@next/env`, the eight `@next/swc-*` entries and the two workspace entries. Built
  and tested in a separate worktree (OPS-10), never in `web/`: check-all 0, dashboard check 248/248, both `next build`
  exit 0, the client JS carries `16.4.5`, the snippet drill 4/4, the Turnstile-gate drill 15/15 *(session measurements;
  evidence not committed)*. Commit `252f048`, security-auditor GO (its report is in the session, not committed).
- **Site:** pushed; the live site's JS carried `16.4.1` before and `16.4.5` after; `/` and `/privacy` 200; the served
  widget equal to the local build *(session measurement; evidence not committed)*.
- **Dashboard swap** (⚠ ONAY; two Live-GO rounds, the first NO-GO fixed): one synthetic `pd-` handoff row seeded with
  the seed tool's existing action; the shared `web/node_modules` and `web/dashboard/.next` replaced by checked renames;
  result GREEN — the new BUILD_ID live (built 20:19, swapped in at 21:06 Vienna), runtime `next` 16.4.5, unit active, the dashboard hostname unauthenticated →
  302 to the Access login, the seeded row shown in the queue **masked** on both the old and the new build with its
  full value 0 times in the whole page HTML (which carries the inline RSC payload); the row removed with `clean-pd` and read back gone (0 pd rows,
  0 handoff rows, the queue empty again), the seed workflow deleted (GET 404). **RM-1145 is now live.** *(session measurement; evidence not committed)*
- **Kept for rollback** (deletion only with a separate approval): the previous build at `web/dashboard/.nextup-prev/.next`
  and the previous `web/.nextup-prev/node_modules` (both ignored by git); the build worktree in the session scratchpad.
- **A declared test-environment slip:** the first Turnstile-gate drill runs went 11/15 because my test build pointed the
  webhook at a placeholder host the drill does not intercept; rebuilt with the drill's own engine host, 15/15.

**Also measured in this round:** the public site serves a widget byte-identical to the local build of the current
source (measured 2026-11-18: the served file compared with the local build, equal; evidence not committed), so the
hardening widget changes (RM-2101, RM-2143) are live.

**Not run:** the Mythos re-attack on the promoted commit — deferred by the owner. The handover is kept
([MYTHOS-HANDOVER.md](MYTHOS-HANDOVER.md)). The phase has not been independently re-attacked.

**Declared slip:** during W4 one scratch-copy build directory was removed with a path built from a variable, against
the server habit of literal absolute paths (`.claude/rules/remote-operator.md`). Only the scratch copy's build output was
affected.
