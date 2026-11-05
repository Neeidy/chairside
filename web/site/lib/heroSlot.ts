/**
 * The hero's sample slot — derived from the SHOP CLOCK at request time, never written down as a date.
 *
 * WHY: the sample used to be the literal 'Friday 4 Sep 2026 15:30'. Once that day passed, the public page showed a
 * booking in the past — and any new fixed date only re-creates the defect on a later day. So the slot is computed
 * from `now` in the shop's timezone, and app/page.tsx is `force-dynamic` so `now` is the visitor's request, not the
 * deploy (a prerendered page would freeze this at build time — measured: the old page was a 2-day-old CDN HIT).
 *
 * The rule: the FIRST FRIDAY STRICTLY AFTER TODAY (shop timezone), at 15:30. It is never in the past, the weekday is
 * the date's own weekday by construction, and "Friday at 15:30" — the customer's line — always matches it.
 *
 * The strings are the ENGINE's formats, character for character (Luxon, en-US):
 *   whenConfirm 'cccc d LLL yyyy HH:mm' (Compute Availability's confirm ask, DATE-PHRASING R2d: the year is shown)
 *   when        'cccc d LLL HH:mm'      (Build Cancel-Confirm State / Build Cancelled State)
 *   date        'cccc d LLL'            (bookingConfirmed's {date}, Build Booked State)
 * The site has no Luxon, so they are assembled from fixed English names; scripts/check-hero-engine-text.cjs loads this
 * file and compares every output with Luxon's own formatting over 400 consecutive days plus the DST and year-end
 * edges. No imports here on purpose: the guard loads this file with plain Node (type stripping), not through Next.
 */
export interface HeroSlot { whenConfirm: string; when: string; date: string; time: string }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FRIDAY = 5;
const DAY_MS = 86_400_000;
export const HERO_TIME = '15:30';

export function heroSlot(now: Date, tz: string): HeroSlot {
  // Today's calendar date in the SHOP's timezone (not the server's, which is UTC on Vercel).
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Pure calendar arithmetic from here on: a UTC midnight carries no DST, and 15:30 is a wall-clock time.
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  const weekday = new Date(today).getUTCDay();
  const ahead = ((FRIDAY - weekday + 6) % 7) + 1;      // 1..7 — a Friday's next Friday is 7 days on, never today
  const d = new Date(today + ahead * DAY_MS);
  const date = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return { whenConfirm: `${date} ${d.getUTCFullYear()} ${HERO_TIME}`, when: `${date} ${HERO_TIME}`, date, time: HERO_TIME };
}
