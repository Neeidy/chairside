#!/usr/bin/env python3
"""Mutants of shopTime / shopZoneNote (CLOSE-OUT S2, ruling DC-2) in web/shared/src/chat/chatClient.ts. Each breaks ONE
property and must turn web/shared/src/chat/shopTime.test.ts red — a survivor means no test measures that property.
The panels' WIRING (both render sites calling it) is measured by tests/browser/shop-time.drill.mjs instead.
Not in check-all. Run: python3 tests/unit/shop-time-mutants.py        (exit 0 = every mutant killed)
"""
import os
import subprocess
import sys
import tempfile

WT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHARED = os.path.join(WT, 'web/shared')
FMT = "return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone });"
NOTE = "return `Times in shop time (${timeZone.replace(/_/g, ' ')})`;"
MUTANTS = {
    "formats in the browser's zone (the pre-DC-2 behaviour)": (FMT, "return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });"),
    'formats in a hard-coded Vienna, not the config zone': (FMT, "return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' });"),
    'formats in UTC': (FMT, "return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });"),
    'the note names a hard-coded zone': (NOTE, "return 'Times in shop time (Europe/Vienna)';"),
}


def red(src):
    with tempfile.TemporaryDirectory(prefix='shoptime-mut-') as d:
        p = os.path.join(d, 'chatClient.ts')
        open(p, 'w', encoding='utf-8').write(src)
        r = subprocess.run(['node', '--test', 'src/chat/shopTime.test.ts'], cwd=SHARED,
                           env={**os.environ, 'SHOP_TIME_MODULE': p}, capture_output=True, text=True)
        return r.returncode != 0


def main():
    base = open(os.path.join(SHARED, 'src/chat/chatClient.ts'), encoding='utf-8').read()
    survivors = []
    for label, (old, new) in MUTANTS.items():
        assert base.count(old) == 1, label
        killed = red(base.replace(old, new))
        print(f"{'killed  ' if killed else 'SURVIVED'} {label}")
        if not killed:
            survivors.append(label)
    control = not red(base)
    print(f"control (unmutated, same override): {'green' if control else 'RED'}")
    return 0 if control and not survivors else 1


if __name__ == '__main__':
    sys.exit(main())
