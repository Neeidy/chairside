# DATE-PHRASING PLAN — explicit calendar dates ("4 November", "Wednesday 4 November", "4.11")

> **Status: APPROVED 2026-11-01 (Yigitcan, written: "tarih plani onaylı onerdigin sekilde") with D-1…D-4 as recommended,
> D-5 in scope (Sunday "this <weekday>" → the coming week) and A1 (the horizon applies to every resolved date). R1 built
> offline — "R1" at the end; NOT live.** *(This line said "PLAN ONLY — awaiting approval … Nothing below is built" until R1.)*
> **Trigger:** the NAME-CAPTURE R3 owner run of 2026-11-01 (`docs/NAME-CAPTURE-PLAN.md` → "The owner run of
> 2026-11-01"). "I'd like a haircut on Wednesday 4 November at 11:00" was extracted correctly by the model
> (`date` 2026-11-04, `dateExpr` "wednesday 4 november") and dropped by `Resolve Date` (reason `unparsed`), so the bot
> re-asked "What day and time works for you?" — twice, with no hint of a form that would work.
> **Pre-existing:** `Resolve Date` is byte-equal in the committed and the staged Main; the replay from both exports loses
> the date in the same node.

## 0. What `Resolve Date` does today (read from the committed node, replayed 2026-11-01)
- It trusts no date the model computed. The customer's own words decide: the model's `dateExpr` must occur in the
  customer's text (`occursIn`, else `expr_not_from_customer`), and only these forms resolve: an ISO date typed verbatim,
  `today`, `tomorrow`, a bare weekday with an optional `on` / `coming` / `the` prefix (next occurrence), and
  `this <weekday>` / `<weekday> this week` (the current ISO week). `next <weekday>` is refused as ambiguous.
- Everything else is `unparsed` → `unresolved_expr` → the date is dropped, the owner gets a `date_unresolved` alert, and
  `Slot Gate` asks `askDateTime` ("What day and time works for you?") again.
- Measured refusals: `wednesday 4 november`, `4 november`, `november 4`, `4.11`, `4/11` (`unparsed`); `this wednesday`
  on a Sunday (`anchored_past`, because the ISO week starts on Monday); `next wednesday` (`ambiguous_next`).

## 1. Goal
A customer who names a calendar date — with a month name or as day.month — gets that date, resolved deterministically
in the shop's timezone, or a re-ask that names the conflict and the forms that work; never a guessed date and never a
silent loop.

## 2. Scope / NOT-build
**In scope**
- Day + month, deterministic, in the shop's timezone (`business.timezone`):
  - `4 november`, `4th november`, `november 4`, `nov 4`, `4 nov`;
  - an optional leading weekday (`wednesday 4 november`, `wed, 4 nov`);
  - an optional four-digit year (`4 november 2026`);
  - numeric: `4.11`, `4.11.`, `4.11.2026`, `4/11`, `4/11/2026`.
- **A weekday that disagrees with the date** (`thursday 4 november`, while 4 November 2026 is a Wednesday) → no date;
  re-ask naming both: "4 November is a Wednesday — did you mean Wednesday 4 November, or a Thursday?" Never pick one.
- **A day+month already past this year** → the same day next year, only if that falls inside the booking horizon
  (decision D-2); otherwise re-ask "That date has passed — which date did you mean?".
- **A year given** → honoured as given: in the past → re-ask (passed); beyond the horizon → re-ask (too far ahead).
- **A day that does not exist** (`31 november`, `30.2`) → re-ask, naming it.
- **Ambiguous numeric forms** (`4/11` could be 4 November or 11 April) → per a config date order (decision D-1); with no
  order configured, a numeric pair where both parts are ≤ 12 and differ → re-ask naming both readings.
- **The datetime re-ask names the accepted forms**, so a customer cannot loop: when a date was DROPPED this turn, `Slot
  Gate` asks a new template, e.g. "Which day and time? You can write e.g. "Wednesday at 11:00", "tomorrow at 15:00" or
  "4 November at 11:00"." The plain `askDateTime` stays for a turn that simply named no date.
- **A second consecutive dropped date** → handoff with the owner alert (decision D-4), the same two-strike shape as
  `clarify` and `extraction-transient`.
- The model prompt: `dateExpr` keeps the customer's words verbatim, including a month name (already the contract —
  verified, not assumed, in the build).

