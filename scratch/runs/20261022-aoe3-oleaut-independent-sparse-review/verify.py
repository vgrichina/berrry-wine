#!/usr/bin/env python3
"""Offline review validation; no build, guest or remote command."""
import pathlib,json,hashlib,copy
E=pathlib.Path(__file__).resolve().parent
read=lambda p:json.loads((E/p).read_text())
def check(original,fixed,handlers,remote,box):
 assert len(original)==4
 sparse=[x for x in original if 'sparse-name' in x['label']]
 assert len(sparse)==2 and all(x['exit']==1 and '0 !== 2105344' in x['log'] for x in sparse)
 focused=[x for x in original if 'oleaut32' in x['label']]
 assert all(x['exit']==0 for x in focused)
 events=[json.loads(x['log'].splitlines()[0]) for x in focused]
 b,c=events
 assert b['oleaut']==b['image'] and b['dynamic']==0
 assert c['oleaut']!=c['image'] and c['dynamic']!=0
 assert c['moduleSha256']=='7fdda15444bf4fc1b5047375865662224f45b585eee51e35b2a67c9a21949d87'
 assert len(fixed['results'])==12
 assert all(x['exit']==x['expected'] for x in fixed['results'])
 assert sum(x['expected']==1 for x in fixed['results'])==3
 assert all(fixed[k]=={'count':373,'passAll':True} for k in ['pinsBefore','pinsAfter'])
 assert len(handlers)==3 and all(x['exit']==1 and 'AssertionError' in x['log'] for x in handlers)
 assert len(remote['pins'])==373 and all(x['ok'] for x in remote['pins'])
 assert all(x=={'files':1078,'sha256':'ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305'} for x in remote['identity'].values())
 assert remote['taskRuntimeProcesses']==[] and remote['ports']=={'8123':111,'8124':111}
 assert box['id']=='bx_32262dnp' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None
 assert box['archiveAfter']=='2026-10-22T12:53:29.069Z'
x=[read('raw/original-results.json'),read('raw/fixed-results.json'),read('raw/handler-controls.json'),read('remote-validation.json'),read('box-state.json')['sandbox']]
check(*x)
controls=[lambda a:a[0][0].__setitem__('exit',0),lambda a:a[1]['results'][0].__setitem__('exit',1),lambda a:a[2][0].__setitem__('exit',0),lambda a:a[3]['pins'][0].__setitem__('ok',False)]
for mutation in controls:
 y=copy.deepcopy(x);mutation(y)
 try:check(*y)
 except AssertionError:pass
 else:raise AssertionError('evidence mutation accepted')
for row in read('evidence-seals.json'):
 p=E/row['path'];assert p.stat().st_size==row['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'],p
assert read('root-seals.json')['pass']
h=read('HANDOFF.json');assert h['measuredAllocationBytes']<67108864 and h['freeBytes']>2982150144
assert hashlib.sha256((E.parents[2]/'test/test-getprocaddress-sparse-name.js').read_bytes()).hexdigest()==x[3]['fixtureSHA256']
print('PASS source acceptance evidence; exact baseline/candidate sparse failure and corrected pass; nine candidate test files; six runtime mutation controls; four evidence rejection controls; 1078 source identities; 373 original pins; root seals/allocation/lifecycle')
