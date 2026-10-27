import sys,json,shutil,time
from pathlib import Path
import manage as m
m.gate('package-final')
groups={g:json.loads((m.O/(g+'-execution.json')).read_text()) for g in ('live','uncertain','new-and-death','timeout')}
assert all(g['exit']==0 and g['stopReason'] is None and g['cleanupComplete'] for g in groups.values())
assert m.pins()==json.loads((m.O/'snapshot.json').read_text())['pins']
old=json.loads(Path('/tmp/alien-original-owner-retained-final-publication-oct27/ops/result.json').read_text())
assert all(old['pins'][p]==m.pins()[p] for p in ('test/alien-gameplay-sequence.py','test/helpers/alien-control-sequence.py'))
cleanup={str(p.relative_to(m.O)):json.loads(p.read_text()) for g in groups for p in (m.O/('new-'+g)).rglob('cleanup.json')}
assert len(cleanup)==5 and all(not p['remainingOwnedLive'] for p in cleanup.values())
captures=sum(p.stat().st_size for p in m.O.rglob('*') if p.is_file() and (p.suffix in ('.log','.png') or p.name.endswith('cli.json')))
assert captures<1048576
m.save('source-review.json',dict(pins=m.pins(),producer='tools/alien-supervised-gameplay.py:launch',findings=['Popen is called inside launch, close_fds=True; original pidfd/startticks captured there, not from caller JSON','endpoint and initial budget captured before launch and closed over by guard; command.json records actual original child argv and pid','deadline uses monotonic and wall clocks; reserves and maxima validated once; Budget compares disk config with original budget and sealed hash on sends','delegated boolean consumed inside original launch before _run_owned; private continuation cannot be requested through retired CLI','guard checks original Popen poll, terminal latch and original deadline at actual send boundary; no replacement/reconnect API','cleanup uses pidfd and per-PID startticks and preserves unrelated test sentinel'],scope='Cooperative local orchestration only, no arbitrary same-UID files/memory isolation claim',notExecuted=['Node','actual game guest','browser','build','Boat','deployment']))
m.save('incidents.json',dict(new=[dict(group='unchanged-first',kind='historical oracle incompatibility',substantiveCandidateFailure=False,expected='historical existing-guest CLI creates live owner at pending input ACK',observed='retired CLI produces no input; unchanged test asserts original must be live and exits1',raw='unchanged-first-output.log',rawRequests='fixture/test_approved_menu_action_then_reserved_evidence_and_quit/http.json',originalCLIStdout='historical reproducer does not retain completed original CLI stdout when this prerequisite fails; source pin and supplemental real competitor receipts retained',handling='Preserved unchanged test and failure. Supplemental actual new supervisor live challenge, no repair or baseline rerun; full exact-reproducer acceptance remains a qualification')],inherited=str(m.PRIOR/'incidents.json'),noResourceDenial=True,noCandidateRepair=True))
remaining=['Coordinator must resolve/accept historical unchanged-reproducer original-leg incompatibility; do not claim that exact oracle passed','Separate main integration assignment under main ownership, merged-tree affected checks','Separately admitted actual Node startup/closure/mount/limits and Alien title/menu/New Game/gameplay/capture/Quit verification']
result=dict(status='QUALIFIED_PASS_OFFLINE_PRODUCTION_LIFETIME',at=time.time(),candidate=m.CANDIDATE,tree=m.TREE,pins=m.pins(),firstBoundary='first-boundary.json',exactUnchangedReproducerPassed=False,actualNewSupervisorLiveAlternateBoundaryPassed=True,groups=groups,newIndependentGroups=4,ownedChildLifetimes=len(cleanup),cleanup=cleanup,unrelatedSentinelsPreserved=True,reused=dict(productionFocusedMethods=13,transportChecks=8,unaffectedChecks=24,sourceIdentity='reuse.json',olderAffected29='superseded attach contract, not evidence for new supervisor'),contract='source-review.json',incidents='incidents.json',noSubstantiveCandidateFailureObserved=True,scope='Simulated Python protocol through exact actual production CLI/Popen/supervision/controller; cooperative local scope only. No actual gameplay or main readiness claim.',resource=dict(groupRSSCap=134217728,peakRSS=max(g['peakRSS'] for g in groups.values()),CPU=90,wall=120,file=25165824,output=2097152,internalCapturedBytes=captures,internalCaptureCeiling=1048576,ordinaryExcerpts=8192,diskAllocation=33554432),publication=dict(branch=m.BR,main=False,sourceChanges=False,finalReceipt='ops/publication.json after evidence-only commit/push'),boxes=dict(assigned=[],actions=[],coordinatorOwnsLifecycle=True),remaining=remaining,restrictions='No workers/refill/Node/native/browser/build/Boat/public deployment/source repair/main/root index or refs/donor mutation. Claude idle; HeroesII laptop-owned; blocked lanes preserved.')
m.save('result.json',result)
m.save('checkpoint.json',dict(candidate=m.CANDIDATE,tree=m.TREE,pins=m.pins(),completed=list(groups),newGroupResults=groups,firstBoundary='first-boundary.json',reuse='reuse.json',remaining=remaining+['evidence-only task-branch commit/push/exact remote verification']))
D=m.R/'docs/reviews/alien-supervisor-owned-independent-accept-oct27';D.mkdir(parents=True,exist_ok=False)
selected=['result.json','first-boundary.json','snapshot.json','tested-snapshot.json','configuration.json','reuse.json','source-review.json','incidents.json','timeout-fixture-delta.json','live-observation.json','manage.py','independent.py','inherited-alternate-listener.py','package.py']
for g in groups:selected += [g+'-result.json',g+'-execution.json',g+'-pins.json','admission-'+g+'.json']
selected+=['unchanged-first-execution.json','unchanged-first-pins.json','admission-unchanged-first.json','admission-package-final.json']
for n in selected:shutil.copyfile(m.O/n,D/n)
for g in ['unchanged-first',*groups]:(D/(g+'-output.json')).write_text(json.dumps(dict(raw=(m.O/(g+'-output.log')).read_text()),indent=2)+'\n')
for dirname in ['fixture','new-live','new-uncertain','new-new-and-death','new-timeout','timeout-child']:
 shutil.copytree(m.O/dirname,D/dirname)
