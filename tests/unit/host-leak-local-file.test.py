#!/usr/bin/env python3
"""CLOSE-OUT R4: scripts/check-no-host-leak.sh refuses — clearly, exit 2, never "clean" — when CLAUDE.local.md is absent,
whatever $N8N_HOST holds; and it still scans and still catches a leak when the file is there.

Why: with the file absent and $N8N_HOST set, the guard crashed on an unset counter ("PARSED: unbound variable"); had it
run, it would have scanned ONE of the declared targets and called that clean. Each case runs the guard in a throwaway
git repository in a temporary directory, with a synthetic target generated here (no real host anywhere).
NEGATIVE CONTROL: the guard as it was at c51497a, run on case 1, does not give the clear refusal (it crashed).
Run: python3 tests/unit/host-leak-local-file.test.py
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GUARD = os.path.join(ROOT, 'scripts', 'check-no-host-leak.sh')
TARGET = 'leak-probe-' + 'x' * 6 + '.invalid'
ok = True


def case(label, good, detail=''):
    global ok
    ok &= bool(good)
    print(f"{'✓' if good else '✗'} {label}" + ('' if good else f' — {detail}'))


def repo(d, local=None, leak=False):
    run = lambda *a: subprocess.run(a, cwd=d, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    run('git', 'init', '-q')
    run('git', 'config', 'user.email', 't@example.invalid'); run('git', 'config', 'user.name', 't')
    open(os.path.join(d, '.gitignore'), 'w').write('CLAUDE.local.md\n')
    open(os.path.join(d, 'a.txt'), 'w').write(('see https://%s/x\n' % TARGET) if leak else 'nothing here\n')
    if local is not None:
        open(os.path.join(d, 'CLAUDE.local.md'), 'w').write(local)
    run('git', 'add', '.gitignore', 'a.txt'); run('git', 'commit', '-qm', 'init')


def guard(d, script=GUARD, env_host=None):
    env = {k: v for k, v in os.environ.items() if k != 'N8N_HOST'}
    if env_host is not None:
        env['N8N_HOST'] = env_host
    r = subprocess.run(['bash', script], cwd=d, capture_output=True, text=True, env=env, stdin=subprocess.DEVNULL, timeout=60)
    return r.returncode, r.stdout + r.stderr


def main():
    with tempfile.TemporaryDirectory(prefix='hl-') as d:
        repo(d)
        rc, out = guard(d, env_host=TARGET)
        case('no CLAUDE.local.md, $N8N_HOST set → exit 2, the reason named, never "clean"',
             rc == 2 and 'CLAUDE.local.md is absent' in out and 'clean' not in out, f'rc {rc} {out[-160:]!r}')
        rc, out = guard(d)
        case('no CLAUDE.local.md, no $N8N_HOST → exit 2, the same reason', rc == 2 and 'CLAUDE.local.md is absent' in out, f'rc {rc}')
        old = os.path.join(d, 'old-guard.sh')
        open(old, 'w').write(subprocess.run(['git', '-C', ROOT, 'show', 'c51497a:scripts/check-no-host-leak.sh'],
                                            capture_output=True, text=True).stdout)
        rc, out = guard(d, script=old, env_host=TARGET)
        case('CONTROL: the guard at c51497a, same case, does not refuse with a reason (it crashed)',
             'CLAUDE.local.md is absent' not in out and rc != 0, f'rc {rc} {out[-160:]!r}')
    with tempfile.TemporaryDirectory(prefix='hl-') as d:
        repo(d, local='notes\nSYNTHETIC_HOST=%s\n' % TARGET)
        rc, out = guard(d)
        case('CLAUDE.local.md present, a clean tree → exit 0, the target counted', rc == 0 and 'clean' in out and '1 redaction target' in out,
             f'rc {rc} {out[-160:]!r}')
    with tempfile.TemporaryDirectory(prefix='hl-') as d:
        repo(d, local='notes\nSYNTHETIC_HOST=%s\n' % TARGET, leak=True)
        rc, out = guard(d)
        case('CLAUDE.local.md present, the target in a tracked file → a LEAK (non-zero), never "clean"',
             rc not in (0, 2) and 'clean' not in out, f'rc {rc} {out[-160:]!r}')
    print('host-leak-local-file: ' + ('OK' if ok else 'FAILED'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
