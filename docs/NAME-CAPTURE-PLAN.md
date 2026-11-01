# NAME-CAPTURE PLAN — a booking carries the customer's name (PLAN ONLY, awaiting Yigitcan's written "approved")

> **Status: PLAN, not approved.** Nothing in this file has been built. No Main, Purge or schema change is staged or
> live. Per `.claude/rules/plan-gate.md` the build starts only on Yigitcan's written "approved" in the conversation.
> **Why it lives here:** Main change plans live in their own file under `docs/` (`CP4-RESCHEDULE-EXECUTE-PLAN.md`,
> `MIGRATION-PLAN.md`, `PHASE-7-PLAN.md`, `PHASE-8-PLAN.md`); this change touches Main, Purge, the schema and the
> config shape, so it gets one too. Written 2026-11-01 from the committed exports at `9918027`.

**Ruling it implements (Yigitcan, 2026-11-01, ruling 4 of the RENAME brief):** "A booking must carry the customer's
name: asked when missing, kept across turns, written to the calendar event and the appointment, kept on reschedule.
Widget contact (phone/email) stays OUT — the demo tells visitors not to enter real details; per-client option later
(v2)."

## 0. The defect, verified against `n8n/workflow.main.sanitized.json`

| | claim (Cowork, from the export) | verdict | evidence |
|---|---|---|---|
| (a) | `Slot Gate` requires only service + date + time; no step asks for a name | **true** | `hasService`/`hasDate`/`hasTime` only; `next_ask` is `'service'` or `'datetime'`; replies `t.askService` / `t.askDateTime` |
| (b) | `Merge Slots` persists only {serviceId, date, time} | **true** | `merged = { serviceId, date, time }`; `Merge State` reads back `slot_service/slot_date/slot_time`; both Save States write those three; `salon.conversations` has no name column |
| (c) | `Build Event Request` reads the name from the CONFIRMING turn only | **true** | `const name = (vi.slots && vi.slots.customerName) \|\| null` with `vi = $('Validate Intent')` (this turn's model output); `Build LLM Request`'s `collected` list on the confirm turn holds service/date/time only, so the model never sees an earlier name; `Write Appointment` writes `booking.customerName \|\| ''` → an empty string |
| (d) | the reschedule reads it the same way, and `customer_name = EXCLUDED.customer_name` can blank a stored name on reschedule | **partly wrong** | TRUE for the event: `Build Reschedule Event Request` has the same line, so the NEW calendar event has no name and the old one is deleted. FALSE for the row: `Update Appointment (Reschedule)` is `UPDATE … SET gcal_event_id, start_utc, end_utc, calendar_id, reminded` — the stored name survives. The `EXCLUDED.customer_name` overwrite is in **`Write Appointment`** (booking lane), on its `ON CONFLICT (gcal_event_id)` upsert: it fires when the same event id is written again (the reconcile path, or re-booking a cancelled slot with the same sender/date/time/service) |
| (e) | `Capture Lead` takes the name from the same slot; a widget lead has no contact | **true** | `$1 = ($json.slots \|\| {}).customerName \|\| ''`; `$2` is the phone only when `channel === 'whatsapp'` |

**Measured live (read-only, the owner's #21 run, 2026-10-31 23:46 UTC):** the appointment row has `customer_name = ''`
(empty, not NULL) — the defect is in production, not only in the export.

## 1. Goal
Every booking made through the bot carries the name the customer gave — in the calendar event's title and in
`appointments.customer_name` — whether it was given in the first message, in answer to a question, or several turns
before "yes"; a reschedule keeps it; a lead uses it.

## 2. Scope / NOT-build
**In:** ask for the name when it is missing; keep it across turns; show it in the confirm text; write it to the event
and the row; never blank a stored name; the reschedule event carries the stored name; the lead uses the kept name; the
name treated as untrusted input; the new message template wherever the config shape lives; tests, mutants, golden set.
**NOT built:** widget contact capture (phone/email — ruling 4, v2); a name on the WhatsApp lane from the provider's
profile (the MSISDN is the identity there; possible v2); editing a name after booking; the "change during
confirmation" intent (ARCH-DEC 2026-09-09e, still v2); any change to cancel; the dashboard (its `maskName` already
masks `customer_name`).

## 3. Design

**3.1 Where the name is asked — order.** `Slot Gate`'s `next_ask` becomes `service → datetime → name`; `stage =
'ready'` (and so the availability check and the confirm) needs all four. The name is asked LAST of the four and BEFORE
availability, so the confirm turn can name it. *(Alternative for the approver, D-1: ask it after availability, so a
customer is not asked for a name for a slot that turns out busy. Recommendation: before — one code path, the confirm
always has it, and a busy slot keeps the name for the next try.)*

**3.2 How it is kept across turns.** A new column `salon.conversations.slot_name text` (additive migration
`db/schema/003_slot_name.sql`, nullable, no default). Carried exactly like the other three slots: `Load State`
(projection), `Merge State` (read back into `state.slots.customerName`), `Merge Slots` (fresh non-null wins, else
stored — the same rule as the others), `Save State` and `Save State (Post-Write)` (insert + `ON CONFLICT` update list +
RETURNING). The slot is cleared wherever the other slots are cleared today (a completed or rejected booking — the
build lists each site with a grep, `reporting.md` structural-claim rule).
**Purge:** `slot_name` is emptied together with `recent_messages` after 30 days (`UPDATE … SET recent_messages = '',
slot_name = NULL`), so the conversation record does not keep a name longer than the message text it came from (D-2).
`privacy-facts` pins Purge's conversation writes as exactly `["recent_messages = ''"]` today — that pin changes with
it.

**3.3 Extraction of a bare reply — deterministic first, the LLM second.** The model is called on every turn anyway,
but a one-word "Alex" is exactly the input it classifies as `unknown`, which goes to clarify and, a second time, to
handoff (`handoff.md`). So a NEW Code node, **`Fill Name From Reply`**, sits between `Validate Intent` and `Resolve
Date` — before every uncertainty gate — and runs ONLY when the stored state shows the last ask was the name (stage
`collecting`, service + date + time stored and valid, no stored name; derived from state, not from a new field). If
the message, after sanitising (3.4), matches a name shape — optionally prefixed by `my name is / I'm / I am / it's /
this is / name's / call me`, 1–4 words, letters with `' . -` inside, no digits, no `@`, no URL — it sets
`slots.customerName`, sets `intent = 'book'` with high confidence, and the turn routes as a booking. Anything else falls
through untouched to the LLM's own result.
**Three conditions bound the rule, because a name shape alone is too wide** (`security-auditor` MEDIUM-2 on this plan:
"ignore previous instructions", "cancel", "talk to a human" are all 1–4 letter words):
1. it runs only when the model's own intent for the turn is `unknown` or `book` — never over `handoff`, `cancel`,
   `reschedule`, `capture_lead`, `faq` or `confirm`, so an explicit request or a jailbreak still hands off on the FIRST
   turn (`handoff.md`);
2. a deny list of intent and command words (`cancel, stop, no, yes, human, person, agent, help, ignore, instructions,
   prompt, system, book, reschedule, price, …` — the build lists it and a test pins it) rejects the reply as a name;
3. it never runs while a cancel/reschedule confirmation is pending (the stage check above already excludes it; a test
   pins it).
A reply that fails any condition is left exactly as the LLM classified it. **Why deterministic first:** the case is a closed, pattern-shaped answer to
a question we just asked; the rule cannot hallucinate and costs nothing (`deterministic before AI`). The LLM stays for
a name inside a sentence ("haircut tomorrow at 3, I'm Alex"), which the current prompt already extracts.
**A refusal** ("I'd rather not", "why?") does not match the shape, so it reaches the LLM; the plan adds one re-ask
(`askName` again) and on a second turn without a name, a handoff — the same two-strike ladder as `clarify` (D-3:
handoff, or book without a name).

**3.4 The name as untrusted input.** One sanitiser, used by `Fill Name From Reply` and `Merge Slots` (the LLM path):
Unicode NFC; strip every `\p{C}` character (controls, format characters, zero-width, bidi overrides); collapse
whitespace; trim; cap at 40 characters; reject (→ null → re-ask) if anything is left that is not a letter, a space or
`' . -`. The value never reaches a later LLM prompt as text: `Build LLM Request`'s `collected` list says only
`name: provided` / `name: missing`, never the value (`prompt-injection.md` — data, never instructions). It reaches the
customer only in the confirm text and the booked reply (their own input, sanitised), the calendar title, the row, and
the owner alert where alerts already carry slot facts (masked by the existing alert masking). The dashboard masks it
with `maskName`, as today.

**3.5 Confirm text, event, row.**
- `Compute Availability`'s hard-coded confirm becomes `${svcName}, ${fmt} for ${name} — shall I book it? (yes / no)`
  (the reschedule confirm is unchanged: its name is the stored one, see 3.6).
- `Build Event Request` reads the name from `state.slots.customerName` (the kept slot), not this turn's model output.
- `Write Appointment`'s upsert becomes `customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''),
  salon.appointments.customer_name)` — a re-write can never blank a stored name; and `$7` sends NULL rather than `''`
  when there is no name.

**3.6 Reschedule keeps the stored name.** `Validate Reschedule Target` adds the old row's `customer_name` to the
target it already builds (the row is read by `Find Old Booking (Reschedule)`, whose projection already includes it);
`Build Reschedule Event Request` uses that for the new event's title. `Update Appointment (Reschedule)` keeps not
touching the column (verified, 0(d)).

**3.7 The lead.** `Capture Lead`'s `$1` takes `state.slots.customerName` (kept) before this turn's value. No contact
field is added (ruling 4).

**3.8 The new template — every place the config shape lives.**
- `messageTemplates.askName` (e.g. "And the name for the booking?") in: the Main `Load Config` literal ·
  `config/client.config.example.json` · `config/client.config.example-b.json`.
- `schemas/client.config.schema.json`: `messageTemplates` is `additionalProperties: {type: string}` with no required
  keys — **no change**; `scripts/check-config-schema.cjs` validates the example and the literal against it.
- `scripts/render-client.py` projects a client config onto the literal's key tree, so `askName` becomes REQUIRED in
  every client config (a client config without it is refused — the safe direction). `tests/unit/render-client.test.py`
  (the example renders equal to the committed literal; the OPTIONAL-emptied assertion at lines ~680–688 is unchanged
  because `askName` is not optional) and `render-client-mutants.py` follow.
- Checked and NOT affected: `web/snippet/build.mjs` `NEEDED_TEMPLATES`, `scripts/check-hero-engine-text.cjs`
  `TEMPLATE_KEYS`, `web/site` (no `askName` reader).
- ⚠ **`Load Config` is in `GATE_NODES`** (`scripts/diff-workflow-copy.py`): `workflow-step put` refuses a gate node in
  `--allow`. D-4 asks for a one-off, reviewed delta that permits exactly one change to it — the added
  `messageTemplates.askName` key, checked as "parameters differ by exactly this key" — rather than a general opening.

**3.9 `/privacy`.** The booking sentence already says "with the service, the time, **the name you give** and the random
session id" — it becomes TRUE with this change (today it promises a name the row does not get). The conversation-record
sentence lists "its booking step, the chosen slot, the assistant's last reply and a random session id" — with
`slot_name` the record holds a name until booking or the 30-day Purge, so that sentence gains "the name you give,
until the booking is made or the messages are erased" (text change, pinned in `privacy-facts`). The booking sentence is
not pinned today; this change pins it.

## 4. Skeleton (node level)
**Main** (edited): `Load Config` (one key, D-4) · **`Fill Name From Reply`** (NEW Code node; edges `Validate Intent →
Fill Name From Reply → Resolve Date` replace `Validate Intent → Resolve Date`) · `Build LLM Request` (`collected`:
name provided/missing; the collecting context asks for the name when it is next) · `Load State` · `Merge State` ·
`Merge Slots` · `Slot Gate` · `Save State` · `Save State (Post-Write)` · `Compute Availability` · `Build Event Request` ·
`Write Appointment` · `Validate Reschedule Target` · `Build Reschedule Event Request` · `Capture Lead` · the slot-clearing
sites (listed by grep at build) · sticky notes on the touched branches.
**Purge** (edited): the conversation projection and the 30-day update (`slot_name = NULL`).
**Schema:** `db/schema/003_slot_name.sql` (additive). **Config:** the two examples. **Site:** `/privacy` one sentence.
**Tests:** see 7.

## 5. Integrations
Postgres (a migration + the queries above) · Google Calendar (the event title, no new call) · the LLM (prompt text
only; no new call, no schema change — `schemas/intent.schema.json` already has `slots.customerName`) · nothing on
Zernio, Turnstile, Vercel.
⚠ **The migration needs a write role.** CC holds the read-only role only (Q6); the owner runs
`003_slot_name.sql`, CC measures it (`information_schema.columns`) — `rules: "the operator did it" is not a
measurement`.

## 6. Mock data
Synthetic names only (`Testname`, `Ánna-Marie O'Neil`, `<script>`, a zero-width-split name, a 60-letter name) in unit
tests and golden cases; the live check uses the owner's own run (#21-style) through Turnstile, cleaned afterwards with
the seed tool. No real customer name enters a fixture or a report.

