#!/usr/bin/env bash
# slot-name.test.sh — NAME-CAPTURE R1 (docs/NAME-CAPTURE-PLAN.md 3.2, 3.5, D-2): the claims a unit test cannot make,
# measured on a real Postgres with 001+002+003 applied to an empty database.
#   M  004_slot_name.sql, run as salon_migrator (its SET ROLE salon_owner path): the dry run (COMMIT → ROLLBACK) leaves
#      no column; the real run adds a nullable text column; a second run passes (idempotent); salon_ro cannot write it.
#   S  the STAGED Save State and Load State SQL, run verbatim as salon_app: a name is written as $14 and read back in
#      `fields.slot_name`; NULL clears it; the conflict update carries it.
#   W  the STAGED Write Appointment upsert: a re-write with NULL or '' never blanks a stored customer_name; a new name
#      replaces it. Mutant: the COMMITTED upsert (customer_name = EXCLUDED.customer_name) must blank it — or this
#      check measures nothing.
#   P  the STAGED Purge: a 31-day-old row whose messages were already erased but whose name is set is FOUND, the
#      scrub empties both, and takes the name out of the stored confirm question (Codex R1 M2). Mutant: the COMMITTED
#      Purge does not find it.
# Not in check-all: it needs Docker. Run: bash tests/db/slot-name.test.sh [IMAGE]
# The container is throwaway: labelled, no network, local-socket `trust` auth, removed on exit. The role passwords 002
# requires are generated at run time and passed by name; nothing connects over a network. Synthetic names only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${1:-${SLOT_NAME_IMAGE:-}}"
if [ -z "$IMAGE" ]; then
  IMAGE="$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '$1 ~ /^postgres:/ {print $2; exit}')"
fi
[ -n "$IMAGE" ] || { echo "slot-name: no local postgres image (pass one as \$1)"; exit 2; }
pick() { if [ -f "$ROOT/n8n/staged/workflow.$1.sanitized.json" ]; then echo "$ROOT/n8n/staged/workflow.$1.sanitized.json"; else echo "$ROOT/n8n/workflow.$1.sanitized.json"; fi; }
MAIN="$(pick main)"; PURGE="$(pick purge)"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }

CID="$(docker run -d --rm --label c72=pgtest-slotname --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=salon \
  -v "$ROOT/db/schema:/schema:ro" "$IMAGE")"
trap 'docker rm -f "$CID" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1   # the image restarts the server once after its init scripts
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done

read -r SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD < <(python3 -c 'import secrets; print(*(secrets.token_hex(16) for _ in range(3)))')
export SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD
docker exec -i -e SALON_MIGRATOR_PASSWORD -e SALON_APP_PASSWORD -e SALON_RO_PASSWORD "$CID" \
  sh -c 'cat /schema/001_init.sql /schema/002_roles.sql /schema/003_revoke_large_object_writes.sql | psql -q -v ON_ERROR_STOP=1 -U postgres -d salon' >/dev/null

