# CLOSE-OUT PLAN — every open item closed, or closed by a written decision

> **Status: APPROVED by Yigitcan, 2026-11-03** (plan-gate, written in the conversation), with DC-1…DC-13 exactly as
> recommended in §13, plus **G1** (the start-gate script refuses to run in the Vienna minutes :55–:05) and, asked and
> answered during R1, **DC-5 ruled: Purge P1/P2 are IN this phase** (§13, DC-5's row). **R1–R4 done; the C rows are the owner's** (the last sections). *(Said "R1 in progress" until
> 2026-11-04; corrected in place.)* Recorded in
> `ARCHITECTURE-DECISIONS.md` (2026-11-03 rows). *(This line said "PLAN ONLY — awaiting Yigitcan's written
> 'approved'" until the approval; corrected in place.)* No Main, staged, site, dashboard or infra change is made by
> this file. Written from `47c9bc9` (2026-11-03).
> **Ruling it implements:** Yigitcan, 2026-11-03 (by pasting the CLOSE-OUT brief): one solid but SHORT phase that
> closes every open item, before his final question/revision pass. At most three build rounds and one live window.
> **Placeholders on purpose:** `barber-demo.<apex>`, `<n8n host>`. No credential value, hostname or contact value in
> this file.

## 0. The inventory — swept from the records, not from memory

**How it was made.** Every open-item surface of the repo was swept read-only, and duplicates were merged into one row.
The surfaces swept: ROADMAP (the public-demo row's carried list, "Ship gate after D6c", every v2 / open table);
README "Honest limits" and "Not built yet"; ENGINEERING-NOTES; the open, carried and bound sections of PHASE-7, PHASE-8,
PUBLIC-DEMO, NAME-CAPTURE, DATE-PHRASING, N1 and MIGRATION; PHASE-6-BACKLOG; OPERATIONAL-INCIDENTS; MASTER-BRIEF §9;
ARCHITECTURE-DECISIONS. The result is **58 items in 57 rows**. Row 29 is merged into row 23.

**Classes.**
- **A** — close now, by a build, a fix or a measurement.
- **B** — close by a written DECISION. These cannot be done honestly without something we do not have, such as a real
  client or a WhatsApp number. Each B carries its trigger and the steps for when the trigger fires.
- **B-v2** — re-affirm an existing v2 ruling as the close (decision DC-1).
- **C** — owner-only.

| # | Item | Source | Surface | Class | Close-out action |
|---|---|---|---|---|---|
| 1 | `date_expr_missing` false alert at a pending confirm (4905) | ROADMAP:20; N1 plan R4 | Main | **A** | M1 (§3) |
| 2 | Booking-confirm freshness check | ROADMAP:20; DATE-PHRASING:469/507/724; N1:11 | Main | **A** | M2 (§3) — reuses the cancel confirm's `confirm_turn` pattern |
| 3 | Infra alerts take `sender`/`channel`/`stage` from the error item | PHASE-7:593; ENG-NOTES | Main | B-v2 | DC-1 |
| 4 | A stale line in the intent prompt (reschedule "routed to a human") | PHASE-7:594 | Main | B-v2 | DC-1 (a prompt change needs a paid golden re-run) |
| 5 | The few-shot's fixed "no hair colouring" example | PHASE-8:284; ARCH-DEC:387 | Main | B | trigger: a client that offers colouring → a Main edit of `Build LLM Request` |
| 6 | The engine does not read siteverify's `hostname`; the Turnstile secret sits in a node | PUBLIC-DEMO:33–36; ARCH-DEC:388 | Main | B | DC-7: with per-client provisioning (#34), which creates the hostname list and the credential |
| 7 | D-c: an alert can run ahead of the reply and delay it | ENG-NOTES | Main | B-v2 | DC-1 |
| 8 | Rebooking a slot you just cancelled is handed off | PHASE-7:183 | Main | B-v2 | DC-1 (needs a real calendar write to prove) |
| 9 | A verify read with no `items` key counts as empty | ENG-NOTES | Main | B | trigger: Calendar seen omitting the key |
| 10 | A change request during a confirm (the "change" intent) | ARCH-DEC 2026-09-09e | Main | B-v2 | DC-1 |
| 11 | Does a re-sent `yes` book twice? (an open QUESTION) | ROADMAP:651, :2170 #8 | Main | **A** | M3: answered offline by a chat-replay test, no Main change |
| 12 | The second uncertain turn live; golden G8/G10/G11 not run (they need a seeded stage) | PHASE-7:609; tests/golden-set.md | Main | B-v2 | DC-1 (LLM spend in a window) |
| 13 | The old nameless `confirming` row ("its yes hands off") | NAME-CAPTURE:495, :661; DATE-PHRASING:466/648 | Main (data) | **A** | read-only: its prefix and age as `salon_ro`; then DC-11 |
| 14 | The `\p{M}` / ZWNJ name bound | NAME-CAPTURE:469, :660 | Main | B | already a written bound; trigger: a client with non-Latin names |
| 15 | DATE-PHRASING and N1 recorded bounds (the r4 text class, F2, F3, the in-flight put, N1's `trim()` LOW) | DATE-PHRASING:408/509/595; N1:523 | Main | B | already written; M2 changes F1's premise, which is recorded in R1 |
| 16 | EUR only, English text, dead keys `instagram` / `business.locale` | PHASE-8:22–24 | Main/config | B | trigger: a client in another currency or language |
| 17 | The nightly Purge "no_candidates" alert (recorded when the leads table was empty) | PHASE-7:186; MIGRATION-PLAN:1407 | Purge | **A** | measure the alert volume first (#57), then DC-5 |
| 18 | Stale comments in two Purge nodes and `001_init.sql`'s `lead_no` comment | PHASE-7:189 | Purge/db | **A** | P2: the Purge comments ride a Purge put if DC-5 adds one; the SQL comment goes in the next schema file |
| 19 | A reminder for an appointment cancelled while the mirror failed | PHASE-7:184 | Reminders | B-v2 | DC-1 (needs a new Google credential in Reminders) |
| 20 | Real WhatsApp template delivery (CP4d-2) | ROADMAP:14, :199 | Reminders | B | trigger: a client's own WhatsApp Business number |
| 21 | Release's 1 s resend window | ROADMAP Owner Actions bounds | Owner Actions | B | already a written bound |
| 22 | Cloudflare's own Turnstile retry beside ours | ROADMAP:20; N1:645 | site+snippet | **A** | S1: measure, then DC-4 |
| 23 | Widget message times in the visitor's zone (two sites: the site panel and the snippet) | PHASE-7:187 (iii) | site+snippet | **A** | S2, DC-2 |
| 24 | #15 the hidden-container check in Managed mode | ROADMAP gate table; PUBLIC-DEMO RENAME (3) | site+snippet | B | DC-6: the premise changed with interaction-only |
| 25 | The watchdog's five unswept axes | ROADMAP:2171 #9 | site+snippet | B | one axis needs a real token, the other four are threshold tuning, not a defect; trigger: a client reports a stuck widget |
| 26 | A phone / e-mail field in the widget, per client | NAME-CAPTURE:26 | site/Main | B | trigger: a client that wants call-backs from the widget |
| 27 | Dashboard (i): two mask formulas, so every widget row counts as "re-masked" | PHASE-7:187 (i) | dashboard | **A** | D1, DC-3 |
| 28 | Dashboard (ii): the "Today" block after a cancel | PHASE-7:187 (ii) | dashboard | **A** | D2: reproduce with a fixture first |
| 30 | Dashboard security v2: `salon_ro` reads every column; a cached write check; raw driver errors | PHASE-7:583/586 | dashboard | B-v2 | DC-1 |
| 31 | The older v2 / LATER bucket (Idempotent Replay's stored reply, required template keys, the lost transcript, font subset, a Customers table, BULGU-4, R2, W57/58/60) | PHASE-7:728 | mixed | B-v2 | DC-1 |
| 32 | F5, F6, F9, F10, F11, F13, the `handoffShown` twin, W64/W65 | PHASE-7:171–180 | mixed | B-v2 | DC-1 |
| 33 | #18 Access's configuration is not in the repo | ROADMAP gate table | infra-security | B | decision: it stays out — in a public repo it would be a service inventory; the behaviour is the measured control (K-6) |
| 34 | Per-client Turnstile provisioning | ROADMAP:20; README | infra-security | B | trigger: the second real client; steps in §5 |
| 35 | A real second deployment | README; PHASE-8:285 | infra-security | B | trigger: a real client; steps in §5 |
| 36 | WhatsApp end to end on Postgres (K-5) | ROADMAP:20; README | infra-security | B | trigger: the WhatsApp channel turned on for a client; steps in §5 |
| 37 | Instagram DMs (config-gated, no adapter built) | MASTER-BRIEF:92; PHASE-8:22–24 (the dead `instagram` key) | infra-security | B | trigger: a client asks for Instagram |
| 38 | The 7-2 CONVERGE deploy-tool / secret-scan / masking LOWs | ENG-NOTES | infra-security | B-v2 | DC-1 |
| 39 | Vercel token revocation + `~/.vercel-demo.env` deletion | ROADMAP:20 | owner-only | **C** → then A | §6 C-2; **after** R3's site redeploy, which still needs the token |
| 40 | #17b–d rotations: the `/api` Access service token, the owner-path Access service token, the n8n API key (17a done, 17e accepted) | PHASE-7:577–579 | owner-only | **C** | §6 C-3, after R3 (the window uses them) |
| 41 | Revoke the Access sessions; dashboard session 730 h → 24 h | PHASE-7:581/590 | owner-only | **C** | §6 C-4 |
| 42 | Deny rules for every secret-file copy; the tunnel credential in a root-only file (OPS-6) | PHASE-7:585; OPS-6 | owner-only / CC | **C** + A | the root-side move is his (C-5); the deny rules are CC's under ⚠ ONAY (§4 X1) |
| 43 | An off-server backup target; a pinned backup script | PHASE-7:584/588 | owner-only | B | DC-8 |
| 44 | Airtable: Gate 1 export, token revocation, base deletion | PHASE-7:592; MIGRATION §7a | owner-only | **C** | §6 C-6 |
| 45 | The Loom (#20) and the "CC builds" exception review it carries | ROADMAP gate #20 | owner-only | **C** | DC-9 |
| 46 | GitHub About fields (Website, description, topics) | ROADMAP:20 | owner-only | **C** | §6 C-1 |
| 47 | A second owner-alert channel | PHASE-7:181 | owner-only | B | trigger: a real client (an alert that cannot reach the owner is a business risk then) |
| 48 | Broken link `../n8n/workflow.sanitized.json` | ROADMAP:132 | docs | **A** | → `../n8n/workflow.main.sanitized.json` |
| 49 | Rulings missing from ARCHITECTURE-DECISIONS: public-demo D1–D6, the RENAME and ruling C, ruling R, NAME-CAPTURE's approval and R3-1..3, DATE-PHRASING's approval, option B, R2e and R-a..R-d, N1's approval with D-6 amended and the Codex cap, the 4905 bound, the close's rulings (1)–(3) | ARCH-DEC log ends 2026-11-02 | docs | **A** | one dated row each, pointing to its plan section |
| 50 | README D1 (shorten "Honest status"), D2 ("How this was built"), D3 (one chat screenshot without a hostname) | Cowork | docs | **A** / C | D1, D2 by CC; D3 is DC-10 |
| 51 | STALE: the reschedule-orphan alert "does not name the old slot" is listed as v2, but the committed Main has it since `784cdd8` | PHASE-7:185/274; ENG-NOTES | docs | **A** | correct the listings; live presence read from today's content parity (green) |
| 52 | STALE: OPS-4 "NOT done" vs ROADMAP K1 closed 2026-09-11 | OPS:273 | docs | **A** | correct in place |
| 53 | STALE: OPS-5 "STILL OPEN at 2026-10-18" | OPS:117 | docs | **A** | closed by D6c (Airtable retired) |
| 54 | STALE: two unticked rows of the 6b hand-over table | ROADMAP:2159–2160 | docs | **A** | tick with their sources |
| 55 | STALE: "one DoD item recorded as open" after the DoD rows went ✅ | N1:641; DATE-PHRASING:723 | docs | **A** | correct in place |
| 56 | STALE: PUBLIC-DEMO's header hostname list; "the older deployments" not closed in ROADMAP:20 | PUBLIC-DEMO:13–15 vs :471 | docs | **A** | correct in place |
| 57 | The go-live alert volume, "to be measured at R3" and never reported | PUBLIC-DEMO:26 | docs | **A** | read-only count by alert class since go-live (n8n executions) |
| 58 | PHASE-6-BACKLOG has no per-item disposition | PHASE-6-BACKLOG | docs | **A** | one disposition column (done / moved / v2), each with its source |

**Counts (counted from this table):** **57 rows** = A 21 · B 18 · B-v2 11 · C 7.
- Row 50 is A with its D3 part a decision (DC-10).
- Rows 39 and 42 are C first, then a CC step.
- Row 23 carries row 29, so the rows hold 58 items.

## 1. Goal

Every row of §0 ends in one of three states:
- **done**, with evidence;
- **closed by a written decision**, with its trigger;
- **done or explicitly declined by Yigitcan.**

## 2. Scope / NOT-build

**In scope:**
- the A rows;
- the decision texts of the B and B-v2 rows;
- the owner's C steps written as exact clicks, with the check that follows each.

**NOT-build:**
- nothing from B or B-v2. A B row is never described as built;
- no new feature;
- no multi-tenancy;
- no prompt change, so no paid golden re-run;
- no WhatsApp webhook opening;
- no real calendar write beyond the owner's run;
- no deletion of an owner test row.

## 3. Design, per surface — the smallest fix for each A row

**Main — ONE staged edit, one Codex set, one put:**
- **M1 — no false `date_expr_missing` at a pending confirm.**
  - *Today:* `Resolve Date` treats a model date without a `dateExpr` as an echo only when the intent is `confirm` at a
    confirm stage. A `no` answered with `cancel` plus the stored date (4905) alerts.
  - *Fix:* at a confirm stage, a model date EQUAL to the stored date with no `dateExpr` is an echo, whatever the
    intent: no alert, and the stored date stays.
  - *Test, both directions:*
    - `docs/n1/alert-4905-replay.cjs`'s live answer gives no alert;
    - a DIFFERENT model date without an expression at a confirm stage still alerts;
    - the same echo outside a confirm stage still alerts.
  - *Risk if wrong:* a real date change at a confirm goes unalerted. It is still never written, because the confirm
    shows the stored date and its year.
- **M2 — the booking confirm gets a freshness check, reusing the cancel / reschedule confirm's pattern.**
  - *Stamp:* the stage `confirming` is stamped with `confirm_turn = String(turn_count + 1)` where the confirm is
    asked (`Compute Availability`).
  - *Check:* a new IF, `Booking Fresh?`, between `Reschedule Router`'s false output and `Build Event Request`. It is
    the same expression as `Confirm Fresh?`.
  - *A stale "yes" (DC-13):* the confirm is shown again and nothing is written. Recommended: the availability is
    re-read and the same confirm is asked with a fresh stamp.
  - *Consequences checked in R1:*
    - `Extraction Transient?`'s stage list deliberately leaves plain `confirming` out because it had no freshness
      check (`handoff.md`). With M2, an extra turn makes the next "yes" stale, which means a re-ask, not a dropped
      confirm. The list stays, and its reason line in `handoff.md` is corrected.
    - A `confirming` row saved before M2 has no stamp, so it is stale. Its "yes" re-asks. That closes DATE-PHRASING's
      F1 premise and row 13's row too, both recorded in R1.
  - *Test:* confirm → question → "yes" re-asks and writes nothing; confirm → "yes" books; an unstamped `confirming`
    row → "yes" re-asks; the mutants include removing the check, inverting it and dropping the stamp.
  - *Risk if wrong:* every booking "yes" re-asks, so nobody can book. The owner run catches this, and the rollback is
    the snapshot.
- **M3 — row 11 answered offline:** a chat-replay test sends "yes" twice after one confirm. Expected: one booking,
  then `stage=booked` answers the second. No Main change. If the test finds a double booking, it becomes an M item
  and the plan is re-presented.

**Site + snippet — one build, one redeploy:**
- **S1:** measure Cloudflare's default retry with Cloudflare's documented always-fail TEST key, headless. Count the
  widget's error callbacks and the challenge requests per send, once with the default and once with `retry: 'never'`.
  Then apply DC-4 on both render sites. The build runs in an isolated copy (OPS-10).
- **S2:** message times in the shop's timezone, with the zone named once in the panel (DC-2). This touches both
  render sites, `LiveChatPanel.tsx` and the snippet's `index.ts`. *Test:* a fixed instant renders as the shop's
  wall-clock time under two different browser zones.

**Dashboard — one build in a copy, one restart:**
- **D1:** one mask formula (DC-3). *Test:* the widget-lane fixture counts 0 as re-masked; a row with a full sender
  stored still counts 1.
- **D2:** reproduce the "Today" block after a cancel with a fixture. If it reproduces, fix the window. If it does not,
  the fixture test is committed and the row closes as "not reproduced", with the fixture as its evidence.

**Purge — only if DC-5 says so:**
- **P1:** no alert when there is nothing old to delete; a real error still alerts.
- **P2:** the two stale comments.

**Docs — no live surface:** rows 48–58 and README D1/D2, plus the RUNBOOK line saying that revoking the Vercel token
also closes the shell pause path (`demo-offline.sh pause`). The Vercel-connection path stays. Rows 13 and 57 are
read-only reads as `salon_ro` and through the n8n API.

## 4. Skeleton (node level) and other changes

- **Main:**
  - `Resolve Date`: M1's echo rule.
  - `Compute Availability`: M2's stamp.
  - `Build Booking-Declined State`: clear the stamp, as it does today, unchanged.
  - **New:** `Booking Fresh?` (IF) and its stale branch to the re-ask (re-using the availability path), plus a sticky
    note.
  - One approved delta in `scripts/diff-workflow-copy.py`.
- **site / snippet:** the Turnstile render options in `web/snippet/src/turnstile.ts` and
  `web/site/components/site/TurnstileWidget.tsx`; the time formatting in `LiveChatPanel.tsx` and
  `web/snippet/src/index.ts`; the config's timezone, read as today.
- **dashboard:** `web/dashboard/lib/mask.ts` / `HandoffQueue.tsx`; `AppointmentsPanel.tsx` and `lib/store.ts` only if
  D2 reproduces.
- **Purge** (if DC-5): the alert IF of the no-candidates branch; two comments.
- **X1 (⚠ ONAY):** deny rules for the secret-file copies, in the user-level Claude settings (outside the repo), each
  measured from a sub-agent.
- **docs:** ARCH-DEC rows, the stale listings, README D1/D2, RUNBOOK, PHASE-6-BACKLOG dispositions, ENG-NOTES' v2
  table re-affirmed with triggers.
- **tests:** M1 / M2 / M3 tests and mutants, S2's zone test, D1/D2 fixtures.

## 5. Integrations, and the B rows' "when the trigger fires" steps

**Touched:**
- n8n (Main, maybe Purge);
- Postgres (read-only reads; the run's own rows);
- Google Calendar (the owner run only);
- Vercel (one redeploy);
- Cloudflare Turnstile (test keys headless; the real key in the owner run);
- the dashboard's systemd user unit.

**No LLM call by CC.** The owner run spends a few turns.

**When a B trigger fires, the steps:**
- **#34 provisioning** (second real client): a write-scoped Cloudflare token (created by the owner) → the widget
  created through the API → the site key into the client's frontend environment → the secret straight into that
  client's n8n credential, never through a chat or a log → the engine's `hostname` check (#6) added with it.
- **#35 second deployment:** `render-client.py` → import → link the credentials → RUNBOOK §0's provisioning as one
  procedure, timed.
- **#36 WhatsApp:** the client's Zernio number → open the webhook (⚠ ONAY, spend) → a real-phone run → the K-5 row
  closes.
- **#43 off-site backup:** a target the owner names → `pg-backup.sh` copies the verified dump there → a restore drill
  from it.
- **#47 second alert channel:** e-mail or SMS via a new credential → each alert class sent to both.

## 6. The owner's steps (C), as exact clicks, with the check after each

- **C-1 GitHub About:** repo page → **⚙ next to "About"**. Fill in:
  - Website `https://barber-demo.<apex>`;
  - the README's first sentence as the description;
  - topics `n8n ai-agent chatbot booking postgres nextjs cloudflare-turnstile`.

  Then **Save changes**. *Check:* CC reads the public repo API's `homepage` and compares it with the Vercel project's
  only domain without printing it, and reads `topics`.
- **C-2 Vercel token, AFTER R3's redeploy:** Vercel → avatar → **Account Settings → Tokens** → the token created
  2026-10-30 for the demo (team scope) → **Delete**. *Check:* `scratchpad/vercel-token-probe.py` gives 401/403 (it
  gave 200 on 2026-11-03), then the file is deleted under ⚠ ONAY and its absence read back.
- **C-3 rotations, AFTER R3** (the window uses them). ⚠ **Declined by decision, 2026-11-04** (Yigitcan; section "C-3
  declined" at the end): the steps below are what runs when its trigger fires.
  - **(b)** the `/api` Access service token;
  - **(c)** the owner-path Access service token;
  - **(d)** the n8n API key.

  For each one:
  1. Create the new one in its dashboard (Cloudflare Zero Trust → Access → Service Auth; n8n → Settings → n8n API).
  2. Write it into a NEW 0600 file beside the old one.
  3. Revoke the old one.

  *Check:* CC calls once with the old file and expects a refusal, and once with the new file and expects 200. Then
  the new file takes the old one's name, under ⚠ ONAY.
- **C-4 Access sessions:** Zero Trust → **My Team → Users** → revoke the sessions; **Access → Applications** → the
  dashboard application → session duration **24 hours**. *Check:* an unauthenticated request still gets `302`; the
  duration itself is an operator statement unless the read-only token can read the application.
- **C-5 the tunnel credential:** move it to a root-only file, as root, with the commands CC writes in R1 *(not written
  in R1 — found 2026-11-04; CC hands them over in the conversation, not in the repo, per OPS-6)*. *Check:* the
  tunnel still answers, and the file is not readable by the build user.
- **C-6 Airtable:**
  1. Gate 1 export, per MIGRATION §7a.
  2. Revoke the tokens.
  3. Delete the base.

  *Check:* an API call with the old token is refused. CC reads nothing else of Airtable.
- **C-7 the Loom (DC-9)** and **C-8 the screenshot (DC-10).**

## 7. Mock data

- Synthetic names only (`Kim Moss`, `Mara O'Test`).
- The owner run's rows are kept, by the standing ruling.
- No seed is planned. If one is needed, it uses the `pd-` prefix and is listed.

## 8. Critical-Review Targets (Codex, at most two passes per surface)

- **Main:** CRT #12 (dates, M1), #1b / #2 (the booking write behind a new gate, M2), #5 (handoff and the uncertainty
  ladder with the stamp).
- **site / snippet:** #13 (the widget).
- **dashboard:** #9.

The fourth-adjustment rule applies: after pass 2, a finding of an earlier class is a recorded bound. A NEW class that
writes, cancels or blocks a booking wrongly is a stop.

## 9. Acceptance criteria — "phase closed" means

*Status at R4 (2026-11-04), each line with its evidence or its reason; the live reads are terminal-measured, output not
committed:*
- **1 ◐** — every A row of the build is done. G1, M1–M3, P1/P2, S1/S2, D1/D2, the docs rows and the reads (rows 13, 57)
  are done; the evidence is in R1–R4. The new finding (`check-no-host-leak.sh` without `CLAUDE.local.md`) is R4's step 3.
  *Updated 2026-11-04:* **X1** (row 42's A half, the deny rules) is NOT done — found while weighing C-5; open as CC's
  under ⚠ ONAY (the last section).
- **2 ✅** — every B and B-v2 row is written with its decision and trigger in ENGINEERING-NOTES, "Closed by decision —
  CLOSE-OUT".
- **3 ⏳ open** — C-1 (GitHub About), C-2 (Vercel token), C-3 (#17's rotations), C-4…C-6 and the Loom (DC-9) are the
  owner's steps, handed over at the end of R4. *Updated 2026-11-04:* C-1 and C-2 done; C-3 declined in writing; C-4,
  C-5, C-6, the Loom and the screenshot open — the last section (X1 is an A row: criterion 1).
- **4 ✅** — Main, Purge, the site and the dashboard each changed once, in the R3 window. The owner's run was read back in
  R4: executions 4947–4959 and `salon_ro`.
- **5 ✅** — after promotion (`d9f770a`), both parity guards are 0 against the committed exports (content 5/5;
  structure 198/198 nodes, 280/280 connections), and `check-all` is 0.
- **6 ✅** — the ROADMAP rows are classed, and the public-demo row is ✅ since C-1 and C-2 (2026-11-04). *(Said "⏳ open
  … stays ◐ until C-1 and C-2 are done" until then; corrected in place.)*

1. Every A row is done with its evidence: a commit, a test that fails before and passes after, or a read.
2. Every B and B-v2 row has its decision text and trigger in ENGINEERING-NOTES or the plan it belongs to.
3. Every C row is done (and checked as §6 says) or explicitly declined by Yigitcan, in writing.
4. Main, site and dashboard each changed once, each with its owner run read back.
5. Both parity guards are 0 against the committed exports after promotion; `check-all` 0.
6. ROADMAP lists no open item without a class, and the public-demo row is ✅.

## 10. ⚙ Drill matrix

| Scenario | Setup | Expected | Must run | Must not run |
|---|---|---|---|---|
| 4905 replayed | the live answer | change question, no alert | Resolve Date, N1 nodes | Send Owner Alert (Telegram) |
| a different date, no expression, at a confirm | a replay | alert as today | Date Alert? | a write |
| the stored date echoed OUTSIDE a confirm stage | a replay | alert as today | Date Alert? | a write |
| confirm → question → "yes" | a replay; owner run | the confirm again, nothing booked | Booking Fresh? (false) | Book Appointment |
| confirm → "yes" | a replay; owner run | booked | Booking Fresh? (true), write-then-verify | — |
| an unstamped `confirming` row → "yes" | a replay | re-ask | Booking Fresh? (false) | Book Appointment |
| "yes" sent twice | M3 replay | one booking | one Write Appointment | a second write |
| a Turnstile failure | always-fail test key | the counted callbacks, as measured, per DC-4 | the widget's own retry | an unbounded loop |
| times under two browser zones | headless | the same shop-time label | — | — |
| the widget-lane mask fixture | dashboard test | 0 re-masked | — | — |
| a cancel, then the "Today" block | dashboard fixture (D2) | only today's active appointments counted | — | — |
| Purge with nothing old (if DC-5) | the Purge test path | no alert | Purge run | Send Owner Alert (Purge) |
| Purge with a real error (if DC-5) | a forced query error | the alert as today | the error branch | a delete |

## 11. Rounds — at most three build rounds and one live window

- **R1 (offline, in parallel slices):** M1–M3 staged; S1 measured and S2 built in a copy; D1/D2; the docs slice
  (rows 48–58, README D1/D2, ARCH-DEC); the reads for rows 13 and 57; X1 under ⚠ ONAY. Commit per slice →
  `security-auditor` → push. *Parallel:* the docs slice and the reads can land first, because they touch no live
  surface.
- **R2 (Codex, ≤ 2 passes per surface) and fixes;** DC-5 applied.
- **R3 (ONE live window, every step with its ⚠ ONAY ready):** start gates → `rehearse-rollback` → **Main put** (and
  the Purge put if DC-5) → probe, parity vs staged → **site redeploy** → **dashboard restart** (the OPS-10 procedure)
  → end gates → STOP for the owner run (every line replayed through the staged path first) → read back → promote →
  then C-2 and C-3 → records → close.

**The ⚠ ONAY texts, ready:**
- **(1) Main put.** If wrong, a booking "yes" re-asks or an alert goes missing. The new nodes write nothing. Rollback
  is the snapshot.
- **(2) Purge put**, if DC-5. If wrong, a real Purge error goes unalerted. Rollback is the snapshot.
- **(3) Site redeploy.** If wrong, the widget's times are wrong or Turnstile does not retry. Rollback is the previous
  deployment.
- **(4) Dashboard restart.** If wrong, the dashboard is down for minutes, as OPS-10 measured. Rollback is the previous
  build directory.
- **(5) Deleting `~/.vercel-demo.env`.** Not reversible, but a revoked token has no value to restore.
- **(6) X1, the deny-rule edit** outside the repo. Reversible from a backup copy.

## 12. Automation-fit

Neither `/loop` nor `/goal`. Each round ends at an approval or an owner step.

## 13. Decisions for Yigitcan — each with a recommendation

| | Decision | Recommendation |
|---|---|---|
| DC-1 | The v2-ruled but doable rows (3, 4, 7, 8, 10, 12, 19, 30, 31, 32, 38): re-affirm them as v2, each with its trigger, or reopen some | **Re-affirm all as v2.** Opening them breaks "short" and edits Main twice. Row 11 is answered offline instead (M3) |
| DC-2 | Widget times: the shop's zone or the visitor's | **The shop's zone, named once in the panel.** A booking is in shop time, and a visitor abroad otherwise sees a different hour than the confirm |
| DC-3 | The dashboard's one mask formula | **The stored `sender_masked`** (what the engine writes and the queue reads). The dashboard falls back to its own formula only when the column is empty. Measured on the fixtures first |
| DC-4 | Cloudflare's own retry | **Measure first.** If it adds callbacks beyond our two retries, set `retry: 'never'` on both render sites |
| DC-5 | The Purge "no_candidates" alert | **Decide after the read (row 57).** If it still fires nightly, build P1 and add the Purge put to the window. If it no longer fires (the table now holds rows), close the row by that read and leave Purge alone. ⚠ **Ruled during R1 (Yigitcan, 2026-11-03): P1 and P2 are IN this phase**, with a separate Purge put in R3 under its own ⚠ ONAY. The read behind it, as reported to him (n8n executions, read-only; output not committed): 3 of 3 nightly Purge runs since go-live alerted `no_candidates` with 0 candidates and 4 leads |
| DC-6 | #15 under interaction-only | **Close by decision.** The forced-interactive TEST key showed the challenge inside the panel (DOMAIN + INTERACTION-ONLY). The real key's challenge was never seen, because the owner's runs passed without one; that is recorded as the bound |
| DC-7 | The engine's `hostname` check and the secret in a credential | **B, with provisioning (#34).** The hostname list is per client and comes from the widget's creation |
| DC-8 | An off-server backup | **B, trigger: the first real client**, unless you name a target now |
| DC-9 | The Loom | **Your call on the approach.** Until then the row is open with your reason, and the phase closes with it explicitly declined or deferred in writing |
| DC-10 | README D3, the screenshot | **You take one in your browser** (the chat panel only, cropped, no address bar). CC checks it for a hostname and commits it |
| DC-11 | The old nameless `confirming` row | **Keep it.** With M2 its "yes" re-asks, and it is the owner's row (never deleted without his word) |
| DC-12 | The Codex cap | **2 passes per surface**, as the brief says |
| DC-13 | M2's stale "yes" | **Show the confirm again**, availability re-read, nothing written. A handoff would page the owner for a customer who only asked a question |

## R1 — built offline (2026-11-03); NOT live

*(Every number below terminal-measured, output not committed, unless a committed test or file holds it.)*

**Rulings taken during R1, asked and answered (Yigitcan, 2026-11-03):**
- **DC-5 → Purge IN.** The read (row 57): 3 of 3 nightly Purge runs after go-live alerted `no_candidates` (0 candidates,
  4 leads); Main 3 alerts, Reminders 0. P1/P2 built; the window gets a Purge put under its own ⚠ ONAY.
- **D1 → "fix the counter only"**, replacing DC-3's "single source". As first built (`sender_masked` as the display
  source), D1 hid the sender on about 3.7 % of widget rows (a 7-character all-digit slice tripped the phone guard;
  200,000 synthetic ids) and showed 7 characters of the widget id instead of 4. Now the display is today's, and only the
  "re-masked" counter reads the column.

**Declared deviations and precisions (none changes a ruling):**
1. **M1 withholds only the ping.** The date still drops at a pending confirm, so HIGH-2b's guard stands. One committed
   test row expected the ping and was aligned (`resolve-date` "CODEX-H2b right stage, wrong intent"). This is the plan's
   stated risk: a real change at a confirm goes unalerted, and is still never written.
2. **M2's gate is scoped to stage `confirming`.** Unscoped, it turned N1's D-6 second bare "yes" after a decline (stage
   `collecting`) from a handoff into a re-shown confirm, against an explicit ruling. Scoped, D-6 holds; a mutant
   removing the scope is killed.
3. **DC-13's re-read** runs by sending a stale "yes" back through `Slot Gate`. `Compute Availability` reads Slot Gate's
   item, and Slot Gate reads only the stored slots. A stored request without a name gets the name question (row 13's
   row) instead of a handoff.
4. **Tests whose premise M1/M2 changed, adapted in place:**
   - N1's A10: a "yes" after a question re-shows, then books;
   - chat-replay 9: the write property holds through the re-show;
   - two `workflow-step` gate-edit cases: a delta with no gate edit gets a byte-equal Load Config check;
   - `privacy-facts`: its pre-NAME-CAPTURE branch for a committed Purge beside a staged one.
5. **One equivalent mutant, shown and not counted:** keeping the stamp on a non-confirming status. The gate reads it
   only at `confirming`.
6. **Not covered offline:** a slot taken between the ask and a stale "yes". The harness's freeBusy stub is always free.
   That answer is `Compute Availability`'s unchanged "taken" branch.
7. **The local snippet bundle** (gitignored) was rebuilt in an isolated copy and only the output copied in, because
   S2 changed the source (OPS-10).

**Built and tested** (`check-all` 0 on the final tree):
- **G1:** `scripts/start-gates.sh` + `scripts/vienna-window.py`; the test refuses at :55/:57/:00/:02/:05 and runs at
  :06/:10/:54; two mutants are red.
- **Main (staged) M1–M3:** `close-out-main` 12 tests; 7 red on `5d8dacf`; 13 mutants killed. N1 39/39, DATE-PHRASING
  60/60 and NAME-CAPTURE 50/50 mutants on the staged export.
- **Purge (staged) P1/P2:** `close-out-purge` 5 tests; 3 red on the committed export; two mutants killed.
- **Site/snippet S1:** with Cloudflare's always-fail test key in 45 s, the default gave 6 error callbacks and
  7 challenge frames; `retry: 'never'` gave 3 and 3. The default kept retrying about every 12 s after our block.
  `retry: 'never'` is now set on both render sites, and the drill asserts it (red before, green after).
- **Site/snippet S2:** times in the shop's zone with the zone named once. The drill under two browser zones went from
  2/7 to 7/7 on both surfaces. 4 mutants killed. A zone the runtime does not know is refused at build time.
- **Dashboard D1/D2:** the counter only (8 mutants killed; the rendered sender and the client props are identical to
  `5d8dacf` on the fixtures). D2 reproduced and fixed: the "Today" block counts only today's rows.
- **Docs:**
  - ARCH-DEC rows for the rulings that lived only in plans, plus this phase's rulings;
  - the stale records 48 and 51–56;
  - the B / B-v2 decisions in ENGINEERING-NOTES;
  - README D1/D2;
  - the RUNBOOK pause line;
  - the PHASE-6-BACKLOG dispositions;
  - the two records S1/S2 superseded.

**Found, not fixed (a new item):** `scripts/check-no-host-leak.sh`'s documented `$N8N_HOST`-only path stops with
"PARSED: unbound variable" when `CLAUDE.local.md` is absent. It fails closed, never silently green.

## R2 — Codex pass 1 and the fixes (2026-11-03)

**Codex pass 1** at `2519887` (contained; verbatim `docs/codex/close-out/p1.md`, containment `containment.md`).

**The one HIGH (MAIN), and its ruling.** The confirm's stamp counts **saved** turns. A turn that saves no state does not
advance `turn_count`, so it does not stale the confirm, and the next "yes" books. Examples are an LLM-unavailable reply
or a guard trip. Codex measured it by injecting an LLM timeout into the replay. The slot written is the one shown, and
write-then-verify is unchanged. The cancel and reschedule confirms' TTL has the same bound.
**Ruling (Yigitcan, 2026-11-03, asked):** record it as a bound, and pin it with a test. There is no Main change.

**The other findings, per surface:**

| Surface | Finding | Triage | Action |
|---|---|---|---|
| MAIN | HIGH: an unsaved transient turn does not stale the confirm | bound, by ruling | `handoff.md` states it. The test `BOUND: an unsaved transient turn…` pins it, through a new harness hook: a model answer with `__llmError` makes `Extract Intent` fail on its error output |
| SITE + SNIPPET | MEDIUM: after three consecutive errors the widget no longer recovers on its own; a reload is needed | bound — the direct consequence of DC-4. Before S1, Cloudflare kept retrying about every 12 s for as long as the page stayed open | recorded here |
| TESTS | MEDIUM: the Main suite had no unsaved turn between the ask and the "yes" | real | the BOUND test above |
| TESTS | LOW: G1's tests never exercised the production clock path; a `TZ = 'UTC'` mutant passed | real for the label, not the decision. Vienna is a whole-hour offset, so every minute decides the same | a live-clock case: the label must be the Vienna HH:MM computed independently. The UTC mutant is now red (measured) |
| TESTS | LOW: N1's delete-status assertion cannot go red, because the harness's delete stub always answers 204 | real, a harness limit that predates this phase | recorded as a bound of the replay (which never proves a Calendar delete) |
| TESTS | the declared equivalent mutant was not executed by `main()` | real | `main()` runs it and shows it; it stays green |
| PURGE, DASHBOARD, OPS, S2 | no finding | — | — |

**The cap:** pass 1 found real items, so pass 2 runs on this round's diff (MAIN's test, the harness hook, G1's test).
After pass 2, a finding of an earlier class is recorded, not chased. A NEW class that writes, cancels or blocks a
booking wrongly is a stop.

## R2 recheck — Codex pass 2, the last (2026-11-03)

**Codex pass 2** at `e28ffb2` (contained; verbatim `docs/codex/close-out/p2.md`): **no HIGH, no MEDIUM, one LOW.**
- The harness hook routes through the staged Main's real `LLM Unavailable Reply` (`Extract Intent`'s `continueErrorOutput`
  output 1) and leaves the other replay suites unchanged.
- The BOUND test fails alone when the count advances or the stamp clears after the failed turn.
- The UTC mutant turns the live-clock case red. The new `handoff.md` sentence is true of the staged Main, with Codex's qualification: the later "yes" books once the transient condition has cleared; a guard still active, or another failing operation, can still stop it.

**The LOW — recorded as a BOUND (the cap: same class as pass 1's G1 test LOW):** the live-clock case retries once
across a minute rollover. Two rollovers in a row, which needs an unusual scheduling delay, would fail it although the
helper is right. The failure is loud, and is judged never to be a false pass (my reading, not Codex's: a stale minute would have to match a wrong helper by chance). Codex also noted that a host without time-zone data cannot run
the test (`ZoneInfoNotFoundError`); this server has the data.

**Codex for CLOSE-OUT is closed by the cap.** No surface has an open HIGH, so the ⚠ ONAY condition for R3 holds: R1
green, and the last pass per surface without an open HIGH.

## R3 — LIVE: Main and Purge put, site redeployed, dashboard rebuilt; ⏸ STOPPED for the owner run (2026-11-03)

*(Every read and number below terminal-measured, output not committed.)*

**Precondition of the ⚠ ONAY, both true:** R1 green (`check-all` 0), and the last Codex pass per surface has no open
HIGH (R2 recheck). **The Purge put's own ⚠ ONAY** was asked and given before the window (Yigitcan, 2026-11-03).

**The window, 22:15–22:17 Vienna** (outside :55–:05, away from 04:00):
- **Start gates:** `scripts/start-gates.sh`, the committed gate script with G1 now enforcing ("22:15 Vienna is outside
  :55–:05"). All green: the dummy token got 403 as sole holder, parity 5/5 and 196/278 against the committed exports,
  listeners, host-leak, hook-drift, a clean tree, 0 containers. The import-safety check passed over the window's scripts.
- **Main:** `rehearse-rollback` was green on a scratch (deleted, 404 read back).
  - Deactivate, then **put**. The nodes whose stored content changed are exactly `Booking Fresh?`,
    `Compute Availability`, `Resolve Date` and the sticky, inside the allowlist and the approved delta. Read back ==
    export and == the body sent; settings and webhook ids unchanged; the pre-PUT snapshot kept (0600, outside the repo).
  - Activate: **published == draft**. The workflow was inactive from 21:15:35.9Z to 21:15:39.2Z, about 3 s. The probe
    got 403 as sole holder.
- **Purge:** `rehearse-rollback` green.
  - Deactivate, then **put**. The changed nodes are exactly `Purge Error (leads)`, `Compute Purge Cutoff` and
    `Compute Leads Cutoff`. Read back == export, settings unchanged, the snapshot kept (0600).
  - Activate: **published == draft**, inactive about 2.5 s.
- **Parity against the STAGED exports** (a scratch mirror of HEAD with the staged files in the committed paths): Main
  content 173 nodes and settings OK, Purge content 24 and settings OK, Main structure 198/198 nodes and 280/280
  connections.
  **Negative control:** Main against the COMMITTED export shows DRIFT, exactly M2's three connections; red by
  construction until promotion.
- **Site:** redeployed from `48fcd8e`. The 60-file set holds nothing under `web/dashboard`, and the previous production
  deployment is recorded as the rollback target.
  - The new deployment is **READY**, target production. Its deployment URL gives `302` to Vercel's login.
    `barber-demo.<apex>` `/` and `/privacy` give 200 (public by ruling).
  - The **served widget is byte-identical to the local build**. The zone note appears once and `retry: "never"` once,
    in the widget and in the site's JS.
  - No file outside its 0600 file holds the token.
- **Dashboard:** built in an isolated copy (OPS-10; the move between trees measured offline first), swapped in by two
  renames, and the service restarted. The new BUILD_ID is live, loopback `/` gives 200, the unit is active, and the
  dashboard hostname gives `302` to the Access login unauthenticated. The listeners are OK and the git tree is clean.
  - The build carries D2's new text; the old text survives only in code comments.
  - The previous build is kept as `web/dashboard/.close-out-prev/.next` (ignored) for rollback.
- **The window's executions:** Main 4927 and 4928, both probes, `success`. Nothing ran on the other four workflows, so
  there was no error, no alert class and no LLM spend.
- **End gates:** the dummy token got 403. Listeners, host-leak and hook-drift OK, 0 containers. Parity against the
  committed Main and Purge is red by construction until promotion.

**The owner's run** — each line replayed through the staged Main (replayed offline by a scratchpad script at 4 Nov 08:00Z, with
the model's answers given). Run it **in a fresh private window** on `barber-demo.<apex>`:
1. *"I'd like a haircut on Thursday at 11:00"* → the name question → *"Kim Moss"* → the confirm, *"Haircut, Thursday 5 Nov
   2026 11:00 for Kim Moss — shall I book it? (yes / no)"* → *"how much is it?"* → the price list → *"yes"* → **the SAME
   confirm again, nothing booked** (M2) → *"yes"* → *"You're booked: Haircut, Thursday 5 Nov 11:00. See you then!"* →
   *"cancel my haircut"* → its cancel ask → *"yes"* → cancelled.
2. A second private window: book again up to the confirm → *"no"* → the change question. The owner's Telegram should
   get **no alert** from that turn (M1, when the model echoes the stored date; without an echo there is none either).
3. In both chats the panel shows **"Times in shop time (Europe/Vienna)"** once, and every message time is Vienna time
   whatever the device's zone (S2).
4. On the dashboard, the handoff queue shows **no "re-masked" notice** for widget rows (D1), and the "Today" block counts
   only today's rows (D2).

**Kept for rollback and promotion:** the Main and Purge pre-PUT snapshots and the parity mirror (scratchpad); the
previous dashboard build; the previous production deployment's id. All are removed at promotion, after parity is green
against the committed exports.

**Next round:** read the owner's run (executions and `salon_ro`), then promotion. Promotion means: staged → committed
for Main and Purge, `n8n/staged/` empty, both parity guards 0 against the committed exports, and the snapshots, mirror
and old dashboard build deleted. Then C-2 (the Vercel token) and C-3 (#17's rotations), and the phase close.

## R4 — the live run read back, promoted, the A rows closed (2026-11-04)

*(Every read and number below terminal-measured, output not committed, unless a committed test holds it.)*

**The run.** Cowork ran both scripts at Yigitcan's request in his own browser (Chrome), each in a fresh tab, with a real
Turnstile token (2026-11-04, Vienna). Every reply matched the script, by Cowork's reading. **Read back by GET on the n8n
executions:** Main 4947–4959, ten turns (7 + 3), every one `success`; 4929 and 4960 are gate probes. Nothing ran on
Owner Actions or Drill State; Reminders and Purge ran only on their schedules.

| Turn | Execution | What the engine did |
|---|---|---|
| ask (Thursday 11:00, the name) | 4947–4948 | the confirm asked and stamped `confirm_turn = '2'` |
| — about three hours' pause — | — | nothing expired and nothing handed off; the stored state carried on |
| "how much is it?" | 4952 | the price list; stage stays `confirming`, `turn_count` advances to 3 |
| "yes" | 4953 | **`Booking Fresh?` STALE** (stamp 2, turn 3): availability read again, the confirm asked again, **no calendar or appointment write** (M2 / DC-13) |
| "yes" | 4954 | **FRESH** (stamp 4, turn 4): `Book Appointment` → `Verify Slot` → `Write Appointment`, booked once |
| "cancel my haircut" → "yes" | 4955–4956 | the cancel ask; then `Delete Booking Event` 204 and `Update Appointment Cancelled` |
| script 2: the ask, then "no" | 4957–4959 | `declined`: slots and name kept, **no owner alert** |

- **The transient-turn bound did not apply:** every turn was saved, and `turn_count` advanced each time.
- **M1 was not exercised live:** the model did not echo the stored date on the "no" (`alert_withheld` absent), so the
  missing alert shows only that M1 added none. Its evidence stays offline (`close-out-main`).

**The store, as `salon_ro` (READ ONLY):**
- one appointment created in the run, the Haircut on 5 Nov 10:00Z (11:00 Vienna), now `cancelled`;
- the two conversations end `cancelled` and `collecting` / `declined` (slots kept);
- `processed_messages` holds 10 claims;
- **row 13:** one conversation at `confirming`, without a name or a stamp, not a `pd-` seed, last updated 2026-11-01.
  M2 is live, so its "yes" now asks for the name. It is kept by DC-11.

**P1 live:** the night's Purge (4935, 2026-11-04 04:00 Vienna) refused `no_candidates` (0 of 4). `Purge Error (leads)`
gave 0 items and no alert node ran — the first quiet night since go-live.

**S2 live (Cowork's reading):** the panel shows "Times in shop time (Europe/Vienna)", and the message stamps are in
Vienna time.

**Dashboard** (rendered on 127.0.0.1, counted, the page not kept):
- **D2 shown live:** the data holds the case D2 fixed, a cancelled appointment tomorrow. The block reads "No bookings
  today", and the old "in this window, none" text is absent.
- **D1 not shown live:** the handoff queue is empty, so the absence of the "re-masked" notice proves nothing. D1 rests on
  the offline render comparison and Codex pass 1.

**#15 — a real-key interactive challenge (Cowork's observation, not interpreted):** during run 1, after the confirm ask,
a REAL Turnstile "Verify you are human" box rendered inside the panel at full size. Nobody clicked it. By the time the
owner looked it had gone, and the next send carried a valid token. This is the first sighting of the real key's
interactive path. DC-6's recorded bound (the real key's challenge never seen) is narrowed to what this one sighting
cannot show: how a challenge that needs a click behaves when nobody clicks, or what a failed one looks like.

**Promoted** (`d9f770a`):
- the staged Main and Purge became the committed exports, byte-identical to the pushed staged files;
- `n8n/staged/` holds nothing tracked;
- the cancel-validation single-source guard covers `Booking Fresh?`: the `confirm_turn` regex 4x, and its TTL equals
  `Confirm Fresh?`'s plus exactly the stage scope; two of our mutants and four of the auditor's are red.

After the push, both parity guards are 0 against the committed exports: content 5/5, structure 198/198 nodes and
280/280 connections. `check-all` is 0. **Cleaned** (⚠ ONAY of this brief): the two pre-put snapshots, the parity mirror
and the previous dashboard build were deleted on literal paths, and their absence was read back. The dashboard still
answers 200 and the unit is active.

**Found and fixed during R4:**
1. **The replay harness pinned Luxon but not the plain JS `Date`.** Five nodes read `Date.now()`, so three tests (a
   number that grew through the day) went red on 2026-11-04, the day their fixed booking day arrived (`c1b3a37`).
2. **The host-leak guard without `CLAUDE.local.md`** (R1's new item). It refuses with exit 2 and its reason. With the
   counter fixed alone, it printed "clean — 1 target" over a subset of the declared targets, which a mutant measured. It
   works from the work-tree root wherever it is started. `host-leak-local-file` covers it with 6 cases, and the
   c51497a guard is the control (`5b0f7a6`, `b05db37`).

### Definition of Done — CLOSE-OUT
| Item | Status | Evidence |
|---|---|---|
| Built | ✅ | R1 (G1, M1–M3, P1/P2, S1/S2, D1/D2, docs), live since R3, promoted at `d9f770a` |
| Tested (happy + key edge) | ✅ | the suites and mutants in R1–R2; Codex two passes; the owner's live run read back (above) |
| Cleaned | ✅ | `n8n/staged/` empty; snapshots, mirror and the old dashboard build deleted, absence read back |
| Sanitized (secrets and PII) | ✅ | `security-auditor` GO before every push of the phase; synthetic names only |
| README / case-study | ✅ | README D1/D2 (`86893c0`); the case study is unchanged by this phase's behaviour, and its §13 still holds |
| Pushed | ✅ | origin/main = the records commit of this round |
| Resume-point memory written AND read back | ✅ | the progress memory, read back in this round |

**The phase is NOT closed.** The A rows are closed and the B rows are written. **The C rows are the owner's** (§6, and the
steps handed over at the end of this round): C-1 GitHub About, C-2 the Vercel token, C-3 #17's rotations, C-4 Access
sessions, C-5 the tunnel credential, C-6 Airtable, the Loom (DC-9) and the README screenshot (DC-10). The phase closes
when each of them is done, or explicitly declined by Yigitcan.

## C-1 and C-2 — done (2026-11-04)

*(The read-backs and the probe below are CC's, terminal-measured, output not committed.)*

- **C-1, the GitHub About fields:** set by Cowork in the owner's browser. CC read them back from the public API
  (unauthenticated). The homepage equals `https://barber-demo.<apex>` (compared, not printed), the description equals the
  README's first sentence, and the topics are exactly the seven.
- **C-2, the Vercel token:** revoked by Yigitcan in the dashboard. CC's read-only probe (`GET` the demo project) answered
  200 on 2026-11-03 and **403** after the revocation. Only then was `~/.vercel-demo.env` deleted on its literal path
  (⚠ ONAY), and its absence read back. A count over the session's scratchpad found no token value; the only match is the
  variable name in the probe's own parser.
- **Consequence, recorded in RUNBOOK §8:** the shell pause path and this machine's deploy route are closed. A new
  deployment needs a new token from the owner.
- **The phase stayed OPEN** on C-3…C-6, the Loom and the README screenshot; C-3 was then declined (next section).

## C-3 declined by decision; C-4 and C-5 kept open (2026-11-04)

**Ruling (Yigitcan, 2026-11-04):** C-3, #17's three rotations, is **declined for now, closed by decision**:
- 17d, the n8n API key;
- 17b, the `/api` Access service token;
- 17c, the owner-path Access service token.

- **His reasons:**
  - The 2026-09-13 exposure was CC's own transcript, on the same server that holds the env files. Against the realistic
    threat, rotation adds little: access to that server yields the env files directly.
  - The `/api` path needs both the API key and the Access token.
  - Turnstile, the spend cap and the pause bound the worst case.
- **Trigger:** before the first real client, or before anyone else gets access to the server.
- **Steps when it fires:** §6 C-3, unchanged, in the order the ruling names (17d → 17b → 17c). For each one: the new
  value goes into a new 0600 file → CC checks the old one and the new one → the owner revokes the old one → CC checks
  again → the rename, under ⚠ ONAY.

**The same rule, applied to C-4 and C-5 as the ruling asks.** Neither closes, because each §6 row carries a risk the
reasoning does not reach:

- **C-5, the tunnel credential (OPS-6) — stays OPEN.**
  - It is not a rotation. OPS-6 already ruled out rotating it (2026-10-19); the step is a move into a root-only file.
  - The reasoning's first premise is that server access yields the env files anyway. C-5 is the one step that changes
    what the build user's access yields. OPS-6 measured the credential as readable more widely than intended,
    including by the account the agent runs as; after the move, that account cannot read it. "It is on the server
    anyway" is the condition C-5 removes, not a reason against it. The global rule says the same: an agent never
    holds a production credential.
  - The worst-case bounds do not reach it either. Turnstile, the spend cap and the pause limit the bot's cost. A
    tunnel credential lets its holder run a connector for the tunnel that serves this deployment's hostnames
    (Cloudflare's documented behaviour, not measured here).
  - **Also found:** the root commands §6 says "CC writes in R1" were never written. CC hands them over in the
    conversation when the owner schedules C-5. Per OPS-6 they do not go into the repo before the fix lands.
- **C-4, the Access sessions — stays OPEN, for its second half.**
  - *The revocation half fits the reasoning.* The session material CC exposed sat on this server, in Owner Actions'
    stored executions. Those were deleted (PHASE-7-PLAN T-4: 91 → 0), and the live sessions run to their configured
    expiry.
  - *The duration half does not.* The dashboard's 730 h session lives in the owner's browser, on his devices, not on
    the server. Whoever holds such a device holds the dashboard for up to a month: customer names and messages, and
    the release write. Turnstile, the spend cap and the pause do not bound the dashboard.
  - CC's recommendation, for his ruling: set the 24 h duration (one field, §6 C-4), and decline the revocation by the
    same reasoning.

**Found while reading row 42: X1 is not done.**
- Row 42 is C + A. Its A half, X1, is CC's under ⚠ ONAY (§4): deny rules for the secret-file copies.
- It is recorded as done nowhere: not in R1–R4, and not in §9's criterion 1.
- The user-level settings, read 2026-11-04, hold a deny rule for one secret file outside the repo. Which other copies
  exist, and whether they are covered, was not measured, because the step was never run.
- Within CLOSE-OUT it was missed, not ruled: 7-4 B recorded the deny rules as deferred by the owner (PHASE-7-PLAN §4j
  #5), this plan took X1 in as CC's A item, and it was not run. Not yet counted when X1 is done: the committed project
  settings already deny one secret file and its backup patterns (MIGRATION-PLAN). The deny layer guards against CC's own accidental reads, the channel of the 2026-09-13
  exposure, so the ruling's reasoning does not argue against it.
- It stays OPEN as CC's, waiting for his ⚠ ONAY or a written decline.

**Left open in the phase, each with its next step:**

| Item | Owner | Next step | Check |
|---|---|---|---|
| C-4 (duration) | Yigitcan | Zero Trust → Access → Applications → the dashboard application → session duration **24 hours**; rule on the revocation half | CC: an unauthenticated request still gets `302`; the duration is an operator statement unless a read-only token can read the application |
| C-5 | Yigitcan, with CC's commands | CC writes the root commands in the conversation → he runs them as root | CC: the tunnel still answers, and the file is not readable by the build user |
| C-6 Airtable | Yigitcan | the Gate 1 export (MIGRATION §7a) → revoke the tokens → delete the base | CC: a call with the old token is refused; the token's name line then leaves the dashboard env under ⚠ ONAY |
| X1 | CC | his ⚠ ONAY, or a written decline | each deny rule measured from a sub-agent (§4) |
| The Loom (DC-9, #20) | Yigitcan | his decision on the approach, or a written decline or deferral | — |
| The README screenshot (DC-10) | Yigitcan | one screenshot in his browser: the chat panel only, cropped, no address bar | CC checks it for a hostname, then commits it |
| The three agent worktrees and their branches under `.claude/worktrees` | CC | removed under ⚠ ONAY at the phase close | `git worktree list` shows the main tree only |
