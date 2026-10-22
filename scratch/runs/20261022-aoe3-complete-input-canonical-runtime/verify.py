#!/usr/bin/env python3
import hashlib,json
from pathlib import Path
E=Path(__file__).resolve().parent
def sha(b):return hashlib.sha256(b).hexdigest()
def check(data,row):
    assert len(data)==row['bytes'] and sha(data)==row['sha256']
seals=json.loads((E/'evidence-seals.json').read_text())
for name,row in seals.items():
    p=E/name;assert p.resolve().is_relative_to(E) and not p.is_symlink();check(p.read_bytes(),row)
b=json.loads((E/'build-result.json').read_text())
assert b['revision']=='c7fae5ac7ea9e29dfa3f83a7c2bd87d092e0b3b2' and b['exitCode']==0 and b['buildAttempts']==1
assert b['outputs']['build/wine-assembly.wasm']['sha256']=='6ac6b43475d9217ffffa98aaec3f57243de47c78c0647dcd31abef404e008678'
for name in ['staged-closure-verification.json','post-build-closure-verification.log']:
    raw=(E/name).read_text();c=json.loads(raw[raw.index('{'):]);assert c['result']=='PASS' and c['files']==3420 and c['historyAndAcceptedAncestry']=='PASS' and c['stagedRootVerified']=='/home/user/aoe3-canonical-c7fae5ac-staged'
for name in ['original-pins-before.log','original-pins-after-stage.log','original-pins-after-build.log']:
    assert (E/name).read_text().startswith('PASS 373')
assert 'index check only' not in (E/'api-history-preflight.log').read_text()
raw=(E/'canonical-build.log').read_bytes();row=seals['canonical-build.log']
try:check(raw+b'changed',row)
except AssertionError:pass
else:raise AssertionError('evidence mutation accepted')
try:check(raw,dict(row,sha256='0'*64))
except AssertionError:pass
else:raise AssertionError('forged seal accepted')
print('PASS evidence seals, exact canonical build, complete staged pre/post closure, history, 373 pins; mutated log and forged seal REJECT')
