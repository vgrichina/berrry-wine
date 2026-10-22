import pathlib,subprocess,json,os,hashlib,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-region-fullmodule';os.chdir(R)
H='0ee5103fbe521b9c5ea577716d67b155f14f9e11';P='c2f50288da9e5a85995184c60bb2b94bdce35dd9';C='7a21579f9adb208164312961c249a0aa9080a8b7';B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def git(*a):return subprocess.check_output(['git',*a],env=env).decode().strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def resources():return dict(allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize)
assert git('rev-parse','HEAD')==P
blob=git('rev-parse',H+':src/00-regions.wat')
assert subprocess.check_output(['git','show',H+':src/00-regions.wat'],env=env)==(R/'src/00-regions.wat').read_bytes()
# Preserve the verified correction before returning just this dirty path to its real old HEAD for checkout.
(E/'declaration-corrected.wat').write_bytes((R/'src/00-regions.wat').read_bytes())
subprocess.run(['git','checkout','--','src/00-regions.wat'],check=True,env=env)
assert git('rev-parse',H+'^')==P and git('rev-parse',H+'^^')==C and git('rev-parse',H+'^^^')==B
r=subprocess.run(['git','checkout','-b','task/shadow-man-dsetup-region-fullmodule-oct22',H],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env);(E/'checkout-final.log').write_bytes(r.stdout);assert r.returncode==0,r.stdout
assert not git('status','--porcelain','--untracked-files=no')
old=json.loads((R/'evidence-census-fullmodule/build-inputs.json').read_text());manifest=json.loads(json.dumps(old))
changed=[]
for row in manifest['inputs']:
 p=R/row['path']
 if row['path']=='src/00-regions.wat':
  changed.append(row['path']);row.update(blob=blob,sha256=sha(p),bytes=p.stat().st_size)
 assert sha(p)==row['sha256'] and p.stat().st_mode&0o777==int(row['mode'],8)&0o777,row['path']
 assert git('rev-parse',H+':'+row['path'])==row['blob'],row['path']
assert changed==['src/00-regions.wat']
# Sparse membership remains exactly the complete retained closure; no dropped file.
patterns=(R/'.git/info/sparse-checkout').read_text().splitlines();assert set(p.lstrip('/') for p in patterns)==set(r['path'] for r in manifest['inputs'])
manifest.update(revision=H,parent=P,productionCandidate=C,main=B,bytes=sum(r['bytes'] for r in manifest['inputs']),onlyChangedClosureInput='src/00-regions.wat',priorManifest='evidence-census-fullmodule/build-inputs.json')
(E/'build-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
oldpaths=set(git('ls-tree','-r','--name-only',P).splitlines());newpaths=set(git('ls-tree','-r','--name-only',H).splitlines());assert oldpaths<=newpaths
codeDelta=[p for p in git('diff-tree','--no-commit-id','--name-only','-r',P,H).splitlines() if not p.startswith('scratch/runs/20261022-shadow-man-dsetup-region-fullmodule/')];assert codeDelta==['src/00-regions.wat']
node=pathlib.Path(subprocess.check_output(['which','node']).decode().strip()).resolve()
identity=dict(head=git('rev-parse','HEAD'),parent=P,productionCandidate=C,main=B,history=git('log','--format=raw','-4'),shallow=git('rev-parse','--is-shallow-repository'),node=str(node),nodeVersion=subprocess.check_output([str(node),'--version']).decode().strip(),nodeSHA256=sha(node),closureFiles=len(manifest['inputs']),closureBytes=manifest['bytes'],originalTreePaths=len(oldpaths),resultTreePaths=len(newpaths),originalPathsPreserved=True,changedSourcePaths=codeDelta,gitClean=True,identities={p:sha(R/p) for p in ['tools/build.sh','tools/build-compile-wat.js','tools/watx.js','tools/watx-src/compiler.js','lib/compile-wat.js','test/run.js','lib/dll-loader.js','lib/region-map.generated.js','src/00-regions.wat']})
(E/'staging-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
moduleInventory=[str(p.relative_to(R)) for p in (R/'build').glob('*.wasm')];assert not moduleInventory
# Exclude this collector itself: look only for Node compiler/test commands, not wrapper command text.
processes=subprocess.check_output(['ps','-eo','pid,ppid,comm,args']).decode().splitlines();matching=[l for l in processes if 'node'==l.split(None,3)[2] and any(x in l for x in ['build-compile-wat','test/test-','test/run.js'])]
assert not matching,matching
facts=dict(box='bx_f3gs8qm2',state='RUNNING; API exec responding',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',retainedRoot=str(R),retainedEvidence=str(E),originalEvidence=['evidence','evidence-census-fullmodule'],resources=resources(),cap=1073741824,reserve=67108864,receiptAllowance=1048576,freeFloor=2147483648,newCanonicalAttempts=0,newFullModuleCompilations=0,newFullModuleTests=0,moduleInventory=moduleInventory,moduleSHA256=None,ownedBuildTestProcesses=matching,handbackAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),verdict='BLOCKED_CHEAP_REGION_CENSUS')
assert facts['resources']['allocated']+facts['reserve']+facts['receiptAllowance']<facts['cap'];assert facts['resources']['free']>facts['freeFloor']
(E/'handback.json').write_text(json.dumps(facts,indent=2)+'\n');print(json.dumps(dict(identity=identity,handback=facts),indent=2))
