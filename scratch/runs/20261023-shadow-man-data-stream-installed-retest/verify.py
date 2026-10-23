"""Offline provenance, accepted controls, receipt, allocation and index checks."""
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
  assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['gitBlob']==git('ls-tree',BASE,'--',x['path']).split()[2]
 for x in read('accepted-controls.json'):assert sha(pathlib.Path(x['path']))==x['sha256']
 for x,y in zip(m['files'],read('uploaded.json')):assert x['bytes']==y['bytes'] and x['sha256']==y['sha256'] and y['path'].endswith('/'+x['path'])
 for n in ['prepare-api.json','restore-api.json','data-gate-api.json','complete-gate-api.json','session-api.json','handback-api.json']:assert read(n)['exitCode']==0
 d=json.loads(read('data-gate-api.json')['stdout']);assert d['passAll'] and d['files']==27
 h=read('handback.json');assert h['passAll'] and h['preexistingImmutableFilesRehashed']==2273 and h['mutableCloneFilesRehashed']==2045 and h['immutableReadOnly']
 assert h['registrySHA256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3' and h['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 assert not h['ownedGroups'] and not h['nodeProcesses'] and h['immutableAllocated']<2147483648 and h['fixedAllocated']<100663296 and h['tmpfsUsed']<h['tmpfsCap']==939524096 and h['freeBytes']>2147483648
 r=read('stream-session-result.json');assert r['guestSessionAttempts']==1 and r['boundPassed'] and r['elapsedSeconds']<=90 and r['remaining']==[] and r['reason']=='operator-first-boundary'
 assert read('stream-operator-stop.json')['reason']=='first-new-loader-data-warning'
 log=(E/'stream-session.log').read_text();assert 'comctl32.dll is loaded as a real PE but is not on disk' in log and 'ole32.dll is loaded as a real PE but is not on disk' in log
 events=[json.loads(l) for l in (E/'observer.jsonl').read_text().splitlines()];assert sum(x['kind']=='module-instance' for x in events)==1 and not any(x['kind']=='fork' for x in events)
 b=read('box-final.json')['sandbox'];assert b['id']=='bx_rp3s5k54' and b['state']=='idle' and b['health']=='ok' and b['stop'] is None and b['archiveAfter']=='2026-10-23T01:30:59.916Z'
 tree={p:a.split()[:3:2] for l in git('ls-tree','-r',BASE).splitlines() for a,p in [l.split('\t',1)]};index={p:a.split()[:2] for l in git('ls-files','--stage').splitlines() for a,p in [l.split('\t',1)]}
 assert len(tree)==8279
 for p,v in tree.items():assert index[p]==v,p
 a=read('admission.json');donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors']};own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=sum(donors.values())+own+a['rootInputs']+a['toolsAllowance']+a['reserve']+a['rootData']+a['buffers']+1048576
 assert own<a['ownAllowance'] and total<67108864 and shutil.disk_usage(W).free>2982150144
 # Earlier protected metadata is still checked read-only; no root/donor Git mutation.
 old=pathlib.Path('/home/user/wine-assembly-shadow-man-runtime-data-installed-retest-oct23/scratch/runs/20261023-shadow-man-runtime-data-installed-retest/protected-metadata.json')
 for x in json.loads(old.read_text()):
  p=pathlib.Path(x['path']);assert (sha(p) if p.is_file() else None)==x['sha256'],str(p)
 return dict(passAll=True,basePathsPreserved=len(tree),localMainDataMatches=27,uploads=27,guestInstances=1,gameLaunches=0,ownedGroups=[],box='RUNNING',elapsedSeconds=r['elapsedSeconds'],wholeLocalWithReserveAndPublication=total,ownAllocated=own,hostFree=shutil.disk_usage(W).free,protectedMetadata='UNCHANGED')
if __name__=='__main__':
 r=verify();(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
