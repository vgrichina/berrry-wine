import pathlib,json,subprocess,os,hashlib,time,datetime
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-pinned-dependency-qualification';os.chdir(R)
H='84f2a0165798f30d7a131dccdcc054a224fbf57b';C='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def admission():
 a=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]);f=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert a+67108864+33554432<1073741824 and f-33554432>2147483648;return dict(allocated=a,free=f)
assert subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()==H
assert sha(R/'build/wine-assembly.wasm')==C
assert sha(R/'build/wine-assembly.compat.wasm')=='65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65'
pre=json.loads((E/'preflight.json').read_text());assert pre['png']['roundTrip'] and not pre['extraCompileReason']['hasTestDirectxSetup']
review=dict(verdict='PASS required dependencies resolved; optional unused paths excluded',recursiveFiles=pre['recursiveFiles'],requiredExternalPackages=['pngjs@7.0.0'],optionalMissing={'@node-3d/glfw':'lazy lib/headless-gl.load for GL apps; generated fixture commands never request GL','@node-3d/webgl':'same unused GL path','skia-canvas':'decodeMountedImage for app decodeImage assets; generated EXE commands have no assets'},commentFalsePositive={'tools/disasm.js -> ./tools/disasm':'comment Library usage example, not an executable import'},dynamicResolution=['tools/watx.js','tools/watx-closure.js','tools/region-layout-hash.js','lib/dispatch-trampoline.js','lib/pe.js','src/win16-ordinals.generated.json','lib/media-sniff.js','lib/zip-mount.js','lib/iso9660.js','lib/byte-provider.js','lib/cdrom.js'],tools=pre['tools'],png=pre['png'])
for rel in review['dynamicResolution']:assert (R/rel).is_file(),rel
# Loading helpers has no compile/test side effects. Actual fixture/test commands follow only after this preflight.
p=subprocess.run(['node','-e',"require('./test/render-helper');require('./test/compile-src');require('./tools/watx.js');require('./lib/host-imports');console.log('Required runtime/compiler helper load PASS')"],stdout=subprocess.PIPE,stderr=subprocess.STDOUT);(E/'preflight-helper-load.log').write_bytes(p.stdout);assert p.returncode==0,p.stdout
(E/'preflight-review.json').write_text(json.dumps(review,indent=2)+'\n')
ids=E/'module-identities';ids.mkdir(exist_ok=True)
env=dict(os.environ,GIT_NO_LAZY_FETCH='1',WA_TEST_WASM=str(R/'build/wine-assembly.wasm'),WA_TEST_WASM_SHA256=C,NODE_OPTIONS='--require='+str(E/'module-observer.js'),WA_IDENTITY_DIR=str(ids),WA_DLL_LIFECYCLE_ARTIFACTS=str(E/'lifecycle-artifacts'),WA_DLL_GRAPH_ARTIFACTS=str(E/'graph-artifacts'))
tests=[('test/test-directx-setup.js','test-required separate full-source extra export test_directx_setup, absent from canonical; existing render-helper has no WASM file input'),('test/test-directx-ordinals.js','JS ordinal resolution'),('test/test-dsetup-loading.js','synthetic source binding fixture; no x86'),('test/test-dll-lifecycle-real-pe.js','canonical generated PE x86 four cases'),('test/test-dll-import-graph-lifecycle.js','canonical generated PE x86 graph; imports existing lifecycle helper'),('test/test-dll-import-no-ilt.js','existing render harness full-source extra exports; see documented extraWat'),('test/test-dll-lifecycle-races.js','canonical generated x86 races'),('test/test-scoped-dll-native.js','canonical generated x86 scoped ABI'),('test/test-scoped-dll-lifecycle.js','JS/Worker ABI simulation')]
rows=[]
for test,scope in tests:
 assert datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M')<'22:40'
 beforeAlloc=admission();before=set(ids.glob('*'));start=time.time();name=pathlib.Path(test).stem
 with (E/(name+'.log')).open('wb') as f:
  try:q=subprocess.run(['node',test],env=env,stdout=f,stderr=subprocess.STDOUT,timeout=150);rc=q.returncode;timeout=False
  except subprocess.TimeoutExpired:rc=124;timeout=True
 identity=sorted(set(ids.glob('*'))-before);events=[ev for i in identity for ev in json.loads(i.read_text())['events']];s=(E/(name+'.log')).read_text(errors='replace')
 row=dict(test=test,command=['node',test],scope=scope,exit=rc,timeout=timeout,seconds=time.time()-start,testSHA256=sha(R/test),identityFiles=[str(i.relative_to(E)) for i in identity],events=events,passLines=[l for l in s.splitlines() if l.startswith('PASS') or 'simulation PASS' in l],before=beforeAlloc,after=admission());rows.append(row)
 out=dict(source=H,canonicalSHA256=C,newCanonicalBuilds=0,results=rows,notRun=[t for t,s in tests[len(rows):]],nativeGenuineDSETUP11='UNKNOWN',installedRegistry='UNKNOWN',game='NOT RUN')
 (E/'qualification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(row),s[-2200:],flush=True)
 if rc:break
assert sha(R/'build/wine-assembly.wasm')==C
