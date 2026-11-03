/**
 * Message times in the SHOP's zone (CLOSE-OUT S2, ruling DC-2). One fixed instant, formatted while the process runs
 * under two different local zones: the result must be the shop's wall clock both times. A control first shows the
 * local zone really changed (Node re-reads process.env.TZ when it is assigned), so a switch that did nothing cannot
 * pass as a result. The browser leg — both render sites, Chromium's zone overridden — is tests/browser/shop-time.drill.mjs.
 *
 * Run: node --test src/chat/shopTime.test.ts   (from web/shared)
 * SHOP_TIME_MODULE overrides the module under test (to run a mutant).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { shopTime, shopZoneNote } = await import(process.env.SHOP_TIME_MODULE ?? './chatClient.ts');

const INSTANT = new Date(Date.UTC(2026, 10, 3, 13, 7));   // 14:07 Vienna (CET), 08:07 New York, 22:07 Tokyo
const SHOP_CLOCK = /\b(14|02)[:.]07\b/;                      // digits only: the locale may write 12- or 24-hour

function underLocalZone<T>(zone: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try { return fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}

test('control: the process local zone really changes between the two runs', () => {
  assert.equal(underLocalZone('America/New_York', () => INSTANT.getHours()), 8);
  assert.equal(underLocalZone('Asia/Tokyo', () => INSTANT.getHours()), 22);
});

test("a fixed instant renders as the shop's wall clock, whatever the local zone", () => {
  const ny = underLocalZone('America/New_York', () => shopTime(INSTANT, 'Europe/Vienna'));
  const tokyo = underLocalZone('Asia/Tokyo', () => shopTime(INSTANT, 'Europe/Vienna'));
  assert.match(ny, SHOP_CLOCK);
  assert.match(tokyo, SHOP_CLOCK);
  assert.equal(ny, tokyo);
});

test('another shop zone gives that shop its own clock (the zone comes from the argument, not a constant)', () => {
  const berlin = underLocalZone('Asia/Tokyo', () => shopTime(new Date(Date.UTC(2026, 6, 1, 13, 7)), 'Europe/Berlin'));
  assert.match(berlin, /\b(15|03)[:.]07\b/);                // CEST in July: UTC+2
  const ny = underLocalZone('Europe/Vienna', () => shopTime(INSTANT, 'America/New_York'));
  assert.match(ny, /\b0?8[:.]07\b/);
});

test('the zone is named from the config value, readably', () => {
  assert.equal(shopZoneNote('Europe/Vienna'), 'Times in shop time (Europe/Vienna)');
  assert.equal(shopZoneNote('America/New_York'), 'Times in shop time (America/New York)');
});
