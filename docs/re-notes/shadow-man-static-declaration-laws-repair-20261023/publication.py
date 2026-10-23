#!/usr/bin/env python3
"""Read-only identity/resource and committed seal verification, Python only."""
import hashlib,json,os,pathlib,resource,subprocess,sys
sys.dont_write_bytecode=True
resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
H=pathlib.Path(__file__).resolve().parent;R=H.parents[2]
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-static-declaration-laws-repair-oct23')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T06-26-30-01a16770-877c-7501-b70f-23d0fb8f99e8.jsonl')
DONOR=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args,root=R):return subprocess.check_output(['git','-C',str(root),*args],env=ENV)
def dump(p,obj):p.write_text(json.dumps(obj,indent=2)+'\n')
def footprint(p):
 return sum(f.lstat().st_size for f in [p,*p.rglob('*')] if not f.is_symlink())
def account(write=True):
 owned=footprint(R);external=footprint(EXT);session=SESSION.stat().st_size
 projection=owned+external+session+4194304+12582912+8388608+2097152
 free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
 result=dict(ownedRoot=str(R),ownedBytes=owned,externalRoot=str(EXT),externalBytes=external,session=str(SESSION),sessionBytes=session,futureExternalGrowth=4194304,futureSessionGrowth=12582912,remainingGitEvidenceGrowth=2097152,reserve=8388608,projectedPeak=projection,allocation=67108864,hostFree=free,hostAfterProjectedGrowth=free-(projection-owned-external-session),hostFloor=2982150144,noLinks=True)
 assert projection<=67108864 and result['hostAfterProjectedGrowth']>=2982150144,result
 result['pass']=True
 if write:dump(H/'publication-admission.json',result)
 return result
def prepare():
 manifest=json.loads((DONOR/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json').read_text())
 assert manifest['candidate']=='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
 identities=[]
 for path in ('tools/watx-src/compiler-codegen.js','lib/region-map.generated.js','tools/build.sh'):
  row=next(r for r in manifest['files'] if r['path']==path);b=(DONOR/path).read_bytes()
  assert sha(b)==row['sha256'] and len(b)==row['bytes']
  assert git('cat-file','blob',row['blob'],root=DONOR)==b
  assert git('rev-parse',manifest['candidate']+':'+path,root=DONOR).decode().strip()==row['blob']
  identities.append(row)
 old=DONOR/'docs/re-notes/shadow-man-span-static-canonical-20261023/static-abi.py'
 assert sha(old.read_bytes())=='f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee'
 assert git('show','d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e:'+str(old.relative_to(DONOR)),root=DONOR)==old.read_bytes()
 dump(H/'source-bindings.json',dict(candidate=manifest['candidate'],sourceAcceptance=manifest['producerReview'],rejectedInspectorCommit='d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e',oldHelperSHA256=sha(old.read_bytes()),newHelperSHA256=sha((H/'static-abi.py').read_bytes()),inputs=identities,reusedEvidence='coordinator-verified53 canonical seals; independent-rejection16 seals; source/build/module/guard/52gates/decoder reused, not rerun'))
 account()
 seals=[]
 for f in sorted([*H.iterdir(),H.with_suffix('.md')]):
  if not f.is_file() or f.name in ('seals.json','publication.json'):continue
  b=f.read_bytes();seals.append(dict(path=str(f.relative_to(R)),bytes=len(b),sha256=sha(b)))
 dump(H/'seals.json',seals)
 print(json.dumps(dict(seals=len(seals),resource='PASS',helper=sha((H/'static-abi.py').read_bytes()))))
def verify():
 commit=git('rev-parse','HEAD').decode().strip()
 for row in json.loads((H/'seals.json').read_text()):
  b=(R/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
  assert git('show',commit+':'+row['path'])==b,row['path']
 base='d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e'
 changes=git('diff','--name-only',base,commit).decode().splitlines()
 assert changes and all(p.startswith('docs/re-notes/shadow-man-static-declaration-laws-repair-20261023') for p in changes)
 assert not git('status','--porcelain'),git('status','--porcelain')
 for label in ('focused-tests','declaration-law-tests','independent-rejecting-test','static-inspection-driver'):
  result=json.loads((H/(label+'.json')).read_text());assert result['exit']==0 and result['reaped'] and not result['remainingGroup']
 resource_receipt=account(write=False)
 receipt=dict(commit=commit,branch=git('branch','--show-current').decode().strip(),ownedChanges=changes,seals=len(json.loads((H/'seals.json').read_text())),resources=resource_receipt,allGroupsReaped=True,box=None,independentAcceptance='PENDING')
 dump(EXT/'publication-local.json',receipt);print(json.dumps(dict(commit=commit,seals=receipt['seals'],allGroupsReaped=True)))
if __name__=='__main__':
 assert sys.argv[1:] in (['--prepare'],['--verify'])
 prepare() if sys.argv[1]=='--prepare' else verify()
