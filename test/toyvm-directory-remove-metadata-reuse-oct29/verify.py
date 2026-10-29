"""Verify retained evidence only; no production runner/backend execution."""
import hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
def load(name):return json.loads((ROOT/name).read_text())
def verify():
 manifest=load('raw-manifest.json')
 for name,pin in manifest['files'].items():
  data=(ROOT/name).read_bytes()
  assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'],name
 assert sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file())<1048576
 api=load('raw/runtime-api.json');r=load('raw/runtime-observer.json');c=load('runtime-canonical.json');d=load('dispatch.json');o=load('source-phase-oracle.json')
 assert api['exitCode']==0 and not api['launcherFailed'] and not api['stdoutTruncated'] and json.loads(api['stdout'])==r
 assert r['gatePASS'] is True and r['productionInvocations']==1 and r['cliExit']==0 and r['safetyCleanup'] is None
 assert r['candidate']==d['candidate']==c['candidate']
 report=json.loads((ROOT/'raw/cli.stdout').read_text());assert report==r['report']
 assert report['accepted'] is True and report['cleanupComplete'] is True and report['failures']==[]
 br=report['backendReceipt'];fs=br['filesystem']
 assert br['exit']==0 and br['stopReason'] is None and br['cleanupComplete'] is True and fs['failure'] is None
 assert {k:fs[k] for k in o['postReap']}==o['postReap']==c['postReap']
 assert json.loads(r['fixtureOutput'])=={'checkpoint':'rmdir-reuse-complete','removedE':True,'recreatedF':True}
 assert r['remainingMounts']==[] and br['filesystemCleanup']['remainingMounts']==[] and br['filesystemCleanup']['unmountExit']==0
 assert r['observedIdentities'] and all(x['absentOrReused'] and x['finalState'] is None for x in r['observedIdentities']) and r['productionOwnedIdentityCheck'] is True
 assert r['pins']==d['sourcePins'] and all(r['sourceAfter'][p]==pin['sha256'] for p,pin in d['sourcePins'].items())
 assert report['browserAllowed'] is False and report['browserAllowanceRemaining']=={'cpuSeconds':35.353183,'wallSeconds':101.495550694,'captures':1}
 controls=load('source-phase-independent.json');assert controls['PASS'] is True and all(controls['controls'].values()) and controls['oracle']==o
 life=load('lifecycle-receipt.json');s=life['actualInfo']['sandbox']
 assert life['verifiedStopped'] is True and s['id']=='bx_47z2wx6m' and s['state']=='stopped' and s['snapshotAvailable'] is True and s['snapshotVerifiedAt']
 assert s['stop']['status']=='completed' and s['stop']['forced'] is False
 assert c['result']=='PASS' and c['socketBytes']==23
 print(json.dumps({'PASS':True,'productionInvocations':1,'retainedEvidenceOnly':True,'box':s['id'],'state':s['state']}))
if __name__=='__main__':verify()
