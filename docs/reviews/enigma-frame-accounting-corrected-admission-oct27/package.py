import pathlib,json,hashlib,shutil,difflib,ast,time
H=pathlib.Path(__file__).parent; R=H.parent/'repo'
D=pathlib.Path('/tmp/enigma-retained-review-budget-publication-oct27')
A=pathlib.Path('/tmp/enigma-review-budget-independent-accept-oct27')
P=R/'docs/reviews/enigma-frame-accounting-corrected-admission-oct27';P.mkdir(parents=True,exist_ok=True)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,q):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(q,indent=2)+'\n');t.replace(p)
pins={str(p.relative_to(R)):digest(p) for p in R.rglob('*.py')}
for p in R.rglob('*.py'):ast.parse(p.read_text(),filename=str(p))
first=json.loads((H/'first-boundary/boundary.json').read_text())
fixed=json.loads((H/'repaired-boundary/boundary.json').read_text())
assert first['outcome']['clicked'] and first['outcome']['reviewSecondsUsed']<.25
assert not fixed['outcome']['clicked'] and fixed['outcome']['reviewSecondsUsed']>=2
for n in ['full-frame-final','related-tests']:
 q=json.loads((H/(n+'.json')).read_text());assert q['exit']==0 and q['cleanupComplete'] and not q['stopReason']
for n in ['checkpoint-test_full_frame_budget.json','checkpoint-test_review_budget.json']:
 q=json.loads((H/n).read_text());assert q['successful']
controller='tools/enigma-frozen-gameplay-controller.py'
delta=''.join(difflib.unified_diff((D/'repo'/controller).read_text().splitlines(True),(R/controller).read_text().splitlines(True),fromfile='candidate/'+controller,tofile='repair/'+controller))
(P/'controller.diff').write_text(delta)
# Retain causal diagnostics once, including failed fixture assertions and setup.
for p in H.iterdir():
 if p.is_file() and p.name!='receipt-manifest.json':shutil.copy2(p,P/p.name)
for n in ['first-boundary','repaired-boundary','tests','tests-v2','tests-final']:
 if (H/n).is_dir():shutil.copytree(H/n,P/n,dirs_exist_ok=True)
manifest=dict(status='TESTED_SOURCE_CANDIDATE_REQUIRES_INDEPENDENT_ACCEPTANCE',at=time.time(),
 candidate='8ff456e70baa82386e4e51c22f7174409746d326',rejectedAcceptance='347d67177061eedf392095cd7d52e6b7e8f2e9eb',
 sourcePins=pins,baselineSourcePins=json.loads((D/'ops/receipt-manifest.json').read_text())['sourcePins'],
 canonicalRejection=dict(path=str(A/'ops/receipt-manifest.json'),sha256=digest(A/'ops/receipt-manifest.json')),
 reusedUnchangedGates=dict(path=str(D/'ops/receipt-manifest.json'),sha256=digest(D/'ops/receipt-manifest.json'),scope='Unchanged launch validation, CPU/API/capture/deadline, authority, ACK/frozenzero and listener/ownership gates; no duplicated full payload audit'),
 production='Exact Python main --launch-config; supported supervisor-owned child/listener/HTTP; controlled clocks and synthetic640x480 only; no reconstructed controller',
 firstFailure=dict(evidence='first-boundary/boundary.json',reviewSeconds=first['outcome']['reviewSecondsUsed'],clicked=True),
 repaired=dict(evidence='repaired-boundary/boundary.json',reviewSeconds=fixed['outcome']['reviewSecondsUsed'],clicked=False),
 validation=dict(fullFrame='3 methods /11 production boundaries PASS:5 slot theft,3 cumulative,3 sufficient-slot single-click',related='4 methods PASS: original28s no-input, measured34s one-click, slot theft, review evidence IO',syntax='AST parse all owned Python source PASS'),
 change='Start checkpoint clock immediately before capture; pass original start through phase/review; finally debit full elapsed once to cumulative budget, including failed capture; guard cumulative budget even without explicit plan and slot budget before input',
 incidents=['Initial policy display exceeded8192B; retained tool transcript','First latency-fixture build used wrong write_text hook; corrected before execution to actual atomic Path.replace persistence boundary','First new tests wrongly expected graceful quit after hard refusal; preserved failed assertions and production evidence; corrected to require exact refusal,zero input,owned process cleanup','Fixture metadata corrected to actual configured read delay; final full-frame group rerun'],
 resources='Fresh aggregate RAM admission each operation: measured live client remaining growth to320MiB, distinct prospective once,512MiB sharedpool,805306368B headroom;192MiB allocation including24MiB growth16MiB publication8MiB reserve8MiB margin;diskfloor2982150144B;Python128MiB one permit;Git256MiB/DATA512MiB Git child only two permits/flock;CPU90wall120file24MiBoutput2MiB/cumulative1MiB',
 rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/enigma-frame-accounting-corrected-admission-oct27/root-ref-digest.json',
 publication=dict(branch='refs/heads/task/enigma-frame-accounting-corrected-admission-oct27',reportOrphan=True,neverMergeWholeTree=True,pending=True),
 cleanup=dict(allSupervisedOperationsCleanupComplete=True,boardWatcher='tool session36783 pending closeout',boxes=[],boxState='No assigned box or lifecycle operations; coordinator owns shutdown',rootDonorsReadOnly=True,workersSpawned=0,NodeGuestBoatAPIBuildDeployOperations=0),
 remaining='Independent acceptance of changed controller and full-frame capture/read/persistence boundary before integration or runtime; no main ownership granted')
manifest['evidencePins']={str(p.relative_to(P)):digest(p) for p in P.rglob('*') if p.is_file() and p.name!='manifest.json'}
dump(P/'manifest.json',manifest);dump(H/'receipt-manifest.json',manifest)
dump(H/'acceptance-checkpoint.json',dict(status=manifest['status'],sourcePins=pins,completed=manifest['validation'],remaining=manifest['remaining'],evidenceManifest=str(P/'manifest.json'),sha256=digest(P/'manifest.json')))
print('PASS original failure, repair, final3/11 production controls +4 related tests; source syntax; report packaged with causal diagnostics')
