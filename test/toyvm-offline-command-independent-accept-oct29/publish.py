"""Publish independent rejection evidence only, never candidate integration."""
from supervisor import *
P=OWN/'test'/TASK
admission('publication-preflight')
pins=json.loads((EV/'source-pins.json').read_text())
for path,pin in pins['pins'].items():
    assert hashlib.sha256((OWN/path).read_bytes()).hexdigest()==pin['sha256']
records=json.loads((EV/'acceptance-checkpoint.json').read_text())['records']
assert len(records)==73 and all(r['PASS'] for r in records[:-1]) and not records[-1]['PASS']
assert hashlib.sha256((EV/'unchanged-reproducer.json').read_bytes()).hexdigest()=='0a1537b8c35ac1379d7e4b028b47a1ba0656e692163ccf7b909d1ed08fffa11e'
ops=[json.loads(x) for x in (EV/'operations.jsonl').read_text().splitlines()]
assert all(not r['cleanupRemaining'] and r['reason'] is None for r in ops)
save('prepublication-review.json',dict(sourcePinsUnchanged=True,passed=72,firstDefect=records[-1],mutationRejected=json.loads((EV/'mutation-verdict.json').read_text())['PASS'],allRecordedGroupsEmpty=True,noRuntime=True,evidenceBytes=footprint(EV),offlineValidationOnly=True,runtimeQualified=False))
assert footprint(EV)<M
for key,value in [('user.name','Wine Ops Worker'),('user.email','wine-ops@localhost'),('gc.auto','0'),('core.hooksPath','/dev/null')]:
    git(['config',key,value],cwd=OWN,label='config-'+key,mutate=True)
git(['remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],cwd=OWN,label='remote-add',mutate=True)
# Do not recursively stage the shared or inherited tree. Explicit sparse-owned path only.
git(['add','--sparse','--','test/'+TASK],cwd=OWN,label='stage-owned-report',mutate=True)
git(['diff','--cached','--check','--','test/'+TASK+'/*.py','test/'+TASK+'/REPORT.md'],cwd=OWN,label='review-whitespace')
git(['diff','--cached','--stat'],cwd=OWN,label='review-stat')
# Store publication logs outside the staged payload; no circular/self-updating commit.
git(['commit','-m','test(toyvm): reject offline nonfinite JSON acceptance'],cwd=OWN,label='commit-rejection-report',mutate=True)
commit=git(['rev-parse','HEAD'],cwd=OWN,label='local-publication-sha').decode().strip()
ref='refs/heads/task/'+TASK
git(['push','origin','HEAD:'+ref],cwd=OWN,label='push-task-report',mutate=True)
remote=git(['ls-remote','--exit-code','origin',ref],cwd=OWN,label='verify-exact-remote').decode().split()
assert remote==[commit,ref]
save('publication.json',dict(commit=commit,remoteRef=ref,remoteSHA=remote[0],verifiedExactSHA=True,mainPush=False,offlineValidationOnly=True,runtimeQualified=False))
save('canonical-receipt.json',dict(task=TASK,session=os.environ.get('CODEX_THREAD_ID'),candidate=pins['base'],sourcePins=pins['pins'],tests=dict(newPassed=72,firstDefect=records[-1]['name'],prior52Reused=True,mutationRejected=True),result='REJECTED: JSON exponent overflow in metadata accepted',sourceUnchanged=True,publication=dict(commit=commit,remoteRef=ref,remoteSHA=remote[0],verifiedExactSHA=True),cleanup=dict(allRecordedProcessGroupsEmpty=True,noRuntime=True),testBox=None,lifecycleOwner='coordinator',allocationBytes=24*M,allocationRetainedThroughCoordinatorCloseout=True,incidents=['Control limitations documented in REPORT.md; no resource admission failure'],offlineValidationOnly=True,runtimeQualified=False,originalLiveCLIGap='OPEN'))
admission('publication-closeout')
note=f'''Task: {TASK}
Session: {os.environ.get('CODEX_THREAD_ID')}
Outcome: REJECTED candidate {pins['base']}; nonfinite metadata 1e999 accepted offline.
Tests: 72 new passed, stopped at case73 first defect; unchanged False cleanup rejected; legitimate control accepted; rejecting mutation caught; prior52 reused by pins.
Commit: {commit}
Remote branch: {ref}
Exact remote SHA verified: {remote[0]}
Receipt: {EV/'canonical-receipt.json'}
Reproducer: {EV/'unchanged-reproducer.json'}
Report: {P/'REPORT.md'}
Candidate unchanged; publish independent rejection evidence only. No main push/board append.
offlineValidationOnly=true/runtimeQualified=false; original live CLI/FUSE/browser gap OPEN.
No test box assigned. Coordinator owns lifecycle and allocation release. 24MiB retained through coordinator closeout.
Control limitations in report: early admission omitted itemized session/WAL, group-only monitor, empty mount argv not canonical-parser validated before staging, initial oversized read-only output.
'''
(OWN/'publication-note.txt').write_text(note)
print(json.dumps(dict(result='REJECTED',commit=commit,remoteVerified=True,receipt=str(EV/'canonical-receipt.json'),offlineValidationOnly=True,runtimeQualified=False)))
