from common import *
import signal,sys
commit=(R/'.git/refs/heads/task/generally-census-cleared-driving-oct27').read_text().strip();branch='refs/heads/task/generally-census-cleared-driving-oct27'
assert (H/'git-remote-verify.stdout').read_text().split()==[commit,branch]
assert (H/'git-tracked-clean.stdout').read_bytes()==b''
assert json.loads((H/'report.json').read_text())['exit']==0
assert json.loads((H/'owned-process-cleanup.json').read_text())['ownedSurvivors']==[]
# Exact owned board watcher only. Do not signal similarly named foreign watchers.
pid=50225;p=pathlib.Path('/proc')/str(pid);before=None
if p.exists():
 s=(p/'stat').read_text().rsplit(') ',1)[1].split();cmd=(p/'cmdline').read_bytes().split(b'\0');assert int(s[1])==49453 and cmd[:5]==[b'tail',b'-n',b'0',b'-f',b'messageboard.txt'];before=dict(pid=pid,start=s[19],ppid=int(s[1]))
 fd=os.pidfd_open(pid)
 try:signal.pidfd_send_signal(fd,signal.SIGTERM)
 finally:os.close(fd)
 until=time.monotonic()+2
 while p.exists() and time.monotonic()<until:time.sleep(.02)
save('board-watcher-cleanup.json',dict(before=before,live=p.exists(),ownedOnly=True))
assert not p.exists()
ops=[]
for p in H.glob('*.json'):
 try:q=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 if isinstance(q,dict) and 'cleanupComplete' in q and 'commandSHA256' in q:
  assert q['cleanupComplete'];ops.append(dict(path=p.name,sha256=sha(p.read_bytes()),exit=q.get('exit'),stopReason=q.get('stopReason'),peakRSS=q.get('peakRSS')))
raw=sum(p.stat().st_size for p in H.glob('*.api.stdout'));assert raw<=8*M
ownObjects=sum(p.lstat().st_blocks*512 for p in (R/'.git/objects').rglob('*'));assert ownObjects<=8*M
payloads=json.loads((R/'docs/reviews/generally-census-cleared-driving-oct27/payloads.json').read_text())
report=R/'docs/reviews/generally-census-cleared-driving-oct27'
for x in payloads:
 p=report/x['path'];assert p.stat().st_size==x['bytes'] and sha(p.read_bytes())==x['sha256']
manifest=dict(status='BLOCKED_ONE_GUEST_LOADING_STEP_ACK_TIMEOUT',source=PIN,commit=commit,remoteBranch=branch,exactRemoteVerified=True,publication=dict(push='git-push.json',remote='git-remote-verify.json',trackedClean='git-tracked-clean.json',objectBytes=ownObjects,objectLimit=8*M,ssh='strict launcher configuration in run.py',mainUntouched=True),report=str(report/'receipt.json'),reportSHA256=sha((report/'receipt.json').read_bytes()),payloadsSHA256=sha((report/'payloads.json').read_bytes()),sourceManifest=dict(path=str(H/'stage-manifest.json'),sha256=sha((H/'stage-manifest.json').read_bytes())),modules=[dict(path=str(H/n),bytes=(H/n).stat().st_size,sha256=sha((H/n).read_bytes())) for n in ['wine-assembly.wasm','wine-assembly.compat.wasm']],causalChain=['same-pin source closure missing3 files, recovered without repeating passed prefix; one canonical WAT compile','remote startup helper ordinal/schema corrections passed on actual production functions','actual new menu PNG inspected before ordinary Player/Agari/Start clicks','step100000 id12 lacks completion ACK after38/40seconds','no later input/step/capture replay; bridge pipe closes; NodeEPIPE; owned subtree cleanupComplete'],inspectedPNGs=json.loads((H/'visual-reviews.json').read_text()),drivingQualified=False,ordinaryQuit=False,fpsQualified=False,commands=str(report/'evidence/api-command-ledger.json'),resources=dict(rawAPIBytes=raw,rawAPILimit=8*M,physicalGit=256*M,gitChildDATA=512*M,physicalPython=128*M,localAllocation=192*M,remoteAllocation=1024*M,remoteLastAllocated=json.loads((H/'owned-process-cleanup.json').read_text())['remoteAllocated']),cleanup=dict(guest='owned-process-cleanup.json',watcher='board-watcher-cleanup.json',allSupervisedChildrenClean=True,operations=ops),lifecycle=dict(box=BOX,actualAPIState='idle',health='ok',stoppedAt=None,expiry='2026-10-27T13:20:39.001Z',workerLifecycleMutations=0,leaveAvailable=True,shutdownOwner='coordinator',guestCutoff='13:08UTC',handback='13:11UTC',snapshotStop='13:14UTC'),remainingGates=['measured bounded/progress-aware loading dispatch','ordinary Enter after inspected time-trial overlay and countdown','inspected before/after track frames with actual Up dispatch+release','ordinary game Quit'],unchangedHistoricalRaceProof='docs/re-notes/generally.md; not reused as new acceptance',rootRefReceiptReused=str(ROOT/'scratch/usage-watch/generally-census-cleared-driving-oct27/root-ref-digest.json'),incidents='Report receipt enumerates failed setup diagnostics; original streams retained. No platform denial, physical-memory guard, source repair, extra guest, main edit, deployment or worker spawning.')
manifest['resources']['completeFootprint']=dict(path='complete-footprint-final.json',sha256=sha((H/'complete-footprint-final.json').read_bytes()),measurement=json.loads((H/'complete-footprint-final.json').read_text()))
manifest['resources']['lastAggregateAdmission']=dict(path='guest-launch-admission.json',sha256=sha((H/'guest-launch-admission.json').read_bytes()))
manifest['finalizationRecipe']=dict(path=str(H/'finalize.py'),sha256=sha((H/'finalize.py').read_bytes()))
save('receipt-manifest.json',manifest)
save('result.json',dict(status=manifest['status'],commit=commit,branch=branch,canonicalReceipt=str(H/'receipt-manifest.json'),canonicalSHA256=sha((H/'receipt-manifest.json').read_bytes()),box=BOX,workerStopped=True))
print(json.dumps(dict(commit=commit,branch=branch,canonicalSHA256=sha((H/'receipt-manifest.json').read_bytes()),rawAPIBytes=raw,objectBytes=ownObjects,operations=len(ops),allCleanup=True)))
