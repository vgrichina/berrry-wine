#!/usr/bin/env python3
"""One read-only admission attempt; no compiler/module execution or source staging.

Short-circuit at the first unproved output bound. This is a BLOCKED receipt,
not a complete compiler/qualification-closure or execution admission recipe.
Run using the standing Python with CPU/wall/file/capture limits as in the report.
"""
import hashlib, json, os, pathlib, resource, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
HOST = pathlib.Path('/home/user/wine-assembly')
FIXTURE = pathlib.Path('/home/user/wine-assembly-render-positiont-com-qualification-fixture-oct23')
READY = pathlib.Path('/home/user/wine-assembly-render-positiont-file-log-bounds-readiness-oct23')
CANDIDATE = '7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6'
ACCEPTANCE = 'aea185d3dfc1b772cea00ca1a4aed14b9553dfed'
REVISION = '54d701e9d7f5de8c9e8fc045864228e6d85db01f'
NAME = 'render-positiont-diagnostic-com-qualification-oct23'
EVIDENCE = ROOT / 'docs/re-notes/render-positiont-diagnostic-com-qualification-20261023'
OLD = READY / 'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023'
EXTERNAL = HOST / 'scratch/usage-watch' / NAME
SESSION = pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T05-26-39-01a16739-bafd-7b72-a226-731e20d381c4.jsonl')
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1', GIT_OPTIONAL_LOCKS='0')

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], env=ENV, timeout=20)

def sha(b):
    return hashlib.sha256(b).hexdigest()

def footprint(p):
    if not p.exists():
        return 0
    if p.is_file():
        return p.stat().st_size
    return sum(q.lstat().st_size for q in [p, *p.rglob('*')] if not q.is_symlink())

def save(name, value):
    (EVIDENCE / name).write_text(json.dumps(value, indent=2) + '\n')

