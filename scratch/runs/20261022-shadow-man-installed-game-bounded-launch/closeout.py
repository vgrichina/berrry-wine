import pathlib,json,os,hashlib,shutil,datetime
from watchdog import members
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');F=R/'bounded-diagnostic';O=Q/'bounded-game';B=R/'retained-bounded-game'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def alloc(p):return sum(x.stat().st_blocks*512 for x in [p,*p.rglob('*')])
exit=json.loads((F/'launch-result.json').read_text());assert not members(exit['pgid'])
assert not B.exists();project=alloc(R)+alloc(O)+8388608;assert project<2147483648
assert shutil.disk_usage(R).free-alloc(O)>2982150144
rows=[]
for p in O.rglob('*'):
 assert not p.is_symlink()
 if p.is_file():rows.append(dict(path=str(p.relative_to(O)),size=p.stat().st_size,sha256=sha(p)))
shutil.copytree(O,B)
for r in rows:
 p=B/r['path'];assert p.stat().st_size==r['size'] and sha(p)==r['sha256']
# Compare retained installer bytes and registry to the live original installation;
# no cabinet extraction or repeated cabinet-to-install acceptance verification.
original=[]
for p in (R/'retained-session').rglob('*'):
 if p.is_file():
  rel=p.relative_to(R/'retained-session');live=Q/'session'/rel
  assert live.is_file() and live.stat().st_size==p.stat().st_size and sha(live)==sha(p),rel
  original.append(dict(path=str(rel),size=p.stat().st_size,sha256=sha(p)))
assert len(original)==2083
res=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),box='bx_m4xrrj5a',leftRunning=True,expiry='2026-10-22T21:52:45.530Z',shutdownOwner='coordinator checkpoint20:50UTC',ownedProcessGroup=exit['pgid'],remaining=members(exit['pgid']),originalSessionFilesPreserved=len(original),originalSessionManifestSha256=hashlib.sha256(json.dumps(original,sort_keys=True).encode()).hexdigest(),originalRegistry=dict(path=str(Q/'session/parent-registry.json'),sha256=sha(Q/'session/parent-registry.json')),newImmutableBackup=str(B),newBackupFiles=rows,newBackupLogicalBytes=sum(r['size'] for r in rows),newBackupAllocated=alloc(B),recoveryProjectedBeforeCopy=project,recoveryUsed=alloc(R),recoveryCap=2147483648,mutableUsed=(os.statvfs(Q).f_blocks-os.statvfs(Q).f_bfree)*os.statvfs(Q).f_frsize,mutableCap=939524096,hostFree=shutil.disk_usage(R).free,deletedPaths=[],originalBackupsUntouched=True,childInputRemovedByOriginalRunner=True)
assert res['recoveryUsed']<2147483648 and res['hostFree']>2982150144
(F/'handback.json').write_text(json.dumps(res,indent=2));print(json.dumps({k:v for k,v in res.items() if k!='newBackupFiles'}))
