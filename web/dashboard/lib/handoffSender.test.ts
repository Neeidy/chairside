/**
 * The handoff queue's sender: what is SHOWN (this board's `maskSenderKey`, unchanged) and what is COUNTED as
 * "re-masked" (only a stored value the `sender_masked` column could not have produced — ruling 2026-11-03).
 * Every key here is FAKE: synthetic widget ids and the obviously fake WhatsApp number the other mask tests use.
 *
 * Run: node --test lib/handoffSender.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isColumnMask, senderLabel, prepareSenders } from './handoffSender.ts';
import { maskSenderKey } from './mask.ts';

const SCHEMA_DIR = new URL('../../../db/schema/', import.meta.url);

/**
 * DERIVED COPY of the `sender_masked` CASE in db/schema/001_init.sql, written in TypeScript because the dashboard's
 * tests run no database. It makes the fixtures: each widget-lane row below holds what the column would store for
 * its key. The drift guard is the first test: the CASE's text is pinned, so a change to the formula turns this
 * suite red until this copy and `isColumnMask` are re-derived from it. Characters are code points, as in Postgres.
 */
function columnMask(key: string): string {
  const c = [...key];
  if (c.slice(0, 9).join('') === 'whatsapp:' && c.length >= 15) return `${c.slice(0, 12).join('')}…${c.slice(-2).join('')}`;
  return `${c.slice(0, Math.max(Math.min(16, c.length - 4), 0)).join('')}…`;
}

const PINNED_CASE = "CASE WHEN left(sender_key, 9) = 'whatsapp:' AND length(sender_key) >= 15 "
  + "THEN left(sender_key, 12) || '…' || right(sender_key, 2) "
  + "ELSE left(sender_key, GREATEST(LEAST(16, length(sender_key) - 4), 0)) || '…' END";

// The widget lane as the engine writes it: `widget:` + the client's `w-` session id (chatClient.ts: a UUID, or a
// base-36 fallback), plus the two WhatsApp shapes. One id starts with seven digits: the column shows seven
// characters of it, this board shows four, so the row is neither counted nor withheld.
const LANE_KEYS = [
  'widget:w-3f2a1b8c-9d4e-4f7a-b1c2-d3e4f5a6b7c8',
  'widget:w-4f3a91c27e5b8d016a',
  'widget:w-1234567f-9d4e-4f7a-b1c2-d3e4f5a6b7c8',
  'widget:w-k3j9x0qzlm2abc4',
  'whatsapp:+436601234567',
  'whatsapp:436601234567',
];

test('drift guard: the schema\'s sender_masked CASE is the one this suite and isColumnMask were derived from', () => {
  const sql = readFileSync(new URL('001_init.sql', SCHEMA_DIR), 'utf8');
  const m = sql.match(/sender_masked\s+text\s+GENERATED ALWAYS AS \(([\s\S]*?)\)\s*STORED/);
  assert.ok(m, '001_init.sql no longer defines sender_masked as a generated column');
  assert.equal(m[1].replace(/\s+/g, ' ').trim(), PINNED_CASE);
  // A later schema file that redefined the column would make the pin above check a dead definition.
  const others = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql') && f !== '001_init.sql'
    && readFileSync(new URL(f, SCHEMA_DIR), 'utf8').includes('sender_masked'));
  assert.deepEqual(others, []);
});

test('negative control: the OLD two-formula comparison counts every widget row of this fixture as re-masked', () => {
  // Finding (i), reproduced on the fixture: the column keeps 16 characters, maskSenderKey 6 of the id. If this ever
  // stops holding, the zero asserted in the next test no longer proves anything about the old defect.
  for (const k of LANE_KEYS.filter((k) => k.startsWith('widget:'))) {
    assert.notEqual(maskSenderKey(columnMask(k)), columnMask(k), k);
  }
});

test('the widget-lane fixture: 0 re-masked, 0 withheld, and the sender shown is today\'s maskSenderKey output', () => {
  const rows = LANE_KEYS.map((k, i) => ({ id: `rec${i}`, sender_masked: columnMask(k) }));
  const { prepared, remasked, withheld } = prepareSenders(rows);
  assert.equal(remasked, 0);
  assert.equal(withheld, 0);
  for (const { row, who } of prepared) assert.equal(who, maskSenderKey(row.sender_masked), row.sender_masked);
  // The display is NOT the column: on the widget lane the two differ, and the board's shorter form is what shows.
  assert.equal(prepared[0].who, 'widget:w-3f2a…');
  assert.notEqual(prepared[0].who, prepared[0].row.sender_masked);
});

