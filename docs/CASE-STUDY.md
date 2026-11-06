# Case study — salon-booking-bot

> **Honest status:** a **demo / learning build**, not a system serving paying customers. Every number below is one
> that a committed record holds; the record is named beside it. Mock config on the real engine, synthetic test data.
> Where something is not built, not tested or only bounded, this page says so in the same sentence.
> Written at 7-3 (2026-10-27); the widget section (§9) moved here from the README. **§10–§13 were added at the
> public-demo close (2026-11-03):** going public, then the three defects the live runs found after it. Stale lines in
> §2, §3 and §8 were corrected in place on the same day.

## 1 · The problem

A barbershop loses bookings because messages arrive while the owner is cutting hair. The bot answers at once, in the
shop's voice, and turns each message into one of two outcomes: **a booked appointment**, or **a captured lead and a
human handoff** — with zero double bookings as the correctness contract (`.claude/rules/booking-integrity.md`).
It is built as a **template**: the goal is that a new client means a new config file and new credentials, not new
code. Shown offline since Phase 8's first round, with its bounds (§8); not yet on a real second deployment.

## 2 · The approach

- **One isolated deployment per client** (Model 1; tier T1 in `CLAUDE.md`): no multi-tenancy to get wrong.
- **n8n as the engine**, self-hosted; a Next.js site (public on Vercel since 2026-11-01, §10), an embeddable widget script, and an
  owner dashboard on the same server behind Cloudflare Access (`README.md`, "Stack").
- **Plan before build, one verifiable step at a time**, each phase behind a written approval
  (`.claude/rules/plan-gate.md`), and five layers of review: the builder's self-check, repo review agents, an
  independent second tool (Codex) on named high-risk targets, an architecture review from git, and the owner's final
  approval (`CLAUDE.md`, "Defense-in-depth").

## 3 · Architecture: the LLM is a translator, nothing more

Every message, from WhatsApp or the web widget, is normalised to `{channel, sender_key, text}` and runs through one
channel-agnostic flow (`README.md`, "How it works"; `docs/FLOW-DIAGRAM.md`):

1. validate the payload · 2. load the conversation state from Postgres · 3. stay quiet if a human took over ·
4. guards before any model call (kill-switch, max turns: no LLM cost) · 5. **the LLM extracts a structured intent** ·
6. the output is validated against the committed schema · 7. a confidence and intent gate · 8. deterministic routing.

**What the model may do:** turn free text into JSON — one of eight intents
(`book · confirm · cancel · reschedule · capture_lead · answer_faq · handoff · unknown`), a confidence, and slots
(`schemas/intent.schema.json`). **What it may not do:** write a customer-facing answer (the prompt asks for `reply: null`, and
the text the customer sees is built by deterministic workflow code — config templates, or fixed strings in the nodes —
`tests/jailbreak-cases.md`), choose an action, or hold a write permission. An injected instruction has
nothing to escalate into: the allow-list is the schema enum (`.claude/rules/prompt-injection.md`,
`tests/jailbreak-cases.md`).

**Correctness by construction, not by a lock that does not exist:**
- **Idempotency:** the message id is CLAIMED at the start of the turn in one `INSERT … ON CONFLICT DO NOTHING
  RETURNING` on a UNIQUE column; a redelivery finds the claim and books nothing. The cost, stated: at-most-once — a
  run that dies after its claim is not retried for that message (`booking-integrity.md` §1).
- **No double booking:** Google Calendar owns availability. A booking writes the event, re-reads the slot, and yields
  its OWN event if another one overlaps; only a winner writes the Postgres mirror row. There is no atomic lock across
  Postgres and the calendar, and two bounds are written down rather than hidden: a truly simultaneous pair can both
  yield (no double booking, no booking), and if the verify read itself FAILS, two writers can both keep their events —
  both customers are then handed off and the owner is alerted to cancel one by hand (`booking-integrity.md` §2).