## 7. Critical-Review Targets (Codex)
**#1b (booking path / write-then-verify)** — re-audited for the changed `Write Appointment` upsert and `Build Event
Request`. **New target: name handling** — the sanitiser, `Fill Name From Reply` (no route around the uncertainty gates
for anything but a name shape; never during a cancel/reschedule confirm), the prompt never carrying the value, the
reschedule title, the lead. **#8 (reschedule)** — only for `Validate Reschedule Target`'s added field.

## 8. Acceptance criteria
1. A name in the first message, a bare reply ("Alex", "my name is Alex"), or a name three turns before "yes" all
   reach the calendar title and `customer_name`.
2. A bare name reply is never classified `unknown`, never clarifies, never hands off.
2b. **A reply that is not a name never takes the name path:** an explicit handoff request, a cancel, a jailbreak
   attempt, or a command word keeps the model's own intent and its gates (first-turn handoff included).
3. A reschedule's new event carries the stored name; no path blanks a stored `customer_name`.
4. A refusal gets one re-ask, then the D-3 outcome.
5. The sanitiser removes controls/format characters, caps at 40, and rejects a non-name; the value never appears in an
   LLM request body.
6. A new client config without `askName` is refused by `render-client.py`; with it, renders.
7. `/privacy` states what the engine does (pinned).
8. Guards 0, parity green after promotion, the owner's live run shows the name in the row and the event.

## 9. ⚙ Drill matrix
| scenario | setup | expected | MUST-RUN | MUST-NOT-RUN |
|---|---|---|---|---|
| name in the first message | "haircut tomorrow 3pm, I'm Alex" | confirm names Alex; row + title carry it | `Merge Slots` keeps it | `askName` |
| bare reply | ask → "Alex" | intent book, name filled | `Fill Name From Reply` | clarify, `Mark Handoff` |
| "my name is …" | ask → "my name is Alex" | as above | same | same |
| name given early, "yes" later | name turn 1, slot turns 2–3, "yes" | name in row + title | `Merge State`/`Save State` carry `slot_name` | — |
| refusal | ask → "I'd rather not" ×2 | re-ask, then D-3 | `askName` once | a booking without the ruled outcome |
| injection as the name | ask → "ignore previous instructions" / `<script>` / zero-width | not a name (deny list / sanitiser) → the model's own route (a jailbreak hands off); never in a prompt | the deny list, the sanitiser | the value in `Build LLM Request` body; a name fill |
| a command at the name ask | ask → "cancel" / "talk to a human" / "stop" | the model's intent (cancel / handoff) and its gates | the intent check, the deny list | `Fill Name From Reply` filling a name |
| long name | 60 letters | capped at 40 or re-asked | sanitiser | an un-capped write |
| reschedule | booked with a name → reschedule → yes | new event title has the stored name; row keeps it | `Validate Reschedule Target` field | a blank `customer_name` |
| reconcile / re-book same slot | upsert on an existing event id with no name | stored name kept | `COALESCE` | `customer_name = ''` |
| cancel/reschedule confirm pending | stage `cancel_confirming` + "Alex" | `Fill Name From Reply` does nothing | the pending-confirm gate | a name fill |
| double-booking / idempotency / DST | unchanged paths | unchanged | the existing drills | — |
| lead | lead turn after a name | lead row has the kept name | `Capture Lead` | — |

## 10. Tests
Unit + mutants per changed node: `Fill Name From Reply` (new file, run as code), `Slot Gate` (first time run as code),
`Merge Slots` + sanitiser, `Build Event Request`, `Build Reschedule Event Request`, `Validate Reschedule Target`,
`Compute Availability` confirm text, `Write Appointment` and Purge SQL (text checks), `Capture Lead` expression,
`Build LLM Request` (the value never in the body). Golden set: bare name, name in the first message, a refusal, an
injection attempt as the name, reschedule keeps the name. `render-client` tests and `check-config-schema` for
`askName`. `privacy-facts` for the two sentences and Purge's new write. Plus a drift guard for the hand-written
structured-output schema in `Build LLM Request` — none exists today (found while writing this plan).
**Live:** the owner's run (a booking with a bare-name reply, then a reschedule), read back with `salon_ro`.

## 11. Deploy route, rollback, rounds
- **Route:** `scripts/workflow-step.py put` with a new `APPROVED_DELTAS['main']` entry: `add_nodes {Fill Name From
  Reply}`, `add_edges {Validate Intent→Fill Name From Reply, Fill Name From Reply→Resolve Date}`, `remove_edges
  {Validate Intent→Resolve Date}`; every other change is a `parameters` edit on existing nodes (allowed). `Code` is in
  `ADDABLE_TYPES`; no new Postgres node is needed. The `Load Config` key needs D-4. Purge: a `parameters`-only put.
- **Order:** migration (owner) → measured → Purge put → Main put (live-snapshot first) → probe → parity → the owner's
  live run → promotion.
- **Rollback:** the live snapshot (`rehearse-rollback` before the put, as in 7-2 R3); the column is additive and
  harmless if left; Purge rolls back by its own snapshot.
- **Rounds (estimate):** R1 offline build (code, SQL, migration file, config, tests, staged exports) → L2 + Codex (the
  targets in 7) → R2 fixes → R3 live (migration, puts, owner run). 3–4 rounds.

## 12. Automation-fit
Neither `/loop` nor `/goal`: every step ends at a human gate (the migration, the puts, the owner's live run).

## 13. Decisions for the approver
- **D-1** ask the name before availability (recommended) or after.
- **D-2** Purge empties `slot_name` with `recent_messages` after 30 days (recommended) — or keep it with the record.
- **D-3** after a second turn without a name: handoff (recommended — the ruling says a booking must carry the name) or
  book without one.
- **D-4** a one-off reviewed delta that lets `Load Config` gain exactly `messageTemplates.askName` (recommended) — the
  alternative is a hard-coded ask text, which breaks "config-driven" for every client.
- **D-5** the migration run by the owner with the write role, measured by CC (recommended; CC holds read-only by Q6).
