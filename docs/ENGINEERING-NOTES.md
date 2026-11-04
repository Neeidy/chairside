# Engineering notes — salon-booking-bot

> **What this file is:** the internal engineering detail that used to sit in the README, **moved here verbatim** from
> `README.md` at `9b6babb` (2026-11-03) when the README was rewritten for a first-time reader (ruling (2) of that
> brief: moved, not deleted). The statuses below are **as written at `9b6babb`**; the live status of every item is in
> [`ROADMAP.md`](ROADMAP.md), and the decisions are in [`ARCHITECTURE-DECISIONS.md`](ARCHITECTURE-DECISIONS.md).
> Relative links in the moved text pointed from the repository root; they are rewritten to point from `docs/`.
>
> **Superseded since that text was written, stated rather than silently edited:**
> - *"The date guard, and what it does NOT cover"* (2026-09-09): DATE-PHRASING (closed 2026-11-02) now resolves a day +
>   month and numeric dates, checks a named weekday against the date, puts the year in both confirm asks and refuses a
>   date beyond the 30-day horizon ([`DATE-PHRASING-PLAN.md`](DATE-PHRASING-PLAN.md) §2, "R2d"). The bullet's other
>   limits were not re-measured for this move.
> - *"The reschedule orphan alert does not say which old slot to clean"* (the whole row, not only its "Main is not
>   edited before this release"): **the item is DONE, not v2.** The staged change was promoted with the 7-2 R3 Main
>   (`784cdd8`, 2026-10-26): `Build Reschedule Orphan State` builds `reschedule_old` (date, time, service) and
>   `Build Owner Alert` reads it (`tests/unit/reschedule-orphan-alert.test.cjs`, in `check-all`). *(This bullet said
>   "the v2 ruling on that row itself stands" until 2026-11-03; corrected in place, CLOSE-OUT row 51 —
>   `PHASE-7-PLAN.md` §4b is corrected the same way.)*
> - *"the W57/W58/W60 text mismatch"* (in the older v2 / LATER bucket row): already closed on 2026-09-13 (CP 6c-3,
>   ruling K-4 "the code wins, the document is corrected"; `SCREEN-INVENTORY.md` §2.10.1a), so it was stale before the
>   move. Found 2026-11-03 while tracing PHASE-6-BACKLOG for the CLOSE-OUT.
> - *"Main: node names still say 'Airtable'"*: no node name in the committed Main export contains "Airtable"
>   (`security-auditor`, 2026-11-03), so that row was already inaccurate at `9b6babb`.
> - This list holds what was found while moving the text; it is not a full re-audit of every moved line.

## Not yet — deferred to v2 (ruled 2026-10-24)

Known, named, and deliberately left out of this release. Only one of them can make the bot do something wrong
around a booking: the reminder row, a narrow window, named there. The other named items that would have were sent to
Phase 7's fix checkpoint instead.

| Item | Why it waits |
|---|---|
| **F5** — the deploy-separation guard checks import *spelling*, not reachability | a guard that can miss, not a present leak: Codex found no dashboard-reaching import in the public packages |
| **F6** — the hardlink identity check is a substring match | it can over-report (a false positive), never miss a leak |
| **F9** — the client-import gate does not enumerate `.mts` / `.cts` | no such files exist today; a coverage gap for a future refactor |
| **F10** — the dashboard's runtime browser guard is a DOM-presence heuristic | the build-time server/client boundary is the real control; the runtime check is a diagnostic |
| **F11** — the database schema accepts an empty id, an infinite timestamp and a `NaN` spend, which the dashboard panels would misread | no writer produces them today; tightening needs a migration file and an operator apply |
| **F13** — a capped appointment window can say "Nothing booked ahead" | inherited 1:1 from the Airtable dashboard; it needs more than a hundred cancellations inside the window to show |
| **Two dead config keys: `instagram`, `business.locale`** (K-2) | they drive nothing — there is no Instagram adapter, and customer-facing dates use the n8n runtime's default locale — so they cause no wrong behaviour. **But the config is not fully config-driven while they exist** |
| **The `handoffShown` twin** in `web/snippet` | the snippet and the site each record "lock line shown" at their own call site; deleting that line from one caller leaves the parity suite green — a test blind spot, not a runtime defect |
| **Reschedule reject symmetry (W64/W65)** | a closed-day or busy reschedule offers no working hours and no alternative, while the same rejection in booking does — inconsistent help, not a wrong action |
| **Rebooking a slot you just cancelled** — a customer who cancels and then books the exact same slot and service is handed to a human instead of booked | Google keeps the cancelled event's deterministic id reserved, and the reconcile step correctly refuses a cancelled event. The fix changes the event-id scheme or the reconcile branch, and needs a real calendar write to prove; the customer is never double-booked, only passed to the owner (ruled v2, 2026-10-25) |
| **A reminder for an appointment cancelled while the database mirror was failing** | if the cancel reached Google Calendar but the database row could not be updated, the hourly reminder job can still remind that customer. Closing it means Reminders checks the calendar before sending, which needs a new Google credential in that workflow, so it is not the small change it first looked like (ruled v2, 2026-10-25) |
| **The reschedule orphan alert does not say which old slot to clean** — when moving an appointment cannot remove the old calendar event, the customer is told "moved" (true: the new booking exists) and the owner gets an alert, but the alert does not name the old date, time and service | the fix is written and tested offline; it changes the Main workflow, and Main is not edited before this release (ruled v2, 2026-10-25) |
| **A second owner-alert channel** | owner alerts have one channel (Telegram); if it is down, failures are visible only in the n8n execution log |
| **The older v2 / LATER bucket** (unchanged since 2026-09-17): the idempotent replay's stored reply · `messageTemplates` required keys · the transcript lost on navigation · font subsetting · a `Customers` table · BULGU-4 · R2 · the W57/W58/W60 text mismatch | they improve the product but do not change whether it can be sold (PHASE-7-PLAN → Open items) |


**7-2 CONVERGE items deferred (ruled 2026-10-26, 7-2 R4).** Three were fixed instead (the scanner's `++` lines, the n8n encryption key rule, the postgres URL rule); the fourth, a hook refusal of `--no-verify`, was dropped by ruling (see below); these wait:

| Item | Why it waits |
|---|---|
| deploy tool: a snapshot's age is not checked | snapshots are deleted once an edit closes (`remote-operator.md`), and any snapshot must still pass the webhook invariants before a rollback |
| deploy tool: the Turnstile-window helper reads its spec from any path (D6c review) | its one caller passes `db/copies/main.json`; `workflow-step.py` requires `db/copies/` for every live write |
| deploy tool: the Turnstile window's holder check has no fallback for a listing without nodes (D6c review) | such a listing gives 0 holders, which is red, never a pass |
| deploy tool: a snapshot directory inside another git work tree is accepted | snapshots live in the session scratchpad by procedure; only this repo is refused, which is the leak that matters |
| deploy tool: the helper's `api` raises on an empty curl output | a traceback still stops the run; every next step reads the copy's state before writing |
| deploy tool: `activate` does not re-check the Turnstile literal | `put` checks the literal on the export and in its live read-back before any activate |
| deploy tool: spec and WORKFLOWS are read from the working tree | `check-all` and the pre-push audit run on a clean tree before every live step |
| deploy tool: nodes sharing a name are invisible to name-keyed comparisons | no committed export has a repeated node name (counted at 7-2 R4) |
| deploy tool: put's read-back re-verifies only the trigger's webhookId | only the trigger's id routes inbound traffic; the Telegram nodes' ids are kept by name |
| deploy tool: `settings` does not enforce running after the probes | the runbook orders it last, and the check after it is a body probe that counts no executions |
| deploy tool: pre-snapshot parity cannot see an IF/Switch condition's option fields | no gate decision depends on them today (R2b) |
| secret scan: an agent could commit a secret together with its own exception line | the exception file is a committed, reviewed file, and every push is audited by `security-auditor` first |
| secret scan: UTF-16 content and a key in a file name are not rules | no UTF-16 file in the repo; file names are read in the pre-push audit |
| secret scan: replace refs can hide a pushed object | no replace ref exists here (counted at R4); `--no-replace-objects` was measured to work |
| secret scan: C-quoted path names skip the JSON header-pair check | no tracked path needs C-quoting (counted at R4) |
| secret scan: `SECRET_SCAN_API=3` also matches `=30`; `--remotes=<name>` trusts that namespace | an internal marker; one remote |
| secret scan: fingerprint corner cases (a non-UTF-8 path, a path with a space, three shown per rule, a `--no-ff` merge of an old branch) | each fails strict: the hit stays a hit |
| secret scan: a hard link from an installed copy, a symlinked hooks directory, another worktree's hooksPath, the CC hook's ignore file | the installer writes fresh files from HEAD; one worktree, no symlinked hook (counted at R4); an absent ignore file means no exceptions |
| secret scan: labels print the file path unmasked; a second secret on a hit line shows as context | paths are repository paths, public already; the shown line redacts every 12+ character token, and the line is blocked either way |
| secret scan: manual mode resolves paths against the cwd; a long placeholder prefix now blocks | run from the repo root by habit; the placeholder case fails safe |
| masking: NFKC folds some symbols into letters, non-`Nd` digits are not digits, a 7–8 digit number shows four digits | data minimisation for the owner's own screen, not a security boundary; the golden table covers real phone forms |
| masking: `maskName`'s fallback keeps runs under seven digits whole; a lone `\r`, NEL and U+2028 are not line breaks; test-hygiene notes | below the seven-digit rule by design, or rare input on the owner's screen |
| Main: a verify read with NO `items` key counts as an empty list | a ruled carve-out (R2); reopened only if Calendar is seen omitting the key |
| secret scan: the n8n-key rule misses a human-chosen passphrase with dots or spaces; the postgres rule misses `?password=` or a `/` in the password, and blocks placeholder passwords such as `user:password@` | generated keys and URL-embedded passwords are caught; a false block is visible and a committed line can be excepted by fingerprint |
| secret scan: the git pre-push gate can be bypassed by `--no-verify` (or a core.hooksPath override); guarded by habit, not by code | ruled 7-2 R4: a command-line check was built in three versions and each later one let through forms an earlier one caught; the habit is written in `remote-operator.md`, and every push is audited by `security-auditor` first |
| secret scan: busybox awk ends a working-tree line at a NUL byte | manual mode only — the gate reads committed patches in its Python engine; this machine's awk handles NUL (measured by the R4 review) |
| secret scan: the PLACEHOLDER strip is quadratic on a very long run of key characters | it fails closed (a slow scan blocks the push, never passes it); no such line in the repo |
| Main: node names still say "Airtable" | a node rename is a Main edit; it rides the next one (D6c's Main put renames the workflow only) |
| Main: D-c — an alert can run ahead of the reply on a few paths and delay it | bounded and documented (FLOW-DIAGRAM); restoring it is a Main edit |

**The final security pass: what stays open (7-4 B, ruled 2026-10-28; [PHASE-7-PLAN §4j](PHASE-7-PLAN.md)).** Done
in the pass: the Cloudflare API token replaced by a read-only one that expires (its scopes and the old token's deletion
measured by Cowork; its expiry by the build); the stored Owner Actions executions
deleted (they held an Access token and a cookie); the archived Main original deleted. The rest is either v2 or
**deferred by the owner, recorded** — an accepted risk until the system is complete, not a closed item:

| Item | Status | What bounds it meanwhile |
|---|---|---|
| The leaked `/api` and owner-path Access service tokens, and the n8n API key | deferred by the owner, recorded → **declined by decision 2026-11-04** (the last table of "Closed by decision — CLOSE-OUT", row 40) | the copies are on this machine (transcripts, backups), not public; `/api` needs the service token and the API key, the owner path needs a signed request as well; one later rotation voids every copy at once |
| Revoking the Access sessions; a 24 h dashboard session | deferred by the owner, recorded | the stored executions that held a session token are deleted |
| The Airtable token and base | deferred by the owner, recorded | no workflow and no n8n credential reaches it since D6c; the base is kept until its export (MIGRATION-PLAN §7, Gate 1) |
| Deny rules for every secret-file copy; the tunnel credential in a root-only file; a pinned backup script; an off-server backup target | deferred by the owner, recorded | the secret files are mode 0600 and outside git; the nightly dump is restored and compared before it counts, but it lives on the same server |
| `salon_ro` reads every column; the dashboard's write check is cached; the dashboard logs and shows raw driver errors | v2 | the database role is read-only and the dashboard sits behind Access |
| The infra owner alerts take `sender`/`channel`/`stage` from the error item; a stale line in the intent prompt (reschedule "routed to a human") | v2 | both need a Main edit; with the stale line the model still classifies `reschedule` (G11, 7-4 A), and routing is the workflow's |

**What the regression covers on Postgres, stated (ruled 2026-10-25):** the full suite last ran on the Main copy's test path (D4b, 28/28; the cutover diff proves only the path differs); the production path was exercised by the routing smoke (A1), the dashboard write path (A2, 13/13) and the 7-1 window (a truly simultaneous race pair and a DST booking) — live measurements recorded in PHASE-7-PLAN, their raw output not committed; the seeded ⚙ scenarios were not re-run on Postgres — their paths are covered by D4b G1–G3 and the M7 error drills.

**Not tested end to end: the WhatsApp lane (K-5).** The regression drives the widget lane only; Zernio's inbound
webhook is deliberately closed for spend safety, so no current test crosses the WhatsApp adapter boundary. It was
proven live once in Phase 4, before the store moved. "Regression green" does not mean "the WhatsApp path works".

## Security — the honest limits recorded in the README

- **A finding from this build, recorded honestly:** the LLM webhook was discovered publicly reachable
  with no rate limit or spend cap. It was taken offline immediately and re-publishing is gated behind
  the Phase-5 brakes. Documented in [`docs/ARCHITECTURE-DECISIONS.md`](ARCHITECTURE-DECISIONS.md).
- **The date guard, and what it does NOT cover (honest limit, 2026-09-09).** The engine — not the model —
  resolves the booking day: the LLM's date is a disagreement signal, never a value. That closed a real
  wrong-day booking (the model answered a Saturday for "friday morning" at `confidence=0.92`, reproduced
  live again during the final drill and overridden). **Four things it still does not do, each with a
  reproduction in [`docs/ROADMAP.md`](ROADMAP.md):** a week shift the sentence carries but the model's
  wording does not is NOT detected (the confirmation step showing weekday + full date is the only backstop);
  a day named in a form outside the recognised vocabulary ("the 20th", "next weekend", non-English) can still
  let a previously stored date stand; the separator fold covers the dash and slash families, not every
  Unicode look-alike; and on a confirmation turn a change request that cannot be resolved writes the date the
  customer was shown. These are demo-grade limits on a template with **zero real customers** — named here
  rather than left for a reader to discover.
- **The extraction-retry path has never been TRIGGERED in production (honest limit).** Precisely: in the live
  drill `Extraction Transient?` executed on every turn and took its FALSE branch every time, while
  `Repeat Extraction Failure?` and `Build Extraction-Retry State` never executed at all. So one node has run
  and never fired, and two have never run. **That per-turn execution count is itself UNVERIFIED here:** its
  only basis is the previous round's drill write-up — the execution log is not committed, so a reader cannot
  re-derive it from this repo. *(An earlier wording said "three safety nodes have never run",
  which the drill record contradicts — "the node never executed" and "its real trigger was never exercised"
  are different claims and only the second is true of all three.)* The trigger — the model omitting a required
  schema KEY — cannot be induced on demand against a live model, so the path has unit and mutation evidence
  only. The drill proved the surrounding behaviour did not regress, nothing more.
- **Cancel identity (honest limit):** a customer can only cancel their OWN booking — cancel looks up
  appointments by the channel-authenticated `sender_key`, never a customer-supplied booking id, so IDOR
  is structurally impossible. On the widget, though, `sender_key` derives from a **client-supplied
  `sessionId`** — session-token strength, not a verified identity. Endpoint rate-limiting (a Cloudflare edge rule — 30 requests per 10 s per IP and data
  centre — whose blocking was shown on 2026-10-30) and Turnstile (Phase 5) raise the cost of abusing it; they do not make the session an identity. Recorded in
  `docs/ARCHITECTURE-DECISIONS.md` §5.

## Config / code / secret — the full statement

**Config / code / secret are separate — shown offline, with its bounds.** The engine's config sits inside its nodes
(three inline copies, plus the owner's chat id and the Turnstile secret), so a new client used to mean editing them.
Since Phase 8's first round, **a new client = a config file + secret inputs → `scripts/render-client.py` → import into
its own n8n; no node edited by hand** (with both secret inputs given) — shown offline on a second, fictional client (`tests/unit/render-client.test.py`: only the ten measured slots differ from the demo's workflows; a synthetic client whose every config value differs from the demo's shows every key of the three config literals fed from the client's own config (the few-shot from its first service, the chat id and Turnstile secret from its secret input); and no demo-client string of five or more characters reaches the new client outside six allowlisted code comments and fallbacks;
`tests/unit/render-client-mutants.py`, 35 mutants red), with these bounds in the same breath:
EUR only (`priceEUR`, and `€` written in two nodes), customer text in English, two config keys that drive nothing (`instagram`, `business.locale`), the prompt carries a fixed example that hair colouring is not offered; a client offering it gets a contradicting prompt until a Main edit (quality only: `Merge Slots` and `Slot Gate` refuse a service id the config does not hold), the new instance's credentials linked by hand, and not yet shown on a real second deployment (`docs/PHASE-8-PLAN.md`; CRT #14: Codex audited the pre-fix code, `docs/codex/phase-8/crt14.md`; the fixes were verified by the internal reviews).

## Closed by decision — CLOSE-OUT (2026-11-03)

> **What this section is:** every **B** and **B-v2** row of the CLOSE-OUT inventory
> ([`CLOSE-OUT-PLAN.md`](CLOSE-OUT-PLAN.md) §0), and since 2026-11-04 the one **C** row the owner declined (the last
> table), closed by a written decision rather than by a build (plan approved
> 2026-11-03 with DC-1…DC-13 as recommended, `ARCHITECTURE-DECISIONS.md` 2026-11-03 rows). **Nothing below is built by
> the CLOSE-OUT** (its NOT-build list, §2). "Reopens when" is the trigger the plan or the item's own record names; where
> neither names one, the row says so instead of inventing it. "Steps" are the plan's §5 steps where it gives them.
> Row numbers are the plan's §0 numbers. The sections above this one are unchanged.

**B — closed by a decision, with a trigger**

| # | Item | Decision | Reopens when | Steps when it fires |
|---|---|---|---|---|
| 5 | The few-shot's fixed "no hair colouring" example | a recorded bound (Phase 8 R2b; quality only — `Merge Slots` and `Slot Gate` refuse a service the config does not hold) | a client that offers colouring | a Main edit of `Build LLM Request` (plan row 5) |
| 6 | The engine does not read siteverify's `hostname`; the Turnstile secret sits in a node | DC-7: B, done with per-client provisioning (#34), which creates the hostname list and the credential (Ruling (d), 2026-10-29: the widget's one-hostname list is the boundary, the engine check is defence in depth) | the second real client (#34) | inside #34's steps below: the engine's `hostname` check added with them |
| 9 | A verify read with no `items` key counts as an empty list | a ruled carve-out (7-2 R2) | Calendar is seen omitting the key | not written in the plan |
| 14 | A name that needs combining marks (`\p{M}`) is refused; a ZWNJ is stripped | a recorded bound (NAME-CAPTURE R3-2, v2) | a client whose customers have non-Latin names | a design change, named in NAME-CAPTURE A2: a mark cap against "zalgo" text, or a ZWNJ exception |
| 15 | DATE-PHRASING's and N1's recorded bounds: the r4 text class (R2d), F2 and F3 (R2e), the in-flight put (R-d), N1's `trim()` LOW | already written as bounds, each with its defence, in its plan | no trigger named — standing bounds. If M2 (the booking-confirm freshness check) is built, F1's premise changes; that is recorded by R1's Main slice, not here | — |
| 16 | EUR only, English customer text, two dead config keys (`instagram`, `business.locale`) | recorded bounds (PHASE-8-PLAN; `honesty-demos.md`) | a client in another currency or language | not written in the plan |
| 20 | Real WhatsApp reminder-template delivery (CP4d-2) | B: it needs a real dedicated WhatsApp Business number, which the customer provisions (ROADMAP, CP4d-2) | a client's own WhatsApp Business number | ROADMAP CP4d-2: the send brake opens only after its precondition there; with #36 below |
| 21 | Release's one-second resend window (Owner Actions) | already a written bound (ROADMAP, "Owner Actions — recorded bounds", R2b OA-2) | no trigger named; the bound assumes the dashboard's and n8n's clocks agree to about a second (same host today) | — |
| 24 | Ship gate #15, the hidden-container check in Managed mode | DC-6: closed by decision. The forced-interactive TEST key showed the challenge inside the panel (PUBLIC-DEMO "DOMAIN + INTERACTION-ONLY"); the real key's challenge was never seen, because the owner's runs passed without one — that is the recorded bound | no trigger named by DC-6; the earlier ruling (RENAME (3)) names what a run needs: a hidden-container harness page on the demo hostname, in a real browser | — |
| 25 | The watchdog's five unswept axes (ROADMAP 6b hand-over #9) | B: one axis needs a real token; the other four are threshold tuning, not a defect | a client reports a stuck widget | not written in the plan |
| 26 | A phone / e-mail field in the widget, per client | out for the demo (RENAME ruling (4): visitors are told not to enter real details); a per-client option later | a client that wants call-backs from the widget | not written in the plan |
| 33 | Ship gate #18: Access's configuration is not in the repo | it stays out — in a public repo it would be a service inventory; the measured behaviour is the control (K-6, 2026-10-24) | no trigger named | — |
| 34 | Per-client Turnstile provisioning | B: required before the SECOND real client (Ruling (d)); not built for the demo | the second real client | plan §5: a write-scoped Cloudflare token created by the owner → the widget created through the API → the site key into the client's frontend environment → the secret straight into that client's n8n credential, never through a chat or a log → the engine's `hostname` check (#6) added with it |
| 35 | A real second deployment | B: shown offline only (Phase 8) | a real client | plan §5: `render-client.py` → import → link the credentials → RUNBOOK §0's provisioning as one procedure, timed |
| 36 | WhatsApp end to end on Postgres (K-5) | B: the webhook stays closed for spend safety | the WhatsApp channel turned on for a client | plan §5: the client's Zernio number → open the webhook (⚠ ONAY, spend) → a real-phone run → the K-5 row closes |
| 37 | Instagram DMs (config-gated; no adapter built) | B | a client asks for Instagram | not written in the plan (the design record: a channel is one adapter + config, ARCH-DEC 2026-07-01) |
| 43 | An off-server backup target; a pinned backup script | DC-8: B (PHASE-7-PLAN §4j #4 and #9: deferred by the owner, recorded) | the first real client, unless the owner names a target earlier | plan §5, for the target: the owner names it → `pg-backup.sh` copies the verified dump there → a restore drill from it. For the pinned script: not written in the plan |
| 47 | A second owner-alert channel | B (PHASE-7-PLAN §4b; triaged v2 by judgment and flagged for the owner) | a real client — an alert that cannot reach the owner is a business risk then | plan §5: e-mail or SMS through a new credential → each alert class sent to both |

**B-v2 — an existing v2 ruling re-affirmed as the close (DC-1)**

DC-1 re-affirms every one of these as v2: reopening them would break "short" and edit Main twice (plan §13). The plan
names no trigger for these rows, so "Reopens when" quotes what each item's own record says it needs.

| # | Item | The v2 ruling | Reopens when (what its record says it needs) | Steps when it fires |
|---|---|---|---|---|
| 3 | The infra owner alerts take `sender` / `channel` / `stage` from the error item | v2 (PHASE-7-PLAN §4j #15) | a Main edit; the error item carries only `{error, message}` | build the three from node references (PHASE-7-PLAN, Open items (5)) |
| 4 | A stale line in the intent prompt (reschedule "routed to a human") | v2 (PHASE-7-PLAN §4j, last row; the model still classifies `reschedule`, G11, 7-4 A) | a Main edit, and a prompt change needs a paid golden re-run (plan row 4) | correct `prompts/intent-extraction.md` and the live `Build LLM Request` line together, then the golden re-run |
| 7 | D-c: an alert can run ahead of the reply on a few paths and delay it | v2 (7-2 CONVERGE; bounded and documented in FLOW-DIAGRAM) | a Main edit | not written beyond "restoring it is a Main edit" |
| 8 | Rebooking a slot you just cancelled is handed off | v2 (7-F1 ruling K3, 2026-10-25) | a real calendar write to prove the fix (a spike first) | change the event-id scheme or the reconcile branch (PHASE-7-PLAN §4b (3)) |
| 10 | A change request during a confirm (the "change" intent) | v2 (ARCH-DEC 2026-09-09e: a product feature that gets its own phase and gate; not reopened by N1) | its own phase | a change request handled as its own intent and flow (ARCH-DEC 2026-09-09e) |
| 12 | The second uncertain turn live; golden G8 / G10 / G11 not run | v2 (PHASE-7-PLAN §4j "Golden set": "needs a seeded stage, not run") | a seeded stage, and an approved window for the LLM spend | not written in the plan |
| 19 | A reminder for an appointment cancelled while the database mirror was failing | v2 (7-F1 ruling K4, 2026-10-25) | a new Google credential in the Reminders workflow | Reminders reads the event before sending (PHASE-7-PLAN §4b) |
| 30 | Dashboard security: `salon_ro` reads every column; a cached write check; raw driver errors | v2 (PHASE-7-PLAN §4j #3, #6, #8, #10) | no trigger named; the bound meanwhile: the role is read-only and the dashboard sits behind Access | — |
| 31 | The older v2 / LATER bucket (the idempotent replay's stored reply, required template keys, the transcript lost on navigation, font subsetting, a `Customers` table, BULGU-4, R2) | v2 since 2026-09-17 (PHASE-7-PLAN, Open items) | no trigger named: "they improve the product but do not change whether it can be sold" | — . ⚠ **Correction:** the plan's row 31 and the bucket's moved text above also list "the W57/W58/W60 text mismatch"; that item was **closed on 2026-09-13** (CP 6c-3, ruling K-4, `SCREEN-INVENTORY.md` §2.10.1a), so it is not re-affirmed here |
| 32 | F5, F6, F9, F10, F11, F13, the `handoffShown` twin, W64/W65 | v2 (PHASE-7-PLAN §4b; this file, "Not yet — deferred to v2") | the condition each row's reason relies on stops holding — e.g. F9: a `.mts`/`.cts` file appears; F11: a writer that can produce such a value; F13: more than a hundred cancellations inside the window | per row, as its reason says (F11: a migration file and an operator apply) |
| 38 | The 7-2 CONVERGE deploy-tool, secret-scan and masking LOWs | v2 (7-2 R4, ruled 2026-10-26; this file's 7-2 CONVERGE table) | the condition each row's "why it waits" relies on stops holding (each row names it) | per row |

**C — an owner step declined by the owner (2026-11-04)**

The C rows are the owner's steps (plan §6). One of them is closed by his written decision rather than done; C-4 and C-5
were weighed against the same reasoning and stay OPEN (plan, section "C-3 declined"), so they are not in this table.

| # | Item | Decision | Reopens when | Steps when it fires |
|---|---|---|---|---|
| 40 | #17b–d: the `/api` Access service token, the owner-path Access service token, the n8n API key (leaked into CC's report on 2026-09-13; 17a done, 17e accepted) | **declined for now** (Yigitcan, 2026-11-04): the exposure was CC's own transcript on the server that holds the env files, so rotation adds little against the realistic threat (server access yields the env files directly); the `/api` path needs both the API key and the Access token; Turnstile, the spend cap and the pause bound the worst case | before the first real client, or before anyone else gets access to the server | plan §6 C-3, in the order 17d → 17b → 17c: the new value into a new 0600 file → CC checks the old and the new → the owner revokes the old → CC checks → the rename under ⚠ ONAY |