as() { local u=$1; shift; docker exec -i "$CID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$u" -d salon "$@"; }
su() { as postgres "$@"; }
col() { su -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='salon' AND table_name='conversations' AND column_name='slot_name' AND data_type='text' AND is_nullable='YES'"; }
q() { python3 - "$1" "$2" <<'EOF'
import json, sys
w = json.load(open(sys.argv[1], encoding='utf-8'))
print(next(n for n in w['nodes'] if n['name'] == sys.argv[2])['parameters']['query'])
EOF
}

# ── M: the migration ──
check 'M0: no slot_name before 004' "$(col)" 0
sed 's/^COMMIT;$/ROLLBACK;/' "$ROOT/db/schema/004_slot_name.sql" | as salon_migrator >/dev/null
check 'M1: the dry run (COMMIT → ROLLBACK), as salon_migrator, leaves no column' "$(col)" 0
as salon_migrator < "$ROOT/db/schema/004_slot_name.sql" >/dev/null
check 'M2: the real run adds a nullable text column' "$(col)" 1
if as salon_migrator < "$ROOT/db/schema/004_slot_name.sql" >/dev/null 2>&1; then ok 'M3: a second run passes (idempotent)'; else bad 'M3: a second run failed'; fi
check 'M4: the column is owned with its table (salon_owner)' "$(su -c "SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'salon.conversations'::regclass")" salon_owner
if as salon_ro -c "UPDATE salon.conversations SET slot_name = 'x'" >/dev/null 2>&1; then bad 'M5: salon_ro could write slot_name'; else ok 'M5: salon_ro cannot write slot_name'; fi

# ── S: Save State / Load State, staged SQL verbatim, as salon_app ──
SAVE_Q="$(q "$MAIN" 'Save State')"; LOAD_Q="$(q "$MAIN" 'Load State')"
save() {   # sender, name (SQL literal: NULL or 'text')
  as salon_app -c "PREPARE s(text,text,int,timestamptz,text,text,text,text,text,text,text,text,text,text) AS $SAVE_Q;" \
    -c "EXECUTE s('$1','collecting',1,now(),'book','haircut','2030-01-07','10:00','','','','','hi',$2);" >/dev/null
}
load() { as salon_app -c "PREPARE l(text) AS $LOAD_Q;" -c "EXECUTE l('$1');" | python3 -c 'import sys,json; r=sys.stdin.read().strip().split("|"); print(json.loads(r[-1]).get("slot_name","<absent>"))'; }
save 'widget:w-fake-sn1' "'Çağla Ünal'"
check 'S1: Save State writes the name ($14) and Load State reads it back in fields.slot_name' "$(load 'widget:w-fake-sn1')" 'Çağla Ünal'
save 'widget:w-fake-sn1' "'Müller'"
check 'S2: the conflict update carries a new name' "$(load 'widget:w-fake-sn1')" 'Müller'
save 'widget:w-fake-sn1' 'NULL'
check 'S3: NULL clears it (jsonb_strip_nulls omits the field)' "$(load 'widget:w-fake-sn1')" '<absent>'

# ── W: Write Appointment's upsert ──
upsert() {   # query, name literal
  as salon_app -c "PREPARE w(text,text,timestamptz,timestamptz,text,text,text,timestamptz,text) AS $1;" \
    -c "EXECUTE w('widget:w-fake-sn2','Haircut','2030-01-07T09:00:00Z','2030-01-07T09:30:00Z','abcdefghij','widget',$2,now(),'cal');" >/dev/null
}
name_of() { su -c "SELECT coalesce(customer_name, '<null>') FROM salon.appointments WHERE gcal_event_id = 'abcdefghij'"; }
WA_Q="$(q "$MAIN" 'Write Appointment')"
upsert "$WA_Q" "'Stored'"
check 'W1: the first write stores the name' "$(name_of)" 'Stored'
upsert "$WA_Q" 'NULL'
check 'W2: a re-write with NULL keeps the stored name' "$(name_of)" 'Stored'
upsert "$WA_Q" "''"
check "W3: a re-write with '' keeps the stored name" "$(name_of)" 'Stored'
upsert "$WA_Q" "'Newer'"
check 'W4: a re-write with a name replaces it' "$(name_of)" 'Newer'
OLD_WA_Q="$(q "$ROOT/n8n/workflow.main.sanitized.json" 'Write Appointment')"
upsert "$OLD_WA_Q" "''"
check "W-mutant: the COMMITTED upsert blanks it (the check above can go red)" "$(name_of)" ''

# ── P: Purge ──
su -c "INSERT INTO salon.conversations (sender_key, stage, recent_messages, slot_name, computed_reply, last_updated) VALUES ('widget:w-fake-sn3','confirming','', 'Oldname', 'Haircut, Monday 7 Jan 11:00 for Oldname — shall I book it? (yes / no)', now() - interval '31 days')" >/dev/null
FIND_Q="$(q "$PURGE" 'Find Stale Conversations')"; SCRUB_Q="$(q "$PURGE" 'Scrub Recent Messages')"
found() { as salon_app -c "PREPARE f(timestamptz) AS $1;" -c "EXECUTE f(now() - interval '30 days');" | wc -l; }
check 'P1: a 31-day-old row with erased messages but a name set is found' "$(found "$FIND_Q")" 1
ID="$(su -c "SELECT id FROM salon.conversations WHERE sender_key = 'widget:w-fake-sn3'")"
as salon_app -c "PREPARE x(text) AS $SCRUB_Q;" -c "EXECUTE x('$ID');" >/dev/null
check 'P2: the scrub empties the name with the messages' "$(su -c "SELECT coalesce(slot_name,'<null>') || '|' || recent_messages FROM salon.conversations WHERE id = '$ID'")" '<null>|'
check 'P3: …and takes the name out of the stored confirm question, keeping the reply (Codex R1 M2)' \
  "$(su -c "SELECT computed_reply FROM salon.conversations WHERE id = '$ID'")" 'Haircut, Monday 7 Jan 11:00 for … — shall I book it? (yes / no)'
su -c "UPDATE salon.conversations SET slot_name = 'Oldname' WHERE id = '$ID'" >/dev/null
check 'P-mutant: the COMMITTED Purge does not find that row (the check above can go red)' "$(found "$(q "$ROOT/n8n/workflow.purge.sanitized.json" 'Find Stale Conversations')")" 0

echo "slot-name: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
