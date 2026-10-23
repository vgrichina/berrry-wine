#!/usr/bin/env python3
"""One-shot consolidated readiness checkpoint. Does not instantiate or build.

Exit 125 on denied admission; never wait/retry, allocate, substitute or compile.
Accepted static ABI evidence is reused, not independently reparsed/reaccepted.
"""
import hashlib, json, os, pathlib, re, shutil, sys, time
H = pathlib.Path(__file__).resolve().parent
R = H.parents[2]
BASE = pathlib.Path('/home/user')
S = BASE/'wine-assembly-shadow-man-fresh-selection-repair-oct23'
C = BASE/'wine-assembly-shadow-man-span-static-canonical-oct23'
A = BASE/'wine-assembly-shadow-man-excerpt-bound-static-accept-oct23/docs/re-notes/shadow-man-excerpt-bound-static-accept-20261023'
O = BASE/'wine-assembly-shadow-man-fresh-selection-independent-accept-oct23/docs/re-notes/shadow-man-fresh-selection-independent-accept-20261023'
GUARD = BASE/'wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs'
EXT = BASE/'wine-assembly/scratch/usage-watch/shadow-man-memory-recovered-handler-qualification-oct23'
SESSION = next((BASE/'.codex/sessions/2026/10/23').glob('*01a167bf-0542-7773-ba00-f21b473ebde4.jsonl'))
def sha(b): return hashlib.sha256(b).hexdigest()
def identity(p):
    p = pathlib.Path(p); b = p.read_bytes()
    return dict(path=str(p), bytes=len(b), sha256=sha(b))
def size(p):
    return sum(q.stat().st_size for q in p.rglob('*') if q.is_file()) if p.is_dir() else p.stat().st_size
def mem():
    return int(re.search(r'^MemAvailable:\s+(\d+)', pathlib.Path('/proc/meminfo').read_text(), re.M).group(1))*1024
def dump(n,j): (H/n).write_text(json.dumps(j, indent=2)+'\n')
if (H/'preflight.json').exists(): raise SystemExit('one-shot checkpoint already retained; no unchanged retry')
abi = json.loads((A/'static-abi.json').read_text())
primary = abi['outputs'][0]
assert primary['sha256'] == '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
module = identity(C/'build/wine-assembly.wasm')
assert module['bytes'] == primary['bytes'] == 1879746
assert module['sha256'] == primary['sha256']
guard = identity(GUARD)
assert guard['sha256'] == '47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
pins = json.loads((O/'source-checks.json').read_text())
source = []
for name in ['test/run.js', 'tools/shadow-man-null-preload.cjs', 'tools/shadow-man-null-capture.cjs',
             'src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','src/13-exports.wat']:
    b = (S/name).read_bytes(); expected = pins['pins'][name]
    blob = hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    assert sha(b) == expected['sha256'] and blob == expected['gitBlob'], name
    source.append(dict(identity(S/name), gitBlob=blob, candidate=pins['candidate']))
assert pins['candidate'] == 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
assert len(primary['imports']) == 291 and len(primary['types']) == 172
assert sum(e['kind']==0 for e in primary['exports']) == 2227
assert primary['noStart'] is True
assert abi['layout']['payload'] == '9a3bc9149d58209c'
assert len(abi['layout']['regions']) == 269
dump('accepted-contract.json',dict(source=source, module=module, guard=guard,
     staticAcceptance='cf5612a1482cbfead91450b679a58b18958f53dc',
     staticEvidence=identity(A/'static-abi.json'), sourceAcceptance='4dab22cfefb7b7048fbb6189b81cdccdd4ab8753',
     sourceOfflineAcceptance='4dab22cfefb7b7048fbb6189b81cdccdd4ab8753; fresh-selection independent report reused',
     imports=primary['imports'], exports=primary['exports'], types=primary['types'],
     memories=primary['memories'], noStart=primary['noStart'], customSections=primary['customSections'],
     layout=abi['layout'], meaning='Exact accepted evidence reused, no static inspector or native Module executed'))
tools = [identity(shutil.which(x)) for x in ['node','python3','git']]
focused = [identity(p) for p in H.iterdir() if p.is_file()]
measured = dict(taskTreeIncludingPrivateGit=size(R), externalLauncherEventsStderr=size(EXT),
                separateCodexSession=size(SESSION))
allowances = dict(privateGitIndexNewObjectsFocusedFixtureEvidenceTempGrowth=12*1024**2,
                  externalLauncherFutureGrowth=4*1024**2, separateSessionFutureGrowth=12*1024**2,
                  reserveInsideCap=8*1024**2)
