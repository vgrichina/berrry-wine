from run import *
D=pathlib.Path('/tmp/airstrike-frozen-dispatch-protocol-repair-oct27')
p=json.loads((H/'pins.json').read_text());prior=json.loads((D/'ops/result.json').read_text())
assert (H/'runner-blob.stdout').read_text()==(H/'runner-file.stdout').read_text()
for path,sha in p['pins'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==sha
assert hashlib.sha256(pathlib.Path(p['runner']).read_bytes()).hexdigest()==p['runnerSHA256']
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  while b:=f.read(1024*1024):h.update(b)
 return h.hexdigest()
sourcepins={x:digest(R/x) for x in ['test/test-airstrike-independent-accept-oct27.py','test/test-airstrike-independent-flow-oct27.py','test/test-airstrike-independent-cli-oct27.py','test/fixtures/airstrike-independent-accept-oct27.cjs']}
groups={n:json.loads((H/(n+'.json')).read_text()) for n in ['first-boundary','independent','independent-normal-corrected','flow','cli']}
assert all(groups[n]['exit']==0 and groups[n]['cleanupComplete'] for n in groups if n!='independent')
assert groups['independent']['exit']==1 and groups['independent']['cleanupComplete']
reused={}
for n,count in [('production-corrected',7),('controller-queue-regress',6),('bridge-regress',12)]:
 q=prior['groups'][n];assert q['exit']==0 and q['cleanupComplete']
 reused[n]=dict(count=count,receipt=q,paths={str(D/'ops'/f):digest(D/'ops'/f) for f in [n+'.json',n+'.stdout',n+'.stderr']},candidatePins=p['pins'])
dump('reused-regressions.json',reused)
config={str(x):digest(x) for x in [S,H/'run.py',ROOT/'scratch/usage-watch/light-execution-pool-oct26.py',R/'.git/config',R/'.git/info/sparse-checkout',R/'.git/objects/info/alternates',pathlib.Path('/usr/bin/node')]}
dump('configuration.json',dict(pins=config,CWD=os.getcwd(),module='No Wasm/guest/module execution; only exact source excerpts and actual Python controller CLI',mount='not applicable: no mounts, guest or boxes',GitChildLimits=dict(RSS=256*M,DATA=512*M),testProcessTreeLimits=dict(RSS=128*M,CPU=90,wall=120,file=24*M,output=2*M),Node=dict(executable='/usr/bin/node',flags=['--max-old-space-size=32'],startupReceipts=['first-boundary/startup.stdout','independent/startup.stdout','independent-normal-corrected/startup.stdout','flow/startup.stdout'],DATA='unlimited inherited; Git DATA not applied',AS='unlimited inherited; RSS supervised physically'),donor='read-only immutable alternates '+str(D/'repo/.git/objects')))
incidents='''Historical task incidents (preserved, not candidate rejections):
1. Initial broad policy/result reads exceeded 8192-byte display/operation. Original tool/session/events retained; later displays bounded. No retrospective compliance claimed.
2. Exploratory cat of donor ops/git.py failed ENOENT; no such helper was required. Original tool output retains exact diagnostic.
3. Independent normal test asserted frozen snapshot exactly {frozen,credits}; production also includes tickMs16 and recordingfalse. Original independent.stderr and normal runner outputs retained. Corrected expectation enumerates all four exact fields; only that failed test rerun, passing ten adversarial tests reused.
4. An unused sed command accidentally targeted /dev/null with -i, failed (nonregular file), stderr redirected by the original command. No candidate/root tracked files changed. It was not used for setup or evidence and has no acceptance implication; original session preserves exact command. No missing stderr is retrospectively reconstructed.
5. First git add refused two new independent test paths outside sparse definitions. Added only those exact owned sparse paths, preserving original stage stdout/stderr. First diff-check identified three original Git hint trailing spaces in immutable init.stderr. Preserved bytes and marked only that raw evidence file binary via report-local attributes; no source whitespace waiver. Both failed receipts retained.
6. Review reached successful content-hash verification then hit accounting.json.tmp rename collision between supervisor and supervised reviewer admission checks. Changed only wrapper temporary filenames to include PID; process resource limits unchanged. Failed review stdout/stderr/receipt preserved. Follow-up diff-check correctly found original hint whitespace repeated inside retained first diff-check stdout; marked raw diff-check*.stdout binary, leaving source/test whitespace checking enabled. No acceptance groups rerun.
'''
(H/'incidents.txt').write_text(incidents)
result=dict(status='ACCEPT_SOURCE_ONLY_FROZEN_DISPATCH',decision='ACCEPT',candidate=p['candidate'],sourceRunnerRevision=p['runnerRevision'],sourceRunnerSHA256=p['runnerSHA256'],sourceRunnerGitBlob=(H/'runner-blob.stdout').read_text().strip(),candidatePins=p['pins'],independentPins=sourcepins,groups=groups,reusedRegressionGroups=reused,newPassingTests=19,uniqueIndependentMethods=18,countsExplanation='1 unchanged mandatory earliest reproducer + 11 independent boundary methods (normal corrected once) + 4 external/full-flow methods + 3 actual CLI methods = 19 passing test executions; 18 newly authored methods. Ten passing boundary methods not rerun.',mutationCoverage=dict(transport=['duplicate step ACK','late step ACK','wrong completion batch','prior identical action snapshot','prior identical action execution log','terminal input','terminal step','terminal snapshot','focus change','image mismatch'],reusedProduction=['partial ACK','wrong-ID ACK','credits nonzero','missing actual execution log','timeout'],externalApproval=['wrong session','wrong token','wrong image SHA','wrong after','absent approval'],menu=['wrong selected row','wrong labels'],CLI=['partial','steps','wrong-batch','unfrozen','credits','stale-snapshot','stale-log','missing-log','wrong-input','duplicate-id','step-reject','snapshot-reject'],terminal=['cleanup signal','timeout','controlquit','wmclose','missing host exit']),fullFlow=dict(actions=16,serialSteps=16,captures=16,syntheticBytesPerCapture=18,totalCaptureBytes=288,sourceFixtureOnly=True,actualPNGQualification=False,cleanupReserveInsideAllocation=40*M),actualGuestStarts=0,boxes='none assigned or accessed',main=False,deployed=False,implementationModified=False,remainingActualGameGate='Separately authorized exact-runner actual Airstrike menu/normal-Quit qualification, external factual image/focus/menu approval, fresh immutable guest closure/resource/lifecycle admission and measured <=1MiB/image x16 capture profile plus cleanup reservation. Never replay uncertain input or infer ordinary Quit from cleanup/timeout. This report approves source protocol only.',rootRefs='initial launcher digest reused; no later root ref comparison claimed',historicalIncidents=str(H/'incidents.txt'))
dump('result.json',result)
dump('checkpoint.json',dict(candidate=p['candidate'],candidatePins=p['pins'],independentPins=sourcepins,completed='mandatory earliest boundary, independent guards, external review/focus/menu binding, full16 protocol+capture+cleanup, actual executable CLI and negative mutations',decision='ACCEPT_SOURCE_ONLY',remaining=[result['remainingActualGameGate'],'task branch commit/push/exact remote verification'],evidenceRoot=str(H)))
Q=R/'docs/reviews/airstrike-frozen-dispatch-independent-accept-oct27';Q.mkdir(parents=True,exist_ok=True)
(Q/'README.md').write_text('''# Independent acceptance: Airstrike frozen dispatch

Decision: **ACCEPT, source/tests only**, candidate `06f50dfa9a29cf94b8a7c9aa3bca7db6d8e52091`. No candidate implementation edits, integration, deployment, guest execution or boxes.

The unchanged earliest production-boundary reproducer ran first and passed. Exact production runner `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:test/run.js` has Git blob `423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e` and SHA-256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`; immutable donor file matches both. Production parser, control handler, bookkeeping, snapshot and key-action extracts are cut byte-for-byte with recorded bounds/hashes. Only renderer, scheduler and transport adversaries are synthetic. This is not a full CLI guest-runner or actual game execution claim; the actual controller executable CLI was exercised separately.

19 passing test executions comprise the unchanged mandatory boundary reproducer and 18 newly authored methods (including subcases). One original independent assertion wrongly omitted the production snapshot tickMs/recording fields; failure and actual output are retained, full expected object corrected, and only that test rerun. Ten already-passing adversarial methods were reused. All 25 unchanged candidate regression results are reused with exact pins and receipt hashes, rather than rerun.

The normal trace proves queued:true is retained; one matching step runs one batch; a matching frozen-zero snapshot and exact actual input log precede the next input. Fault mutations reject partial/late/duplicate/wrong-ID completion, stale snapshot/log from an identical prior action, terminal events at input/step/snapshot, focus and image changes. No replay, blind thaw, overlapping step, or following input appears after uncertainty. Actual controller CLI mutations reject invalid completion fields and terminal provenance. External approval identities and factual menu facts remain binding.

The full synthetic flow uses exactly 16 key actions, 16 steps and 16 captures (18 synthetic bytes each), and exits without cleanup signals. Timeout plus exit0, cleanup signals, controlquit, WM_CLOSE and missing host-exit proof cannot establish normal Quit. This verifies capture count and cleanup reservation, not PNG encoding/size, gameplay or real Enter-to-Exit behavior. A future real capture profile must be measured at <=1 MiB/image for 16 captures, within the retained 16 MiB capture allowance, with cleanup reserve; oversized captures cannot be presumed admitted.

Resources: 128 MiB task allocation (source/Git20, events16, ops52, reserve40 MiB); source tests are supervised at physical aggregate RSS128 MiB, CPU90s, wall120s, file24 MiB, operation output2 MiB and cumulative output1 MiB. Node old-space32 MiB is not a process-memory limit; inherited DATA/AS are unrestricted and physical RSS is supervised. Git alone has DATA512 MiB and physical RSS256 MiB, two pool permits and the production Git flock. Strict launcher SSH is retained. See configuration/accounting/startup/cleanup receipts and incidents.txt for limits, exact identities and known diagnostics limitations.

Remaining gate: separately authorized actual Airstrike execution with pinned guest closure, fresh admission/lifecycle, external image/focus/menu review, complete capture budget and ordinary guest Quit proof. Acceptance authorizes no main integration or public deployment in this task. Evidence is in `evidence/result.json`, grouped logs, production extraction receipts, rejected-mutation command traces and reused-regressions.json. Task publication/remote verification is retained in the owned ops directory and messageboard after commit.
''')
E=Q/'evidence';E.mkdir(exist_ok=True)
# Freeze a nonrecursive snapshot before Git publication; later publication receipts
# live in owned ops and board, avoiding self-referential commit metadata.
for path in H.rglob('*'):
 if path.is_file():
  dest=E/path.relative_to(H);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,dest)
manifest={str(path.relative_to(Q)):digest(path) for path in Q.rglob('*') if path.is_file() and path != Q/'manifest.json'}
(Q/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert gate() is None
print('ACCEPT source-only; 19 passes (18 authored methods), 25 unchanged results reused;',len(manifest),'evidence files; manifest hashes recorded; candidate implementation pins unchanged')
