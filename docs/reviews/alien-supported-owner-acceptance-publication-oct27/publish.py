import sys
sys.dont_write_bytecode=True
import json,shutil,time
from pathlib import Path
import manage as a
P=Path('/tmp/alien-supervisor-owned-independent-accept-oct27')
D=a.R/'docs/reviews/alien-supported-owner-acceptance-publication-oct27'
def verify(base,manifest):
 for n,v in manifest.items():
  p=base/n;assert p.stat().st_size==v['bytes'] and a.sha(p)==v['sha256'],str(p)
 return len(manifest)
a.gate('package')
oldmanifest=json.loads((P/'ops/evidence-manifest.json').read_text())
count=verify(P/'ops',oldmanifest['files'])
staged=P/'repo/docs/reviews/alien-supervisor-owned-independent-accept-oct27'
stagedcount=verify(staged,json.loads((staged/'manifest.json').read_text()))
assert a.pins()==json.loads((P/'ops/configuration.json').read_text())['sourcePins']
assert a.sha(P/'ops/inherited-alternate-listener.py')=='cf4c223631685da41e540a25cf142382c7a02b98e5683b4a0e2418aaf977a490'
execution=json.loads((a.O/'boundary-execution.json').read_text());assert execution['exit']==0 and execution['stopReason'] is None and execution['cleanupComplete']
assert json.loads((a.O/'boundary-result.json').read_text())['verdict']=='PASS'
a.save('reuse-verification.json',dict(opsPayloads=count,stagedPayloads=stagedcount,opsManifestSHA=a.sha(P/'ops/evidence-manifest.json'),stagedManifestSHA=a.sha(staged/'manifest.json'),groupsReused=['live','uncertain','new-and-death','timeout'],focused=13,transport=8,unaffected=24,originalHistoricalScriptSHA=a.sha(P/'ops/inherited-alternate-listener.py'),historicalUnchangedSetupFailurePreserved=True))
D.mkdir(parents=True)
shutil.copytree(staged,D/'retained')
for name in ('configuration.json','initial-admission.json','admission-boundary.json','boundary-pins.json','boundary-execution.json','boundary-output.log','boundary-before.json','boundary-after.json','legacy-attack.json','new-attack.json','boundary-result.json','reuse-verification.json','setup-incidents.json','manage.py','accept.py','publish.py'):
 shutil.copyfile(a.O/name,D/name)
shutil.copytree(a.O/'boundary',D/'boundary')
result=dict(status='PASS_OFFLINE_SUPPORTED_ORIGINAL_LIVE_ACCEPTANCE',candidate=a.CANDIDATE,sourceTree=a.TREE,sourcePins=a.pins(),boundary='boundary-result.json',execution=execution,reused='reuse-verification.json',historicalScriptUnchangedPass=False,setupDelta='Replace obsolete attach-based original with exact production new supervisor CLI/Popen and real pinned Python child. Both sockets use identical Handler/state; idle descendant inherits only alternate. Pause original pending input, retain competing legacy changed PID/endpoint/output/timing and NEW occupied-original refusal assertions. No production source modification.',scope='Cooperative local supervisor protocol only; real Node/gameplay unqualified',remaining=['Enigma owner coordinates separate main integration and affected merged-tree checks','Fresh admitted exact Node startup, production closure and mount/limits checks','Alien title/menu/New Game/gameplay/captures/normal Quit acceptance'],boxes=dict(assigned=[],actions=[],lifecycleOwner='coordinator'),publication=dict(branch=a.BR,main=False,sourceChanged=False))
a.save('result.json',result);shutil.copyfile(a.O/'result.json',D/'result.json')
(D/'REPORT.md').write_text('''# Alien supported original-owner acceptance

PASS for candidate d8694f71a82df09be05ea3e9222ff1c535da47a3,
source tree 4b0279edfc0266ab0bb0a6a40c619d1d896405b2. Production controller
and supervisor remain pinned in configuration.json; no production source changed.

The one remaining discriminating test uses the actual NEW production supervisor
CLI/Popen to launch the pinned small Python HTTP child. The original stays LIVE
paused at pending input. Both listening sockets use the same Handler and state;
an idle descendant inherits only the alternate socket. A legacy competing CLI
with changed PID, endpoint, output and timing sends HTTP0, creates no authority
claim or renewal, and leaves original finite budget/config/journal unchanged.
A NEW CLI refuses the original occupied endpoint before creating an invocation.
All owned child processes clean up; raw argv, state and wire receipts are retained.

The historical script cf4c223631685da41e540a25cf142382c7a02b98e5683b4a0e2418aaf977a490
and original prerequisite failure remain unchanged under retained/. That exact
historical script did not pass. The explicitly authorized setup correction replaces
its retired original attach operation with the supported production launch;
attack assertions are retained. No Enigma code or production changes were applied.

Reuse-verification binds all 258 prior ops payloads and 146 staged payloads.
The retained live/uncertain/new-and-death/timeout groups and all five owned child
lifetimes are reused, plus 13 focused, 8 transport and 24 unaffected checks;
none was rerun. The prior 28,672-byte publication admission failure remains in
retained/result.json. Released peer reservations are the authorized material
change; fresh complete admission precedes this execution and publication.

Limits: Python fixture pool1, physical128MiB, CPU90s, wall120s, file24MiB,
output2MiB; ordinary excerpts8192, cumulative tool text1MiB. Git pool2 plus flock,
physical256MiB and DATA512MiB applied only to Git. Disk32MiB including reserve8MiB.
Resource measurements and exact source/harness pins accompany the evidence.

Recovery: materialize the nine pinned paths from the candidate into an isolated
sparse repo with read-only donor alternates. Set manage.R/O to those isolated
paths; run accept.py once through the retained pool and pinned physical supervisor
using fresh admission and unchanged caps. Historical recipes remain under retained/.
Manifest hashes cover every published payload. This task branch contains evidence
only and does not integrate main. No Node/build/browser/guest/Boat/public deployment
occurred. Actual Node/menu/New Game/gameplay/normal Quit remain a genuine next gate.
The claim concerns cooperative supervisor orchestration, not arbitrary same-UID
security. No test boxes were assigned or changed; coordinator retains lifecycle.
''')
manifest={str(p.relative_to(D)):dict(bytes=p.stat().st_size,sha256=a.sha(p)) for p in sorted(D.rglob('*')) if p.is_file()}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
a.save('package.json',dict(files=len(manifest),bytes=sum(x['bytes'] for x in manifest.values()),manifestSHA=a.sha(D/'manifest.json')))
print(json.dumps(dict(status=result['status'],payloads=len(manifest),bytes=sum(x['bytes'] for x in manifest.values()))))
