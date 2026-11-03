#!/bin/bash
# start-gates.sh — the start (and end) gates of a live round, committed (CLOSE-OUT G1, ruling 2026-11-03).
# FIRST it refuses inside the Vienna minutes :55–:05 (scripts/vienna-window.py, which reads the clock — no override is
# accepted here); then the dummy-token probe on Main, the exports and live parity, the listener sweep, the host-leak
# guard and the hook-drift check. Prints statuses only. Exit: 3 refused by the window · 1 a gate red · 0 all green.
# Env: N8N_API_KEY and the Access client pair, read from ~/.n8n-api.env; N8N_HOST from CLAUDE.local.md.
cd "$(dirname "$0")/.." || exit 2
python3 scripts/vienna-window.py </dev/null || exit 3
set -a; . ~/.n8n-api.env; set +a
N8N_HOST=$(sed -n 's/^N8N_HOST=[[:space:]]*\([^[:space:]]*\).*/\1/p' CLAUDE.local.md | sed -E "s/^[\"']+//; s/[\"']+\$//"); export N8N_HOST
rc=0
run() { echo "== $1"; shift; "$@" </dev/null 2>&1 | tail -4; [ "${PIPESTATUS[0]}" = 0 ] || rc=1; }
run 'probe Main' python3 scripts/workflow-step.py probe db/copies/main.json GyvhZH79DxC1LpTx
run 'exports parity' bash scripts/check-exports-parity.sh
run 'live parity' python3 scripts/check-live-parity.py
run 'listeners' bash scripts/check-listeners.sh
run 'host leak' bash scripts/check-no-host-leak.sh
run 'hook drift' bash scripts/check-hook-drift.sh
echo "start-gates: $([ $rc = 0 ] && echo 'all green' || echo 'RED')"
exit $rc
