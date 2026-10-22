"""Exact installed configuration/child command gate, without a guest instance."""
import pathlib,os,json,subprocess,hashlib,socket
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');I=R/'immutable';F=R/'fixed';M=R/'mutable';RT=I/'runtime'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alloc(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')])
assert not (F/'owner-preguest-gate.json').exists()
old=json.loads((F/'hash-gate.json').read_text());assert old['passAll']
pins=json.loads((I/'receipts/runtime-manifest.json').read_text())
for x in pins:assert sha(RT/x['path'])==x['sha256']
codecs=json.loads((I/'receipts/codec-pins.json').read_text())['files']
for x in codecs:assert sha(RT/x['path'].removeprefix('runner/'))==x['sha256']
files=0
for p in (I/'restored/parent-vfs').rglob('*'):
 if p.is_file():assert sha(p)==sha(M/'vfs'/p.relative_to(I/'restored/parent-vfs'));files+=1
assert (M/'registry.json').read_bytes()==(I/'restored/parent-registry.json').read_bytes()
assert sha(M/'registry.json')==old['registrySHA256']
assert all(not p.is_symlink() and p.stat().st_mode&0o222==0 for p in [I,*I.rglob('*')])
env=dict(PATH=os.defpath,HOME='/home/user',LANG='C.UTF-8',NODE_PATH=str(RT/'node_modules'),TMPDIR=str(M/'output/tmp'),TMP=str(M/'output/tmp'),TEMP=str(M/'output/tmp'))
dep=json.loads((F/'owner-dependencies.json').read_text());assert dep['png']['roundTrip'] and dep['png']['version']=='7.0.0'
exclusions={
 '@node-3d/glfw':'No --headless-gl or GPU mode; pure JS raster renderer.',
 '@node-3d/webgl':'No --headless-gl or GPU mode; pure JS raster renderer.',
 'skia-canvas':'No --app/asset decodeImage/media mounts; exact EXE plus complete --vfs-tree.',
 '../tools/watx-closure.js':'Explicit existing --no-build --wasm path; rejecting preload blocks source compiler.',
 './region-layout.js':'Only SECTION_NAME imported from region-layout-hash; no layout CLI/hashOfLayout/build path.',
 '../tools/diablo-gameplay-bench':'No --gameplay-bench.',
 '../tools/build-page-translation-stats.js':'No page translation instrumentation flags.',
 './tools/disasm':'Comment example in tools/disasm.js; not executable require.',
 '../tools/dump_sprites':'No --dump-sprites.'}
assert all(x['spec'] in exclusions for x in dep['missing'])
dynamic={
 'lib/region-map.generated.js':'No WINE_REGION_MAP override; canonical generated mirror.',
 'lib/audio-worklet-host.js':'Scanner hit is a comment.',
 'lib/renderer.js':'Scanner hit is a comment.',
 'lib/media-import.js':'mod(name) only called by media analyze/mount routes, excluded (no media/app).',
 'test/run.js':'win16 ordinal names only for Win16 logging; original commands are PE32, no --trace-win16.',
 'lib/guest-worker.js':'Scanner hits are comments.'}
assert all(x['from'] in dynamic for x in dep['dynamic'])
src=(RT/'test/run.js').read_text()
for text in ['...PIPE_CHILD_ARGS',"`--pipe-child-args=${PIPE_CHILD_ARGS.join(' ')}`",'h.process_spawn = (cmdWa, dirWa, childIp, specWa, count, forceSpawn, showCmd)',"if (!count) return spawnVfsChild",'const child = fork(__filename, args',"if (NO_BUILD && fs.existsSync(WASM_PATH))"]:assert text in src
observer=(F/'game-observer.cjs').read_text();assert "require('worker_threads').isMainThread" in observer and 'h.process_spawn=function' in observer
for name in ['owner-forwarding-fixture.cjs.json','owner-guard-fixture.cjs.json','owner-dependency-preflight.cjs.json']:assert json.loads((F/name).read_text())['exit']==0
# Positive consumption uses the real unchanged guard and exact preserved bytes.
# It compiles Wasm machine code only; there is no source compiler or instance.
positive="const fs=require('fs');WebAssembly.compile(fs.readFileSync("+repr(str(RT/'build/wine-assembly.wasm'))+")).then(m=>console.log(JSON.stringify({canonicalCompile:true,guestInstances:0,sourceCompiles:0,layout:WebAssembly.Module.customSections(m,'wine-region-layout').map(b=>Buffer.from(b).toString())}))).catch(e=>{console.error(e);process.exitCode=1})"
cmd=['node','--require',str(F/'compile-guard.cjs'),'-e',positive,'--','--no-build','--wasm='+str(RT/'build/wine-assembly.wasm')]
p=subprocess.run(cmd,capture_output=True,text=True,env=env);r=dict(command=cmd,exit=p.returncode,stdout=p.stdout,stderr=p.stderr);(F/'owner-canonical-consumption-fixture.json').write_text(json.dumps(r,indent=2)+'\n');assert p.returncode==0,r
ports=[]
for n in range(2):
 with socket.socket() as s:s.bind(('127.0.0.1',0));ports.append(s.getsockname()[1])
assert ports[0]!=ports[1]
game=M/'vfs/program files/acclaim entertainment/shadowman'
names={p.name.lower():p for p in game.iterdir()};exe=names['d3dconfigutility.exe'];mss=names['mss32.dll']
assert sha(exe)=='850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0'
cmd=['node','--require',str(F/'compile-guard.cjs'),'--require',str(F/'game-observer.cjs'),str(RT/'test/run.js'),'--exe='+str(exe),'--exe-guest-path=c:\\program files\\acclaim entertainment\\shadowman\\D3DConfigUtility.exe','--vfs-tree='+str(M/'vfs'),'--cwd=c:\\program files\\acclaim entertainment\\shadowman','--reg-import='+str(M/'registry.json'),'--no-build','--wasm='+str(RT/'build/wine-assembly.wasm'),'--dll-seed='+str(mss),'--spawn-processes','--max-seconds=84','--max-batches=1000000000','--stuck-after=0','--no-close','--quiet-api','--quiet-blocks','--real-ticks','--pipe-child-args=--real-ticks','--trace-api=ShowWindow,UpdateWindow,ExitProcess','--control='+str(ports[0]),'--png='+str(M/'output/config-final.png'),'--save-vfs='+str(M/'output/config-vfs'),'--reg-export='+str(M/'output/config-registry.json')]
assert alloc(F)+16777216<100663296 and alloc(I)<2147483648 and os.statvfs(M).f_blocks*os.statvfs(M).f_frsize==939524096
result=dict(passAll=True,sourceMain=old['runtimeMain'],runtimePaths=len(pins),codecFiles=len(codecs),registrySHA256=sha(M/'registry.json'),cloneFiles=files,moduleSHA256=sha(RT/'build/wine-assembly.wasm'),command=cmd,environment=env,portsFreeAtGate=ports,missingExclusions=exclusions,dynamicResolution=dynamic,workerRoots=dep['workers'],png=dep['png'],canonicalInputFixture=r,watchdogUnchanged=True,projectedTmpfs=old['allocation']['projectedTmpfs'],guestAttempts=0,enumerationLimit='Explicit roots and static Node requires; actual Worker/child instances logged only if created by the one session.')
(F/'owner-preguest-gate.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