def main():
    started = time.time()
    assert not (EVIDENCE / 'admission.json').exists(), 'one attempt only; existing receipt'
    # Only planning/publication is admitted. No runtime or full source bytes are copied.
    current = footprint(ROOT) + footprint(EXTERNAL) + footprint(SESSION)
    reserve, future = 8388608, 4194304
    projected = current + reserve + future
    free = os.statvfs(ROOT).f_bavail * os.statvfs(ROOT).f_frsize
    assert projected <= 67108864 and free-future >= 2982150144, 'planning/publication allocation denied'
    assert git(FIXTURE, 'rev-parse', 'HEAD').decode().strip() == CANDIDATE
    assert git(READY, 'rev-parse', 'HEAD').decode().strip() == REVISION
    # Scoped acceptance is user-supplied and repeated in the sealed readiness
    # report. Thin fixture donors do not promise its historical commit object.
    assert ACCEPTANCE in (READY / 'docs/re-notes/render-positiont-file-log-bounds-readiness-20261023.md').read_text()
    seals = json.loads((OLD / 'seals.json').read_text())
    for seal in seals:
        b = (READY / seal['path']).read_bytes()
        assert len(b) == seal['bytes'] and sha(b) == seal['sha256'], seal['path']
        assert b == git(READY, 'show', REVISION + ':' + seal['path']), seal['path']
    # Reuse accepted invocation/control outcomes; never rerun their commands.
    reused = {n: json.loads((OLD / n).read_text()) for n in
              ['readiness.json', 'controls.json', 'bounds-controls.json', 'closure.json', 'admission.json', 'capture.json']}
    manifest = json.loads((OLD / 'manifest.json').read_text())
    bypath = {r[0]: r for r in manifest}
    pins_bytes = git(FIXTURE, 'show', CANDIDATE + ':test/support/positiont-com-source-pins.json')
    pins = json.loads(pins_bytes)
    focused = []
    # Verify all exact pins through the retained readiness files, one at a time.
    for p, blob in pins.items():
        b = (READY / p).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest()
        assert actual == blob and bypath[p][1] == blob, p
        focused.append(dict(path=p, blob=blob, bytes=len(b), sha256=sha(b), standingDonor=str(READY)))
    roots = ['test/support/positiont-com-module.js', 'test/test-d3d9-positiont-com-qualification.js',
             'test/compile-src.js', 'test/render-helper.js', 'tools/watx-closure.js', 'tools/watx.js',
             'tools/watx-src/compiler-codegen.js']
    sources = {}
    for p in roots:
        b = (FIXTURE / p).read_bytes()
        assert hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest() == bypath[p][1], p
        sources[p] = b.decode()
        focused.append(dict(path=p, bytes=len(b), sha256=sha(b), standingDonor=str(FIXTURE)))
    standing = json.loads((OLD / 'standing.json').read_text())
    for t in standing['tools']:
        b = pathlib.Path(t['path']).read_bytes()
        assert len(b) == t['standingBytes'] and sha(b) == t['sha256'], t['name']
    png = standing['pngjs']
    for f in png['files']:
        b = (pathlib.Path(png['root']) / f['path']).read_bytes()
        assert len(b) == f['bytes'] and sha(b) == f['sha256'], f['path']
    builder = sources[roots[0]]
    assert "{tailCalls:true}" in builder
    assert "file==='13-exports.wat'?`${source}\\n${extraWat}`:source" in builder
    assert "assert(bytes.length<=32*1024*1024" in builder
    assert builder.index('compileSrcWasm((file,source)') < builder.index('assert(bytes.length<=32*1024*1024')
    assert builder.index('validateExports(new WebAssembly.Module(bytes))') < builder.index('fs.writeFileSync(modulePath,bytes')
    save('focused-identities.json', focused)
    save('reused-evidence.json', dict(revision=REVISION, seals=len(seals),
         paths={n:sha((OLD/n).read_bytes()) for n in reused},
         note='Exact accepted prior results reused; zero gates or decoder rerun.'))
    save('standing.json', standing)
    observed = footprint(ROOT) + footprint(EXTERNAL) + footprint(SESSION)
    mem = {k:int(v.split()[0])*1024 for k,v in (line.split(':',1) for line in pathlib.Path('/proc/meminfo').read_text().splitlines())}
    result = dict(status='BLOCKED', exit=2, firstBlocker='PREBUILD_DIAGNOSTIC_OUTPUT_BOUND_UNKNOWN',
        diagnostic='Exact builder allows 33554432 bytes only after compilation; task file cap is 25165824. No exact diagnostic size/tighter pre-build upper bound in supplied readiness or fixture evidence. Actual output size remains unknown, not proven oversized.',
        candidate=CANDIDATE, scopedAcceptance=ACCEPTANCE, readinessRevision=REVISION,
        sealsVerified=len(seals), pinsVerified=len(pins),
        moduleMaximumAllowedByBuilder=33554432, perFileLimit=25165824,
        byteDifference=8388608, actualModuleBytes=None, actualModuleSha256=None, actualProvenanceSha256=None,
        exactBuild=['node','test/support/positiont-com-module.js','--build-diagnostic','build/positiont-com-diagnostic.wasm','build/positiont-com-diagnostic.provenance.json'],
        exactBuildExecuted=False, compileOptions=dict(tailCalls=True,mode='production',standardWat=True,runtimeBuiltins=False,strictDeclarations=True),
        transform='append diagnostic exports only to 13-exports.wat',
        buildAlsoCallsWebAssemblyModuleBeforeWrite=True,
        admission=dict(taskCap=67108864,reserve=reserve,futureGrowth=future,measuredPlanningOwned=observed,
                       projectedPlanningPeak=observed+reserve+future,hostFree=free,hostFreeAfterFutureGrowth=free-future,hostFloor=2982150144,
                       capturedLimit=524288,regularFileLimit=25165824,
                       fullCompileAndQualificationPhasedPeak=None,completeTransitiveClosureEstablished=False,
                       reason='Short-circuited at unknown output bound before materialization and full execution admission.'),
        process=dict(pid=os.getpid(),session=os.getsid(0),maxRssBytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
                     memAvailableAtPlanning=mem['MemAvailable'],compilerChildren=0,qualificationChildren=0,
                     nativeCompiles=0,nativeModules=0,instances=0,guestArenas=0),
        serialization=dict(ownerSession='01a16735-443f-7c91-8b79-bb5bc35976e0',ownerLauncherPid=1767509,
                           resultPresent=(HOST/'scratch/usage-watch/shadow-man-ready-canonical-module-oct23/result.json').exists(),
                           waitRequiredForBuild=True,waitPerformed=False,note='Preflight blocked before heavy phase; no wait or interference necessary.'),
        baseline='UNEXECUTED',negativeControls={c:'UNEXECUTED' for c in ['disable-shared-route','alias-queued-bytes','corrupt-queued-ir']},
        elapsedSeconds=time.time()-started,
        resumeCondition='Coordinator supplies a defensible exact diagnostic pre-build size upper bound <=25165824, then separately admits complete closure/phases and serialized fresh memory/disk. Do not infer actual size from 32MiB maximum or weaken source/guards.',
        box=None,lifecycleOwner='coordinator')
    save('admission.json',result)
    print(json.dumps({k:result[k] for k in ['status','exit','firstBlocker','sealsVerified','pinsVerified']}))
    return 2

if __name__ == '__main__':
    sys.exit(main())
