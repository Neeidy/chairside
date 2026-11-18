#!/usr/bin/env bash
# HARDENING (flow-reviewer M2): the staged Main's new and changed IF / Switch nodes — Empty Message?, Route Consent,
# Booking Declined?, Abort Cancel?, Abort Reschedule?, Booking Fresh?, Reschedule Fresh? — run with their parameters
# VERBATIM in a scratch n8n of the live version, because the replay harness only EMULATES conditions (an undefined value
# under strict type validation is the H4 class). 23 cases, each a branch the node must take.
# Throwaway container: no network, labelled, removed with its volume by id. Not in check-all (Docker).
# Run: bash tests/n8n-runtime/hardening-shapes/run.sh 2.46.6
set -u
TAG="${1:?usage: run.sh <n8n image tag, e.g. 2.46.6>}"; H="$(cd "$(dirname "$0")" && pwd)"
W="$(mktemp -d)" && [ -n "$W" ] && [ -d "$W" ] || { echo "no temp dir"; exit 2; }
python3 -I "$H/gen.py" "$W" >/dev/null || exit 1
CID=$(docker run -d --label c72=hardening-shapes --network none -v "$W":/work:ro \
  -e N8N_DIAGNOSTICS_ENABLED=false -e N8N_PERSONALIZATION_ENABLED=false --entrypoint sh "n8nio/n8n:$TAG" -c \
  'n8n import:workflow --input=/work/wf.json && n8n publish:workflow --id=hdShapesWf000001; exec n8n start')
trap 'docker rm -f -v "$CID" >/dev/null; rm -f -- "$W/wf.json"; rmdir -- "$W"' EXIT
for _ in $(seq 1 90); do docker logs "$CID" 2>&1 | grep -qi "Editor is now accessible" && break; sleep 2; done; sleep 3
echo "n8n $(docker exec "$CID" n8n --version 2>/dev/null)"
docker cp "$H/probe.js" "$CID":/tmp/probe.js >/dev/null
out="$(docker exec "$CID" node /tmp/probe.js)"; echo "$out"
[[ "$out" == *"shapes: OK"* ]]
