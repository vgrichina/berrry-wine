import pathlib,json,os,subprocess,time,hashlib,shutil,re,signal
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';C=pathlib.Path('/home/user/.codex')
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
sha=lambda b:hashlib.sha256(b).hexdigest()
# One read-only exec verifies the allocated box remains accessible and untouched.
cmd="python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].split()[0])*1024,taskDirectoryExists=pathlib.Path(\"/tmp/maelstrom-exact-select-original-capture-oct24\").exists())))'"
p=subprocess.run(['/home/user/.ascii/boat','--no-update','--json','exec','--timeout','20','bx_vwsk6745',cmd],capture_output=True,text=True,timeout=35)
assert len(p.stdout.encode())+len(p.stderr.encode())<131072
j=json.loads(p.stdout);save('box-readonly-exec.json',dict(returncode=p.returncode,response=j,stderr=p.stderr,command=cmd));assert p.returncode==0 and j.get('exitCode')==0 and not j.get('stdoutTruncated') and not j.get('stderrTruncated')
remote=json.loads(j['stdout']);assert remote['uid']==1000 and not remote['taskDirectoryExists']
p=subprocess.run(['/home/user/.ascii/boat','--no-update','--json','info','bx_vwsk6745'],capture_output=True,text=True,timeout=30)
assert p.returncode==0 and len(p.stdout.encode())<131072
box=json.loads(p.stdout);save('box-handoff.json',dict(at=time.time(),box=box,requestedLifecycle='Leave RUNNING; coordinator shutdown 2026-10-24T23:52:00Z',workerLifecycleMutations=0,remoteMaterializedBytes=0,remoteOwnedGuestGroups=[],hostBoxUntouched='bx_69aem736'))
assert box['sandbox']['stop'] is None and box['sandbox']['state']=='idle'
watch=json.load(open(O/'watcher.json'));os.killpg(watch['pgid'],signal.SIGTERM)
for _ in range(100):
 try:
  state=pathlib.Path('/proc/'+str(watch['pid'])+'/stat').read_text().split()[2]
  if state=='Z':break
 except FileNotFoundError:break
 time.sleep(.01)
save('cleanup.json',dict(at=time.time(),watcherTermSent=True,pid=watch['pid'],guestGroupsStarted=0,remoteCommandCompleted=True,heavyLockAcquired=False,heavyLockReason='No native or original guest executed; no runtime staging',allGuestGroupsReaped=True,boxShutdownOwner='coordinator',boxId='bx_vwsk6745',apiState=box['sandbox']['state'],stopped=False,expiry=box['sandbox']['archiveAfter']))
def manifest(paths):
 return [dict(path=str(p),bytes=p.stat().st_size,allocated=max(p.stat().st_size,p.stat().st_blocks*512)) for p in paths if p.is_file() and not p.is_symlink()]
def total(rows):return sum(x['allocated'] for x in rows)
def account(name):
 old=json.load(open(O/'resource-precheckout.json'));base=json.load(open(O/'sqlite-baseline.json'))
 rows=dict(owned=manifest(H.rglob('*')),session=manifest([pathlib.Path(old['session'])]),launcher=manifest(pathlib.Path(old['launcher']).rglob('*')),wal=manifest(C.glob('*.sqlite-wal')))
 charges={k:total(v) for k,v in rows.items()};charges.update(positiveSQLite=sum(max(0,max(pathlib.Path(p).stat().st_size,pathlib.Path(p).stat().st_blocks*512)-n) for p,n in base.items()),futurePublicationGitEvidence=4*1024**2,futureExternal=8*1024**2,reserve=8*1024**2,remoteNew=0,transferOverlap=0,rootBoardAllowance=4096)
 free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 future=20*1024**2;d=dict(at=time.time(),charges=charges,peak=sum(charges.values()),cap=64*1024**2,free=free,afterProjection=free-future,remoteFree=remote['free'],remoteAfterProjection=remote['free'],memAvailable=mem,manifest=rows,perFile24MiB=all(x['bytes']<=24*1024**2 for x in rows['owned']),standingInputManifest='/tmp/maelstrom-native-errno-capture-oct24/manifest.json',standingInputBytes=17027463,standingOriginalBytes=2794170,standingDiagnosticModuleBytes=1880716,standingInputsNewCopies=0,limits='Cheap heap256 CPU/wall60 output131072; no native/guest. Guest supervisor not launched; inherited FSIZE acceptance not qualified.',historicalQualifications='Earlier native acceptance limitations retained. One large source-inspection response was tool-truncated; no guest stdout or payload was emitted or reprinted.')
 d['pass']=d['peak']<=d['cap'] and d['afterProjection']>=2982150144 and mem>=805306368 and d['perFile24MiB'];save(name,d);assert d['pass'];return d
