# HARDENING B4 — the live drill (2026-11-18)

**Run:** 2026-11-18, the Turnstile window open 96 s (15:06:08 → 15:07:44 UTC), through `scripts/turnstile-window.py` (the
gate lowered on Main only for the command, restored in `finally`, proven by a dummy-token 403 afterwards). Real model
calls (19), real events on the demo calendar (3 created, 3 cancelled by the bot), one real owner alert, one signed owner
release. Synthetic customer "Kim Moss"; every sender and message id under the seed tool's clean-up prefix. Reviewed
before the run by an independent Live-GO (two NO-GO rounds, all findings fixed). The drill script is kept with the
session record, not in the repo.

| Step | Sent | Reply (excerpt) | Result |
|---|---|---|---|
| A1 book | 'a haircut on friday at 11:00' | 200 'What name should I put the booking under? (Any name is fine for this demo.)' | pass |
| A2 name → confirm | 'Kim Moss' | 200 'Haircut, Friday 20 Nov 2026 11:00 for Kim Moss — shall I book it? (yes / no)' | pass |
| A3 clear yes → booked | 'yes please' | 200 "You're booked: Haircut, Friday 20 Nov 11:00. See you then!" | pass |
| A4 second booking → confirm | 'and a haircut on saturday at 12:00' | 200 'Haircut, Saturday 21 Nov 2026 12:00 for Kim Moss — shall I book it? (yes / no)' | pass |
| A5 yes → booked | 'yes' | 200 "You're booked: Haircut, Saturday 21 Nov 12:00. See you then!" | pass |
| A6 F2: two bookings, no day → which one | 'cancel my booking' | 200 'You have 2 bookings: Haircut on Friday 20 Nov 11:00 or Haircut on Saturday 21 Nov 12:00. Which one should I ca' | pass |
| A7 the named one → its confirm | 'cancel the saturday one' | 200 'Cancel your Haircut on Saturday 21 Nov 12:00? (you have 2 bookings — this cancels the Saturday 21 Nov 12:00 on' | pass |
| A8 F3: not a clear yes → kept (or a safe handoff) | 'no, keep it' | 200 'No problem — your booking stands.' | pass |
| A9 confirm again | 'cancel my saturday 12:00 booking' | 200 'Cancel your Haircut on Saturday 21 Nov 12:00? (you have 2 bookings — this cancels the Saturday 21 Nov 12:00 on' | pass |
| A10 yes → Saturday cancelled | 'yes' | 200 'Done — your Haircut on Saturday 21 Nov 12:00 is cancelled.' | pass |
| A11 the last one | 'cancel my friday booking' | 200 'Cancel your Haircut on Friday 20 Nov 11:00? Reply "yes" to cancel, or anything else to keep it.' | pass |
| A12 yes → Friday cancelled | 'yes' | 200 'Done — your Haircut on Friday 20 Nov 11:00 is cancelled.' | pass |
| B1 book | 'a haircut on friday at 13:00' | 200 'What name should I put the booking under? (Any name is fine for this demo.)' | pass |
| B2 name → confirm | 'Kim Moss' | 200 'Haircut, Friday 20 Nov 2026 13:00 for Kim Moss — shall I book it? (yes / no)' | pass |
| B2b F3: not a clear yes at the booking confirm → re-ask | 'yes that works, see you then' | 200 'To book it I need a clear yes. Haircut, Friday 20 Nov 2026 13:00 for Kim Moss — shall I book it? (yes / no)' | pass |
| B3 yes → booked | 'yes' | 200 "You're booked: Haircut, Friday 20 Nov 13:00. See you then!" | pass |
| B4 F1: closed slot → handoff (alert expected) | 'move it to sunday at 10:00' | 200 "We're closed then — a team member will help you pick a time that works." | pass |
| B4a F1 alert | — | last_alert_class = reschedule_closed (written only after the Telegram send succeeded) | pass |
| B5 owner release | — | → 200 ok=True | pass |
| B6 after release → the cancel confirm | 'cancel my booking' | 200 'Cancel your Haircut on Friday 20 Nov 13:00? Reply "yes" to cancel, or anything else to keep it.' | pass |
| B7 yes → cancelled | 'yes' | 200 'Done — your Haircut on Friday 20 Nov 13:00 is cancelled.' | pass |

**Read back afterwards (read-only, `salon_ro`):** sender A — 2 appointments, both `cancelled`; sender B — 1 appointment
`cancelled`, `last_alert_class = reschedule_closed` (written only after the Telegram send succeeded); one owner release
marker; no `booked` drill row left. Main executions in the window: 21, all `success` (19 turns + 2 dummy-token probes).

**What it shows live:** F2 ("which one?" with two bookings, no lock; the named one cancelled, the other kept), F3 (at a
cancel confirm a "no, keep it" keeps the booking; at a booking confirm a non-clear yes is asked again, then a clear yes
books), F1 on one branch (a closed-day reschedule hands off AND alerts the owner), and the signed owner release reopening
a FRESH lock (B5→B6).
**Not shown live:** the reschedule confirm (F3), the other F1 branches, F2's past-row exclusion, S5's >30-day bound and
the K5 counter reset on release (not read back), F4 (needs a 30-minute session gap) and F5 (needs a slot to pass) — offline-proven only
(`tests/unit/hardening-main.test.cjs`).

**Product findings from the review, recorded:** after "which one?", a reply that names only the day and time ("saturday
12:00") reaches the model with no context and can be read as a new booking (CX2-3's bound). At a cancel confirm, a model
that reads a refusal as uncertain hands off instead of answering "your booking stands" (safe; it did not happen here).

**Leftovers:** the two drill conversations and their message claims remain (no booking, no event); the seed tool's
`clean` removes them when next run (its own approval).
