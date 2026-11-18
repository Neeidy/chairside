# HARDENING — close-out record (2026-11-18)

The close brief ("MASTER — HARDENING CLOSE") listed W1–W6, with W1, W3 and W4 under one ⚠ ONAY, each step only after a
fresh Live-GO. This file records what each step did, with its evidence, and where it stopped. Probe details (burst size,
timing, hour) are withheld by ruling K12; the edge result is recorded as pass/fail and the date.

| Step | Result | Evidence |
|---|---|---|
| **W1** K13 re-run (after the edge rule was widened the same day) | **done — PASS** on both checks | Live-GO GO (unchanged probe, two earlier NO-GO rounds fixed). Every answer was either n8n's 404 for an unregistered path or the edge's block; executions started since the probe began, across all five active workflows: **0** (Owner Actions saves no successful execution, so for it the evidence is structural: an unregistered path starts no workflow). |
| **W2** push the K13/K11 records, then the "re-verified" follow-up | **done** | `372b740` pushed after security-auditor GO (K12 option 1); the follow-up is this commit. |
| **W3** seed clean of the drill rows | **stopped** — nothing deleted | The seed tool's `clean` removes every drill-prefixed row AND every `d11-` dashboard marker. One such marker (2026-11-01) is not from this phase: it was written by the dashboard's own release button (its id has the button's shape), consistent with ship gate #19 — the owner releasing a seeded synthetic conversation from the internet. Nothing in the row ties it to that conversation, so it is **not proven** a test artefact and must stay. Deleting only this phase's rows needs a new, narrower action in the seed tool — a change outside the brief, so the step stopped. The rows left: this phase's 2 drill conversations, 3 cancelled drill appointments, 19 message claims and 1 release marker, plus the 2026-11-01 marker. The claims and markers expire under the Purge workflow's 30-day TTL. |
| **W4** dashboard rebuild (RM-1145 live) | **stopped** — the live dashboard untouched | Built in an isolated copy (OPS-10): the dashboard check passed 248/248 (session measurement; evidence not committed). `next build` then refused to finish, twice, with `SecurityFatalError` ("affected by a known security vulnerability"): it compiled and generated the pages but exited 1. An exit-1 build is not swapped in. Going further needs a Next.js upgrade — a dependency change outside this brief. The running dashboard is still the 2026-11-03 build, active, on the same pinned Next.js. |
| **W5** close-out docs | **done** (this commit) | ROADMAP row, this record, the register regenerated (ROADMAP line refs now mapped from the inventory's base to the current file: 179 refs, 154 remapped to the same text, 25 already current, 0 mismatches — session measurement; evidence not committed), REPO-MAP, the resume note. |
| **W6** final report + Cowork list | in the session report | — |

**Also measured in this round:** the public site serves a widget byte-identical to the local build of the current
source (measured 2026-11-18: the served file compared with the local build, equal; evidence not committed), so the
hardening widget changes (RM-2101, RM-2143) are live.

**Not run:** the Mythos re-attack on the promoted commit — deferred by the owner. The handover is kept
([MYTHOS-HANDOVER.md](MYTHOS-HANDOVER.md)). The phase has not been independently re-attacked.

**Declared slip:** during W4 one scratch-copy build directory was removed with a path built from a variable, against
the server habit of literal absolute paths (`.claude/rules/remote-operator.md`). Only the scratch copy's build output was
affected.
