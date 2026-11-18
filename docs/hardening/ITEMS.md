# HARDENING — item table (every row that asks for something)
Source: register.md (215 rows) + critic + this session's measurements.
- 75 STALE TEXT rows and 74 RULED ALREADY rows are counted only; they live in register.md and are committed in B5.

## A. Findings (12)
| id | reproduced? (repro / verify) | decision | WU | red → green test | mutant (must be red) | CRT |
|---|---|---|---|---|---|---|
| F1 | yes / yes, MEDIUM | FIX | 3 | `handoff-alert-coverage.test.cjs`: counts every stage='handoff' writer across 5 workflows; each one gets an alert class | delete one of the added edges; strip `handoff_reason` | 6, 5, 8 |
| F2 | yes / yes, MEDIUM | FIX (K2) | 2 | `tests/db/booking-lookup.test.sh` (SQL verbatim, past+future) + replay A/B/C | remove the bound from one query / from one JS twin | 8, 6 |
| F3 | yes / yes, MEDIUM | FIX (K1) | 1 | 3 stages × text × label matrix + 205-cell corpus (false yes = 0) | gate off per stage; drop "go ahead"; use toLowerCase | 2, 5, 8 |
| F4 | yes / yes, MEDIUM | FIX (K5) | 1, 6 | 12+1 turns: same session trips, new session processed; release processed | reset that keeps confirm_turn; remove the reset | 15, 11 |
| F5 | yes / yes, LOW–MEDIUM | FIX | 1 | moving clock: late yes, booking re-asks, reschedule old booking kept | remove the bound from one of the two Fresh? nodes; `<=`→`<` | 8, 1b, 12 |
| F6 | yes / yes, LOW | FIX (K3) | 4 | ajv + replay: bad time → extraction_transient; prompt carries "time=?" | remove the pattern; derive() carries maxLength | 12, 6, 2 |
| F7 | partial (Main yes, Purge/Reminders refuted) / yes, LOW | FIX | 3 | 500 senders × fake clock: key count ≤ window, [1,0,1] kept | prune deleted; prune with a wrong window | 4, 6 |
| SPEND | yes / yes, MEDIUM | FIX | 5 | `tests/db/spend-meter.test.sh`: interleave + late writer, meter == sum | old SQL (S1–S4 red); new SQL + old $2 (double count) | 15 |
| H3 | partial (string yes, rendering = boundary) / yes, LOW | FIX | 3 | line count == LF count; URL defang; no eviction | `oneLine` without `\s+`; slots.time not covered | 6, 16 |
| H4 | yes (runtime) / yes, LOW | **RULE AS LIMIT (K7)** | — | — (gate node; cost: a new tooling class) | — | 3 |
| H5 | yes (runtime) / yes, LOW | **RULE AS LIMIT** (extra alerts only; the fix needs DDL) | — | — | — | — |
| H5b | yes (runtime) / yes, LATENT | **v2 (K9)**, trigger: before reminders go live | — | — | — | — |
| H6 | partial (PG route traced) / yes, LOW | FIX | 4 | replay: no bind value carries NUL; NUL-only → no LLM | remove the strip; narrow the strip to `\u0000` only | 1a, 1b |

## B. Engine / product FIX NOW
| id | title | WU | test | mutant | CRT |
|---|---|---|---|---|---|
| RM-1979 | two-turn reschedule → second booking | 2 (S1) | replay: one row, moved | remove the target binding | 1b, 8 |
| RM-1622 | gcal_event_id blanked by a FAQ turn | 4 | replay: mirror failure + FAQ → pointer kept | drop the carry | 6, 8 |
| RM-1921 | dateExpr has no maxLength | 4 | validate-intent: too-long dateExpr rejected | remove maxLength | 12 |
| RM-1971 | Resolve Date error → state_unavailable | 3 | replay error item → `date_resolver_failed` | reconnect to the old edge | 6 |
| RM-2007 | askIntent is stage-agnostic | 1 | replay: an uncertain turn mid-collecting asks the right question | old template | 5 |
| RT4-b | message_id namespace held by entropy only | 4 | claim-race: the owner marker cannot collide with a Main key | old key form | 1a |
| EN-722-28 | Airtable-era comments in Main | 3/4 | grep test: 0 Airtable comments in Main Code | re-add one comment | — |
| EN-CD-3 | infra alert sender/channel = unknown | 3 (K6) | replay: infra alert shows sender/channel | remove the fallback | 6 |
| EN-CD-7 | alert ahead of the reply / no Telegram timeout | 3 (K6) | canvas-order test on the new edges | flip the order | 6 |
| RM-1145 | 6c-1 sub-items (e)(f)(h)(i) | 7 | split in B1, a test per sub-item | — | 10 |
| RM-2101 | snippet double-insert guard edge cases | 8 | headless drill | remove the marker | 13 |
| RM-2143 | snippet colours hardcoded | 8 | parity test against config.branding | hardcoded value | 13 |
| B1 (critic) | a lock older than 30 days cannot be released | 6 (S5) | release of a 31-day-old lock | old bound | 11 |