**NOT-build**
- No natural-language ranges ("between the 4th and the 6th", "early next week"), no "in two weeks", no relative months
  ("the 4th of next month") — each stays a re-ask with the forms named.
- No change to `next <weekday>` (refused by design) or to `this <weekday>`'s ISO-week anchoring. ⚠ **Recorded, not
  built here, for a ruling (D-5):** on a SUNDAY "this Wednesday" points back to the past Wednesday and is refused;
  customers usually mean the coming one.
- No language other than English month/day names (the bot speaks English; the K-2 `business.locale` key stays dead
  unless D-1 revives it).
- No change to the anti-forgery rule: the expression must still occur in the customer's text.
- No change to time parsing.

## 3. Design (inside `Resolve Date`, before the weekday regex)
- One parser, `parseCalendarDate(e)` → `{ day, month, year|null, weekday|null, numeric: bool }` or null. Month names: the
  12 English names and their 3-letter forms (and `sept`). An ordinal suffix (`st|nd|rd|th`) is stripped. The
  expression is the STRIPPED one (`stripQualifiers`), and it must `occursIn` the customer's text exactly as today.
- Resolution, in order, each with its own `reason` (all new reasons listed in the alert map):
  1. invalid day/month → `invalid_date` (re-ask);
  2. numeric and ambiguous under D-1 → `ambiguous_numeric` (re-ask naming both readings);
  3. year given: in the past → `date_past`; beyond the horizon → `beyond_horizon`;
  4. no year: this year's date if today or later, else next year's if inside the horizon, else `date_past`;
  5. a weekday given that is not the date's weekday → `weekday_mismatch` (re-ask naming both);
  6. otherwise → `calendar_date` (resolved by code; the model's own `date` is cross-checked as today:
     `llm_date_ignored` when it differs).
- A same-day date whose time has already passed is left to `Compute Availability` (status `past`), as today.
- Each re-ask carries the reason to `Slot Gate`, which picks the template: a mismatch or an ambiguity names both
  readings (new templates, config keys), a past/invalid/too-far date says so, `unparsed` names the accepted forms.
- The reply for a re-ask is built from config templates, never from the model's text.

## 4. Skeleton (node level)
- `Resolve Date` (Code): `parseCalendarDate` + the six reasons; the alert map gains the new outcomes.
- `Slot Gate` (Code): picks the re-ask template from `date_resolution.reason` when `date_dropped`.
- `Load Config` (Code, a GATE node): new `messageTemplates` keys (`askDateTimeHint`, `dateWeekdayMismatch`,
  `dateAmbiguous`, `datePast`, `dateInvalid`, `dateTooFar`) and the D-1/D-2 config keys — through the deploy tool's
  `gate_edits` (exactly the approved keys and texts), as NAME-CAPTURE's `askName` did.
- The second-strike handoff (D-4): the existing two-strike pattern (a `last_intent` marker read from `Merge State`, as
  `Fill Name From Reply` does for D-3), routed to `Mark Handoff`.
- Config: `schemas/client.config.schema.json`, both example configs, `scripts/render-client.py` (the new literals) and
  its tests; `docs/` per the usual records.
- No new external call, no new store column.

## 5. Integrations
None new. The LLM (unchanged contract, verified), Postgres (unchanged), Google Calendar (unchanged; only reached once a
date resolves).

## 6. Mock data
Synthetic only: fixed `now` values in the tests (a Sunday, a Monday, 31 December, 29 February of a leap year), the
example configs' services and hours, synthetic names. No real customer data, no live calendar in the tests.

