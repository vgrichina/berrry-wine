#!/usr/bin/env python3
"""Validate this blocker evidence, without repeating admission or native work."""
import hashlib,json,pathlib
H=pathlib.Path(__file__).resolve().parent
def load(n):return json.loads((H/n).read_text())
p=load('preflight.json');r=load('consolidated-preflight.receipt.json')
assert p['verdict']=='BLOCKED_NATIVE_MEMAVAILABLE'
assert p['freshNativeMemAvailableBytes']==1229799424
assert p['nativeMinimumBytes']==1610612736
assert p['nativeDeficitBytes']==380813312
assert p['nativeCommandsExecuted']==[]
assert r['exit']==r['childExit']==125 and r['reason'] is None
assert r['reaped'] and r['remaining']==[]
assert 'BLOCKED_NATIVE_MEMAVAILABLE' in r['stdout']
n=load('installed-node-dependencies.receipt.json');a=load('accepted-contract.json')
assert n['exit']==0 and n['reaped'] and n['remaining']==[]
assert n['argv'][1]=='--max-old-space-size=256'
assert not load('installed-node-dependencies.json')['arenaConstructed']
assert not load('installed-node-dependencies.json')['nativeModuleCompiled']
assert all(x['loaded'] for x in load('installed-node-dependencies.json')['core'])
assert a['module']['sha256']=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
assert a['module']['bytes']==1879746
assert len(a['imports'])==291 and len(a['types'])==172
assert sum(e['kind']==0 for e in a['exports'])==2227
assert a['layout']['payload']=='9a3bc9149d58209c'
assert len(a['layout']['regions'])==269 and a['noStart']
old=next(x for x in p['focusedManifest'] if x['path'].endswith('/guard.py'))
assert hashlib.sha256((H/'guard-at-preflight.py').read_bytes()).hexdigest()==old['sha256']
assert p['projectedPeakBytes']<=p['capBytes']
assert p['hostAfterEntireProjectionBytes']>=p['hostFloorBytes']
for f in H.glob('*.receipt.json'):
    j=json.loads(f.read_text());assert j['reaped'] and j['remaining']==[],str(f)
    assert j['aggregateAfter']<=524288,str(f)
print('BLOCKER_EVIDENCE_VALID; admission denied before native entry; handler acceptance remains unexecuted')
