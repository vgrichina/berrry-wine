from pathlib import Path
import hashlib,json,shutil,time
P=Path('/tmp/gta2-untyped-api-return-observer-repair-oct27');O=P/'ops';R=P/'repo'
name=P.name;D=R/'reports'/name;D.mkdir(parents=True,exist_ok=False)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
evidence=D/'evidence';evidence.mkdir()
groups=['git-init','pinned-tree','airstrike-pin','checkout','sparse-update','node-startup','base-repro','repaired-boundary','repaired-remaining','affected-legacy','review-diff','syntax-runner','pinned-final-inputs']
for label in groups:
 for suffix in ('.json','.stdout','.stderr'):
  shutil.copyfile(O/(label+suffix),evidence/(label+suffix))
for filename in ['admission.json','checkpoint.json','checkpoint-accepted.json','run.py','child.py','startup.js','package.py','fixture-base-repro.js','fixture-repaired-boundary.js','fixture-repaired-remaining.js','fixture-affected-legacy.js']:
 shutil.copyfile(O/filename,evidence/filename)
rootReceipt=Path('/home/user/wine-assembly/scratch/usage-watch/gta2-untyped-api-return-observer-repair-oct27/root-ref-digest.json')
shutil.copyfile(rootReceipt,evidence/rootReceipt.name)
readme='''# GTA2 untyped API exit observer repair

Source-only production callback repair, based exactly on
`1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`. This does not fix DirectDraw or
establish gameplay. The retained GTA2 guest's raw HRESULT remains unknown.

The unchanged byte-exact runner (`6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e`)
read EAX but emitted no return for the untyped GetAttachedSurface entry.
`evidence/base-repro.{stdout,stderr,json}` preserves the expected assertion
failure through the actual host callback installation, including the COM
api_id marker and `[API #672]` header. The fixture uses the actual API table,
actual typed formatters and byte-exact production state/callback spans. Only
guest memory/register exports and unrelated flags are stubbed. No runner
main, compiler, browser, wasm, game, or runtime process is invoked.

`test/run.js` now falls back to unsigned hex EAX at `log_api_exit`, names the
API, and keeps integer diagnostics as `[i32]` instead of treating an arbitrary
integer as the return. It retains selected-call correlation until exit and
resets metadata on new/filtered entries. Typed returns/outparams use the
existing formatter once. Default/quiet/paused/ESP-only logging behavior and
existing multiword diagnostic handling are covered with actual callbacks.
No API signature, stack cleanup, guest state, WAT, scheduling, game data or
compiled module changed. Worker logging is unchanged; this repair is for the
main CLI host used by the retained GTA2 trace.

Acceptance: 11 focused groups passed across retained same-source receipts.
`repaired-boundary` passed the original production reproducer and the full
known/unknown raw-EAX matrix: 0, positive, unsigned/signed 0x887600ff, and
0xffffffff/-1, with and without interleaved log_i32. It then failed a test
oracle that expected decimal rather than existing LPDWORD hex formatting.
The fixture oracle was corrected; `repaired-remaining --from-group=2`
passed groups2..10 without repeating that matrix. `affected-legacy
--from-group=11` passed the additional marker/ESP/quiet/paused regression.
Production source was identical for all three groups:
`0ae0c1abf3f626e38a3d66bf9f7f586e1aeb7b532c752152e348bcea8538d1dd`.
`syntax-runner` passed Node syntax validation. Fixture versions are retained.
The very first shell calls used unavailable `python` (exit127, no execution);
all actual supervised operations used installed `python3`. A docs patch anchor
failed atomically and was corrected before any following execution.

Six rejected mutation controls cover omitted fallback, substituted non-EAX
register, integer clearing correlation, omitted unknown entry, duplicate
typed return, and wrong API name. Additional assertions cover no stale exit,
no extra disabled guest reads/hooks, no guest memory/register writes,
entry-snapshotted outparams after stack churn, filtered calls with ESP audit,
and existing sequence/name correlation without inventing a new sequence.
The production callback test never models arbitrary log_i32 as final EAX.

Run the portable fixture: `node --max-old-space-size=512
test/test-api-exit-observer.js`. To reproduce the original defect, set
`API_EXIT_RUNNER` to the pinned unchanged runner and use `--repro-only`.
Source extraction span offsets, byte counts and hashes appear in each test
stdout. Each operation has separate stdout/stderr and supervisor exit,
stopReason, ownership and cleanup evidence. No supervisor guard was exhausted.
Node startup uses the same executable/512MiB old-space configuration as the
tests; DATA and AS are unlimited for Node, CPU90/file24MiB are inherited,
physical RSS768MiB is independently supervised. Git alone gets DATA512MiB,
physical256MiB, the two-permit pool and production Git flock.

The coordinator-verified predecessor causal manifest
`d3f43e0614ab253dd05134a342c67114ef3e1854508429b7cf0f71a534978453`
binds9276 payloads. Its exact published branch commit is
`a588a9d114dfe01d54c047d9a9bedd3465d5a421` on
`task/gta2-streamed-estimate-directdraw-trace-oct27`; no full payload re-audit
or copying of its game/module evidence was performed. API#672,
Dmavideo base0x00951000, caller0x00953275, caps
040000000100010030e1950000008f08, this0x08221038, out0x0087addc identify the
retained causal call. Vid_SetMode EAX1 is not its raw HRESULT, and
0x887600ff remains source inference for the old real run. Here it is a
synthetic adversarial fixture input only.

One canonical `receipt-manifest.json` binds this tested source, fixture
versions, commands, diagnostics, resource admission, rejected controls,
artifact preservation and cleanup. Post-commit remote-ref verification is
retained separately as `/tmp/gta2-untyped-api-return-observer-repair-oct27/ops/publication-closeout.json`
and binds that manifest hash and exact task commit without a circular hash.
This source evidence supports independent acceptance. Current main must be
reconciled later by an independently assigned integration owner. A fresh
coordinator assignment/admission and accepted production source are required
before any diagnostic game run. No guest, compiler, downloads, Boat actions,
public deploy, main/root tracked change, worker/Claude/HeroesII work occurred.
Existing wasm artifacts are preserved. No box is assigned here;
bx_cqss3x42 was already coordinator snapshot-stopped and remains untouched.
'''
(D/'README.md').write_text(readme)
payloads=[]
for p in sorted([R/'test/run.js',R/'test/test-api-exit-observer.js',R/'lib/api-format.js',R/'src/api_table.json',R/'docs/tracing.md',*D.rglob('*')]):
 if p.is_file():payloads.append(dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=digest(p)))
