#!/usr/bin/env python3
"""N1 R1 (docs/N1-CONFIRM-NO-PLAN.md §4, acceptance criterion 7): with the staged Main, `messageTemplates.bookingDeclined`
and `messageTemplates.bookingDropped` are part of the config contract scripts/render-client.py enforces — the render
projects a client config onto the literal's own key tree, so once that literal holds a key, a config without it is
refused by name. tests/unit/render-client-askname.test.py's harness, for these two keys.

Rendered against a temporary exports directory OUTSIDE the repo: the five committed exports with Main replaced by the
staged one (the render's --exports seam). Cases:
  1 the demo example and example-b each render, and the rendered Main Load Config carries THEIR OWN two texts;
  2 example-b's two texts are not the demo's (a second client's copy);
  3 a config without either key is refused, naming that key, and nothing is written;
  4 control: the same config renders against the COMMITTED exports while their literal does not hold the keys yet — so
    case 3's refusal is the staged edit's doing. After the promotion the control no longer applies (skipped, by reading
    the committed literal, not by the absence of a staged file).
Run: python3 tests/unit/render-client-n1.test.py
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
N1 = ('bookingDeclined', 'bookingDropped')
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


def templates(path_or_code, rendered=True):
    code = path_or_code
    if rendered:
        wf = json.load(open(os.path.join(path_or_code, 'workflow.main.json'), encoding='utf-8'))
        code = next(n for n in wf['nodes'] if n['name'] == 'Load Config')['parameters']['jsCode']
    return RC.js_literal(RC.split_literal(code, 'main')[1]).get('messageTemplates', {})


def main():
    with tempfile.TemporaryDirectory(prefix='n1-render-') as d:
        exp_next, exp_now = os.path.join(d, 'next'), os.path.join(d, 'now')
        os.makedirs(exp_next); os.makedirs(exp_now)
        for k in KEYS:
            src = os.path.join(ROOT, 'n8n', f'workflow.{k}.sanitized.json')
            shutil.copy(src, os.path.join(exp_now, os.path.basename(src)))
            shutil.copy(STAGED if (k == 'main' and os.path.exists(STAGED)) else src, os.path.join(exp_next, os.path.basename(src)))
        cfgs = {}
        for label, cfg in (('demo example', 'client.config.example.json'), ('example-b', 'client.config.example-b.json')):
            path = os.path.join(ROOT, 'config', cfg)
            cfgs[label] = json.load(open(path, encoding='utf-8'))
            want = {k: cfgs[label]['messageTemplates'][k] for k in N1}
            out = os.path.join(d, f'out-{cfg}')
            rc, txt = render(path, exp_next, out)
            got = {k: templates(out).get(k) for k in N1} if rc == 0 else None
            case(f'{label}: renders against the N1 Main (staged, or committed after the promotion), its Load Config carries its OWN two decline texts',
                 rc == 0 and got == want, f'rc {rc} {txt[-200:]}')
        for k in N1:
            case(f"example-b's {k} is not the demo's text (a second client's copy)",
                 cfgs['example-b']['messageTemplates'][k] != cfgs['demo example']['messageTemplates'][k])
        committed_lc = next(n for n in json.load(open(os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json'), encoding='utf-8'))['nodes']
                            if n['name'] == 'Load Config')['parameters']['jsCode']
        unpromoted = os.path.exists(STAGED) and not any(k in templates(committed_lc, rendered=False) for k in N1)
        for k in N1:
            a = json.loads(json.dumps(cfgs['example-b']))
            del a['messageTemplates'][k]
            cfg = os.path.join(d, f'no-{k}.json')
            json.dump(a, open(cfg, 'w', encoding='utf-8'), ensure_ascii=False)
            out = os.path.join(d, f'out-no-{k}')
            rc, txt = render(cfg, exp_next, out)
            case(f'a config WITHOUT {k} is refused against the N1 Main (staged, or committed after the promotion), by name, and nothing is written',
                 rc == 1 and f'messageTemplates.{k}' in txt and not os.path.exists(out), f'rc {rc} {txt[-200:]}')
            if unpromoted:
                out = os.path.join(d, f'out-no-{k}-now')
                rc, txt = render(cfg, exp_now, out)
                case(f'control: the same config renders against the COMMITTED exports (their literal has no {k} yet)', rc == 0, f'rc {rc} {txt[-200:]}')
    print('render-client-n1: ' + ('OK' if ok else 'FAILED'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
