# salon-booking-bot

**A config-driven salon booking chatbot — one message in, a booked appointment or a captured lead out.**

![status](https://img.shields.io/badge/status-learning%20%2F%20demo%20build-orange)
![phase](https://img.shields.io/badge/phase-7%20%E2%80%94%20test%20%2B%20audit-blue)
![store](https://img.shields.io/badge/store-Postgres%20self--hosted-336791)
![engine](https://img.shields.io/badge/engine-n8n%20self--hosted-EA4B71)
![llm](https://img.shields.io/badge/LLM-Claude%20Haiku%204.5-8A63D2)
![license](https://img.shields.io/badge/license-MIT-green)

> **Honest status:** this is a **demo / learning build**, not a system serving paying customers.
> Phases 0–6 are done. The bot's store then moved from Airtable to **self-hosted Postgres** in an interim
> phase whose cutover was accepted on 2026-10-24. Phase 7 (test, Codex audit, Definition of Done) closed on
> 2026-10-28 with its gaps named, and Phase 8 (a config-only second client) closed the same day: its render step is built and
> proven offline; Codex audited the pre-fix code, and the fixes were verified by the internal reviews — live status in
> [`docs/ROADMAP.md`](docs/ROADMAP.md). Everything below marked ✅ has been built **and verified from execution
> logs**; 🔜 means not built yet. No invented metrics, no fake traffic.

---

## The one job

A barbershop loses bookings because messages arrive while the owner is cutting hair. This bot answers
instantly, in the shop's voice, and turns each message into one of two outcomes:

**a booked appointment** — or — **a captured lead + a human handoff**

…with **zero owner effort** and **zero double-bookings**. It is built as a **template**: the goal is that a new
client means a new config file and new credentials, *not* new code — a goal, not yet a demonstrated fact (see
"Config / code / secret" below).

---

## How it works

```
                    ┌─────────────── config-gated channels ───────────────┐
   WhatsApp ────────┤                                                     │
   Web widget ──────┤   →  NORMALIZE  →  one channel-agnostic brain       │
                    │      {channel, sender_key, text}                    │
                    └─────────────────────────────────────────────────────┘
                                          │
   ┌──────────────────────────────────────▼──────────────────────────────────────┐
   │  1  Validate payload            invalid → 400                               │
   │  2  Load conversation state     Postgres, keyed by "{channel}:{id}"         │
   │  3  Handoff lock                a human took over → bot stays quiet         │
   │  4  Guards                      kill-switch · max-turns  → 0 LLM cost       │
   │  5  LLM intent extraction       Claude, structured JSON output              │
   │  6  Validate against schema     ajv compiled from the committed contract    │
   │  7  Confidence & intent gate    < 0.7 / unknown → ask once, then human      │
   │  8  Route (deterministic)       book · cancel · reschedule · FAQ · lead     │
   └──────────────────────────────────────┬──────────────────────────────────────┘
                                          │
        book → collect service/date/time (multi-turn, deterministic)
        FAQ  → answered from config — the LLM never writes the answer
        lead → written to Postgres
                                          │
                              reply returns to the origin channel
```

*`instagram` exists as a config key, but no Instagram adapter is built — a dead key, listed under "Not yet" below.*

**The LLM has exactly one job: understanding.** It converts messy free text into a structured intent.
It never writes a customer-facing answer, never chooses an action, and holds no write permissions.
Prices, hours and services come from config; routing is `IF`/`Switch`. That is why the bot **cannot
quote a wrong price** — the answer path contains no model.

---

## What works today ✅

| Capability | Detail |
|---|---|
| **Multi-channel intake** | WhatsApp + widget shapes normalized to one internal format; channels toggle in config |
| **Conversation memory** | Per-sender state in Postgres (`salon.conversations`: `stage`, slots, turn count) — survives restarts |
| **Intent understanding** | Claude Haiku 4.5, temperature 0, native structured outputs |
| **Contract validation** | Model output validated by an ajv validator **compiled from the committed schema** — no hand-written copy that can drift |
| **Multi-turn booking collect** | "I want a haircut" → "what day and time?" → merged into a complete request |
| **Deterministic FAQ** | Price / hours / services / address answered from config, never from the model |
| **Lead capture** | Non-booking interest written to Postgres (`salon.leads`) with channel + message |
| **Human handoff, 5 distinct classes** | guard-trip (transient) · infrastructure down (an error flag + owner alert; 503 only before the message is claimed) · genuine handoff (writes state) · clarify (first uncertain turn, no lock) · extraction-transient (our schema broke, owner alerted, no lock) — never merged |
| **Visible failures** | Distinct machine-side error flags, never dressed as a normal reply — e.g. `invalid_payload` · `state_unavailable` · `llm_unavailable` · `lead_unavailable` · `calendar_unavailable` |
| **Booking without double-booking** | Calendar first, then re-read the slot; on a lost race the bot withdraws ITS OWN event and hands off, and only a won slot is mirrored to Postgres. A message delivered twice is answered once: `Check Processed` CLAIMS the message id at the start of the turn on a UNIQUE column, so two deliveries cannot both claim it (claim-first; CRT 1a closed in 7-2). The cost is at-most-once — a run that dies after its claim is not retried. See [booking-integrity](.claude/rules/booking-integrity.md) for that and the booking race it does not close |
| **Cancel · reschedule · reminders** | Bot-automated, identity-bound to the channel's `sender_key`. Reminders are proven in dry-run; live WhatsApp template delivery needs the client's own WhatsApp Business number |
| **Owner dashboard** | Read-only panels + the handoff queue + one write (release a handoff lock, through a protected n8n path). Runs on the build server behind Cloudflare Access and reads Postgres as a SELECT-only role. It runs as a systemd user unit (`ops/systemd/salon-dashboard.service`) that restarts it on a crash (measured, 7-F1); its start at boot is shown by configuration, not by a reboot |
| **Spend brakes before the LLM** | Kill-switch, max-turns and a monthly LLM spend cap run *before* any paid call — a tripped guard costs nothing. The cap fails OPEN if the spend meter cannot be read (the turn runs, and a `spend_meter_unavailable` alert goes to the owner) |
| **Embeddable widget, one script tag** | A single self-contained IIFE (well under 20 kB; `npm run build -w @salon/snippet --prefix web` prints the current size — no byte count is pinned in prose here, because one went stale inside a single round) that mounts a booking chat inside a Shadow DOM on someone else's site. Isolation measured in both directions against a deliberately hostile host page — see the case study ([docs/CASE-STUDY.md](docs/CASE-STUDY.md) §9), including what it knowingly does not do |

## Not built yet 🔜

A **real second deployment** (Phase 8 proves the config-only render offline, on a mock client) · a **public deploy of the demo site** (there is no Vercel project; the
site runs locally against the live endpoint). *(`docs/CASE-STUDY.md` and `docs/RUNBOOK.md` stood here until 7-3, 2026-10-27; both are written now.)*

**Deferred to v2, and every recorded bound** — moved verbatim to [`docs/ENGINEERING-NOTES.md`](docs/ENGINEERING-NOTES.md) (2026-11-03).

---

## Engineering decisions worth reading

**Deterministic before AI.** A model is used only where a rule genuinely cannot decide. Asking an LLM
"what does a haircut cost?" is slower, costlier and less reliable than reading one config field.

**The schema is the single source of truth.** The validator inside the flow is *generated* from
`schemas/intent.schema.json` by a script, with a drift check. Two hand-maintained copies of the same
contract always diverge; a generated one cannot.

**Never trust a 200.** Structured output is only guaranteed when the model stops normally, so
`stop_reason` is checked first, enum casing is normalized, and any unexpected shape becomes a handoff
instead of a crash.

**An outage must not look like a handoff.** If the LLM or the database is down the customer still gets a
polite message, but the machine-side response is distinct (an error flag, and an owner alert) so the owner
knows. Once the message is claimed the status is 200, because a 5xx would only make the channel retry a message that
is already claimed; before the claim it is 503. An outage that looks normal is an outage nobody fixes.

**Availability has one source of truth.** Google Calendar owns free/busy; Postgres mirrors it. Writes go
to the calendar first. Two sources of truth mean double bookings — and Postgres's transactions do not change
that, because the calendar write is an HTTP call outside them.

**Safety over liveness: a truly simultaneous pair withdraws both.** Each writer books, re-reads and yields if it sees
another event, so two requests at the same moment can both yield: no double booking, no booking, a human follows up.

**Config / code / secret are separate — shown offline, with its bounds.** The engine's config sits inside its nodes
(three inline copies, plus the owner's chat id and the Turnstile secret), so a new client used to mean editing them.
Since Phase 8's first round, **a new client = a config file + secret inputs → `scripts/render-client.py` → import into
its own n8n; no node edited by hand** (with both secret inputs given) — shown offline on a second, fictional client (`tests/unit/render-client.test.py`: only the ten measured slots differ from the demo's workflows; a synthetic client whose every config value differs from the demo's shows every key of the three config literals fed from the client's own config (the few-shot from its first service, the chat id and Turnstile secret from its secret input); and no demo-client string of five or more characters reaches the new client outside six allowlisted code comments and fallbacks;
`tests/unit/render-client-mutants.py`, 35 mutants red), with these bounds in the same breath:
EUR only (`priceEUR`, and `€` written in two nodes), customer text in English, two config keys that drive nothing (`instagram`, `business.locale`), the prompt carries a fixed example that hair colouring is not offered; a client offering it gets a contradicting prompt until a Main edit (quality only: `Merge Slots` and `Slot Gate` refuse a service id the config does not hold), the new instance's credentials linked by hand, and not yet shown on a real second deployment (`docs/PHASE-8-PLAN.md`; CRT #14: Codex audited the pre-fix code, `docs/codex/phase-8/crt14.md`; the fixes were verified by the internal reviews).

---

## Case study

**[docs/CASE-STUDY.md](docs/CASE-STUDY.md)** — the problem, the approach, the architecture (the LLM as a translator),
the AI-versus-deterministic split, the Airtable → Postgres migration, the independent Codex audit and how it was
triaged, what I learned, and what "one swap to real" does not yet mean. The embeddable widget's case study (Phase 6b)
is its §9.

---

## Repo map

| Path | What |
|---|---|
| [`n8n/`](n8n/) | the engine — **sanitized** workflow exports only: one `workflow.<key>.sanitized.json` per live Postgres workflow (five), listed with its id in `scripts/check-exports-parity.sh`; the Airtable originals' exports were removed at D6c and stay in git history |
| [`db/`](db/) | `schema/` — the Postgres DDL, roles and the large-object revoke · `ops/` — the nightly backup and its restore check |
| [`schemas/`](schemas/) | JSON Schemas — the intent contract and the client config contract |
| [`prompts/`](prompts/) | versioned LLM prompts (the canonical system prompt) |
| [`scripts/`](scripts/) | validator compiler + drift check · the SQL-parameter gate · workflow deploy / parity guards · repo map generator |
| [`config/`](config/) | per-client `client.config.json` (mock example committed) |
| [`docs/`](docs/) | architecture decisions · data model · live roadmap · repo map |
| [`design/`](design/) | Phase-1 mockups + flow diagram |
| [`tests/`](tests/) | golden-set intents · jailbreak / injection cases |
| [`web/`](web/) | frontend surfaces — `site/` (Next.js demo), `snippet/` (the embeddable widget), `shared/` (one transport, both front ends), `dashboard/` (the owner dashboard) |
| [`.claude/`](.claude/) | the rules this repo is actually built under |

**Stack** — n8n (self-hosted) · Anthropic Claude Haiku 4.5 · PostgreSQL (self-hosted, since 2026-10-24;
Airtable retired at D6c, 2026-10-27) · Google Calendar · Zernio (WhatsApp Business API) · Next.js (the site: no
public deploy yet · the dashboard: its own server behind Cloudflare Access).

---

## Security

This repository is **public**, so it is built as if it were.

- No secrets, no customer PII in git — real values live in n8n Credentials. Only sanitized n8n exports
  (`n8n/*.sanitized.json`) are committed; credential, base and calendar ids are placeholders.
- Every push runs a secret/PII scan.
- The n8n editor is never exposed to the internet; only webhook endpoints are.
- The owner dashboard shows PII, so it sits behind Cloudflare Access: measured 2026-10-24, a request without a
  session is redirected to the Access login, and the policy admits one named email
  ([MIGRATION-PLAN §3t, K-6](docs/MIGRATION-PLAN.md)). CRT #9 (dashboard auth) is audited and its findings
  addressed (`[x]`, 7-2) in [MASTER-BRIEF §9](MASTER-BRIEF.md).
- The store's own boundary: n8n's database role has DML on the five tables plus their sequences and two helper functions (default privileges extend that to tables the owner adds later), the dashboard's role
  has SELECT only ([`db/schema/002_roles.sql`](db/schema/002_roles.sql)), and every workflow query is parameterised
  (`scripts/check-sql-params.py`). The database port is not reachable from outside *(operator statement,
  MIGRATION-PLAN §3t, A9)*.
- **The security pass's open items and the recorded honest limits** (the date guard's history, the extraction-retry path, cancel identity) — moved verbatim to [`docs/ENGINEERING-NOTES.md`](docs/ENGINEERING-NOTES.md).

---

## From demo to real

Everything runs today on mock config and a test endpoint. Going live for a client means their real WhatsApp
number, their calendar and **their own Postgres** — under Model 1 (one isolated deployment per client) that is a
Postgres service, its secrets and its backup step per client ([MIGRATION-PLAN §8](docs/MIGRATION-PLAN.md)). The
engine's code does not change; whether *only config* changes is not yet demonstrated (see "Config / code / secret"
above). The operator's runbook — provisioning a client's Postgres, the daily checks, the backup, deploys — is [`docs/RUNBOOK.md`](docs/RUNBOOK.md); its provisioning section has not yet been run as one procedure for a new client.

**Why Postgres and not Airtable — kept here because it is the reason.** The free Airtable plan could not serve a
single real client: 1,000 API calls per month per workspace, shared between the bot and the dashboard, plus a hard
5 requests/second per base (measured 2026-09-12). On 2026-10-06 the quota ran out with no customer traffic at all,
and the bot had no data layer for almost twelve days ([OPS-5](docs/OPERATIONAL-INCIDENTS.md)). The store moved to
self-hosted Postgres (ruling 2026-10-19; cut over and accepted 2026-10-24,
[MIGRATION-PLAN §3t](docs/MIGRATION-PLAN.md)). **Airtable was retired at D6c (2026-10-27)**: the original workflows
are archived and n8n's Airtable credential is deleted, so nothing can reach it; revoking its token and deleting the base
are deferred by the owner, recorded (the final security pass, 7-4 B). What Postgres costs instead: a
database to run, back up and restore for every client. The nightly backup restores each dump into a throwaway
container and compares every table before the dump counts ([`db/ops/pg-backup.sh`](db/ops/pg-backup.sh)).

---

## Documentation

**[MASTER-BRIEF.md](MASTER-BRIEF.md)** — the current architecture ·
**[docs/ROADMAP.md](docs/ROADMAP.md)** — live phase status ·
**[docs/ARCHITECTURE-DECISIONS.md](docs/ARCHITECTURE-DECISIONS.md)** — every decision and why it changed ·
**[docs/DATA-MODEL.md](docs/DATA-MODEL.md)** — the Postgres data model ·
**[docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md)** — how the store moved from Airtable to Postgres, step by step ·
**[docs/CASE-STUDY.md](docs/CASE-STUDY.md)** — the case study ·
**[docs/RUNBOOK.md](docs/RUNBOOK.md)** — operating a deployment.

MIT licensed. Built by [Neeidy](https://github.com/Neeidy) as a portfolio project in AI automation.
