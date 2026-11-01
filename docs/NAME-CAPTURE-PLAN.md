# NAME-CAPTURE PLAN — a booking carries the customer's name

> **Status: APPROVED by Yigitcan, 2026-11-01** (written, in the conversation: "Evet onaylıyorum diger maddeleride"),
> with two amendments and every decision as recommended (§13). **R1 built offline and R2's fixes made (2026-11-01, "R1 — built" and
> "R2 — Codex and the fixes" at the end of this file): staged, NOT live** — no migration run, no Main or Purge put.
> **Amendments (essentials of the ruling, in English; only the approval quote above is verbatim):**
> - **A1** month names (january…december) are NOT on the deny list — April, May, June, August are given names, and at
>   the name ask the date is already stored. Weekdays and relative-date words stay.
> - **A2** unit/golden cases add a two-word Turkish name with `ğ` and `Ü`, "Müller" and a non-Latin name: the
>   sanitiser keeps them (`\p{L}`) — never rejects or strips them. ⚠ **Declared deviation:** the ruling's own example
>   for the first case cannot be committed — a redaction collision (`security-auditor` HIGH-1) — so no tracked file
>   carries it; the synthetic "Çağla Ünal" tests the same letters (`ğ`, `Ü`, two words).
>   The non-Latin cases are Cyrillic, Greek and Han — scripts written in `\p{L}` alone. **Recorded bound (ruled R3-2,
>   2026-11-01: stays, v2 — no change):** a name that needs combining marks (`\p{M}`, e.g. Devanagari vowel signs) is REJECTED by 3.4 → re-ask; a zero-width
>   non-joiner (U+200C, category `Cf`, used in Persian) is not rejected but STRIPPED by 3.4's `\p{C}` rule, so the
>   name is kept with its spelling silently changed. Changing either is a design change (a mark cap against "zalgo"
>   text; a ZWNJ exception), not taken here. *(Said "Bound, for a ruling" until R3; the ruling keeps it as a bound.)*
> - **The demo's `askName` text:** "What name should I put the booking under? (Any name is fine for this demo.)"
>
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
availability, so the confirm turn can name it. *(Ruled D-1: before. The alternative was to ask it after availability, so a
customer is not asked for a name for a slot that turns out busy. Recommendation: before — one code path, the confirm
always has it, and a busy slot keeps the name for the next try.)*

