import json, copy, sys, uuid
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_S = os.path.join(ROOT, 'n8n', 'staged', 'workflow.main.sanitized.json')
W = json.load(open(_S if os.path.exists(_S) else os.path.join(ROOT, 'n8n', 'workflow.main.sanitized.json')))
N = {n['name']: n for n in W['nodes']}
TEST = ['Empty Message?', 'Route Consent', 'Booking Declined?', 'Abort Cancel?', 'Abort Reschedule?', 'Booking Fresh?', 'Reschedule Fresh?']
nodes, conn = [], {}
def add(n): nodes.append(n); return n['name']
def code(name, js, pos): return add({'parameters': {'jsCode': js}, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': pos, 'id': str(uuid.uuid4()), 'name': name})
def link(a, i, b):
    m = conn.setdefault(a, {'main': []})['main']
    while len(m) <= i: m.append([])
    m[i].append({'node': b, 'type': 'main', 'index': 0})
add({'parameters': {'httpMethod': 'POST', 'path': 'hd-shapes', 'responseMode': 'lastNode', 'options': {}}, 'type': 'n8n-nodes-base.webhook', 'typeVersion': 2, 'position': [0, 0], 'id': str(uuid.uuid4()), 'name': 'Hook', 'webhookId': str(uuid.uuid4())})
code('Load Config', "return [{ json: { config: { business: { timezone: 'Europe/Vienna' } } } }];", [200, 0])
code('Prep', "return [{ json: $('Hook').first().json.body.item }];", [400, 0])
rules = [{'outputKey': t, 'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'combinator': 'and',
          'conditions': [{'id': str(uuid.uuid4()), 'leftValue': "={{ $('Hook').first().json.body.node === '%s' }}" % t, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}]}} for t in TEST]
add({'parameters': {'rules': {'values': rules}, 'options': {}}, 'type': 'n8n-nodes-base.switch', 'typeVersion': 3.4, 'position': [600, 0], 'id': str(uuid.uuid4()), 'name': 'Which'})
link('Hook', 0, 'Load Config'); link('Load Config', 0, 'Prep'); link('Prep', 0, 'Which')
for i, t in enumerate(TEST):
    n = copy.deepcopy(N[t]); n['position'] = [900, i * 300]; n['id'] = str(uuid.uuid4()); add(n); link('Which', i, t)
    outs = 3 if t == 'Route Consent' else 2
    for k in range(outs):
        nm = code(f'Out {i} {k}', "return [{ json: { node: %s, out: %d } }];" % (json.dumps(t), k), [1200, i * 300 + k * 90])
        link(t, k, nm)
wf = {'id': 'hdShapesWf000001', 'name': 'hd-shapes', 'active': False, 'nodes': nodes, 'connections': conn, 'settings': {'executionOrder': 'v1'}}
json.dump(wf, open(sys.argv[1] + '/wf.json', 'w'))
print(len(nodes))
