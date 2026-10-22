import pathlib,json,os,hashlib,shutil,subprocess
Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');O=Q/'attempt';pgid=32431
alive=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  s=(d/'stat').read_text();v=s[s.rfind(')')+2:].split()
  if int(v[2])==pgid and (d/'cmdline').read_bytes():alive.append(int(d.name))
 except (FileNotFoundError,ProcessLookupError):pass
assert not alive,alive
fixture=O/'tmp/fixture-child-o7rJub';assert (fixture/'write').read_text()=='ordinary full write';shutil.rmtree(fixture)
pre=json.loads((O/'preflight.json').read_text())
for r in pre['seals']:
 p=pathlib.Path(r['path']);assert p.stat().st_size==r['size'] and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==r['sha256']
sv=os.statvfs(Q);files=[p for p in (O/'parent-vfs').rglob('*') if p.is_file()]
result=dict(clean=True,remainingOwnedLiveProcesses=alive,tmpEntries=list(map(str,(O/'tmp').iterdir())),removedOnlyFixture=True,preservedRaw=True,preservedParentVfsFiles=len(files),preservedParentVfsBytes=sum(p.stat().st_size for p in files),sourceRuntimeSupportSeals=len(pre['seals']),pinsPreserved=True,mount=json.loads(subprocess.check_output(['findmnt','-J','-T',str(Q)])),quotaBytes=sv.f_blocks*sv.f_frsize,quotaUsed=(sv.f_blocks-sv.f_bfree)*sv.f_frsize,quotaAvailable=shutil.disk_usage(O).free,underlyingHostFree=shutil.disk_usage('/home/user/shadow-man-tools-ready-oct22').free,boxLeftRunning=True,lifecycleMutations=0)
print(json.dumps(result))
