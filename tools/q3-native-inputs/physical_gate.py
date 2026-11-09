"""Read-only check of the exact actual commanded physical receipt."""
def physical_gate_code(out):
 return '''from pathlib import Path
import json
o=Path('''+repr(out)+''')
p=o/'input-positive-webgl-hold.json'
v=json.loads(p.read_bytes())
assert v['fixturePhysicalGate']=='PASS' and v['ok'] is True
assert v['attempted']==['Enter']
held=[s for s in v['samples'] if s['whollyDuringHold']]
assert held,'no wholly held sample'
for s in held:
 assert s['physical']==[{'key':13,'state':32768}],s
 source=s['physicalSource']
 assert source['kind']=='renderer-input.peekKeyDownState'
 assert all(source[k] for k in ['renderer','reader','worker','module','endpoint'])
 assert source==v['releaseSample']['physicalSource']
assert v['releaseSample']['physical']==[{'key':13,'state':0}]
assert json.loads((o/'reply-0.json').read_bytes())['ok'] is True
assert json.loads((o/'positive-control.json').read_bytes())['passed'] is True
assert json.loads((o/'local-controls.json').read_bytes())['passed'] is True
assert (o/'positive.png').stat().st_size>0
print(json.dumps(dict(passed=True,receipt=v,scope='actual renderer physical state only; guest polls/application UNKNOWN')))
'''
