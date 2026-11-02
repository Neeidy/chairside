# DATE-PHRASING PLAN — explicit calendar dates ("4 November", "Wednesday 4 November", "4.11")

> **Status: APPROVED 2026-11-01 (Yigitcan, written: "tarih plani onaylı onerdigin sekilde") with D-1…D-4 as recommended,
> D-5 in scope (Sunday "this <weekday>" → the coming week) and A1 (the horizon applies to every resolved date). R1 built
> offline — "R1" at the end; NOT live.** *(This line said "PLAN ONLY — awaiting approval … Nothing below is built" until R1.)*
> **R2d (ruling 2026-11-02, option B):** the r4 stop was ruled — the guarantee is STRUCTURAL (the year in both confirm
> asks), D-2 amended to **30** days, the text-side checks stay only as best-effort, the r4 class is a recorded bound.
> Section "R2d" at the end. Still NOT live.
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
  day+month rolls to next year only inside it. *(Ruled 90 on 2026-11-01; **amended to 30** by the R2d ruling of
  2026-11-02 — section "R2d".)*
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
   `Slot Gate`. D-4's strike counts there *since R2b* — this item said it already did, which Codex R2 MEDIUM-6 showed
   false (Reschedule Lookup lost the marker); fixed by ruling, see R2b.
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
  today/tomorrow, an ISO date — is refused (`calendar_clipped`); a weekday anywhere in the message counts against the
  date *(corrected at R2b: only while the expression carried no weekday of its own — Codex R2 MEDIUM-5)*. **Stated
  costs:** "may 2 people come friday" re-asks once (the recorded case "may 2 of us come friday" (resolve-date N1-d) stays
  a Friday — the first version of this fix broke it and the existing suite caught it; *the exemption was "<month> N of"
  here until R2b narrowed it to "may N of <word>" — Codex R2 HIGH-2*); another weekday mentioned for another reason
  ("I can't do thursday, 4 november") re-asks;
  a time written right after a weekday ("friday 9.10") counts as a dot date and re-asks once (measured). **Bound:** a bare
  dot pair NOT directly after a weekday ("thursday at 4.11", "thursday, the 4.11") is not detected — a bare "9.10" is
  too often a time — so there the weekday alone resolves (measured: "friday at 9.10" → the Friday).
- **HIGH-2 — an empty extraction inherited the stored date.** "5 november instead at 11:00" with `dateExpr`/`date` null
  kept the stored 4 November. **Fixed:** the empty-extraction backstop (`day_named_not_extracted`) now sees a calendar
  date too, so the date is dropped and the hint re-asks (and D-4 counts it).
- **MEDIUM-3 — year "0000" was read as no year** (a truthiness check). **Fixed:** a year given is `!== null`.
- **MEDIUM-4 — a compact time ("4 november 1100") was taken for a trimmed year.** R2 narrowed the year check to a
  19xx/20xx number right after the date; **R2b reversed that**, because it let "5 november 2100", "… 0000" and "… in
  2027" resolve to this year (Codex R2 HIGH-1). The compact-time refusal is now a STATED COST (R2b, below).
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

### R2 recheck and R2b — the fixes for the recheck (2026-11-02; NOT live)
**Codex recheck** (contained, pin `719ac88`; prompt `prompt-r2.md`, answer verbatim `r2.md`): the R1 counterexamples
closed, MEDIUM-5's mutants killed, the D-4 service note fixed, no unrelated change — and **3 HIGH, 4 MEDIUM** new, every
one real:
- **HIGH-1 — R2's MEDIUM-4 narrowing re-opened year clipping:** "5 november 0000/2100/1899" extracted as "5 november"
  resolved to this year (the reschedule lane too). **Fixed** — *as R2c restated it:* while the expression carries no
  year, the message with its well-formed times taken out must hold no number of three or more digits (R2b's "not part
  of a colon time" let "2100: at 11:00" through — Codex R3 HIGH-1). **STATED COST:** a compact time ("4 november 1100",
  "… at 1930") re-asks; "11:00" passes.
- **HIGH-2 — the "<month> N of" exemption kept a stale date:** "november 5 of 2027" with an empty extraction inherited
  the stored date. **Fixed:** only the modal "may N of …" is exempt — *R2b allowed any word after "of", which let "may 5
  of the year 2027" through (Codex R3 HIGH-2); R2c allows only a pronoun or possessive.*