projected = sum(measured.values())+sum(allowances.values())
free = shutil.disk_usage(R).free
small = mem()
requirements = dict(native=dict(oldSpaceMiB=512, cpuSeconds=150, wallSeconds=150,
                    fixedSharedArenaBytes=536870912, initialPages=8192, maximumPages=8192,
                    maximumLiveArenasPerProcess=1, maximumConcurrentNativeChildren=1,
                    workers=False, implicitBuildHelpers=False, sourceCompile=False,
                    exactRetainedNativeModuleCompilation=True, moduleEntryGuardBytes=8388608,
                    minimumMemAvailableBytes=1610612736, currentLiveTaskArenas=0),
                    smallJS=dict(oldSpaceMiB=256,cpuSeconds=60,wallSeconds=60,minimumMemAvailableBytes=805306368),
                    python=dict(cpuSeconds=60,wallSeconds=60),
                    shared=dict(fileMax=25165824,aggregateStdoutStderrMax=524288,
                                failClosedExit=125,termThenKillSeconds=5,subreaper=True,fullReap=True))
initial = dict(timeUTC=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()), focusedManifest=focused,
               measured=measured, allowances=allowances, projectedPeakBytes=projected, capBytes=67108864,
               hostFreeBytes=free, hostAfterEntireProjectionBytes=free-projected, hostFloorBytes=2982150144,
               standingInputs=[module,guard,identity(A/'static-abi.json'),*source], installedTools=tools,
               standingDirectObjectStore=dict(path='/home/user/wine-assembly/.git/objects', bytes=size(BASE/'wine-assembly/.git/objects')),
               session=str(SESSION), requirements=requirements, preSmallMemAvailableBytes=small)
assert projected <= 67108864 and free-projected >= 2982150144
assert small >= 805306368
dump('pre-small-admission.json',initial)
recovery=json.loads((BASE/'wine-assembly/scratch/usage-watch/shadow-man-native-memory-recovery-oct23.json').read_text())
assert recovery['complete'] and recovery['passed'] and len(recovery['samples'])==3 and recovery['durationSeconds']>=40
dump('recovery-reused.json',recovery)
# Only the core dependencies used by preload/capture and an extracted synchronous
# runner boundary are required. Full CLI startup/video/renderer codecs are outside
# that focused approach; inspect availability, never install or load native codecs.
from guard import run
code = """const fs=require('node:fs'); const mods=['node:fs','node:crypto','node:path','node:worker_threads','node:vm','node:assert/strict'];
const core=mods.map(x=>({name:x,resolved:require.resolve(x),loaded:!!require(x)}));
const codecs=['pngjs','skia-canvas','canvas'].map(x=>{try{return {name:x,resolved:require.resolve(x,{paths:[process.argv[1]]}),requiredForFocusedBoundary:false}}catch(e){return {name:x,available:false,code:e.code,requiredForFocusedBoundary:false}}});
console.log(JSON.stringify({version:process.version,execPath:process.execPath,versions:process.versions,core,codecs,arenaConstructed:false,nativeModuleCompiled:false}));"""
receipt = run('installed-node-dependencies',[shutil.which('node'),'--max-old-space-size=256','-e',code,str(S)])
dump('installed-node-dependencies.json',json.loads(receipt['stdout']))
# This is the single mandatory native admission decision. No polling or retries.
available = mem()
initial['freshNativeMemAvailableBytes'] = available
initial['nativeMinimumBytes'] = 1610612736
initial['nativeDeficitBytes'] = max(0,1610612736-available)
initial['nativeCommandsExecuted'] = []
initial['smallJSArgv'] = receipt['argv']
initial['nativeFixtureStatus'] = 'not implemented/executed before admission; no handler qualification claimed'
initial['verdict'] = 'BLOCKED_NATIVE_MEMAVAILABLE' if available < 1610612736 else 'NATIVE_MEMORY_PASS_IMPLEMENTATION_PENDING'
initial['resumeCondition'] = 'Coordinator supplies fresh native admission with MemAvailable >=1610612736 bytes and unchanged remaining limits; do not kill other owners or shrink arena/heap.'
dump('preflight.json',initial)
print(json.dumps({k:initial[k] for k in ['verdict','freshNativeMemAvailableBytes','nativeMinimumBytes','nativeDeficitBytes','projectedPeakBytes','hostAfterEntireProjectionBytes']}))
raise SystemExit(125 if available < 1610612736 else 0)