- **Failures are visible, and an outage never looks like a conversation:** five handoff classes stay distinct —
  guard-trip, infrastructure-unavailable, intent-handoff, clarify, and extraction-transient (`.claude/rules/handoff.md`).
  Infrastructure-unavailable carries an `error` flag (`llm_unavailable`, `calendar_unavailable`, …) and an owner alert.
  Its status depends on the claim: once the message id is claimed it answers **200 with a polite reply**, because a
  5xx would make the channel retry a message that is already claimed (the retry would only be a duplicate); only a
  failure before the claim answers 503 (7-2's CLAIM-RETRY ruling; `tests/unit/main-tur2.test.cjs`).
- **Spend brakes:** a monthly LLM spend cap checked before any paid call. It fails CLOSED: if the spend meter cannot be
  read, no model is called, the customer gets a handoff reply and the owner a `spend_meter_unavailable` alert (`Eval
  Spend`; ruling (d), `docs/ARCHITECTURE-DECISIONS.md` 2026-10-29). *(Corrected 2026-11-03: this line said the cap
  fails OPEN. That was true when it was written; going public changed it, §10.)* a per-conversation turn cap (12 in the example config);
  an explicit timeout on every external HTTP call (60 s for the LLM, 15 s for the others); a dry-run switch that skips
  the calendar insert and the WhatsApp send while conversation and lead rows are still written (`bot.dryRun`, off in
  the example config; Main's `Dry-run note`); and a kill-switch that turns the bot into handoff-only. Two
  timeout gaps are recorded with them: the Postgres nodes and the Telegram alert nodes set none
  (`.claude/rules/spend-safety.md`).

## 4 · The AI-versus-deterministic split

| Decision | Who makes it | Why |
|---|---|---|
| What does the customer want, and which slots did they name? | **the LLM** (Claude Haiku 4.5, structured output) | the one genuinely free-text problem |
| Is the model's answer well-formed? | `Validate Intent`, an ajv validator **generated** from the committed schema, with a drift check | a hand copy of a contract drifts (`.claude/rules/contract-integrity.md`) |
| Is the model sure enough? | a threshold (`bot.confidenceThreshold`, 0.7 in the example config); the first uncertain turn asks once, a second hands off | self-reported confidence is poorly calibrated, so the bot abstains instead of guessing |
| Which day is "this Friday"? | `Resolve Date`, deterministic, in the shop's timezone, from the customer's own words (`dateExpr`) | the model was once wrong about a date at confidence 0.92, which no threshold catches (MASTER-BRIEF §9, CRT 12) |
| Price, hours, services, address | config lookups | the answer path contains no model, so it cannot quote a wrong price |
| Is the slot free? Book it? Cancel it? | IF/Switch, the calendar, write-then-verify, a confirmation turn | irreversible actions need rules, not judgement |

## 5 · The migration: Airtable → self-hosted Postgres

**Why.** The free Airtable plan allows 1,000 API calls a month per workspace, shared by the bot and the dashboard,
and 5 requests a second per base. On 2026-10-06 the quota ran out with no customer traffic at all, and the bot had no
data layer for almost twelve days (`docs/OPERATIONAL-INCIDENTS.md`, OPS-5; `README.md`). The move to self-hosted
Postgres was ruled on 2026-10-19 (`docs/MIGRATION-PLAN.md`).

**How — copy, cut over, retire.**
- **A restore point first** (D0, 2026-10-19), then the schema (`db/schema/001–003`), least-privilege roles (n8n's
  role has DML on the five tables plus their sequences and two helper functions; the dashboard's role
  has SELECT only — `db/schema/002_roles.sql`), and a nightly
  backup that restores every dump into a throwaway container and compares every table before the dump counts
  (`db/ops/pg-backup.sh`).
- **Copies, never edits:** each of the five workflows got a Postgres copy beside its untouched Airtable original,
  tested on a test path. The behaviour contract was preserved by building Postgres queries that return Airtable's
  record shape (`docs/MIGRATION-PLAN.md` §3a, §3b).
- **The cutover**, on 2026-10-24 between 14:15 and 14:18 UTC, one workflow at a time: deactivate the original, move
  the copy to the production path, activate it, measure. n8n refuses a second active workflow on the same path
  (measured: 409), so a broken order would have failed loudly instead of splitting traffic. Acceptance ran the same
  day: a routing smoke test and a race drill in one 97-second Turnstile window, the owner write path's drill
  (`run-d11`, 13/13 on the production paths), the dashboard's release end to end, Reminders' first scheduled run, and
  port 5432 closed from outside (an operator statement, not measured by the build) (`docs/ROADMAP.md`, migration row).
- **Retirement (D6c, 2026-10-27):** the five originals archived, n8n's Airtable credential deleted, the copies renamed
  to their clean names through the reviewed deploy tool, one workflow at a time with a rehearsal on a scratch first;
  every webhook path and id read back unchanged (`docs/MIGRATION-PLAN.md` §7a). The archived Main original was deleted
  in 7-4 B (2026-10-28); revoking the Airtable token and deleting the base were deferred by the owner, recorded
  (PHASE-7-PLAN §4j). *(Since 2026-11-04 the base is kept, and its tokens were revoked by the owner in CLOSE-OUT C-6.)*

**What Postgres costs instead:** a database to run, back up and restore for every client.

## 6 · The independent audit (7-2)

**Who and what.** Codex — a second tool, not the one that built the code — audited every open Critical-Review Target
(MASTER-BRIEF §9: idempotency, concurrency, the calendar write, secrets and PII in a public repo, the handoff
threshold, error visibility, the dashboard, the owner write path, date resolution) at commit `f1a47eb` on 2026-10-25.
Seven of the nine runs ran in isolated containers with a mount check; two ran on the host, and the commands a log
checker flagged there were ruled false positives (`docs/codex/7-2/containment-1a-9.md`). The prompts and the raw
outputs are committed verbatim (`docs/codex/7-2-prompts.md`, `docs/codex/7-2/`).

**What it found.** No CRITICAL; 12 HIGH, six of them in the Main workflow; the rest MEDIUM and LOW
(`docs/ROADMAP.md`, 7-2 Tur 1). Examples, each in its target's row in MASTER-BRIEF §9:
- **Idempotency (1a), HIGH:** a failed end-of-turn marker permitted a later duplicate. **Fixed** by claiming the
  message id at the START of the turn (claim-first).
- **The calendar write (2):** two HIGH and a MEDIUM, **all closed** at the recheck.
- **Secrets and PII (4):** five HIGH and three MEDIUM, **all closed**; the row closes on the repository guards, the git
  pre-push secret scan among them.
- **The dashboard (9):** three MEDIUM and a LOW, closed; the owner's CSV export ships masked, and its live sample was
  shown with synthetic names and phone numbers (7-2 R4).
- **Error visibility (6):** two HIGH, two MEDIUM, one LOW, **all closed.**
- **The owner write path (11):** one HIGH and three MEDIUM. The HIGH and one MEDIUM closed at the first recheck; the
  rest, and two MEDIUM and a LOW the recheck found, closed at the second, with one recorded bound (OA-2).

**How it was triaged.** The triage was the owner's rulings, not the builder's choice: fix now, fix in one batch (Main
was to be edited at most once, for all of its findings together), or record as a bound. The fixes were built offline
and **rechecked by Codex twice** (`815ddd7`, then `5577533`) before any
live change. The live change itself (7-2 R3, 2026-10-26) went through a rehearsal on a scratch copy first — which
caught **two defects in the deploy tool before any production write** — then the Main edit, a probe, and a 72-second
Turnstile window covering a booking, a reschedule, a cancellation and a handoff; both parity guards were green after it
(`docs/ROADMAP.md`; PHASE-7-PLAN §4g).

**What is a recorded bound, not a fix.**
- **Concurrency (1b):** the verify-unavailable path described in §3 — a ruled bound (R-Q1), now stated in the rule
  file. Its alert path was not driven live.
- **The owner write path (11):** an alert when the target read fails is a recorded bound (OA-2).
- **The widget (13):** an open Shadow DOM is style encapsulation, not a security boundary; the only fix is a
  cross-origin iframe, which is on the NOT-build list (§9 below).
- **The push gate's bypass:** `git push --no-verify` switches the pre-push scan off. A check that refused it was built
  three times and each version let through forms the previous one caught, so it was dropped by ruling; the bypass is
  guarded by habit, not by code (`.claude/rules/remote-operator.md`).

Every one of the nine targets is `[x]` — audited AND findings addressed — in MASTER-BRIEF §9; the table's legend
allows no third state.

## 7 · What I learned

Each of these is written down in this repo now — the first five as rules, the last two as procedure — because the
failure happened first (the list after it was added at the public-demo close):
- **A claim about a guard is written after the mutation test, never beside the code.** Three coverage claims written
  in the same keystroke as the code were false; one was deployed (`.claude/rules/reporting.md`).
- **A control that cannot go red proves nothing.** A listener sweep printed OK for the exact orphans it was written
  for, because its own command could not produce the column it tested (`.claude/rules/remote-operator.md`).
- **An empty result is a claim about the instrument.** 215 conversations were reported as "no drill marker" because
  the search did not know the repo's drill prefixes (`reporting.md`).
- **An outage must not look like a handoff,** or nobody ever learns the system is broken (`handoff.md`).
- **The second reader finds what the author cannot.** A docs-only diff that "obviously" could not break anything
  carried a false sentence about a live port; the pre-push security review measured the port and caught it
  (`reporting.md`).
- **Rehearse every live change on a copy.** In 7-2 R3 the rehearsal on a scratch copy caught two defects in the deploy
  tool before any production write (`docs/ROADMAP.md`); every live edit now starts with
  `workflow-step.py rehearse-rollback` (`docs/RUNBOOK.md` §3).
- **Even viewing has effects.** Opening the Main workflow in the editor and pressing auto-layout changed its draft
  (179 node positions, three sticky sizes) without publishing it — and one workflow setting, which applies to the
  running workflow because n8n does not version settings; the parity guard showed it (`docs/RUNBOOK.md` §6).

**Added at the public-demo close (2026-11-03)**, each from a round recorded in its plan:
- **A live run finds what an offline test cannot — and the fix is to make the offline test replay the live script.**
  NAME-CAPTURE's suite and its mutants were green, and the owner's first run still hit a date wording that no test had
  ever sent. The chat-replay harness exists because of it, and every line handed to the owner is now replayed through
  the staged workflow first (§11).
- **Declare the stop before you measure.** DATE-PHRASING's text-side date checks were adjusted three times; the
  threshold for a fourth was written down before the next audit. When it was met, the work stopped tuning patterns
  and moved the guarantee into the structure: the year in the confirm and a 30-day horizon (§12).
- **Measure today's behaviour before designing the change.** N1's plan began by replaying the committed workflow. That
  replay showed the worst case — a "no" turning into the cancel of a different booking — before any design existed
  (§13).
- **A probe below the threshold is not a test of the threshold.** The first rate-limit probe sent 25 requests against a
  rule that blocks from the 31st and was recorded as a failure; the rule was right and the probe was wrong (§10).
- **A brief's wording is a claim too.** N1's last round stopped on "no alert" because one turn did alert. The alert
  came from an older guard upstream of the change, the same model answer alerts on the workflow from before N1, and the
  criterion was "no alert from the N1 nodes". The stop was right; the attribution decided it (§13).

## 8 · Production-next: "one swap to real", and what that does not yet mean

Going live for a client means **their real WhatsApp number (Zernio), their Google Calendar, and their own Postgres** —
under Model 1 a Postgres service, its secrets and its backup step per client (`docs/RUNBOOK.md` §0) — not a rebuild.
What stands between that sentence and a fact, stated (`.claude/rules/honesty-demos.md`):
- **"No code change" is shown offline, with bounds.** The engine carries its config as literals inside its nodes
  (three inline copies, the owner's chat id, the Turnstile secret, and the prompt's few-shot service — ten slots in
  all, measured). Phase 8's render fills them from a client's files: **a new client = a config file + secret inputs →
  render → import into its own n8n; no node edited by hand** (with both secret inputs given), proven offline on a
  fictional second client — only the ten measured slots differ from the demo's workflows; a synthetic client whose every config value differs from the demo's shows every key of the three config literals fed from the client's own config (the few-shot from its first service, the chat id and Turnstile secret from its secret input); and no demo-client string of five or more characters reaches the new client outside six allowlisted code comments and fallbacks (`tests/unit/render-client.test.py`; 35 mutants red,
  `tests/unit/render-client-mutants.py`). The bounds, stated with it: EUR only (`priceEUR`, and `€` written in two nodes), customer text in English, two config keys that drive nothing (`instagram`, `business.locale`), the prompt carries a fixed example that hair colouring is not offered; a client offering it gets a contradicting prompt until a Main edit (quality only: `Merge Slots` and `Slot Gate` refuse a service id the config does not hold), the new instance's credentials linked by hand, and not yet shown on a real second deployment. Codex audited the pre-fix code (CRT #14, `docs/codex/phase-8/crt14.md`): no HIGH; of its four MEDIUM and two LOW, five are fixed and one (M1) is the hair-colouring bound above, accepted by the owner; the fixes were verified by the internal reviews, not re-audited by Codex
  (`docs/PHASE-8-PLAN.md`).
- **WhatsApp end to end is not tested** in this phase (PHASE-7-PLAN, DoD row: K-5).
- **The golden set's paid run and the jailbreak re-run** ran in 7-4 A (2026-10-27): 12 of 15 golden cases pass as
  specified, and no jailbreak case ran an action node (`tests/golden-set.md`, `tests/jailbreak-cases.md`). The other
  three golden cases (G8, G10, G11) need a seeded conversation stage and were **not run** in it.
- **The final security pass closed in 7-4 B (2026-10-28), and most of it is not "fixed".** Done: the Cloudflare API
  token replaced by a read-only one that expires (scopes measured by Cowork), the stored Owner Actions executions that held an Access token and a
  cookie deleted, the archived Main original deleted. **Deferred by the owner, recorded** as accepted risks until the
  system is complete: rotating the leaked Access service tokens and the n8n API key, revoking the Access sessions and a
  24 h session, the Airtable token and base, the root-side steps and an off-server backup target. *(Since the CLOSE-OUT
  of 2026-11-04: the 24 h session set; the service-token rotations, the session revocation and the root-side tunnel move
  closed by written decisions with triggers; the Airtable base kept, its tokens revoked by the owner — CLOSE-OUT-PLAN,
  last sections.)* **v2:** splitting the
  read-only role's column access, the dashboard's error handling, the infra alerts' sender fields, a stale prompt line
  (PHASE-7-PLAN §4j; `docs/ENGINEERING-NOTES.md`, "The final security pass: what stays open" — moved there from the
  README on 2026-11-03).
- **The demo is public since 2026-11-01** (§10). The rate limit's BLOCK direction was shown before it went live.
  *(Corrected 2026-11-03: this line said the demo was not deployed.)*
- The v2 list — what was deliberately deferred and why — is in `docs/ENGINEERING-NOTES.md`, "Not yet — deferred to
  v2" (moved there from the README on 2026-11-03).

## 9 · A closer look: the embeddable widget (Phase 6b)

*Moved verbatim from the README at 7-3; the statuses in its table (e.g. "open, Phase 6c") are as written then, not
re-derived at 7-3.*

**The problem.** A booking bot is worth nothing if the shop's own website cannot carry it. The promise is
one line — `<script src="…/barber-widget.js" defer></script>` — on a site we do not control, whose CSS we
have never seen, without breaking anything the client already has.

**The approach.** An open Shadow DOM with `:host{all:initial}`: the boundary stops the host's selectors,
`all:initial` cuts the inherited properties selectors cannot reach. Verified in both directions against a
test page built to be hostile on purpose — `content-box!important`, an inherited Georgia at line-height
2.2, colliding `.panel`/`.msg`/`.chip` class names, a `z-index:99999` sticky header, a global
`button{…!important}`, and a leak canary. The page's own elements are byte-identical before and after the
widget mounts.

**What it puts on the host page — the complete list, because "it cannot leak out" is only true with the
exceptions written down.** Two `<style>` elements in `document.head` carrying one `@font-face` each
(`@font-face` is ignored inside a shadow root, so the rules must live in the document; the families are
namespaced — `BarberWidget Fraunces` — because an un-namespaced `@font-face` would silently replace a
client's own Fraunces in their own headings) · Cloudflare's Turnstile script, the single third-party
dependency and the one whose entire purpose is to be third-party · one `document` keydown listener,
attached only while the panel is open, acting on one key, never calling `preventDefault` — the host page's
own Escape handler still fires exactly once · one `window` global guarding a double script load · one
`sessionStorage` key · a one-shot `DOMContentLoaded` listener, added *only* when the tag sits where
`document.body` does not exist yet · and, if the client opted in, the `#barber-widget-fallback` element is
hidden on mount. ⚠ **This list has been wrong twice** — it once claimed a single exception, and it later
omitted the last two items (Codex, CRT #13). A list is only honest when it is complete, and the way it
goes wrong is by being written once and not re-derived.

**And what it READS, because "it never reads your page" was an overclaim too.** It reads its own `<script>`
tag to learn which origin to load fonts from, its own container id, its own injected `<style>` markers, and
the fallback id above. It does **not** read the page's content — no text, no forms, no input values, no
cookies, no storage of the host's. The narrow sentence is the true one.

**The isolation limit, stated rather than implied: Shadow DOM is style encapsulation, not a security
boundary.** The root is open, which is normal and documented browser behaviour — and it means the widget's
content is reachable by *every* script already running on the host page, the client's own analytics
included. Nothing a widget can do from inside the page changes that; the only real answer is a
cross-origin iframe, and that architecture was considered and **deliberately not built in v1** (it is on
the NOT-build list: it costs viewport control, pointer-events and a `postMessage` bridge, and the 6b spike
removed its last justification by proving Turnstile renders and solves inside the shadow root). A client
whose threat model requires isolation from scripts on their own page should not embed this widget — they
need the iframe build. Written here rather than in a footnote, because it is a property of the product.

**Three things the first real load taught us, all of them about honesty rather than code.**
An edge failure the engine never saw was answering in the shop's voice — *"I'm passing you to a team
member"* — when nobody had been told, because the owner-alert lives inside the workflow that never ran;
the transport now speaks as itself. A client-side timeout abandoned the response but not the engine, so
the visitor was told to try again about work that had already succeeded. And a 20 s "still verifying"
watchdog was built, measured, shipped for one round, then **reverted and rebuilt**, because its negative
control had swept only the axis its author happened to think of.

**What it knowingly does not do — named here rather than left for a reader to find.**

| Gap | Status |
|---|---|
| The stuck-verification watchdog is drilled on five axes, but **five more are not swept**: a real Cloudflare site key (the accept direction needs a real human token), a genuinely slow network where Turnstile legitimately needs >20 s, a backgrounded tab where browsers throttle timers, a token arriving at the exact deadline, and two widgets on one page | named in [`tests/snippet/DRILLS.md`](../tests/snippet/DRILLS.md) |
| The `Try again` note stays on screen after the token arrives and the composer is usable again — a true sentence that has become stale | open |
| The **site** panel does not read the engine's `locked` flag, so on the site the handoff-lock line repeats on every message; the snippet shows it once | open, Phase 6c |
| The visible transcript is lost when a visitor moves to another page in the same tab. The conversation itself continues — the session id survives — so the engine may be waiting on a confirmation the visitor can no longer see | v2 (PHASE-7-PLAN → Open items, v2 / LATER) |
| `messageTemplates` has **no required keys** in the committed schema, so a config can pass every gate while missing a message the widget must supply. The snippet's build now fails by name for the two it reads; the schema gap itself is still open | v2 (PHASE-7-PLAN → Open items, v2 / LATER) |
| An idempotent replay returns no text, so after a client timeout the engine's real answer (*"You're booked: …"*) is unrecoverable. The visitor now gets an honest interim message — **the silence was fixed, the information was not** | v2 (PHASE-7-PLAN → Open items, v2 / LATER) |
| **The drills are one-off manual measurements, not a regression harness.** Each is recorded against the bundle it was taken on; nothing re-runs on a change. An executable browser harness is not written | open, 6c / Phase 7 |
| Cloudflare's Turnstile script is loaded **without SRI and without a version pin** — Cloudflare does not publish a pinned, integrity-hashed distribution for it, so this is an **accepted supply-chain exception**, not an unsolved task. It is the one third-party script, and its whole purpose is to be third-party | accepted, named |
| `style-src 'none'` / nonce-only CSP and **Trusted Types** are incompatible — the widget injects its stylesheet inline and assigns markup via `innerHTML` inside its own component | known limit, documented on `/install` |
| The double-insert guard keys on one element id; a host page that already uses that id, or a mount that fails part-way, is untested | open, 6c |

**Where a human is still required.** Anything needing a real Turnstile token — a live conversation, a real
booking and its cleanup. Everything else (DOM, CSS, layout, events, isolation, responsive, request
blocking) is drilled headless, and the drill sheet says which is which.

## 10 · Going public (plan approved 2026-10-29, live 2026-11-01)

**What it took** (`docs/PUBLIC-DEMO-PLAN.md`, the round records R1–R2i and "GO-LIVE"; `docs/ROADMAP.md`, the public-demo
row):
- **Deployed protected first.** The site went to Vercel (Hobby) behind Vercel's own login. Every pre-go-live check was
  run against that protected deployment: the platform checks, the certificate, and a pause drill (a paused site answers
  503 with Vercel's paused marker). Protection came off at 00:28:53 Vienna on 2026-11-01. Today only the custom domain is
  public; the other Vercel addresses redirect to a login or do not exist.
- **The spend cap was turned from fail-open into fail-closed** before the endpoint became public (ruling (d),
  `docs/ARCHITECTURE-DECISIONS.md` 2026-10-29). A meter that cannot be read now stops the model call, instead of
  letting the turn run with an alert.
- **The rate limit's block direction was shown, on the second try.** The first probe was recorded as RED and then
  withdrawn: it sent 25 requests against a rule that blocks from the 31st. Forty requests then showed the block from
  the 31st on, with no workflow execution (R2b, R2c).
- **The privacy page names a controller and a contact without putting either in a public repo.** Both are build-time
  settings. The first contact address was on the project's own domain, which the host-leak guard flags, so that round
  stopped before committing it (R2g) and the values moved to the environment (R2h). The page states the legal basis, retention, the
  rights and the complaint right, and says that some services process data outside the EU/EEA (R2i, go-live).
- **Turnstile was set to interaction-only** (`b1dc022`): a Managed widget whose checkbox appears only when Cloudflare
  asks for it.
- **The rename** to `barber-demo.<apex>` (2026-11-01) left the old name's DNS record and its place in the widget's
  hostname list behind. Together that was a takeover path that could mint tokens. It was found during the rename and
  closed: the old record deleted and the hostname list reduced to the new name (Cowork's statement; RENAME, DOMAIN +
  INTERACTION-ONLY).

**What stays open, by the owner's reason:** the Managed-mode hidden-container check (ship gate #15, v2); the leaked
service tokens and the n8n API key (#17b–d, deferred until the system is complete — declined by decision on 2026-11-04,
CLOSE-OUT C-3); Access in front of the dashboard (#18, measured at K-6 but its configuration lives outside this repo);
the Loom walkthrough (#20, deferred — and on 2026-11-04 deferred outside the CLOSE-OUT phase) (`docs/ROADMAP.md`,
"Ship gate after D6c"). *(This list did not name #18 until 2026-11-06. #16(c) — the dashboard kept off the public
site — was re-opened when the site became Git-deployed on 2026-11-05 and closed again on 2026-11-06, measured from
the outside: CLOSE-OUT-PLAN, "The final revision round".)*

## 11 · The name the bot never asked for — and the date the tests never sent (NAME-CAPTURE, 2026-11-01)

**Found by the first real-browser run.** The owner's run with Turnstile up (ship gate #21, 2026-10-31) booked and
cancelled cleanly, and the appointment row had `customer_name = ''`. The bot had never asked for a name
(`docs/NAME-CAPTURE-PLAN.md` §0).

**The fix** asks for the name before the confirm, puts it in the confirm and in the calendar event's title, and keeps
it through a reschedule. Its suite and its mutants were green.

**The owner's first run of it still failed, on a date.** The bot asked for the date twice. `Resolve Date` refused
"wednesday 4 november", and the same refusal was byte-equal in the committed and the staged workflow, so this was an
older defect, not a regression (NAME-CAPTURE-PLAN "R3"). **Why every test missed it, as recorded there:**
- the NAME-CAPTURE tests stored dates as ISO and never sent a date phrase through `Resolve Date`;
- the golden set validates the model's expected output and executes no node, and its date cases said "tomorrow";
- the date tests asserted the node's rule table, in which a month name was never a case;
- the script handed to the owner had never been replayed through the staged workflow.

**The fix to the test gap** is the chat-replay harness (`tests/unit/chat-replay.lib.cjs`). It walks a whole
conversation through the exported workflow: the code nodes run, IF / Switch / Set are evaluated from their parameters,
and the stores, the calendar and the model's answer are given. It was committed with DATE-PHRASING's first round
(`68ceb10`). Since then the scripts handed to the owner are replayed through the staged workflow first: NAME-CAPTURE's
corrected script and N1's two. The owner's second run passed and closed NAME-CAPTURE ("R4").

## 12 · Six audit rounds, and the rule that stopped the tuning (DATE-PHRASING, 2026-11-01 → 11-02)

**The goal:** understand calendar dates ("4 November", "4.11.") deterministically, and check a weekday the customer
gives against the date (`docs/DATE-PHRASING-PLAN.md` §2).

**The audits:** six contained Codex rounds (`docs/codex/date-phrasing/r1.md`–`r6.md`). The first four kept finding the
same property in a new spelling: the model's `dateExpr` can drop part of a date the customer wrote, and a text-side
detector built from patterns misses some wording.

**The rule that ended it.** This repo has a standing rule that a fourth adjustment removes a rule rather than tuning it
(`docs/ARCHITECTURE-DECISIONS.md`, 2026-09-09d). The threshold was declared before the next audit (DATE-PHRASING-PLAN
"R2c"). When round 4 found two more HIGH findings in that class, the build stopped for a design ruling instead of a
fourth set of patterns ("R4 recheck").

**The ruling: make the guarantee structural** ("R2d"):
- the booking and reschedule confirms show the full date with its year;
- `bot.bookingHorizonDays` is 30;
- the text-side checks are labelled best-effort;
- the remaining class is a recorded bound.

Nothing is written without the customer's "yes" to a date they can read. Rounds 5 and 6 then attacked that defence
itself, for example a confirm saved before the change or two concurrent turns of one sender. Round 5's three HIGH
findings became a read-only deploy precondition and two recorded bounds; round 6's one was closed by the put procedure
("R2e", "R3"). Live on 2026-11-02, promoted at `c22da47`.

## 13 · A "no" that could cancel a different booking (N1, 2026-11-02 → 11-03)

**Measured before it was designed.** The plan began by replaying the committed workflow
(`docs/n1/replay-measure.out.txt`; `docs/N1-CONFIRM-NO-PLAN.md` §0). A "no" at the booking confirm left the confirm
alive, so a later "yes" booked the declined slot. With another booking already made, the model read the "no" as
*cancel*, and the bot asked to cancel the **other** booking.

**The fix** is three small nodes before the model's route. A closed set of decline phrases, or a confident model
*cancel* at the confirm, gives "nothing is booked — what would you like to change?", with every detail kept. A second
"no" closes the request. A bare "yes" right after a decline asks the change question once more (D-6 as amended, plan
§13).

**Codex was capped at two passes by ruling.** Neither pass found a HIGH. Pass 1 showed the closed set was wider than
written: `toLowerCase()` turns the Kelvin sign into a `k`. The match became ASCII-only. Pass 2's one LOW, in the same
class, is a recorded bound ("R2", "R2 recheck").

**The live run** (2026-11-03, both scripts, read back from the executions and the database) showed every reply as
scripted. On one turn the model was below the confidence threshold, and the closed set alone carried the outcome. One
turn alerted the owner. The alert came from the older date guard upstream of N1, and the same model answer alerts on
the workflow from before N1 (`docs/n1/alert-4905-replay.cjs`). It was ruled a pre-existing bound and is carried as a
named false-alarm item. Promoted at `0ba4003` ("R4").

