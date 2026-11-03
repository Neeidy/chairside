# Phase 6 backlog — design gaps to close when the vitrin frontend is built

> **Role of this file:** a durable log of design/UX gaps surfaced during the Phase 1 mockup review
> (Cowork director review, 2026-07-03/04). The Phase 1 mockups are a **skin** — approved for direction,
> not a complete product. These items are **out of scope for Phase 1** and get built/decided in
> **Phase 6 (vitrin frontend)** — except the conversation spec, which is Phase 2 core work. Nothing here
> blocks Phase 2. Linked from [ROADMAP.md](ROADMAP.md).

## Disposition per item — CLOSE-OUT (2026-11-03)

> **Added 2026-11-03 (CLOSE-OUT plan, row 58):** this file listed each gap with no record of what became of it. Each
> item's fate below is traced to a committed record; where no record says, the row says **"not found in the records"**
> rather than guessing, and a code observation is labelled as code, not as a decision. The sections below are the
> original log, unchanged.

| § | Item | Disposition | Source |
|---|---|---|---|
| 1 | Dashboard zero-states (0 appointments, 0 leads, 0 handoffs) | **done** — designed (D5, D6, D8, D12), built in 6c; the L2 round added a third appointments state for "all cancelled" | ROADMAP → "TASARIM AŞAMASI" (Round C, `states.html`) and CP 6c's L2 fix round (K4); SCREEN-INVENTORY §4.a–4.c |
| 1 | Widget "no slots available" reply | **done** — W15, the engine's own text ("… that day is full — want another day?"), which the widget shows as sent | SCREEN-INVENTORY §2.4 (W15); UX-ARCHITECTURE §2.4 |
| 1 | Widget offline / timeout state | **done** — W60, `FRONTEND_TEXT.offline` / `.timeout`, closed 2026-09-13 | SCREEN-INVENTORY §2.10.1 and §2.10.1a (CP 6c-3) |
| 1 | Dashboard error state | **done** — a failed read renders an "unavailable" or "not configured" page, never an empty shop; one bad row cannot take the page down | ROADMAP → CP 6c-3 (the fresh-clone `misconfigured` run) and CP 6c's L2 round (K1/S4, `app/error.tsx`) |
| 1 | Loading states (widget typing indicator, dashboard skeleton) | **not found in the records** as built — only the design rule is recorded (SCREEN-INVENTORY §5, "Yükleniyor"; the dashboard skeleton D18 in `states.html`) | — |
| 2 | Reply flow on handoff alerts | **decided out of Phase 6** (UX-ARCHITECTURE §5, ruling K6: only the lock release is built; a manual message stays out — a send-to-any-number primitive is a security risk). SCREEN-INVENTORY §7 says "→ Phase 7"; **no later record takes it: its fate after that is not found in the records** | UX-ARCHITECTURE §5; SCREEN-INVENTORY §7 |
| 2 | Conversation / thread detail view | **not found in the records** (D10 is specified; the queue row shows the recent messages inline) | SCREEN-INVENTORY §4.c (specification only) |
| 2 | Date navigation (Today → other days) | **not found in the records** (D1–D3 are specified; no record says built or deferred) | SCREEN-INVENTORY §4.a (specification only) |
| 2 | Pagination | **done in part; the rest v2** — server-side filters and a "showing the first N" mark, capped at 100 rows; no "more" step. F13 (a capped window can say "Nothing booked ahead") is v2 | ROADMAP → CP 6c-1 ("Correction A"); ENGINEERING-NOTES → "Not yet — deferred to v2" (F13) |
| 2 | Search / filter | **not found in the records** | — |
| 3 | Widget panel: 12 px side margin vs full-bleed on mobile | **not found in the records** — still listed as open in SCREEN-INVENTORY §5 ("Mobil") | SCREEN-INVENTORY §5 |
| 3 | Dashboard top-bar pill vs the MOCK ribbon at 390 px | **not found in the records** — still listed as open in SCREEN-INVENTORY §5 ("Mobil") | SCREEN-INVENTORY §5 |
| 3 | Real on-device testing | **not found in the records** — only headless checks at 390 px are recorded | ROADMAP (6a-2's headless 390 px checks) |
| 4 | Landing scope: full salon site or bot showcase | **done — decided: a focused bot showcase**; map, call button, reviews and gallery cut ("§4 böylece kapanır"); 6a-2 then added the address, parking and a plain "Get directions" link, no map image | UX-ARCHITECTURE §9, K2; ROADMAP → 6a-2 revision round |
| 5 | The full conversation spec | **moved and done as Phase 2** (Phase 2 DONE 2026-08-11). A standalone spec written before the flow is **not found in the records**; the branching is documented from the built workflow | ROADMAP phase table (Phase 2); FLOW-DIAGRAM; UX-ARCHITECTURE §2 |
| 6 | Oxide `#B4472E` contrast for small text (WCAG AA) | **not found in the records** | — |
| 6 | Config wiring (config-consistent → config-wired) | **done in part** — the site is config-wired (6a-2 slice 1; a second config gave a different site from the same code); the snippet's `--ink` / `--oxide` are still hard-coded (carried "→ Faz 7" in ROADMAP's 6b list, unchecked); two dead config keys are v2 | ROADMAP → 6a-2 slice 1, and the 6b items list (F7); ENGINEERING-NOTES → "Not yet — deferred to v2" (K-2) |
| 7 | Dashboard authentication (owner-only) | **done** — behind Cloudflare Access, measured 2026-10-24 (a request without a session is redirected to the Access login); CRT #9 | README → "Security"; ARCHITECTURE-DECISIONS §6 (Final Feature Log); ROADMAP ship gate #18 (K-6) |
| 8 | Dark / light theme | **not found in the records** — locked as a Phase 6 item on 2026-07-04, with a planned `theme` config key; no later record says built, moved or deferred | ARCHITECTURE-DECISIONS §6 ("Frontend", "Technical decisions") |

