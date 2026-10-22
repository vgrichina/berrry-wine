import pathlib,json,hashlib,os,shutil
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22');Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');O=Q/'shadow-man-child-window-runtime-oct22';D=R/'inactive-evidence/shadow-man-child-window-runtime-oct22'
def manifest(p):
 rows=[]
 for f in sorted(p.rglob('*')):
  assert not f.is_symlink()
  if f.is_dir():continue
  assert f.is_file()
  with f.open('rb') as h:s=hashlib.file_digest(h,'sha256').hexdigest()
  rows.append(dict(path=str(f.relative_to(p)),size=f.stat().st_size,sha256=s))
 return rows
def allocated(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
pre=json.loads((O/'preflight.json').read_text());exit=json.loads((O/'exit.json').read_text())
live=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  s=(p/'stat').read_text();f=s[s.rfind(')')+2:].split()
  if int(f[2])==exit['pgid'] and (p/'cmdline').read_bytes():live.append(int(p.name))
 except (FileNotFoundError,ProcessLookupError):pass
assert not live
for r in pre['seals']:
 p=pathlib.Path(r['path'])
 with p.open('rb') as h:s=hashlib.file_digest(h,'sha256').hexdigest()
 assert p.stat().st_size==r['size'] and s==r['sha256']
before=manifest(O);source=allocated(O);recovery=allocated(R)
assert not D.exists() and recovery+source+1048576<2147483648
assert shutil.disk_usage(R).free-source-1048576>2982150144
shutil.copytree(O,D,copy_function=shutil.copy2)
assert manifest(D)==before and manifest(O)==before
assert allocated(R)<2147483648
sv=os.statvfs(Q);assert sv.f_blocks*sv.f_frsize==419430400
print(json.dumps(dict(ownedPgid=exit['pgid'],remainingLiveProcesses=live,pinsPreserved=True,pinCount=len(pre['seals']),newEvidencePreserved=str(D),allFileHashesEqual=True,files=len(before),bytes=sum(r['size'] for r in before),allFiles=before,recoveryBeforeAllocated=recovery,recoveryAfterAllocated=allocated(R),transientProjected=recovery+source+1048576,recoveryCap=2147483648,hostFreeBytes=shutil.disk_usage(R).free,quotaBytes=sv.f_blocks*sv.f_frsize,quotaUsed=(sv.f_blocks-sv.f_bfree)*sv.f_frsize,tmpEntries=list(x.name for x in (O/'tmp').iterdir()),boxLifecycleMutations=0)))
