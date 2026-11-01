# DATE-PHRASING PLAN — explicit calendar dates ("4 November", "Wednesday 4 November", "4.11")

> **Status: PLAN ONLY — awaiting Yigitcan's written "approved" (`.claude/rules/plan-gate.md`).** Nothing below is built.
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