(D/'README.md').write_text('''# Independent Alien supervisor acceptance, 2026-10-27

Qualified offline production-lifetime pass for exact candidate
`d8694f71a82df09be05ea3e9222ff1c535da47a3`, tree
`4b0279edfc0266ab0bb0a6a40c619d1d896405b2`. No production source changed.

The unchanged historical inherited-alternate-listener reproducer ran FIRST and
failed its original-live prerequisite: the retired existing-guest CLI cannot
create its historical original owner. Its exact script, output and requests are
retained. This exact oracle did NOT pass, and its original CLI stdout is missing
because the historical script does not save it on prerequisite failure. No old
12-command unauthorized baseline was rerun. This limitation needs an explicit
coordinator acceptance decision before integration.

The supplemental independent test launches the EXACT new production supervisor
CLI and a real small Python child HTTP server. It observes the original pending
input while same-endpoint and shared-handler alternate-listener competitors run;
only the alternate FD is inherited by an unrelated sleeping descendant. Both
competitors issue ZERO HTTP, create no claim and leave the original sealed state,
budget, pending ledger and terminal unchanged. A second supervisor cannot attach.
The original completes simulated before/menu/New Game/after-captures/Quit with
the same aggregate eight capture credits. Reopening its terminal home fails.

Three further discriminating groups check uncertain ACK terminal poison, a real
20-second HTTP timeout with no replay/reconnect, independent legitimate new child
lifetimes, and child death before review. Five child lifetimes cleaned completely;
all unrelated sentinels survived. Exact immutable 13 focused implementation tests
and 8 transport/24 unaffected checks are REUSED, not rerun. Source review and
the implementation receipts cover immutable budget edits and send-boundary death,
terminal and elapsed-time guards. These are cooperative local orchestration
claims, not protection against arbitrary same-UID memory/file modification.

The timeout fixture alone adds a 22-second input-ACK hold to the pinned child
protocol server. Production CLI/controller/transport bytes stay unchanged.
Detailed raw wire/state/argv and resource receipts are included. `reuse.json`
binds the verified 1990-payload donor manifest and nine exact source pins.
Raw ordinary output is encoded as JSON without altering its text.

Recovery: materialize the nine paths in `snapshot.json` from the candidate and
use the retained Python drivers with `manage.R/O` pointing at isolated source
and output paths. Preserve the recorded pool, RSS/CPU/wall/file/output/disk caps
and fresh admission; run each new group once. The full driver and exact unchanged
reproducer are included. Full local receipts remain under the task ops path.

No Node, game guest, native/browser/build/Boat/deploy operation occurred. Actual
gameplay and separate main integration with affected merged-tree checks remain
open. Task-branch evidence publication does not publish main or qualify gameplay.
''')
manifest={str(p.relative_to(D)):dict(bytes=p.stat().st_size,sha256=m.sha(p)) for p in sorted(D.rglob('*')) if p.is_file()}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
m.save('package.json',dict(path=str(D),files=len(manifest),bytes=sum(v['bytes'] for v in manifest.values()),manifestSHA=m.sha(D/'manifest.json')))
print(json.dumps(dict(status=result['status'],newGroups=4,reusedMethods=45,childLifetimes=5,peak=result['resource']['peakRSS'],internalCaptured=captures,packageFiles=len(manifest),packageBytes=sum(v['bytes'] for v in manifest.values()))))
