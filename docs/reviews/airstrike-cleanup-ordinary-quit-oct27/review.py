import json,hashlib,pathlib
from run import H,R,dump
D=R/'docs/reviews/airstrike-cleanup-ordinary-quit-oct27'
rows=json.loads((D/'manifest.json').read_text())
for x in rows:
 p=D/x['path'];assert p.stat().st_size==x['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']
q=json.loads((D/'boundary-result.json').read_text())
assert q['fixtureOnly'] and not q['actualGuestStarted'] and q['requiredPNG']==16 and q['allowedPNG']==8
assert q['result']['cleanup']['complete'] and q['result']['status']=='refused'
assert len(list((D/'fixture').rglob('capture-*.png')))==8
assert not any(x['cmd']=='keydown:13' for x in q['inputs'])
dump('integrity.json',dict(payloads=len(rows),mismatches=0,fixtureOnly=True,actualGuestStarts=0,captures=8,ninthRejectedBeforeDispatch=True,sourceEdits=0,normalQuitQualified=False))
print('PASS',len(rows),'payloads, eight fixture captures, ninth rejected; guest Quit OPEN')
