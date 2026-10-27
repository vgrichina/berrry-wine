import pathlib,json,hashlib,shutil,os,time
H=pathlib.Path(__file__).parent;BASE=H.parent;R=BASE/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');M=1048576
D=R/'docs/reviews/generally-ordinary-driving-gameplay-oct27';D.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def save(p,x):pathlib.Path(p).write_text(json.dumps(x,indent=2)+'\n')
def allocated(p):
 if not p.exists():return 0
 return p.lstat().st_blocks*512+sum(q.lstat().st_blocks*512 for q in p.rglob('*')) if p.is_dir() else p.lstat().st_blocks*512
source=json.loads((H/'source-inputs.json').read_text());close=json.loads((H/'box-closeout.json').read_text());build=json.loads((H/'retained/compile-supervision.json').read_text());node=json.loads((H/'retained/startup-prebuild-v4-supervision.json').read_text())
assert build['exit']==1 and build['cleanupComplete'] and build['stopReason'] is None
assert node['exit']==0 and node['cleanupComplete'] and node['stopReason'] is None
assert not close['moduleExists'] and not close['guestAttempted'] and not any(close['processes'].values())
errors=(H/'retained/compile.stderr').read_text().splitlines()
assert errors==['changed producer host.js:host-file (sha256); review its lifetime','changed producer lib/renderer-input.js:host-file (sha256); review its lifetime']
for p,h in close['actualSHA256'].items():assert next(x for x in source['files'] if x['target']=='runner/'+p)['sha256']==h
for p in H.glob('*.py'):compile(p.read_text(),str(p),'exec')
wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
events=ROOT/'scratch/usage-watch/generally-ordinary-driving-gameplay-oct27'
session=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*01a17cf1-0834-78c1-93bc-55b54b0f465b.jsonl'))
account=dict(at=time.time(),taskAllocated=allocated(BASE),eventsAllocated=allocated(events),sessionAllocated=sum(allocated(p) for p in session),WALConservativeFullCharge=wal,WALPolicy='Full current allocated WAL charged once conservatively because launch baseline was unavailable; future positive growth counted once.',futurePublicationAndGrowth=16*M,reserve=8*M,allocation=128*M,remoteMeasuredAllocated=close['allocatedRemoteBytes'],remoteAllocation=1024*M,remoteReserve=64*M)
account['projectedLocal']=account['taskAllocated']+account['eventsAllocated']+account['sessionAllocated']+sum(wal.values())+24*M
assert account['projectedLocal']<=128*M,account
save(H/'closeout-accounting.json',account)
# Preserve operation receipts and distinct stream diagnostics. Original assets,
# source archives and read-only object-store proxies remain outside Git.
copied=[]
for p in H.rglob('*'):
 if not p.is_file() or p.is_symlink() or 'readonly-object-proxies' in p.parts or '__pycache__' in p.parts:continue
 if p.suffix in ('.gz','.tar','.tmp') or p.name=='receipt-manifest.json':continue
 rel=p.relative_to(H);dest=D/'evidence'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest);copied.append(dict(path='evidence/'+str(rel),bytes=p.stat().st_size,sha256=sha(dest)))
