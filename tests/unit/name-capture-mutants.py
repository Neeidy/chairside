#!/usr/bin/env python3
"""Mutants of the staged NAME-CAPTURE edit (docs/NAME-CAPTURE-PLAN.md). Each one breaks ONE property the edit must hold,
and each must turn tests/unit/name-capture.test.cjs red — a mutant that survives means the test does not measure that
property.

A mutant is one or more text replacements in one node's code/SQL/parameter (each must apply exactly once, or the run
fails), or a connection change; it is written into a copy of the staged export in a temporary directory and handed to
the test as its argument (argv[2] the Main export, argv[3] the Purge export).

Not in check-all: it re-runs the test once per mutant. Run before a change to the edit or its test is pushed.
Run: python3 tests/unit/name-capture-mutants.py        (exit 0 = every mutant killed)
"""
import copy
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pick(key):
    staged = os.path.join(ROOT, 'n8n', 'staged', f'workflow.{key}.sanitized.json')
    return staged if os.path.exists(staged) else os.path.join(ROOT, 'n8n', f'workflow.{key}.sanitized.json')


TEST = os.path.join(ROOT, 'tests', 'unit', 'name-capture.test.cjs')
FN, MS = 'Fill Name From Reply', 'Merge Slots'
# label → (workflow key, [(node, parameter path, old, new), …]) — or a callable on the parsed export
MUTANTS = {
    'Fill Name: the deny list not applied': ('main', [(FN, ('jsCode',), 'if (shaped && !denied &&', 'if (shaped &&')]),
    'Fill Name: runs over ANY intent (a handoff/cancel taken as a name)':
        ('main', [(FN, ('jsCode',), "if (j.valid !== true || !(j.intent === 'unknown' || (j.intent === 'book' && !detail))) {", 'if (false) {')]),
    'Fill Name: a booking detail this turn ignored': ('main', [(FN, ('jsCode',), "(j.intent === 'book' && !detail)", "(j.intent === 'book')")]),
    'Fill Name: runs outside the name ask (any stage)': ('main', [(FN, ('jsCode',), "st.stage === 'collecting' && hasService", 'hasService')]),
    'Fill Name: runs over an invalid model answer': ('main', [(FN, ('jsCode',), 'if (j.valid !== true || !(', 'if (!(')]),
    'Fill Name: a different model name overridden': ('main', [(FN, ('jsCode',), '(!modelName || modelName === cand)', 'true')]),
    'Fill Name: D-3 never hands off': ('main', [(FN, ('jsCode',), "if (prev.last_intent === 'name_reask' || prev.last_intent === 'clarify') {", 'if (false) {')]),
    'Fill Name: D-3 reads THIS turn (st), not the previous one': ('main', [(FN, ('jsCode',), "if (prev.last_intent === 'name_reask' || prev.last_intent === 'clarify') {",
                                                                            "if (st.last_intent === 'name_reask' || st.last_intent === 'clarify') {")]),
    'Fill Name: the first book refusal not marked': ('main', [(FN, ('jsCode',), "last_intent: j.intent === 'book' ? 'name_reask' : st.last_intent", 'last_intent: st.last_intent')]),
    'Fill Name: month names on the deny list (A1 broken)': ('main', [(FN, ('jsCode',), "'sun']);", "'sun', 'april', 'may', 'june', 'august']);")]),
    "Fill Name: the config's service words not denied": ('main', [(FN, ('jsCode',), ' || serviceWords.has(w.toLowerCase())', '')]),
    'Fill Name: five words accepted': ('main', [(FN, ('jsCode',), 'words.length <= 4', 'words.length <= 5')]),
    'Fill Name: the prefix not stripped': ('main', [(FN, ('jsCode',), 'const cand = sanitiseName(pre ? text.slice(pre[0].length) : text);', 'const cand = sanitiseName(text);')]),
    'Fill Name: low confidence kept on a filled name': ('main', [(FN, ('jsCode',), 'confidence: Math.max(Number(j.confidence) || 0, 0.95)', 'confidence: j.confidence')]),
    'sanitiser: \\p{C} not stripped (one copy)': ('main', [(MS, ('jsCode',), ".replace(/\\p{C}/gu, '')", '')]),
    'sanitiser: \\p{C} not stripped (BOTH copies)': ('main', [(MS, ('jsCode',), ".replace(/\\p{C}/gu, '')", ''), (FN, ('jsCode',), ".replace(/\\p{C}/gu, '')", '')]),
    'sanitiser: no 40-character cap (both)': ('main', [(MS, ('jsCode',), 'if (chars.length > 40)', 'if (false)'), (FN, ('jsCode',), 'if (chars.length > 40)', 'if (false)')]),
    'sanitiser: no NFC (both)': ('main', [(MS, ('jsCode',), "v.normalize('NFC')", 'v'), (FN, ('jsCode',), "v.normalize('NFC')", 'v')]),
    'sanitiser: ASCII letters only (A2 broken; both)': ('main', [(MS, ('jsCode',), "/^[\\p{L}' .-]+$/u", "/^[A-Za-z' .-]+$/u"), (FN, ('jsCode',), "/^[\\p{L}' .-]+$/u", "/^[A-Za-z' .-]+$/u")]),
    'sanitiser: digits allowed (both)': ('main', [(MS, ('jsCode',), "/^[\\p{L}' .-]+$/u", "/^[\\p{L}\\d' .-]+$/u"), (FN, ('jsCode',), "/^[\\p{L}' .-]+$/u", "/^[\\p{L}\\d' .-]+$/u")]),
    'Merge Slots: the kept name wins over a fresh one': ('main', [(MS, ('jsCode',), 'customerName: sanitiseName(fresh.customerName) ?? sanitiseName(stored.customerName) ?? null',
                                                                  'customerName: sanitiseName(stored.customerName) ?? sanitiseName(fresh.customerName) ?? null')]),
    'Merge Slots: the kept name dropped': ('main', [(MS, ('jsCode',), ' ?? sanitiseName(stored.customerName) ?? null', ' ?? null')]),
    'Merge State: slot_name not read': ('main', [('Merge State', ('jsCode',), "customerName: found ? (f.slot_name ?? null) : null", 'customerName: null')]),
    'Slot Gate: the name not required': ('main', [('Slot Gate', ('jsCode',), "else if (!hasName)             next_ask = 'name';\n", '')]),
    'Slot Gate: the name asked BEFORE the day/time (D-1 order)': ('main', [('Slot Gate', ('jsCode',),
        "else if (!hasDate || !hasTime) next_ask = 'datetime';\nelse if (!hasName)             next_ask = 'name';",
        "else if (!hasName)             next_ask = 'name';\nelse if (!hasDate || !hasTime) next_ask = 'datetime';")]),
    'Slot Gate: the wrong template at the name ask': ('main', [('Slot Gate', ('jsCode',), ": t.askName)", ": t.askDateTime)")]),
    'Build Clarify State: askIntent at the name ask': ('main', [('Build Clarify State', ('jsCode',), '(j._name_pending === true && cfg.messageTemplates.askName)', '(false)')]),
    'Compute Availability: the confirm does not name the person': ('main', [('Compute Availability', ('jsCode',), "${slots.customerName ? ' for ' + slots.customerName : ''}", '')]),
    'Build Event Request: a confirm with no kept name books anyway (Codex R1 M1)': ('main', [('Build Event Request', ('jsCode',),
        "if (!(typeof slots.customerName === 'string' && slots.customerName.trim())) {", 'if (false) {')]),
    "Build Event Request: this turn's model name, not the kept one": ('main', [('Build Event Request', ('jsCode',), 'const name = (slots && slots.customerName) || null;',
                                                                                'const name = (vi.slots && vi.slots.customerName) || null;')]),
    "Build Reschedule Event Request: this turn's model name": ('main', [('Build Reschedule Event Request', ('jsCode',),
        'const name = ($json._reschedule_target && $json._reschedule_target.customer_name) || null;', 'const name = (vi.slots && vi.slots.customerName) || null;')]),
    'Validate Reschedule Target: customer_name not carried': ('main', [('Validate Reschedule Target', ('jsCode',), ', customer_name: t.fields.customer_name || null', '')]),
    'Reschedule Lookup: the kept name dropped on the new slots': ('main', [('Reschedule Lookup', ('jsCode',), 'slots = { ...(st.slots || {}), serviceId: svc.id,', 'slots = { serviceId: svc.id,')]),
    'Build LLM Request: the name VALUE in the prompt': ('main', [('Build LLM Request', ('jsCode',), "name=${collected.customerName ? 'provided' : 'missing'}", "name=${collected.customerName ?? 'missing'}")]),
    'Build LLM Request: no name-ask hint': ('main', [('Build LLM Request', ('jsCode',), ".${nameAsk} The customer's", ". The customer's")]),
    'Write Appointment: a re-write blanks the stored name': ('main', [('Write Appointment', ('query',), "customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''), salon.appointments.customer_name),",
                                                                       'customer_name = EXCLUDED.customer_name,')]),
    "Write Appointment: no name sent as ''": ('main', [('Write Appointment', ('options', 'queryReplacement'), 'booking.customerName || null,', "booking.customerName || '',")]),
    'Save State: slot_name not updated on conflict': ('main', [('Save State', ('query',), ', slot_name = EXCLUDED.slot_name RETURNING', ' RETURNING')]),
    "Save State (Post-Write): the name written as ''": ('main', [('Save State (Post-Write)', ('options', 'queryReplacement'), '$json.state.slots.customerName || null] }}', "$json.state.slots.customerName || ''] }}")]),
    'Load State: slot_name not projected': ('main', [('Load State', ('query',), ", 'slot_name', NULLIF(slot_name, '')", '')]),
    'Capture Lead: this turn first, the kept name second': ('main', [('Capture Lead', ('options', 'queryReplacement'),
        "[(($json.state || {}).slots || {}).customerName || ($json.slots || {}).customerName || '',", "[($json.slots || {}).customerName || (($json.state || {}).slots || {}).customerName || '',")]),
    'Load Config: another askName text': ('main', [('Load Config', ('jsCode',), '(Any name is fine for this demo.)', '(Any name.)')]),
    'Purge: the scrub keeps slot_name': ('purge', [('Scrub Recent Messages', ('query',), ", slot_name = NULL WHERE", ' WHERE')]),
    'Purge: the stored confirm question keeps the name (Codex R1 M2)': ('purge', [('Scrub Recent Messages', ('query',),
        "computed_reply = CASE WHEN COALESCE(slot_name, '') = '' THEN computed_reply ELSE replace(computed_reply, slot_name, '…') END, ", '')]),
    'Purge: a row with only a name never found': ('purge', [('Find Stale Conversations', ('query',), "(recent_messages <> '' OR slot_name IS NOT NULL)", "recent_messages <> ''")]),
}


