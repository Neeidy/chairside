#!/usr/bin/env python3
"""Mutants of the HARDENING R1 Main edit (docs/hardening/PLAN.md §2). Each breaks ONE property the edit must hold and
must turn tests/unit/hardening-main.test.cjs red — a survivor means the test does not measure that property.
A mutant is an exact text replacement in one node's code / IF expression / query (it must apply exactly once, or the
run fails), or a graph change, written into a copy in a temporary directory and handed to the test as argv[2].
Not in check-all: it re-runs the test once per mutant.
Run: python3 tests/unit/hardening-main-mutants.py      (exit 0 = every mutant killed, and the unmutated control green)
"""
import copy
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_STAGED = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
STAGED = _STAGED if os.path.exists(_STAGED) else os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json')
TEST = os.path.join(ROOT, 'tests', 'unit', 'hardening-main.test.cjs')


def _n(w, name):
    return next(x for x in w['nodes'] if x['name'] == name)


def code(name, old, new):
    def f(w):
        p = _n(w, name)['parameters']
        k = 'jsCode' if 'jsCode' in p else 'query'
        if p[k].count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {name}: {old[:70]!r}')
        p[k] = p[k].replace(old, new)
        return w
    return f


def param(name, old, new):
    def f(w):
        o = _n(w, name)['parameters']['options']
        if o['queryReplacement'].count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {name}.queryReplacement: {old!r}')
        o['queryReplacement'] = o['queryReplacement'].replace(old, new)
        return w
    return f


def cond(name, i, old, new):
    def f(w):
        c = _n(w, name)['parameters']['conditions']['conditions'][i]
        if c['leftValue'].count(old) != 1:
            raise SystemExit(f'mutant anchor does not apply exactly once in {name}: {old!r}')
        c['leftValue'] = c['leftValue'].replace(old, new)
        return w
    return f


def rewire(src, k, to):
    def f(w):
        w['connections'][src]['main'][k] = [{'node': to, 'type': 'main', 'index': 0}]
        return w
    return f


def drop_assignment(name, field):
    def f(w):
        a = _n(w, name)['parameters']['assignments']['assignments']
        before = len(a)
        a[:] = [x for x in a if x['name'] != field]
        if len(a) != before - 1:
            raise SystemExit(f'mutant: no assignment {field} in {name}')
        return w
    return f


