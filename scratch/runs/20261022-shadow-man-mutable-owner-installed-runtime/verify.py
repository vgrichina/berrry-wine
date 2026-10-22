"""Offline verification of bounded correction, first blocker and preservation."""
import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def read(n):return json.loads((E/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode()
def verify():
 c=read('mutable-owner-api.json');assert c['exitCode']==0;r=json.loads(c['stdout'])
 assert r['beforeUid']==0 and r['afterUid']==r['workerUid']==1000 and r['afterGid']==r['workerGid']==1000
 assert r['mode']=='0o755' and r['tmpfsCap']==939524096 and r['beforeUsed']==0
 assert r['chown']['exit']==0 and r['ordinaryWriteProbe'] and r['probeDeleted'] and r['cloneComplete']
 assert r['chown']['command']==['sudo','-n','chown','1000:1000','--','/home/user/shadow-man-streamed-installed-runtime-oct22/mutable']
 gate=read('preguest-gate.json');review=read('gate-review.json');assert gate['passAll'] and review['fullCommandGate']=='FAIL'
 assert review['verdict']=='BLOCKED_REQUIRED_RUNTIME_DATA' and review['commandAttempts']==1 and review['guestWasmInstances']==0
 assert gate['runtimePaths']==158 and gate['codecFiles']==23 and gate['cloneFiles']==2045
 assert gate['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 assert gate['canonicalInputFixture']['exit']==0 and json.loads(gate['canonicalInputFixture']['stdout'])['guestInstances']==0
 cmd=gate['command'];assert '--no-build' in cmd and any(x.startswith('--wasm=') and x.endswith('/immutable/runtime/build/wine-assembly.wasm') for x in cmd)
 assert '--real-ticks' in cmd and '--pipe-child-args=--real-ticks' in cmd and '--spawn-processes' in cmd
 assert len(set(gate['portsFreeAtGate']))==2
 fixtures=json.loads(read('remote-fixtures-api.json')['stdout'].split('\n',1)[1])
 for k,v in fixtures.items():assert v['exit']==0
 assert json.loads(fixtures['forwarding-fixture.cjs']['stdout'])['assertions']==10
 assert json.loads(fixtures['guard-fixture.cjs']['stdout'])['rejectingControls']==5
 assert gate['png']['roundTrip']
 run=read('owner-session-result.json');assert run['reason']=='first-real-error' and run['boundPassed'] and run['elapsedSeconds']<90
 assert run['remaining']==[] and run['parentOsExit']==-15 and run['guestSessionAttempts']==1
 assert 'stdole2.tlb' in run['firstFailure']['line'] and 'ENOENT' in run['firstFailure']['line']
 log=(E/'owner-session.log').read_text();assert 'test/run.js:2842:32' in log and 'ENOENT' in log
 events=[json.loads(x) for x in (E/'module-consumption.jsonl').read_text().splitlines()]
 launch=[x for x in events if x['pid']==run['pgid']];assert [x['event'] for x in launch]==['command-file-verified']
 h=read('handback.json');assert h['ownedGroups']==[] and h['immutableReadOnly'] and h['restoredFilesRehashed']==2083 and h['runtimeFilesRehashed']==158 and h['codecFilesRehashed']==23
 assert h['registryCloneSHA256']==h['registryOriginalSHA256']==gate['registrySHA256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
 assert h['tmpfsCap']==939524096 and h['tmpfsUsed']==183590912 and h['mutableUid']==h['mutableGid']==1000 and h['mutableMode']=='0o755'
 assert h['immutableAllocated']<2147483648 and h['fixedAllocated']+16777216<100663296 and h['freeBytes']>=2147483648
 assert gate['projectedTmpfs']==885211136<939524096 and 100663296+939524096+33554432==1073741824
 box=read('box-final.json');assert box['id']=='bx_rp3s5k54' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None and box['archiveAfter']=='2026-10-23T01:30:59.916Z'
 for p in read('protected-before.json'):
  f=pathlib.Path(p['path']);assert (sha(f) if f.is_file() else None)==p['sha256'],p['path']
 for x in read('unchanged-controls.json'):
  f=E/('accepted-'+x['file'])
  if f.exists():assert sha(f)==x['sha256']
 tree={p:[a.split()[0],a.split()[2]] for l in git('ls-tree','-r',BASE).splitlines() for a,p in [l.split('\t',1)]}
 index={p:a.split()[:2] for l in git('ls-files','--stage').splitlines() for a,p in [l.split('\t',1)]}
 for p,v in tree.items():assert index[p]==v,p
 assert len(tree)==8279
 a=read('admission.json');own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors']}
 total=own+sum(donors.values())+a['rootInputs']+a['toolsAllowance']+a['reserve']+1048576
 assert own<=a['newTaskAllowance'] and total<67108864 and shutil.disk_usage(W).free>=2982150144
 return dict(passAll=True,verdict=review['verdict'],ownershipCorrection='PASS',fullCommandGate='FAIL; mandatory data missing',commandAttempts=1,guestInstances=0,basePathsPreserved=len(tree),protectedMetadata='UNCHANGED',ownedGroups=[],ownAllocated=own,donors=donors,wholeLocalIncludingReserveAndPublication=total,cap=67108864,hostFree=shutil.disk_usage(W).free)
if __name__=='__main__':
 r=verify();(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
