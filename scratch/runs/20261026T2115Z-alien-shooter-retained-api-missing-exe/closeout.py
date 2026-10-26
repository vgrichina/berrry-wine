from work import *
ID='20261026T2115Z-alien-shooter-retained-api-missing-exe';P=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26/ops');REPO=H/'repo';RUN=REPO/'scratch/runs'/ID
# Correct CLI status syntax is process ID; retain original invalid-argument incident.
a=['boat','--no-update','--json','exec','--status',str(json.loads((O/'guest-detach.json').read_text())['pid']),BOX];p=subprocess.run(a,capture_output=True,text=True,timeout=30);assert p.returncode==0,p.stderr;save('detach-status-corrected.json',dict(argv=a,exit=p.returncode,stdout=p.stdout,stderr=p.stderr))
f=ROOT/'test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe';save('missing-exe-diagnosis.json',dict(localPath=str(f),localBytes=f.stat().st_size,localSHA256=hashlib.file_digest(f.open('rb'),'sha256').hexdigest(),remoteExpectedPath='/tmp/alien-shooter-current-gameplay-api-oct26/runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe',remoteAbsent=True,in431FixturePins=False,in594RuntimeManifest=False,sourceRegistry='lib/apps.js alien_shooter.exe',noTransfer=True,reason='No restaging authorized; first pre-guest production failure preserved'))
b=json.loads((O/'box-handoff-state.json').read_text());save('lifecycle.json',dict(box=BOX,state=b.get('sandbox',b).get('state'),expiry='2026-10-26T22:31:02.925Z',shutdown='2026-10-26T22:00:00Z',guestCutoff='2026-10-26T21:50:00Z',handback='2026-10-26T21:55:00Z',ownedLive=[],watchPID3114875='coordinator-owned untouched',shutdownOwner='coordinator',leaveRunning=True))
# Reserve unresident client growth only: MemAvailable already excludes all resident clients.
clients=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex'):
   clients.append(dict(pid=int(q.name),rss=int((q/'statm').read_text().split()[1])*4096,worker=b'wine-worker' in a))
 except (OSError,ValueError):pass
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
clientGrowth=sum(max(0,335544320-x['rss']) for x in clients if x['worker']);required=576*2**20+768*2**20+256*2**20+3*64*2**20+768*2**20+clientGrowth
save('publication-memory-admission.json',dict(memAvailable=mem,GitAndHelper=576*2**20,CivCap=768*2**20,GLCap=256*2**20,otherHelpers=3*64*2**20,hostFloor=768*2**20,clients=clients,unresidentClientGrowth=clientGrowth,required=required,passGate=mem>=required));print('PUB MEMORY',mem,required);assert mem>=required,'Fresh publication RAM gate'
REPO.mkdir();RUN.mkdir(parents=True)
# Do not copy the game, module, source or old receipts: reuse published prior receipts by identity.
for q in O.glob('*'):
 if q.is_file() and q.suffix in ['.json','.jsonl','.py','.cjs'] and q.name!='collection-api.json':shutil.copy2(q,RUN/q.name)
