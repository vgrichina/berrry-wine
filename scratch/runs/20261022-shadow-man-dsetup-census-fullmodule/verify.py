#!/usr/bin/env python3
"""Offline identity/evidence verification; no build, guest or runtime access."""
import hashlib,json,os,pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];X=E/'remote-evidence'
C='7a21579f9adb208164312961c249a0aa9080a8b7';H='c2f50288da9e5a85995184c60bb2b94bdce35dd9';B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],env=ENV)
def tree(rev):
 out={}
 for row in git('ls-tree','-rz',rev).split(b'\0'):
  if row:
   meta,p=row.split(b'\t');mode,kind,oid=meta.decode().split();out[p.decode()]=(mode,oid)
 return out
def alloc(p):
 if not p.exists():return 0
 return p.lstat().st_blocks*512+(sum(alloc(q) for q in p.iterdir()) if p.is_dir() and not p.is_symlink() else 0)
def main():
 assert git('rev-parse',H+'^').decode().strip()==C
 assert git('rev-parse',C+'^').decode().strip()==B
 old=tree(C);new=tree('HEAD');assert not set(old)-set(new)
 assert [p for p in old if old[p]!=new[p]]==['tools/callback-ownership-census.json']
 assert all(p.startswith('scratch/runs/20261022-shadow-man-dsetup-census-fullmodule/') for p in set(new)-set(old))
 a=load(E/'census-before.json');b=load(R/'tools/callback-ownership-census.json');assert len(a['entries'])==len(b['entries'])==407
 changed=[]
 for before,after in zip(a['entries'],b['entries']):
  fields={k for k in set(before)|set(after) if before.get(k)!=after.get(k)}
  if fields:
   assert fields=={'sha256','reason'} and after['ownership']=='pending' and after['kind']=='host-entry'
   assert after['reason'].startswith(before['reason']);changed.append(before['file'])
 assert changed==['lib/process-boot.js','lib/storage.js']
 for seal in load(E/'seals.json'):
  assert sha(E/(pathlib.Path(seal['file']).name+'.sealed'))==seal['sha256']
  raw=(R/seal['file']).read_bytes();oid=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
  assert oid==old[seal['file']][1]
 m=load(X/'build-inputs.json');assert m['revision']==H and m['productionCandidate']==C and m['parent']==C and m['main']==B
 prior=pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-canonical-qualification-oct22/scratch/runs/20261022-shadow-man-dsetup-canonical-qualification/remote-evidence/build-inputs.json')
 original=load(prior);assert len(m['inputs'])==len(original['inputs'])==3426
 assert [x['path'] for x,y in zip(m['inputs'],original['inputs']) if x!=y]==['tools/callback-ownership-census.json']
 assert sum(x['bytes'] for x in m['inputs'])==m['bytes']
 testedTree=tree(H)
 for row in m['inputs']:assert (row['mode'],row['blob'])==testedTree[row['path']]
 attempt=load(X/'build-attempt.json')
 assert attempt['head']==H and attempt['parent']==C and attempt['productionCandidate']==C and attempt['main']==B
 assert attempt['command']==['bash','tools/build.sh'] and attempt['attempt']==1 and attempt['exit']==1
 assert not attempt['outputs'] and not attempt['changedClosureInputs'] and attempt['guard'] is None
 assert sha(X/'canonical-build.log')==attempt['logSHA256']
 log=(X/'canonical-build.log').read_text();assert '407 source boundaries unchanged' in log and 'no longer references $DX_VERSION_INFO' in log
 assert load(X/'blocker-details.json')['firstFailedCommand']==['node','tools/check-region-decls.js','--check-owners']
 assert '4594 entries' in (X/'api-main-final.log').read_text() and 'index check only' not in (X/'api-main-final.log').read_text()
 tests=load(E/'review-tests.json');assert tests['baselineRestored'] and tests['productionUnchanged'] and tests['moduleInventory']==[]
 assert [v['exit'] for v in tests['results']]==[1,0,0,0,0]
 for p,h in load(E/'prior-reused-acceptance.json').items():assert sha(pathlib.Path(p))==h,p
 originals=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22')
 for row in load(E/'native-originals-receipt.json')['originalInstalledFiles']:
  p=originals/row['name'];assert p.stat().st_size==row['size'] and sha(p)==row['sha256']
 for row in load(E/'protected-before.json'):
  for p,h in row['metadata'].items():
   f=pathlib.Path(row['root'])/'.git'/p;assert (sha(f) if f.exists() else None)==h,str(f)
 info=load(E/'boat-handback-info.json')['sandbox'];assert info['id']=='bx_f3gs8qm2' and info['state']=='idle' and info['health']=='ok' and info['stop'] is None and info['archiveAfter']=='2026-10-22T23:20:32.491Z'
 hand=load(X/'handback.json');assert hand['fullModuleTests']==hand['nativeCalls']==hand['gameLaunches']==0 and hand['moduleIdentity'] is None and not hand['matchingProcesses']
 assert hand['bytesAllocated']+hand['reserve']+1048576<hand['cap'] and hand['freeBytes']>2147483648
 amounts={'own':alloc(R),'readonlyDonor':alloc(pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-native-version-repair-oct22')),'priorQualification':alloc(prior.parents[4]),'sharedOriginals':alloc(originals),'launcher':alloc(originals.parent/'shadow-man-dsetup-census-fullmodule-oct22')+alloc(originals.parent/'shadow-man-dsetup-census-fullmodule-oct22.task.txt'),'reserve':8388608,'publicationAllowance':2097152}
 free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert sum(amounts.values())<67108864 and free>2982150144,amounts
 result=dict(result='PASS',scope='offline identity and evidence integrity only',candidate=C,testedCorrectedHEAD=H,allCandidatePathsPreserved=len(old),censusEntries=407,onlyChangedProductionMetadata='two census row SHA/reason fields',moduleSHA256=None,buildAttempts=1,buildExit=1,fullModuleTests=0,originalPins=4,protectedMetadata='UNCHANGED',resources=dict(amounts=amounts,total=sum(amounts.values()),cap=67108864,hostFree=free,floor=2982150144))
 (E/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
