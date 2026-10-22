import pathlib,json,hashlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2];D=E/'remote-evidence';env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env).decode().strip()
H='0ee5103fbe521b9c5ea577716d67b155f14f9e11';P='c2f50288da9e5a85995184c60bb2b94bdce35dd9';C='7a21579f9adb208164312961c249a0aa9080a8b7';B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
assert git('rev-parse',H+'^')==P and git('rev-parse',P+'^')==C and git('rev-parse',C+'^')==B
code=[p for p in git('diff-tree','--no-commit-id','--name-only','-r',P,H).splitlines() if not p.startswith('scratch/runs/20261022-shadow-man-dsetup-region-fullmodule/')];assert code==['src/00-regions.wat']
assert sha(R/'src/00-regions.wat')==sha(D/'declaration-corrected.wat')
old=(D/'declaration-before.wat').read_text();new=(R/'src/00-regions.wat').read_text()
assert new==old.replace('  (region.declare $DX_VERSION_INFO (size 0x0000005C) (align 0x00000010)\n    (owner "09a1-comctl-handlers.wat:$handle_GetFileVersionInfoA"))','  ;; Obsolete synthetic DirectX version storage remains reserved so unrelated\n  ;; allocations do not move. The header retains its symbolic base/size globals;\n  ;; file version APIs read actual named-file resources instead of this block.\n  (region.declare $DX_VERSION_INFO (size 0x0000005C) (align 0x00000010)\n    (owner "01-header.wat:$DX_VERSION_INFO"))')
b=json.loads((D/'layout-before.json').read_text());a=json.loads((D/'layout-after.json').read_text());assert len(a)==len(b)==269
owners=[(x['name'],x.get('owner'),y.get('owner')) for x,y in zip(b,a) if x.get('owner')!=y.get('owner')];assert len(owners)==1 and owners[0][0]=='$DX_VERSION_INFO'
for rows in [a,b]:
 for row in rows:row.pop('owner',None)
assert a==b
row=next(r for r in a if r['name']=='$DX_VERSION_INFO');assert (row['kind'],row['base'],row['size'],row['align'])==('alloc',63525584,92,16)
controls=json.loads((D/'owner-controls.log').read_text());assert len(controls)==3 and all(r['verdict']['state']=='stale' for r in controls)
assert 'is stale' in (D/'layout-negative.log').read_text()
gates=json.loads((D/'cheap-gates.json').read_text());assert gates['count']==51 and len(gates['results'])==51
assert gates['failures']==[{'command':'node tools/region-census.js --gate','exit':1}]
assert sum(r['exit']==0 for r in gates['results'])==50
log=(D/'cheap-gates.log').read_text();assert '0 -> 1 raw region literal(s)' in log and '0 -> 2 raw region literal(s)' in log
for text in ['268 symbol owners verified','all agree with their $NAME/$NAME_SIZE globals','lib/region-map.generated.js is current (268 regions)','all 5 shake modes place','test tiers: OK (2083 files','407 source boundaries unchanged'] :assert text in log,text
assert '4594 entries' in (D/'api-actual-main.log').read_text() and 'index check only' not in (D/'api-actual-main.log').read_text()
manifest=json.loads((D/'build-inputs.json').read_text());assert manifest['revision']==H and manifest['parent']==P and len(manifest['inputs'])==3426 and manifest['bytes']==84995855
prior=pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-census-fullmodule-oct22/scratch/runs/20261022-shadow-man-dsetup-census-fullmodule/remote-evidence/build-inputs.json')
prev=json.loads(prior.read_text());x={r['path']:r for r in prev['inputs']};y={r['path']:r for r in manifest['inputs']};assert x.keys()==y.keys();assert [p for p in x if x[p]!=y[p]]==['src/00-regions.wat']
assert x['lib/region-map.generated.js']==y['lib/region-map.generated.js']
identity=json.loads((D/'staging-identity.json').read_text());assert identity['head']==H and identity['parent']==P and identity['gitClean'] and identity['originalPathsPreserved']
basepaths=set(git('ls-tree','-r','--name-only',C).splitlines());paths=set(git('ls-tree','-r','--name-only',H).splitlines());assert len(basepaths)==8256 and basepaths<=paths
handback=json.loads((D/'handback.json').read_text());assert handback['newCanonicalAttempts']==handback['newFullModuleCompilations']==handback['newFullModuleTests']==0
assert handback['moduleSHA256'] is None and handback['moduleInventory']==[] and handback['ownedBuildTestProcesses']==[]
assert handback['resources']['allocated']+handback['reserve']+handback['receiptAllowance']<handback['cap'] and handback['resources']['free']>handback['freeFloor']
box=json.loads((E/'boat-handback-info.json').read_text())['sandbox'];assert box['id']=='bx_f3gs8qm2' and box['state']=='idle' and box['health']=='ok' and box['stop'] is None
for p,h in json.loads((E/'reused-receipts.json').read_text()).items():assert sha(pathlib.Path(p))==h,p
for name in ['original-pins-before.json','original-pins-after.json']:
 for row in json.loads((E/name).read_text()):assert sha(pathlib.Path(row['path']))==row['sha256']
assert (E/'original-pins-before.json').read_bytes()==(E/'original-pins-after.json').read_bytes()
protected=json.loads((E/'protected-git-before.json').read_text())
for p,h in protected.items():
 q=pathlib.Path(p);assert (sha(q) if q.exists() else None)==h,p
admission=json.loads((E/'admission.json').read_text());sizes={}
for p in [*admission['prewriteSizes'],str(R)]:sizes[p]=int(subprocess.check_output(['du','-s','-B1',p]).split()[0])
free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
summary=dict(verdict='PASS evidence and bounded correction; BLOCKED_CHEAP_REGION_CENSUS qualification',sourceCorrection=H,sourceParent=P,sourcePathChanges=code,completeClosurePaths=3426,all8256CandidatePathsPreserved=True,layoutEquality='269 complete records equal except single owner',cheapGatesPassed=50,cheapGatesFailed=1,newCanonicalAttempts=0,newFullModuleTests=0,moduleSHA256=None,protectedGitUnchanged=True,originalPinsUnchanged=4,localAllocatedByPath=sizes,localAllocatedTotal=sum(sizes.values()),localReserve=8388608,localFinalAllowance=2097152,localCap=67108864,hostFree=free,hostFloor=2982150144,remote=handback)
assert summary['localAllocatedTotal']+summary['localReserve']+summary['localFinalAllowance']<summary['localCap']
assert free-summary['localFinalAllowance']>summary['hostFloor']
(E/'verification.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
