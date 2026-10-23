"""Offline evidence/provenance/preservation verifier; no API or guest actions."""
import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def read(n):return json.loads((E/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode()
def verify():
 m=read('required-data-manifest.json');assert len(m['files'])==27 and m['totalBytes']==692498
 for x in [m['helper'],*m['files']]:
  p=pathlib.Path(x['source']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(p)==x['sha256']
  blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  assert blob==x['gitBlob']==git('ls-tree',BASE,'--',x['path']).split()[2]
 x=next(x for x in m['files'] if x['path'].endswith('stdole2.tlb'));assert x['bytes']==15088
 for x in read('accepted-controls.json'):assert sha(pathlib.Path(x['path']))==x['sha256']
 for x in read('protected-metadata.json'):
  p=pathlib.Path(x['path']);assert (sha(p) if p.is_file() else None)==x['sha256'],str(p)
 error=read('first-api-error.json');assert error['status']==400 and error['code']=='sandbox_direct_failed'
 g=read('coherent-gate.json');assert not g['passAll'] and g['stageRequests']==1 and g['stageRetries']==g['guestCommands']==g['guestInstances']==0
 h=read('handback.json');assert not any(h['requiredDataPresent'].values()) and len(h['requiredDataPresent'])==27
 assert h['immutableReadOnly'] and h['immutableAllocated']==205307904 and h['runtimeFilesRehashed']==158 and h['codecFilesRehashed']==23
 assert h['registryCloneSHA256']==h['registryOriginalSHA256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
 assert h['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 assert h['tmpfsUsed']==183590912 and h['tmpfsCap']==939524096 and h['mutableUid']==h['mutableGid']==1000 and h['mutableMode']=='0o755'
 assert h['nodeProcesses']==[] and h['freeBytes']>2147483648 and h['fixedAllocated']<100663296
 p=read('original-preservation.json');assert p['passAll'] and p['restoredFilesRehashed']==2083 and p['originalFilesMatched']==1959 and p['mutableCloneFilesRehashed']==2045
 b=read('box-final.json')['sandbox'];assert b['id']=='bx_rp3s5k54' and b['state']=='idle' and b['health']=='ok' and b['stop'] is None and b['archiveAfter']=='2026-10-23T01:30:59.916Z'
 c=read('closure-review.json');assert '--no-build' in c['command'] and '--spawn-processes' in c['command'] and '--real-ticks' in c['command'] and '--pipe-child-args=--real-ticks' in c['command']
 assert any(x.startswith('--wasm=') and x.endswith('/immutable/runtime/build/wine-assembly.wasm') for x in c['command'])
 tree={p:a.split()[:3:2] for l in git('ls-tree','-r',BASE).splitlines() for a,p in [l.split('\t',1)]}
 index={p:a.split()[:2] for l in git('ls-files','--stage').splitlines() for a,p in [l.split('\t',1)]}
 assert len(tree)==8279
 for p,v in tree.items():assert index[p]==v,p
 a=read('data-admission.json');own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0])
 donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors']}
 total=sum(donors.values())+own+a['rootInputs']+a['toolsAllowance']+a['reserve']+a['addedRootDataAllocated']+1048576
 assert own<=a['newTaskAllowance'] and total<67108864 and shutil.disk_usage(W).free>2982150144
 return dict(passAll=True,verdict=g['verdict'],basePathsPreserved=len(tree),localDataMainBlobMatches=27,stagingRequests=1,stagingRetries=0,guestCommands=0,ownedGroups=[],protectedMetadata='UNCHANGED',wholeLocalWith8MiBReserveAndPublication=total,ownAllocated=own,donors=donors,cap=67108864,hostFree=shutil.disk_usage(W).free)
if __name__=='__main__':
 r=verify();(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
