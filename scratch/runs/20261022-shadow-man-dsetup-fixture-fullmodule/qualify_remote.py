import pathlib,subprocess,json,os,hashlib,time,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-fixture-fullmodule';os.chdir(R)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
build=json.loads((E/'canonical-result.json').read_text());assert build['exit']==0 and build['attempts']==1
M=R/'build/wine-assembly.wasm';assert sha(M)==build['moduleSHA256']
env=json.loads((E/'staging-identity.json').read_text())['env']
assert subprocess.check_output(['git','rev-parse','HEAD'],env=env).decode().strip()==build['head']
(E/'module-identities').mkdir(exist_ok=True)
env.update(WA_TEST_WASM=str(M),WA_TEST_WASM_SHA256=build['moduleSHA256'],NODE_OPTIONS='--require='+str(E/'module-observer.js'),WA_IDENTITY_DIR=str(E/'module-identities'))
tests=[
 ('test/test-file-version-info.js',[], 'full source with extra query export'),
 ('test/test-ne-file-version.js',[], 'default full source with extra wide-query export'),
 ('test/test-static-dx-version.js',[], 'default full source compilation'),
 ('test/test-directx-setup.js',[], 'full source with extra DirectXSetup export'),
 ('test/test-directx-ordinals.js',[], 'JS ordinal resolution'),
 ('test/test-dsetup-loading.js',[], 'source binding fixture, no x86'),
 ('test/test-dll-lifecycle-real-pe.js',[], 'canonical wasm, real generated PE x86, four cases'),
 ('test/test-dll-import-graph-lifecycle.js',[], 'canonical wasm, real generated PE x86, two cases'),
 ('test/test-dll-import-no-ilt.js',[], 'default full source compilation'),
 ('test/test-dll-lifecycle-races.js',[], 'canonical wasm, generated x86'),
 ('test/test-scoped-dll-native.js',[], 'canonical wasm, generated x86'),
 ('test/test-scoped-dll-lifecycle.js',[], 'JS lifecycle fixture'),
]
results=[]
for test,args,scope in tests:
 assert datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M')<'22:15','no new heavy start after deadline'
 allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);assert allocated+67108864+167772160<1073741824
 assert os.statvfs(R).f_bavail*os.statvfs(R).f_frsize>2147483648+167772160
 name=pathlib.Path(test).stem;start=time.time();old=set((E/'module-identities').glob('*.json'))
 with (E/(name+'.log')).open('wb') as f:
  p=subprocess.run(['node',test,*args],env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180)
 ids=[]
 for ip in sorted(set((E/'module-identities').glob('*.json'))-old):ids.append(json.loads(ip.read_text()))
 text=(E/(name+'.log')).read_text()
 row=dict(test=test,command=['node',test,*args],testSHA256=sha(R/test),exit=p.returncode,seconds=time.time()-start,scope=scope,identityFiles=[str(ip.relative_to(E)) for ip in set((E/'module-identities').glob('*.json'))-old],canonicalInstantiations=sum(ev['op']=='instantiate' and ev['sha256']==build['moduleSHA256'] for i in ids for ev in i['events']),allInstantiations=sum(ev['op']=='instantiate' for i in ids for ev in i['events']),passLines=sum(line.startswith('PASS') for line in text.splitlines()))
 results.append(row);(E/'qualification.json').write_text(json.dumps(dict(source=build['head'],moduleSHA256=build['moduleSHA256'],env=env,results=results,total=len(results),failures=[r for r in results if r['exit']],nativeAuthenticDSETUP11='UNKNOWN',installedRegistry='UNKNOWN'),indent=2)+'\n')
 print(json.dumps(row),flush=True);print(text[-1500:],flush=True)
 if p.returncode:break
assert sha(M)==build['moduleSHA256']
