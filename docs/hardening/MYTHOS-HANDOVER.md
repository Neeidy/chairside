# Handover — the post-deploy re-attack (Mythos)

**Target commit:** `fa46307` on `main` (the promotion commit: the committed exports `n8n/workflow.main.sanitized.json`
and `n8n/workflow.owner-actions.sanitized.json` ARE what runs; parity proven at 14:4x Vienna, 2026-11-18).
The range of the hardening work: `git log --oneline bb3f64b..fa46307`.

**Where to read first**
- `CHAIRSIDE-REDTEAM-REPORT.md` — the previous red-team report (the edge-rule hypotheses H1/H2 are withheld, K12).
- `docs/hardening/PLAN.md` → "AS BUILT" — what was actually built (the Phase A text below it is the approved plan).
- `docs/hardening/register.md` — every item, its class (FIXED / RULE AS LIMIT / v2 / STALE TEXT / RULED ALREADY), and
  the ruling; the rows `CX2-*` are the dispositions of the two Codex passes (`docs/codex/hardening/p1.md`, `p2.md`).
- `docs/ARCHITECTURE-DECISIONS.md` — the 2026-11-18 rows (K1–K14, the K3 location, S5, the K5 reversal, the deploy rulings).

**Fixed in this round (each with a red→green test and a mutant):**
F1 (every handoff alerts) · F2 (future-only targets, "which one?") · F3 (a deterministic clear-yes at the three
confirms) · F4 (per-session turn cap) · F5 (a yes acts only while the slot is in the future) · F6 (the model's time
normalised in Resolve Date) · F7 (throttle prune) · SPEND (meter incremented in SQL) · H3 (one-line, defanged alerts) ·
H6 (control characters stripped, empty-message exit) · RT4-b (channel-prefixed claim key) · RM-1979 · RM-1622 ·
RM-1971 · RM-2007 · EN-CD-3 · S5 (release of a lock older than 30 days) · the Codex p1/p2 findings.

**Ruled limits worth attacking** (register, class RULE AS LIMIT): H4 and RT5-2 (gate nodes), H5 (static-data throttle
race), CX2-1 (boundary whitespace before the consent test), CX2-5, CX2-9, CX2-10, X1, and the stated bounds of RM-1979 /
the cancel "which one?" (no marker binding).

**What nobody independent has covered yet** (both Codex passes reported themselves incomplete): the full handoff→alert
inventory, every reader of `salon.processed_messages`, paid-turn loops across sessions, the dashboard PII comparison.
The live B4 drill (in the docs commit after this note) covers F1/F2/F3 on real executions; F4/F5 are offline-proven only.

**Constraints for the run:** the same as the previous red-team round — public endpoints only, fake Turnstile tokens
unless a window is opened by the owner, nothing written to the production calendar, no real recipient messaged.
