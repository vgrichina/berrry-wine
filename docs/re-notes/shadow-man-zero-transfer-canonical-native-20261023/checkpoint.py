#!/usr/bin/env python3
"""Read-only exact-candidate admission. Never builds or executes candidate JS."""
import gzip, hashlib, importlib.util, json, os, pathlib, re, shutil, subprocess, sys
sys.dont_write_bytecode = True
H = pathlib.Path(__file__).resolve().parent
R = H.parents[2]
CAND = '2e6f5984d3f64d7781fb02da09bbb8d564302123'
BASE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
ROOT = pathlib.Path('/home/user/wine-assembly')
EXT = ROOT/'scratch/usage-watch/shadow-man-zero-transfer-canonical-native-oct23'
OLD = pathlib.Path('/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/docs/re-notes/shadow-man-complete-gate-data-readiness-20261023')
SPAN = pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/docs/re-notes/shadow-man-span-static-canonical-20261023')
STATIC = pathlib.Path('/home/user/wine-assembly-shadow-man-static-declaration-laws-repair-oct23/docs/re-notes/shadow-man-static-declaration-laws-repair-20261023/static-abi.py')
GUARD = pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')
def sha(b): return hashlib.sha256(b).hexdigest()
def dump(name, obj): (H/name).write_text(json.dumps(obj, indent=2)+'\n')
def git(*args): return subprocess.check_output(['git','-C',str(R),*args],env=ENV)
def size(p): return sum(x.stat().st_size for x in ([p] if p.is_file() else p.rglob('*')) if x.is_file() and not x.is_symlink())
def scanner(f): return (f.startswith('src/') and f.endswith(('.wat','.watx'))) or (f.endswith('.js') and (f.startswith(('lib/','tools/','test/')) or '/' not in f))
def main():
    assert git('rev-parse','HEAD').decode().strip()==CAND
    tree={s.split('\t')[1]:s.split()[2] for s in git('ls-tree','-r',CAND).decode().splitlines()}
    old=json.loads(gzip.decompress((OLD/'phase-manifest.json.gz').read_bytes()))
    production=json.loads((SPAN/'manifest.json').read_text())
    wanted={r['path'] for r in old['rows']} | {r['path'] for r in production['files']}
    assert {f for f in tree if scanner(f)}=={f for f in wanted if scanner(f)}
    rows=[]; contents={}; missing=[]
    proc=subprocess.Popen(['git','-C',str(R),'cat-file','--batch'],env=ENV,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    for f in sorted(wanted):
        blob=tree[f];proc.stdin.write((blob+'\n').encode());proc.stdin.flush()
        header=proc.stdout.readline().decode().split()
        if header[-1]=='missing':
            b=None
            # Standing exact files only; no archived-path recovery or copying.
            for root in [ROOT,pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23')]:
                p=root/f
                if p.is_file():
                    candidate=p.read_bytes()
                    if hashlib.sha1(b'blob '+str(len(candidate)).encode()+b'\0'+candidate).hexdigest()==blob: b=candidate;break
            if b is None: missing.append(dict(path=f,blob=blob));continue
        else:
            assert header[1]=='blob';b=proc.stdout.read(int(header[2]));assert proc.stdout.read(1)==b'\n'
        assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==blob
        rows.append(dict(path=f,blob=blob,sha256=sha(b),bytes=len(b)))
        if f.startswith('src/') or f in ['tools/build.sh','tools/concat-wat.js','tools/watx-src/compiler-codegen.js','lib/region-map.generated.js','test/run.js']: contents[f]=b
    proc.stdin.close();assert proc.wait()==0
    (H/'candidate-inputs.json.gz').write_bytes(gzip.compress(json.dumps(dict(candidate=CAND,files=rows,missing=missing),separators=(',',':')).encode(),mtime=0))
    assert not missing,missing
    include=re.findall(r'\(include "([^"]+)"\)',contents['src/main.watx'].decode())
    combined=b'(module\n'+b''.join(contents['src/'+f] for f in include)+b')\n'
    compiler=contents['tools/watx-src/compiler-codegen.js'];lines=compiler.splitlines(keepends=True)
    excerpt=b''.join(b''.join(lines[a-1:z]) for a,z in [(1759,1810),(1890,2006),(2161,2200)])
    compiler_record=dict(path='tools/watx-src/compiler-codegen.js',blob=tree['tools/watx-src/compiler-codegen.js'],sha256=sha(compiler),excerptRanges=[[1759,1810],[1890,2006],[2161,2200]],excerptBytes=len(excerpt),excerptSHA256=sha(excerpt),recipe='splitlines(keepends=True); concatenate inclusive ranges in given order')
    assert compiler_record['blob']=='71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c'
    assert sha(compiler)=='84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d'
    assert len(excerpt)==11191 and sha(excerpt)=='9aee170db719a6bcc979c007091635f7c537f2e2333471cc9a0ee4b015c98b12'
    assert sha(STATIC.read_bytes())=='2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8'
    assert sha(GUARD.read_bytes())=='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
    spec=importlib.util.spec_from_file_location('static_abi',STATIC);abi=importlib.util.module_from_spec(spec);spec.loader.exec_module(abi)
    regions,text,fingerprint=abi.inventory(combined.decode(),contents['lib/region-map.generated.js'].decode())
    assert fingerprint=='9a3bc9149d58209c' and len(regions)==269
    assert any(r['name']=='DIRECT_WINDOW' and r['kind']=='span' for r in regions)
    # Reuse exact corrected-helper tests; binding inputs are independently derived above.
    accepted=json.loads((SPAN/'helper-tests.json').read_text());assert accepted['exit']==0
    controls=dict(status='REUSED exact unchanged helper; candidate inventory freshly derived',receipt=str(SPAN/'helper-tests.json'),sha256=sha((SPAN/'helper-tests.json').read_bytes()),stdout=str(SPAN/'helper-tests.stdout'),stdoutSHA256=sha((SPAN/'helper-tests.stdout').read_bytes()),required=['omission','change','duplicate'],freshNativeControls=False)
    dump('static-source-binding.json',dict(candidate=CAND,helper=str(STATIC),helperSHA256=sha(STATIC.read_bytes()),regions=regions,serialization=text,fingerprint=fingerprint,controls=controls,compiledABI='NOT EXECUTED'))
    assert sha(contents['test/run.js'])=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
    tools=[]
    for name in ['node','python3','git','bash','ssh']:
        p=pathlib.Path(shutil.which(name)).resolve();tools.append(dict(name=name,path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),standing=True,executeInPlace=True))
    sessions=list(pathlib.Path('/home/user/.codex/sessions/2026/10/23').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));assert len(sessions)==1
    owned=size(R);external=size(EXT);session=size(sessions[0]);source=sum(r['bytes'] for r in rows)
    # bash tools/build.sh has no source release step. No phase script or cleanup
    # is silently substituted for the exact canonical command.
    allowances=dict(privateGitAndOwned=owned,externalLauncher=external,separateCodexSession=session,completeInputs=source,generatedCombined=len(combined),primaryAndCompatMaximum=2*8388608,aggregateCapturedOutput=524288,evidenceGitIndexDirectoriesGrowth=1048576,sessionAndLauncherFutureGrowth=1048576,reserve=8388608)
    total=sum(allowances.values());free=shutil.disk_usage(R).free
    lower=source+len(combined)+8388608
    mem=int(re.search(r'^MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text(),re.M)[1])*1024
    build=contents['tools/build.sh'];assert build.count(b'\nnode tools/build-compile-wat.js\n')==1
    receipt=dict(candidate=CAND,parent=BASE,command=['bash','tools/build.sh'],buildBlob=tree['tools/build.sh'],buildSHA256=sha(build),closure=dict(files=len(rows),bytes=source,scannerFiles=sum(scanner(r['path']) for r in rows),includeFiles=len(include),combinedBytes=len(combined),combinedSHA256=sha(combined),manifest='candidate-inputs.json.gz',missing=missing),compiler=compiler_record,tools=tools,staticHelper=str(STATIC),nativeGuard=dict(path=str(GUARD),sha256=sha(GUARD.read_bytes()),status='UNCHANGED; exact accepted enforcement retained; NOT invoked in this task'),resources=dict(allowances=allowances,projectedTotal=total,cap=67108864,excess=total-67108864,sourceCombinedReserveLowerBound=lower,lowerBoundExcess=lower-67108864,hostFree=free,hostAfterProjectedGrowth=free-(total-owned-external-session),hostFloor=2982150144,MemAvailable=mem,buildMemoryMinimum=2684354560,nativeMemoryMinimum=1610612736,smallMemoryMinimum=805306368,sessionPath=str(sessions[0])),requiredEnforcement=dict(fileBytes=25165824,aggregateOutputBytes=524288,overflowExit=125,termKillSeconds=5,subreaper=True,fullReap=True,build=dict(oldspaceMiB=2048,cpu=900,wall=900),native=dict(oldspaceMiB=512,cpu=150,wall=150,arenaBytes=536870912,maxLiveArenas=1,workers=False),smallJS=dict(oldspaceMiB=256,wall=60),pythonWall=60),arenaSchedule=dict(canonicalDecoderBytes=44302336,completeCompilerArenaBytes=0,nativeFixtureArenaBytes=536870912,aggregateMaximumBytes=536870912,serialFullReapRequired=True,actualLiveOwnedArenas=0),verdict='DENIED_CANONICAL_DISK_ALLOCATION',buildAttempts=0,nativeAttempts=0,sourceRepair=False,producerHashRefresh=False)
    dump('checkpoint.json',receipt)
    print(json.dumps(dict(verdict=receipt['verdict'],files=len(rows),inputs=source,combined=len(combined),lowerBound=lower,projected=total,cap=67108864,excess=total-67108864,MemAvailable=mem)))
    assert total>67108864 and lower>67108864
    return 3
if __name__=='__main__': sys.exit(main())