## C. Tooling / ops FIX NOW
| id | title | WU | test | mutant |
|---|---|---|---|---|
| RM-1413 | 8 selftest cases do not discriminate | 7 | sentinel labelling + count | — |
| RM-185 | Reminders DST evidence only in the scratchpad | 7 | commit reminder-dst test | wrong offset |
| RM-1899 / RM-2299 | secret-scan leak shapes (split) + K14 | 7 | a red-proof fixture per rule | delete the rule |
| RM-1907 | byte-compare of the two Event ID Valid? nodes | 7 | guard + typeValidation mutant | loose |
| RM-1938 | parity does not see retryOnFail etc. | 5/7 | a mutant per flag | — |
| RM-2123 | config.generated freshness | 7 | hash mismatch → refused | stale hash |
| X2 (new) | `tests/db/*.sh` cleanup without `-v` | 7 | 0 dangling volumes after a run | without `-v` |
| X1 | salon_app DELETE on appointments | K8 (DDL 005) | after 005, salon_app DELETE is refused (scratch PG) | — |
| A1-b / EDGE-RL | Edge-rule item — withheld until resolved (K12) | 9 | — | — |
| RT4-c | Edge-rule item — withheld until resolved (K12) | 9 | — | — |
| A1 (critic) | n8n execution retention not measured | 9 | oldest execution date, read-only | — |

## D. New RULE AS LIMIT (reason · cost of fixing)
- **H5:** extra alerts only. The fix is a new table + a node + tooling.
- **H4, RT5-2:** gate nodes (K7); a tooling class of ~6 files.
- **A3 (Postgres statement_timeout, Telegram timeout):** no value measured / the node has no field.
- **A8 (ROADMAP:1527) wrong week:** the confirm step catches it, and with WU-1 that check runs in code.
- **CO-L3e-2:** two September JSONs; awaiting Yigitcan's decision (keep / delete).
- **RM-1048, RM-1613, RM-1886, RM-1925, RM-1934, RM-1976, RM-1983, RM-2097, RM-2109, RM-719, RM-734, RM-767, RT4-a,
  SPEND-b:** reason and cost are in register.md section E. Each needs measurement or a live window, or the cost is
  disproportionate to a LOW.

## E. v2 (needs a product decision · trigger)
- **H5b** · **EN-CD-10** (a change request on a confirm turn) · **EN-CD-26** (phone/e-mail field) · **EN-CD-31** (stored
  reply for idempotent replay) · **EN-CD-37** (Instagram) · **EN-CD-45** (Loom) · **EN-CD-8** (rebooking a cancelled
  slot — no double booking, hands off) · **EN-v2-8** · **RM-1392** · **RM-1397** · **RM-1991** (lock TTL) · **RM-2013** ·
  **RM-2255** · **RM-2263** · **RT5-6**
  - Triggers are in register.md section F.
- **EN-v2-3:** not reopened (DC-1).

## F. Critic additions — classified
| id | class |
|---|---|
| A1 | FIX (measure) |
| A2 | K11 |
| A3 | LIMIT |
| A4 | RULED ALREADY ("listele, ben karar veririm") |
| A5 | MASTER-BRIEF row 8 / 13 RULED ALREADY; :305 = EN-CD-37 v2; ROADMAP:2544 marker STALE |
| A6 | 725, 953, 1148, 2500 STALE (my classification from the line text); 304, 464, 1462 verified in B1 |
| A7 | X1 |
| A8 | LIMIT |
| A9 (i) | B1 |
| A9 (ii) | H5b |
| A9 (iii) | folded into F6 |
| A9 (iv) | WU-4 (typeof guard) |
