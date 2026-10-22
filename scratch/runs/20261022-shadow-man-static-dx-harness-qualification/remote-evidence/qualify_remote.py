import pathlib,json,subprocess,os,hashlib,time,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-static-dx-harness-qualification';os.chdir(R)
H='84f2a0165798f30d7a131dccdcc054a224fbf57b';P='c9681105dd96ab31a8a709eeb61242ad5ad60cae';C='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
env=dict(PATH=os.environ['PATH'],HOME='/home/user',LANG='C.UTF-8',GIT_NO_LAZY_FETCH='1')
def git(*a):return subprocess.check_output(['git',*a],env=env).decode().strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def log(args,name):
 p=subprocess.run(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);(E/name).write_bytes(p.stdout);assert p.returncode==0,p.stdout
assert git('rev-parse','HEAD')==P
refs=git('ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-static-dx-harness-qualification-oct22');assert H in refs and '89f1e9d2c67aa94d56d2319115589d07204d42e0' in refs;(E/'actual-refs.txt').write_text(refs+'\n')
log(['git','fetch','--depth=6','--filter=blob:none','--no-tags','origin',H],'fetch-history.log')
blob=git('rev-parse',H+':test/test-static-dx-version.js');log(['git','fetch','--no-tags','--no-write-fetch-head','--filter=blob:none','origin',blob],'fetch-owned-blob.log')
assert subprocess.check_output(['git','show',H+':test/test-static-dx-version.js'],env=env)==(R/'test/test-static-dx-version.js').read_bytes()
log(['git','checkout','--','test/test-static-dx-version.js'],'restore-parent.log');log(['git','checkout','-b','task/shadow-man-static-dx-harness-qualification-oct22',H],'checkout.log')
assert not git('status','--porcelain','--untracked-files=no');assert git('rev-parse','HEAD^')==P
assert git('diff-tree','--no-commit-id','--name-only','-r',P,H)=='test/test-static-dx-version.js'
old=json.loads((R/'evidence-fixture-fullmodule/build-inputs.json').read_text());manifest=json.loads(json.dumps(old));changed=[];tree={}
for line in git('ls-tree','-r',H).splitlines():
 meta,p=line.split('\t');mode,kind,b=meta.split();tree[p]=(mode,b)
for row in manifest['inputs']:
 p=R/row['path']
 if row['path']=='test/test-static-dx-version.js':row.update(blob=blob,sha256=sha(p),bytes=p.stat().st_size);changed.append(row['path'])
 assert sha(p)==row['sha256'] and p.stat().st_mode&0o777==int(row['mode'],8)&0o777,row['path']
 assert tree[row['path']]==(row['mode'],row['blob'])
assert changed==['test/test-static-dx-version.js'];manifest.update(revision=H,parent=P,bytes=sum(r['bytes'] for r in manifest['inputs']),onlyChangedClosureInputs=changed,priorManifest='evidence-fixture-fullmodule/build-inputs.json');(E/'build-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert sha(R/'build/wine-assembly.wasm')==C
env.update(WA_TEST_WASM=str(R/'build/wine-assembly.wasm'),WA_TEST_WASM_SHA256=C,NODE_OPTIONS='--require='+str(E/'module-observer.js'),WA_IDENTITY_DIR=str(E/'module-identities'))
tests=[('test/test-static-dx-version.js','canonical file'),('test/test-directx-setup.js','full source extra DirectXSetup export'),('test/test-directx-ordinals.js','JS only'),('test/test-dsetup-loading.js','source fixture no x86'),('test/test-dll-lifecycle-real-pe.js','canonical generated PE x86'),('test/test-dll-import-graph-lifecycle.js','canonical generated PE x86'),('test/test-dll-import-no-ilt.js','full source compile'),('test/test-dll-lifecycle-races.js','canonical generated x86'),('test/test-scoped-dll-native.js','canonical generated x86'),('test/test-scoped-dll-lifecycle.js','JS lifecycle fixture')]
rows=[]
for test,scope in tests:
 assert datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M')<'22:18'
 name=pathlib.Path(test).stem;start=time.time();before=set((E/'module-identities').glob('*'))
 with (E/(name+'.log')).open('wb') as f:q=subprocess.run(['node',test],env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 ids=sorted(set((E/'module-identities').glob('*'))-before);events=[ev for i in ids for ev in json.loads(i.read_text())['events']];text=(E/(name+'.log')).read_text();row=dict(test=test,command=['node',test],scope=scope,exit=q.returncode,seconds=time.time()-start,testSHA256=sha(R/test),identityFiles=[str(i.relative_to(E)) for i in ids],events=events,canonicalInstantiations=sum(ev['op']=='instantiate' and ev['sha256']==C for ev in events),allInstantiations=sum(ev['op']=='instantiate' for ev in events),passLines=sum(l.startswith('PASS') for l in text.splitlines()));rows.append(row)
 (E/'qualification.json').write_text(json.dumps(dict(source=H,productionSource=P,canonicalSHA256=C,newBuilds=0,results=rows,notRun=[t for t,s in tests[len(rows):]],env=env,nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN'),indent=2)+'\n');print(json.dumps(row),text[-1800:],flush=True)
 if q.returncode:break
assert sha(R/'build/wine-assembly.wasm')==C
