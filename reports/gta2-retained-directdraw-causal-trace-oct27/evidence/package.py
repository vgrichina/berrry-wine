from control import *
import gzip
P=R/'reports'/H.name;P.mkdir(parents=True,exist_ok=True)
old=pathlib.Path('/tmp/gta2-compressed-retained-staging-driving-oct27/ops')
modules=[]
for n,h in [('wine-assembly.wasm','bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9'),('wine-assembly.compat.wasm','ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc')]:
 p=old/'retrieved'/n;b=p.read_bytes();assert sha(b)==h;modules.append(dict(path=str(p),bytes=len(b),sha256=h,standingReadOnly=True,newCopiedBytes=0))
save('input-pins.json',dict(source='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',runner=json.loads((O/'runner-pin.json').read_text()),modules=modules,acceptedOfflineManifest=dict(path='/tmp/gta2-fullscreen-mode-cause-repair-oct27/ops/receipt-manifest.json',sha256='db9cd4a29466ebc83402fce091d99d1dd65a04ddde92480c40a907e7597cbfa8',verifiedPayloads=175,rehashed=False),readiness=str(old/'source-readiness.json'),fixtureReadiness=str(ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json')))
r=json.loads((O/'prepare.execution.json').read_text())['result'];assert r['stopReason']=='aggregate RSS limit' and r['cleanupComplete']
result=dict(status='BLOCKED_LOCAL_ESTIMATE_RSS',causalCapture=False,guestInvocations=0,compilerInvocations=0,boatRequests=0,estimateAttempts=1,estimateReplayed=False,measuredPeakRSS=r['peakRSS'],cap=134217728,overage=r['peakRSS']-134217728,cleanupComplete=True,owned=r['owned'],box='bx_cqss3x42',boxMutated=False,boxState='not requeried; coordinator-supplied allocated running box left untouched',expiry='2026-10-27T14:27:50.265Z',guestCutoff='2026-10-27T14:08:00Z',handback='2026-10-27T14:12:00Z',shutdown='2026-10-27T14:15:00Z',shutdownOwner='coordinator',pendingAPIRequests=[],pendingControlRequests=[],liveOwnedGuestProcesses=[],nextGate='Fresh coordinator assignment must provide a memory-bounded transfer estimate within unchanged physical limits, then verify complete staging and production startup before at most one authorized diagnostic invocation. No current-task restart or limit increase.')
save('diagnostic-result.json',result)
runner=pathlib.Path('/tmp/gta2-fullscreen-mode-cause-repair-oct27/ops/canonical-runner.txt').read_text().splitlines(True)
ex=''.join(''.join(runner[a-1:b]) for a,b in [(294,327),(890,909),(3325,3350),(3392,3414),(3455,3485),(3550,3574),(3931,3973)])
(P/'production-trace-excerpts.txt').write_text(ex)
readme='''# GTA2 retained DirectDraw causal trace: stopped before runtime

Status: **BLOCKED_LOCAL_ESTIMATE_RSS**. The first attempted staging estimate hit
its 128 MiB aggregate physical RSS guard. The supervisor observed 134,397,952
bytes against 134,217,728 bytes (180,224 bytes over), terminated the owned tree,
and verified cleanup. Exit -15 and the original failing operation are preserved.
This attempt was not replayed and no resource limit was raised.

There were **zero guest invocations, zero compiler invocations and zero Boat API
requests** in this task. No causal HRESULT, actual loaded DLL base, API return,
input bytes or Vid_SetMode final EAX was captured. No fullscreen repair or
playability claim is made. Emulator, runner, game files and main are unchanged.
The displayed historical 2 remains a requested mode ID, not an HRESULT.

## Exact boundary and useful retained work

The report-only sparse checkout is based on production source
`1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`, read through immutable donor Git
objects. The canonical runner matched its actual pinned Git blob. The existing
runner resolves COM ordinal API names before filtering, reads zero-based argument
memory at entry, and installs its API exit hook. Relevant exact API table entries
and source excerpts are retained, including untyped metadata; these static checks
are not proof of guest trace output or raw-return completeness at runtime.

The exact actual invocation route was to use `--app=gta2_demo` and its registered
requiredFiles closure, with no additional filename-bearing mount argv. The
canonical parser check passed under supervised local Node v24.18.1 before the
sparse checkout. Remote executable resolution/startup and staged filename
availability were never reached and are explicitly unverified.

The estimate recipe enumerates 3,726 pinned source files, 71 registered game
files, the retained required font closure and both retained compiled modules.
It reads source blobs through bounded Git cat-file and groups at most 40 files
per gzip archive without materializing a full local source tree. Both compiled
module hashes were verified and no new binary copy was made. The estimate was
terminated while measuring archive groups; no complete plan or throughput receipt
exists. Therefore no staging feasibility, aggregate capture arithmetic or launch
readiness is claimed. Source/game/module byte counts are supplied input pins,
not newly transferred bytes.

The retained `prepare.py` is the exact failed diagnostic preparation recipe.
Do not execute it or the controller without a fresh assignment and new owned paths.
Its BytesIO gzip estimation holds archive data while Git and two Python wrapper
processes contribute to the same physical bound. The observed aggregate cap is
binding; reducing estimator/wrapper memory is a possible next prerequisite, not a
fix tested here. A larger Git-only DATA ceiling is not a Python/Node RSS budget.
All historical predecessor attempts, manifests and spent controls remain intact.

## Handback

Assigned Boat `bx_cqss3x42` was untouched: no remote staging, Node startup, guest,
control request or lifecycle mutation. No owned remote PID or pending API/control
request exists. The supplied coordinator preflight is the last observation; this
worker did not requery state. Leave the allocated box running for coordinator
handback and shutdown. Cutoff 14:08 UTC, handback 14:12, coordinator snapshot-stop
14:15, expiry 2026-10-27T14:27:50.265Z remain unchanged. Coordinator may stop early.

Only this report and evidence are published on
`task/gta2-retained-directdraw-causal-trace-oct27`; no main integration or public
deployment. The canonical manifest binds input receipts, failed estimate,
production metadata, cleanup, recipe, and publication-receipt location. Exact
commit and remote-ref verification live in the owned ops publication receipt and
append-only root messageboard after pushing. No ignored binaries are committed.
'''
(P/'README.md').write_text(readme)
# Lossless operation evidence, including original stdout/stderr and failures.
files=[]
for q in sorted(O.iterdir()):
 if q.is_file() and q.name not in ['runner-blob.stdout'] and q.suffix in ['.py','.json','.stdout','.stderr','.log','.cjs']:
  dest=P/'evidence'/q.name;dest.parent.mkdir(exist_ok=True);b=q.read_bytes();dest.write_bytes(b);files.append(dict(path=str(dest.relative_to(P)),bytes=len(b),sha256=sha(b)))
for name in ['README.md','production-trace-excerpts.txt']:
 b=(P/name).read_bytes();files.append(dict(path=name,bytes=len(b),sha256=sha(b)))
manifest=dict(schema=1,task=H.name,source='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',inputs=json.loads((O/'input-pins.json').read_text()),result=result,payloads=files,publication=dict(branch='task/'+H.name,receipt=str(O/'publication.json'),status='pending commit/push; verify receipt and board'),cleanup=dict(estimate=r,watcher='own watcher to be terminated at handback'),tests='No emulator tests/build repeated. Canonical local parser and sparse Git operations passed; first estimate failed RSS guard.')
save('receipt-manifest.json',manifest);(P/'receipt-manifest.json').write_bytes((O/'receipt-manifest.json').read_bytes());print('PACKAGED',len(files),'payloads',sha((O/'receipt-manifest.json').read_bytes()))