**3.2 How it is kept across turns.** A new column `salon.conversations.slot_name text` (additive migration
`db/schema/003_slot_name.sql`, nullable, no default). Carried exactly like the other three slots: `Load State`
(projection), `Merge State` (read back into `state.slots.customerName`), `Merge Slots` (fresh non-null wins, else
stored — the same rule as the others), `Save State` and `Save State (Post-Write)` (insert + `ON CONFLICT` update list).
*(Corrected at R2: this said "+ RETURNING" too. The build left the RETURNING projection as it was — the next turn reads
the name back through `Load State`, so nothing reads it there; Codex R1 noted the mismatch.)* The slot is cleared wherever the other slots are cleared today (a completed or rejected booking — the
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
1. it runs only when the model's own intent for the turn is `unknown`, or `book` with NO service, date or time
   extracted this turn (and, if the model gave a `customerName`, only when it equals the candidate) — never over
   `handoff`, `cancel`, `reschedule`, `capture_lead`, `faq` or `confirm`, so an explicit request or a jailbreak still
   hands off on the FIRST turn (`handoff.md`), and a booking detail ("actually tuesday", "beard trim") stays a booking
   detail (`security-auditor` LOW-1, second pass);
2. a deny list rejects the reply as a name: intent and command words (`cancel, stop, no, yes, human, person, agent,
   help, ignore, instructions, prompt, system, book, reschedule, price, start over, forget, …`), weekday and
   relative-date words (`today, tomorrow, next, monday … sunday`; month names are NOT on it — A1), and **the config's own service names, read
   from `Load Config`** (so a new client's services are covered) — the build lists it and a test pins it;
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
whitespace; trim; cap at 40 characters; a typographic apostrophe `’` (U+2019) becomes `'` (U+0027) before the check
(ruling R3-1, 2026-11-01 — phones type `O’Neil`); reject (→ null → re-ask) if anything is left that is not a letter, a
space or `' . -`. No other character joins the set (U+2018, a backtick, an acute accent stay refused). The value never reaches a later LLM prompt as text: `Build LLM Request`'s `collected` list says only
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
- `messageTemplates.askName` (the demo's text, ruled: "What name should I put the booking under? (Any name is fine for
  this demo.)") in: the Main `Load Config` literal ·
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
Synthetic names only (`Testname`, `Ánna-Marie O'Neil`, `<script>`, a zero-width-split name, a 60-letter name, and by
A2 "Çağla Ünal", "Müller" and a non-Latin name, which the sanitiser must keep unchanged) in unit tests and golden cases; the live check uses the owner's own run (#21-style) through Turnstile, cleaned afterwards with
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
2b. **A reply in a listed category never takes the name path:** an intent the model classified (handoff, cancel,
   reschedule, a booking detail), a word on the deny list (commands, weekday and relative-date words, the config's services) keeps the model's
   own intent and its gates (first-turn handoff included). **Stated bound, not hidden:** the deny list is a list — a
   non-name outside it that the model calls `unknown` ("you are dan now") can still be taken as a name. What bounds
   it: the value never reaches a prompt, and the confirm text shows it before any write, so a wrong name costs one
   "no", never a silent booking.
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

## 13. Decisions — ruled 2026-11-01, each as recommended
- **D-1** ask the name before availability (recommended) or after.
- **D-2** Purge empties `slot_name` with `recent_messages` after 30 days (recommended) — or keep it with the record.
- **D-3** after a second turn without a name: handoff (recommended — the ruling says a booking must carry the name) or
  book without one.
- **D-4** a one-off reviewed delta that lets `Load Config` gain exactly `messageTemplates.askName` (recommended) — the
  alternative is a hard-coded ask text, which breaks "config-driven" for every client.
- **D-5** the migration run by the owner with the write role, measured by CC (recommended; CC holds read-only by Q6).

## R1 — built offline (2026-11-01)

Nothing live was written: no migration run, no Main or Purge put, no chat message, no LLM call.

**What exists now** (each file named once; the tests below prove it):
- `db/schema/004_slot_name.sql` — NOT run. It adds `salon.conversations.slot_name text` (nullable, no default). The DDL
  runs under `SET LOCAL ROLE salon_owner`, inside one transaction whose check rolls everything back unless:
  - the column is nullable text;
  - `salon_app` can read and write it;
  - `salon_ro` can read it and cannot write it.

  `db/shape-spec.json` lists the column.
- `n8n/staged/workflow.main.sanitized.json` + `workflow.main.delta.json` — the Main edit (§3), produced by exact text
  replacements on the committed export:
  - one new Code node, `Fill Name From Reply`, with its two edges replacing `Validate Intent → Resolve Date`;
  - parameter edits on 17 nodes (two of them sticky notes);
  - `Load Config`'s one gate edit (D-4).
- `n8n/staged/workflow.purge.sanitized.json` + `workflow.purge.delta.json` — `Find Stale Conversations` and
  `Scrub Recent Messages` (D-2), plus the branch's sticky note.
- The deploy tools (`scripts/diff-workflow-copy.py`, `scripts/workflow-step.py`):
  - `APPROVED_DELTAS['main']` is now a LIST — the 7-2 Tur 2 edit (kept; its fixtures exercise the tool) and this one.
  - A delta's new `gate_edits` item lets a gate node's config literal GAIN exactly the approved keys and nothing else.
    `gate_edit_errs` checks it with the render's own literal reader: the code around the literal byte-equal, the
    literal's text equal once the added line is taken out, its object equal once the key is taken out, the path and
    the text exact.
- `messageTemplates.askName` in both example configs (the demo's text, ruled; example-b's own).
- `/privacy`: the messages sentence now says the name given for a booking is stored with the messages and erased with
  them. The booking sentence ("the name you give") was already there and becomes true; both are pinned now.
- **CRT #16 (name handling)** is in MASTER-BRIEF §9, the repo's single CRT table. The brief named `dual-agent-review.md`;
  no such file exists in this repo — that is the skill's name, and §9 is where this repo keeps the list.

**Tests (all offline; terminal-measured):**

| Test | Result | What it covers |
|---|---|---|
| `tests/unit/name-capture.test.cjs` (check-all) | 31/31 | every changed Code node and expression executed from the staged export; the SQL and the graph read from it |
| its negative control (same test, unedited committed export) | 29 of 31 red | the 2 green are a Purge check (reads the staged Purge) and a premise about the unchanged `Resolve Date` |
| `tests/unit/name-capture-mutants.py` | 44/44 killed | one survived the first cut (five words accepted: its fixture held a deny-list word), and a case was added for it |
| `tests/db/slot-name.test.sh` (throwaway Postgres; Docker, not in check-all) | 17/17 | see below |
| `tests/unit/llm-schema-drift.test.cjs` (check-all) | green | see below |
| `tests/unit/render-client-askname.test.py` (check-all) | green | see below |
| `diff-workflow-copy --selftest`, `workflow-step.test.py` | green | the gate-edit cases, each red for its intended check |
| `privacy-facts` | green | goes red when the staged Purge is removed |
| golden set | G16–G23 | expected outputs only, no model run |

What some of those prove:
- **`slot-name.test.sh`**:
  - the migration as `salon_migrator`: dry run, real run, a second run;
  - `salon_ro` cannot write the column;
  - the staged Save/Load State SQL run verbatim as `salon_app`;
  - `Write Appointment`'s COALESCE never blanks a stored name;
  - the staged Purge finds a row with only a name and empties it;
  - two mutants: the committed upsert blanks the name, and the committed Purge misses that row.
- **`llm-schema-drift.test.cjs`**: the safe subset derived from `schemas/intent.schema.json` equals the node's
  hand-written copy, in the committed and the staged Main. Its four negative controls go red.
- **`render-client-askname.test.py`**: against the staged Main, both examples render with their own `askName`. A
  config without it is refused by name; the same config renders against today's exports.
- **The gate-edit cases**: a refused edit for each of
  - a wrong text;
  - a second key;
  - another path;
  - a changed value;
  - a comment inside the literal;
  - code outside it;
  - a missing declaration;
  - a non-gate node;
  - a pre-existing key.

  `workflow-step put` takes the staged Main with its delta and refuses it without the gate edit, with another text, or
  with a Turnstile switch-off beside the key.

**Declared — where the build departs from, or corrects, the text above:**
1. **Migration number:** 004, not 003 (003 was taken).
2. **A2's first example** replaced by a synthetic name (in the Status block).
3. **The plan's premise "the slot is cleared wherever the other slots are cleared (a completed or rejected booking)"
   is false.** Measured by a grep of every Code node: a completed booking clears no slot; a rejected one clears only
   date/time (`Compute Availability`, `{ ...slots, time: null }` / `date: null`). The name follows the other slots:
   - it is kept after a booking and after a rejected slot;
   - it is emptied by the 30-day Purge with the messages.

   The /privacy sentence the plan proposed ("until the booking is made or the messages are erased") would have been
   false, so it reads "stored with the messages and erased with them".
4. **Two nodes outside §4's list:**
   - `Build Clarify State` — §3.3's re-ask must BE the name question on the uncertain path. At the name ask it now
     answers `askName`; elsewhere `askIntent`, unchanged.
   - `Reschedule Lookup` — it rebuilt `state.slots` from service/date/time alone, which would have emptied the kept
     name. It is a slot-clearing site found by the grep §3.2 calls for, and it now spreads the stored slots first.
5. **No new sticky node:** §11's approved delta adds one node only, so §4's "sticky notes on the touched branches" are
   edits of two existing ones (`Sticky Note3`, `Sticky — Uncertain turn ≠ handoff`) and Purge's `Sticky — PII scrub`.
6. **D-3's mechanics, within the ruling:**
   - The previous turn's `last_intent` is read from `Merge State`, because `Validate Intent` overwrites it with this
     turn's.
   - A first detail-less `book` turn without a name is marked `name_reask`; a first `unknown` one is marked `clarify` by
     the clarify gate.
   - With either mark, the next turn without a name becomes `intent = 'handoff'` (`handoff_reason: 'name_not_given'`).
     It goes through the existing route: `Invalid or Handoff Gate` → `Mark Handoff`, owner alert.
7. **3.4's "the owner alert where alerts already carry slot facts":** the alert's `slots:` line carries
   service/date/time only, so the KEPT name (the slot value) is in no alert. ⚠ But an alert also carries a `recent:`
   line whenever the conversation holds recent messages — its last messages as the customer typed them, not masked. A message that gave the name ("…,
   I'm Alex") can appear there (`security-auditor` LOW-2). This is an existing data flow, not one this edit adds; it is
   recorded so this sentence is not read as "the name never reaches the owner".
8. **Purge's scan** takes `recent_messages <> '' OR slot_name IS NOT NULL`. A row whose messages were already erased is
   still found. The name is never projected, so it never enters the run's data.
9. **`Fill Name From Reply`'s candidate:**
   - one trailing run of `. ! ,` is dropped;
   - the prefix matches a curly apostrophe (`I’m`);
   - the name itself keeps what was typed and goes through the sanitiser.

   **A name typed with a curly apostrophe is accepted** — corrected at R3: ruling R3-1 (2026-11-01) made the
   sanitiser turn `’` into `'` before its character check, so `O’Neil` is accepted and stored as `O'Neil`
   (`name-capture.test.cjs`; the mutant that removes the normalisation is killed). Until R3 this item said such a name
   was refused (re-ask, then D-3) and that allowing it was open for a ruling.
10. **The example configs changed in R1** (the brief). The render cannot carry `askName` until the Main literal holds it,
    so `render-client.test.py` lists it in `PENDING_KEYS`. That list is excluded from the A-leak probes, and one case
    turns red the day the committed literal holds the key, forcing the list to be emptied at promotion.
11. **Recorded bounds** (in the A2 note and the tests):
    - a name that needs combining marks is refused;
    - a ZWNJ is stripped;
    - the deny list is a list (acceptance 2b).
12. **An older test's premise moved:** `tests/unit/eval-spend-fail-closed.test.cjs` took "a staged Main exists" to mean
    "the staged Main is the Eval Spend edit". That edit was promoted on 2026-10-30, so the staged file is now this one.
    - While unpromoted, the exact four-node check stands.
    - Since promotion, the test requires a later staged edit to leave those four nodes exactly as committed — this edit
      does.
    - Its mutants still run through a temporary file, so that check does not kill them (16/16 killed by the behaviour
      cases).

## R2 — Codex and the fixes (2026-11-01)

**The audit:** one contained run at the pushed R1 head `da164ff` on the §7 targets and the deploy tool's gate edit
(prompt `docs/codex/name-capture/prompt.md`, answer verbatim `r1.md`, containment `containment.md`).
- **No HIGH.** Two MEDIUM, both REAL, both fixed. **No gate-edit bypass** in any case the run tried.
- The A2/sanitiser bounds, the explicit-intent and pending-confirm exclusions and D-3's ordinary path hold.
- "Dance with dolphins" taken as a name is the accepted deny-list bound (2b). Codex did not report it.

| | finding | triage | fix |
|---|---|---|---|
| M1 | A conversation already `confirming` with no kept name — from before the deploy, or emptied by Purge — skips `Slot Gate`, and `Build Event Request` booked it nameless. **The R1 test expected exactly that.** | real: the ruling says a booking must carry the name | `bbc74d9`: no kept name → an EMPTY eventId (→ `Event ID Valid?` false → `Mark Handoff`) tagged `name_missing`, the owner alert's class — D-3's outcome. The test now refuses it for `null` / `''` / spaces / `undefined`; a mutant that drops the check dies. |
| M2 | The confirm question names the customer, Save State keeps it as `computed_reply`, and the Purge left it — the privacy page's "erased with the messages" was false. | real | `ac2373d`: `Scrub Recent Messages` also sets `computed_reply = CASE WHEN COALESCE(slot_name, '') = '' THEN computed_reply ELSE replace(computed_reply, slot_name, '…') END`, in the same statement, so it uses the name being cleared. The reply itself stays: the page says the last reply is kept, and `privacy-facts` still forbids emptying it. |
| Q4 note | §3.2 said the Save States' RETURNING would carry `slot_name` | the text was wrong, not the code | corrected in §3.2 |
| Q4 note | 004 checked only UPDATE for `salon_ro`, while the record said "cannot write" | real (narrower than stated) | `ea1bd44`: the check refuses INSERT too |

M2's fix is held by three checks:
- the throwaway-Postgres test's P3: the stored confirm question loses the name and keeps the rest;
- a mutant;
- the privacy pin.

**Bounds of M2's fix, stated:**
- `replace` removes every occurrence of the kept name in the stored reply as a case-sensitive SUBSTRING, not as a
  word. A name that also occurs inside the reply loses that text too:
  - `Jan` takes the month abbreviation out of "Monday 7 Jan";
  - `Sun` turns "Sunday" into "…day";
  - `May` takes a May date's month out.

  Erasure errs to removing more, and the stored reply is never shown to the customer again (`security-auditor`
  LOW-1).
- It matches the CURRENT kept name only. The last stored reply is the latest turn's, and a confirm question always
  carries the name held at that turn.
- The scan's own projection (`Find Stale Conversations`, unchanged since before this edit) carries the row's
  `computed_reply` and `recent_messages` into the Purge's run data. That was so before this edit, for the messages. The
  privacy page names the engine's run records among the copies kept longer.

**M1, for the deploy:** a conversation that is `confirming` when the Main put lands has no kept name. Its "yes" is now
handed off with an owner alert, not booked. R3's plan includes a read-only count of such rows before the put, so their
number is known in advance.
**A related bound, stated (not an M1 case):** a booking written BEFORE this edit has an empty `customer_name`. If it is
rescheduled, the moved event carries that stored name (3.6), so it stays nameless. The ruling says the name is KEPT on
reschedule, and there is none to keep; the reschedule lane does not ask for one.

**Re-run after the fixes** *(terminal-measured)*:

| Test | Result |
|---|---|
| `name-capture` | 32/32 |
| its negative control on the unedited committed export | 30 of 32 red |
| mutants | 46/46 |
| throwaway Postgres | 19/19 (M6: `salon_ro` cannot INSERT) |
| `privacy-facts` | 14/14; 2 red without the staged Purge |

**The Codex RECHECK** (contained, pin `5c452e6`; prompt `prompt-r2.md`, answer verbatim `r2.md`):
- **M1 and M2 closed**, each confirmed by Codex's own probe:
  - nameless confirmations → empty eventId, handoff reply, alert class `name_missing`; a named one books;
  - the scrub's `replace` uses the name before it is cleared;
  - NULL and empty values are unharmed.
- Both question-4 notes are handled correctly.
- The staged files changed only in `Build Event Request`, `Scrub Recent Messages` and the PII sticky.
- The pre-edit nameless reschedule was confirmed as the stated bound, not a finding.
- **One LOW, real:** the refusal's ROUTE was not tested. A mutant removing `Event ID Valid?`'s false output left the
  suite green. **Fixed:** a test now pins the route — the builder feeds the gate, the gate's regex fails an empty
  eventId, its false output is `Mark Handoff`, and `Mark Handoff` writes state AND alerts the owner. Two graph mutants
  die: the false output removed, and the alert edge removed.

  Verified internally (`name-capture` 33/33, mutants 48/48 *(terminal-measured)*), not re-run through Codex: a LOW
  test-coverage item, the precedent of CRT #14/#15.

## R3 — two offline amendments, then the live window (2026-11-01)

**Accepted:** the 12 declared deviations of "R1 — built offline" (Yigitcan's ruling via Cowork's review, 2026-11-01).
**Migration 004:** run by the owner on the server (2026-11-01): "--- DRY RUN OK ---" then "--- 004 APPLIED ---" —
*operator output, not CC's measurement*; CC's read of the column is in "A1" below.
**Rulings (Yigitcan, 2026-11-01, "1-3 evet"):**
1. the sanitiser accepts `’` (U+2019) by normalising it to `'` before its character check — nothing else changes;
2. combining marks (`\p{M}`) and ZWNJ stay a recorded bound (v2) — no change;
3. the Turnstile slot keeps its spacing after the interactive state ends; the non-interactive collapse stays
   (`docs/PUBLIC-DEMO-PLAN.md`, "R3 amendment").
Also ruled: the three dashboard/widget display findings of the RENAME round (the two mask formulas, the "Today" block
after a cancel, the widget's message time in the visitor's zone) → v2 (`docs/PHASE-7-PLAN.md` §4b).

### A0 — offline
- **(1), `9e5d875`:** both byte-equal copies of `sanitiseName` replace U+2019 with U+0027 right after NFC. 3.4 and R1
  item 9 are corrected in place. Tests: `O’Neil` → `O'Neil`; "I’m O’Neil" is filled as `O'Neil`; U+2018, a backtick, an
  acute accent and a fullwidth apostrophe stay refused. The mutant that removes the normalisation from both copies dies.
- **Codex recheck of that diff** (contained, pin `fe65b92`; prompt `prompt-r3.md`, answer verbatim `r3.md`): no HIGH, no
  MEDIUM. Both copies do exactly the ruling; over every Unicode code point in `A<c>B` the old and new sanitisers differ
  at U+2019 only; the name's later uses (confirm, calendar title, appointment row, the Purge's `replace`) keep
  `O'Neil`. Two observations, inside recorded bounds and not findings: "don’t" now sanitises to "don't" and is still
  denied; "no’" is filled as `no'`, as "no'" already was (the deny list is an exact list, acceptance 2b).
  **One LOW, real:** a mapping WIDENED to U+201B passed every test. **Fixed:** U+201B and a prime (U+2032) join the
  refused look-alikes, and a widening mutant dies. Verified internally (`name-capture` 34/34, mutants 50/50
  *(terminal-measured)*), not re-run through Codex: a LOW test-coverage item, as at R2.
- **(3), `5921594`:** committed, not deployed (the site waits for promotion) — `docs/PUBLIC-DEMO-PLAN.md`.

### A1 — reads (`salon_ro`, read-only; n8n executions by GET) *(terminal-measured, 2026-11-01 ~20:15 Vienna)*
- **Migration 004 holds its contract:** `salon.conversations.slot_name` is `text`, nullable, no default (column 19);
  the table's owner is `salon_owner`. Catalog: `salon_app` SELECT/INSERT/UPDATE true; `salon_ro` SELECT true, INSERT and
  UPDATE false. **Behaviour, not only the catalog:** as `salon_ro`, a zero-row `UPDATE … SET slot_name` and a zero-row
  `INSERT … slot_name`, each in a transaction rolled back either way, both answer SQLSTATE 42501; the control
  `SELECT slot_name` succeeds. No row carries a name yet (`slot_name IS NOT NULL`: 0).
- **Conversations at `confirming` with no kept name: 1** (not a `pd-` seed). After the Main put, that conversation's
  "yes" takes the `name_missing` refusal (handoff + owner alert), as M1 designed; a new booking turn asks the name.
  (All conversations by stage: cancelled 1, confirming 1, new 2.)
- **#19 — TRUE by the store:** the seeded `pd-` conversation (seeded at `stage='handoff'`, `last_intent='handoff'`,
  `scripts/seed-workflow.py`) now reads `stage='new'`, `last_intent=''` — exactly `Release Handoff Lock`'s `SET` — and
  its `last_updated` is still the seed's (2026-10-30 05:32 UTC), which that query does not touch and any Main turn
  would. **What cannot be measured:** the time of the press. Owner Actions keeps no successful execution
  (`saveDataSuccessExecution: none`) and lists none, and none in error; the same executions call lists Main, Purge,
  Reminders and Drill State, so the empty list is the setting, not the instrument.

### A2/A3 — the puts (⚠ ONAY 1/2 and 2/2, Yigitcan 2026-11-01) *(terminal-measured, 20:27–20:29 Vienna)*
Through `scripts/workflow-step.py`, every step read back; both pre-PUT snapshots kept outside the repository (mode
0600) until the edit is closed (promotion, then both parity guards green against the committed exports).
- **Purge (A2), 20:27:35–20:27:38:** deactivate → `put --delta-file n8n/staged/workflow.purge.delta.json` (3 nodes,
  parameters only: `Find Stale Conversations`, `Scrub Recent Messages`, the PII sticky) → read back == the staged export
  and == the body sent, settings unchanged → activate, published == draft.
- **Main (A3):** `rehearse-rollback` first (20:28:40–45): a scratch from the live draft, the edit put, the rollback read
  back == its snapshot (191 nodes, 31 credential ids, connections, settings), the scratch deleted and read back 404.
  Then 20:28:56–20:29:06: deactivate → `put --delta-file n8n/staged/workflow.main.delta.json` (18 allowed nodes incl.
  the D-4 gate edit of `Load Config`, the approved delta's 4 graph items, 19 stored contents changed) → read back == the
  staged export and == the body sent, settings and webhook ids unchanged → activate, published == draft → probe: a
  dummy Turnstile token → 403 `turnstile_failed`, executed by Main, the path's only active holder. **Main was inactive
  for about 2 seconds.**
- **Parity against the STAGED exports** (the repo's own `check-content-parity.py`, byte-identical, run from a scratch
  mirror whose `n8n/workflow.<key>.sanitized.json` is the staged file, because the guard refuses a staged path): Main
  169 executable nodes and its settings (the allowlisted live-only `binaryMode` apart) · Purge 24 nodes and settings —
  both OK. Structural (`check-live-parity.py`, the PUBLISHED graph): 192/192 nodes, 274/274 connections. Negative
  control: the same mirror run against Main BEFORE its put was red on the staged nodes.
- **Declared — the parity guards against the COMMITTED exports are red on Main and Purge, by construction:** the live
  workflows now run the staged edit, and promotion (staged → committed) is the next round, after the owner's run. They
  name exactly the staged nodes; Owner Actions, Reminders and Drill State are green; the active set is exactly the five
  listed workflows. The brief's "both parity guards 0" is read as live == the intended (staged) edit, and is green.
- **The window:** one Main execution (the probe; success, 10 nodes, no alert node, no run error — the same shape as the
  start-gate probes before the put), none on the other four workflows; no 5xx, no spend or alert class.
- **Rollback, if the owner's run goes wrong:** deactivate → `rollback` Main to its snapshot → activate → probe; then the
  same for Purge (`workflow-step.py`'s R3 ORDER).

### A4 — the owner's live run (barber-demo, a real Turnstile token) and what CC reads afterwards
**Corrected after the first owner run (below):** the first version of this script asked for "Wednesday 4 November",
a phrasing `Resolve Date` does not accept, and it was handed out without being replayed. Every line below HAS been
replayed offline through the STAGED Main (see "The owner run of 2026-11-01"), on 2026-11-01, to the reply shown.
A NEW private/incognito window, so the run starts as a new conversation; run it before Wednesday 4 November. Synthetic
name; the demo calendar.
| # | He types | He should see (replayed) |
|---|---|---|
| 1 | `I'd like a haircut on Wednesday at 11:00` | no Turnstile box; "What name should I put the booking under? (Any name is fine for this demo.)" |
| 2 | `Mara O'Test` — the bare name; a phone may type ’, which is fine (R3-1) | "Haircut, Wednesday 4 Nov 11:00 for Mara O'Test — shall I book it? (yes / no)" |
| 3 | `yes` | "You're booked: Haircut, Wednesday 4 Nov 11:00. See you then!" |
| 4 | `Can I move it to Thursday at 15:00?` | "Move your Haircut from Wednesday 4 Nov 11:00 to Thursday 5 Nov 15:00? Reply "yes" to move it, or anything else to keep it." |
| 5 | `yes` | "Moved — your Haircut is now Thursday 5 Nov 15:00." |
| 6 | `Please cancel my appointment` | "Cancel your Haircut on Thursday 5 Nov 15:00? Reply "yes" to cancel, or anything else to keep it." |
| 7 | `yes` | "Done — your Haircut on Thursday 5 Nov 15:00 is cancelled." |
Do NOT write "this Wednesday", "next Wednesday" or a date with a month — today those are refused (table below).
Anything else at any step (a re-ask, a handoff message, an error) → stop there and say which step.
**What the replay assumes, stated:** the model's answer per turn is GIVEN, not called — step 1 as `book` with
`dateExpr` "wednesday", "on wednesday" or "Wednesday" (all three replayed; "this wednesday" would be refused); step 2
as `unknown` or as `book` with the name (both replayed, and with ’); steps 3/5/7 `confirm`; step 4 `reschedule` with
`dateExpr` "thursday"; step 6 `cancel`. The calendar, the store and the LLM are stubs (an empty calendar, so 11:00 and
15:00 are free — if they are not, the bot offers other times). The replay's store ends with the appointment
`customer_name` "Mara O'Test" (kept after the move), both calendar titles "Haircut — Mara O'Test (bot)", `slot_name` set,
status cancelled, no owner alert.
**CC reads afterwards** (read-only): the Main executions of the run (statuses; step 2 through `Fill Name From Reply`
filling the name; no error, no alert class); `salon.appointments.customer_name` for the booking (`Mara O'Test`, kept
after the move); the calendar event title on the insert and on the move, from n8n's record of the Calendar request
(`Haircut — Mara O'Test (bot)`; CC's Calendar connection cannot see that calendar); the conversation's `slot_name`;
the cancel's `status = cancelled`. Then promotion, `PENDING_KEYS` emptied and the site redeploy (R3-3) — the next round.

### The owner run of 2026-11-01 — the bot re-asked the date; diagnosed as a PRE-EXISTING defect, no rollback
**What happened** (owner's screenshot, via Cowork): in a fresh incognito session he sent "I'd like a haircut on
Wednesday 4 November at 11:00" twice; both times the bot answered "What day and time works for you?". No error.
**Measured** (n8n executions 4807 and 4808, read by GET; slot fields only): the model extracted it correctly both times —
`intent` book, `serviceId` haircut, `date` 2026-11-04, `dateExpr` "wednesday 4 november", `time` 11:00. `Fill Name From
Reply` changed nothing (`_name_pending` false). **`Resolve Date` dropped the date** — reason `unparsed`, outcome
`unresolved_expr` — so `Slot Gate` re-asked the day and time. Each turn also raised the owner alert class
`date_unresolved`: on the first turn the Telegram node ran; on the second `Build Owner Alert` ran and the Telegram node did
not (the alert throttle is the likely reason; not read further).
**Replayed offline** (the recorded model answer of 4807 through `Validate Intent` → `Fill Name From Reply` (staged only)
→ `Resolve Date` → `Merge Slots` → `Slot Gate`, from the COMMITTED and the STAGED export): both lose the date in
`Resolve Date` with reason `unparsed`; `Resolve Date` is byte-equal in the two exports. The staged replay reproduces
the live reply exactly (the harness's control). **So this is case (a) of the brief: pre-existing, not a NAME-CAPTURE
regression — no rollback; NAME-CAPTURE stays live.**
**What `Resolve Date` accepts today** (both exports identical; replayed with each phrase inside the customer's text,
2026-11-01, a Sunday):
| `dateExpr` | Result |
|---|---|
| `wednesday`, `on wednesday`, `coming wednesday` | resolved (next occurrence) |
| `tomorrow`, `today` | resolved |
| `2026-11-04` typed verbatim | resolved |
| `this wednesday` | refused `anchored_past` — "this" means the current ISO week (Monday–Sunday), so on a Sunday it points back |
| `next wednesday` | refused `ambiguous_next` (by design) |
| `wednesday 4 november`, `4 november`, `november 4`, `4.11`, `4/11` | refused `unparsed` |
Every refusal re-asks "What day and time works for you?" without naming a form that would work, so a customer can
loop. The plan for explicit calendar dates: `docs/DATE-PHRASING-PLAN.md` (plan only, awaiting approval).
**Why the tests did not catch it — the gap, stated:** `name-capture.test.cjs` (34/34) and its mutants (50/50) execute the
NAME-CAPTURE nodes with dates already stored as ISO; no case sends a date PHRASE through `Resolve Date`. The golden set
(G16–G23) validates each case's expected model output against the schema and never executes a node — and its date cases
say "tomorrow", which is accepted. `resolve-date.test.cjs` asserts the node's rule table, in which a month name was
never a case. And the A4 script was written from the plan's design and handed out without a replay through the staged
path — the one check that would have shown it. The harness that did it here (an offline multi-turn walker: Code nodes
from the export, IF/Switch/Set evaluated from their parameters, stores and Calendar stubbed, the model's answer given)
lives in the session scratchpad; committing it as a test is part of the date plan.

