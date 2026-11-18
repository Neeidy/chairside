#!/usr/bin/env bash
# booking-lookup.test.sh — HARDENING F2 (docs/hardening/PLAN.md WU-2, ruling K2): the three booking lookups on a real
# Postgres. `Find Booking`, `Find Booking (Reschedule)` and `Find Old Booking (Reschedule)` are read from the staged Main
# (else the committed one) and run VERBATIM (PREPARE … AS <query>) as salon_app on 001+002+003, with now as $2.
# Rows for one sender: a booking that ended yesterday, one in progress, one tomorrow, a cancelled one, and another
# sender's. Expected: exactly the in-progress and the future one (end_utc > now), in created_at order. The control: the
# committed (HEAD) query returns the past row too — the F2 defect — or the test is not measuring it.
# Not in check-all: it needs Docker. Run: bash tests/db/booking-lookup.test.sh [IMAGE]
# The container is throwaway: labelled, no network, local-socket trust auth, removed with its volume on exit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${1:-$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '$1 ~ /^postgres:/ {print $2; exit}')}"
[ -n "$IMAGE" ] || { echo "booking-lookup: no local postgres image (pass one as \$1)"; exit 2; }
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

CID="$(docker run -d --label c72=pgtest-lookup --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=salon \
  -v "$ROOT/db/schema:/schema:ro" "$IMAGE")"
trap 'docker rm -f -v "$CID" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done
# 002's three role passwords: generated here at run time, never printed, passed to the container by NAME only.
read -r SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD < <(python3 -c 'import secrets; print(*(secrets.token_hex(16) for _ in range(3)))')
export SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD
docker exec -i -e SALON_MIGRATOR_PASSWORD -e SALON_APP_PASSWORD -e SALON_RO_PASSWORD "$CID" \
  sh -c 'cat /schema/001_init.sql /schema/002_roles.sql /schema/003_revoke_large_object_writes.sql | psql -q -v ON_ERROR_STOP=1 -U postgres -d salon' >/dev/null
app() { docker exec -i "$CID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U salon_app -d salon "$@"; }
su()  { docker exec -i "$CID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d salon "$@"; }

q() { python3 - "$1" "$2" <<'PY'
import json, subprocess, sys
src = subprocess.run(['git', '-C', sys.argv[3] if len(sys.argv) > 3 else '.', 'show', 'HEAD:n8n/workflow.main.sanitized.json'],
                     capture_output=True, text=True, check=True).stdout if sys.argv[1] == 'HEAD' else open(sys.argv[1], encoding='utf-8').read()
w = json.loads(src)
print(next(n for n in w['nodes'] if n['name'] == sys.argv[2])['parameters']['query'])
PY
}
STAGED="$ROOT/n8n/staged/workflow.main.sanitized.json"; [ -f "$STAGED" ] || STAGED="$ROOT/n8n/workflow.main.sanitized.json"
S='widget:w-hd-lookup'
su -c "INSERT INTO salon.appointments (id, sender_key, service, start_utc, end_utc, gcal_event_id, calendar_id, status, created_at) VALUES
  ('a-past',     '$S', 'Haircut', now() - interval '1 day',     now() - interval '1 day' + interval '30 minutes', 'gpast00001', 'c', 'booked',    now() - interval '3 days'),
  ('a-progress', '$S', 'Haircut', now() - interval '10 minutes', now() + interval '20 minutes',                   'gprog00001', 'c', 'booked',    now() - interval '2 days'),
  ('a-future',   '$S', 'Haircut', now() + interval '1 day',     now() + interval '1 day' + interval '30 minutes', 'gfutu00001', 'c', 'booked',    now() - interval '1 day'),
  ('a-cancel',   '$S', 'Haircut', now() + interval '2 days',    now() + interval '2 days' + interval '30 minutes', 'gcanc00001', 'c', 'cancelled', now()),
  ('a-other',    'widget:w-hd-other', 'Haircut', now() + interval '1 day', now() + interval '1 day' + interval '30 minutes', 'gothe00001', 'c', 'booked', now())" >/dev/null
NOW="$(su -c "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")"
ids() {   # <export> <node> — the ids the query returns, in order
  local sql; sql="$(q "$1" "$2" "$ROOT")"
  if [[ "$sql" == *'$2'* ]]; then printf "PREPARE l AS %s;\nEXECUTE l('%s', '%s');\n" "$sql" "$S" "$NOW"
  else printf "PREPARE l AS %s;\nEXECUTE l('%s');\n" "$sql" "$S"; fi | app -F $'\t' | cut -f1 | paste -sd, -
}
for N in 'Find Booking' 'Find Booking (Reschedule)' 'Find Old Booking (Reschedule)'; do
  got="$(ids "$STAGED" "$N")"
  [ "$got" = 'a-progress,a-future' ] && ok "$N: only bookings that have not ended, oldest created first ($got)" || bad "$N: got '$got', want 'a-progress,a-future'"
  ctl="$(ids HEAD "$N")"
  [[ "$ctl" == *a-past* ]] && ok "$N control (HEAD): the committed query returns the past row ($ctl) — the F2 defect is what this measures" \
    || bad "$N control (HEAD): '$ctl' has no past row, so this test cannot see F2"
done
echo "booking-lookup: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
