from work import *
OLD='/tmp/alien-shooter-current-gameplay-api-oct26';ID='alien-shooter-required-exe-gameplay-api-oct26';REPO=H/'repo';RUN=REPO/'scratch/runs'/ID
save('helper-first-assertion-incident.json',dict(commandId='cmd_awljud2lcqsi',startedAt='2026-10-26T21:21:47.222Z',finishedAt='2026-10-26T21:21:47.353Z',exitCode=1,stderr='Traceback (most recent call last):\n  File "<string>", line 6, in <module>\nAssertionError\n',cause='Incorrect helper assertion that DLL seeds must exist. Unchanged registered app requires no DLL seeds. Corrected helper only, before sole production invocation.',originalExactResponsePreviouslyInspected=True))
code='''import pathlib,json,hashlib,base64,os
h=pathlib.Path('''+repr(R)+''');old=pathlib.Path('''+repr(OLD)+''');rows=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\\0');exe=os.readlink(q/'exe')
  if (exe.endswith('/node') and str(old/'runner/test/run.js').encode() in a) or (exe.endswith('/python3.12') and str(h/'supervisor.py').encode() in a):rows.append(dict(pid=int(q.name),argv=[x.decode() for x in a]))
 except OSError:pass
files={str(p.relative_to(h)):base64.b64encode(p.read_bytes()).decode() for p in (h/'guest').glob('*') if p.is_file()}
print(json.dumps(dict(files=files,ownedLive=rows,allocatedRetained=sum(p.lstat().st_blocks*512 for p in [old,*old.rglob('*')]),allocatedNew=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),moduleSHA256=hashlib.file_digest((old/'current.wasm').open('rb'),'sha256').hexdigest(),exeSHA256=hashlib.file_digest((old/'runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe').open('rb'),'sha256').hexdigest(),missingPath=str(old/'runner/src/api_table.json'),missing=(not (old/'runner/src/api_table.json').exists()),retainedSourceCandidates={str(p):p.exists() for p in [old/'src/api_table.json',old/'source/src/api_table.json',old/'runner/src/api_table.json']})))
assert not rows
'''
j=py(code);save('collection-api.json',j);v=json.loads(j['stdout']);d=O/'retained/guest';d.mkdir(parents=True,exist_ok=True)
for n,b in v['files'].items():(d/pathlib.Path(n).name).write_bytes(base64.b64decode(b))
save('cleanup.json',{k:x for k,x in v.items() if k!='files'});assert v['missing'] and not v['ownedLive'];assert v['moduleSHA256']=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75'
a=['boat','--no-update','--json','exec','--status',str(json.loads((O/'guest-detach.json').read_text())['pid']),BOX];p=subprocess.run(a,capture_output=True,text=True,timeout=30);assert p.returncode==0;save('detach-status.json',json.loads(p.stdout))
p=subprocess.run(['boat','--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0;save('box-handoff-state.json',json.loads(p.stdout))
save('lifecycle.json',dict(box=BOX,state='RUNNING',expiry='2026-10-26T22:31:02.925Z',guestCutoff='2026-10-26T21:50:00Z',handback='2026-10-26T21:55:00Z',shutdown='2026-10-26T22:00:00Z',shutdownOwner='coordinator',watchPID3114875='untouched',ownedLive=[]))
# Publication admission, same task cap; Git DATA only in glimits child callback.
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
clients=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex') and b'wine-worker' in a:clients.append(dict(pid=int(q.name),rss=int((q/'statm').read_text().split()[1])*4096))
 except (OSError,ValueError):pass
growth=sum(max(0,335544320-x['rss']) for x in clients);required=(576+768+256+3*64+768)*2**20+growth
save('publication-memory-admission.json',dict(memAvailable=mem,required=required,clientGrowth=growth,clients=clients,passGate=mem>=required));assert mem>=required
base=json.loads((O/'sqlite-baseline.json').read_text());wal=sum(max(0,allocated(pathlib.Path(p))-n) for p,n in base.items());sess=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'));L=ROOT/'scratch/usage-watch'/ID
charges=dict(retainedRemote=v['allocatedRetained'],newRemote=v['allocatedNew'],localOwned=allocated(H),dashboardAndPublication=16777216,Git=2097152,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(sess),positiveWALOnce=wal,futureGrowth=8388608,reserve=8388608)
account=dict(charges=charges,total=sum(charges.values()),cap=134217728,projectedHostFree=shutil.disk_usage(H).free-24*2**20,hostFloor=2982150144);account['passGate']=account['total']<=account['cap'] and account['projectedHostFree']>=account['hostFloor'];save('publication-allocation.json',account);assert account['passGate']
REPO.mkdir();RUN.mkdir(parents=True)
for q in O.glob('*'):
 if q.is_file() and q.suffix in ['.json','.jsonl','.py','.cjs']:shutil.copy2(q,RUN/q.name)
shutil.copytree(O/'retained',RUN/'retained')
reuse=dict(priorCompileCommit='211aa6b720116bad1e2773c148a2f4c4529d4a58',priorMissingExeCommit='fad434119acecf9d7af4ed837d162ba7107941cf',priorNoGuestClaimPreserved=True,sourceRevision='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2',moduleSHA256=v['moduleSHA256'],retainedRuntimeVerified=582,recordedCompilerRemovals=12,requiredDllSeeds=[],remaining='Production src/api_table.json absent. No guest execution occurred. Exact source-backed minimal prerequisite recovery needs new scope; no repeat of unchanged production failure.')
(RUN/'durable-checkpoint.json').write_text(json.dumps(reuse,indent=2)+'\n')
notes=REPO/'docs/re-notes'/('alien-shooter-required-exe-gameplay-api-oct26.md');notes.parent.mkdir(parents=True)
notes.write_text('''# Alien Shooter: executable recovered; next production staging failure

The explicitly authorized original AlienShooter.exe (712724 bytes, SHA256 aae2547ccec2e235344bc9cf6e5e9ef4c9923b13c9e8fbd1fe14c65b64252446, mode0644) was transferred only to its registered retained production path. Chunk payloads were at most30000 raw bytes, requests at most60000 bytes, responses at most8192 bytes. Readback matches. The supplementary manifest corrects its historical omission without altering the old431-fixture/594-staging receipts or their earlier ENOENT/noGuest result. No game bytes were committed.

The unchanged582 runtime payloads, module and file modes passed fresh verification. The canonical argument parser accepted the real registered --app=alien_shooter --no-build route, with original filename enumeration plus the executable supplement. DLL seed requirements are empty: imports are implemented system APIs. The initial helper wrongly asserted nonempty seed files; its exact failure and corrected startup check are preserved. Node24.22.1 heap2048/preload/environment and inherited CPU90/file24MiB limits passed. DATA/address-space limits remained unlimited for Node; Git DATA512MiB is child-only.

One actual production runner invocation then exited1 naturally after0.107410143 seconds, CPU0.07s, peak supervised tree RSS78528512 bytes, output1002 bytes. Its first current failure is ENOENT reading runner/src/api_table.json at test/run.js:2719, before context initialization/WASM instantiation. The source unconditionally reads this JSON even with --no-build. This new source/runtime staging omission is absent from the retained594 manifest. No guest instructions, controller step, input, frame, LockRect result or authentic guest crash were observed. The first control snapshot was refused after this early exit; no step was submitted or replayed. Historical NULL-call localization is not current evidence.

No source/asset restaging, build, reacquisition, alternate executable, module transform or state patch was performed. The specific authorization allowed only the required executable transfer; a further source runtime prerequisite is a concrete blocker. The original module remains f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75. All owned guest/supervisor processes completed; cleanup identities have no live survivors. Box bx_a9dwsx2x remains RUNNING, expiry22:31:02.925Z, coordinator snapshot-stop22:00 and watch3114875 untouched.

Full128MiB allocation passed including retained stage, executable/helpers, collection/publication/Git/session/events, positive WAL once, growth and8MiB reserve. Fresh physical RAM and disk gates passed with parallel Civ768MiB/GL256MiB/helper/client/host reservations. Guest physical tree cap2560MiB, CPU90, wall89 (<90 guest total), file24MiB, output2MiB, lifecycle cutoff21:50 were preserved. The old64MiB incident remains true. No main merge/public deployment/Boat SSH/other game/service/worker changes.

Evidence: scratch/runs/alien-shooter-required-exe-gameplay-api-oct26.
''')
result=dict(candidateId='reflexive-alien-shooter',agentId='codex:'+os.environ['CODEX_THREAD_ID'],startedAt='2026-10-26T21:21:16Z',finishedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),outcome='harness-error',route='production registered alien_shooter before guest initialization',command=json.loads((O/'guest-args.json').read_text()),build=dict(commit=reuse['sourceRevision'],wasmSha256=v['moduleSHA256'],moduleVerified=True,runnerInvoked=True,guestExecuted=False),environment=dict(box=BOX,node='24.22.1',renderer='software explicitly scoped',viewport=None),summary='Authorized executable arrived and readback passed. Production exits1 ENOENT runner/src/api_table.json before guest execution. No gameplay or authentic guest crash; clean RUNNING handoff.',verification='reviewed',artifacts=[str(p.relative_to(RUN)) for p in RUN.rglob('*') if p.is_file()])
(RUN/'result.json').write_text(json.dumps(result,indent=2)+'\n');shutil.copytree(RUN,ROOT/'scratch/runs'/ID)
p=subprocess.run(['node','--max-old-space-size=32',str(ROOT/'ops/check-run-evidence.js'),str(REPO)],capture_output=True,text=True,timeout=25);save('evidence-check.json',dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and '"invalid": []' in p.stdout
for n in ['evidence-check.json']:
 shutil.copy2(O/n,RUN/n);shutil.copy2(O/n,ROOT/'scratch/runs'/ID/n)
git('init','-b','task/'+ID);git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git('add','docs','scratch');git('diff','--cached','--check');git('commit','-m','docs: record Alien Shooter executable recovery and production prerequisite blocker');commit=git('rev-parse','HEAD');git('push','--set-upstream','origin','HEAD:refs/heads/task/'+ID);ref=git('ls-remote','--heads','origin','refs/heads/task/'+ID);assert ref.split()[0]==commit
save('publication.json',dict(commit=commit,remoteRef=ref,branch='task/'+ID,trustedSSH=SSH,normalPush=True));print('VERIFIED',commit,ref,flush=True)
