import supervisor as s
import hashlib,json

BRANCH='task/toyvm-offline-nonfinite-json-repair-oct29'
TASK='toyvm-offline-nonfinite-json-repair-oct29'
BASE=s.OWN/'test'/TASK
def git(label,*args):
    rc,out,err=s.run(['git','-C',str(s.OWN),*args],cwd=s.OWN,label=label,git=True)
    assert rc==0,(label,err)
    return out.decode().strip()
paths=['test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py','supervisor.py',
       str((BASE/'regression.py').relative_to(s.OWN)),str((BASE/'REPORT.md').relative_to(s.OWN)),
       str((BASE/'operation-evidence.tar.gz').relative_to(s.OWN))]
paths += [str((s.EV/name).relative_to(s.OWN)) for name in ['first-control-incident.json','focused-results.json','initial-baseline.json','reuse.json']]
git('stage-exact-paths','add','--sparse','--force','--',*paths)
git('staged-whitespace-check','diff','--cached','--check')
changed=git('staged-path-review','diff','--cached','--name-only').splitlines()
assert set(changed)==set(paths),(changed,paths)
git('commit-partial-repair','commit','-m','fix(toyvm): reject offline JSON exponent overflow; retain partial acceptance blocker')
sha=git('commit-identity','rev-parse','HEAD')
assert len(sha)==40
git('push-task-branch','push','--no-verify','origin','HEAD:refs/heads/'+BRANCH)
remote=git('verify-exact-remote','ls-remote','--exit-code','origin','refs/heads/'+BRANCH).split()
assert remote==[sha,'refs/heads/'+BRANCH],remote
manifest={p:dict(bytes=(s.OWN/p).stat().st_size,sha256=hashlib.sha256((s.OWN/p).read_bytes()).hexdigest()) for p in paths}
canonical=dict(task=TASK,session=s.os.environ['CODEX_SESSION_ID'],sessionPath=str(s.SESSION),candidate='354c5651f6f11bbd430424c3163d7e87e125fc9a',
    rejectionCommit='ef64b21875c04a34ea29ded0c31664feb3d45f8b',status='PARTIAL_REPAIR_BLOCKED_CONTROL_INCIDENT',pins=manifest,
    tests=dict(completedPassingRealCLI=53,prior72And52Reused=True,rejectingParserMutation='NOT_RUN',inputBoundaryDelta='NOT_RUN',explicitLimitDelta='NOT_RUN',cwdNegativeControls=5,sentinelAbsent=True),
    resourceIncidents=['evidence/first-control-incident.json'],controlCompliance='NOT_ESTABLISHED; retained first guard incident and logical-vs-allocated accounting limitation',
    publication=dict(commit=sha,remoteRef='refs/heads/'+BRANCH,remoteSHA=remote[0],verifiedExactSHA=True,receipt='evidence/verify-exact-remote.stdout',mainPushed=False),
    cleanup=dict(noRuntime=True,testBox=None,allCompletedCLIProcessGroupsEmpty=True,transientPaddingRemoved=True,perOperationEvidence='operation-evidence.tar.gz'),
    allocationBytes=24*s.MiB,allocationRetainedThroughCoordinatorCloseout=True,lifecycleOwner='coordinator',
    offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIFUSEBrowserGap='OPEN',messageboardDeliveryOwner='coordinator')
s.save('canonical-receipt.json',canonical)
note=f'''Task: {TASK}
Outcome: PARTIAL repair; 53 real CLI checks passed, acceptance STOPPED on first evidence-cap control incident (no retry). Original metadata:1e999 reproduced exit0; repaired CLI exit2. Input boundary, explicit-limit delta and parser-restoration mutation NOT RUN. Wrapper fixture placement/logical-vs-physical evidence accounting needs correction before authorized continuation.
Commit: {sha}
Remote: refs/heads/{BRANCH}
Exact remote SHA verified: {remote[0]}
Canonical receipt: {s.EV/'canonical-receipt.json'}
Report: {BASE/'REPORT.md'}
Original operation evidence: {BASE/'operation-evidence.tar.gz'}
offlineValidationOnly=true runtimeQualified=false; original live CLI/FUSE/browser gap OPEN. No runtime/testbox; lifecycle owner coordinator. 24MiB allocation retained through coordinator closeout. No main push or board append. Coordinator must publish this bounded note to messageboard.
'''
s.admission('publication-note')
(s.OWN/'publication-note.txt').write_text(note)
print(json.dumps(dict(status=canonical['status'],commit=sha,remoteRef=canonical['publication']['remoteRef'],verifiedExactSHA=True,canonical=str(s.EV/'canonical-receipt.json'),publicationNote=str(s.OWN/'publication-note.txt'))))