## 7. Critical-Review Targets (Codex)
**CRT #12 (Date resolution) re-opened** for this edit, on the booking path: can any explicit-date form produce a
date the customer did not name (a wrong-day booking), can the weekday/date conflict, the past/next-year rule, the
horizon or the numeric order be steered by the model's own `date` or by text outside the customer's message, and does
every refusal reach a re-ask (never a silent drop, never a loop without the forms named)? Plus the gate edit of `Load
Config` (exactly the approved keys) and the second-strike handoff's route.

## 8. Acceptance criteria
- Every form in scope resolves to the right ISO date in the shop's timezone, on fixed `now` values including year-end
  and a leap day; every form outside scope re-asks.
- `thursday 4 november` (2026) never books: a re-ask naming Wednesday 4 November.
- `4/11` follows D-1 exactly; with no order configured and both parts ≤ 12, a re-ask naming both readings.
- A dropped date re-asks with the accepted forms named; a second consecutive drop hands off with an owner alert.
- `resolve-date.test.cjs` green with the new rule table, its mutants killed, the committed-node replay
  of the owner script green, `check-all` 0, Codex on CRT #12 with no open HIGH/MEDIUM.

## 9. ⚙ Drill matrix
| Scenario | Setup | Expected | MUST-RUN | MUST-NOT-RUN |
|---|---|---|---|---|
| Owner's phrase | "haircut on Wednesday 4 November at 11:00", `now` Sun 1 Nov 2026 | 2026-11-04 → the name ask | Resolve Date `calendar_date` | the datetime re-ask |
| Weekday conflict | "Thursday 4 November" | re-ask naming Wednesday 4 November | `weekday_mismatch` | any date set |
| Past day+month | "4 October", `now` 1 Nov 2026, horizon per D-2 | next year only if inside the horizon, else re-ask | the horizon check | a past date booked |
| Year-end | "2 January", `now` 30 Dec | the coming 2 January | next-year rule | last January |
| Leap day | "29 February", `now` 1 Mar 2027 | re-ask (2027 has none) or 2028 only if inside the horizon | `invalid_date` / horizon | 1 March |
| Numeric ambiguous | "4/11", no order configured | re-ask naming 4 November / 11 April | `ambiguous_numeric` | a guess |
| Model forges a date | text "haircut on Wednesday", model `dateExpr` "4 november" | refused `expr_not_from_customer` | the anti-forgery rule | a date set |
| Loop guard | two turns each with an unparsable date | hint re-ask, then handoff + owner alert | the second-strike route | a third re-ask |
| Double booking / idempotency / injection | unchanged paths | unchanged (`booking-integrity.md`) | the existing suites | — |

## 10. Tests
- `tests/unit/resolve-date.test.cjs` — the committed (or staged) node, fixed `now`: one case per form, per reason, per
  boundary (year-end, leap day, horizon edge, same-day passed time), plus the forgery cases.
- `tests/unit/resolve-date-mutants.py` (new): mutants that drop the weekday check, swap day and month, ignore the year,
  ignore the horizon, accept an invalid day, read the model's `date` instead of the text, remove the hint template —
  each must turn the test red.
- **The test gap of 2026-11-01, closed:** an offline multi-turn replay (the scratchpad walker of the diagnosis, made a
  committed test: Code nodes from the export, IF/Switch/Set evaluated from their parameters, Postgres/Calendar/LLM
  stubbed, the model's answer given per turn) that runs (a) every owner script before it is handed out and (b) the
  golden cases' expected outputs end to end to their reply. The golden set gains explicit-date cases (G24…), each also
  run through it, so a phrasing the resolver refuses can no longer pass the golden set.
- `tests/unit/render-client.test.py`, `check-config-schema`, the drift guards — for the new config keys.

## 11. Deploy route
- **Order:** NAME-CAPTURE first — the owner's corrected run, then its promotion (staged → committed, `PENDING_KEYS`
  emptied, both parity guards green against the committed exports). Only then is this edit staged, on top of the
  promoted export (one staged Main at a time).
