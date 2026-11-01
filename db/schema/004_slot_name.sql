-- 004_slot_name.sql — the customer's name, kept across the turns of a booking (docs/NAME-CAPTURE-PLAN.md 3.2; ruling 4
-- of the RENAME brief and decisions D-2/D-5, Yigitcan 2026-11-01). The plan named this file 003_…; 003 was already
-- taken (003_revoke_large_object_writes.sql), so it is 004.
--
-- WHY: a booking must carry the name the customer gave. Main asks for it as the fourth slot and must keep it between
-- the turn that answers the ask and the turn that says "yes" — the conversation row is where the other three slots
-- live (slot_service, slot_date, slot_time), so the name lives beside them.
--
-- WHAT: one nullable text column on salon.conversations. No default, no constraint, no index: an empty name is NULL
-- (Save State sends NULL, never ''), nothing filters or joins on it.
-- PII: like recent_messages, it is customer text. The Purge workflow empties it TOGETHER with recent_messages after
-- 30 days (D-2), so a conversation record never keeps a name longer than the messages it came from.
-- PRIVILEGES: salon_app and salon_ro hold table-level privileges (002_roles.sql: SELECT/INSERT/UPDATE/DELETE and
-- SELECT ON ALL TABLES IN SCHEMA salon), and a table-level privilege covers every column, a new one included —
-- nothing to grant. The file checks that rather than assuming it.
--
-- HOW: applied ONCE by the owner (D-5: CC holds the read-only role only), as salon_migrator (or the bootstrap
-- superuser), inside the Postgres container, on STDIN, connected to database `salon`. The DDL runs under
-- SET ROLE salon_owner, as 002 requires (an object altered by the migrator itself would sit outside the owner's
-- default privileges). Dry run first (this file with its final COMMIT turned into ROLLBACK), then for real.
-- Idempotent: a second run adds nothing and passes the check.
-- ORDER (R3): BEFORE the Main put. After the put, both Save States write slot_name; with no column every turn's state
-- write would fail. Undo, only while the committed (pre-NAME-CAPTURE) Main is the live one:
--   ALTER TABLE salon.conversations DROP COLUMN slot_name;

\set ON_ERROR_STOP on
\set VERBOSITY terse

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'salon' THEN
    RAISE EXCEPTION '004: connected to database %, not salon — nothing changed', current_database();
  END IF;
END $$;

SET LOCAL ROLE salon_owner;

ALTER TABLE salon.conversations ADD COLUMN IF NOT EXISTS slot_name text;

-- The check runs inside the same transaction: the column must be a nullable text column with no default, and both
-- runtime roles must be able to use it as the workflows do (app: read and write it; ro: read it). Otherwise the whole
-- file rolls back and says which.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'salon' AND table_name = 'conversations' AND column_name = 'slot_name'
                   AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL) THEN
    RAISE EXCEPTION '004: salon.conversations.slot_name is not a nullable text column without a default — rolled back';
  END IF;
  IF NOT (has_column_privilege('salon_app', 'salon.conversations', 'slot_name', 'SELECT')
          AND has_column_privilege('salon_app', 'salon.conversations', 'slot_name', 'INSERT')
          AND has_column_privilege('salon_app', 'salon.conversations', 'slot_name', 'UPDATE')) THEN
    RAISE EXCEPTION '004: salon_app cannot read and write slot_name — rolled back';
  END IF;
  IF NOT has_column_privilege('salon_ro', 'salon.conversations', 'slot_name', 'SELECT') THEN
    RAISE EXCEPTION '004: salon_ro cannot read slot_name — rolled back';
  END IF;
  IF has_column_privilege('salon_ro', 'salon.conversations', 'slot_name', 'UPDATE')
     OR has_column_privilege('salon_ro', 'salon.conversations', 'slot_name', 'INSERT') THEN
    RAISE EXCEPTION '004: salon_ro can write slot_name — rolled back';
  END IF;
END $$;

COMMIT;
