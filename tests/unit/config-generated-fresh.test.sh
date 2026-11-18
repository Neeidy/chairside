#!/usr/bin/env bash
# HARDENING RM-2123: web/site/scripts/build-config.mjs --check refuses a missing, hand-edited or stale
# config.generated.json. Runs on a throwaway copy (--out), never the real file. Offline.
# Run: bash tests/unit/config-generated-fresh.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BC="$ROOT/web/site/scripts/build-config.mjs"
D="$(mktemp -d)" && [ -d "$D" ] && [ -n "$D" ] || { echo "no temp dir"; exit 2; }
OUT="$D/config.generated.json"
trap 'rm -f -- "$OUT" "$OUT.bak"; rmdir -- "$D"' EXIT
fails=0; ok() { echo "✓ $1"; }; bad() { echo "✗ $1"; fails=$((fails+1)); }
env -u CLIENT_CONFIG_JSON node "$BC" --check --out "$OUT" >/dev/null 2>&1 && bad "missing file passes --check" || ok "missing file: --check refuses"
env -u CLIENT_CONFIG_JSON node "$BC" --out "$OUT" >/dev/null 2>&1 || bad "the normal run did not write the copy"
env -u CLIENT_CONFIG_JSON node "$BC" --check --out "$OUT" >/dev/null 2>&1 && ok "fresh file: --check passes" || bad "fresh file fails --check"
cp "$OUT" "$OUT.bak"; sed -i 's/"demoMode": true/"demoMode": false/' "$OUT"
cmp -s "$OUT" "$OUT.bak" && bad "instrument: the tamper did not change the file"
env -u CLIENT_CONFIG_JSON node "$BC" --check --out "$OUT" >/dev/null 2>&1 && bad "hand-edited file passes --check" || ok "hand-edited file: --check refuses"
cp "$OUT.bak" "$OUT"; printf ' ' >> "$OUT"
env -u CLIENT_CONFIG_JSON node "$BC" --check --out "$OUT" >/dev/null 2>&1 && bad "a one-byte difference passes --check" || ok "one byte off: --check refuses"
echo "config-generated-fresh: $([ $fails -eq 0 ] && echo OK || echo "$fails FAILED")"; [ $fails -eq 0 ]
