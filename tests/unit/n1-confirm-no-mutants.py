#!/usr/bin/env python3
"""Mutants of the staged N1 edit (docs/N1-CONFIRM-NO-PLAN.md §10). Each breaks ONE property the edit must hold and must
turn tests/unit/n1-confirm-no.test.cjs red — a survivor means the test does not measure that property.

A mutant is one or more exact text replacements in one node's code (each must apply exactly once, or the run fails) or
a function on the export (a graph change), written into a copy of the staged export in a temporary directory and handed
to the test as argv[2]. tests/unit/date-phrasing-mutants.py's runner.
Not in check-all: it re-runs the test once per mutant. Run before a change to the edit or its test is pushed.
Run: python3 tests/unit/n1-confirm-no-mutants.py        (exit 0 = every mutant killed, and the unmutated control green)
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
TESTS = [os.path.join(ROOT, 'tests', 'unit', 'n1-confirm-no.test.cjs')]
CL, BI, BU, LC = 'Classify Confirm Reply', 'Booking Declined?', 'Build Booking-Declined State', 'Load Config'
NO_RE = 'const NO = /^(?:no|nope|nah|no thanks|no thank you|not now)[.!]*$/;'
YES_RE = 'const YES = /^(?:yes|yeah|yep|yup|ok|okay|sure|yes please|that works|confirm)[.!]*$/;'


def rewire(src, k, to):
    def f(w):
        w['connections'][src]['main'][k] = [{'node': to, 'type': 'main', 'index': 0}]
        return w
    return f


def if_expr(new):
    def f(w):
        n = next(x for x in w['nodes'] if x['name'] == BI)
        n['parameters']['conditions']['conditions'][0]['leftValue'] = new
        return w
    return f


MUTANTS = {
    # Classify Confirm Reply — the closed set (D-2)
    'the "no" set unanchored at the start': [(CL, NO_RE, 'const NO = /(?:no|nope|nah|no thanks|no thank you|not now)[.!]*$/;')],
    'the "no" set unanchored at the end': [(CL, NO_RE, 'const NO = /^(?:no|nope|nah|no thanks|no thank you|not now)[.!]*/;')],
    'a near-miss admitted ("no, …")': [(CL, NO_RE, 'const NO = /^(?:no|nope|nah|no thanks|no thank you|not now)(?:[.!]*|,.*)$/;')],
    '"not now" dropped from the set': [(CL, 'no thank you|not now)', 'no thank you)')],
    'trailing punctuation not accepted': [(CL, NO_RE, 'const NO = /^(?:no|nope|nah|no thanks|no thank you|not now)$/;')],
    'the text not lower-cased': [(CL, ".replace(/\\s+/g, ' ').toLowerCase();", ".replace(/\\s+/g, ' ');")],
    'inner spaces not collapsed': [(CL, ".trim().replace(/\\s+/g, ' ').toLowerCase();", '.trim().toLowerCase();')],
    # D-3
    'a model cancel at the confirm ignored (text only: B1 comes back)': [(CL, " || (j.intent === 'cancel' && sure)", '')],
    'the confidence floor dropped from D-3 (an uncertain cancel drops the confirm)': [(CL, "(j.intent === 'cancel' && sure)", "(j.intent === 'cancel')")],
    'the floor made exclusive': [(CL, 'j.confidence >= $(', 'j.confidence > $(')],
    # the stage and previous-turn gates
    'the booking-confirm stage gate dropped': [(CL, "if (stage === 'confirming') {", 'if (true) {')],
    'the confirm branch also on the cancel confirm': [(CL, "if (stage === 'confirming') {", "if (stage === 'confirming' || stage === 'cancel_confirming') {")],
    'the after-decline rung without its stage gate': [(CL, "} else if (stage === 'collecting' && (prev === 'declined'", "} else if ((prev === 'declined'")],
    'the previous marker read from THIS turn ($json) instead of Merge State': [(CL, "const prev = (($('Merge State').first().json || {}).state || {}).last_intent;", 'const prev = (j.state || {}).last_intent;')],
    'a "no" after the re-ask does not close (D-4 after D-6)': [(CL, "(prev === 'declined' || prev === 'decline_reask')", "(prev === 'declined')")],
    # D-6 (amended)
    'the re-ask removed (a bare "yes" after a decline goes to the handoff at once)': [(CL, "  else if (prev === 'declined' && (YES.test(text) || (j.intent === 'confirm' && sure))) tag = 'decline_reask';\n", '')],
    'the re-ask without its once-limit': [(CL, "else if (prev === 'declined' && (YES.test", "else if ((YES.test")],
    'the re-ask on an uncertain model confirm': [(CL, "(j.intent === 'confirm' && sure)", "(j.intent === 'confirm')")],
    'the "yes" set unanchored': [(CL, YES_RE, 'const YES = /(?:yes|yeah|yep|yup|ok|okay|sure|yes please|that works|confirm)/;')],
    'a pass-through turn tagged with a null field': [(CL, 'return tag ? [{ json: { ...j, _booking_reply: tag } }] : $input.all();', 'return [{ json: { ...j, _booking_reply: tag } }];')],
    # Build Booking-Declined State
    'the decline leaves stage confirming (a later "yes" books the declined slot)': [(BU, "state: { ...st, stage: 'collecting', last_intent: j._booking_reply", "state: { ...st, stage: 'confirming', last_intent: j._booking_reply")],
    'the decline empties the slots': [(BU, "state: { ...st, stage: 'collecting', last_intent: j._booking_reply, confirm_turn: '' }", "state: { ...st, stage: 'collecting', last_intent: j._booking_reply, confirm_turn: '', slots: { serviceId: null, date: null, time: null, customerName: null } }")],
    'the decline drops the name': [(BU, "state: { ...st, stage: 'collecting', last_intent: j._booking_reply, confirm_turn: '' }", "state: { ...st, stage: 'collecting', last_intent: j._booking_reply, confirm_turn: '', slots: { ...st.slots, customerName: null } }")],
    'the decline marker not written': [(BU, "last_intent: j._booking_reply, confirm_turn: ''", "confirm_turn: ''")],
    'the close keeps stage collecting': [(BU, "stage: 'new', last_intent: 'dropped'", "stage: 'collecting', last_intent: 'dropped'")],
    'the close keeps the service': [(BU, 'slots: { ...st.slots, serviceId: null, date: null, time: null } }', 'slots: { ...st.slots, date: null, time: null } }')],
    'the close drops the name': [(BU, 'slots: { ...st.slots, serviceId: null, date: null, time: null } }', 'slots: { ...st.slots, serviceId: null, date: null, time: null, customerName: null } }')],
    'the close replies with the change question': [(BU, 'computed_reply: t.bookingDropped ||', 'computed_reply: t.bookingDeclined ||')],
    # Load Config (D-5)
    'Load Config without bookingDeclined': [(LC, '    bookingDeclined: "No problem — nothing is booked. What would you like to change: the service, the day, the time or the name?",\n', '')],
    'Load Config without bookingDropped': [(LC, '    bookingDropped: "Okay — nothing is booked. Message me any time you\'d like to book.",\n', '')],
    # the graph
    'Booking Declined? false skips Uncertain Turn? (to Route Intent)': rewire(BI, 1, 'Route Intent'),
    'Booking Declined? true to Mark Handoff': rewire(BI, 0, 'Mark Handoff'),
    'Abort Reschedule? false straight to Uncertain Turn? (the branch bypassed)': rewire('Abort Reschedule?', 1, 'Uncertain Turn?'),
    'Booking Declined? reads the tag inverted': if_expr('={{ !$json._booking_reply }}'),
}


def mutate(w, reps):
    w = copy.deepcopy(w)
    if callable(reps):
        return reps(w)
    for node, old, new in reps:
        n = next(x for x in w['nodes'] if x['name'] == node)
        code = n['parameters']['jsCode']
        if code.count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {node}: {old[:70]!r} ({code.count(old)})')
        n['parameters']['jsCode'] = code.replace(old, new)
    return w


def red(path):
    return any(subprocess.run(['node', t, path], capture_output=True, text=True, stdin=subprocess.DEVNULL).returncode != 0 for t in TESTS)


def main():
    base = json.load(open(STAGED, encoding='utf-8'))
    if not any(n['name'] == CL for n in base['nodes']):
        print('n1-confirm-no-mutants: the export carries no N1 edit — nothing to mutate'); return 2
    survivors = []
    with tempfile.TemporaryDirectory(prefix='n1-mut-') as d:
        for label, reps in MUTANTS.items():
            p = os.path.join(d, 'm.json')
            json.dump(mutate(base, reps), open(p, 'w', encoding='utf-8'), ensure_ascii=False)
            killed = red(p)
            print(f"{'✓ killed  ' if killed else '✗ SURVIVED'} {label}")
            if not killed:
                survivors.append(label)
        ctrl = os.path.join(d, 'c.json')
        json.dump(base, open(ctrl, 'w', encoding='utf-8'), ensure_ascii=False)
        green = not red(ctrl)
        print(f"control (the unmutated edit): {'green' if green else 'RED'}")
    print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} killed')
    return 0 if green and not survivors else 1


if __name__ == '__main__':
    sys.exit(main())