def bypass(wf):   # the graph: Validate Intent straight to Resolve Date, the new node orphaned
    wf['connections']['Validate Intent'] = {'main': [[{'node': 'Resolve Date', 'type': 'main', 'index': 0}]]}


def no_refusal_route(wf):   # Codex R2 LOW: the name_missing refusal stops dead — no handoff, no reply, no alert
    wf['connections']['Event ID Valid?']['main'][1] = []


def no_handoff_alert(wf):   # the handoff saves state but never alerts the owner
    wf['connections']['Mark Handoff']['main'][0] = [e for e in wf['connections']['Mark Handoff']['main'][0] if e['node'] != 'Build Owner Alert']


GRAPH = {'graph: Validate Intent → Resolve Date directly (Fill Name From Reply bypassed)': ('main', bypass),
         "graph: Event ID Valid?'s false output removed (Codex R2 LOW)": ('main', no_refusal_route),
         'graph: Mark Handoff no longer alerts the owner': ('main', no_handoff_alert)}


def apply(wf, edits, label):
    nodes = {n['name']: n for n in wf['nodes']}
    for name, path, old, new in edits:
        p = nodes[name]['parameters']
        for k in path[:-1]:
            p = p[k]
        cur = p[path[-1]]
        if cur.count(old) != 1:
            sys.exit(f'mutant "{label}": the anchor is not in {name} exactly once ({cur.count(old)}): {old[:60]!r}')
        p[path[-1]] = cur.replace(old, new)