- Offline build → tests/mutants → Codex (CRT #12) → fixes → `rehearse-rollback` → `put` behind its own ⚠ ONAY → probe →
  parity → an owner run whose script was replayed → promotion. Rollback = the put's snapshot.

## 12. Automation-fit
Neither `/loop` nor `/goal`: a gated, single-pass edit with a live window.

## 13. Decisions for Yigitcan
- **D-1 numeric order:** (a) recommended — a config key `business.dateOrder` (`DMY` for this Vienna demo); a dot
  (`4.11`) is always day.month; a slash follows the key; with the key absent, an ambiguous pair re-asks. (b) always
  re-ask a numeric form whose parts are both ≤ 12. (c) revive `business.locale` (`en-AT`) as the source — not
  recommended: a locale string is a weaker contract than an explicit order, and it is a dead key today (K-2).
- **D-2 booking horizon:** a config key `bot.bookingHorizonDays` (recommended 90). Today there is none; a past
  day+month rolls to next year only inside it.
- **D-3 the hint text:** recommended "Which day and time? You can write e.g. "Wednesday at 11:00", "tomorrow at 15:00"
  or "4 November at 11:00"."
- **D-4 second consecutive dropped date → handoff** (recommended yes).
- **D-5 "this <weekday>" on a Sunday:** keep the ISO-week reading (refused, as today) or read it as the coming one —
  separate from this plan's scope unless ruled in.

## R1 — built offline (2026-11-01; NOT live)
**Rulings the build implements:** D-1 `business.dateOrder` (`DMY`; a dot is always day.month; key absent + both parts
≤ 12 and different → re-ask naming both) · D-2 `bot.bookingHorizonDays` 90 · D-3 the hint text, verbatim · D-4 a second
consecutive dropped date → handoff with the owner alert · D-5 in scope · A1 · the Load Config gate edit = exactly the
two config keys and the six templates.
**A ruling taken DURING the build (Yigitcan, 2026-11-01, answering the build's question):** the deploy tool's gate-edit
check accepted an added key only on its OWN line, and `business` and `bot` are each written on one line, so D-1/D-2
could not pass it. Ruled: **extend the check** — an added key may also be an inline `, key: value` segment just before the
closing ` }` of the one line holding its parent object; every other rule unchanged (the key new, the value exact,
nothing else in the literal moves). `scripts/diff-workflow-copy.py` `gate_edit_errs`, plus integer values in
`parse_delta`; nine inline cases in its selftest (one passes, eight red: the wrong object, another value, the value as
text, a second inline key, another value on the same line changed, the key also on its own line, a template missing,
another dateOrder).

**Built:**
- `Resolve Date` (staged Main): `parseCalendarDate` (day + month in the four forms of §2, an optional leading weekday,
  an optional four-digit year) and `resolveCalendar` (the order of §3: ambiguous slash → `ambiguous_numeric`; impossible
  day → `invalid_date`; a year given is honoured, past → `date_past`; no year → this year if today or later, else next
  year only inside the horizon, else `date_past`; a disagreeing weekday → `weekday_mismatch`; else `calendar_date`);
  `resolveWithin` — A1 on every resolved date → `beyond_horizon`; D-5 (`anchored_sunday`); the alert map gains the five
  new outcomes; D-4's strike.
- `Slot Gate`: a dropped date picks its template by outcome (`dateWeekdayMismatch`, `dateAmbiguous`, `datePast`,
  `dateInvalid`, `dateTooFar`), anything else the D-3 hint; a missing template falls back to `askDateTime`.
- `Load Config`: the eight keys, through the approved gate edits (`n8n/staged/workflow.main.delta.json`; the third
  entry of `APPROVED_DELTAS['main']`). No other node, no edge, Purge untouched.
- Config: `schemas/client.config.schema.json` (`dateOrder` enum, `bookingHorizonDays` integer ≥ 1, both optional as the
  node reads them), both example configs, `web/shared/src/config/client.config.types.ts` regenerated.
- **The prompt was checked, not changed:** `Build LLM Request` already says "Copy the customer's OWN wording for the DAY
  verbatim and lowercased, INCLUDING an absolute date they typed themselves", and the live model did exactly that in
  executions 4807/4808 (`dateExpr` "wednesday 4 november").

**Declared — choices the plan left open or did not spell out, each for review:**
1. **The five new template texts** beyond D-3's (only D-3's was ruled verbatim): "{date} is a {actual} — did you mean
   {actual} {date}, or a {said}?" · "Did you mean {a} or {b}?" · "That date has passed — which date did you mean?" ·
   "That date is not on the calendar — which date did you mean?" · "We take bookings up to {days} days ahead — which date
   did you mean?". The values are Resolve Date's own computation, never the model's text.
2. **D-5's edges:** "this sunday" said on a Sunday is TODAY (today's rule — it does not point back); the suffix form
   "<weekday> this week" keeps today's rule (it names the week explicitly).
