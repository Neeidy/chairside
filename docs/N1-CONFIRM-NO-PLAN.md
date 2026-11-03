# N1 PLAN — a designed path for "no" at the booking confirm

> **Status: APPROVED by Yigitcan, 2026-11-03** (by pasting the N1 R1 brief): D-1…D-5, D-7, D-8 as recommended, **D-6
> AMENDED** (a bare "yes" right after a decline re-asks the change question once; a second one in a row → today's handoff)
> and a Codex cap of two passes. **R1 built offline; R2 Codex (two passes, no HIGH); R3 LIVE — the Main put of
> 2026-11-02 23:06 Vienna; R4 the owner run read back and the edit PROMOTED — ✅ N1 CLOSED (2026-11-03)** — "R1"–"R4" at
> the end of this file. Written from the committed export at `4cd53fd`.
> **Ruling it implements:** Yigitcan's ruling, given by pasting the N1 brief (dated 2026-11-03 in the brief), says
> to plan N1 now and build only after his written "approved". ROADMAP calls N1 "a 'no' at the booking confirm has no
> designed path".
> **Not reopened:** the "change during confirmation" intent (ARCH-DEC 2026-09-09e, v2) and the booking-confirm
> freshness check (the v2 item carried at DATE-PHRASING R4). §3.7 shows where each one touches this plan and why neither
> is needed for it.

## 0. What the committed Main does today — measured offline

**Instrument:** the committed chat-replay harness (`tests/unit/chat-replay.lib.cjs`), driven by
[`docs/n1/replay-measure.cjs`](n1/replay-measure.cjs). Its full output is committed beside it as
[`replay-measure.out.txt`](n1/replay-measure.out.txt). What the harness runs, stubs and does not prove is written in
its own header. The **model's answer is GIVEN on every row, never called.**
- The first answer listed for each phrase is the one `Build LLM Request` instructs at stage `confirming`, quoted from
  the export: *"A clear agreement (yes/yep/ok/sure/confirm/that works) means intent=confirm and keep the same slots. A
  DIFFERENT service/date/time means intent=book with the new detail. Decline/cancel means intent=cancel. Unclear
  means low confidence."*
- Rows marked *alt* are plausible deviations from that instruction.

**Setup for every row:** the customer asks for "a haircut on Wednesday at 11:00" and gives the name "Kim Moss". The bot
asks: *"Haircut, Wednesday 4 Nov 2026 11:00 for Kim Moss — shall I book it? (yes / no)"*. At that point `stage =
confirming` and the slots hold haircut, 2026-11-04, 11:00 and Kim Moss.

| # | customer types | model answer (given) | reply | stage after | slots after | alert / handoff | then "yes" |
|---|---|---|---|---|---|---|---|
| A1 | `no` | cancel · 0.9 | *"You don't have an active booking to cancel."* | **confirming** | kept | none | **books the declined slot** |
| A2 | `no` | *alt* unknown · 0.4 | `askIntent` *"Hi! I can help you book, change or cancel…"* | confirming (`last_intent=clarify`) | kept | none | books it |
| A3 | `no` | *alt* confirm · 0.3 | `askIntent` (clarify) | confirming | kept | none | books it |
| A4 | `No thanks` | cancel · 0.9 | *"You don't have an active booking to cancel."* | confirming | kept | none | books it |
| A5 | `nope` | cancel · 0.85 | same as A4 | confirming | kept | none | books it |
| A6 | `no, make it 12:00` | book · 0.9 · time 12:00 | the confirm ask again, with 12:00 | confirming | time → 12:00 | none | books 12:00 ✅ |
| A7 | `no, make it 12:00` | *alt* cancel · 0.8 · time 12:00 | *"You don't have an active booking to cancel."* | confirming | **11:00 kept, 12:00 lost** | none | **books 11:00** |
| A8 | `actually Thursday` | book · 0.9 · dateExpr thursday | the confirm ask again, Thursday 5 Nov | confirming | date → 2026-11-05 | none | books Thursday ✅ |
| A9 | `cancel` | cancel · 0.95 | *"You don't have an active booking to cancel."* | confirming | kept | none | books it |
| A10 | `how much is a beard trim?` | answer_faq · 0.9 | *"Beard Trim is €15."* | confirming | kept | none | books it (see §3.7) |

**Two wider cases (part B of the output):**

| # | situation | what happens |
|---|---|---|
| B1 | The customer **already has a booking** (Haircut Wed 11:00), is at the confirm of a **second** one (Beard Trim Fri 10:00), and types `no` (model: cancel · 0.9) | The reply is ***"Cancel your Haircut on Wednesday 4 Nov 11:00? Reply "yes" to cancel…"***, so the "no" became a cancel ask about the OTHER, existing booking (`stage=cancel_confirming`, target = the existing row). A following "yes" **cancels the existing booking**. |
| B2 | `no` twice, both read unknown · 0.4 | First turn: clarify. Second turn: handoff + owner alert (`handoff`). This is the two-strike ladder working as designed. |
| B3 | For comparison: the **cancel** confirm's own `no` | *"No problem — your booking stands."* (`Build Cancel-Aborted State`), and the pending cancel is dropped. |

**What the measurement says:**
1. **No designed answer.** A plain "no" either gets an answer to a question that was not asked (A1, A4, A5, A9: "no
   booking to cancel") or the generic greeting (A2, A3). Nothing says "nothing is booked" or asks what to change.
2. **A declined confirm stays live.** In every "no" row `stage` stays `confirming` with the slots intact, and a later
   "yes" (or "ok", or anything the model reads as `confirm`) **books the slot the customer declined**. The booking-confirm
   lane has no freshness check to stop it; that check is the carried v2 item (handoff.md: *"`Confirm Router` →
   `Reschedule Router` → `Build Event Request` has no freshness check"*).
3. **Our own contract contradicts itself.** The prompt defines `cancel` at a booking confirm as *decline*, but
   `Route Intent` sends every `cancel` to `Find Booking` → `Cancel Lookup`, which means "cancel an EXISTING booking".
   With no booking that is the wrong sentence (A1). With one it is the B1 misroute: the customer is one "yes" away from
   cancelling a booking they kept. It is not silent, because the cancel ask names the booking, but it is the wrong question.
4. **"No + a new detail" already works when the model follows the prompt (A6, A8):** the existing `book` lane re-merges
   and re-confirms. It fails only when the model reads the "no" as `cancel` (A7).

**From the proposed post-decline state (part C):** `stage = collecting`, slots and name kept. This state was written into
the replay's in-memory store; the export is unchanged. From there today's engine:
- **re-confirms** a new time (C1), a new day (C2), a new service (C3), a new name (C4), and the original slot restated
  (C5), all through the existing `book` → `Merge Slots` → availability path, with the name kept;
- routes a bare "yes" to the existing fail-closed gate (C6: `Build Event Request` sees `stage !== 'confirming'`, so the
  eventId is empty, then `Event ID Valid?` → `Mark Handoff`, owner alert `handoff`). **No booking**;
- answers a second "no" read as `cancel` with "no booking to cancel" (C7). With an existing booking it gives the
  existing booking's cancel ask (C10);
- answers an unclear turn with clarify (C8), and a question as a question (C9).

So the proposed state needs **no new code on the change path**. §3.5 covers C7 and §3.6 covers C6.

## 1. Goal
A customer who answers the booking confirm with "no" gets a designed answer: *nothing is booked, here is what you can
change*. The declined confirm can no longer be booked by a later "yes", and a "no" at a booking confirm never turns
into a question about cancelling a different booking.

## 2. Scope / NOT-build
**In:**
- one deterministic check at the booking confirm, for a closed yes/no-shaped "no";
- the model's confident `cancel` at a booking confirm read as the decline the prompt already defines it to be;
- the decline transition (leave `confirming`, keep the slots and the name, ask what to change);
- a second closed "no" after a decline closes the request;
- two message templates;
- tests, mutants and a negative control;
- the config surfaces, the screen inventory and the flow diagram.

**NOT built:**
- the "change during confirmation" intent (v2, ARCH-DEC 2026-09-09e);
- a freshness check / TTL on the booking confirm (v2, carried);
- any prompt or schema change (`Build LLM Request`, `schemas/intent.schema.json`) — no LLM behaviour changes, so no paid eval is needed;
- a pre-LLM shortcut that skips the model call (§13 D-1);
- a new `stage` value;
- any DB / schema migration (`last_intent` is free `text`, `db/schema/001_init.sql` line 58);
- any change to the cancel or reschedule confirm, `Find Booking`, `Cancel Lookup`, the write path, Purge or the dashboard;
- other languages: the customer text stays English, the repo's stated bound.

## 3. Design

**3.1 Where.** Add one IF, **`Booking Declined?`**, on `Abort Reschedule?`'s false output, in front of `Uncertain Turn?`.
⚠ *Corrected at R1 (§4): the checks of §3.2, §3.3 and §3.5 (and D-6 as amended) live in a Code node,
`Classify Confirm Reply`, placed in front of that IF; the IF reads only the tag it sets.*
- **Where that is today (measured):** `Abort Reschedule?` false → `Uncertain Turn?`. The cancel and reschedule confirms
  already drop a non-`confirm` answer at that point (`Abort Cancel?` → `Build Cancel-Aborted State`, `Abort Reschedule?`
  → `Build Reschedule-Aborted State`). The booking confirm gets the same shape, at the same place.
- **Why after the model call, not before it:** every downstream node reads `$('Validate Intent')`, so skipping the model
  would mean synthesising that item (§13 D-1). A "no" costs one LLM call, the same as today.
- **What runs before it (unchanged):** the earlier gates — kill-switch, spend, `Extraction Transient?`, `Invalid or
  Handoff Gate`, `Confirm Pending & Uncertain?`. A model failure on a "no" therefore keeps its own visible class (§3.7).

**3.2 The deterministic check — a closed set, matched on the text.** At `state.stage === 'confirming'` the turn is a
decline when the inbound text is exactly a closed "no":
- **The pattern:** `^(?:no|nope|nah|no thanks|no thank you|not now)[.!]*$`, case-insensitive, after trimming spaces.
  The set is ruled in §13 D-2.
- **Where the text comes from:** `$json.text`, which is present on the item at this point (measured: `"No thanks"`).
- **It overrides the model's answer.** For this closed shape the text decides and the model's intent and confidence are
  not consulted. That is deterministic-before-AI, and it makes A1–A5 independent of what the model says.
- **Anything longer goes to the model, as today.** "no, make it 12:00" or "no 🙂" are examples.

**3.3 The model's `cancel` at a booking confirm = decline.** At `state.stage === 'confirming'`, `intent === 'cancel'`
with `confidence ≥ bot.confidenceThreshold` is a decline too (§13 D-3).
- **Why:** it is the meaning our own prompt gives `cancel` in that stage (§0, point 3). It closes A9 and B1: from this
  turn the bot never asks about cancelling a different booking.
- **A customer who did mean an existing booking** says "cancel" again on the next turn. The stage is then `collecting`
  and the existing cancel lane answers (C10, measured).
- **An uncertain `cancel` is not a decline.** It goes to `Uncertain Turn?` → clarify as today (A2/A3 shape) and the
  confirm stays pending, so handoff.md's "never drop a pending confirmation on a classification we distrust" holds.
  The only drop without a confident classification is §3.2's, and that one rests on the text, not on a classification.

**3.4 The decline transition — `Build Booking-Declined State`** (new Code node, → `Save State`, which already exists).
It returns `{ ...vi, state: { ...st, stage: 'collecting', last_intent: 'declined', confirm_turn: '' }, computed_reply:
messageTemplates.bookingDeclined }`.
- **The slots** are the STORED ones (`st.slots` at this point holds them, measured), so service, date, time and name are
  kept and `Save State` writes them back unchanged.
- **Demo text (§13 D-5):** *"No problem — nothing is booked. What would you like to change: the service, the day, the
  time or the name?"*
- **What the path does not do:** no owner alert on the normal path, because a customer changing their mind is not a fault
  (a `Save State` FAILURE still takes its own error branch and alerts the owner — *precision added at R2,
  `security-auditor` LOW-1*); no `Find Booking`
  read; no Calendar call; no appointment write. `last_intent='declined'` is the audit trail (prompt-injection.md:
  "log every action").

**3.5 A second closed "no" closes the request (§13 D-4).** The same IF also fires when `state.stage === 'collecting'`,
the PREVIOUS turn's `last_intent` is `'declined'`, and the text matches the closed set of §3.2.
- **Where the previous value comes from:** `$('Merge State').first().json.state.last_intent`. At this point
  `$json.state.last_intent` already holds THIS turn's value (measured: `cancel` vs `Merge State`'s `book`), which is why
  `Repeat Uncertain?` reads it the same way.
- **What the Build node writes:** `stage: 'new'`, `last_intent: 'dropped'`, service/date/time emptied, the name kept.
- **Demo text:** *"Okay — nothing is booked. Message me any time you'd like to book."*
- **Why:** without this rung C7 answers a customer who said "no" twice with "you don't have an active booking to
  cancel". A non-locking class still needs an exit (handoff.md: "no lock quietly means no exit").

**3.6 After a decline: what each next turn does** — all measured in part C, none needing new code:

| next turn | result |
|---|---|
| new time / day / service / name, or the original slot restated | re-confirm (C1–C5) |
| a question | answered (C9) |
| something unclear | clarify (C8) |
| bare "yes" | ⚠ *ruled at approval (D-6 amended):* the change question once more (`decline_reask`, no lock, no write); a second bare "yes" in a row → today's fail-closed handoff (C6) — **never a booking** |
| "cancel" with an existing booking | that booking's own cancel ask (C10) |

**3.7 "No + a new detail", and what this plan leaves alone.**
- **"no, make it 12:00" when the model follows the prompt** (`book` + the time): it does not match §3.2. It reaches the
  existing `book` lane and re-confirms with 12:00 (A6). That lane is reused unchanged.
- **The same message read as `cancel` (A7):** §3.3 makes it a decline. The 12:00 is **not merged**: the stored slot is
  kept and the reply asks what to change, so the customer types the time once more. **Recorded bound: one extra turn,
  never a wrong booking.** Merging a detail out of a `cancel` would mean rewriting the model's intent, which is the v2
  change-during-confirmation design and is not reopened here.
- **A question at the confirm (A10)** keeps the confirm pending, and a later "yes" books it. That is the carried v2
  freshness item, unchanged and recorded in a test so a later change to it is visible.
- **The cancel and reschedule confirms** are untouched (B3 stays as it is).
- **The two-strike ladder for non-closed uncertain turns** is untouched (B2).
- **A model failure on a "no"** (unparseable answer, schema failure, `handoff`) still meets its own earlier gate:
  extraction-transient or intent-handoff, both visible. A closed "no" is matched only after those gates. **Bound,
  recorded.**

## 4. Skeleton (node level)
**Main (edited)** — ⚠ *corrected at R1 (declared deviation, "R1" below): THREE new nodes, not two. D-6 as amended gives
the decision a third outcome (the re-ask), so an IF expression plus a regex-free Build node could no longer tell the
turns apart without a second copy of the closed sets; the classification moved into its own Code node.*
- **`Classify Confirm Reply`** (NEW Code): carries §3.2, §3.3, §3.5 and D-6 (amended) — the ONE copy of the closed sets;
  tags the turn `declined` / `decline_reask` / `dropped`, and passes every other turn through unchanged.
- **`Booking Declined?`** (NEW IF): `!!$json._booking_reply`.
- **`Build Booking-Declined State`** (NEW Code): builds the state for the tag; no regex of its own.
- **`Sticky — Booking declined`** (NEW sticky note).
- **Edges:** remove `Abort Reschedule?|1|Uncertain Turn?|0`; add `Abort Reschedule?|1|Classify Confirm Reply|0`,
  `Classify Confirm Reply|0|Booking Declined?|0`, `Booking Declined?|0|Build Booking-Declined State|0`,
  `Booking Declined?|1|Uncertain Turn?|0` and `Build Booking-Declined State|0|Save State|0`.
- **`Load Config`** gains exactly `messageTemplates.bookingDeclined` and `messageTemplates.bookingDropped`
  (a `gate_edits` entry, §13 D-5).
- **Nothing else in Main changes.**

**Config:** `config/client.config.example.json` and `config/client.config.example-b.json` (the two templates);
`render-client` refuses a config without them, by the same mechanism `askName` used (`PENDING_KEYS` while staged,
emptied at promotion).

**Docs:**
- `docs/SCREEN-INVENTORY.md` and `docs/UX-ARCHITECTURE.md`: two new reply rows next to W12/W22;
- `docs/FLOW-DIAGRAM.md`: the new branch;
- `tests/regression-suite.md`: new rows;
- `tests/golden-set.md`: expected model answers for the "no" phrasings at a seeded `confirming` stage, which is not run
  live — the same status as G8.

**Tests:** see §10. **Delta:** a new `APPROVED_DELTAS['main']` entry in `scripts/diff-workflow-copy.py` (§11).

## 5. Integrations
None new:
- **Postgres:** only `Save State`, which already exists. The decline turn drops today's `Find Booking` read.
- **Google Calendar:** no call on the decline path.
- **LLM:** one call per turn, the same as today, with no prompt change.
- **Telegram:** no new alert. C6's existing `handoff` alert is unchanged.
- **Untouched:** Zernio, Turnstile, Vercel and the site.

## 6. Mock data
Synthetic names only (`Kim Moss`, `Sam Lee`, `Testname`) in the replay, the unit tests and the golden rows. The live
check is the owner's own run through Turnstile on the demo calendar. His rows stay as demo data unless he rules
otherwise. No real customer name enters a fixture or a report.

## 7. Critical-Review Targets (Codex)
The change adds no write and REMOVES two paths: a pending booking that survived a "no", and a "no" turning into a cancel
ask about another booking. The targets it touches:
- **#5 (handoff threshold).** Two drops of a pending confirmation: a deterministic one (§3.2) and a confident-model one
  (§3.3). Is there any route where a drop rests on an UNCERTAIN classification? An uncertain `cancel` must still clarify.
- **#8 (booking mutation via bot).** The B1 route is closed from the booking-confirm turn; the cancel lane itself is
  unchanged. Can any booking-confirm "no" still reach `Cancel Lookup`?
- **#1b / #2 (the booking write).** No new write. Can a "yes" after a decline reach `Book Appointment` (C6: it must not)?
  Can `Build Booking-Declined State` leave `stage = confirming`?

One Codex pass on the delta (§13 D-7), not a new target.

## 8. Acceptance criteria

*Status at R4 (2026-11-03), each line ✅ with its evidence: "offline" = the replay tests at the promoted export
(`n1-confirm-no` 26/26, mutants 39/39); "live" = the owner run, Main executions 4895–4907, read back by GET and with
`salon_ro`. ⚠ Criteria 1 and 5 are REWORDED in place: they said "any owner alert", which
the live run showed is wider than what N1 can promise — execution 4905 alerted from `Resolve Date`, which runs BEFORE
the N1 nodes and is unchanged by them. What N1 promises is no alert FROM THE N1 NODES (the R4 brief's step 1 said "no
alert", and Cowork recorded that wording as its own brief error). **The 4905 alert is a pre-existing bound (ruling,
2026-11-03):** the live model answered that "no" with `cancel` 0.85 AND the stored beard slots echoed — date set, `dateExpr`
empty — and `Resolve Date` alerts on exactly that (`date_without_expr` → `date_expr_missing`; execution order 26–32, the
N1 nodes 38–46). The same answer replayed alerts on this export AND on `bc6eadf` (before N1); the same turn with empty
slots alerts on neither (`docs/n1/alert-4905-replay.cjs`, output committed beside it).*

1. **A closed "no" at the booking confirm** (§3.2's set, any case and trailing `.`/`!`) gets `bookingDeclined`,
   whatever the model answered (cancel / unknown / confirm-low / book). After it: `stage=collecting`,
   `last_intent=declined`, and service, date, time and name kept. Not on the path: `Find Booking`, any Calendar node,
   `Write Appointment` and any owner alert from the N1 nodes on the normal path (a `Save State` failure keeps its own
   alerting error branch — *precision added at R3, `security-auditor`*; an alert raised UPSTREAM of the N1 nodes, as
   `Resolve Date`'s `date_expr_missing` in 4905, is outside this criterion — *reworded at R4*).
   — ✅ offline; **live** 4897, 4899, 4905: tag `declined` from the closed set, state as stated, no Calendar or
   appointment node; the N1 nodes raised no alert (4905's came from `Resolve Date`, above).
2. **A confident model `cancel` at the booking confirm** gets the same result (A1, A4, A5, A7, A9 and B1). No
   `Cancel Lookup` runs on that turn, so the existing booking in B1 gets no cancel ask.
   — ✅ offline; **live** 4905 is B1 itself: the model said `cancel` at 0.85 with a Haircut booked, and the reply was the
   change question, not a cancel ask (the closed set matched too, so live shows the outcome, not the model-only path).
3. **An uncertain `cancel` or `unknown` on a non-closed text** keeps today's clarify, and the confirm stays pending.
   — ✅ offline only (the owner run had no such turn).
4. **After a decline:** a new time, day, service or name — or the original slot restated — re-confirms (C1–C5); a bare
   "yes" never books (C6); a question is answered (C9).
   — ✅ offline; **live** 4898: "12:00 instead" re-confirmed at 12:00 with the name. C6 and C9 offline only.
5. **A second closed "no" after a decline** gets `bookingDropped`: `stage=new`, service/date/time cleared, name kept,
   no alert from the N1 nodes (*reworded at R4, as in 1*).
   — ✅ offline; **live** 4900: tag `dropped` — from the closed set ALONE (the model said `unknown` at 0.4), state as
   stated, no alert; `salon_ro`: that conversation `new` / `dropped`.
6. **Unchanged:**
   - "yes" at the confirm books (A6 and A8, then "yes");
   - a question at the confirm keeps it pending (A10, the v2 freshness item, recorded);
   - the cancel and reschedule confirms' own "no" (B3);
   - two uncertain non-closed turns hand off (B2);
   - every existing replay test and golden case stays green.
   — ✅ offline (`check-all` 0 at the promoted export); **live** 4903 "yes" booked (Book Appointment → Verify Slot →
   Write Appointment), 4906–4907 the cancel confirm unchanged (`Delete Booking Event` 204, the row `cancelled`).
7. **Config:** both templates are in `Load Config` and in both example configs; `render-client` refuses a config
   without them; the inventory and flow-diagram rows exist.
   — ✅ `render-client-n1` 6/6 at the promoted export (its two controls against the unpromoted literal skip after the
   promotion, by design; 8/8 at R1, staged); `render-client` OK with `PENDING_KEYS` empty and the two `Build Booking-Declined State`
   fallbacks on the A-leak `ALLOW` list ("every entry still hits": green).
8. **Release:** guards at 0; parity green against the committed exports after promotion; the owner's live run shows (1)
   and (4), read back by GET on executions and with `salon_ro`.
   — ✅ R4: content parity 5/5 and structural parity (196/196 nodes, 278/278 connections) against the COMMITTED exports;
   the owner run read back as in 1–6.

## 9. ⚙ Drill matrix
| scenario | setup | expected | MUST-RUN | MUST-NOT-RUN |
|---|---|---|---|---|
| plain "no" | confirm → `no` (each model answer A1–A3) | `bookingDeclined`, collecting, slots kept | `Booking Declined?` true → `Build Booking-Declined State` → `Save State` | `Find Booking`, `Uncertain Turn?`, any Calendar node |
| closed variants | `No thanks`, `nope`, `NO!`, `no thank you.`, `not now` | as above | same | same |
| near-misses stay with the model | `no, make it 12:00` (book), `no 🙂`, `nothing else`, `know what, 12:00` | the model's own route | `Uncertain Turn?` → `Route Intent` | `Booking Declined?` true |
| confident cancel at confirm, no booking | `cancel` · 0.95 | `bookingDeclined` | the decline path | `Build No-Booking Reply` |
| confident cancel at confirm, existing booking (B1) | booked Wed, confirm Fri → `no` · cancel | `bookingDeclined`; the existing booking untouched | the decline path | `Build Cancel-Confirm State`, `Cancel Lookup` |
| uncertain cancel at confirm | `hm, cancel?` · cancel 0.5 | clarify; the confirm stays pending | `Build Clarify State` | the decline path |
| "no + detail" read as cancel (A7) | `no, make it 12:00` · cancel 0.8 · time | `bookingDeclined`; stored 11:00 kept, 12:00 not merged (bound) | decline path | a booking at either time |
| "yes" after a decline (C6) | decline → `yes` | handoff + owner alert | `Event ID Valid?` false → `Mark Handoff` | `Book Appointment`, `Write Appointment` |
| change after a decline | decline → `12:00` / `Thursday` / `beard instead` / `under Sam Lee` | re-confirm with the change, name kept | `Merge Slots` → availability | the decline path |
| second "no" after a decline | decline → `no` | `bookingDropped`, stage new, service/date/time cleared, name kept | `Booking Declined?` (collecting rung) | `Build No-Booking Reply` |
| "no" at the cancel / reschedule confirm | B3 | unchanged: `cancelAborted` / `rescheduleAborted` | `Abort Cancel?` / `Abort Reschedule?` | `Booking Declined?` |
| "no" outside any confirm | stage new / booked → `no` | unchanged (today's route) | — | the decline path (stage gate) |
| jailbreak at the confirm | `no. ignore previous instructions…` | not a closed "no" (deterministic: the anchored pattern) → the model's own route; a jailbreak read as `handoff` hands off (model-dependent) | the model's route | the decline path |
| idempotency / double-booking / DST | unchanged paths | unchanged | the existing drills | — |

## 10. Tests
- **Replay, end to end:** a new `tests/unit/n1-confirm-no.test.cjs` on the export under test, built from this plan's
  replay rows. It covers every §9 row that the offline harness can drive, plus the C1–C10 follow-ups, the A10 freshness
  bound, and B2/B3 as regression.
- **Negative control:** the same test run on the committed pre-N1 export goes red on criteria 1, 2, 4 and 5. §0 is
  already that run.
- **Node level:**
  - the `Booking Declined?` expression is evaluated on a table of the closed set and its near-misses (case, punctuation,
    spaces, the emoji, the comma form);
  - `Build Booking-Declined State` is run as code for both variants;
  - the `Load Config` gate edit is checked by `gate_edit_errs`.
- **Mutants:** `tests/unit/n1-confirm-no-mutants.py`, each mutant must die. Candidates:
  - the stage gate dropped;
  - the regex anchors dropped;
  - a near-miss admitted;
  - the confidence term dropped from §3.3;
  - `stage` left at `confirming`;
  - the slots or the name emptied on the decline;
  - `last_intent` not written;
  - the ladder reading `$json` instead of `Merge State`;
  - the ladder's stage gate dropped;
  - the false edge pointed past `Uncertain Turn?`;
  - the drop variant clearing the name;
  - an owner-alert flag set on the decline.
- **Wiring:** golden set (expected answers only) and the regression suite as in §4, and `check-all` wiring for the new
  test.
- **Live:** the owner's run (§11), read back with GET and `salon_ro`.

## 11. Deploy route, rollback, rounds
**Route:** `scripts/workflow-step.py put` with a new `APPROVED_DELTAS['main']` entry:
- `add_nodes {Classify Confirm Reply, Booking Declined?, Build Booking-Declined State, Sticky — Booking declined}`
  (*corrected at R1, §4*);
- the five edges of §4 added and the one removed;
- `gate_edits {'Load Config': {messageTemplates.bookingDeclined, messageTemplates.bookingDropped}}`.

IF, Code and sticky note are all in `ADDABLE_TYPES`. Everything else is unchanged and `compare` holds it so.

**Procedure** (as at DATE-PHRASING R3):
1. Start gates first, outside :55–:05: the Turnstile dummy 403, parity, listeners and host-leak.
2. `rehearse-rollback` with a live snapshot in the scratchpad (0600, outside the repo).
3. The put, then probe and both parity guards against the staged export.
4. End gates.

**No in-flight precondition is needed this time, and the reason is stated rather than assumed:** the change adds an exit
from `confirming` and changes no confirm text, slot shape or write. A conversation already at `confirming` when the put
lands meets the new path like any other. One that reached `collecting` before the put has no `last_intent='declined'`,
so the §3.5 rung cannot fire for it.

**⚠ ONAY blocks** (each its own written approval, in the shape of `irreversible-actions.md`):
```
⚠ ONAY GEREKİYOR (1)
Ne yapacağım:      Canlı Main iş akışına iki yeni node ve bir dal ekleyip yayınlayacağım (önce geri-alma provası).
Neden:             Rezervasyon onayındaki "no" için tasarlanmış cevap canlıya çıksın.
Yanlışsa ne olur:  Yanlış randevu ya da takvim kaydı oluşmaz (bu yolda Calendar ve Write Appointment yok); en kötü durumda bekleyen bir onay düşer ve müşteri slotu yeniden onaylar.
Geri alınabilir mi:Evet — put öncesi alınan canlı snapshot ile tek komutla geri yüklenir (prova edilmiş olur).

⚠ ONAY GEREKİYOR (2)
Ne yapacağım:      Kapılardan biri kırmızı dönerse canlı Main'i put öncesi snapshot'a geri yükleyeceğim.
Neden:             Kırmızı bir canlı sürüm üretimde kalmasın.
Yanlışsa ne olur:  Geri yükleme yanlış snapshot'tan yapılırsa önceki sürümden farklı bir graf canlıya çıkar.
Geri alınabilir mi:Evet — snapshot ve committed export ikisi de durur; parity ölçer.

⚠ ONAY GEREKİYOR (3)
Ne yapacağım:      Promosyon ve parity yeşil olduktan sonra canlı snapshot'ı ve staged dosyayı sileceğim.
Neden:             Snapshot canlı değerler taşır; iş kapanınca tutulmaz (remote-operator.md).
Yanlışsa ne olur:  Promosyon eksikse geri-alma kaynağı kaybolur.
Geri alınabilir mi:Hayır — bu yüzden yalnız parity committed export'a karşı yeşilken yapılır.
```

**Owner run (his browser — it needs a real Turnstile token)** — ⚠ *corrected at R2: the brief of the approval round set
the two scripts, and the R1 tests replay THOSE (Codex pass 1 noted that this list differed from them):*
1. Book → confirm → `no` → the change question → a new time → the new confirm → `no` → `no` again → closed
   (`bookingDropped`); nothing booked.
2. A booking made first → a second booking → its confirm → `no` → NO cancel ask about the first → then the first is
   cancelled cleanly ("cancel my haircut" → its cancel ask → `yes`), so nothing stays booked.
The exact lines are `OWNER_SCRIPT_1` / `OWNER_SCRIPT_2` in `tests/unit/n1-confirm-no.test.cjs`, each replayed through
the staged Main.

Read back by GET on executions and with `salon_ro`. The run also records what the live model answers for "no",
which this plan only assumes (§13 D-8).

**Promotion:** staged → committed, parity 0 against the committed exports, then ⚠ ONAY (3).

**Rounds (estimate, 3–4):**
- **R1:** offline build — nodes, delta, config, tests, mutants, staged export — plus the L2 agents (`flow-reviewer`,
  `code-reviewer`, `qa-tester`, `security-auditor`).
- **Codex:** on the §7 delta.
- **R2:** fixes. Skipped if Codex finds nothing.
- **R3:** live put, then STOP for the owner run.
- **R4:** read the run, promote, records.

## 12. Automation-fit
Neither `/loop` nor `/goal`: every step ends at a human gate (the plan approval, the put, the owner's live run).

## 13. Decisions for the approver — each with a recommendation
- **D-1 Where the check sits.**
  - **Recommended:** after the model call, on `Abort Reschedule?`'s false output (§3.1). It mirrors the cancel and
    reschedule aborts, the topology change is the smallest, and spend is the same as today.
  - *Alternative:* a pre-LLM shortcut. It saves one call per "no", but every downstream node reads `$('Validate Intent')`,
    so that item would have to be synthesised.
- **D-2 The closed set.**
  - **Recommended:** `no · nope · nah · no thanks · no thank you · not now`, with trailing `.`/`!`, case-insensitive,
    nothing else.
  - *Alternatives:* adding `n` (one stray key would then drop a confirm), or `cancel` (unnecessary: D-3 covers it
    through the model with a confidence floor).
- **D-3 A confident model `cancel` at a booking confirm is a decline.**
  - **Recommended:** yes (§3.3). It is our own prompt's definition, and it closes B1. A customer who meant an existing
    booking says "cancel" again (C10).
  - *Alternative:* text-only (D-2) and leave B1 as it is.
- **D-4 A second closed "no" after a decline closes the request.**
  - **Recommended:** yes (§3.5): stage `new`, service/date/time cleared, name kept.
  - *Alternative:* none, which leaves C7's "no booking to cancel".
- **D-5 The two templates live in `Load Config`** (a `gate_edits` entry, as `askName` and the date templates did).
  - **Recommended:** yes — config-driven and visible, and `render-client` makes a new client set them.
  - *Alternative:* the `OPTIONAL` route with a code fallback (as `cancelRetry`). It touches fewer surfaces, but the
    demo text would live in a node.
  - **Texts proposed in §3.4 and §3.5; amend them freely.**
- **D-6 A bare "yes" after a decline.** ⚠ **Ruled AMENDED (2026-11-03):** the first bare "yes" right after a decline
  re-asks the change question once (non-locking, the clarify/two-strike shape); a second one in a row → today's handoff.
  *Reason given: the change question invites "yes"; a one-word lock is the greeting dead-end class fixed 2026-09-07.*
  - **Recommended (not taken):** keep today's fail-closed handoff (C6) as a recorded bound. It is rare after a reply that asks what
    to change; it is visible and never a booking.
  - *Alternative:* a new path that re-asks the confirm. That is new code on the confirm lane, close to the v2 design.
- **D-7 Codex.**
  - **Recommended:** one pass on the delta against #5, #8 and #1b/#2 (§7).
  - *Alternative:* the L2 agents only.
- **D-8 No separate paid eval.**
  - **Recommended:** none. The design does not depend on the model's answer for a closed "no"; the owner's live run
    records it for "no", and for "no, make it 12:00" if he types it.
  - *Alternative:* a capped paid mini-eval (≤ 10 calls) at R1, under its own approval.

## R1 — built offline (2026-11-03)

**What was built** (staged Main only; nothing live):
- `n8n/staged/workflow.main.sanitized.json` + `workflow.main.delta.json`: the three nodes and the sticky of §4, the edge
  swap, `Load Config`'s two gate-edit lines. `diff-workflow-copy --phase edit` against the committed export: only
  `Load Config` differs among existing nodes. `staged-sanitised`: the delta is exactly the approved one.
- `scripts/diff-workflow-copy.py`: the N1 entry in `APPROVED_DELTAS['main']` (`N1_GATE_EDITS`).
- Config: both examples carry the two texts — example-b in its own voice. `PENDING_KEYS` holds the two keys while they
  are staged (`tests/unit/render-client.test.py`).
- Docs: `SCREEN-INVENTORY` W12a/W12b, `UX-ARCHITECTURE`, `FLOW-DIAGRAM`, `tests/regression-suite.md` N1-1…N1-7, golden
  G28–G30 (expected outputs only — no model run).

**Declared deviations from the approved plan** (`governance-sync.md` §5):
1. **Three nodes, not two** — `Classify Confirm Reply` added in front of `Booking Declined?` (§4, corrected in place).
   D-6 as amended gives the decision a third outcome; keeping the plan's shape would have meant the closed sets in the
   IF expression AND a second copy in the Build node to tell "no" from "yes". The Code node holds the one copy; the IF
   reads only its tag.
2. **The markers' names:** `last_intent` = `declined`, `decline_reask` (the D-6 re-ask) and `dropped`. The plan named the
   first and the last; the middle one is new with the amendment.
3. **The D-6 re-ask reuses `bookingDeclined`** — the brief says "re-asks the change question"; no third template, so the
   approved gate edit (D-5: two keys) stands as approved.
4. **D-6's trigger mirrors D-3:** a closed "yes" (`yes · yeah · yep · yup · ok · okay · sure · yes please · that works ·
   confirm`, trailing `.`/`!`) or a CONFIDENT model `confirm`. A detail in that message is not merged — §3.7's bound.
5. **A "no" right after the re-ask closes the request too** (D-4 extended to `decline_reask`).
6. **Promotion step recorded now:** at promotion `PENDING_KEYS` is emptied and the Build node's two fallbacks (the demo's
   texts) go on render-client's A-leak `ALLOW` list, one entry each — the render of example-b then carries them as code
   fallbacks it never reaches (the render refuses a config without the keys).

**A bound of D-6, recorded:** the SECOND bare "yes" goes to today's route, so its outcome is today's: a confident
`confirm` → `Build Event Request` (stage `collecting`) → `Event ID Valid?` false → `Mark Handoff` with the `handoff` alert;
an uncertain reading → today's clarify (no lock, no write), and the next uncertain turn hands off. Never a booking.

**A harness limit found, not an engine defect:** the chat-replay stub of `Delete Booking Event` matches
`_cancel_target.eventId`, which the cancel lane does not carry, so its in-memory calendar keeps a cancelled event — on
the committed export too (measured). The owner-script test reads the delete from the path (node ran, 204) instead.

**Tests** (in `check-all`, which exits 0):
- `tests/unit/n1-confirm-no.test.cjs` — 25 tests: the closed sets run as code (positives under five model readings, 16
  near-misses, D-3's floor inclusive, the stage and previous-turn gates, pass-through unchanged), `Load Config`'s two
  texts, the graph (the new nodes read only `Load Config` and `Merge State`; the true branch reaches `Save State` only),
  every §9 row end to end, D-6 and its bound, both owner scripts line by line, and the NEGATIVE CONTROL on the export at
  `bc6eadf`, which shows the §0 defect (on the committed export the test is 6 green / 19 red — ⚠ *corrected at R2: this
  said 18, a count taken before the last test was added; Codex pass 1 measured 19*).
- `tests/unit/n1-confirm-no-mutants.py` — 34/34 killed, the unmutated control green. Two survived the first run and each
  showed a gap in the test, now closed: a "no" set unanchored at the start (no near-miss ending in "no" — "oh no", "is
  that a no" added) and the after-decline rung without its stage gate (no case with the marker kept under another stage).
- `tests/unit/render-client-n1.test.py` — 8 cases: both examples render with their own texts; a config without either
  key is refused by name; the control against the committed exports.
- Unchanged behaviour: `name-capture.test.cjs`, `date-phrasing.test.cjs`, `chat-replay.test.cjs` green on the staged
  export; `date-phrasing-mutants.py` 60/60 and `name-capture-mutants.py` 50/50 against it, both controls green.

## R2 — Codex pass 1 and the fixes (2026-11-03)

**Codex pass 1** at `819982f` (contained; verbatim `docs/codex/n1/p1.md`, containment `docs/codex/n1/containment.md`):
**no HIGH**, one MEDIUM and two LOW, plus two record imprecisions. Its answers: CRT #5 — uncertainty protections hold;
CRT #8 — a booking-confirm decline cannot enter the cancel lane that turn, and the markers do not alter the cancel or
reschedule confirms; CRT #1b/#2 — the new path preserves booking integrity; D-6 — exactly one re-ask; the deploy tool's
entry and the staged export match.

| finding | triage | fix |
|---|---|---|
| **F1 MEDIUM** — the re-ask test never checks the slots; a builder that rewrites the stored time on the re-ask passed 25/25 | real (a test defect; the builder keeps the slots) | the D-6 test asserts the slots and the name after the re-ask; mutant "the re-ask alone corrupts the stored slots" |
| **F2 LOW** — the closed set matched more than the stated literal phrases: `toLowerCase()` turns the KELVIN SIGN (U+212A) into `k`, and a line break collapsed like a space | real (no booking-integrity effect; the declared set was not what ran) | `Classify Confirm Reply` matches with the `/i` flag instead of lower-casing (a non-Unicode `/i` never maps a non-ASCII character to an ASCII one — measured: the Kelvin sign, the long s, fullwidth and Cyrillic look-alikes all fail; `NO THANKS`, a tab, `No Thank You!` match) and collapses only spaces and tabs. A test of look-alikes and line breaks (red on the R1 staged export, green after); mutants "toLowerCase back", "a line break collapsed", "the /i flag dropped" |
| **F3 LOW** — the "no confidence" case passed `undefined` into a default and tested 0.4 | real (a test defect; the engine also rejects it earlier, in `Validate Intent`) | the helper can leave the key ABSENT; for D-3 an absent, `undefined`, `null`, `NaN` and STRING confidence, for the D-6 re-ask an absent, `null` and string one, are each not confident (⚠ *corrected after pass 2: this said all five for both*); mutants "a missing confidence counted as confident", "a string confidence compared as a number" |
| record — "6 green / 18 red" | real | corrected in place to 19 (the R1 number was taken before the last test was added) |
| record — §11's owner-run list differed from the replayed owner scripts | real | §11 corrected in place to the approval brief's two scripts, which the tests replay |

**Also in this round:** `security-auditor`'s LOW-1 of the R1 push — "no owner alert" holds on the normal path only; a
`Save State` failure still alerts — the sticky, the Build node's comment and §3.4 now say so.

**Re-run** (`check-all` 0): `n1-confirm-no` 26/26 (on the unedited committed export 6 green / 20 red), mutants 39/39 with
the control green, `staged-sanitised` and `diff-workflow-copy --phase edit` green. Every change is inside the three new
nodes and the sticky; the delta is unchanged.

**The cap (ruling):** pass 1 had real findings, so pass 2 ran on this round's diff (below). After pass 2, a finding of the same
class as one above is recorded as a bound, not chased; a NEW class that writes or cancels a booking wrongly is a stop.

## R2 recheck — Codex pass 2, the last (2026-11-03)

**Codex pass 2** at `a0779a7` (contained; verbatim `docs/codex/n1/p2.md`): **no HIGH, no MEDIUM, one LOW.** F1, F2 and
F3 closed — each defect it showed now turns a test red (each relevant mutant run alone: 25 green / 1 red). The `/i`
matching is sound: no non-ASCII code point matches `/[a-z]/i`, and all 1,372 ASCII case variants of the six decline
phrases match. Everything else in the edit is byte-identical to pass 1's pin (the delta, the deploy checker, the
committed export; three changed JSON lines). The R2 counts reproduce (26/26, 39/39, 6 green / 20 red).

**The LOW — recorded as a BOUND (ruling: after pass 2, a finding of an earlier class is recorded, not chased):**
`.trim()` runs first and removes LEADING and TRAILING whitespace of any kind, so `"no\n"`, `"\nno"` and a `no` wrapped
in no-break spaces are still the closed "no" — the F2 class (the closed set's scope), no booking written or cancelled
(the replay showed stage `collecting`, zero appointments). The engine's comment said "a line break does not [collapse]"
without that qualification; it is corrected in place — **comments only, every code line byte-equal (asserted by the
edit script)** — and this paragraph is the record.

**One record qualification, corrected in place:** R2's F3 row said all five confidence shapes are tested for D-3 AND
the D-6 re-ask; the re-ask tests three of them (the shared guard handles the other two).

**Codex for N1 is closed by the cap.** The remaining gate to the live step is this round's ⚠ ONAY condition: A–C green
and no open HIGH — both true.

## R3 — LIVE: the Main put; ⏸ STOPPED for the owner run (2026-11-02, server time)

*(The approval brief is dated 2026-11-03; the server clock read 2026-11-02 for this window, and the times below are the
server's, Vienna.)* *(Every read and number below terminal-measured, output not committed.)*

**Precondition of the ⚠ ONAY, both true:** A–C fully green (`check-all` 0; `n1-confirm-no` 26/26; mutants 39/39 with the
control green; DATE-PHRASING 60/60 and NAME-CAPTURE 50/50 mutants on the final staged export; Codex pass 2 the last, no
open HIGH).

**The window, 23:06–23:07 Vienna (outside :55–:05, away from 04:00):**
- Start gates (23:06:11): dummy token → 403, sole holder · `check-exports-parity` 5/5 against the committed exports ·
  live parity 192/192 nodes, 274/274 connections · listeners OK · host-leak clean · hook-drift OK · import-safe over the
  window's scripts 0 faults · clean tree.
- `rehearse-rollback` (green on a scratch, scratch deleted, 404 read back) → deactivate → **put**: the nodes whose
  stored content changed are exactly `Classify Confirm Reply`, `Booking Declined?`, `Build Booking-Declined State`,
  `Load Config` and the sticky; inside the allowlist (1 node) and the approved delta; **read back == export and == the
  body sent**; settings, webhook ids unchanged; the pre-PUT snapshot kept (0600, outside the repo) → activate: active,
  **published == draft** (inactive from 22:06:30.8Z to 22:06:34.1Z, about three seconds) → probe: dummy token 403, sole
  holder.
- **Parity against the STAGED export** (a scratch mirror of HEAD with the staged Main in the committed path — the guard
  refuses a staged path): content OK (172 executable nodes), settings OK, structure 196/196 nodes, 278/278 connections.
  **Negative control:** the same structural guard against the COMMITTED export → DRIFT (192 vs 196) — red by
  construction until promotion.
- **The window's executions:** three on Main, all probes (4876, 4877, 4878), all `success`; none on the other four
  workflows. No customer turn, no error, no owner alert, no LLM spend.
- End gates (23:07:19): dummy token 403 · Main parity against the committed export red by construction, the other four
  green · listeners, host-leak, hook-drift OK · 0 project containers.

**The owner's run** — the two scripts of §11, each line replayed through the staged Main (`OWNER_SCRIPT_1/2` in
`tests/unit/n1-confirm-no.test.cjs`, and again at Tuesday 3 Nov 07:00Z and 17:00Z: identical replies). A store read as
`salon_ro` (READ ONLY): no booked appointment overlaps 3–6 Nov (control: one booked appointment in total, the owner's
11 Nov row). The calendar itself is not read here — the bot's own `Get Calendar Busy` decides at run time. **Run each
script in a fresh private window** (a new widget session: no earlier booking of his is visible to it, so the owner's
kept rows are never in reach) **and before Wednesday 4 Nov** ("Wednesday" resolves to the coming one).

**Kept for rollback and promotion:** the pre-PUT snapshot and the parity mirror (scratchpad); both are deleted after
promotion with parity green (⚠ ONAY (3) of §11). Content parity against the committed Main stays red until then.

**Next round:** read the owner's run (executions + `salon_ro`), then promotion — staged → committed, `PENDING_KEYS`
emptied, the two A-leak `ALLOW` entries (R1 deviation 6), both parity guards 0 against the committed exports.

## R4 — the owner run read back, promoted; ✅ N1 CLOSED (2026-11-03)

*(Every read and number below terminal-measured, output not committed — except the attribution replay, which is
committed with its output: `docs/n1/alert-4905-replay.cjs`.)*

**The run.** Cowork ran both scripts at Yigitcan's request (2026-11-03, about 14:18–14:21 Vienna), each in a fresh tab
of his own browser, with a real Turnstile token that passed without a challenge. Every reply matched the script (Cowork's
reading). **Read back by GET on the n8n executions:** Main 4895–4907, thirteen turns (6 + 7), every one `success`;
the other workflows ran only their schedules. Outcome per turn:

| turn | execution | model (live) | N1 classifier | result |
|---|---|---|---|---|
| 1 · first `no` | 4897 | `cancel` 0.85 | `declined` (the closed set) | the change question; `collecting`, haircut 4 Nov 11:00 + the name kept |
| 1 · `12:00 instead` | 4898 | `book` 0.92 | — | the confirm again, at 12:00, with the name |
| 1 · second `no` | 4899 | `cancel` 0.85 | `declined` (the closed set) | the change question; the 12:00 slot kept |
| 1 · `no` after the decline | 4900 | `unknown` 0.4 | `dropped` (the closed set ALONE) | `bookingDropped`; `new`, service/date/time emptied, the name kept |
| 2 · `yes` | 4903 | `confirm` 0.92 | — | booked: `Book Appointment` → `Verify Slot` → `Write Appointment` |
| 2 · `no` at the second confirm | 4905 | `cancel` 0.85, the stored slots echoed | `declined` (the closed set) | the change question, **no cancel ask about the haircut** (B1 live) |
| 2 · `cancel my haircut` → `yes` | 4906–4907 | `cancel` 0.95 → `confirm` 0.95 | — | the cancel ask, then `Delete Booking Event` 204 and `Update Appointment Cancelled` |

On every declined turn no Calendar node and no appointment node ran. 4900 is the one turn where the closed set carried
the outcome by itself: the model was below the threshold, and without the set the turn would have gone to the clarify
ladder. **The store, as `salon_ro` (READ ONLY):** one appointment was created in the run, the Haircut on 4 Nov 10:00Z,
now `cancelled`; there is no Beard Trim on 6 Nov (an instrument control: the same query finds the Haircut on 4 Nov);
the two conversations end `new` / `dropped` and `cancelled`; `processed_messages` holds 13 claims.

**The one mismatch, and the ruling.** 4905 ran `Send Owner Alert (Telegram)`, class `date_expr_missing`. It came from
`Resolve Date` → `Date Alert?` (execution order 26–32), which runs before the N1 nodes (38–46) and is unchanged by N1.
The model's answer to that `no` echoed the stored beard slots with a date and an empty `dateExpr`, and `Resolve Date`
alerts on exactly that shape. Replayed with the same answer, the alert fires on the committed export AND on `bc6eadf`
(before N1); with empty slots it fires on neither. Before N1 the same turn also asked to cancel the haircut. **The
brief's step 1 said "no alert", and Cowork recorded that wording as its own brief error:** the criterion is "no alert
from the N1 nodes", and the N1 nodes raised none. The stop came first and the round waited for the ruling.
**Ruling (Yigitcan, 2026-11-03):** a pre-existing bound, independent of N1. §8's criteria 1 and 5 were reworded in place.
**Named and carried, not built now:** *a false owner alert at a pending confirm when the model echoes the stored slots
without a `dateExpr` (`date_expr_missing`): an alarm-fatigue candidate.* **Recorded observation, no action (ruling):**
the cancelled conversation still holds the declined Beard Trim slots. It is not at a confirm stage, so nothing can book
them.

**Promoted (`0ba4003`):** the staged Main became the committed export; `n8n/staged/` is empty; `PENDING_KEYS` is empty
and the two `Build Booking-Declined State` fallbacks are on the A-leak `ALLOW` list (R1 deviation 6), and the allowlist's
"every entry still hits" check is green. After the commit, both parity guards are at 0 against the COMMITTED exports:
content 5/5, structure 196/196 nodes and 278/278 connections. `check-all` 0, `n1-confirm-no` 26/26 and mutants 39/39,
all at the promoted export. The acceptance criteria are ticked with their evidence (`92e1622`, §8). `security-auditor`'s two LOWs on that push
were fixed before it (`259f7c4`): `render-client-n1` is 6/6 at the promoted export, because its two controls skip
after the promotion (8/8 was R1's staged count), and REPO-MAP was regenerated. **Cleaned:** after
the push, the pre-put snapshot and the parity mirror were deleted on literal absolute paths and their absence was read
back (⚠ ONAY of the R4 brief).

**The window (two parts, 18:11–18:16 and 18:39–18:59 Vienna):** Main ran only the four probe executions, 4912–4915;
there was no chat message, no LLM call and no live write. The Turnstile dummy token got 403 at the start and the end; host-leak 0,
secret-scan 0, hook-drift OK, listeners OK, 0 project containers.

### Definition of Done — N1
| Item | Status | Evidence |
|---|---|---|
| Built | ✅ | R1–R2 staged, live since the R3 put, promoted at `0ba4003` |
| Tested (happy + key edge) | ✅ | §8 ticked; `n1-confirm-no` 26/26 (control red on `bc6eadf`), mutants 39/39; DATE-PHRASING 60/60 and NAME-CAPTURE 50/50 mutants on the staged export (byte-identical to the promoted one; not re-run at R4); the owner's live run, both scripts; Codex two passes |
| Cleaned | ✅ | `n8n/staged/` empty; the snapshot and the mirror deleted, absence read back |
| Sanitized (secrets and PII) | ✅ | `security-auditor` GO before every push of N1; synthetic names only |
| README / case-study | ✅ (2026-11-03) | closed at the public-demo close: the README's "Try this" and "What works today" describe the decline path (`6723b40`), the case study's §13 tells it (`53be52d`). *(Was "⚠ open" at R4; corrected in place.)* |
| Pushed | ✅ | origin/main = the records commit of this round |
| Resume-point memory written AND read back | ✅ | the progress memory, read back in this round |

**N1 is CLOSED**, with one DoD item recorded as open (above). **Carried:**
- the `date_expr_missing` false alert at a pending confirm (named above);
- v2: a freshness check on the booking confirm;
- the README / case-study *(closed at the public-demo close, 2026-11-03)*;
- Cloudflare's default retry beside ours (unmeasured);
- the widget's device-local stamps;
- the Vercel token, revoked at the phase close.