account('resource-prepublication.json')
folder=R/'docs/re-notes/maelstrom-exact-select-original-capture-20261024-evidence';folder.mkdir(parents=True)
selected=['prepare.py','checkout.py','preflight.cjs','finish.py','preflight.json','preflight.stdout','preflight.stderr','mount-and-pacing.json','planned-guest-args.json','configuration.json','checkout.json','schedule.json','standing-tools.json','resource-precheckout.json','resource-prepublication.json','sqlite-baseline.json','box-readonly-exec.json','box-handoff.json','cleanup.json']
for n in selected:shutil.copyfile(O/n,folder/n)
seals=[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(folder.iterdir())]
(folder/'evidence-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
report=R/'docs/re-notes/maelstrom-exact-select-original-capture-20261024.md'
report.write_text('''# Original Maelstrom exact select capture: preguest timing blocker

The original guest was **not started**. The earliest missing milestone is a guaranteed host capture after actual result/EAX storage and before any later guest execution. No select arrival, park, completion, result/token/route/thread/ESP/saved return, fdset or timeval observation from the original game exists.

The unchanged accepted hook can bind `createOracle(actualInstance, actualInstance.exports)` and `snapshot(actualInstance.exports)` at a synchronous host boundary. That binding alone cannot guarantee the required timing with ordinary `run(1000)`. The exact transformed `handle_select` calls `msc_end` after its real EAX store. `msc_end` stores only diagnostic globals and calls only `msc_fail` on invalid state; it does not yield, stop the budget or invoke the host. On completion, yield reason/flag remain zero and steps remain unchanged. The production thunk path sets the saved return EIP and branches back into the run loop, which can execute subsequent guest code before JS regains control. The standing runner's immediately-after-run boundary therefore cannot establish the requested before-next-guest guarantee. Bounded fdsets/timeval read there could also postdate subsequent guest writes.

This is a source-backed inability to guarantee the requested timing, not proof that a particular original invocation executed further instructions. No such invocation was run. No production repair, compilation, module change, synthetic `test_call_select`, observer layering, pacing change, breakpoint or extra run was attempted. No adapter was installed after the temporal prerequisite failed. A completion fence/callback qualified for the unchanged scheduling would be needed before a new coordinator-assigned capture; implementing one is outside this task.

## Evidence and scope

[`preflight.json`](maelstrom-exact-select-original-capture-20261024-evidence/preflight.json) contains exact hashed source excerpts, an offline evaluation of the accepted transformed handler, and four rejecting controls: forged record, wrong owner, wrong export instance, and park forged as stale-EAX completion. A real source-model park retains stale EAX yet remains a park; source-model completion records the stored result and leaves scheduling unchanged. These are **source-model checks**, not native or original-game observations. Accepted native dispatch OFF/ON and positive completion evidence is reused without rerun. Its `run(1)` bound does not qualify before-next-guest timing for `run(1000)`. Zero diagnostic completion, same-frame retry, exceptions, intra-invocation execution, overhead and original gameplay remain unqualified.

Input main `606caff1de558f185487aed5e31ede159262ba7e`, tested tree `fa0cf92625c22dc90e3effbb0a32f3759c3c79bd`; canonical source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`. Diagnostic module is unchanged: 1,880,716 bytes, SHA256 `ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7`. Hook SHA256 `b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930`. Runner SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`. All identities and excerpt hashes are retained in the evidence.

[`mount-and-pacing.json`](maelstrom-exact-select-original-capture-20261024-evidence/mount-and-pacing.json) records the **unexecuted planned argv**, canonical parser identity, effective batch size1000, and all 48 original input files/2,794,170 bytes with hashes. Tree mounting preserves comma-bearing filenames. PNG/obsolete trace observer options were removed in the plan; ordinary P and directional/fire input schedule, tick200ms, max42000 batches, max60s, memory512MiB remain. No runtime staging occurred. Guest supervisor FSIZE/output/reap controls were not exercised because the temporal gate stopped before guest admission; prior receipts do not become new qualification here.

[`resource-prepublication.json`](maelstrom-exact-select-original-capture-20261024-evidence/resource-prepublication.json) charges full session/launcher/WAL, positive SQLite growth, all owned files, future Git/evidence/external growth and an8MiB reserve within64MiB. Standing installed tools/read-only inputs are inventoried separately. Remote new bytes and transfer overlap are zero. No lock or guest group was started. Root tracked/index/refs and donors remain read-only; root messageboard is append-only. Publication uses strict configured Git SSH, a dependency-first flattened read-only alternate list and explicit sparse paths; no fetch/clone/repack/object copy/main merge.

Box `bx_vwsk6745` remains available and unstopped, Boat API state `idle` (no worker command running), expiry `2026-10-24T23:57:09.772Z`. Coordinator owns shutdown at23:52UTC. [`box-handoff.json`](maelstrom-exact-select-original-capture-20261024-evidence/box-handoff.json) records the exact observed state; worker lifecycle mutations:0. Host `bx_69aem736` untouched. This task makes no gameplay acceptance claim, and no absence is classified as an execution defect.
''')
save('publication-plan.json',dict(report=str(report.relative_to(R)),evidenceDirectory=str(folder.relative_to(R)),files=len(seals)+2,copyBytes=sum(x['bytes'] for x in seals),guestInstances=0,expectedParent='606caff1de558f185487aed5e31ede159262ba7e'))
account('resource-before-push.json')
print(json.dumps(dict(status='BLOCKED_BEFORE_GUEST',report=str(report),evidenceFiles=len(seals))))
