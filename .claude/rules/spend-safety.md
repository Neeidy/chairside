# spend-safety

**Purpose:** hard brakes so the bot can never run away on cost or loop forever.

- **Budget cap:** a hard LLM spend cap per period (`LLM_COST_CAP_USD`). Over cap → stop calling the LLM,
  fall back to deterministic replies + handoff.
- **Max-iteration:** a per-SESSION turn cap (`bot.maxTurnsPerConversation` in `Load Config`; the `LLM_MAX_TURNS` name
  is not read by any workflow). `Merge State` resets the count after `bot.sessionGapMinutes` of silence and an owner
  release resets it (HARDENING K5, 2026-11-18 — STAGED; live after the hardening Main and Owner Actions puts) — so the cap bounds one session, not a sender's lifetime. *(Corrected
  2026-11-18: this said "per-conversation", and until the K5 edit the count was in fact never reset at all.)*
- **Timeout:** every external **HTTP** call — the LLM, Zernio, Google Calendar, Turnstile — carries an explicit
  timeout and an error branch on expiry (the HTTP Request nodes in the copy exports: 60 s for the LLM, 15 s for
  the others). **Two gaps, stated rather than implied:**
  - **The store (Postgres since 2026-10-24) has NO per-node or statement timeout in the bot's workflows.** No
    Postgres node sets one and no query sets `statement_timeout`; the database role sets none either
    (`db/schema/002_roles.sql`). What every Postgres node DOES have is an `onError` setting:
    `continueErrorOutput` (a separate error output), or `continueRegularOutput` (the error item continues on
    the normal output — in Main each of these is followed by an `… Errored?` IF; in Owner Actions and Drill
    State a validation step reads the item, and whether each one catches every error shape is not measured
    here). A query that FAILS is therefore routed; a query that HANGS is bounded only by whatever the driver
    and server defaults are — **not measured**. (The owner dashboard is different: its own pool sets a 10 s statement timeout,
    `web/dashboard/lib/store.ts`.)
  - **The Telegram owner-alert nodes set no timeout** either (the native Telegram node, not an HTTP Request);
    they do have an error route.
  Airtable was retired at D6c (2026-10-27): no workflow and no n8n credential reaches it.
- **Dry-run default:** new/changed flows run in dry-run (no real writes) until explicitly switched to live.
- **Global kill-switch:** `bot.killSwitch: true` in Main's `Load Config` node (and in Reminders' copy, which must match)
  puts the bot into **handoff-only** mode — every message gets the handoff text and goes to a human, no LLM. The Turnstile
  check and the dedupe claim still run before it. It is a literal inside a Code node, so flipping it is a live workflow
  edit (⚠ ONAY), not an instant switch. **The emergency stop that needs no edit is deactivating Main** (RUNBOOK §8,
  standing ruling of 2026-11-16). *(Corrected 2026-11-16: this line named an env var `BOT_KILL_SWITCH`, which no workflow
  reads, and called it instant.)*

The website widget is a public endpoint → also rate-limit + bot-protection so it can't be spammed into cost.

**Why:** an LLM behind a public webhook is a cost-and-abuse surface; these brakes make the worst case bounded.
