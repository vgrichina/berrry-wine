import datetime, hashlib, json, os, pathlib, signal, subprocess, time
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22'); E=R/'evidence-census-fullmodule'; os.chdir(R)
C='7a21579f9adb208164312961c249a0aa9080a8b7'; H='c2f50288da9e5a85995184c60bb2b94bdce35dd9'; B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
for k in ['NODE_OPTIONS','NODE_PATH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:env.pop(k,None)
def git(*a): return subprocess.check_output(['git',*a],env=env).decode().strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def resource():return dict(allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize)
def admit(growth=0):
 d=resource();assert d['allocated']+growth+67108864<1073741824 and d['free']-growth>2147483648;return d
assert not (E/'build-attempt.json').exists()
assert git('rev-parse','HEAD')==C
assert not list((R/'build').glob('*.wasm'))
admit(33554432)
def run(args,name,timeout=90):
 with (E/name).open('wb') as log:p=subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,env=env,timeout=timeout)
 assert p.returncode==0,(args,p.returncode,(E/name).read_text()[-4000:])
refs=git('ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-dsetup-census-fullmodule-oct22')
assert B+'\trefs/heads/main' in refs and H+'\trefs/heads/task/shadow-man-dsetup-census-fullmodule-oct22' in refs
(E/'actual-refs.txt').write_text(refs+'\n')
run(['git','fetch','--depth=3','--filter=blob:none','--no-tags','origin',H],'fetch-correction-history.log')
oid=git('rev-parse',H+':tools/callback-ownership-census.json')
run(['git','fetch','--no-tags','--no-write-fetch-head','--filter=blob:none','origin',oid],'fetch-correction-blob.log')
assert git('rev-parse',H+'^')==C and git('rev-parse',H+'^^')==B
delta=git('diff-tree','--no-commit-id','--name-only','-r',C,H).splitlines()
assert [p for p in delta if not p.startswith('scratch/runs/20261022-shadow-man-dsetup-census-fullmodule/')]==['tools/callback-ownership-census.json']
run(['git','checkout','-b','task/shadow-man-dsetup-census-fullmodule-oct22',H],'checkout-correction.log')
assert git('rev-parse','HEAD')==H
assert sha(R/'tools/callback-ownership-census.json')=='d2a9682fce5581ea275d1fcbb7bc48208dc46507de57a3fcecf40622827e3bb0'
manifest=json.loads((R/'evidence/build-inputs.json').read_text())
for row in manifest['inputs']:
 p=R/row['path']
 if row['path']=='tools/callback-ownership-census.json':
  row.update(blob=oid,sha256=sha(p),bytes=p.stat().st_size)
 assert sha(p)==row['sha256'] and p.stat().st_mode&0o777==int(row['mode'],8)&0o777,row['path']
manifest.update(revision=H,productionCandidate=C,parent=C,main=B,bytes=sum(x['bytes'] for x in manifest['inputs']),onlyChangedClosureInput='tools/callback-ownership-census.json')
(E/'build-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
identity=dict(head=git('rev-parse','HEAD'),parent=git('rev-parse','HEAD^'),main=B,productionCandidate=C,history=git('log','--format=raw','-4'),shallow=git('rev-parse','--is-shallow-repository'),node=subprocess.check_output(['node','--version']).decode().strip(),nodePath=subprocess.check_output(['which','node']).decode().strip(),resources=admit(),moduleInventory=[])
identity['nodeSHA256']=sha(pathlib.Path(identity['nodePath']).resolve());identity['censusSHA256']=sha(R/'tools/callback-ownership-census.json')
(E/'staging-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
run(['node','tools/callback-ownership-census.js'],'census-final.log')
run(['node','tools/check-api-table.js','--base='+B],'api-main-final.log')
assert 'index check only' not in (E/'api-main-final.log').read_text()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,22,15,tzinfo=datetime.timezone.utc)
attempt=dict(command=['bash','tools/build.sh'],cwd=str(R),head=H,parent=C,productionCandidate=C,main=B,attempt=1,startedAt=now(),environment={k:env.get(k) for k in ['PATH','NODE_PATH','NODE_OPTIONS','GIT_NO_LAZY_FETCH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']},resourcesBefore=admit(268435456))
(E/'build-attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
start=time.monotonic();peak=resource()['allocated'];reason=None
with (E/'canonical-build.log').open('wb') as log:
 p=subprocess.Popen(['bash','tools/build.sh'],stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
 while p.poll() is None:
  d=resource();peak=max(peak,d['allocated'])
  if d['allocated']+67108864>=1073741824 or d['free']<2147483648 or time.monotonic()-start>540:
   reason='resource/deadline guard';os.killpg(p.pid,signal.SIGTERM);break
  time.sleep(1)
 code=p.wait(timeout=10)
attempt.update(exit=code,finishedAt=now(),seconds=time.monotonic()-start,sampledPeakAllocation=peak,guard=reason,resourcesAfter=resource(),logSHA256=sha(E/'canonical-build.log'))
attempt['outputs']=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in (R/'build').glob('*') if p.is_file()]
attempt['changedClosureInputs']=[row['path'] for row in manifest['inputs'] if sha(R/row['path'])!=row['sha256']]
(E/'build-attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
print(json.dumps(attempt,indent=2)); print((E/'canonical-build.log').read_text()[-12000:])
assert not attempt['changedClosureInputs']
# A first new gate/compiler/environment failure ends this task: no retry.
