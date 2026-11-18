#!/usr/bin/env python3
"""Mutants of the HARDENING Owner Actions edit; each must turn tests/unit/hardening-owner.test.cjs red. Not in check-all.
Run: python3 -I tests/unit/hardening-owner-mutants.py   (exit 0 = all killed)"""
import copy, json, os, subprocess, sys, tempfile
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
base=json.load(open(R+'/n8n/staged/workflow.owner-actions.sanitized.json'))
S=[]
M={'30-day bound back':('Validate Release Target','jsCode',"age >= -CLOCK_SKEW_MS;","age >= -CLOCK_SKEW_MS && age <= 30 * 86400000;"),
   'future refusal dropped':('Validate Release Target','jsCode',"Number.isFinite(age) && age >= -CLOCK_SKEW_MS;","Number.isFinite(age);"),
   'reset dropped':('Release Handoff Lock','query',", turn_count = 0, confirm_turn = ''",""),
   'version token dropped':('Release Handoff Lock','query',"AND salon.at_ts(last_updated) = $2 ","")}
with tempfile.TemporaryDirectory() as d:
  for k,(n,f,o,nw) in M.items():
    w=copy.deepcopy(base); p=next(x for x in w['nodes'] if x['name']==n)['parameters']; assert p[f].count(o)==1,k; p[f]=p[f].replace(o,nw)
    fp=os.path.join(d,'m.json'); json.dump(w,open(fp,'w'))
    r=subprocess.run(['node',R+'/tests/unit/hardening-owner.test.cjs',fp],capture_output=True,text=True)
    red = r.returncode != 0 and any(l.startswith('✖ ') and 'failing tests' not in l and not l[2:].startswith('tests/unit/') for l in r.stdout.splitlines())   # a named test failed, not a crash
    print('killed' if red else 'SURVIVED',k); S.append(k) if not red else None
sys.exit(1 if S else 0)