manifest=dict(schema=1,task=name,base='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',branch='task/'+name,
 testedRunnerSHA256=digest(R/'test/run.js'),fixtureSHA256=digest(R/'test/test-api-exit-observer.js'),
 sourceOnly=True,guestInvocations=0,compilerInvocations=0,boatActions=0,
 sourceAcceptance='11 groups passed; independent acceptance still required',
 rejectedControls=6,results={label:json.loads((O/(label+'.json')).read_text())['exit'] for label in groups},
 expectedFailures={'base-repro':'missing untyped return; expected exit1','repaired-boundary':'first source groups passed, fixture decimal expectation corrected for hex output'},
 cleanup={label:json.loads((O/(label+'.json')).read_text())['cleanupComplete'] for label in groups},
 predecessor=dict(manifestSHA256='d3f43e0614ab253dd05134a342c67114ef3e1854508429b7cf0f71a534978453',payloads=9276,verification='coordinator reuse; no repeat full audit',commit='a588a9d114dfe01d54c047d9a9bedd3465d5a421'),
 remainingGate='Independent acceptance, later current-main integration and fresh coordinator diagnostic runtime assignment/admission; real raw HRESULT remains unknown',
 publication='External publication-closeout.json binds final task commit/remote ref to this manifest; manifest excludes itself and future publication operations',
 payloads=payloads)
(D/'receipt-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copyfile(D/'receipt-manifest.json',O/'receipt-manifest.json')
print(json.dumps(dict(payloads=len(payloads),manifestSHA256=digest(D/'receipt-manifest.json'),report=str(D))))
