#!/usr/bin/env bash
# HARDENING RM-2101 (Bulgu 7) — the double-insert guard's edge cases, headless, token-free (remote-operator.md: a
# drill that needs no Turnstile token is Claude's to run). Four host pages around the BUILT bundle:
#   two    — two script tags                         → one widget, with the id
#   clash  — the page already uses #barber-widget-root → our widget mounts WITHOUT the id, the page's element untouched
#   half   — a leftover data-barber-widget="mounting" → removed, mounted again (one widget)
#   done   — data-barber-widget="mounted" already     → nothing new mounts
# Needs: the built bundle (web/site/public/barber-widget.js) and the cached Chromium. Not in check-all.
# Run: bash tests/snippet/double-insert.drill.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JS="$ROOT/web/site/public/barber-widget.js"; [ -s "$JS" ] || { echo "no bundle: run npm run build -w @salon/snippet"; exit 2; }
BIN="$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome 2>/dev/null | tail -1)"; [ -x "$BIN" ] || { echo "no cached chromium"; exit 2; }
D="$(mktemp -d)" && [ -n "$D" ] && [ -d "$D" ] || { echo "no temp dir"; exit 2; }
trap 'rm -f -- "$D"/two.html "$D"/clash.html "$D"/half.html "$D"/done.html; rmdir -- "$D"' EXIT
REPORT='setTimeout(function(){var n=document.querySelectorAll("[data-barber-widget]"),r=[];n.forEach(function(e){r.push(e.getAttribute("data-barber-widget")+"|id="+e.id+"|shadow="+(!!e.shadowRoot))});var c=document.getElementById("barber-widget-root");document.title="RESULT "+n.length+" "+r.join(",")+" idowner="+(c?(c.getAttribute("data-host")||"ours"):"none");},800);'
mk() { printf '<!doctype html><html><head><meta charset="utf-8"></head><body>%s<script src="file://%s"></script>%s<script>%s</script></body></html>' "$2" "$JS" "$3" "$REPORT" > "$D/$1.html"; }
mk two '' "<script src=\"file://$JS\"></script>"
mk clash '<div id="barber-widget-root" data-host="page">host page element</div>' ''
mk half '<div data-barber-widget="mounting" id="barber-widget-root">leftover</div>' ''
mk done '<div data-barber-widget="mounted" id="barber-widget-root">already</div>' ''
fails=0
for spec in 'two|RESULT 1 mounted|id=barber-widget-root|shadow=true idowner=ours' \
            'clash|RESULT 1 mounted|id=|shadow=true idowner=page' \
            'half|RESULT 1 mounted|id=barber-widget-root|shadow=true idowner=ours' \
            'done|RESULT 1 mounted|id=barber-widget-root|shadow=false idowner=ours'; do
  p="${spec%%|*}"; want="${spec#*|}"
  got="$(timeout 40 "$BIN" --headless --no-sandbox --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 \
        --dump-dom "file://$D/$p.html" 2>/dev/null | grep -o '<title>[^<]*' | sed 's/<title>//')"
  [ "$got" = "$want" ] && echo "✓ $p: $got" || { echo "✗ $p: got '$got', want '$want'"; fails=$((fails+1)); }
done
echo "double-insert drill: $([ $fails -eq 0 ] && echo OK || echo "$fails FAILED")"; [ $fails -eq 0 ]
