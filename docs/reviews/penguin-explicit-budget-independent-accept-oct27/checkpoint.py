import hashlib,json,os,time
from pathlib import Path
R=Path('/tmp/penguin-explicit-budget-independent-accept-oct27');O=R/'ops'
passed=[]
for name in ('independent','independent-reserve-corrected','independent-reconstruction'):
 raw=(O/(name+'.stderr')).read_text()
 for line in raw.splitlines():
  if line.startswith('test_') and line.endswith(' ... ok'):passed.append(line.split(' ')[0])
assert len(set(passed))==10
mutants=json.loads((O/'independent-mutations.json').read_text());assert len(mutants)==4
for v in mutants:assert v['failures']>0 and v['errors']==0
reused=json.loads((O/'reused-groups.json').read_text())
first=json.loads((O/'first-production-default.json').read_text());assert first['exit']==2 and first['cleanupComplete'] and first['stopReason'] is None
explicit=json.loads((O/'first-production-explicit.json').read_text());assert explicit['exit']==0 and explicit['cleanupComplete'] and explicit['stopReason'] is None
for key,blob in {'tools/penguin_capture_contract.py':'a2f4edbdbb13342ce5d47b7963c8f3fffcc51c8d','test/test_penguin_capture_contract.py':'a89cdd66d24f97c6929031e41bb185051543c655','test/fixtures/penguin-wire-envelope.json':'37ef0f3d0247eed97f6fa26a8902eecb51ddcd10'}.items():
 data=(Path('/tmp/penguin-explicit-capture-budget-repair-oct27/repo')/key).read_bytes()
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==blob
assert (O/'independent-reserve-corrected.json').exists()
checkpoint=dict(status='ACCEPT_SOURCE_ONLY',candidate='7378523e65935406837a80ecd800040b660ccf1a',sourceSHA256='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b',testSHA256='455a24b0c71f39d9544a4020ae832375260f2338ddc2785c7bfa07d0ec2baf7b',fixtureSHA256='30df71f26400cd565268c22c9a42ea159233c50ed5ee2069375a53f84a5b4066',newMethods=sorted(set(passed)),newIndependentTests=10,newRejectingControls=4,reusedTests=16,reusedControls=4,verifiedDonorPayloads=96,productionDefault='UNSUPPORTED_PLAN default 1048576; exact unchanged CLI first',productionExplicit='191 full serialized envelopes; previous333 + raw2130054 + terminal1048576 =3178963 charged once; originals byte/hash exact',remaining=['coordinator-scoped integration','exact live Node startup with diagnostics and limits','canonical filename-bearing mount validation','actual runtime startup/input','new projectile/gameplay observations','ordinary Quit'],noGuestOrBoxes=True,lifecycle='coordinator; no boxes assigned or touched',incidents=['Read-only optional receipt lookup used wrong .admission filename; correct sibling -admission receipt used before tests','Git alternate nesting warnings retained; exact candidate source blob identity independently checked, no fetch/repack/donor modification','Independent exact-reserve fixture accidentally supplied24 bytes against23; original error and original test source retained; corrected to asserted23 then affected method passed'],contractScope='Fresh authorized tasks supply correct prior used bytes. Supported CapturePlan reconstruction and partial ProviderCapture deepcopy preserve pins/ledger; no arbitrary-Python/object.__setattr__ security claim, no manual state reset or caller reinitialization guarantee.',at=time.time())
checkpoint['incidents'].append('Packaging caught operation receipt overwriting identically named semantic checkpoint; kept the failure, moved semantic data to acceptance-checkpoint.json, and rebuilt metadata without rerunning acceptance')
checkpoint['incidents'].append('Staged diffcheck found unittest failure diagnostics with trailing spaces; original ops bytes retained, report stores lossless JSON strings with SHA256 instead; no source/test change')
tmp=O/'acceptance-checkpoint.tmp';tmp.write_text(json.dumps(checkpoint,indent=2));tmp.replace(O/'acceptance-checkpoint.json')
print('ACCEPT_SOURCE_ONLY: 10 independent methods + 4 rejecting mutants, 16 tests + 4 controls reused')