RPA, CCR, MS, RD, BOA = 'Read Pending Answer', 'Classify Confirm Reply', 'Merge State', 'Resolve Date', 'Build Owner Alert'
CL, RL = 'Cancel Lookup', 'Reschedule Lookup'
TWIN = "&& !(new Date(r.fields.end_utc || r.fields.start_utc).getTime() <= now))"
MUTANTS = {
    # WU-1 · F3
    'F3: every text consents': code(RPA, "return [{ json: { ...j, _consent_yes: yes } }];", "return [{ json: { ...j, _consent_yes: true } }];"),
    'F3: "go ahead" dropped from AGREE': code(RPA, "'works for me', 'go ahead',", "'works for me',"),
    'F3: toLowerCase instead of literal /i (the KELVIN SIGN folds to "ok")': code(RPA, "'i').test(t);", "'i').test(t.toLowerCase());"),
    'F3: the 80-character bound removed': code(RPA, "if (!tampered && t && t.length <= 80) {", "if (!tampered && t) {"),
    'F3: the stage-bound verb list shared across stages ("cancel" consents to a booking)': code(RPA, "FILLER.concat(VERB[stage])", "FILLER.concat(VERB.confirming, VERB.cancel_confirming)"),
    'F3: Abort Cancel? back to the model alone': cond('Abort Cancel?', 1, " || $json._consent_yes !== true", ""),
    'F3: Abort Reschedule? back to the model alone': cond('Abort Reschedule?', 1, " || $json._consent_yes !== true", ""),
    'F3: the booking re-ask removed': code(CCR, "  else if (j.intent === 'confirm' && j._consent_yes !== true) tag", "  else if (false) tag"),
    'F3: the second strike never hands off': code(CCR, "(prev === 'consent_unclear') ? 'consent_handoff' : 'consent_unclear'", "'consent_unclear'"),
    'F3: the re-ask goes to Uncertain Turn? (no confirm shown again)': rewire('Route Consent', 0, 'Uncertain Turn?'),
    # WU-1 · F5
    'F5: Booking Fresh? without the future bound': cond('Booking Fresh?', 0, "d.isValid && d.toMillis() > $now.toMillis()", "true"),
    'F5: Reschedule Fresh? without the future bound': cond('Reschedule Fresh?', 0, "d.isValid && d.toMillis() > $now.toMillis()", "true"),
    # WU-1 · F4
    'F4: no session reset': code(MS, "const newSession = !!prevTs", "const newSession = false && !!prevTs"),
    'F4: the reset keeps the pending confirm': code(MS, "confirm_turn: (found && !newSession) ?", "confirm_turn: found ?"),
    # WU-2 · F2 / RM-1979
    'F2: Find Booking without the end_utc bound': code('Find Booking', " AND end_utc > $2::timestamptz", ""),
    'F2: Find Booking (Reschedule) without the end_utc bound': code('Find Booking (Reschedule)', " AND end_utc > $2::timestamptz", ""),
    'F2: Cancel Lookup JS twin without the bound': code(CL, TWIN, ")"),
    'F2: Reschedule Lookup JS twin without the bound': code(RL, TWIN, ")"),
    'F2: several bookings and no day → the earliest is taken again': code(CL, "if (hit.length !== 1) {", "if (hit.length === 0) {"),
    'F2: the bound is start_utc (an in-progress booking stops being a target)': code(CL, "new Date(r.fields.end_utc || r.fields.start_utc)", "new Date(r.fields.start_utc)"),
    'RM-1979: the next-turn rewrite removed': code(RPA, "if (prevIntent === 'reschedule_ask' && j.intent === 'book'", "if (false && j.intent === 'book'"),
    # WU-3 · F1 / F7 / H3 / EN-CD-3 / RM-1971
    'F1: Build Reply Payload no longer carries the class': drop_assignment('Build Reply Payload', 'handoff_alert_class'),
    'F1: Build Owner Alert ignores handoff_alert_class': code(BOA, "else if (typeof j.handoff_alert_class === 'string' && j.handoff_alert_class) { cls = j.handoff_alert_class; }", ""),
    'D3: the cancel-cutoff writer loses its class': code('Build Cancel-Cutoff Reply', "handoff_alert_class: 'cancel_cutoff', ", ""),
    'F7: no prune': code(BOA, "if (typeof v !== 'number' || (now - v) >= windowMin * 60 * 1000) delete sd.ownerAlerts[k];", ""),
    'H3: oneLine keeps line separators': code(BOA, ".replace(/[\\s\\u0085\\u2028\\u2029]+/g, ' ')", ".replace(/ +/g, ' ')"),
    'H3: links not defanged': code(BOA, "x = x.replace(/\\b([a-z][a-z0-9+.-]{1,15}):\\/\\//gi, '$1[:]//')", "x = x"),
    'H3: bare domains only before a slash again': code(BOA, ".replace(/([A-Za-z0-9])\\.(?=[A-Za-z0-9])/g, '$1[.]')", ".replace(/\\.([a-z]{2,24})\\b(?=\\/|\\s|$)/gi, '[.]$1')"),
    'H3: detail not one-lined': code(BOA, "lines.push('detail: ' + oneLine(detail, 200))", "lines.push('detail: ' + detail)"),
    'EN-CD-3: no inbound fallback': code(BOA, "pick(st.sender_key, j.sender_key, inbound.sender_key)", "pick(st.sender_key, j.sender_key)"),
    'RM-1971: Resolve Date errors straight to Send Error Response': rewire(RD, 1, 'Send Error Response'),
    # WU-4 · F6 / RM-1921 / H6 / RM-1622 / RT4-b
    'F6: Resolve Date passes the raw time through': code(RD, "  slots: { ...s, date, time: TIME },", "  slots: { ...s, date },"),
    'F6: H:MM is not padded': code(RD, "(m[1].length === 1 ? '0' + m[1] : m[1])", "m[1]"),
    'F6: Merge Slots falls back to the stored time under a dropped one': code('Merge Slots', "j.time_dropped === true ? null : (fresh.time ?? stored.time ?? null)", "fresh.time ?? stored.time ?? null"),
    'F6: Reschedule Lookup reads the model\'s raw time from Validate Intent': code(RL, "const newTime = (rd.slots && rd.slots.time) || null;", "const newTime = (vi.slots && vi.slots.time) || null;"),
    'F6: the alert falls back to the item\'s own slots': code(BOA, "const slots = st.slots || rdSlots || {};", "const slots = st.slots || j.slots || {};"),
    'RM-1921: no dateExpr length bound': code(RD, "const EXPR_TOO_LONG = !!s &&", "const EXPR_TOO_LONG = false && !!s &&"),
    'H6: no control strip': code(MS, "text: (typeof norm0.text === 'string' ? norm0.text : '').replace(CTRL, '')", "text: (typeof norm0.text === 'string' ? norm0.text : '')"),
    'H6: the empty-message exit bypassed': rewire('Check Bot Guards', 0, 'Read Spend'),
    'H3: stored messages keep their line breaks': code(MS, "var cur=oneLine(norm.text).slice(0,80);", "var cur=String(norm.text||'').slice(0,80);"),
    'RM-1622: Save State blanks the pointer again': param('Save State', " || $('Merge State').first().json.state.gcal_event_id", ""),
    'RT4-b: the bare message id is claimed': param('Check Processed', "[$json.channel + ':' + $json.message_id,", "[$json.message_id,"),
    'EN-722-28: an Airtable comment back': code('Answer FAQ', "state'e/store'a YAZMAZ", "state'e/Airtable'a YAZMAZ"),
    'RM-2007: the clarify ask back to the greeting': code('Build Clarify State', "(collectingAsk() || cfg.messageTemplates.askIntent", "(cfg.messageTemplates.askIntent"),
    'Codex p1: the original text not consulted': code(RPA, "if (!tampered && t && t.length <= 80) {", "if (t && t.length <= 80) {"),
    'Codex p1: the reschedule marker survives a gap': code(MS, "(newSession && v === 'reschedule_ask') ? null : v", "v"),
    'Codex p1: same-day bookings not split by time': code(CL, "  if (saidTime) hit = hit.filter", "  if (false) hit = hit.filter"),
    'Codex p1: recent_messages not type-checked': code(BOA, "(typeof st.recent_messages === 'string' ? st.recent_messages : '')", "(st.recent_messages || '')"),
    'Codex p2: another service moved anyway': code(RL, "const otherService = rw._rewritten_from_book === true", "const otherService = false && rw._rewritten_from_book === true"),
    'Codex p2: the time filter only for several': code(CL, "  if (saidTime) hit = hit.filter", "  if (hit.length > 1 && saidTime) hit = hit.filter"),
    # WU-5 · SPEND
    'SPEND: the absolute value is written again': param('Record LLM Spend', "$json._delta,", "$json.cost_usd,"),
    'SPEND: the SQL overwrites instead of adding': code('Record LLM Spend', "SET cost_usd = salon.bot_metrics.cost_usd + EXCLUDED.cost_usd,", "SET cost_usd = EXCLUDED.cost_usd,"),
}


