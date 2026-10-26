import pathlib,json,hashlib,subprocess,os
from common import *
G=O/'collected/guest';native=[json.loads(s) for s in (G/'native.jsonl').read_text().splitlines()];raw=[json.loads(s) for s in (G/'native.jsonl.raw.jsonl').read_text().splitlines()]
assert len(native)==3 and [n['kind'] for n in native]==['started','pending','rejected']
r=native[-1];d=r['historicalNativeRejection'];n=r['historicalNativeLatch'];s=r['historicalSelectLatch'];a=raw[-1]
assert r['batch']==36170 and n['status']==5 and n['event']==0
assert d==dict(schema='maelstrom-native-completion-rejection/v1',reason=3,predicate='uop',modeBits=4,expectedReturn=0x7a3362,observedReturn=0x7a3362,phase=3,completions=1,fault=0,active=0,capped=0)
assert all(v==0 for k,v in n.items() if k!='status')
assert a['scalars']['mne_rejectReason']==3 and a['scalars']['mne_rejectModes']==4 and a['stage']=='first-latch-rejection'
assert s['ret']==0x7a3362 and s['phase']==3 and s['token']==7 and s['parks']==6 and s['entries']==7 and s['result']==0
assert raw[1]['verified']['authenticLoadedAnchors']==True
assert a['moduleBases']['msvcrt']['loadAddr']==0x522000 and a['moduleBases']['sdl_net']['loadAddr']==0x7a2000
anchors={x['va']:x['bytes'] for x in a['anchors']}
assert anchors[0x52e430]=='e82274ffff83c008c3' and anchors[0x7a32f2]=='8b3d10407a00' and anchors[0x7a4010]=='30e45200'
terminal=json.load(open(G/'terminal.json'));assert terminal['returncode']==1 and not terminal['remainingGroup'] and terminal['reason']=='natural'
for x in json.load(open(O/'collected-manifest.json')):
 b=(O/'collected'/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
j=dict(status='FIRST_REJECTION_CAPTURED',candidate='44e344fdb26daab9a07210656597902ba27cb5f7',moduleSHA256='aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1',attempts=1,batch=r['batch'],firstRejection=d,rawNative=n,select=s,authenticLoadedAnchors=True,crtBase='0x522000',netBase='0x7a2000',errnoBeforeCMP=None,caller=None,meaning='Native completion rejected because uop_enabled is nonzero (mode bit4), before native errno/caller acquisition. Zero fields are uncaptured, not observed zero. Original loader anchors passed. No production defect or gameplay claim.',terminal=terminal,checks='Offline independent raw/adapter/anchor/process/hash consistency; no compilation or Wasm execution')
save('analysis.json',j);save('checkpoint-reviewed.json',dict(candidate=j['candidate'],guestAttempts=1,firstRejection=3,errnoCaller='UNKNOWN',loaderAnchors='PASS',cleanup='PASS',remainingRuntimeWork=False))
print(json.dumps(dict(status=j['status'],reason=3,predicate='uop',batch=r['batch'],errno=None,caller=None,allChecks=True)))
