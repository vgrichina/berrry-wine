import pathlib,json,hashlib,datetime,resource,os
r=pathlib.Path(__file__).parent;out=r/'small-transfer';e=out/'e'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ledger=e/'transport.jsonl'
if ledger.exists():
 p=out/'raw/transport-final.jsonl';ledger.rename(p)
 (e/'transport-final-reference.json').write_text(json.dumps(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p),classification='raw API transport ledger; all bytes physically charged'))+'\n')
receipts=sorted((out/'raw').glob('transfer-*.stdout'))+sorted(e.glob('transfer-*.stdout'))
receipts.sort(key=lambda p:p.name)
a=json.loads((r/'archive.json').read_text());off=0;i=0;h=hashlib.sha256()
for part in a['parts']:
 with (r/part).open('rb') as f:
  while b:=f.read(16384):
   if i==len(receipts):break
   p=receipts[i];assert p.name=='transfer-%04d.stdout'%i
   v=json.loads(p.read_text());assert v['success'] and v['exitCode']==0 and not v['stdoutTruncated'] and not v['stderrTruncated']
   row=json.loads(v['stdout']);assert row==dict(offset=off,end=off+len(b),sha256=hashlib.sha256(b).hexdigest())
   h.update(b);off+=len(b);i+=1
 if i==len(receipts):break
