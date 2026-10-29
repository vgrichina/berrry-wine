import json,pathlib,hashlib
P=pathlib.Path(__file__).resolve().parent
x=json.loads((P/'evidence/remote-result.json').read_text());d=json.loads((P/'evidence/dispatch.json').read_text());b=x['report']['backendReceipt'];f=b['filesystem']
assert x['productionInvocations']==1 and x['gatePASS'] is False and x['cliExit']==1
assert b['stopReason']==f['failure']=='filesystem allocation limit'
assert (f['live'],f['peak'],f['written'],f['inodes'],f['openHandles'])==(20480,32768,16384,3,0)
assert x['safetyCleanup'] is None and x['remainingMounts']==[] and x['productionOwnedIdentityCheck']
assert all(i['absentOrReused'] for i in x['observedIdentities']) and x['report']['cleanupComplete']
m=json.loads(x['fixtureOutput']);assert m['checkpoint']=='before-C-write' and m['oldBOpen'] and m['oldBLinks']==0 and m['oldBSize']==8192 and m['renamedInode']==m['newBInode']
for k in ['runtimeFixture','runtimeObserver']:
 p=P/('fixture.py' if k=='runtimeFixture' else 'runtime-observer.py');v=p.read_bytes();assert len(v)==d[k+'Pin']['bytes'] and hashlib.sha256(v).hexdigest()==d[k+'Pin']['sha256']
assert all(x['sourceAfter'][k]==v['sha256'] for k,v in d['sourcePins'].items())
s=json.loads((P/'evidence/actual-stopped.json').read_text());assert s['state']=='stopped' and s['snapshotAvailable'] and s['lastSnapshotStatus']=='completed'
print('Recorded FAIL and preserved evidence verified; acceptance remains FAIL')
