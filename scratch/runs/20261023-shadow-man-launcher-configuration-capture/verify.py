"""Offline integrity/admission checks; no guest, compile, or network access."""
import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BASE='58e90870a40a541a4083cae5e987ca8de31889e6'
def read(n):return json.loads((E/n).read_text())
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode()
def verify():
 tree={p:a.split()[:3:2] for l in git('ls-tree','-r',BASE).splitlines() for a,p in [l.split('\t',1)]};index={p:a.split()[:2] for l in git('ls-files','--stage').splitlines() for a,p in [l.split('\t',1)]}
 assert len(tree)==8279
 for p,x in tree.items():assert index[p]==x,p
 for x in read('protected-before.json'):
  p=pathlib.Path(x['path']);assert (sha(p) if p.is_file() else None)==x['sha256'],str(p)
 runtime=read('runtime-manifest.json');assert len(runtime)==158
 donor=pathlib.Path('/home/user/wine-assembly-shadow-man-streamed-installed-runtime-oct22')
 for x in runtime:
  p=donor/'runtime'/x['path'];b=p.read_bytes();assert sha(p)==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['blob']==tree[x['path']][1]
 for x in read('codec-pins.json')['files']:
  p=donor/'runtime'/x['path'].removeprefix('runner/');assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
 for x in read('accepted/required-data-manifest.json')['files']:
  p=pathlib.Path(x['source']);assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'] and x['gitBlob']==tree[x['path']][1]
 old={x['path'].split('/immutable/restored/',1)[1]:x for x in map(json.loads,(donor/'scratch/runs/20261022-shadow-man-streamed-installed-runtime/transfer-files.jsonl').read_text().splitlines())}
 rows=list(map(json.loads,(E/'transfer-files.jsonl').read_text().splitlines()));assert len(rows)==1845
 for x in rows:
  y=old[x['path'].split('/immutable/restored/',1)[1]];assert x['bytes']==y['bytes'] and x['sha256']==y['sha256']
 h=read('handback.json');assert h['passAllRetained'] and not h['fullRestoration'] and not h['gatePassed'] and h['guestAttempts']==0 and h['gameLaunches']==0
 assert h['originalCompletedBytes']==sum(x['bytes'] for x in rows)==153820597
 assert h['actualRestoredFiles']==1845 and not h['unreceiptedFailedTarget']['exists'] and h['runtimeStagedRehashedFiles']==217
 assert h['immutableReadOnly'] and not h['tmpfsMounted'] and h['mutableAllocated']==4096 and not h['ownedGroups'] and not h['nodeProcesses']
 assert h['registry']['sha256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3' and h['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 assert h['immutableAllocated']<2147483648 and h['fixedAllocated']<100663296 and h['freeBytes']>=2147483648
 assert read('first-upload-error.json')['errorType']=='IncompleteRead' and read('restore-first-error.json')['files']==1845
 b=read('box-final.json')['sandbox'];assert b['id']=='bx_vufrds5w' and b['state']=='idle' and b['health']=='ok' and b['stop'] is None and b['archiveAfter']=='2026-10-23T01:36:17.590Z'
 a=read('admission-finishing.json');donors={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['wholeDonors']};own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=sum(donors.values())+a['nativeSelectedTotal']+own+a['toolsAllowance']+a['selectedRootInputsAllowance']+a['reserve']
 for p,n in a['nativeSelectedFiles'].items():assert (pathlib.Path(p).stat().st_blocks*512 if pathlib.Path(p).exists() else 0)==n
 assert sum(pathlib.Path(p).stat().st_blocks*512 for p in a['toolBinaries'])==a['toolBinaryAllocated']<a['toolsAllowance']
 for x in read('final-integrity.json')['files']:
  p=E/x['path'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],x['path']
 assert own<a['ownCheckoutEvidenceTempAllowance'] and total<67108864 and shutil.disk_usage(W).free>=2982150144
 return dict(passAll=True,basePathsPreserved=8279,protectedMetadata='UNCHANGED',completedOriginalsCompared=1845,runtimeSourcePins=158,codecPins=23,dataPins=27,completeGate=False,guestAttempts=0,failedRestoreAttempts=1,retries=0,box='RUNNING',ownedGroups=[],ownAllocated=own,wholeLocalWithReserve=total,cap=67108864,reserve=a['reserve'],hostFree=shutil.disk_usage(W).free)
if __name__=='__main__':
 result=verify();(E/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
