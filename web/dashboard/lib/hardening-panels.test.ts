/**
 * HARDENING RM-1145 (e)(h)(i) — the three dashboard residues of CP 6c-1.
 *   (e) types.ts is hand-mirrored: every field of each row shape must be a column of its table in the COMMITTED
 *       schema (db/schema/*.sql) — the drift guard contract-integrity.md asks for. A renamed or invented field fails.
 *   (h) the shop config is checked inside page.tsx's try (a missing CLIENT_CONFIG_JSON reaches `misconfigured`).
 *   (i) no panel calls assertMasked bare; maskedOrWithheld blanks one value instead of the board.
 * Run: node --test lib/hardening-panels.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskedOrWithheld } from './mask.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const SCHEMA = join(APP, '..', '..', 'db', 'schema');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');

function columns(): Record<string, Set<string>> {
  const sql = readdirSync(SCHEMA).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(SCHEMA, f), 'utf8')).join('\n');
  const out: Record<string, Set<string>> = {};
  for (const m of sql.matchAll(/CREATE TABLE salon\.(\w+) \(([\s\S]*?)\n\);/g)) {
    const cols = new Set<string>();
    for (const line of m[2].split('\n')) { const c = /^\s+([a-z_][a-z0-9_]*)\s+(?!KEY\b)[a-z]/.exec(line); if (c && c[1] !== 'constraint') cols.add(c[1]); }
    out[m[1]] = cols;
  }
  for (const m of sql.matchAll(/ALTER TABLE salon\.(\w+)\s+ADD COLUMN(?: IF NOT EXISTS)? (\w+)/g)) (out[m[1]] ||= new Set()).add(m[2]);
  return out;
}
function fields(src: string, iface: string): string[] {
  const m = new RegExp(`export interface ${iface} extends Row \\{([\\s\\S]*?)\\n\\}`).exec(src);
  assert.ok(m, `interface ${iface} not found`);
  return [...m[1].matchAll(/^\s+([a-z_][a-z0-9_]*)\?:/gm)].map((x) => x[1]);
}

test('(e) every field types.ts reads is a column of its table in the committed schema', () => {
  const cols = columns(), src = read('lib/types.ts');
  assert.ok(cols.appointments?.has('start_utc') && cols.conversations?.has('recent_messages'), 'instrument: the schema parse finds known columns');
  for (const [iface, table] of [['Appointment', 'appointments'], ['Lead', 'leads'], ['HandoffRow', 'conversations'], ['SpendRow', 'bot_metrics']]) {
    const fs = fields(src, iface);
    assert.ok(fs.length > 0, iface);
    const missing = fs.filter((f) => !cols[table]?.has(f));
    assert.deepEqual(missing, [], `${iface} → salon.${table}: not a column`);
  }
});
test('(e) negative control: an invented field is caught', () => {
  const src = read('lib/types.ts').replace('export interface SpendRow extends Row {\n', 'export interface SpendRow extends Row {\n  cost_eur?: number;\n');
  assert.ok(fields(src, 'SpendRow').some((f) => !columns().bot_metrics.has(f)));
});
test('(h) page.tsx checks the shop config inside its try, before the reads, as a ConfigError', () => {
  const src = read('app/page.tsx');
  const t = src.indexOf('  try {'), c = src.indexOf('shopConfig();'), r = src.indexOf('await Promise.all');
  assert.ok(t > 0 && c > t && r > c, 'shopConfig() between the try and the reads');
  assert.match(src.slice(c, r), /throw new ConfigError\(/);
});
test('(i) the leads and appointments panels never call assertMasked bare', () => {
  for (const f of ['components/LeadsPanel.tsx', 'components/AppointmentsPanel.tsx']) {
    assert.equal(/\bassertMasked\(/.test(read(f)), false, f);
    assert.match(read(f), /maskedOrWithheld\(/, f);
  }
});
test('(i) maskedOrWithheld passes a masked value and withholds one that fails the check', () => {
  assert.equal(maskedOrWithheld('Ki… M…', 'lead name'), 'Ki… M…');
  assert.match(maskedOrWithheld('call 06641234567', 'lead name'), /^— \(lead name withheld/);
  assert.match(maskedOrWithheld('kim@example.com', 'lead name'), /withheld/);
});
