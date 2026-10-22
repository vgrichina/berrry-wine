import pathlib,json,hashlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=E/'remote-evidence';env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env).decode().strip()
H='84f2a0165798f30d7a131dccdcc054a224fbf57b';P='c9681105dd96ab31a8a709eeb61242ad5ad60cae';C='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';T='test/test-static-dx-version.js'
assert git('rev-parse',H+'^')==P;assert git('rev-parse',H+'^^^^^')=='89f1e9d2c67aa94d56d2319115589d07204d42e0'
assert git('diff-tree','--no-commit-id','--name-only','-r',P,H)==T
old=(D/'original-test.js').read_text();new=(R/T).read_text();assert new==old.replace('  const wasmBytes = compileSrcWasm();','  const wasmPath = process.env.WA_TEST_WASM;\n  const wasmBytes = wasmPath ? fs.readFileSync(wasmPath) : compileSrcWasm();').replace('  const e = instance.exports;','  const e = instance.exports;\n  // Filesystem imports translate guest buffers through the instance exports.\n  ctx.exports = e;');assert git('hash-object',T)==git('rev-parse',H+':'+T)
proof=json.loads((D/'causal-proof.json').read_text());assert proof['canonicalSHA256']==C and [r['exit'] for r in proof['rows']]==[1,0,1]
for row in proof['rows']:
 assert row['events']==[dict(op='instantiate',sha256=C)]
 assert row['summary'] in (D/(row['name']+'.log')).read_text()
q=json.loads((D/'qualification.json').read_text());assert q['source']==H and q['productionSource']==P and q['newBuilds']==0 and [r['exit'] for r in q['results']]==[0,1] and len(q['notRun'])==8
assert q['results'][0]['events']==[dict(op='instantiate',sha256=C)];assert q['results'][1]['events']==[]
assert "Cannot find module 'pngjs'" in (D/'test-directx-setup.log').read_text();assert '12 passed, 0 failed' in (D/'test-static-dx-version.log').read_text()
manifest=json.loads((D/'build-inputs.json').read_text());assert manifest['revision']==H and manifest['parent']==P and len(manifest['inputs'])==3426
prior=pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-fixture-fullmodule-oct22/scratch/runs/20261022-shadow-man-dsetup-fixture-fullmodule/remote-evidence/build-inputs.json');prior=json.loads(prior.read_text());a={r['path']:r for r in prior['inputs']};b={r['path']:r for r in manifest['inputs']};assert a.keys()==b.keys() and [p for p in a if a[p]!=b[p]]==[T];assert b[T]['sha256']==sha(R/T)
for p,digest in json.loads((E/'reused-receipts.json').read_text()).items():assert sha(pathlib.Path(p))==digest,p
for p,digest in json.loads((E/'protected-git-before.json').read_text()).items():
 f=pathlib.Path(p);assert (sha(f) if f.exists() else None)==digest,p
pins=json.loads((E/'original-pins-before.json').read_text());assert len(pins)==4
for row in pins:assert sha(pathlib.Path(row['path']))==row['sha256']
(E/'original-pins-after.json').write_text(json.dumps(pins,indent=2)+'\n')
transfer=json.loads((E/'evidence-transfer.json').read_text())
for row in transfer['manifest']:
 p=D/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
h=json.loads((D/'handback.json').read_text());assert h['head']==H and h['gitClean'] and not h['ownedBuildTestProcesses'] and h['newBuilds']==0 and h['newModuleCompiles']==0
assert not json.loads((D/'process-audit.json').read_text())['ownedBuildTestProcesses'];assert h['allocated']+h['reserve']+2097152<h['cap'] and h['free']>h['freeFloor']
box=json.loads((E/'boat-handback-info.json').read_text())['sandbox'];assert box['id']=='bx_f3gs8qm2' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None
adm=json.loads((E/'admission.json').read_text());paths=list(adm['sizes'])+[str(R),'/home/user/wine-assembly/scratch/usage-watch/shadow-man-static-dx-harness-qualification-oct22','/home/user/wine-assembly/scratch/usage-watch/shadow-man-static-dx-harness-qualification-oct22.task.txt'];sizes={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in paths};free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
out=dict(verdict='PASS narrow harness correction; BLOCKED missing pngjs before first unrelated module consumer',source=H,parent=P,sourcePaths=[T],canonicalSHA256=C,newBuilds=0,newModuleCompiles=0,canonicalInstantiationsIncludingControls=4,baselinePass=6,baselineFail=6,correctedPass=12,correctedFail=0,rejectingControls=2,qualificationCommandExits=[0,1],remainingNotRun=q['notRun'],closurePaths=3426,onlyChangedClosureInput=T,reusedPins=len(json.loads((E/'reused-receipts.json').read_text())),transferredFiles=len(transfer['manifest']),originalPinsVerified=4,protectedGitUnchanged=True,localSizes=sizes,localAllocated=sum(sizes.values()),localReserve=8388608,localFinalAllowance=2097152,localCap=67108864,hostFree=free,hostFloor=2982150144,remote=h,nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN')
assert out['localAllocated']+out['localReserve']+out['localFinalAllowance']<out['localCap'];assert free-2097152>out['hostFloor']
(E/'verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
