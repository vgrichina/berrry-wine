import pathlib,hashlib,json,os,subprocess,shutil
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22');Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');O=Q/'shadow-man-top-level-ui-capture-oct22'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
mount=json.loads(subprocess.check_output(['findmnt','-J','-T',str(Q)]))['filesystems'][0]
assert mount['target']==str(Q) and mount['fstype']=='tmpfs'
sv=os.statvfs(Q);assert sv.f_blocks*sv.f_frsize==419430400
rows=[]
for base,manifest in [(R,'staged-runtime-manifest.json'),(R/'recovery/source/Demos/Shadowman','original-seals.json'),(R/'support','support-manifest.json')]:
 for r in json.loads((R/manifest).read_text()):
  p=base/r['path'];assert p.stat().st_size==r['size'] and sha(p)==r['sha256'],str(p)
  rows.append(dict(path=str(p),size=r['size'],sha256=r['sha256']))
assert len(rows)==243
fixed=[]
for base in [R/'recovery/source/Demos/Shadowman',R/'runtime',R/'runner',R/'support']:
 for p in [base,*base.rglob('*')]:
  assert not p.is_symlink();s=p.stat();fixed.append(dict(path=str(p),bytes=s.st_size,allocated=s.st_blocks*512))
logical=sum(x['bytes'] for x in fixed);allocated=sum(x['allocated'] for x in fixed)
# New diagnostics reside within tmpfs and are counted by its hard quota.
assert max(logical,allocated)<=100663296
assert allocated+419430400+16777216<=536870912
assert shutil.disk_usage(R).free>2982150144
src=(R/'runtime/test/run.js').read_text();tm=(R/'runtime/lib/thread-manager.js').read_text()
assert "return { ...process.env, WINE_NAMED_EVENT_ENDPOINT:" in tm
assert "fs.mkdtempSync(path.join(os.tmpdir(), 'wa-child-'))" in src
assert 'env: ThreadManager.namedEventEnvironment()' in src
assert not (O/'tmp').exists();(O/'tmp').mkdir()
result=dict(passAll=True,mount=mount,quotaBytes=419430400,fixedLogicalBytes=logical,fixedAllocatedBytes=allocated,fixedLimitBytes=100663296,reserveBytes=16777216,totalCapBytes=536870912,seals=rows,fixed=fixed,reusedExactForkTempFixture=True,fixtureEvidence='predecessor preflight.json PID47057; exact243 source pins unchanged; guarded fork PID45826',freeBytes=shutil.disk_usage(R).free)
(O/'preflight.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
