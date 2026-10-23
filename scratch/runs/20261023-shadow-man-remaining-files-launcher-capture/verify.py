"""Offline acceptance and bounded allocation verification; no runtime/network."""
import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2];BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def read(n):return json.loads((E/n).read_text())
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode()
def verify():
 base={p:a.split()[:3:2] for l in git('ls-tree','-r',BASE).splitlines() for a,p in [l.split('\t',1)]};idx={p:a.split()[:2] for l in git('ls-files','--stage').splitlines() for a,p in [l.split('\t',1)]};assert len(base)==8279
 for p,x in base.items():assert idx[p]==x,p
 full=read('full-accepted-manifest.json');missing=read('missing-238.json');new=list(map(json.loads,(E/'completed-new.jsonl').read_text().splitlines()));after=read('after-transfer.json')
 assert len(full)==2083 and sum(x['bytes'] for x in full)==186399681
 assert len(missing)==len(new)==238 and sum(x['expectedBytes'] for x in new)==32579084
 expected={x['path']:x for x in full};actual={x['path']:x for x in after['originals']};assert set(actual)==set(expected)
 for x in actual.values():assert x['bytes']==expected[x['path']]['bytes'] and x['sha256']==expected[x['path']]['sha256']
 assert {x['target'] for x in new}=={x['path'] for x in missing}
 for x in new:assert x['verified'] and x['sourceBytes']==x['yieldedBytes']==x['expectedBytes'] and x['sha256']==expected[x['target']]['sha256'] and x['destinationVerification']['sha256']==x['sha256']
 assert not (E/'first-transfer-failure.json').exists()
 r=read('final-rehash.json');assert r['passAll'] and r['preservedImmutableStageReceipts']==217 and r['checker']['exit']==0
 g=read('preguest.py-result.json');assert g['passAll'] and g['canonicalInputConsumed'] and g['cloneFiles']==2045 and g['compileRejectionControls']==5 and g['forwardingAssertions']==10
 assert g['allocation']['projectedTmpfs']<=939524096 and g['allocationBeforeSession']['tmpfsProjected']<=939524096
 dep=read('remote-dependency-preflight.json');assert dep['png']['roundTrip'] and 'tools/ctl.js' in dep['visited'] and len(dep['visited'])==121
 consumed=list(map(json.loads,(E/'remote-module-consumption.jsonl').read_text().splitlines()));assert any(x['event']=='canonical-input-consumed' and x['sha256']==g['moduleSHA256'] for x in consumed)
 s=read('remote-session-result.json');assert s['guestSessionAttempts']==1 and s['boundPassed'] and s['elapsedSeconds']<90 and not s['remaining'] and s['parentOsExit']==-9 and s['endpointSeconds']<10 and s['launcherCaptureSeconds'] is None
 snap=json.loads(read('remote-launcher-live-snapshot.json')['stdout']);assert any(x['title']=='ShadowMan Launcher' and x['visible'] for x in snap['windows'])
 assert 'id=1024' in (E/'remote-session.log').read_text() and read('remote-live-operator-failure.json')['detail']=='launcher controls unavailable'
 assert not list(E.glob('*.png'))
 f=read('final-remote-integrity.json')['final'];assert not f['ownedGroups'] and not f['nodeProcesses'] and f['immutableReadOnly'] and f['cloneFiles']==2045 and f['tmpfsCap']==939524096 and f['tmpfsUsed']<939524096 and f['fixedAllocated']<100663296 and f['immutableAllocated']<2147483648 and f['freeBytes']>2147483648
 b=read('box-final.json')['sandbox'];assert b['id']=='bx_vufrds5w' and b['state']=='idle' and b['health']=='ok' and b['stop'] is None and b['archiveAfter']=='2026-10-23T01:36:17.590Z'
 if (E/'protected-finishing.json').exists():
  for x in read('protected-finishing.json'):assert (sha(pathlib.Path(x['path'])) if pathlib.Path(x['path']).is_file() else None)==x['sha256']
 if (E/'evidence-manifest.json').exists():
  for x in read('evidence-manifest.json'):assert (E/x['path']).stat().st_size==x['bytes'] and sha(E/x['path'])==x['sha256']
 a=read('admission.json');donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors']};own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=sum(donors.values())+own+a['toolsAllowance']+a['rootAllowance']+a['reserve']
 assert total<67108864 and own<=11534336 and shutil.disk_usage(W).free>=2982150144
 return dict(passAll=True,restorationComplete=True,originalFiles=2083,originalBytes=186399681,newFiles=238,newBytes=32579084,immutablePriorReceiptsMatched=217,preguestGate=True,basePathsPreserved=8279,guestAttempts=1,failedCaptureWorkflows=1,pngCommands=0,pngFiles=0,configurationActions=0,gameLaunches=0,transferFailures=0,retries=0,ownedGroups=[],box='RUNNING',captureAcceptance=False,ownAllocated=own,wholeLocalWithReserve=total,reserve=a['reserve'],cap=67108864,hostFree=shutil.disk_usage(W).free,metadataProtectionScope='finishing/publication interval only')
if __name__=='__main__':
 v=verify();(E/'verification.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v))