## 1. Empty / loading / error states — *dashboard, widget*
The mockups only show the happy, populated state. Phase 6 must design: **dashboard** zero-states
(0 appointments today, 0 new leads, 0 pending handoffs — each needs an intentional empty view, not a blank
table), and a **widget** "no slots available" reply (what the chat shows when the requested day is full).
Loading and error/failure states (request failed, offline) are undesigned across both surfaces.

## 2. Dashboard interactions (no design yet) — *dashboard*
The dashboard is a static read view; these interactions are drawn as affordances but have no flow behind them:
**Reply flow** (the "Reply" button on handoff alerts → what happens), **conversation / thread detail view**
(the "View thread" target), **date navigation** (Today → tomorrow / past days), **pagination** (tables show
a handful of rows; real data needs paging), and **search / filter** across leads and appointments.

## 3. Mobile — *all three surfaces (verified 2026-07-04 at 390px)*
Headless render at 390px passed the hard checks: **zero page overflow, zero console errors** on all three;
landing is clean single-column; widget panel is near-full-width (~366px) bottom-sheet-style with the launcher
visible; dashboard KPI cards stack and both tables scroll horizontally inside their own containers.
Two **minor cosmetic** polish items (not broken, logged not fixed): (a) the widget panel keeps a 12px side
margin on mobile — it is not a true edge-to-edge bottom sheet; decide in Phase 6 whether to go full-bleed.
(b) On the dashboard the "Owner Dashboard" top-bar pill visually overlaps the diagonal MOCK ribbon at 390px —
reposition/hide one on small screens. Real on-device testing (not just headless) is still recommended since
a barbershop audience is mobile-heavy.

## 4. Landing scope — DECISION NEEDED — *landing*
Decide whether the landing is a **full salon website** or a **focused bot showcase**. The current mockup is the
showcase. If it becomes a full site, it needs: **location / map**, a **call button** (phone), **address**,
**reviews / rating**, and a **gallery**. If it stays a showcase, explicitly cut those. This decision shapes the
Phase 6 build scope.

## 5. Conversation spec — *Phase 2 core (not Phase 6)*
The chat mockups show one scripted happy path. The bot's **full branching dialogue tree** — every intent,
slot-fill branch, fallback, and handoff trigger — is the actual Phase 2 core work. The mockup is the skin;
this spec is the brain and must be written before/with the n8n flow.

## 6. Minor
- **Contrast:** re-check oxide `#B4472E` on cream `#F1EEE6` for small label text against WCAG AA (4.5:1) —
  it is used for eyebrow labels and accents; verify each small-text use passes, drop to ink where it does not.
- **Config wiring:** the "config-driven" footer claim is currently config-*consistent* (values mirror
  `client.config.example.json`) but not config-*wired*. Phase 6 must actually read brand name / colors /
  services / hours from config at build/runtime, so one config swap re-brands every surface for real.

## 7. Dashboard authentication — SECURITY-CRITICAL — *dashboard*
The dashboard exposes PII (names, phones, threads) and a destructive one-click Cancel →
**owner-only, authenticated access; never public without auth**. Locked in
[ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) Final Feature Log (2026-07-04);
Critical-Review Target #9 (Codex gate).

## 8. Dark/light theme — *all three surfaces*
Dark/light theme support across landing + widget + dashboard (locked 2026-07-04).
Interacts with §6 config wiring: theme becomes a `client.config` field.
