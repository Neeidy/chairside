#!/usr/bin/env python3
"""CLOSE-OUT G1: the start gates refuse inside the Vienna minutes :55–:05, in both directions.

1. scripts/vienna-window.py --at: refuses at :55, :57, :59, :00, :02, :05 (exit 3, says why); runs at :06, :10, :30, :54.
2. scripts/start-gates.sh: the window check is its FIRST command, it reads the clock (no --at), and a refusal exits
   before any probe. Shown by behaviour with a stand-in helper that refuses, in a temporary copy (no network: the
   stand-in exits before the gate script reaches any live command).
Run: python3 tests/unit/start-gates-window.test.py
"""
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HELPER = os.path.join(ROOT, 'scripts', 'vienna-window.py')
GATES = os.path.join(ROOT, 'scripts', 'start-gates.sh')
ok = True


def case(label, good, detail=''):
    global ok
    ok &= bool(good)
    print(f"{'✓' if good else '✗'} {label}" + ('' if good else f' — {detail}'))


def at(t):
    r = subprocess.run([sys.executable, HELPER, '--at', t], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return r.returncode, r.stdout


def main():
    for t in ('10:55', '10:57', '10:59', '11:00', '11:02', '11:05'):
        rc, out = at(t)
        case(f'refuses at {t}', rc == 3 and 'REFUSED' in out and ':55–:05' in out, f'rc {rc} {out!r}')
    for t in ('11:06', '11:10', '11:30', '10:54'):
        rc, out = at(t)
        case(f'runs at {t}', rc == 0 and 'OK' in out, f'rc {rc} {out!r}')
    rc, out = at('25:00')
    case('a non-time is refused as usage, not as a pass', rc == 2, f'rc {rc}')

    lines = [l.strip() for l in open(GATES, encoding='utf-8') if l.strip() and not l.lstrip().startswith('#')]
    case('start-gates.sh: the window check is the first command after cd',
         len(lines) > 1 and lines[1] == 'python3 scripts/vienna-window.py </dev/null || exit 3', lines[:2])
    case('start-gates.sh never passes --at', '--at' not in open(GATES, encoding='utf-8').read())

    with tempfile.TemporaryDirectory(prefix='g1-') as d:
        os.makedirs(os.path.join(d, 'scripts'))
        shutil.copy(GATES, os.path.join(d, 'scripts', 'start-gates.sh'))
        with open(os.path.join(d, 'scripts', 'vienna-window.py'), 'w') as f:
            f.write('import sys\nprint("vienna-window: REFUSED — stand-in")\nsys.exit(3)\n')
        r = subprocess.run(['bash', os.path.join(d, 'scripts', 'start-gates.sh')], capture_output=True, text=True,
                           stdin=subprocess.DEVNULL, timeout=30)
        case('a refusing window stops start-gates.sh with exit 3 before any gate runs',
             r.returncode == 3 and '== probe' not in r.stdout, f'rc {r.returncode} {r.stdout[-200:]!r}')
        with open(os.path.join(d, 'scripts', 'vienna-window.py'), 'w') as f:
            f.write('import sys\nprint("vienna-window: OK — stand-in")\nsys.exit(0)\n')
        r = subprocess.run(['bash', '-c', f'HOME={d} bash {os.path.join(d, "scripts", "start-gates.sh")}'],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=30)
        case('control: a passing window lets start-gates.sh go on to the gates', '== probe Main' in r.stdout or r.returncode != 3,
             f'rc {r.returncode} {r.stdout[-200:]!r}')
    print('start-gates-window: ' + ('OK' if ok else 'FAILED'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
