import pathlib,json,hashlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=E/'remote-evidence';env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env).decode().strip()
H='c9681105dd96ab31a8a709eeb61242ad5ad60cae';P='0ee5103fbe521b9c5ea577716d67b155f14f9e11'
assert git('rev-parse',H+'^')==P
assert git('rev-parse',H+'^^')=='c2f50288da9e5a85995184c60bb2b94bdce35dd9'
assert git('rev-parse',H+'^^^')=='7a21579f9adb208164312961c249a0aa9080a8b7'
assert git('rev-parse',H+'^^^^')=='89f1e9d2c67aa94d56d2319115589d07204d42e0'
changed=['test/dsetup-binding-fixture.js','test/version-source-fixture.js']
assert git('diff-tree','--no-commit-id','--name-only','-r',P,H).splitlines()==changed
oldpaths=set(git('ls-tree','-r','--name-only',P).splitlines());newpaths=set(git('ls-tree','-r','--name-only',H).splitlines());assert oldpaths==newpaths
manifest=json.loads((D/'build-inputs.json').read_text());assert manifest['revision']==H and manifest['parent']==P and len(manifest['inputs'])==3426
prior=pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-region-fullmodule-oct22/scratch/runs/20261022-shadow-man-dsetup-region-fullmodule')
old=json.loads((prior/'remote-evidence/build-inputs.json').read_text());a={r['path']:r for r in old['inputs']};b={r['path']:r for r in manifest['inputs']};assert a.keys()==b.keys();assert [p for p in a if a[p]!=b[p]]==changed
for p in changed:
 assert sha(R/p)==b[p]['sha256']
 assert git('hash-object',p)==b[p]['blob']==git('rev-parse',H+':'+p)
before=(D/'dsetup-before.js').read_text();after=(R/changed[0]).read_text();assert after==before.replace("const { compile } = require('../tools/watx');", "const { compile } = require('../tools/watx');\nconst { GUEST_BASE } = require('../lib/region-map.generated');").replace('(i32.const 0x12000)', '(i32.const ${GUEST_BASE})')
controls=json.loads((D/'fixture-controls.json').read_text());assert len(controls)==2
assert sum(r['productionFunctionsUnchanged'] for r in controls)==26
assert all(len(r['controls'])==3 and all(x['rejected'] for x in r['controls']) for r in controls)
assert all(r['identicalBehavior']['bufferBytes']==536870912 and len(r['identicalBehavior']['rows'])==5 for r in controls)
g=json.loads((D/'cheap-gates.json').read_text());assert g['count']==51 and len(g['results'])==51 and all(r['exit']==0 for r in g['results']) and not g['failures']
assert (D/'cheap-gates-complete.sh').read_text()==(prior/'remote-evidence/cheap-gates-complete.sh').read_text().replace('evidence-region-fullmodule','evidence-fixture-fullmodule')
c=json.loads((D/'canonical-result.json').read_text());assert c['attempts']==1 and c['exit']==0 and c['head']==H and c['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
q=json.loads((D/'qualification.json').read_text());assert q['total']==3 and [r['exit'] for r in q['results']]==[0,0,1]
assert all(r['canonicalInstantiations']==0 and r['allInstantiations']==1 for r in q['results'])
assert '6 passed, 6 failed' in (D/'test-static-dx-version.log').read_text()
assert json.loads((D/'canonical-core-proof.json').read_text())['exactCoreEqual']
h=json.loads((D/'handback.json').read_text());assert h['head']==H and h['gitClean'] and not h['ownedBuildTestProcesses']
assert h['allocated']+h['reserve']+2097152<h['cap'] and h['free']>h['freeFloor']
box=json.loads((E/'boat-handback-info.json').read_text())['sandbox'];assert box['id']=='bx_f3gs8qm2' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None
for row in json.loads((E/'evidence-transfer.json').read_text())['manifest']:
 p=D/row['path'];assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
for p,digest in json.loads((E/'protected-git-before.json').read_text()).items():
 f=pathlib.Path(p);assert (sha(f) if f.exists() else None)==digest,p
pins=json.loads((E/'original-pins-before.json').read_text())
for row in pins:assert sha(pathlib.Path(row['path']))==row['sha256']
(E/'original-pins-after.json').write_text(json.dumps(pins,indent=2)+'\n')
reused=json.loads((E/'reused-receipts.json').read_text())
for p,digest in reused.items():assert sha(pathlib.Path(p))==digest,p
admission=json.loads((E/'admission.json').read_text());sizes={p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in [*admission['sizes'],str(R)]};free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
summary=dict(verdict='PASS bounded fixture correction and ONE canonical build; BLOCKED static DirectX qualification',source=H,parent=P,changedSourcePaths=changed,parentTreePathsPreserved=len(oldpaths),closurePaths=3426,closureBytes=manifest['bytes'],fixtureRuntimeRejects=6,productionFunctionsPreserved=26,cheapGatesPassed=51,canonicalBuildAttempts=1,canonicalExit=0,moduleSHA256=c['moduleSHA256'],fullSourceQualificationCommands=3,qualificationPassed=2,qualificationFailed=1,canonicalFileInstantiations=0,remainingTestsNotRun=9,originalPinsVerified=4,protectedGitUnchanged=True,reusedReceiptPins=len(reused),localAllocatedByPath=sizes,localAllocated=sum(sizes.values()),localReserve=8388608,localFinalAllowance=2097152,localCap=67108864,hostFree=free,hostFloor=2982150144,remote=h)
assert summary['localAllocated']+summary['localReserve']+summary['localFinalAllowance']<summary['localCap'];assert free-summary['localFinalAllowance']>summary['hostFloor']
(E/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
