import run as c,hashlib,json,pathlib,shutil,os,time
D=pathlib.Path('/tmp/airstrike-caption-independent-accept-publication-oct27')
prior=json.loads((D/'ops/receipt-manifest.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,expected in prior['sourcePins'].items():assert sha(D/'repo'/name)==expected
for name in ('reproduce.py','production-renderer-input.js','production-run.js','independent-controls.py'):
 assert sha(c.H/name)==prior['operationsSHA256'][name]
groups=['final-geometry','final-startup','final-controls']
results={n:json.loads((c.H/(n+'.json')).read_text()) for n in groups}
assert all(q['exit']==0 and q['stopReason'] is None and q['cleanupComplete'] for q in results.values())
pins={n:sha(c.R/n) for n in ('tools/airstrike-menu-controller.py','tools/airstrike-observation-bridge.py','test/test-airstrike-caption-interior.py','test/test-airstrike-console-obscuration.py')}
report=dict(status='TESTED_REPAIR_CANDIDATE_REQUIRES_INDEPENDENT_ACCEPTANCE',task='airstrike-caption-interior-geometry-repair-oct27',base='e2525d558e8bd4891e3c14d3b6b2f3c2f5efd0a4',sourcePins=pins,
 behavior='Reject degenerate/short, clipped caption-point, offscreen, malformed and changed geometry before activation. Keep the retained valid caption focus route; main client/bottom/right may extend past canvas while the selected caption interior remains on screen. No Console close/minimize.',
 tests=dict(originalFirst='original-rejection.json: unchanged reproduce.py FIRST actual CLI then Bridge.run reproduces unsafe click656:33 at main height8; no guest execution',geometry='4 test methods: unchanged attack now no commands/inputs;17 negative variants through actual CLI and Bridge.run;3 changed/stale Bridge.run cases;2 valid CLI+Bridge.run cases',focused='10 existing startup tests PASS including complete fake normal-Quit path, wrong/stale review, ACK/log/frozen-zero/terminal rejection',controls='8 additional changed-pixels/geometry/focus/hidden/extra-window/ACK/log/terminal controls PASS; offline fixtures only',results=results),
 incidentLedger=['Initial oversized read displays are in immutable launcher session/events; subsequent reads bounded.','Initial overinclusive donor alternate graph emitted nesting-too-deep warnings on successful checkout; original stderr retained, own alternates narrowed to canonical donor/root without donor edits.','Initial geometry group failed2positive subtests because full-window screen containment rejected the retained valid window; causal failure and intermediate diff description retained. Caption-point containment correction passed targeted positive and affected negative groups.','Original unchanged exploit oracle deliberately asserts vulnerability; after repair its final assertion exits1 only after its report records PASS and zero inputs. This expected oracle exit is tested, not hidden.','Controller pin updated repeatedly during implementation; no stale-pin behavioral attempt was executed.'],
 publication=dict(remoteRef='refs/heads/task/airstrike-caption-interior-geometry-repair-oct27',mainTouched=False,accepted=False,warning='Sparse report tree: NEVER merge whole tree; later integration needs explicit ownership and exact path closure.'),
 environment=dict(SSH=c.SSH,mountArgv=[],mountValidation='No mounts/guest/Node/API allowed; parser not applicable to empty mount argv',supervisor=str(c.S),supervisorSHA256=sha(c.S),gitPhysicalBytes=256*c.M,gitDataBytes=512*c.M,pythonPhysicalBytes=128*c.M,gitDataScope='prlimit exec Git child only; parent/supervisor unchanged',pool='Git2permits plus flock /tmp/wine-ops-production-git.lock; Python1permit',cpuSeconds=90,wallSeconds=120,fileBytes=24*c.M,operationOutputBytes=2*c.M,cumulativeOutputBytes=c.M,displayBytes=8192),
 resources=json.loads((c.H/'accounting.json').read_text()),rootRefInitialReceipt=str(c.ROOT/'scratch/usage-watch/airstrike-caption-interior-geometry-repair-oct27/root-ref-digest.json'),
 lifecycle=dict(assignedBox=None,boxOperations=False,owner='coordinator; no lifecycle change'),remaining='Independent acceptance of exact candidate before integration/runtime; no main ownership, deployment, Node, guest, Boat/API, workers or other task.',at=time.time())
c.dump('acceptance-checkpoint.json',report)
out=c.R/'docs/reviews/airstrike-caption-interior-geometry-repair-oct27';out.mkdir(parents=True,exist_ok=True)
# Immutable diagnostic snapshot. Symlinked source remains referenced, never
# traversed or copied recursively. Exclude the currently running report streams.
files={}
for p in list(c.H.rglob('*')):
 if not p.is_file() or p.is_symlink() or p.name.startswith('report-build.'):continue
 rel=p.relative_to(c.H);dest=out/'evidence'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(p,dest);files[str(rel)]=sha(dest)
report['evidenceSHA256']=files
(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'README.md').write_text('Airstrike caption interior repair candidate\n\nWhen main height is8, click656:33 lies outside y20..28. The exact original CLI/Bridge.run reproducer is retained unchanged. The repaired admission requires an integer nondegenerate main with a complete caption band and a chosen point strictly inside its safe caption and canvas, clear of Console and caption controls. The bridge validates at review and immediately before click, retaining exact fresh-snapshot equality.\n\nOriginal normal main is806x608 at20,20 on800x600: its bottom/right client overhang is allowed because click656:33 is a visible interior caption point. The new negative cases reject clipped/offscreen caption points. Existing authority, capture/time, frozen-zero ACK/log and terminal gates remain. All tests are offline protocol fixtures, not gameplay evidence.\n\n4 geometry test methods (17 negative variants,3 changed/stale variants,2valid variants, unchanged exploit oracle),10existing focused startup tests and8additional controls passed. Initial false-positive implementation and alternate warnings remain in evidence. Independent acceptance is required next. Sparse report branch must never be merged wholesale to main.\n')
c.dump('report-location.json',dict(path=str(out/'manifest.json'),sha256=sha(out/'manifest.json'),files=len(files)))
print('Canonical tested checkpoint and immutable report snapshot retained; independent acceptance required next.')
