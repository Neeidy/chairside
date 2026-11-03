/**
 * The sender label on a handoff-queue row, and the "re-masked" counter beside it.
 *
 * WHAT IS SHOWN is unchanged: every row's stored `sender_masked` goes through this board's `maskSenderKey`, which is
 * idempotent, so a full key that reached the column (security-auditor M1, 2026-09-12) never reaches the screen.
 *
 * WHAT IS COUNTED changed (ruling, Yigitcan 2026-11-03, replacing DC-3 for this row — a declared deviation from
 * DC-3's "single source" wording): a row counts only when its stored value is MORE than the column's own formula
 * (db/schema/001_init.sql) could produce. The counter used to compare the stored value with its `maskSenderKey`
 * re-masking; the two formulas keep different lengths of a widget key (16 characters against 6 of the id), so every
 * widget row was counted (PHASE-7-PLAN §4b, finding (i)).
 *
 * `isColumnMask` accepts every string the column's CASE can return and nothing it cannot. It is a hand-written copy
 * of that CASE's SHAPE (the dashboard cannot run SQL), used for counting only; its drift guard is in
 * lib/handoffSender.test.ts, which pins the CASE against the schema file's text.
 *
 * Its bound, stated: the shape is all that can be checked without the raw key, which is never fetched (store.ts).
 * A whole SHORT key with an ellipsis appended (`widget:w-ab…`) is also the column's output for a longer key
 * (`widget:w-ab` plus four characters), so it is not counted. A whole key longer than 16 characters is always
 * counted, with or without an ellipsis.
 */
import type { HandoffRow } from './types.ts';
import { maskSenderKey, assertMasked } from './mask.ts';

const ELLIPSIS = '…';
const WA = 'whatsapp:';

/**
 * True when `stored` is a value the `sender_masked` CASE can produce. Characters are code points, as Postgres
 * counts them in `left`, `right` and `length`.
 *   whatsapp:… key of 15+ characters → left 12 · `…` · right 2      = 15 characters, the 13th is `…`
 *   any other key                    → left k · `…`, k = 0…16        = at most 17, ending in `…`; a key that STARTS
 *                                      with `whatsapp:` reaches this branch only when it is under 15 characters,
 *                                      so then k ≤ 10 (at most 11 characters)
 */
export function isColumnMask(stored: string): boolean {
  const cps = [...stored];
  const n = cps.length;
  if (stored.startsWith(WA)) {
    if (n === 15 && cps[12] === ELLIPSIS) return true;
    return n <= 11 && cps[n - 1] === ELLIPSIS;
  }
  return n >= 1 && n <= 17 && cps[n - 1] === ELLIPSIS;
}

export interface SenderLabel {
  /** What reaches the screen (and the release button's label): always this board's own mask. */
  who: string;
  /** The column held more than its own formula could produce. */
  remasked: boolean;
  /** Even this board's own mask failed the render-time check; the row is listed without its sender. */
  withheld: boolean;
}

export function senderLabel(raw: string | undefined): SenderLabel {
  const stored = (raw ?? '').trim();
  const shown = stored ? maskSenderKey(stored) : '—';
  // K1 (HandoffQueue): a throw must not take the page down. A value that fails the check is never rendered.
  try {
    return { who: assertMasked(shown, 'sender'), remasked: stored !== '' && !isColumnMask(raw!), withheld: false };
  } catch {
    return { who: '— (masked value rejected)', remasked: false, withheld: true };
  }
}

/** Every row's label, and the two counts the queue shows under its list. */
export function prepareSenders<R extends Pick<HandoffRow, 'sender_masked'>>(rows: R[]) {
  let remasked = 0;
  let withheld = 0;
  const prepared = rows.map((row) => {
    const label = senderLabel(row.sender_masked);
    if (label.remasked) remasked++;
    if (label.withheld) withheld++;
    return { row, who: label.who };
  });
  return { prepared, remasked, withheld };
}
