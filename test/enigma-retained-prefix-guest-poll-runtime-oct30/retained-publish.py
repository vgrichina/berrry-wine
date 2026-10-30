import retained_gate as g
import pathlib,json,hashlib,shutil,os,datetime
# Publication is a separately bounded Git operation, not a runtime supervisor restart.
g.setup();o=g.ops;r=o.ROOT;out=g.OUT;e=o.E
scope='test/enigma-retained-prefix-guest-poll-runtime-oct30';base='fab6e44b54221ea5eaf99d38a53c11e4ea192815'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def run(n,args):
 rc,s=o.run(n,['git','-C',str(o.REPO)]+args,cwd=o.REPO,git=True);assert rc==0,(n,rc);return s
assert run('publication-head',['rev-parse','HEAD']).strip()==base
assert run('publication-branch',['branch','--show-current']).strip()==scope
close=json.loads((e/'closeout.json').read_text());assert close['verifiedStopped']
resume=json.loads((e/'0002-resume.stdout').read_text());assert resume['status']==403 and resume['code']=='api_key_action_forbidden'
pre=json.loads((e/'preflight.json').read_text())
receipt=dict(status='BLOCKED: supported sandbox.resume API denied403 api_key_action_forbidden',objectiveAchieved=False,app='original Enigma 1.01',utc=utc(),bornHEAD=base,branch=scope,boat='bx_w72496sc',guestInvocations=0,newRender=False,hostCheckInputObserved=False,returnedMSGObserved=False,wndprocCompletionObserved=False,SDLConsumptionObserved=False,gameplayAccepted=False,productionDefectProved=False,apiResumeAttempts=1,newTransfers=0,remainingBytes=4125714,remainingChunks=253,previousSuccessfulChunks=803,prefixBytes=13156352,prefixSHA256='1600f60cdbf1733d0f88ee0592fa31e642dc607ffa7bfc933a6d95e3a1b4696f',prefixCurrentRemoteVerification=False,prefixVerification='coordinator-verified predecessor proof and same unchanged stopped snapshot; no actual API exec permitted after resume denial',fullArchiveSHA256=pre['archiveSHA256'],fullArchiveLocalVerified=True,fullArchiveRemoteVerified=False,archiveBytes=17282066,retainedModuleRevision='425755ee5ee9be0734c7aca187521100f5487674',retainedModuleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',lifecycle=dict(state='stopped',snapshotVerifiedAt=close['snapshotVerifiedAt'],stoppedAt=close['stoppedAt'],expiry=None,resumed=False,watchdogArmedBeforeAttempt=True,shutdownExplicitlyDelegated=True,stopAttemptResult='400 Sandbox is archived, so it cannot be stopped; subsequent info verifies already stopped snapshot'),blocker=resume,localOverhead=dict(perOperationCPU=pre['measuredLocalCPUPerOperation'],predicted253CPU=pre['predicted253CPU'],realAPIOverheadMeasured=False,cap=60),policy=dict(RAMAdmission=False,RSSMemAvailableObservational=True,processEnforcementRetained=True,hostDiskFloor=1610612736,remainingAggregateGrowth=200183808,captureCeiling=524288,generatedFileCeiling=12582912,localAllocation=64*1048576,localReserve=8*1048576,compactEvidenceCap=1048576,imagesCap=8*1048576,remoteAllocation=256*1048576,remoteReserve=8*1048576,guestHardWall=115),remoteVerified=False,nextRequired='Coordinator must resolve supported API resume permission for the same retained snapshot; do not retry unchanged key, use denied SSH, create replacement or retransmit successful prefix.')
(out/'completion-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(out/'README.md').write_text('''# Original Enigma retained-prefix runtime: blocked at resume permission

At 2026-10-30T07:25:12Z, the supported API returned HTTP 403 `api_key_action_forbidden`: `This API key cannot perform sandbox.resume.` Exactly one resume was attempted for bx_w72496sc. No API exec, append, extraction, guest invocation or new image occurred. No input-consumption, rendering, gameplay or production-defect conclusion is supported.

The local archive and prefix hashes match the assignment. The canonical production parser, intended tree mount/filename enumeration (including comma filenames), exact local Node startup, generated 2MiB file under the distinct 12MiB FSIZE cap, 512KiB output-overflow rejection and cwd rejection controls passed. The 2663-entry manifest and unchanged argv identities are sealed in preflight.json. Local overhead averaged 0.01266 CPU seconds per operation (about 3.20 seconds for 253); actual API overhead could not be measured. The unexecuted continuation performs the remote offset/prefix hash smoke first, appends only the remaining 253 chunks with per-command offset/SHA verification and <=16384 raw/32768 serialized-command bounds, checks CPU prediction after three append operations, then verifies full SHA and extracted manifest before the unchanged guest observer. No claim that this unexecuted path passed.

New immutable owned helpers preserve all actual process controls, independently count allocation/current capture receipts and launcher logs, and use fixed archive/manifest stat identities to avoid repeated full retained-root scans. RAM remains observation only. Before resume, aggregate allocation was measured with 3MiB planned incremental publication/evidence plus 8MiB reserve and the 1.5GiB host disk floor after 200183808 bytes remaining aggregate growth.

The independent finite watchdog was armed before the resume attempt. Safety stop returned HTTP400 because the box was already archived; supported info then verified state stopped and the original snapshot 2026-10-30T07:14:38.646Z / stopped07:14:38.704Z. There is no new live expiry or new snapshot. Snapshot ownership returns to the coordinator. The old 803 successful transfers and their denial/interruption evidence remain unchanged; no supervisor was restarted after a kill, no cap raised and no access denial retried. A supported resume permission change is required to continue this same snapshot.

completion-receipt.json is the pre-publication result. The external receipt is finalized with the commit and exact remote SHA after push; artifact-hashes.json seals this published packet. Raw control captures remain local and physically charged, referenced by hash. No workers, Telegram, main merge, build, public upload service or frozen renderer changes.
''')
d=o.REPO/scope;d.mkdir()
for n in ['retained_ops.py','retained_gate.py','retained-runtime.py','retained-runtime-v2.py','retained-preflight.py','create-retained.py','retained-publish.py']:
 shutil.copyfile(r/n,d/n)
for n in ['preflight.json','controls.json','startup.json','startup.stdout','canonical-parser.json','canonical-parser.stdout','resume-supported.json','resume-supported.stdout','file-control.json','planned-growth.json','0001-lifecycle-info.json','0001-lifecycle-info.stdout','0002-resume.json','0002-resume.stdout','failure.json','schedule.json','watchdog.json','closeout.json']:
 if (e/n).exists():shutil.copyfile(e/n,d/n)
for n in ['README.md','completion-receipt.json']:shutil.copyfile(out/n,d/n)
shutil.copyfile(o.REPO/'test/enigma-guest-poll-causal-runtime-oct30/input-identities.json',d/'input-identities.json')
rootreceipt=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-retained-prefix-guest-poll-runtime-oct30/root-ref-digest.json');shutil.copyfile(rootreceipt,d/'root-ref-digest.json')
raw=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted((out/'raw').iterdir()) if p.is_file()]
(d/'raw-evidence-references.json').write_text(json.dumps(raw,indent=2)+'\n')
(d/'artifact-hashes.json').write_text(json.dumps({p.name:dict(bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(d.iterdir()) if p.is_file()},indent=2)+'\n')
# Re-scan all retained roots, including newly generated publication files/index growth.
o.establish();a=g.admission();assert a['allocated']+3*1048576+8*1048576<=64*1048576
os.environ['GIT_INDEX_FILE']=str(out/'publication-index')
run('isolated-index',['read-tree','HEAD'])
run('stage',['add','--',scope])
run('diff-check',['diff','--cached','--check','--',scope])
paths=run('staged-paths',['ls-files','--stage','--',scope]);assert len(paths.splitlines())==len(list(d.iterdir()))
run('review-stat',['diff','--cached','--stat','--',scope])
run('commit',['commit','-m','Prepare retained Enigma prefix continuation; preserve resume API denial'])
head=run('commit-sha',['rev-parse','HEAD']).strip()
run('push',['push','origin','HEAD:refs/heads/'+scope])
remote=run('remote-sha',['ls-remote','--heads','origin','refs/heads/'+scope]).split();assert remote==[head,'refs/heads/'+scope]
o.establish();a=g.admission()
receipt.update(commit=head,remoteSHA=head,remoteRef=remote[1],remoteVerified=True,completedAt=utc(),finalAllocation=a,publicationArtifactManifestSHA256=sha(d/'artifact-hashes.json'))
(out/'completion-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
note=f"{receipt['completedAt']} retained-prefix worker RELEASE: BLOCKED403 sandbox.resume API key action forbidden; one attempt, zero new transfers/guest/render. Commit {head}, exact remote {remote[1]} SHA verified. bx_w72496sc remains stopped snapshot{close['snapshotVerifiedAt']} stopped{close['stoppedAt']}, no live expiry; ownership back to coordinator. Receipt {out/'completion-receipt.json'}. No unchanged-denial retry, replacement Boat, workers, Telegram or main merge.\n"
(out/'messageboard-note.txt').write_text(note)
print(json.dumps(dict(commit=head,remoteSHA=head,receipt=str(out/'completion-receipt.json'),note=str(out/'messageboard-note.txt'))))
