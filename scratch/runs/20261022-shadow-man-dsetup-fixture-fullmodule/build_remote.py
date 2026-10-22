import pathlib,subprocess,json,os,hashlib,datetime,time,re
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-fixture-fullmodule';os.chdir(R)
H='c9681105dd96ab31a8a709eeb61242ad5ad60cae';P='0ee5103fbe521b9c5ea577716d67b155f14f9e11'
env=dict(PATH=os.environ['PATH'],HOME='/home/user',LANG='C.UTF-8',GIT_NO_LAZY_FETCH='1')
def git(*a):return subprocess.check_output(['git',*a],env=env).decode().strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def resources():return dict(allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize)
before=resources();assert before['allocated']+67108864+335544320<1073741824 and before['free']>2147483648+335544320
assert git('rev-parse','HEAD')==P
refs=git('ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-dsetup-fixture-fullmodule-oct22');assert H in refs and '89f1e9d2c67aa94d56d2319115589d07204d42e0' in refs
(E/'actual-refs.txt').write_text(refs+'\n')
def logged(args,name):
 r=subprocess.run(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);(E/name).write_bytes(r.stdout);assert r.returncode==0,r.stdout
logged(['git','fetch','--depth=5','--filter=blob:none','--no-tags','origin',H],'fetch-history.log')
changed=['test/dsetup-binding-fixture.js','test/version-source-fixture.js']
for i,p in enumerate(changed):
 blob=git('rev-parse',H+':'+p)
 logged(['git','fetch','--no-tags','--no-write-fetch-head','--filter=blob:none','origin',blob],f'fetch-blob-{i}.log')
 assert subprocess.check_output(['git','show',H+':'+p],env=env)==(R/p).read_bytes()
# Corrected bytes are pinned to pushed blobs above; return only the two owned
# dirty paths to their parent before a normal checkout of the exact commit.
logged(['git','checkout','--',*changed],'restore-parent.log')
logged(['git','checkout','-b','task/shadow-man-dsetup-fixture-fullmodule-oct22',H],'checkout.log')
assert not git('status','--porcelain','--untracked-files=no')
assert git('rev-parse',H+'^')==P
assert git('rev-parse',H+'^^')=='c2f50288da9e5a85995184c60bb2b94bdce35dd9'
assert git('rev-parse',H+'^^^')=='7a21579f9adb208164312961c249a0aa9080a8b7'
assert git('rev-parse',H+'^^^^')=='89f1e9d2c67aa94d56d2319115589d07204d42e0'
assert git('diff-tree','--no-commit-id','--name-only','-r',P,H).splitlines()==changed
old=json.loads((R/'evidence-region-fullmodule/build-inputs.json').read_text());manifest=json.loads(json.dumps(old))
tree={}
for line in git('ls-tree','-r',H).splitlines():
 meta,p=line.split('\t');mode,kind,blob=meta.split();tree[p]=(mode,blob)
for row in manifest['inputs']:
 p=R/row['path']
 if row['path'] in changed:row.update(blob=tree[row['path']][1],sha256=sha(p),bytes=p.stat().st_size)
 assert sha(p)==row['sha256'] and p.stat().st_mode&0o777==int(row['mode'],8)&0o777,row['path']
 assert tree[row['path']]==(row['mode'],row['blob']),row['path']
assert set(p.lstrip('/') for p in (R/'.git/info/sparse-checkout').read_text().splitlines())==set(r['path'] for r in manifest['inputs'])
assert [x['path'] for x,y in zip(old['inputs'],manifest['inputs']) if x!=y]==changed
manifest.update(revision=H,parent=P,bytes=sum(r['bytes'] for r in manifest['inputs']),onlyChangedClosureInputs=changed,priorManifest='evidence-region-fullmodule/build-inputs.json')
manifest.pop('onlyChangedClosureInput',None)
(E/'build-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
gateText=(E/'cheap-gate-exits.log').read_text();gates=[dict(command=x,exit=int(y)) for x,y in re.findall(r'COMMAND ([^\n]+)\nGATE_EXIT (\d+)',gateText)]
assert len(gates)==51 and all(r['exit']==0 for r in gates)
(E/'cheap-gates.json').write_text(json.dumps(dict(count=51,results=gates,failures=[]),indent=2)+'\n')
node=pathlib.Path(subprocess.check_output(['which','node'],env=env).decode().strip()).resolve()
identity=dict(head=H,parent=P,history=git('log','--format=raw','-5'),closureFiles=len(manifest['inputs']),closureBytes=manifest['bytes'],productionUnchanged=True,node=str(node),nodeVersion=subprocess.check_output([str(node),'--version']).decode().strip(),nodeSHA256=sha(node),env=env,cwd=str(R),before=before,identities={p:sha(R/p) for p in ['tools/build.sh','tools/build-compile-wat.js','tools/watx.js','tools/watx-src/compiler.js','test/compile-src.js','lib/compile-wat.js','test/run.js','lib/dll-loader.js','lib/region-map.generated.js','src/00-regions.wat']})
(E/'staging-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
assert not list((R/'build').glob('*.wasm'))
assert not (E/'canonical-result.json').exists() and not (E/'canonical-build.log').exists()
assert datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M')<'22:15'
start=time.time()
with (E/'canonical-build.log').open('wb') as f:r=subprocess.run(['bash','tools/build.sh'],env=env,stdout=f,stderr=subprocess.STDOUT,timeout=600)
module=R/'build/wine-assembly.wasm'
result=dict(attempts=1,command=['bash','tools/build.sh'],env=env,cwd=str(R),head=H,exit=r.returncode,seconds=time.time()-start,resources=resources(),moduleSHA256=sha(module) if module.exists() else None,moduleBytes=module.stat().st_size if module.exists() else None)
(E/'canonical-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
print((E/'canonical-build.log').read_text()[-5000:],flush=True)
# First failure is terminal for this task: no retry or source repair.
