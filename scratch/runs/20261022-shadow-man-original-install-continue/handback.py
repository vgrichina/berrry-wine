import pathlib,json,os,hashlib,subprocess,shutil,datetime
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');O=Q/'session'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def rows(base):return [dict(path=str(p.relative_to(base)),size=p.stat().st_size,sha256=sha(p)) for p in sorted(base.rglob('*')) if p.is_file()]
pre=json.loads((O/'preflight.json').read_text());ex=json.loads((O/'exit.json').read_text());assert not ex['remainingLiveProcesses']
for r in pre['seals']:
 p=pathlib.Path(r['path']);assert p.stat().st_size==r['size'] and sha(p)==r['sha256']
allrows=rows(O);n=sum(x['size'] for x in allrows);current=sum(p.stat().st_blocks*512 for p in R.rglob('*'));assert current+n+150000000<2147483648;assert shutil.disk_usage(R).free-n-150000000>=2982150144
backup=R/'retained-session';assert not backup.exists();shutil.copytree(O,backup)
assert rows(backup)==allrows
fixed=pre['fixedAllocatedBytes'];sv=os.statvfs(Q)
r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_m4xrrj5a',boxLeftRunning=True,expiry='2026-10-22T21:52:45.530Z',shutdownOwner='coordinator',pinsPreserved=243,files=allrows,remoteRetained=str(backup),tmpfsRetained=str(O),retainedFiles=len(allrows),retainedLogicalBytes=n,recoveryAllocated=sum(p.stat().st_blocks*512 for p in R.rglob('*')),recoveryCap=2147483648,fixedAllocated=fixed,hardTmpfs=sv.f_blocks*sv.f_frsize,reserve=16777216,runtimeCap=536870912,aggregateAllocation=fixed+sv.f_blocks*sv.f_frsize+16777216,hostFree=shutil.disk_usage(R).free,ownedPgid=ex['pgid'],ownedGroupClean=not ex['remainingLiveProcesses'],tmpEntries=[str(p) for p in (O/'tmp').iterdir()],lifecycleMutations=0)
(R/'handback.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
