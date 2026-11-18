#!/usr/bin/env python3
"""HARDENING RM-1938: check-content-parity.py's content_drift must see a changed alwaysOutputData / retryOnFail /
executeOnce on one node (they were uncompared; a retried Record LLM Spend would add its delta twice). One case per flag
and per direction, on the committed Main export; the negative control (no change) must be clean.
Run: python3 tests/unit/content-parity-flags.test.py   (GUARD=<path> runs it against another copy of the guard)"""
import copy, importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GUARD = os.environ.get('GUARD', os.path.join(ROOT, 'scripts', 'check-content-parity.py'))
argv, sys.argv = sys.argv, ['x', os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json')]
spec = importlib.util.spec_from_file_location('ccp', GUARD); m = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(m)
except SystemExit:
    pass
sys.argv = argv
wf = json.load(open(os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json'), encoding='utf-8'))
fails = 0
if m.content_drift(wf, copy.deepcopy(wf), {}):
    print('✗ control: an unchanged copy reports drift'); fails += 1
else:
    print('✓ control: an unchanged copy is clean')
for flag in ('alwaysOutputData', 'retryOnFail', 'executeOnce'):
    for target in ('Record LLM Spend', 'Check Processed'):
        live = copy.deepcopy(wf)
        n = next(x for x in live['nodes'] if x['name'] == target)
        n[flag] = not bool(n.get(flag))
        d = m.content_drift(live, wf, {})
        hit = any(target in x and flag in x for x in d)
        print(('✓' if hit else '✗') + f' {flag} flipped on {target}: ' + ('reported' if hit else 'NOT reported'))
        fails += 0 if hit else 1
# maxTries / waitBetweenTries count only while retryOnFail is on (code-reviewer LOW-A)
for field, val in (('maxTries', 5), ('waitBetweenTries', 2000)):
    comm, live = copy.deepcopy(wf), copy.deepcopy(wf)
    for w2, v in ((comm, None), (live, val)):
        n = next(x for x in w2['nodes'] if x['name'] == 'Record LLM Spend'); n['retryOnFail'] = True
        if v is not None: n[field] = v
    hit = any('Record LLM Spend' in x and field in x for x in m.content_drift(live, comm, {}))
    print(('✓' if hit else '✗') + f' {field} changed under retryOnFail: ' + ('reported' if hit else 'NOT reported')); fails += 0 if hit else 1
print('content-parity-flags: ' + ('OK' if not fails else f'{fails} FAILED'))
sys.exit(1 if fails else 0)
