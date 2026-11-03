/**
 * Which appointments the owner sees, and how their time is written: shared by `AppointmentsPanel` and the CSV
 * export (`lib/exportCsv.ts`), so the file the owner downloads holds the rows the panel shows, not a second
 * opinion about them. Moved out of the panel unchanged in Phase 7 F2; the panel's comments on WHY each rule
 * exists stay where the rules are drawn.
 *
 * Pure: no store, no config. The timezone and the clock are arguments, which is what makes it testable.
 */
import type { Appointment } from './types.ts';

export interface AppointmentSections {
  /** Rows with a parseable start time. */
  dated: Appointment[];
  /** Rows without one: counted, never placed on a day. */
  undated: number;
  /** Booked, on today's date in the shop's timezone (earlier today included). */
  todays: Appointment[];
  /** Booked, after now, and not today. */
  upcoming: Appointment[];
  /** On today's date in the shop's timezone and NOT booked (cancelled, or a blank status). */
  inactiveToday: number;
}

export function appointmentSections(rows: Appointment[], tz: string, nowMs: number): AppointmentSections {
  const dated = rows.filter((r) => Number.isFinite(Date.parse(r.start_utc ?? '')));
  const today = new Date(nowMs).toLocaleDateString('en-CA', { timeZone: tz });
  const isToday = (r: Appointment) =>
    new Date(Date.parse(r.start_utc!)).toLocaleDateString('en-CA', { timeZone: tz }) === today;
  return {
    dated,
    undated: rows.length - dated.length,
    todays: dated.filter((r) => isToday(r) && r.status === 'booked'),
    upcoming: dated.filter((r) => Date.parse(r.start_utc!) > nowMs && !isToday(r) && r.status === 'booked'),
    inactiveToday: dated.filter((r) => isToday(r) && r.status !== 'booked').length,
  };
}

/**
 * What the "Today" block says when nothing booked is on today's date. D5 and D6 are different empty states and
 * are not collapsed into one: "no bookings today" is an ordinary Tuesday, "no bookings yet" means the shop has not
 * started, and showing the second to a new owner tells them their system is broken.
 *   - K4: anything booked in the window is not "no bookings yet". This was called `anyBookedEver` and computed from
 *     a 30-day, 100-row window, so a shop whose table held 121 appointments of which 118 were cancelled (measured
 *     2026-09-12) was told "no bookings yet" — wrong, and wrong in the reassuring direction.
 *   - `none-active`: rows ON TODAY'S DATE, none of them still booked. It does not say "every one was cancelled":
 *     the code tests `status !== 'booked'`, and a blank status is not a cancellation (`code-reviewer` #4).
 *     ⚠ Corrected (PHASE-7-PLAN §4b, finding (ii), reproduced 2026-11-03): this used to count every row in the
 *     WINDOW, which starts yesterday 00:00 UTC and has no end, so after a cancel the block under "Today" read
 *     "1 appointment in this window, none of them still active" for an appointment on the NEXT day.
 *   - D6 only when the window holds no row at all.
 */
export type TodayEmpty = { kind: 'none-today' } | { kind: 'none-active'; count: number } | { kind: 'none-yet' };

export function todayEmptyState(s: AppointmentSections): TodayEmpty {
  if (s.dated.some((r) => r.status === 'booked')) return { kind: 'none-today' };
  if (s.inactiveToday > 0) return { kind: 'none-active', count: s.inactiveToday };
  if (s.dated.length > 0) return { kind: 'none-today' };
  return { kind: 'none-yet' };
}

/** The panel's wording of a start time, in the shop's timezone. */
export function when(iso: string | undefined, tz: string): { day: string; time: string } | null {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return {
    day: d.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
  };
}
