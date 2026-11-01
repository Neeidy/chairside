#!/usr/bin/env python3
"""Mutants of the staged DATE-PHRASING edit (docs/DATE-PHRASING-PLAN.md). Each breaks ONE property the edit must hold and
must turn tests/unit/date-phrasing.test.cjs or tests/unit/chat-replay.test.cjs red — a survivor means neither measures
that property.

A mutant is one or more exact text replacements in one node's code (each must apply exactly once, or the run fails),
written into a copy of the staged export in a temporary directory and handed to both tests as argv[2].
Not in check-all: it re-runs both tests once per mutant. Run before a change to the edit or its tests is pushed.
Run: python3 tests/unit/date-phrasing-mutants.py        (exit 0 = every mutant killed)
"""
import copy
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STAGED = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
TESTS = [os.path.join(ROOT, 'tests', 'unit', 'date-phrasing.test.cjs'), os.path.join(ROOT, 'tests', 'unit', 'chat-replay.test.cjs')]
RD, SG, LC = 'Resolve Date', 'Slot Gate', 'Load Config'
MUTANTS = {
    'weekday/date conflict not checked': [(RD, 'if (weekday !== null && d.weekday !== weekday) {', 'if (false) {')],
    'a weekday written right before the date ignored (the model may drop it)': [(RD, 'if (before) weekday = DAYS[before[1]];', '')],
    'a dot read as month.day': [(RD, "if (m) return { day: +m[1], month: +m[2], year: m[3] ? +m[3] : null, weekday, numeric: 'dot' };",
                                "if (m) return { day: +m[2], month: +m[1], year: m[3] ? +m[3] : null, weekday, numeric: 'dot' };")],
    'a dot follows dateOrder like a slash': [(RD, "numeric: 'dot' };", "numeric: 'slash', a: +m[1], b: +m[2] };")],
    'a year given ignored': [(RD, '  if (c.year) {\n', '  if (false) {\n')],
    'next year taken past the horizon': [(RD, '(!limit || d1 <= limit)', 'true')],
    'A1: the horizon wrapper removed': [(RD, 'if (r.date && HORIZON && ', 'if (false && ')],
    'an impossible day accepted': [(RD, 'if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return', 'if (false) return'),
                                   (RD, "    if (!isLeapSafe(c.year, month, day)) return { date: null, reason: 'invalid_date' };\n", ''),
                                   (RD, "    else if (!ok0 && !ok1) return { date: null, reason: 'invalid_date' };\n", '')],
    'a year the model trimmed is not detected': [(RD, "test(text)) return { date: null, reason: 'calendar_clipped' };", "test(text) && false) return { date: null, reason: 'calendar_clipped' };")],
    'an ambiguous slash pair guessed instead of re-asked': [(RD, 'else if (c.a <= 12 && c.b <= 12 && c.a !== c.b) {', 'else if (false) {')],
    'business.dateOrder ignored': [(RD, "if (DATE_ORDER === 'DMY') ({ day, month } = dm);", "if (false) ({ day, month } = dm);")],
    'D-5 removed (Sunday keeps the current week)': [(RD, 'now.weekday === 7 && wd !== 7', 'now.weekday === 8 && wd !== 7')],
    'D-5 applied to the suffix form too': [(RD, "p.anchored && p.form === 'prefix' && now.weekday === 7", 'p.anchored && now.weekday === 7')],
    'D-5 applied on every day of the week': [(RD, "p.form === 'prefix' && now.weekday === 7 && wd !== 7", "p.form === 'prefix' && wd !== 7")],
    'D-4: the second dropped date never hands off': [(RD, "if (prevIntent === 'date_reask') {", 'if (false) {')],
    'D-4: the marker reuses NAME-CAPTURE\'s name_reask': [(RD, "if (prevIntent === 'date_reask') {", "if (prevIntent === 'name_reask') {"),
                                                      (RD, "stateOut = { ...(j.state || {}), last_intent: 'date_reask' };", "stateOut = { ...(j.state || {}), last_intent: 'name_reask' };")],
    'D-4 counted on a confirm turn': [(RD, "!own(CONFIRM_STAGES, String(stageNow))", 'true')],
    'D-4 counted on any intent': [(RD, "(j.intent === 'book' || j.intent === 'reschedule') && !own", 'true && !own')],
    'the model\'s own date taken for a calendar date': [(RD, "return { date: d.toISODate(), reason: 'calendar_date' };",
                                                        "return { date: (s && s.date) || d.toISODate(), reason: 'calendar_date' };")],
    'a new refusal does not alert': [(RD, "weekday_mismatch: 'date_weekday_mismatch', ", '')],
    'Slot Gate: the plain question instead of the hint (D-3)': [(SG, "DATE_REASK[dr.outcome] : 'askDateTimeHint';", "DATE_REASK[dr.outcome] : 'askDateTime';")],
    'Slot Gate: the weekday conflict not named': [(SG, "weekday_mismatch: 'dateWeekdayMismatch', ", '')],
    'Slot Gate: the template values not filled': [(SG, "return t[key] ? fill(t[key], dr.vars) : t.askDateTime;", 'return t[key] ? t[key] : t.askDateTime;')],
    'Load Config: another horizon (900)': [(LC, 'bookingHorizonDays: 90 }', 'bookingHorizonDays: 900 }')],
    'Load Config: MDY': [(LC, 'dateOrder: "DMY" }', 'dateOrder: "MDY" }')],
}


def mutate(w, reps):
    w = copy.deepcopy(w)
    for node, old, new in reps:
        n = next(x for x in w['nodes'] if x['name'] == node)
        code = n['parameters']['jsCode']
        if code.count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {node}: {old[:70]!r} ({code.count(old)})')
        n['parameters']['jsCode'] = code.replace(old, new)
    return w


def red(path):
    return any(subprocess.run(['node', t, path], capture_output=True, text=True).returncode != 0 for t in TESTS)


def main():
    if not os.path.exists(STAGED):
        print('date-phrasing-mutants: no staged Main export — nothing to mutate'); return 2
    base = json.load(open(STAGED, encoding='utf-8'))
    survivors = []
    with tempfile.TemporaryDirectory(prefix='dp-mut-') as d:
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
        print(f"control (the unmutated staged edit): {'green' if green else 'RED'}")
    print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} killed')
    return 0 if green and not survivors else 1


if __name__ == '__main__':
    sys.exit(main())
