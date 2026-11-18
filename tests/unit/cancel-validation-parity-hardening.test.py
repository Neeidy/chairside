#!/usr/bin/env python3
"""HARDENING: check-cancel-validation-parity.py's two new rules must FAIL on a broken copy of the staged Main.
  F5  — Reschedule Fresh? / Booking Fresh? carry exactly the slot-in-the-future bound, both or neither (one alone or an
        altered bound → drift; neither = an export from before the edit, in step).
  RM-1907 — Event ID Valid? and Reschedule Event ID Valid? are one condition (typeValidation loosened → drift).
The unmutated export must pass (control). Run: python3 tests/unit/cancel-validation-parity-hardening.test.py"""
import copy, json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
SRC = S if os.path.exists(S) else os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json')
base = json.load(open(SRC, encoding='utf-8'))
def node(w, n): return next(x for x in w['nodes'] if x['name'] == n)
def lv(n, old, new):
    def f(w):
        c = node(w, n)['parameters']['conditions']['conditions'][0]
        assert c['leftValue'].count(old) == 1, (n, old); c['leftValue'] = c['leftValue'].replace(old, new); return w
    return f
def loose(w):
    node(w, 'Reschedule Event ID Valid?')['parameters']['conditions']['options']['typeValidation'] = 'loose'; return w
FUT = ("(() => { const s = $json.state.slots || {}; const d = DateTime.fromISO(String(s.date) + 'T' + String(s.time), "
       "{ zone: $('Load Config').first().json.config.business.timezone }); return d.isValid && d.toMillis() > $now.toMillis(); })()")
CASES = [('control (unmutated)', lambda w: w, 0),
         ('F5: Reschedule Fresh? without the future bound', lv('Reschedule Fresh?', "d.toMillis() > $now.toMillis()", "true"), 1),
         ('F5: Booking Fresh? without the future bound', lv('Booking Fresh?', "d.toMillis() > $now.toMillis()", "true"), 1),
         ('F5: Booking Fresh? bound on every stage', lv('Booking Fresh?', "($json.state.stage !== 'confirming' || ", "(false || "), 1),
         ('F5: BOTH without the bound (an export from before the edit) is in step', lambda w: lv('Booking Fresh?', " && ($json.state.stage !== 'confirming' || " + FUT + ')', '')(lv('Reschedule Fresh?', ' && ' + FUT, '')(w)), 0),
         ('RM-1907: Reschedule Event ID Valid? loosened', loose, 1)]
bad = 0
with tempfile.TemporaryDirectory() as d:
    for label, fn, want in CASES:
        p = os.path.join(d, 'w.json'); json.dump(fn(copy.deepcopy(base)), open(p, 'w'))
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'check-cancel-validation-parity.py'), p],
                           capture_output=True, text=True, cwd=ROOT)
        rc = r.returncode
        # a refusal must be the guard's own DRIFT verdict, never a crash (code-reviewer LOW-7)
        good = (rc == 0 and 'parity OK' in r.stdout) if want == 0 else (rc == 1 and 'DRIFT' in r.stdout and 'Traceback' not in r.stderr)
        bad += 0 if good else 1
        print(('✓ ' if good else '✗ ') + f'{label}: rc={rc}')
sys.exit(1 if bad else 0)
