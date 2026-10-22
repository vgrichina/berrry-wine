import pathlib,hashlib,json,os,subprocess,shutil
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');O=Q/'session'
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
assert (O/'tmp').exists() and not list((O/'tmp').iterdir())
for n in ['observer.cjs','launch.py']:
 shutil.copyfile(R/n,O/n)
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'),TMPDIR=str(O/'tmp'),TMP=str(O/'tmp'),TEMP=str(O/'tmp'))
p=subprocess.run(['node',str(R/'input-fixture.cjs')],env=env,cwd=O,capture_output=True,text=True,timeout=10);assert p.returncode==0,(p.stdout,p.stderr)
# Current-box actual host PNG codec encode/decode through unchanged renderer.
fixture=R/'codec-fixture.cjs'
fixture.write_text("const assert=require('assert');const {PNG}=require('pngjs');const {createCanvas}=require('/home/user/shadow-man-install-continue-oct22/runtime/lib/canvas-compat');const c=createCanvas(8,6),cx=c.getContext('2d');cx.fillStyle='#ff0000';cx.fillRect(0,0,8,6);const p=PNG.sync.read(c.toBuffer('image/png'));assert.equal(p.width,8);assert.equal(p.height,6);assert.equal(p.data[0],255);console.log(JSON.stringify({pass:true,actualCodecRoundTrip:true,guestExecuted:false}));")
codec=subprocess.run(['node',str(fixture)],env=env,cwd=O,capture_output=True,text=True,timeout=10);assert codec.returncode==0,(codec.stdout,codec.stderr)
# No guest runtime is instantiated here.
result=dict(passAll=True,controlFixture=json.loads(p.stdout),codecFixture=json.loads(codec.stdout),mount=mount,quotaBytes=419430400,fixedLogicalBytes=logical,fixedAllocatedBytes=allocated,fixedLimitBytes=100663296,reserveBytes=16777216,totalCapBytes=536870912,seals=rows,fixed=fixed,reusedExactForkTempFixture=True,fixtureEvidence='same exact source runtime assertions plus current installer-only offline control fixture',freeBytes=shutil.disk_usage(R).free)
(O/'preflight.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