3. **Two text checks against the model trimming the customer's words** (plan §7's concern, not a listed mechanism): a
   calendar expression followed in the text by a four-digit year or a numeric continuation the model left out →
   refused (`calendar_clipped`, outcome `expr_not_from_customer`); a weekday written right before the date counts as
   given even when the model dropped it (so "thursday 4 november" with `dateExpr` "4 november" still re-asks).
4. **A horizon or order the node does not recognise is treated as absent** (no horizon → nothing refused for distance,
   the `llmCostCapUsd` precedent; no order → the ambiguous rule). The committed literal carries both, and render-client
   refuses a client config without them once promoted.
5. **D-4's scope:** counted on a `book` or `reschedule` turn outside a pending confirmation; the strike turn's alert class
   is `date_handoff`. The marker `date_reask` never collides with `name_reask`/`clarify` (tested both ways).
6. **Observed, by the plan's own rule — for a ruling:** a day + month that passed this year and whose next-year date is
   beyond the horizon re-asks "That date has passed" — e.g. "31 January" said on 1 November (next year's is day 91).
   True in the plan's words, misleading to a customer who meant next January.
7. **The reschedule lane's re-ask is unchanged** (`rescheduleAskSlot`, no hint): the plan scoped the template choice to
   `Slot Gate`. D-4's strike does count there.
8. **Test files that assumed the staged Main is NAME-CAPTURE** were generalised: `workflow-step.test.py`'s CLI gate case
   (any staged edit's first own-line template key), `render-client-askname.test.py`'s control (skipped once the committed
   literal holds `askName`, not when no staged file exists). `resolve-date.test.cjs` reads the staged export when one
   exists; its row "11 september asks (date PARSING is still out of scope)" is corrected in place (it now resolves).
   Golden G15's route is corrected: its ISO date is beyond the horizon until 2027-08-18 (A1).

**Tests** *(terminal-measured)*: `date-phrasing.test.cjs` 19/19 — every case through Resolve Date → Merge Slots → Slot
Gate from the staged export, the words as input (17 of 19 red on the committed export) · `chat-replay.test.cjs` 6/6 —
the committed offline replay (`chat-replay.lib.cjs`): its CONTROL reproduces owner run 1's defect on the export before
this edit; owner run 1's recorded answer now reaches the name ask; owner run 2's seven recorded turns give the replies
the owner saw on both exports (NAME-CAPTURE unchanged); O’Neil and the move keeping the name; every stage-new golden
booking case end to end (2 of 6 red on the pre-edit export, the four NAME-CAPTURE/control ones green) · mutants
`date-phrasing-mutants.py` 25/25 (the first run left one alive — D-4's stage condition — and a test now pins it) ·
`resolve-date` 150/150 on the staged export · NAME-CAPTURE on the staged export: `name-capture` 34/34, its mutants 50/50,
`validate-intent` 37/37, `main-tur2` 38/38 · golden 27 (G24–G27 added) · `diff-workflow-copy` selftest OK (9 inline cases)
· the staged export + its delta through `diff-workflow-copy --phase edit` OK.

## R2 — Codex and the fixes (2026-11-01; NOT live)
**Codex R1** (contained, pin `120ee52`; prompt `docs/codex/date-phrasing/prompt.md`, answer verbatim `r1.md`,
containment `containment.md`): **2 HIGH, 3 MEDIUM, no LOW; no bypass of the extended gate-edit check** (it tried another
inline value, the value's type, a duplicate key, a comment, the wrong object — all red), the approved entry exactly the
eight keys; A1 and D-5 as declared. Every finding triaged **real** and fixed inside the approved design (the plan's §7
asks exactly whether the model can steer the date):
- **HIGH-1 — a weekday-only extraction bypassed the explicit date.** "haircut thursday 4 november" with `dateExpr`
  "thursday" booked 5 November (the conflict never seen); "wednesday 4 november 2027" as "wednesday" lost the year; a
  weekday not right before the date ("thursday on 4 november") was not seen either. **Fixed:** when the customer's text
  carries an explicit calendar date (`CAL_IN_TEXT`: a month name with a day; a slash pair; a dot pair only with a
  trailing dot, a year or a weekday right before it), an expression that is not a calendar date — a weekday,
  today/tomorrow, an ISO date — is refused (`calendar_clipped`); a weekday ANYWHERE in the message counts against the
  date. **Stated costs:** "may 2 people come friday" re-asks once ("<month> N of" is exempt, so the recorded case
  "may 2 of us come friday" (resolve-date N1-d) stays a Friday — the first version of this fix broke it and the
  existing suite caught it); another weekday mentioned for another reason ("I can't do thursday, 4 november") re-asks;
  a time written right after a weekday ("friday 9.10") counts as a dot date and re-asks once (measured). **Bound:** a bare
  dot pair NOT directly after a weekday ("thursday at 4.11", "thursday, the 4.11") is not detected — a bare "9.10" is
  too often a time — so there the weekday alone resolves (measured: "friday at 9.10" → the Friday).
- **HIGH-2 — an empty extraction inherited the stored date.** "5 november instead at 11:00" with `dateExpr`/`date` null
  kept the stored 4 November. **Fixed:** the empty-extraction backstop (`day_named_not_extracted`) now sees a calendar
  date too, so the date is dropped and the hint re-asks (and D-4 counts it).
- **MEDIUM-3 — year "0000" was read as no year** (a truthiness check). **Fixed:** a year given is `!== null`.
- **MEDIUM-4 — a compact time ("4 november 1100") was taken for a trimmed year.** **Fixed:** only a 19xx/20xx number
  that is not a time counts as a year.
- **MEDIUM-5 — three properties no test could fail:** the shop clock read in UTC, the horizon skipped for relative
  days, the handoff route cut. **Fixed:** a test at 23:30Z on Sunday (already Monday in Vienna: "this sunday" is the
  current week, 1 November is past); a 1-day horizon refusing a weekday and D-5's date; D-4 end to end in the replay
  (the hint, then the existing handoff reply through `Mark Handoff`, the `date_handoff` alert); a mutant for each.
- **Codex's note under question 4, acted on:** a booking with no known service asked the SERVICE while recording a date
  strike, so a second drop could hand off a customer who never saw the date hint. **Fixed:** D-4 counts on a booking turn
  only when its service is known (the date re-ask is what the customer sees), or on a reschedule turn.
- **Codex's note on question 6:** the R1 sentence "the test gap … closed" was stronger than the suites then were; the
  three surviving mutants above are now killed.

**Re-run after the fixes** *(terminal-measured)*: `date-phrasing` 27/27 (25 of 27 red on the committed export) ·
`chat-replay` 8/8 (4 of 8 red on the pre-edit export; the four green are the CONTROL and NAME-CAPTURE's flows) · mutants
36/36 (Codex's three survivors among them) · `resolve-date` 150/150 on the staged export (N1-d included) · NAME-CAPTURE on
the staged export: `name-capture` 34/34, mutants 50/50, `validate-intent` 37/37, `main-tur2` 38/38 · the staged export +
delta through `diff-workflow-copy --phase edit` OK.
