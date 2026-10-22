import pathlib,json,hashlib,subprocess,os,collections
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=E/'remote-evidence';env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env).decode().strip()
H='84f2a0165798f30d7a131dccdcc054a224fbf57b';C='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';P='c9681105dd96ab31a8a709eeb61242ad5ad60cae'
assert git('rev-parse',H+'^')==P and git('rev-parse',H+'^^^^^')=='89f1e9d2c67aa94d56d2319115589d07204d42e0'
q=load(D/'qualification.json');assert q['source']==H and q['canonicalSHA256']==C and not q['notRun'] and len(q['results'])==9 and all(r['exit']==0 and not r['timeout'] for r in q['results'])
expected=['directx-setup','directx-ordinals','dsetup-loading','dll-lifecycle-real-pe','dll-import-graph-lifecycle','dll-import-no-ilt','dll-lifecycle-races','scoped-dll-native','scoped-dll-lifecycle'];assert [r['test'] for r in q['results']]==['test/test-'+n+'.js' for n in expected]
reused=load(E/'reused-receipts.json')
for p,d in reused.items():assert sha(pathlib.Path(p))==d,p
manifestPath=next(pathlib.Path(p) for p in reused if p.endswith('/build-inputs.json'));manifest=load(manifestPath);byPath={r['path']:r for r in manifest['inputs']};assert len(byPath)==3426 and manifest['revision']==H
for row in q['results']:
 assert row['testSHA256']==byPath[row['test']]['sha256'];assert row['passLines']
 text=(D/(pathlib.Path(row['test']).stem+'.log')).read_text();assert all(line in text for line in row['passLines'])
 ev=[e for p in row['identityFiles'] for e in load(D/p)['events']];assert ev==row['events']
counts=collections.Counter((e['op'],e['sha256']) for r in q['results'] for e in r['events']);assert counts[('instantiate',C)]==8 and counts[('compile',C)]==8
for i,n in [(0,'92b6563f47f3ebf5875d56c7d5123ab1d8e9424377a871016086e6204e1fa8d7'),(2,'0f7578a13dec8be6afe5b52b587be6bd0f3239f2f4c01bca9abb9335757a6979'),(5,'3339329dcae31c3221f7dde20d78245bd2023a92933d3769d5fb0c73bda86386')]:assert q['results'][i]['events']==[dict(op='instantiate',sha256=n)]
for name,n in [('lifecycle-artifacts',4),('graph-artifacts',2)]:
 rows=load(D/name/'results.json');assert len(rows)==n and all(r['passed'] and r['status']==0 and r['groupAbsent'] for r in rows)
pre=load(D/'preflight.json');assert pre['recursiveFiles']==133 and pre['png']['roundTrip'] and pre['png']['sha256']=='475001d612a9019a8697030e0baf3c8c0691dee5ac6133370589228f1e6e5ecd' and pre['png']['package']=='7.0.0';assert not pre['extraCompileReason']['hasTestDirectxSetup']
assert load(D/'preflight-review.json')['verdict'].startswith('PASS') and 'Required runtime/compiler helper load PASS' in (D/'preflight-helper-load.log').read_text()
receipt=load(E/'codec-receipt.json');assert receipt==load(D/'codec-receipt.json') and len(receipt['files'])==23 and sum(r['size'] for r in receipt['files'])==63864
staged=load(D/'codec-staged-before.json');assert staged==load(D/'codec-staged-after.json')
codec=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22')
for row,stage in zip(receipt['files'],staged):
 rel=row['path'].removeprefix('runner/');p=codec/rel;assert p.stat().st_size==row['size'] and sha(p)==row['sha256'];assert stage==dict(source=row['path'],target=rel,bytes=row['size'],sha256=row['sha256'])
for p,d in load(E/'protected-git-before.json').items():
 p=pathlib.Path(p);assert (sha(p) if p.exists() else None)==d,str(p)
pins=load(E/'original-pins-before.json');assert len(pins)==4
for row in pins:
 p=pathlib.Path(row['path']);assert p.stat().st_size==row['size'] and sha(p)==row['sha256']
(E/'original-pins-after.json').write_text(json.dumps(pins,indent=2)+'\n')
transfer=load(E/'evidence-transfer.json')
for row in transfer['manifest']:
 p=D/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256']
h=load(D/'handback.json');assert h['head']==H and h['gitClean'] and not h['ownedBuildTestProcesses'] and h['newCanonicalBuilds']==0 and h['testRequiredExtraExportFullSourceCompiles']==1 and h['redundantDefaultFullSourceCompiles']==1 and h['sourceFixtureCompiles']==1
assert h['closure']['sha256']==sha(manifestPath) and h['closure']['inputs']==3426
assert h['modules'][1]['sha256']==C and h['modules'][0]['sha256']=='65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65'
assert h['allocated']+h['reserve']+2097152<h['cap'] and h['free']>h['freeFloor']
box=load(E/'boat-handback-info.json')['sandbox'];assert box['id']=='bx_f3gs8qm2' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None and box['archiveAfter']=='2026-10-22T23:20:32.491Z'
adm=load(E/'admission.json');sizes={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in list(adm['sizes'])+[str(R)]};free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert sum(sizes.values())+8388608+2097152<67108864 and free-2097152>2982150144
head=git('rev-parse','HEAD')
if head!=H:
 changed=git('diff-tree','--no-commit-id','--name-only','-r',H,head).splitlines();prefix=str(E.relative_to(R))+'/'
 assert changed and all(p.startswith(prefix) for p in changed),changed
assert sha(E/'module-observer.js')==sha(pathlib.Path('/home/user/wine-assembly-shadow-man-static-dx-harness-qualification-oct22/scratch/runs/20261022-shadow-man-static-dx-harness-qualification/module-observer.js'))
out=dict(verdict='PASS evidence verification; nine functional commands PASS; redundant no-ILT compile deviation retained',source=H,parent=P,commandExits=[0]*9,remainingNotRun=0,canonicalSHA256=C,canonicalObservedInstantiations=8,canonicalObservedV8Compiles=8,workerInstanceCounts='not independently enumerated by unchanged PID-keyed observer; shared-module source provenance',newCanonicalBuilds=0,permittedExtraExportCompiles=1,redundantDefaultFullSourceCompiles=1,sourceFixtureCompiles=1,codecFiles=23,codecBytes=63864,recursivePreflightFiles=133,closureInputs=3426,originalPins=4,protectedGitUnchanged=True,transferredFiles=len(transfer['manifest']),transferredBytes=sum(r['bytes'] for r in transfer['manifest']),localSizes=sizes,localAllocated=sum(sizes.values()),localReserve=8388608,localFinishingAllowance=2097152,localCap=67108864,hostFree=free,hostFloor=2982150144,remote=h,nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN',game='NOT RUN')
(E/'verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
