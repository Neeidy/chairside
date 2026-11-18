#!/usr/bin/env bash
# spend-meter.test.sh — HARDENING SPEND (docs/hardening/PLAN.md WU-5): the meter on a real Postgres. Main's Read Spend and
# Record LLM Spend SQL are read from an export and run VERBATIM as salon_app on 001+002+003; Eval Spend and Build Spend
# Record run VERBATIM in node (tests/db/spend-nodes.cjs), and $2 is what the export's own queryReplacement passes.
# Each n8n Postgres node is its own autocommit statement in its own pool checkout, so two turns are modelled as separate
# psql invocations interleaved at statement level: no BEGIN spans a read and a write (none does in Main).
# Two suites: STAGED (the edit, must pass everything) and COMMITTED (HEAD's export, the control: must FAIL S1–S4, i.e.
# the defect reproduces), plus the increment under true concurrency. Exit 0 only when both hold.
# Not in check-all: it needs Docker. Run: bash tests/db/spend-meter.test.sh [IMAGE]
# The container is throwaway: labelled, no network, local-socket trust auth, removed with its volume on exit.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NODES="node $ROOT/tests/db/spend-nodes.cjs"
IMAGE="${1:-$(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | awk '$1 ~ /^postgres:/ {print $2; exit}')}"
[ -n "$IMAGE" ] || { echo "spend-meter: no local postgres image (pass one as \$1)"; exit 2; }
STAGED="$ROOT/n8n/staged/workflow.main.sanitized.json"; [ -f "$STAGED" ] || STAGED="$ROOT/n8n/workflow.main.sanitized.json"

CID="$(docker run -d --label c72=pgtest-spend --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=salon \
  -v "$ROOT/db/schema:/schema:ro" "$IMAGE")"
trap 'docker rm -f -v "$CID" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
for _ in $(seq 1 60); do docker exec "$CID" pg_isready -U postgres -d salon >/dev/null 2>&1 && break; sleep 0.5; done
read -r SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD < <(python3 -c 'import secrets; print(*(secrets.token_hex(16) for _ in range(3)))')
export SALON_MIGRATOR_PASSWORD SALON_APP_PASSWORD SALON_RO_PASSWORD
docker exec -i -e SALON_MIGRATOR_PASSWORD -e SALON_APP_PASSWORD -e SALON_RO_PASSWORD "$CID" \
  sh -c 'cat /schema/001_init.sql /schema/002_roles.sql /schema/003_revoke_large_object_writes.sql | psql -q -v ON_ERROR_STOP=1 -U postgres -d salon' >/dev/null \
  || { echo "schema apply failed"; exit 2; }

app() { docker exec -i "$CID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U salon_app -d salon "$@"; }
su()  { docker exec -i "$CID" psql -X -q -t -A -v ON_ERROR_STOP=1 -U postgres -d salon "$@"; }

export SPEND_EXPORT="$STAGED"
H="$NODES"
READ_Q="$($H sql 'Read Spend')"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; RES["$V:${1%% *}"]=ok; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; RES["$V:${1%% *}"]=bad; }
declare -A RES; V=setup

