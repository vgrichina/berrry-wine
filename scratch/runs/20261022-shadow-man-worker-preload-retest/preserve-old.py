import pathlib,os,shutil,hashlib,json,time
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22')
Q=pathlib.Path('/home/user/shadow-man-bounded-runtime')
S=Q/'attempt';D=R/'inactive-evidence/shadow-man-quota-bounded-runtime-oct22'
def allocated(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
def manifest(p):
 rows=[]
 for f in sorted(p.rglob('*')):
  assert not f.is_symlink()
  if f.is_dir():continue
  assert f.is_file(),str(f)
  with f.open('rb') as h:d=hashlib.file_digest(h,'sha256').hexdigest()
  rows.append(dict(path=str(f.relative_to(p)),size=f.stat().st_size,sha256=d))
 return rows
assert not D.exists()
assert not any((d/'cmdline').read_bytes() for d in pathlib.Path('/proc').iterdir() if d.name=='32431')
before=manifest(S);size=sum(r['size'] for r in before)
phase=allocated(R);sourceAllocated=allocated(S)
assert phase+sourceAllocated+1048576<2147483648
assert shutil.disk_usage(R).free-sourceAllocated-1048576>2982150144
D.parent.mkdir(exist_ok=True);shutil.copytree(S,D,copy_function=shutil.copy2)
copied=manifest(D);assert copied==before
assert manifest(S)==before
vfs=[r for r in before if r['path'].startswith('parent-vfs/')]
assert len(vfs)==80 and sum(r['size'] for r in vfs)==75603833
assert allocated(R)<2147483648
receipt=dict(source=str(S),destination=str(D),ordinaryCopy=True,allFileHashesEqual=True,sourceUnchangedBeforeRemoval=True,files=len(before),bytes=size,allFiles=before,parentVfsFiles=len(vfs),parentVfsBytes=sum(r['size'] for r in vfs),recoveryBeforeAllocated=phase,recoveryAfterAllocated=allocated(R),crossDeviceTransientProjected=phase+sourceAllocated+1048576,recoveryCap=2147483648,hostFree=shutil.disk_usage(R).free)
shutil.rmtree(S)
assert not S.exists() and manifest(D)==before
receipt.update(verifiedOldTmpfsOnlyRemoved=True,quotaUsedAfterRemoval=(os.statvfs(Q).f_blocks-os.statvfs(Q).f_bfree)*os.statvfs(Q).f_frsize)
print(json.dumps(receipt))