def main():
    base = {k: json.load(open(pick(k), encoding='utf-8')) for k in ('main', 'purge')}
    killed, survived = 0, []
    with tempfile.TemporaryDirectory(prefix='nc-mut-') as d:
        for label, (key, edit) in {**MUTANTS, **GRAPH}.items():
            wfs = {k: copy.deepcopy(v) for k, v in base.items()}
            if callable(edit):
                edit(wfs[key])
            else:
                apply(wfs[key], edit, label)
            paths = {}
            for k, w in wfs.items():
                paths[k] = os.path.join(d, f'{k}.json')
                with open(paths[k], 'w', encoding='utf-8') as f:
                    json.dump(w, f, ensure_ascii=False)
            r = subprocess.run(['node', TEST, paths['main'], paths['purge']], capture_output=True, text=True, stdin=subprocess.DEVNULL)
            if r.returncode != 0:
                killed += 1
                print(f'✓ killed   {label}')
            else:
                survived.append(label)
                print(f'✗ SURVIVED {label}')
        r = subprocess.run(['node', TEST, pick('main'), pick('purge')], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    total = len(MUTANTS) + len(GRAPH)
    print(f'control (the unmutated staged edit): {"green" if r.returncode == 0 else "RED"}')
    print(f'{killed}/{total} killed' + (f' — survived: {survived}' if survived else ''))
    return 0 if killed == total and r.returncode == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