PERIOD=2030-01
exp() { [ "$1" = COMMITTED ] && echo HEAD || echo "$STAGED"; }
# read_turn → prints Eval Spend's _spend JSON for what Read Spend returns now (Read Spend output item → Eval Spend jsCode)
read_turn() {
  local row item
  row="$(printf "PREPARE r AS %s;\nEXECUTE r('%s');\n" "$READ_Q" "$PERIOD" | app -F $'\t')"
  item="$(python3 -c 'import json,sys
l=[x for x in sys.argv[1].splitlines() if x]
if not l: print("{}")
else:
  i,c,f=l[-1].split("\t"); print(json.dumps({"id":i,"createdTime":c,"fields":json.loads(f)}))' "$row")"
  $H eval "$item"
}
# write_turn <variant> <_spend JSON> <in> <out> → runs Build Spend Record then Record LLM Spend; prints the RETURNING cost
write_turn() {   # <suite> … — the suite's export decides the SQL AND $2
  local rec q p2 rp
  rec="$(SPEND_EXPORT="$(exp "$1")" $H record "$2" "$3" "$4")"
  q="$(SPEND_EXPORT="$(exp "$1")" $H sql 'Record LLM Spend')"
  p2="$(SPEND_EXPORT="$(exp "$1")" $H param2 "$rec")"
  rp="$(python3 -c 'import json,sys; r=json.loads(sys.argv[1]); print(r["period_key"], r["updated_at"])' "$rec")"
  set -- $rp
  printf "PREPARE w AS %s;\nEXECUTE w('%s', %s, '%s');\n" "$q" "$1" "$p2" "$2" | app -F $'\t' | tail -1 \
    | python3 -c 'import json,sys; print(json.loads(sys.stdin.read().split("\t")[2])["cost_usd"])'
}
delta() { $H record '{"prev":0}' "$1" "$2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["_delta"])'; }
meter() { su -c "SELECT COALESCE((SELECT cost_usd FROM salon.bot_metrics WHERE period_key='$PERIOD')::text,'NO-ROW')"; }
reset() { su -c "DELETE FROM salon.bot_metrics" >/dev/null; [ -z "${1:-}" ] || su -c "INSERT INTO salon.bot_metrics (period_key, cost_usd, updated_at) VALUES ('$PERIOD', $1, now())" >/dev/null; }
eq() { python3 -c 'import sys; sys.exit(0 if abs(float(sys.argv[1])-float(sys.argv[2]))<1e-9 else 1)' "$1" "$2"; }
add() { python3 -c 'import sys; print(round(sum(map(float,sys.argv[1:])),6))' "$@"; }

DA="$(delta 400 50)"; DB="$(delta 1000 200)"   # A: a small turn; B: a larger one
echo "deltas from Build Spend Record (config prices): A=$DA B=$DB; cap from Load Config via Eval Spend: $(read_turn | python3 -c 'import json,sys; print(json.load(sys.stdin)["cap"])')"

declare -A FAILS
for V in STAGED COMMITTED; do
  F0=$FAIL
  echo "== suite $V"
  # P0 positive control: sequential turns (read, write, read, write) → the exact sum
  reset 1.0
  s="$(read_turn)"; write_turn $V "$s" 400 50 >/dev/null
  s="$(read_turn)"; write_turn $V "$s" 1000 200 >/dev/null
  m="$(meter)"; want="$(add 1.0 "$DA" "$DB")"
  eq "$m" "$want" && ok "P0 sequential: meter $m = 1.0 + A + B ($want)" || bad "P0 sequential: meter $m, want $want"

  # S1 lost update: both turns read the same prev, then both write
  reset 1.0
  sA="$(read_turn)"; sB="$(read_turn)"
  rA="$(write_turn $V "$sA" 400 50)"; rB="$(write_turn $V "$sB" 1000 200)"
  m="$(meter)"; want="$(add 1.0 "$DA" "$DB")"
  eq "$m" "$want" && ok "S1 interleaved A-read B-read A-write B-write: meter $m = sum $want" \
    || bad "S1 interleaved: A read prev=$(echo "$sA" | python3 -c 'import json,sys;print(json.load(sys.stdin)["prev"])'), B read the same; A wrote $rA, B wrote $rB → meter $m, want $want (lost $(python3 -c "print(round($want-$m,6))"))"

  # S2 no row this month: both read no row (prev 0), both write
  reset
  sA="$(read_turn)"; sB="$(read_turn)"
  write_turn $V "$sA" 400 50 >/dev/null; write_turn $V "$sB" 1000 200 >/dev/null
  m="$(meter)"; want="$(add "$DA" "$DB")"
  eq "$m" "$want" && ok "S2 first-of-month pair (both read no_row): meter $m = sum $want" || bad "S2 first-of-month pair: meter $m, want $want"

  # S3 a late writer LOWERS the meter and the brake RE-OPENS
  reset 9.999
  sA="$(read_turn)"                                    # A passes the gate at 9.999 and its LLM call is slow
  sB="$(read_turn)"; write_turn $V "$sB" 1000 200 >/dev/null
  gC="$(read_turn)"                                    # C: the gate after B — over the cap
  write_turn $V "$sA" 400 50 >/dev/null                # A's late write
  gD="$(read_turn)"                                    # D: the gate after A's late write
  m="$(meter)"
  uC="$(echo "$gC" | python3 -c 'import json,sys;print(json.load(sys.stdin)["under"])')"
  uD="$(echo "$gD" | python3 -c 'import json,sys;print(json.load(sys.stdin)["under"])')"
  pC="$(echo "$gC" | python3 -c 'import json,sys;print(json.load(sys.stdin)["prev"])')"
  [ "$uC" = False ] && [ "$uD" = False ] && ok "S3 late writer: gate after B under=$uC (prev $pC), after A's late write under=$uD (meter $m): stays closed" \
    || bad "S3 late writer: gate after B under=$uC (prev $pC) → A's late write sets meter $m → next gate under=$uD (brake RE-OPENED)"

  # S4 K-wide waves: K turns read, then K write; R waves. Meter vs true spend.
  K=5; R=8; reset
  for _ in $(seq 1 $R); do
    ss=(); for _k in $(seq 1 $K); do ss+=("$(read_turn)"); done
    for sk in "${ss[@]}"; do write_turn $V "$sk" 1500 150 >/dev/null; done
  done
  d="$(delta 1500 150)"; m="$(meter)"; tru="$(python3 -c "print(round($K*$R*$d,6))")"
  eq "$m" "$tru" && ok "S4 K=$K R=$R waves: meter $m = true $tru" \
    || bad "S4 K=$K R=$R waves: meter $m vs true spend $tru (true/meter = $(python3 -c "print(round($tru/$m,2))"))"
  FAILS[$V]=$((FAIL-F0))
done

FIX_Q="$($H sql 'Record LLM Spend')"
echo "== STAGED under TRUE concurrency (two sessions, each holds its upsert open 2 s)"
reset 1.0
recA="$($H record '{"prev":0}' 400 50)"; recB="$($H record '{"prev":0}' 1000 200)"
( printf "PREPARE w AS %s;\nBEGIN;\nEXECUTE w('%s', %s, '2030-01-15T12:00:00.000Z');\nSELECT pg_sleep(2);\nCOMMIT;\n" "$FIX_Q" "$PERIOD" "$DA" | app >/dev/null ) &
bp=$!; sleep 0.5
t0=$(date +%s.%N)
printf "PREPARE w AS %s;\nEXECUTE w('%s', %s, '2030-01-15T12:00:00.000Z');\n" "$FIX_Q" "$PERIOD" "$DB" | app >/dev/null
t1=$(date +%s.%N); wait $bp
m="$(meter)"; want="$(add 1.0 "$DA" "$DB")"
eq "$m" "$want" && ok "FIX concurrent: meter $m = sum $want; second session waited $(python3 -c "print(round($t1-$t0,1))") s on the row lock" || bad "FIX concurrent: meter $m, want $want"
reset
( printf "PREPARE w AS %s;\nBEGIN;\nEXECUTE w('%s', %s, '2030-01-15T12:00:00.000Z');\nSELECT pg_sleep(2);\nCOMMIT;\n" "$FIX_Q" "$PERIOD" "$DA" | app >/dev/null ) &
bp=$!; sleep 0.5
printf "PREPARE w AS %s;\nEXECUTE w('%s', %s, '2030-01-15T12:00:00.000Z');\n" "$FIX_Q" "$PERIOD" "$DB" | app >/dev/null; wait $bp
m="$(meter)"; want="$(add "$DA" "$DB")"
eq "$m" "$want" && ok "FIX concurrent first-of-month INSERTs: meter $m = sum $want (ON CONFLICT waits, then updates)" || bad "FIX concurrent first insert: meter $m, want $want"

echo "STAGED failures: ${FAILS[STAGED]} (must be 0) · COMMITTED failures: ${FAILS[COMMITTED]} (the control: must be > 0)"
# The control is SPECIFIC (code-reviewer MEDIUM-5): on the committed export P0 (sequential) passes and each of S1–S4
# fails — so the suite measured the race, not a broken harness.
ctl=ok; [ "${RES[COMMITTED:P0]:-}" = ok ] || ctl=bad
for k in S1 S2 S3 S4; do [ "${RES[COMMITTED:$k]:-}" = bad ] || ctl=bad; done
echo "control: COMMITTED P0=${RES[COMMITTED:P0]:-?} S1=${RES[COMMITTED:S1]:-?} S2=${RES[COMMITTED:S2]:-?} S3=${RES[COMMITTED:S3]:-?} S4=${RES[COMMITTED:S4]:-?} → $ctl"
[ "${FAILS[STAGED]}" -eq 0 ] && [ "$ctl" = ok ] && [ "$((FAIL - FAILS[STAGED] - FAILS[COMMITTED]))" -eq 0 ] && { echo "spend-meter: OK"; exit 0; }
echo "spend-meter: FAILED"; exit 1
