import pathlib,os,shutil,hashlib,json
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22');Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');D=R/'inactive-evidence/shadow-man-worker-preload-retest-oct22'
def allocated(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
def manifest(p):
 rows=[]
 for f in sorted(p.rglob('*')):
  assert not f.is_symlink(),str(f)
  if f.is_dir():continue
  assert f.is_file(),str(f)
  with f.open('rb') as h:d=hashlib.file_digest(h,'sha256').hexdigest()
  rows.append(dict(path=str(f.relative_to(p)),size=f.stat().st_size,sha256=d))
 return rows
assert os.statvfs(Q).f_blocks*os.statvfs(Q).f_frsize==419430400
assert not D.exists()
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes()
  assert not (cmd.split(b'\0')[0].endswith(b'/node') and b'/runtime/test/run.js' in cmd),str(p)
 except (FileNotFoundError,ProcessLookupError):pass
before=manifest(Q);phase=allocated(R);source=allocated(Q)
assert phase+source+1048576<2147483648
assert shutil.disk_usage(R).free-source-1048576>2982150144
names=[p.name for p in Q.iterdir()];assert names
shutil.copytree(Q,D,copy_function=shutil.copy2)
assert manifest(D)==before and manifest(Q)==before
assert allocated(R)<2147483648
for name in names:
 p=Q/name
 if p.is_dir():shutil.rmtree(p)
 else:p.unlink()
assert not list(Q.iterdir()) and manifest(D)==before
print(json.dumps(dict(source=str(Q),destination=str(D),files=len(before),bytes=sum(x['size'] for x in before),allFiles=before,allFileHashesEqual=True,sourceUnchangedBeforeRemoval=True,onlyVerifiedOldTmpfsRemoved=True,recoveryBeforeAllocated=phase,recoveryAfterAllocated=allocated(R),crossDeviceTransientProjected=phase+source+1048576,recoveryCap=2147483648,hostFree=shutil.disk_usage(R).free,quotaBytes=os.statvfs(Q).f_blocks*os.statvfs(Q).f_frsize)))
