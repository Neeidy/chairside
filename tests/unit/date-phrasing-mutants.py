#!/usr/bin/env python3
"""Mutants of the staged DATE-PHRASING edit (docs/DATE-PHRASING-PLAN.md). Each breaks ONE property the edit must hold and
must turn tests/unit/date-phrasing.test.cjs, tests/unit/chat-replay.test.cjs or tests/unit/resolve-date.test.cjs red — a
survivor means none of them measures that property.

A mutant is one or more exact text replacements in one node's code (each must apply exactly once, or the run fails) or
a function on the export (a graph change), written into a copy of the staged export in a temporary directory and handed
to the tests as argv[2].
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
TESTS = [os.path.join(ROOT, 'tests', 'unit', n) for n in ('date-phrasing.test.cjs', 'chat-replay.test.cjs', 'resolve-date.test.cjs')]
RD, SG, LC, RL = 'Resolve Date', 'Slot Gate', 'Load Config', 'Reschedule Lookup'
MUTANTS = {
    'a weekday elsewhere in the message ignored (Codex R1 HIGH-1)': [(RD, r".filter((k) => occursIn(k, text)).map((k) => DAYS[k])).filter", r".filter((k) => false).map((k) => DAYS[k])).filter")],
    'the expression\'s weekday switches off the message\'s weekdays (Codex R2 MEDIUM-5)': [(RD, r".concat(Object.keys(DAYS).filter((k) => occursIn(k, text))", r".concat(Object.keys(DAYS).filter((k) => c.weekday === null && occursIn(k, text))")],
    'a numeric continuation ("4.11" in "4.11.2027") not detected': [(RD, r"if (new RegExp(at + '[./]\\d').test(text)) return", r"if (false) return")],
    'a year the model left out, anywhere in the message, not detected (Codex R2 HIGH-1)': [(RD, r"if (c.year === null && /(^|[^0-9:.\/])\d{3,4}(?![0-9:])/.test(text)) return", r"if (false) return")],
    'the "may N of" exemption removed (resolve-date N1-d)': [(RD, r".replace(/(^|[^a-z])may\s+\d{1,2}\s+of\s+(?=[a-z])/g, '$1')", r"")],
    'the exemption widened to "<any word> N of <anything>" (Codex R2 HIGH-2)': [(RD, r"(^|[^a-z])may\s+\d{1,2}\s+of\s+(?=[a-z])", r"(^|[^a-z])[a-z]+\s+\d{1,2}\s+of\s+")],
    'a dot pair after a weekday needs a space (Codex R2 HIGH-3)': [(RD, r"\\s*,?\\s*(?:the\\s+)?\\d{1,2}\\.\\d{1,2}(?=$|[^0-9]))');", r"\\s*,?\\s+\\d{1,2}\\.\\d{1,2}(?=$|[^0-9]))');")],
    'the weekday-adjacent dot-pair detector removed (Codex R2 MEDIUM-7)': [(RD, r"  + '|(?:' + WD_RE + ')\\s*,?\\s*(?:the\\s+)?\\d{1,2}\\.\\d{1,2}(?=$|[^0-9]))');", r"  + ')');")],
    '"today" exempt from the written-date guard (Codex R2 MEDIUM-7)': [(RD, r"if (!cal && CAL_IN_TEXT.test(text)) return", r"if (!cal && e !== 'today' && CAL_IN_TEXT.test(text)) return")],
    'Reschedule Lookup drops D-4\'s marker (Codex R2 MEDIUM-6)': [(RL, r"const st = { ...vi.state, last_intent: ((($('Resolve Date').first().json || {}).state || {}).last_intent) ?? (vi.state || {}).last_intent };", r"const st = vi.state;")],
    'weekday/date conflict not checked': [(RD, '  if (wrong !== undefined) {\n', '  if (false) {\n')],
    'a calendar date in the message ignored when the expression is a weekday (Codex R1 HIGH-1)': [(RD, 'if (!cal && CAL_IN_TEXT.test(text)) return', 'if (false) return')],
    'an ISO date next to a written calendar date picked anyway': [(RD, "    if (CAL_IN_TEXT.test(text)) return { date: null, reason: 'calendar_clipped' };   // two dates written", "    if (false) return { date: null, reason: 'calendar_clipped' };   // two dates written")],
    'an empty extraction naming a calendar date inherits the stored date (Codex R1 HIGH-2)': [(RD, "|| (CAL_IN_TEXT.test(rawText) ? 'calendar date' : null))", '|| null)')],
    'a bare dot pair counted as a date': [(RD, r"  + '|\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4})?'", r"  + '|\\d{1,2}\\.\\d{1,2}'")],
    'year 0000 read as no year (Codex R1 MEDIUM-3)': [(RD, 'if (c.year !== null) {   // Codex R1 MEDIUM-3', 'if (c.year) {   // Codex R1 MEDIUM-3')],
    'the shop clock read in UTC (Codex R1 MEDIUM-5)': [(RD, 'const now = DateTime.now().setZone(tz);', "const now = DateTime.now().setZone('utc');")],
    'A1 skipped for relative days (Codex R1 MEDIUM-5)': [(RD, 'if (r.date && HORIZON && ', "if (r.date && (r.reason === 'calendar_date' || r.reason === 'iso_verbatim') && HORIZON && ")],
    'D-4 strikes with no known service (the customer never saw the date re-ask)': [(RD, "((j.intent === 'book' && svcKnown) || j.intent === 'reschedule')", "(j.intent === 'book' || j.intent === 'reschedule')")],
    'a dot read as month.day': [(RD, "if (m) return { day: +m[1], month: +m[2], year: m[3] ? +m[3] : null, weekday, numeric: 'dot' };",
                                "if (m) return { day: +m[2], month: +m[1], year: m[3] ? +m[3] : null, weekday, numeric: 'dot' };")],
    'a dot follows dateOrder like a slash': [(RD, "numeric: 'dot' };", "numeric: 'slash', a: +m[1], b: +m[2] };")],
    'a year given ignored': [(RD, 'if (c.year !== null) {   // Codex R1 MEDIUM-3', 'if (false) {   // Codex R1 MEDIUM-3')],
    'next year taken past the horizon': [(RD, '(!limit || d1 <= limit)', 'true')],
    'A1: the horizon wrapper removed': [(RD, 'if (r.date && HORIZON && ', 'if (false && ')],
    'an impossible day accepted': [(RD, 'if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return', 'if (false) return'),
                                   (RD, "    if (!isLeapSafe(c.year, month, day)) return { date: null, reason: 'invalid_date' };\n", ''),
                                   (RD, "    else if (!ok0 && !ok1) return { date: null, reason: 'invalid_date' };\n", '')],
    'an ambiguous slash pair guessed instead of re-asked': [(RD, 'else if (c.a <= 12 && c.b <= 12 && c.a !== c.b) {', 'else if (false) {')],
    'business.dateOrder ignored': [(RD, "if (DATE_ORDER === 'DMY') ({ day, month } = dm);", "if (false) ({ day, month } = dm);")],
    'D-5 removed (Sunday keeps the current week)': [(RD, 'now.weekday === 7 && wd !== 7', 'now.weekday === 8 && wd !== 7')],
    'D-5 applied to the suffix form too': [(RD, "p.anchored && p.form === 'prefix' && now.weekday === 7", 'p.anchored && now.weekday === 7')],
    'D-5 applied on every day of the week': [(RD, "p.form === 'prefix' && now.weekday === 7 && wd !== 7", "p.form === 'prefix' && wd !== 7")],
    'D-4: the second dropped date never hands off': [(RD, "if (prevIntent === 'date_reask') {", 'if (false) {')],
    'D-4: the marker reuses NAME-CAPTURE\'s name_reask': [(RD, "if (prevIntent === 'date_reask') {", "if (prevIntent === 'name_reask') {"),
                                                      (RD, "stateOut = { ...(j.state || {}), last_intent: 'date_reask' };", "stateOut = { ...(j.state || {}), last_intent: 'name_reask' };")],
    'D-4 counted on a confirm turn': [(RD, "!own(CONFIRM_STAGES, String(stageNow))", 'true')],
    'D-4 counted on any intent': [(RD, "((j.intent === 'book' && svcKnown) || j.intent === 'reschedule') && !own", 'true && !own')],
    'graph: the handoff gate no longer reaches Mark Handoff (Codex R1 MEDIUM-5)': lambda w: cut_edges_into(w, 'Mark Handoff'),
    'the model\'s own date taken for a calendar date': [(RD, "return { date: d.toISODate(), reason: 'calendar_date' };",
                                                        "return { date: (s && s.date) || d.toISODate(), reason: 'calendar_date' };")],
    'a new refusal does not alert': [(RD, "weekday_mismatch: 'date_weekday_mismatch', ", '')],
    'Slot Gate: the plain question instead of the hint (D-3)': [(SG, "DATE_REASK[dr.outcome] : 'askDateTimeHint';", "DATE_REASK[dr.outcome] : 'askDateTime';")],
    'Slot Gate: the weekday conflict not named': [(SG, "weekday_mismatch: 'dateWeekdayMismatch', ", '')],
    'Slot Gate: the template values not filled': [(SG, "return t[key] ? fill(t[key], dr.vars) : t.askDateTime;", 'return t[key] ? t[key] : t.askDateTime;')],
    'Load Config: another horizon (900)': [(LC, 'bookingHorizonDays: 90 }', 'bookingHorizonDays: 900 }')],
    'Load Config: MDY': [(LC, 'dateOrder: "DMY" }', 'dateOrder: "MDY" }')],
}


def cut_edges_into(w, target):
    for src, outs in w['connections'].items():
        for branch in outs.get('main', []):
            if branch:
                branch[:] = [e for e in branch if e['node'] != target]
    return w


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