- **HIGH-3 — "thursday,4.11" (no space after the comma) was not detected** and booked the Thursday. **Fixed:** a dot pair
  right after a weekday with or without a space, a comma or "the". **Bound (restated):** a dot pair separated from the
  weekday by other words ("thursday at 4.11") is not detected.
- **MEDIUM-4 — compact evening times refused:** now the stated cost above (HIGH-1 wins: a refusal is cheap, a wrong year
  is not).
- **MEDIUM-5 — the expression's own weekday switched off the message's other weekdays:** both are now checked.
- **MEDIUM-6 — D-4 never fired on the reschedule lane:** Reschedule Lookup rebuilt the state from Validate Intent
  (upstream of Resolve Date) and dropped the marker. **Ruling (Yigitcan, 2026-11-02, answering the build's question):
  carry the marker** — a one-line edit of Reschedule Lookup (only `last_intent` is taken from Resolve Date's output);
  it joins the delta's allow list (four nodes). Tested end to end in the replay.
- **MEDIUM-7 — two regressions survived:** the weekday-adjacent dot detector removed, and "today" exempted. Both now
  mutants, killed; tests added for the bare "thursday 4.11" and "today, 5 november".

**Re-run after R2b** *(terminal-measured)*: `date-phrasing` 30/30 (28 of 30 red on the committed export) ·
`chat-replay` 9/9 (5 of 9 red on the pre-edit export) · mutants 42/42 (the recheck's two survivors among them) ·
`resolve-date` 150/150 on the staged export · NAME-CAPTURE on the staged export: `name-capture` 34/34, mutants 50/50,
`validate-intent` 37/37, `main-tur2` 38/38 · the staged export + delta (four allowed nodes) through
`diff-workflow-copy --phase edit` OK.

### R3 recheck and R2c — the third Codex round on the same rule (2026-11-02; NOT live)
**Codex recheck** (contained, pin `e803474`; prompt `prompt-r3.md`, answer verbatim `r3.md`): HIGH-3 and MEDIUM-5/6/7
closed, Reschedule Lookup exactly as ruled, no unrelated change — and **3 HIGH, 1 MEDIUM**:
- **HIGH-1 — "5 november 2100: at 11:00"** (a year followed by a colon) resolved to this year in both lanes. **Fixed,
  structurally:** the message's well-formed times ("11:00", "11.30") are taken out first; then any number of three or
  more digits refuses while the expression carries no year. No more year shapes to enumerate.
- **HIGH-2 — "may 5 of the year 2027"** matched the modal exemption. **Fixed:** the exemption applies only before a
  pronoun or possessive (us, them, you, we, my, our, your, his, her, their).
- **HIGH-3 — the confirm turn books the stored slot even when the message names another date.** Codex marks it itself as
  **pre-existing and recorded** (Resolve Date's header; ARCH-DEC 2026-09-09e, "no veto": the confirm books the slot the
  customer was SHOWN, and a different date said on that turn raises `date_changed_on_confirm` to the owner). Not changed
  in this round — outside the approved plan; it stands as recorded, now with DATE-PHRASING's dates in it.
- **MEDIUM-4 — a three-digit number was protected but untested.** A test and a mutant now pin it.
- A fourth mutant became necessary: with the structural year rule, a four-digit year after a dot date is caught twice,
  so only a two-digit year ("4.11.27") still depends on the numeric-continuation check — a test pins that.

**Re-run after R2c** *(terminal-measured)*: `date-phrasing` 32/32 (30 red on the committed export) · `chat-replay` 9/9
(5 red on the pre-edit export) · mutants 44/44 · `resolve-date` 150/150 on the staged export (N1-d stays a Friday) ·
NAME-CAPTURE on the staged export: 34/34, mutants 50/50, `validate-intent` 37/37, `main-tur2` 38/38 · the staged export +
delta through `diff-workflow-copy --phase edit` OK.

**THRESHOLD, declared before the next measurement (`make-the-error-cheap`):** this is the third adjustment of the
text-detection rules (`CAL_IN_TEXT`, the year check). If the R2c recheck finds another HIGH in the same class, the rule
is NOT tuned a fourth time: the next step is a ruling on a design change (for example, refusing every message whose text
holds a digit or a month name unless the expression parses as a calendar date covering ALL of them), with its cost
measured first.

### R4 recheck — THE DECLARED THRESHOLD IS MET; the build STOPS for a design ruling (2026-11-02; NOT live)
**Codex recheck** (contained, pin `7731b8e`; prompt `prompt-r4.md`, answer verbatim `r4.md`): R3's exact
counterexamples and MEDIUM-4 closed, only `Resolve Date` changed — and **2 HIGH in the same detection class**:
- **HIGH-1 — a two-digit year after a month name** ("haircut 5 november '27", `dateExpr` "5 november") resolves to
  2026, in the booking AND the reschedule lane. The structural year check looks at three or more digits; only a dot date
  had a continuation check.
- **HIGH-2 — the pronoun-only exemption still hides a real May date** ("May 5 of our anniversary year, 2027" with an
  empty extraction keeps the stored date). The exemption is syntactic; it cannot tell the modal from the month.
**Per the threshold declared in R2c, the rule is NOT tuned a fourth time.** Four Codex rounds have each found the same
property — *the model's `dateExpr` can drop part of a date the customer wrote, and a text-side detector built from
patterns misses some wording* — in a different spelling. Each fix closed its examples and opened none of the earlier
ones, but the class stays open. **Nothing in this edit is live; Main still runs the promoted NAME-CAPTURE export**
(parity against the committed exports 0), so production has today's narrower resolver: these wrong-date paths exist
only in the staged edit.
**The ruling asked for** — options in the round report; the recommendation is a **full-cover rule** replacing the
patterns: when the customer's message holds any digit (outside well-formed times) or any month name, a date is accepted
only if the expression is a calendar or ISO date whose occurrence in the message covers EVERY such digit run and month
name; anything else re-asks with the hint. It ends the class rather than a spelling of it — no exemption list, no year
shapes — and its cost (a stray number such as "for 2 people", and the recorded case "may 2 of us come friday", resolve-date
N1-d, would re-ask once) is to be MEASURED on the golden set, the regression suite and the replay fixtures BEFORE the
ruling, not after.

## R2d — the r4 stop ruled: a structural defence, no more text-side rules (2026-11-02; NOT live)
**The ruling, verbatim** (Yigitcan, 2026-11-02, by pasting the R2d brief; option B, horizon amended by him):
> (1) The guarantee is STRUCTURAL: the booking confirm and the reschedule confirm show the full resolved date WITH the
> year (e.g. "Haircut, Thursday 5 Nov 2026 11:00 for <name> — shall I book it? (yes / no)"; the reschedule confirm both
> dates with years); nothing is written without the customer's "yes" (unchanged).
> (2) D-2 amended: `bot.bookingHorizonDays` = 30 (A1 unchanged: it applies to every resolved date, ISO included).
> (3) The text-side "did the model drop a part" detection is NOT extended. What R2–R2c built stays only if its tests are
> green and it is labelled best-effort in code and records; if a piece of it is what produces the r4-class false sense
> of coverage, say so and propose removal — do not tune it.
> (4) The r4 class is recorded as a BOUND, with its defence: the full date incl. year is shown before any write, and the
> horizon is 30 days. Full-cover (option A) NOT adopted.

**What was built** (staged Main only; three commits, one logical change each):
- `25c7191` — `Compute Availability`'s confirm ask formats the slot `cccc d LLL yyyy HH:mm`; `Compute Reschedule
  Availability`'s move confirm shows both dates that way. Every other reply keeps its wording (the busy and past replies
  are pinned unchanged). Every pin moved with it: the site hero sample and the static `SitePanel` line, the hero drift
  guard (`scripts/check-hero-engine-text.cjs` — now also parses the W12 sample with the engine's confirm format, and
  reads the staged Main while one exists), the design mockups, `docs/SCREEN-INVENTORY.md`, `docs/UX-ARCHITECTURE.md`,
  `tests/unit/chat-replay.test.cjs` (owner run 2 split by export), `tests/unit/name-capture.test.cjs`.
- `19ca6c8` — `bot.bookingHorizonDays` 30 in the staged `Load Config` gate edit, its delta entry, the deploy tool's
  approved value (`scripts/diff-workflow-copy.py`; the selftest also refuses the pre-R2d 90) and both example configs.
- `abc6b84` — `Resolve Date`: comments only (every code line byte-equal, asserted by the build script). One BEST-EFFORT
  block names every text-side check and points at the structural guarantee; the check sites carry the label.

**The tests that carry the guarantee** (in `check-all`; mutants in `tests/unit/date-phrasing-mutants.py`):
- `date-phrasing.test.cjs` — both confirms show the SLOT's year (a January slot on 20 Dec 2026 shows 2027), the busy
  and past replies unchanged; the 30-day boundary (day 30 inside, day 31 refused; day+month and ISO).
- `chat-replay.test.cjs` test 9 — after a year-bearing confirm ask, ONE turn of eleven kinds in between (nothing, an
  uncertain turn naming another date, an uncertain turn, another date, another time, an empty extraction, another name,
  a question, a "yes" naming another date, a reschedule, a cancel), then "yes": every booking row and calendar event,
  and every moved slot, is the slot of the LAST confirm ask shown. Both lanes. Test 10 — across the year end.
- Mutants for the year in both confirms (dropped, the short format read, the year taken from the clock, the year spread
  to other replies, a move confirm showing another date than the one written) and for the bound (90, 31, 29).

**The bound (ruling point 4) — the r4 class, recorded with its defence:**
*The model's `dateExpr` can drop part of a date the customer wrote, and the best-effort text-side checks miss some
phrasings* — r4's "haircut 5 november '27" (resolves to 5 Nov 2026) and "May 5 of our anniversary year, 2027" with an
empty extraction (keeps the stored date) are the recorded examples; more exist and are not chased. **The defence:** the
slot that "yes" writes is shown in full, with its year, in the confirm ask immediately before the write — r4 HIGH-1
becomes "Haircut, Thursday 5 Nov 2026 11:00 … — shall I book it?" and HIGH-2 re-shows the stored date with its year —
and the horizon is 30 days, so a date meant for another year is outside it anyway. **What the defence does NOT do,
stated:** it relies on the customer reading the confirm; a "yes" to a wrong date that was shown books that date. It does
not cover the recorded confirm-turn behaviour (ARCH-DEC 2026-09-09e; Codex r3 HIGH-3): a "yes" that names another date
books the slot shown, with the `date_changed_on_confirm` owner alert — the slot written is still the one shown. A plain
booking confirm stays answerable across an interleaved turn (no freshness check on `confirming`, `handoff.md`); test 9
shows that the write is still the last slot shown.

**What stays best-effort (ruling point 3), and the removal question answered:** `CAL_IN_TEXT` with its "may N of
<pronoun>" exemption, the numeric-continuation and omitted-year checks, the weekday scan and the empty-extraction
backstop — all green, all labelled. **No piece produces a false sense of coverage by itself:** each one only REFUSES (a
re-ask); none resolves a date, so removing one only removes catches. The false sense lived in SENTENCES — "the date must
come FROM it" in the code, and this plan's own R2–R2c sections presenting each fix as closing the class; the code sentence
now says "should … best-effort", and this section is the record that the class is a bound. **One piece is named
because it is the mechanism of r4 HIGH-2:** the "may N of <pronoun>" exemption (kept so that resolve-date N1-d, "may 2 of
us come friday", stays a Friday). Removing it would flip N1-d to a re-ask and catch that one phrasing — a trade on a
spelling, i.e. tuning by another name. **Recommendation: keep it**; the year-bearing confirm is what covers HIGH-2.

**Measured while re-pinning to 30 days, and left for a ruling (no behaviour change made):** the plan's rule for a
day+month without a year that has passed this year and whose next-year date is beyond the horizon is "passed"
(`datePast`). With 90 days that edge held the dates behind us this year whose next-year date is more than 90 days ahead
(on 3 Nov 2026: 2 February – 2 November, mostly dates just gone). With 30 it also takes the next-year dates 31–90 days
ahead — on 3 Nov 2026, 1 January – 1 February: "haircut on 15 january" answers "That date has passed — which date did
you mean?" (replayed). The customer means next January; "We take bookings up to 30 days ahead" (`dateTooFar`) would be the true reply. A one-line change of the outcome
in `resolveCalendar`; not made, because the rule was approved as written.