state=json.loads((e/'interruption-state.json').read_text());assert state['remote']['bytes']==off
proof=dict(successfulChunks=i,bytes=off,remaining=a['bytes']-off,remoteOffsetVerified=True,everyRemoteChunkSHARecheckedAgainstRetainedArchive=True,retainedPrefixSHA256=h.hexdigest(),firstReceipt=dict(path=str(receipts[0]),sha256=sha(receipts[0])),lastReceipt=dict(path=str(receipts[-1]),sha256=sha(receipts[-1])),fullRemoteArchiveSHAVerified=False,guestInvocations=0)
(e/'transfer-prefix-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
close=json.loads((e/'closeout.json').read_text());assert close['verifiedStopped']
assignment=json.loads((e/'boat-assignment.json').read_text())
sample=json.loads((e/'latest-admission.json').read_text())
v=dict(status='BLOCKED: local runtime supervisor SIGKILL after 803 verified small API transfers',objectiveAchieved=False,transportArgvFixVerified=True,archiveComplete=False,guestInvocations=0,newRender=False,productionDefectProved=False,hostCheckInputObserved=False,returnedMSGObserved=False,wndprocCompletionObserved=False,SDLConsumptionObserved=False,bornHEAD='7c45c0a0136721cd47bf149b946a73287af57507',branch='test/enigma-guest-poll-small-transfer-runtime-oct30',boat=assignment['id'],nativeExpiry=assignment['nativeExpiry'],lifecycle=dict(state='stopped',shutdownExplicitlyDelegatedByOriginalTask=True,snapshotVerifiedAt=close['snapshotVerifiedAt'],stoppedAt=close['stoppedAt']),transfer=proof,blocker=state,policy=dict(RAMAdmission=False,MemAvailableObservational=True,processEnforcementRetained=True,hostDiskFloor=1610612736,remainingAggregateGrowth=200183808,captureCeiling=524288,generatedFileCeiling=12582912,localAllocation=67108864,localReserve=8388608,remoteAllocation=268435456,remoteReserve=8388608,guestHardWall=115),lastRuntimeObservation=sample,closeoutProcessObservation=dict(RSSBytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,MemAvailableBytes=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024),commit=None,remoteSHA=None)
(out/'completion-receipt.json').write_text(json.dumps(v,indent=2)+'\n')
(out/'README.md').write_text(f'''# Original Enigma: bounded API exec transfer and runtime blocker

The new immutable owned transfer helper sends one at most16384-byte raw chunk per API exec. Before each send it bounds the UTF-8 argv, shell-quoted command and JSON-serialized command to32768 bytes. The worst-case local preflight measured22442 serialized bytes. Each remote append checks the exact current offset, decodes strictly, verifies chunk SHA256, checks write length and final offset, and returns offset/end/SHA for exact local comparison. A complete transfer would separately verify the full remote archive SHA before extraction. The retained17282066-byte archive and2663-file manifest were reused unchanged; no repack or build occurred.

Actual production transfer to bx_w72496sc accepted803 consecutive small commands, totaling{off} bytes. All803 response offsets and chunk hashes were rechecked against the retained archive; the supported API metadata check confirmed the same final remote size. The final API command cmd_doqdfxthj4ao succeeded, exit0, no truncation, no signal, no timeout, and oomKilled=false. This confirms the original argv-size failure is removed for these actual transfers. The remote archive remains incomplete by{a['bytes']-off} bytes; its full SHA was not verified.

The local runtime supervisor unexpectedly exited137/SIGKILL immediately after the last successful response. It did not record an exception or run its finally clause. Its actual configured CPU soft/hard limit was60/60 seconds; this is a possible explanation, not a proved signal attribution. No failed API transfer or task admission denial was produced. No resource limit was raised or disabled and no unchanged attempt was retried. This is the first new blocker and the experiment stops here under the assignment's stopping condition. No extraction, guest invocation, production DOWN/UP, host.check_input entry, returned MSG, completed wndproc, SDL consumption or new render occurred. There is no input-routing or gameplay conclusion.

The original task explicitly delegated preservation and verified snapshot-stop. Safety closeout used the supported API, verified a fresh snapshot at{close['snapshotVerifiedAt']} and actual stopped state at{close['stoppedAt']}. Original TTL1800 expiry was{assignment['nativeExpiry']}; cutoff/handback were recorded immediately in boat-assignment.json. Old bx_p42km2d7 and every predecessor box stayed untouched. The local lifecycle watchdog exits after observing this verified closeout. Coordinator receives ownership of the stopped recoverable snapshot; no resume is authorized here.

Preflight executed the exact canonical parser from retained production runner SHA55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e with unchanged filename-bearing guest argv. The tree mount enumerates2460 VFS files and equals the retained manifest's VFS closure; this closure contains zero comma-bearing names. The comma-separated DLL argument is accepted by the canonical parser. Exact Node executable/heap/environment/supervisor startup passed. A legitimate2MiB generated file passed under12MiB FSIZE independently of the512KiB capture ceiling;600000-byte output rejected and oversized serialized commands rejected. Existing source acceptance groups were reused, not rerun. The historical425755ee module and prepared observer/guest schedule remain unchanged; they were not executed. No renderer-input.js, renderer.js, WAT or GL change occurred.

New self-contained ops/gate/runtime files enforce the latest owner policy: no RAM admission, observational MemAvailable,1.5GiB post-growth host disk floor. Actual parent128MiB/group512MiB RSS enforcement, Python DATA128MiB, Git-only DATA256MiB, unchanged Node/Boat inherited DATA/AS, CPU60 local,12MiB generated-file limit,512KiB capture,64MiB allocation plus8MiB reserve, compact1MiB evidence and selected images8MiB remain. Remote process/CPU/wall/allocation enforcement is retained in the unchanged guest helper. All original wrappers and denials are preserved. Repeated transport receipts/ledgers are raw logs, physically charged and hash-sealed separately; compact evidence references their inventory. The partial last API response was preserved even though the supervisor died before creating its normal metadata receipt.

The task branch starts at exact published7c45c0a0136721cd47bf149b946a73287af57507. Publication uses an isolated12MiB-capable index and explicit new paths, preserving predecessor sparse omissions. No main merge, deployment, workers or Telegram. The external completion-receipt.json contains publication SHA/ref after exact ls-remote verification; the committed copy intentionally predates its own commit. The original requested guest-poll experiment remains uncompleted because of the new local supervisor blocker.
''')
print(json.dumps(dict(proof=proof,lifecycle=v['lifecycle'])))