manifest=dict(status='BLOCKED_CANONICAL_CALLBACK_CENSUS',objective='One visually inspected player-controlled GeneRally driving action after countdown on current pinned production route',sourceRevision=source['revision'],selectedRevisionEvidence='evidence/remote-main.stdout',branch='task/generally-ordinary-driving-gameplay-oct27',remoteRef='refs/heads/task/generally-ordinary-driving-gameplay-oct27',sourceClosureManifest='evidence/source-inputs.json',fixtureReadiness=str(ROOT/'scratch/usage-watch/generally-driving-input-readiness-oct27.json'),fixtureReadinessSHA256=sha(ROOT/'scratch/usage-watch/generally-driving-input-readiness-oct27.json'),rootInitialRefReceipt=str(events/'root-ref-digest.json'),firstBlocker=dict(command='bash tools/build.sh',gate='tools/build.sh:24 node tools/callback-ownership-census.js',errors=errors,expected=close['callbackCensusExpected'],actual=close['actualSHA256'],exit=1,attempts=1,supervision='evidence/retained/compile-supervision.json'),checks=dict(registeredFixtureHashClosure=True,canonicalFilenameParser=True,stagedSourceAndRuntimeClosure=True,exactNodeConfigurationStartup=True,canonicalBuild=False,guestStarted=False,driving=False,inspectedPNGs=[],UpDispatch=False,UpRelease=False,ordinaryQuit='not attempted; guest never launched',FPS='not claimed'),resources=account,lifecycle=close,remainingGates=['Authorized lifetime review and reconciliation of the two changed callback-census producer pins','A compatible canonical compiled module','Exact module/runtime startup check before one separately authorized guest attempt','Inspect intro; acknowledge Enter; inspect menu and race; ordinary action after countdown with Up dispatch/release and before/after reviewed captures','Ordinary Quit if time permits'],incidents=['Initial exploratory output exceeded8192B; transcript retained.','Selected current-main object initially unavailable via root-only donor; resolved using immutable local donor objects and flattened read-only object proxies; nesting warnings retained.','Source manifest filename collided with operation supervision receipt; original failed preflight retained, regenerated source-inputs.json verified against archive.','Preflight initially misclassified built-in system imports and mapped DSOUND ordinal; diagnostic assertions repaired without changing production sources.','Boat CLI rejected timeout combined with detach before launch; corrected CLI arguments.','Detached compile launch succeeded, but local receipt processing raised duplicate command-key TypeError; raw launch ACK retained, no replay.','Diagnostic ps returned1 because every owned compile process had exited; raw causal stdout retained.','First board note said memory-map gate; append-only correction identifies exact callback ownership census gate.'],payloads=copied,publication=dict(requiredExactRemoteRef='refs/heads/task/generally-ordinary-driving-gameplay-oct27',finalReceipt=str(H/'receipt-manifest.json'),merge='none; report-only descendant of selected production source'))
save(D/'receipt.json',manifest)
(D/'README.md').write_text('''# GeneRally ordinary-driving qualification — blocked

The single canonical build of production revision `4a2bec145ef34b0d084b96b09a682a16e89703fd` exited 1 at `tools/build.sh:24` (`node tools/callback-ownership-census.js`). The tracked review lock rejects changed producer SHA256s for `host.js:host-file` and `lib/renderer-input.js:host-file`. No Wasm module was produced and no guest, input, or new screenshot was attempted. Prior reviewed race evidence remains untouched.

Registered game hashes, the canonical filename-bearing mount parser, all 3,866 staged source/runtime/fixture files (78,525,315 bytes), and exact Node configuration startup passed. The compile process tree cleaned up completely. The source and failed-build diagnostics remain on `bx_zw79r524` under `/tmp/generally-driving`; the coordinator owns shutdown and snapshot preservation. The box remains running, expiry 2026-10-27 11:37:45.945 UTC.

`receipt.json` binds immutable inputs, commands, distinct stdout/stderr, causal setup failures, measured resources, cleanup, and remaining acceptance gates. `evidence/task.py`, `evidence/run.py`, and `evidence/remote.py` retain the recovery recipe. Do not replay it without a fresh authorized lifecycle and resource allocation; this task has already used its single canonical-build allowance. No source fix, main update, public deployment, gameplay or FPS acceptance is claimed.

Validation: checked the exact two gate errors and exit status, source-file hashes against the immutable archive manifest, successful Node receipt, absent module/guest, terminated compile identities, Python recipe syntax, and evidence hashes. No historical screenshot was reused.
''')
save(H/'report-validation.json',dict(passAll=True,payloads=len(copied),sourceFilePins=3781,stagedClosurePins=3866,expectedBuildFailure=True,noGuest=True,syntaxChecks=True,at=time.time(),reportReceiptSHA256=sha(D/'receipt.json')))
print('validated report',len(copied),'payloads; projected allocation',account['projectedLocal'])