def run(path):
    return subprocess.run(['node', TEST, path], capture_output=True, text=True, timeout=600)


def main():
    base = json.load(open(STAGED, encoding='utf-8'))
    survivors = []
    with tempfile.TemporaryDirectory() as d:
        ctl = os.path.join(d, 'control.json')
        json.dump(base, open(ctl, 'w'))
        r = run(ctl)
        if r.returncode != 0:
            print('CONTROL RED — the unmutated staged export fails the test:\n' + r.stdout[-2000:])
            return 1
        print('control: green')
        for i, (label, fn) in enumerate(MUTANTS.items()):
            w = fn(copy.deepcopy(base))
            p = os.path.join(d, f'm{i}.json')
            json.dump(w, open(p, 'w'))
            r = run(p)
            fails = [l[2:].split(' (')[0] for l in r.stdout.splitlines() if l.startswith('✖ ') and 'failing tests' not in l]
            # killed = a named TEST failed (code-reviewer LOW-7): a crash before the tests run is not a kill
            red = r.returncode != 0 and bool(fails) and not any(f.startswith('tests/unit/') for f in fails)
            print(f"  {'killed  ' if red else 'SURVIVED'} {label}" + (f"  ← {fails[0][:70]}" if red and fails else ''))
            if not red:
                survivors.append(label)
    print(f'{len(MUTANTS) - len(survivors)}/{len(MUTANTS)} killed')
    return 1 if survivors else 0


if __name__ == '__main__':
    sys.exit(main())
