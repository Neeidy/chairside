#!/usr/bin/env python3
"""NAME-CAPTURE R1 (docs/NAME-CAPTURE-PLAN.md 3.8; acceptance criterion 6): with the staged Main, `messageTemplates.askName`
is part of the config contract that scripts/render-client.py enforces — the render projects a client config onto the
committed literal's own key tree, so once that literal holds the key, a config without it is refused by name.

Rendered here against a temporary exports directory OUTSIDE the repo: the five committed exports with Main replaced by
the staged one (the render's --exports seam). Cases:
  1 the demo example renders, and its rendered Main Load Config carries the example's askName;
  2 example-b renders with B's own askName (a second client's text, not the demo's);
  3 a config WITHOUT askName is refused, naming the key, and nothing is written;
  4 control: the same config renders against the COMMITTED exports (today's literal has no askName) — so case 3's
    refusal is the staged edit's doing, not something else in that config.
After NAME-CAPTURE's promotion (2026-11-01) the committed exports ARE the edit, and case 4 no longer applies (skipped,
by checking the committed literal — not by the absence of a staged file, which a later staged edit brings back).
Run: python3 tests/unit/render-client-askname.test.py
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RENDER = os.path.join(ROOT, 'scripts', 'render-client.py')
STAGED = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
KEYS = ('drill-state', 'main', 'owner-actions', 'purge', 'reminders')
_s = importlib.util.spec_from_file_location('rc', RENDER)
RC = importlib.util.module_from_spec(_s)
_s.loader.exec_module(RC)   # import-safe: render-client keeps its work under main()
ok = True


def case(label, good, detail=''):
    global ok
    ok &= bool(good)
    print(f"{'✓' if good else '✗'} {label}" + ('' if good else f' — {detail}'))


def render(cfg_path, exports, out):
    r = subprocess.run([sys.executable, RENDER, '--config', cfg_path, '--out', out, '--exports', exports],
                       capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return r.returncode, r.stdout + r.stderr


def ask_name(out):
    wf = json.load(open(os.path.join(out, 'workflow.main.json'), encoding='utf-8'))
    code = next(n for n in wf['nodes'] if n['name'] == 'Load Config')['parameters']['jsCode']
    return RC.js_literal(RC.split_literal(code, 'main')[1]).get('messageTemplates', {}).get('askName')


def main():
    with tempfile.TemporaryDirectory(prefix='nc-render-') as d:
        exp_next, exp_now = os.path.join(d, 'next'), os.path.join(d, 'now')
        os.makedirs(exp_next); os.makedirs(exp_now)
        for k in KEYS:
            src = os.path.join(ROOT, 'n8n', f'workflow.{k}.sanitized.json')
            shutil.copy(src, os.path.join(exp_now, os.path.basename(src)))
            shutil.copy(STAGED if (k == 'main' and os.path.exists(STAGED)) else src, os.path.join(exp_next, os.path.basename(src)))
        for label, cfg in (('demo example', 'client.config.example.json'), ('example-b', 'client.config.example-b.json')):
            path = os.path.join(ROOT, 'config', cfg)
            want = json.load(open(path, encoding='utf-8'))['messageTemplates']['askName']
            out = os.path.join(d, f'out-{cfg}')
            rc, txt = render(path, exp_next, out)
            case(f'{label}: renders against the staged Main, its Load Config carries its OWN askName',
                 rc == 0 and ask_name(out) == want, f'rc {rc} {txt[-200:]}')
        a = json.load(open(os.path.join(ROOT, 'config', 'client.config.example-b.json'), encoding='utf-8'))
        case("example-b's askName is not the demo's text (a second client's copy)",
             a['messageTemplates']['askName'] != json.load(open(os.path.join(ROOT, 'config', 'client.config.example.json')))['messageTemplates']['askName'])
        del a['messageTemplates']['askName']
        noname = os.path.join(d, 'noname.json')
        json.dump(a, open(noname, 'w', encoding='utf-8'), ensure_ascii=False)
        out = os.path.join(d, 'out-noname')
        rc, txt = render(noname, exp_next, out)
        case('a config WITHOUT askName is refused against the staged Main, by name, and nothing is written',
             rc == 1 and 'messageTemplates.askName' in txt and not os.path.exists(out), f'rc {rc} {txt[-200:]}')
        # Only while the COMMITTED literal does not hold askName yet (NAME-CAPTURE unpromoted). Since its promotion on
        # 2026-11-01 the committed exports ARE that edit, so the control no longer applies — whatever staged edit exists.
        committed_lc = next(n for n in json.load(open(os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json'), encoding='utf-8'))['nodes']
                            if n['name'] == 'Load Config')['parameters']['jsCode']
        if os.path.exists(STAGED) and 'askName' not in RC.js_literal(RC.split_literal(committed_lc, 'main')[1]).get('messageTemplates', {}):
            out = os.path.join(d, 'out-noname-now')
            rc, txt = render(noname, exp_now, out)
            case('control: the same config renders against the COMMITTED exports (their literal has no askName yet)', rc == 0, f'rc {rc} {txt[-200:]}')
    print('render-client-askname: ' + ('OK' if ok else 'FAILED'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
