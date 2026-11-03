#!/usr/bin/env python3
"""Mutants of the CLOSE-OUT Main edit (docs/CLOSE-OUT-PLAN.md §3 M1, M2). Each breaks ONE property the edit must hold
and must turn tests/unit/close-out-main.test.cjs red — a survivor means the test does not measure that property.
A mutant is an exact text replacement in one node's code or IF expression (it must apply exactly once, or the run
fails), or a function on the export (a graph change), written into a copy in a temporary directory and handed to the
test as argv[2]. tests/unit/n1-confirm-no-mutants.py's runner. Not in check-all: it re-runs the test once per mutant.
Run: python3 tests/unit/close-out-main-mutants.py        (exit 0 = every mutant killed, and the unmutated control green)
"""
import copy
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# The staged edit while it exists; after its promotion the committed export carries it, and the mutants run against that.
_STAGED = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
STAGED = _STAGED if os.path.exists(_STAGED) else os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json')
TEST = os.path.join(ROOT, 'tests', 'unit', 'close-out-main.test.cjs')
RD, CA, BF = 'Resolve Date', 'Compute Availability', 'Booking Fresh?'
ECHO = "echoAtPendingConfirm = !!storedDate && s.date === storedDate && Object.prototype.hasOwnProperty.call(CONFIRM_STAGES, String(stage));"
STAMP = "confirm_turn: stage === 'confirming' ? String(st.turn_count + 1) : ''"


def code(node, old, new):
    def f(w):
        n = next(x for x in w['nodes'] if x['name'] == node)
        c = n['parameters']['jsCode']
        if c.count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {node}: {old[:70]!r}')
        n['parameters']['jsCode'] = c.replace(old, new)
        return w
    return f


def expr(old, new):
    def f(w):
        n = next(x for x in w['nodes'] if x['name'] == BF)
        cond = n['parameters']['conditions']['conditions'][0]
        if cond['leftValue'].count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {BF}: {old!r}')
        cond['leftValue'] = cond['leftValue'].replace(old, new)
        return w
    return f


def rewire(src, k, to):
    def f(w):
        w['connections'][src]['main'][k] = [{'node': to, 'type': 'main', 'index': 0}]
        return w
    return f


MUTANTS = {
    # M1 — the echo rule
    'M1: the ping withheld for every date without an expression (no equality check)': code(RD, 's.date === storedDate && Object.prototype', 'Object.prototype'),
    'M1: the ping withheld at every stage (no pending-confirm check)': code(RD, ECHO, 'echoAtPendingConfirm = !!storedDate && s.date === storedDate;'),
    'M1: the echo rule removed (4905 alerts again)': code(RD, 'if (echoAtPendingConfirm) cls = null;', ''),
    'M1: the ping withheld always': code(RD, 'if (echoAtPendingConfirm) cls = null;', 'cls = null;'),
    # M2 — the stamp
    'M2: no stamp written (every "yes" stale)': code(CA, STAMP, "confirm_turn: ''"),
    'M2: the stamp is this turn, not the next': code(CA, STAMP, "confirm_turn: stage === 'confirming' ? String(st.turn_count) : ''"),
    # M2 — the gate
    'M2: the gate always fresh': expr("return String(tc) === ct;", 'return true;'),
    'M2: the gate inverted': expr("return String(tc) === ct;", 'return String(tc) !== ct;'),
    'M2: the gate without its stage scope (D-6 broken)': expr("if ($json.state.stage !== 'confirming') return true; ", ''),
    'M2: a missing stamp counted as fresh': expr("if (typeof ct !== 'string' || !/^[1-9][0-9]*$/.test(ct)) return false;", "if (typeof ct !== 'string' || !/^[1-9][0-9]*$/.test(ct)) return true;"),
    # the graph
    'graph: stale → Build Event Request (the write)': rewire(BF, 1, 'Build Event Request'),
    'graph: stale → Save State (no availability re-read)': rewire(BF, 1, 'Save State'),
    'graph: the gate bypassed (Reschedule Router false → Build Event Request)': rewire('Reschedule Router', 1, 'Build Event Request'),
}


# EQUIVALENT, shown and not counted: keeping the stamp on a non-confirming status (closed / busy / past / invalid) has no
# observable effect — Booking Fresh? reads it only at stage confirming, and every confirm ask writes a new one. The clear is
# state hygiene. Measured in R1 (2026-11-03): this mutant leaves the test green, as expected.
EQUIVALENT = {'M2: the stamp kept on a non-confirming status': code(CA, STAMP, 'confirm_turn: String(st.turn_count + 1)')}


def red(path):
    return subprocess.run(['node', TEST, path], capture_output=True, text=True, stdin=subprocess.DEVNULL).returncode != 0


def main():
    base = json.load(open(STAGED, encoding='utf-8'))
    if not any(n['name'] == BF for n in base['nodes']):
        print('close-out-main-mutants: the export carries no CLOSE-OUT edit — nothing to mutate'); return 2
    survivors = []
    with tempfile.TemporaryDirectory(prefix='co-mut-') as d:
        for label, f in MUTANTS.items():
            p = os.path.join(d, 'm.json')
            json.dump(f(copy.deepcopy(base)), open(p, 'w', encoding='utf-8'), ensure_ascii=False)
            killed = red(p)
            print(f"{'✓ killed  ' if killed else '✗ SURVIVED'} {label}")
            if not killed:
                survivors.append(label)
        for label, f in EQUIVALENT.items():   # shown, not counted: it must stay GREEN, or it is not equivalent
            p = os.path.join(d, 'e.json')
            json.dump(f(copy.deepcopy(base)), open(p, 'w', encoding='utf-8'), ensure_ascii=False)
            eq_green = not red(p)
            print(f"{'= equivalent' if eq_green else '✗ NOT equivalent (it turned the test red)'} {label}")
            if not eq_green:
                survivors.append(f'{label} (declared equivalent, but red)')
        ctrl = os.path.join(d, 'c.json')
        json.dump(base, open(ctrl, 'w', encoding='utf-8'), ensure_ascii=False)
        green = not red(ctrl)
        print(f"control (the unmutated edit): {'green' if green else 'RED'}")
    print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} killed')
    return 0 if green and not survivors else 1


if __name__ == '__main__':
    sys.exit(main())
