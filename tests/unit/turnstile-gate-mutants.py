#!/usr/bin/env python3
"""Mutants of the Turnstile gate (DATE-PHRASING R4, 2026-11-02): the site panel's gate (web/site/lib/turnstileGate.ts) and
the snippet's mount (web/snippet/src/turnstile.ts). Each breaks ONE property and must turn its unit test red — a survivor
means no test measures that property.

A mutant is an exact text replacement (it must apply exactly once, or the run fails) written into a copy of the module in
a temporary directory; the test is pointed at the copy through its override variable.
The panel's WIRING (LiveChatPanel using the gate) is not mutated here — a mutant there needs a rebuild per mutant; it is
measured by tests/browser/turnstile-gate.drill.mjs instead (red on the pre-fix build, green on the fixed one).
Not in check-all. Run: python3 tests/unit/turnstile-gate-mutants.py        (exit 0 = every mutant killed)
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = ('web/site/lib/turnstileGate.ts', 'web/site', 'lib/turnstileGate.test.ts', 'TURNSTILE_GATE_MODULE')
SNIP = ('web/snippet/src/turnstile.ts', 'web/snippet', 'test/turnstile.test.ts', 'SNIPPET_TURNSTILE_MODULE')

MUTANTS = {
    'site: a missing token alone shows the notice (the R4 defect)': (SITE, [
        ("return !hasToken && (state === 'unavailable' || (state === 'error' && errors > maxRetries));", 'return !hasToken;')]),
    'site: the notice on the first failure (retries ignored)': (SITE, [('errors > maxRetries))', 'errors >= 1))')]),
    'site: the notice one failure early': (SITE, [('errors > maxRetries))', 'errors >= maxRetries))')]),
    'site: a token in hand does not clear the notice': (SITE, [("return !hasToken && (", 'return (')]),
    'site: a real block never shown': (SITE, [("return !hasToken && (state === 'unavailable' || (state === 'error' && errors > maxRetries));", 'return false;')]),
    'site: a script that cannot load is retried instead of blocked': (SITE, [("state === 'unavailable' || ", '')]),
    'site: a send allowed without a token': (SITE, [('canSend: hasToken,', 'canSend: true,')]),
    'site: the retrying placeholder dropped': (SITE, [(": !hasToken && state === 'error' ? RETRYING_PLACEHOLDER", ': false ? RETRYING_PLACEHOLDER')]),
    'site: no retry at all': (SITE, [('errors >= 1 && errors <= maxRetries', 'false')]),
    'site: retries without limit': (SITE, [('errors >= 1 && errors <= maxRetries', 'errors >= 1')]),
    'site: one retry instead of two': (SITE, [('TURNSTILE_MAX_RETRIES = 2', 'TURNSTILE_MAX_RETRIES = 1')]),
    'site: a stall never said': (SITE, [('const stuck = !hasToken && !blocked && stuckTimedOut;', 'const stuck = false;')]),
    'site: a stall said over a token': (SITE, [('const stuck = !hasToken && !blocked && stuckTimedOut;', 'const stuck = stuckTimedOut;')]),
    'site: the stuck timer runs before Turnstile is rendered': (SITE, [('return rendered && !hasToken', 'return !hasToken')]),
    'site: the stuck timer runs over a block': (SITE, [('&& !blocked && !interactive;', '&& !interactive;')]),
    'site: the stuck timer runs during an interactive challenge': (SITE, [('&& !blocked && !interactive;', '&& !blocked;')]),
    'snippet: a success does not end a block (the R4 defect)': (SNIP, [('errors = 0; blocked = false; clearTimeout', 'errors = 0; clearTimeout')]),
    'snippet: a success does not reset the failure count': (SNIP, [('token = t; errors = 0;', 'token = t;')]),
    'snippet: the first failure is a block (no retry)': (SNIP, [('if (errors <= TURNSTILE_MAX_RETRIES) {', 'if (false) {')]),
    'snippet: our retry never resets the widget': (SNIP, [('retryTimer = setTimeout(() => { endChallenge(); window.turnstile?.reset(widgetId ?? undefined); }, TURNSTILE_RETRY_MS);',
                                                          'retryTimer = setTimeout(() => { endChallenge(); }, TURNSTILE_RETRY_MS);')]),
    'snippet: a success leaves the pending retry armed': (SNIP, [('blocked = false; clearTimeout(retryTimer); onChange', 'blocked = false; onChange')]),
    'snippet: refresh leaves a pending retry armed': (SNIP, [('      clearTimeout(retryTimer);   // a retry pending', '      // a retry pending')]),
    'snippet: an interactive challenge is not reported': (SNIP, [("slot.classList.add('is-interactive'); onInteractive?.(true);", "slot.classList.add('is-interactive');")]),
    'snippet: the end of a challenge is not reported': (SNIP, [("'after-interactive-callback': () => { onInteractive?.(false); }", "'after-interactive-callback': () => {}")]),
    'snippet: a failure does not end a challenge': (SNIP, [("            onChange('pending');\n            endChallenge();\n", "            onChange('pending');\n")]),
    'snippet: a success does not end a challenge': (SNIP, [("onChange('ready'); endChallenge(); },", "onChange('ready'); },")]),
    'snippet: refresh does not end a challenge': (SNIP, [("      onChange('pending');\n      endChallenge();\n", "      onChange('pending');\n")]),
    'snippet: a timeout does not end a challenge': (SNIP, [("'timeout-callback': () => { token = null; onChange('pending'); endChallenge();", "'timeout-callback': () => { token = null; onChange('pending');")]),
    'snippet: an expiry does not end a challenge': (SNIP, [("'expired-callback': () => { token = null; onChange('pending'); endChallenge();", "'expired-callback': () => { token = null; onChange('pending');")]),
    'snippet: a block leaves the last retry armed': (SNIP, [('          clearTimeout(retryTimer);                     // the retries are spent', '          // the retries are spent')]),
    'snippet: refresh ignores a real block': (SNIP, [('      if (blocked) return;\n', '')]),
    'snippet: refresh never asks for a new token': (SNIP, [('      if (widgetId && window.turnstile) window.turnstile.reset(widgetId);\n', '')]),
    'snippet: a script that cannot load is not a block': (SNIP, [(".catch(() => { token = null; blocked = true; onChange('blocked'); });",
                                                               ".catch(() => { token = null; onChange('pending'); });")]),
}


def red(target, src):
    rel, cwd, test, var = target
    with tempfile.TemporaryDirectory(prefix='ts-mut-') as d:
        p = os.path.join(d, os.path.basename(rel))
        open(p, 'w', encoding='utf-8').write(src)
        r = subprocess.run(['node', '--test', test], cwd=os.path.join(ROOT, cwd), env={**os.environ, var: p},
                           capture_output=True, text=True)
        return r.returncode != 0


def main():
    survivors = []
    for label, (target, reps) in MUTANTS.items():
        src = open(os.path.join(ROOT, target[0]), encoding='utf-8').read()
        for old, new in reps:
            if src.count(old) != 1:
                raise SystemExit(f'mutant anchor does not apply exactly once in {target[0]}: {old[:70]!r} ({src.count(old)})')
            src = src.replace(old, new)
        killed = red(target, src)
        print(f"{'✓ killed  ' if killed else '✗ SURVIVED'} {label}")
        if not killed:
            survivors.append(label)
    controls = [not red(t, open(os.path.join(ROOT, t[0]), encoding='utf-8').read()) for t in (SITE, SNIP)]
    print(f"controls (the unmutated modules, through the same override): {'green' if all(controls) else 'RED'}")
    print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} killed')
    return 0 if all(controls) and not survivors else 1


if __name__ == '__main__':
    sys.exit(main())
