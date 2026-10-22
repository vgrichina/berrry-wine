import pathlib,hashlib,os,shutil,json
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22');Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');S=Q/'shadow-man-child-window-runtime-oct22';D=R/'inactive-evidence/shadow-man-child-window-runtime-oct22'
def manifest(p):
 rows=[]
 for f in sorted(p.rglob('*')):
  assert not f.is_symlink()
  if f.is_dir():continue
  assert f.is_file()
  with f.open('rb') as h:s=hashlib.file_digest(h,'sha256').hexdigest()
  rows.append(dict(path=str(f.relative_to(p)),size=f.stat().st_size,sha256=s))
 return rows
live=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  c=(p/'cmdline').read_bytes().split(b'\0')
  if c and c[0].endswith(b'/node') and any(b'/runtime/test/run.js' in x for x in c):live.append(p.name)
 except (FileNotFoundError,ProcessLookupError):pass
assert not live,live
assert list(Q.iterdir())==[S]
assert os.statvfs(Q).f_blocks*os.statvfs(Q).f_frsize==419430400
rows=manifest(S);assert len(rows)==101 and sum(r['size'] for r in rows)==76434347
assert rows==manifest(D)
recovery=sum(p.lstat().st_blocks*512 for p in [R,*R.rglob('*')]);assert recovery<2147483648
assert shutil.disk_usage(R).free>2982150144
shutil.rmtree(S)
assert not list(Q.iterdir()) and manifest(D)==rows
print(json.dumps(dict(verifiedBackup=str(D),files=len(rows),bytes=sum(r['size'] for r in rows),allHashesEqual=True,onlyMatchingTmpfsRemoved=True,noRecopy=True,liveGuests=live,recoveryAllocated=recovery,freeBytes=shutil.disk_usage(R).free)))
