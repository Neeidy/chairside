#!/usr/bin/env python3
"""vienna-window.py — refuse a live round's start inside the Vienna minutes :55–:05 (CLOSE-OUT G1, ruling 2026-11-03).

Why: the hourly jobs run around the full hour (Reminders) and the start gates' probe is a real execution on Main; a
gate run in that band mixes our probe with scheduled traffic and makes the window read ambiguous. The rule was written
in every live brief and broken three times by hand, so it is code now: `scripts/start-gates.sh` calls this first.

Usage:  python3 scripts/vienna-window.py            → exit 0 and "OK …" outside the band; exit 3 and "REFUSED …" inside
        python3 scripts/vienna-window.py --at HH:MM → the same decision for a stated Vienna time (tests only; the gate
                                                       script never passes it, so the live check always reads the clock)
"""
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = 'Europe/Vienna'


def refused(minute):
    """True inside the band: minutes 55–59 and 00–05, both ends included."""
    return minute >= 55 or minute <= 5


def main(argv):
    if len(argv) == 3 and argv[1] == '--at':
        hh, mm = argv[2].split(':')
        hour, minute = int(hh), int(mm)
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            print(f'vienna-window: not a time: {argv[2]}')
            return 2
        label = f'{hour:02d}:{minute:02d} (stated)'
    elif len(argv) == 1:
        now = datetime.now(ZoneInfo(TZ))
        minute, label = now.minute, now.strftime('%H:%M')
    else:
        print('usage: vienna-window.py [--at HH:MM]')
        return 2
    if refused(minute):
        print(f'vienna-window: REFUSED — {label} Vienna is inside :55–:05 (the hourly jobs run around the full hour); '
              f'start the gates after :05')
        return 3
    print(f'vienna-window: OK — {label} Vienna is outside :55–:05')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
