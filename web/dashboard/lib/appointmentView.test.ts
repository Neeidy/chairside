/**
 * The "Today" block's empty state (PHASE-7-PLAN §4b, finding (ii)). Fixture rows only: synthetic ids, no names.
 * The clock is Sun 1 Nov 2026, 11:00 in Vienna (UTC+1 since 25 Oct), the shop's timezone in the example config.
 *
 * Run: node --test lib/appointmentView.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentSections, todayEmptyState } from './appointmentView.ts';
import type { Appointment } from './types.ts';

const TZ = 'Europe/Vienna';
const NOW = Date.parse('2026-11-01T10:00:00.000Z');
const row = (id: string, start_utc: string, status: Appointment['status']): Appointment =>
  ({ id, start_utc, status, service: 'haircut', channel: 'widget' });
const state = (rows: Appointment[]) => todayEmptyState(appointmentSections(rows, TZ, NOW));

test('finding (ii): a cancelled appointment of the NEXT day is not counted under "Today"', () => {
  // The finding's own case: the window (yesterday 00:00 UTC onwards) holds one row, Mon 2 Nov 14:00 Vienna,
  // cancelled. Before the fix the block under "Today" read "1 appointment in this window, none of them still active".
  const rows = [row('recA', '2026-11-02T13:00:00.000Z', 'cancelled')];
  assert.equal(appointmentSections(rows, TZ, NOW).todays.length, 0);
  assert.deepEqual(state(rows), { kind: 'none-today' });
});

test('a cancelled appointment of YESTERDAY, also inside the window, is not counted under "Today" either', () => {
  assert.deepEqual(state([row('recY', '2026-10-31T13:00:00.000Z', 'cancelled'),
    row('recT', '2026-11-02T13:00:00.000Z', 'cancelled')]), { kind: 'none-today' });
});

test('appointments ON today\'s date, none still booked, are counted — only those', () => {
  assert.deepEqual(state([row('recB', '2026-11-01T13:00:00.000Z', 'cancelled')]), { kind: 'none-active', count: 1 });
  assert.deepEqual(state([
    row('recD1', '2026-11-01T08:00:00.000Z', 'cancelled'),
    row('recD2', '2026-11-01T15:00:00.000Z', undefined),      // a blank status is not booked, and not "cancelled"
    row('recD3', '2026-11-02T13:00:00.000Z', 'cancelled'),    // the next day: not counted
  ]), { kind: 'none-active', count: 2 });
});

test('"today" is the shop\'s calendar day, not the UTC one: 00:30 Vienna counts, 00:30 the next night does not', () => {
  assert.deepEqual(state([row('recE', '2026-10-31T23:30:00.000Z', 'cancelled')]), { kind: 'none-active', count: 1 });
  assert.deepEqual(state([row('recF', '2026-11-01T23:30:00.000Z', 'cancelled')]), { kind: 'none-today' });
});

test('D5 and D6 are unchanged: something booked in the window → "no bookings today"; an empty window → "none yet"', () => {
  assert.deepEqual(state([row('recG', '2026-11-03T09:00:00.000Z', 'booked')]), { kind: 'none-today' });
  assert.deepEqual(state([]), { kind: 'none-yet' });
});
