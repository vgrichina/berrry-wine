"""Validate the retained single invocation; never rerun production."""
import ast,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
def verify():
 c=json.loads((HERE/'evidence/canonical-receipt.json').read_text())
 r=json.loads((HERE/'evidence/runtime-result.json').read_text())
 assert c['gatePASS'] and r['gatePASS'] and r['productionInvocations']==1
 assert hashlib.sha256((HERE/'evidence/runtime-result.json').read_bytes()).hexdigest()==c['runtimeSHA256']
 for name,key in [('fixture.py','fixturePin'),('runtime-observer.py','observerPin')]:
  b=(HERE/name).read_bytes();assert len(b)==c[key]['bytes'] and hashlib.sha256(b).hexdigest()==c[key]['sha256'];ast.parse(b)
 assert "'/tmp/tvft2/w/domain/A'" in (HERE/'fixture.py').read_text()
 report=json.loads((HERE/'evidence/cli.stdout').read_text());assert report==r['report'] and r['cliExit']==1
 assert r['fixtureOutput']=='FTRUNCATE_ATTEMPTED_SIZE:16385\n'
 br=report['backendReceipt'];fs=br['filesystem']
 assert report['accepted'] is False and br['stopReason']==fs['failure']=='filesystem per-file limit'
 assert {k:fs[k] for k in ['live','peak','written','openHandles','inodes']}==dict(live=8192,peak=8192,written=0,openHandles=0,inodes=2)
 assert report['cleanupComplete'] and br['cleanupComplete'] and r['productionOwnedIdentityCheck']
 assert r['observedIdentities'] and all(x['absentOrReused'] for x in r['observedIdentities'])
 assert not r['remainingMounts'] and r['safetyCleanup'] is None
 assert r['pins']==c['sourcePins'] and all(r['sourceAfter'][k]==v['sha256'] for k,v in c['sourcePins'].items())
 assert r['socketBytes']==24 and report['browserAllowanceRemaining']==dict(cpuSeconds=35.353183,wallSeconds=101.495550694,captures=1)
 s=json.loads((HERE/'evidence/actual-stopped.json').read_text())
 assert s['id']==c['box'] and s['state']=='stopped' and s['lastSnapshotStatus']=='completed' and s['snapshotVerifiedAt']
 print('PASS: retained production ftruncate rejection, pins, accounting, cleanup, stopped state')
if __name__=='__main__':verify()