test('a FULL sender stored is counted 1 and is masked on screen as today', () => {
  const full = 'widget:w-3f2a1b8c-9d4e-4f7a-b1c2-d3e4f5a6b7c8';
  const rows = [
    { id: 'recOk', sender_masked: columnMask(full) },
    { id: 'recFull', sender_masked: full },
  ];
  const { prepared, remasked, withheld } = prepareSenders(rows);
  assert.equal(remasked, 1);
  assert.equal(withheld, 0);
  const shown = prepared[1].who;
  assert.equal(shown, maskSenderKey(full));
  assert.ok(!shown.includes('1b8c') && !shown.includes('9d4e'), shown);

  // The other shapes that are not the column's output, each on its own: the Airtable formula's original defect
  // (the whole key with an ellipsis appended), a full WhatsApp key, and a WhatsApp key cut generically at 16.
  for (const v of [`${full}…`, 'whatsapp:+436601234567', 'whatsapp:+436601…']) {
    const l = senderLabel(v);
    assert.equal(l.remasked, true, v);
    assert.equal(l.who, maskSenderKey(v), v);
  }
});

test('an EMPTY column shows — and is not counted', () => {
  for (const v of [undefined, '', '   ']) {
    assert.deepEqual(senderLabel(v), { who: '—', remasked: false, withheld: false });
  }
});

test('isColumnMask accepts every output of the column and nothing that is not one (seeded sweep)', () => {
  let seed = 7;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pick = (alphabet: string, len: number) => Array.from({ length: len }, () => [...alphabet][rnd([...alphabet].length)]).join('');
  const HEX = '0123456789abcdef';
  const ANY = 'abcxyz0123456789:+-_ …äß€';
  const keys: string[] = [];
  for (let i = 0; i < 4000; i++) {
    switch (i % 5) {
      case 0: keys.push(`widget:w-${pick(HEX, 8)}-${pick(HEX, 4)}-4${pick(HEX, 3)}-${pick(HEX, 4)}-${pick(HEX, 12)}`); break;
      case 1: keys.push(`widget:w-${pick('0123456789abcdefghijklmnopqrstuvwxyz', 8 + rnd(12))}`); break;
      case 2: keys.push(`whatsapp:${rnd(2) ? '+' : ''}${pick('0123456789', rnd(16))}`); break;
      case 3: keys.push(pick(ANY, rnd(24))); break;
      default: keys.push(`whatsapp:${pick(ANY, rnd(8))}`);
    }
  }
  // Every output is accepted, so the column's own values are never counted.
  for (const k of keys) assert.ok(isColumnMask(columnMask(k)), `${k} → ${columnMask(k)}`);

  // Nothing else is: every accepted candidate has a key the column maps to it (built, not searched for).
  const preimage = (s: string): string => {
    const c = [...s];
    if (s.startsWith('whatsapp:') && c.length === 15 && c[12] === '…') return `${c.slice(0, 12).join('')}pad${c.slice(-2).join('')}`;
    return `${c.slice(0, -1).join('')}abcd`;
  };
  let accepted = 0;
  for (let i = 0; i < 4000; i++) {
    const s = i % 2 ? pick(ANY, rnd(20)) : `whatsapp:${pick(ANY, rnd(9))}`;
    if (!isColumnMask(s)) continue;
    accepted++;
    assert.equal(columnMask(preimage(s)), s, s);
  }
  assert.ok(accepted > 100, `the soundness half saw only ${accepted} accepted candidates`);
});

test('isColumnMask at the length boundaries: 16 kept characters and no more; 10 on a short whatsapp key', () => {
  // The seeded sweep rarely draws a candidate exactly one character past a boundary (a mutant widening the generic
  // branch to 18 characters survived it), so each boundary is stated here on its own.
  for (let k = 0; k <= 20; k++) assert.equal(isColumnMask(`${'x'.repeat(k)}…`), k <= 16, `generic, ${k} kept`);
  for (let j = 0; j <= 8; j++) assert.equal(isColumnMask(`whatsapp:${'7'.repeat(j)}…`), j <= 1, `short whatsapp, ${j}`);
  assert.equal(isColumnMask('whatsapp:+43…67'), true);
  assert.equal(isColumnMask('whatsapp:+43…6'), false);
  assert.equal(isColumnMask('whatsapp:+43…678'), false);
  assert.equal(isColumnMask('whatsapp:+436…7'), false);
});