shutil.copytree(O/'retained',RUN/'retained')
reuse=dict(commit='211aa6b720116bad1e2773c148a2f4c4529d4a58',branch='task/alien-shooter-current-gameplay-api-oct26',run='scratch/runs/20261026T2103Z-alien-shooter-current-api-resource-blocker',unchangedCompiledModule='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75',sourceRevision='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2',runtimeFilesVerified=582,compilerOnlyRemovals=12,prior64MiBIncidentRemainsTrue=True)
(RUN/'reused-checkpoints.json').write_text(json.dumps(reuse,indent=2))
notes=REPO/'docs/re-notes/alien-shooter-retained-gameplay-api-oct26.md';notes.parent.mkdir(parents=True)
notes.write_text('''# Alien Shooter retained production attempt: missing executable

The actual pinned production runner was invoked once with registered --app=alien_shooter --no-build, retained canonical current.wasm and software rendering. It exited1 after0.186245s before loading the guest because its registered game/AlienShooter.exe is absent from the retained stage. No guest instruction, LockRect return, guest trap, input, gameplay or screenshot was observed. This is an authentic current production startup harness/fixture failure, not an authentic guest crash. The historical NULL method localization was not reused as current evidence.

All582 remaining runtime payloads and the canonical module were freshly hashed successfully. The12 recorded compiler-only removals match exactly. The passed original compile/fixture/mount checks are reused unchanged from211aa6b7; their coverage does not include the executable. The supplied431-file fixture receipt and594-file runtime manifest both omit AlienShooter.exe. The pinned production registry independently names it. A local original executable does exist (712724 bytes); missing-exe-diagnosis.json records its SHA256. No executable or other game bytes were transferred or committed. No compilation, full source copy, asset restaging, transformed runner, state patch, stub or alternate backend was used. A separately authorized targeted executable transfer would resolve this specific missing input before another guest attempt; it has not been performed under the explicit no-restaging scope.

Whole-task allocation authorized128MiB, projected102961152 bytes including entire retained remote stage49197056 bytes, new helpers/output/captures, local collection, dashboard/Git publication, session/events, positive WAL once, future growth and8MiB reserve. This does not change the prior64MiB failure. Physical RAM/CPU/wall/disk/file/output controls remain. Exact Node24.22.1 heap2048/preload/environment/CPU90/file24MiB startup passed; DATA/address space remained unlimited for Node. Guest tree supervisor cap2560MiB, actual peak81281024 bytes, CPU0.15s, clean natural exit. Git512MiB DATA applies only to Git subprocesses. Local guard caps64MiB helpers and576MiB Git plus helper, with90CPU/119wall/file24MiB/output2MiB. Pre-guard setup/hash helpers were lightweight but no retrospective continuous localRSS enforcement is claimed for them. Fresh admission conservatively reserved parallel Civ768MiB/GL256MiB/helper caps and host768MiB; closeout reserves only prospective client growth above measured resident RSS to avoid double charging.

The first control snapshot connection was refused after Node had already exited. No step was submitted, no outstanding ACK exists and no request was replayed. Original connection error preserved. A status call initially used commandId where CLI requires integer PID; the argument validation error and corrected PID status are both retained. No access denial was bypassed.

Owned guest process32913 and supervisor completed; remainingOwnedLive is empty. Box bx_a9dwsx2x remains running (API idle, stop:null), expiry2026-10-26T22:31:02.925Z. Coordinator owns snapshot-stop22:00UTC; watcher3114875 untouched. No shutdown/resume/delete/SSH/public hosting or other game process changes.

Evidence run: '''+ID+'\n')
result=dict(candidateId='reflexive-alien-shooter',agentId='codex:'+os.environ['CODEX_THREAD_ID'],startedAt='2026-10-26T21:15:58.540Z',finishedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),outcome='harness-error',route='registered alien_shooter production startup before guest load',command=json.loads((O/'guest-args.json').read_text()),build=dict(commit=reuse['sourceRevision'],wasmSha256=reuse['unchangedCompiledModule'],moduleVerified=True,runnerInvoked=True,guestExecuted=False),environment=dict(box=BOX,node='24.22.1',renderer='software explicitly scoped',viewport=None),summary='Production runner exits1 ENOENT AlienShooter.exe before guest load: omitted from retained431 fixture/594 staged pins. No gameplay/current guest crash/input/frame. No rebuild/restage; clean handoff RUNNING.',verification='reviewed',artifacts=[str(p.relative_to(RUN)) for p in RUN.rglob('*') if p.is_file()])
(RUN/'result.json.tmp').write_text(json.dumps(result,indent=2)+'\n');os.replace(RUN/'result.json.tmp',RUN/'result.json')
shutil.copytree(RUN,ROOT/'scratch/runs'/ID)
p=subprocess.run(['node','--max-old-space-size=32',str(ROOT/'ops/check-run-evidence.js'),str(REPO)],capture_output=True,text=True,timeout=25);save('evidence-check.json',dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and '"invalid": []' in p.stdout
# Git data limit is child-only. No source checkout or root refs enumeration.
git('init','-b','task/alien-shooter-retained-gameplay-api-oct26');git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
git('add','docs','scratch');git('diff','--cached','--check');git('commit','-m','docs: record retained Alien Shooter missing executable blocker');commit=git('rev-parse','HEAD')
git('push','--set-upstream','origin','HEAD:refs/heads/task/alien-shooter-retained-gameplay-api-oct26');ref=git('ls-remote','--heads','origin','refs/heads/task/alien-shooter-retained-gameplay-api-oct26');assert ref.split()[0]==commit
save('publication.json',dict(commit=commit,remoteRef=ref,branch='task/alien-shooter-retained-gameplay-api-oct26',normalPush=True,trustedSSH=SSH));print('VERIFIED PUSH',commit)
