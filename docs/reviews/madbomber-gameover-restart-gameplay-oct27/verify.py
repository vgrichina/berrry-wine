import json,hashlib
from pathlib import Path
P=Path(__file__).parent
def read(n):return json.loads((P/n).read_text())
r=read('result.json');assert r['outcome']=='BLOCKED_LAUNCH_CAUSE_UNKNOWN' and r['acceptance']=='UNQUALIFIED'
assert r['guestAttemptsStarted']==0 and r['captures']==[] and r['ordinaryQuit'] is None
raw=(P/'runtime-manifest.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==r['closure']['manifestSha256']
rows=json.loads(raw);assert len(rows)==378 and sum(x['bytes'] for x in rows)==18611136
names=[x.get('target',x.get('dest')) for x in rows];assert len(set(names))==378
transfer=read('transfer-receipt.json');assert transfer['passAll'] and not transfer['bad'] and transfer['files']==378
startup=read('startup-receipt.json');assert startup['result']['exit']==0 and startup['result']['stopReason'] is None and startup['result']['cleanupComplete']
n=json.loads(startup['output']);assert n['flags']==['--max-old-space-size=512'] and n['node']=='v24.22.1'
assert 'Max data size             unlimited' in n['limits'] and 'Max address space         unlimited' in n['limits']
assert '4194304' in n['limits']
mount=read('mount-check.json');assert mount['pass'] and len(mount['files'])==149 and all(x['present'] for x in mount['files'])
assert all(not x for x in mount['parsedMounts'].values())
cleanup=read('launch-failure-readonly-check.json');assert not cleanup['outExists'] and not cleanup['ownProcesses'] and cleanup['terminal'] is None
assert (P/'guest-launch.json').stat().st_size==0
assert read('stage-supervision.json')['exit']==1 # preserve first packaging failure truthfully
assert read('finish-stage-supervision.json')['exit']==0
print('PASS: evidence consistency; gameplay remains UNQUALIFIED; no guest execution inferred')
