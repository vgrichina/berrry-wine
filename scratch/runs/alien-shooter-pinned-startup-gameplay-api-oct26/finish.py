from work import *
import datetime,tarfile,io
ID=H.name;OLD='/tmp/alien-shooter-current-gameplay-api-oct26';PREV=pathlib.Path('/tmp/alien-shooter-required-exe-gameplay-api-oct26/ops');REPO=H/'repo';RUN=REPO/'scratch/runs'/ID
# Compress only invocation diagnostics, never source/module/assets. API chunks <=5000 raw response.
j=py('''import pathlib,tarfile,hashlib,json,os,io
h=pathlib.Path('''+repr(R)+''');out=h/'diagnostics.tar.gz'
with tarfile.open(out,'w:gz') as t:
 for p in h.rglob('*'):
  if p.is_file() and p!=out:t.add(p,arcname=str(p.relative_to(h)),recursive=False)
rows=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\\0')
  if (str(h/'supervisor-remaining.py').encode() in a or str(h/'supervisor.py').encode() in a or '''+repr((OLD+'/runner/test/run.js').encode())+''' in a):rows.append(int(p.name))
 except OSError:pass
print(json.dumps(dict(bytes=out.stat().st_size,sha256=hashlib.file_digest(out.open('rb'),'sha256').hexdigest(),ownedLive=rows,retainedAllocated=sum(p.lstat().st_blocks*512 for p in [pathlib.Path('''+repr(OLD)+'''),*pathlib.Path('''+repr(OLD)+''').rglob('*')]),newRemoteAllocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]))))
assert not rows
''');save('collection-metadata.json',j);meta=json.loads(j['stdout']);assert meta['bytes']<4*2**20
p=O/'diagnostics.tar.gz'
with p.open('wb') as f:
 for off in range(0,meta['bytes'],5000):
  v=py('import pathlib,base64;f=pathlib.Path('+repr(R+'/diagnostics.tar.gz')+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(v['stdout']))
assert sha(p.read_bytes())==meta['sha256']
D=O/'collected';D.mkdir()
with tarfile.open(p) as t:t.extractall(D,filter='data')
first=json.loads((D/'guest-first-signature-omission/terminal.json').read_text());second=json.loads((D/'guest/terminal.json').read_text());assert not first['remainingOwnedLive'] and not second['remainingOwnedLive'];assert first['elapsed']+second['elapsed']<90
# Read logs in full, preserve originals, summarize exact evidence without interpreting parked EAX as return.
log=(D/'guest/output.log').read_text();oldlog=(D/'guest-first-signature-omission/output.log').read_text()
save('outcome.json',dict(first=first,corrected=second,aggregateGuestWall=first['elapsed']+second['elapsed'],remainingGuestWall=90-first['elapsed']-second['elapsed'],correctedENOENTCount=log.count('ENOENT'),firstSignatureENOENTCount=oldlog.count('host-import-sigs.generated.json'),correctedAuthenticTrapLines=[l for l in log.splitlines() if any(k in l for k in ['RuntimeError','unreachable','CRASH','out of bounds','CALL to NULL'])],gameplay=False,menu=False,visuallyInspected=['frame1.png black','frame2.png SIGMA TEAM splash','frame3.png ALIEN SHOOTER title'],stop='Worker queued explicit quit after third capture. This premature planning stop is preserved; no authentic current game crash and no gameplay acceptance.',remainingBlocker='22.346s remaining aggregate allowance is less than observed37.325s cold corrected startup to title. No repeat cold launch or extra capture; further gameplay needs coordinator-assigned runtime allowance.'))
# Fresh box state through API; no lifecycle mutation.
p=subprocess.run(['boat','--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0;save('box-handoff-state.json',json.loads(p.stdout));save('lifecycle.json',dict(box=BOX,state='RUNNING',expiry='2026-10-26T22:31:02.925Z',cutoff='2026-10-26T21:50:00Z',shutdown='2026-10-26T22:00:00Z',handback='2026-10-26T21:55:00Z',shutdownOwner='coordinator',watchPID3114875='untouched',ownedLive=[]))
# Publication admission: include retained stage, prior task evidence, current remote/local, growth/positive WAL exactly once.
base=json.loads((O/'sqlite-baseline.json').read_text());sess=next(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'));L=ROOT/'scratch/usage-watch'/ID
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
clients=[]
for q in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(q/'cmdline').read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex') and b'wine-worker' in a:clients.append(dict(pid=int(q.name),rss=int((q/'statm').read_text().split()[1])*4096))
 except (OSError,ValueError):pass
growth=sum(max(0,335544320-x['rss']) for x in clients);required=(576+768+256+3*64+768)*2**20+growth
c=dict(retainedRemote=meta['retainedAllocated'],newRemote=meta['newRemoteAllocated'],previousLocal=allocated(PREV.parent),previousRemote=40960,localOwned=allocated(H),publicationDashboardGit=24*2**20,launcher=allocated(L)+sum(allocated(p) for p in L.parent.glob(L.name+'.*')),session=allocated(sess),positiveWALOnce=sum(max(0,allocated(pathlib.Path(p))-n) for p,n in base.items()),futureGrowth=16*2**20,reserve=8*2**20)
j=dict(charges=c,total=sum(c.values()),cap=201326592,memAvailable=mem,required=required,clients=clients,clientGrowth=growth,projectedHostFree=shutil.disk_usage(H).free-32*2**20,hostFloor=2982150144);j['passGate']=j['total']<=j['cap'] and mem>=required and j['projectedHostFree']>=j['hostFloor'];save('publication-admission.json',j);print(json.dumps(j),flush=True);assert j['passGate']
RUN.mkdir(parents=True)
for q in O.glob('*'):
 if q.is_file() and q.name not in ['host-import-sigs.generated.json','d3d-render-worker.js','board-watch.log'] and q.suffix in ['.json','.jsonl','.py','.cjs','.gz']:shutil.copy2(q,RUN/q.name)
shutil.copytree(O/'retained',RUN/'frames')
# Historical predecessor failure and source/fixture/module checks are retained without rewriting.
hist=RUN/'historical';hist.mkdir()
for n in ['retained/guest/output.log','retained/guest/terminal.json','supplementary-executable-manifest.json','required-exe-readback.json','final-accounting.json']:
 q=PREV/n
 if q.exists():shutil.copy2(q,hist/(n.replace('/','-')))
checkpoint=dict(sourceRevision='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2',moduleSHA256='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75',sourceFixtureMountCompileUnchanged=True,dependenciesTransferred=['src/api_table.json','lib/host-import-sigs.generated.json','lib/d3d-render-worker.js'],actualGuestExecuted=True,correctedBatches=2900,gameplayVerified=False,authenticGuestCrash=False,nextGate='Ordinary menu/mission/movement with coordinator-assigned remaining runtime; all retained exact source/module/exe and three dependency repairs reusable')
(RUN/'durable-checkpoint.json').write_text(json.dumps(checkpoint,indent=2)+'\n')
notes=REPO/'docs/re-notes'/ (ID+'.md');notes.parent.mkdir(parents=True)
notes.write_text('''# Alien Shooter pinned startup repair and actual guest attempt

The pinned production runner was inspected before launch. Transferred only three missing ordinary runtime dependencies using bounded API chunks, without build, full restage, module/guest patches or game reacquisition. The API table is723350 bytes SHA256562acd9c5870750d29cc88ed1ec12112c9da7164b8d9c3fe470a109842d39486 from the standing239 source manifest. The signature JSON is39713 bytes SHA2567515bd48d37588bb194c3d683969195ac379c340d0cc0abaddd493a556b25069, and d3d-render-worker.js has its exact hash/size in worker-manifest-addendum.json. Both additional dependencies were recovered from immutable source754c97d3 and matched the standing GL source manifest, not dirty root files. Remote readback identities and supplementary manifests are retained. The original executable, module and staged assets stayed unchanged. Historical preguest ENOENT is preserved separately.

Fresh full192MiB allocation admission and physical RAM/disk gates passed. The582 retained runtime files passed hash/size/mode verification;12 previously recorded compiler removals remained unchanged. Exact registered app parser and431 filename enumeration plus prior EXE supplement were reused; no filename-bearing mount flags changed. Exact Node24.22.1, heap2048MiB, preload, scrubbed environment and inherited CPU90/file24MiB limits passed. Node DATA/address-space stayed unlimited; Git DATA512MiB applied only to Git children.

The first actual guest acknowledged2150 batches and captured a black640x480 PNG. Dynamic software D3D worker creation still needed host-import-sigs.generated.json, despite the initial probe treating it as exclusive to optional worker flags. That probe interpretation was wrong; its failure is preserved. The guest printed repeated missing-signature errors and exited naturally after30.328334729 seconds. An Enter input was queued; the subsequent step2000 lost its connection and was never replayed. Raw requests/responses and original log are retained. The next preflight found the worker entrypoint itself absent; both ordinary dependencies were then repaired from verified immutable sources.

The corrected guest acknowledged2900 batches, serviced987 software D3D requests with5332ms renderer wait, and produced real SIGMA TEAM and ALIEN SHOOTER title frames. All three PNGs were personally inspected. Corrected output has no ENOENT or observed authentic guest trap. Parked EAX0x8876086c is not a completed LockRect result. No menu, mission, movement or combat acceptance is claimed.

The worker incorrectly queued quit after the third screenshot while runtime remained. This premature stop is a planning incident, not an authentic game failure or exhausted resource gate. Corrected guest elapsed37.325286551 seconds; aggregate67.653621280 leaves22.346378720 seconds of the original90-second total. A new cold run cannot reasonably reach gameplay inside the remainder when startup to title took37.325 seconds. No unchanged retry, extra capture, or extension was performed. Further runtime requires coordinator-assigned allowance; reuse the now-repaired retained stage.

Both invocations left no owned live processes. bx_a9dwsx2x remains RUNNING; expiry2026-10-26T22:31:02.925Z, coordinator shutdown22:00, cutoff21:50/handback21:55, watch3114875 untouched. No main merge, public deployment, Boat SSH, box lifecycle mutation, other game, worker launch or Claude action.

Reproduction recipes, exact argv, startup limits, full original diagnostics archive, control ACK records, hashes, admission and durable checkpoint: scratch/runs/alien-shooter-pinned-startup-gameplay-api-oct26. Archive contains only operational diagnostics, no guest bytes.
''')
result=dict(candidateId='reflexive-alien-shooter',agentId='codex:'+os.environ['CODEX_THREAD_ID'],startedAt='2026-10-26T21:31:12Z',finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),outcome='inconclusive',route='production registered alien_shooter CLI software',command=json.loads((O/'guest-remaining-args.json').read_text()),build=dict(commit=checkpoint['sourceRevision'],wasmSha256=checkpoint['moduleSHA256'],moduleVerified=True,runnerInvoked=True,guestExecuted=True),environment=dict(box=BOX,node='24.22.1',renderer='software explicitly scoped',viewport=dict(width=640,height=480)),summary='Three pinned startup omissions repaired; actual guest reaches title at2900 batches. Premature worker quit, no gameplay or authentic crash. All owned processes cleaned; RUNNING coordinator handback.',verification='reviewed',artifacts=[str(p.relative_to(RUN)) for p in RUN.rglob('*') if p.is_file()])
(RUN/'result.json').write_text(json.dumps(result,indent=2)+'\n')
p=subprocess.run(['node','--max-old-space-size=32',str(ROOT/'ops/check-run-evidence.js'),str(REPO)],capture_output=True,text=True,timeout=25);save('evidence-check.json',dict(exit=p.returncode,stdout=p.stdout,stderr=p.stderr));print(p.stdout,p.stderr,flush=True);assert p.returncode==0 and '"invalid": []' in p.stdout
shutil.copy2(O/'evidence-check.json',RUN/'evidence-check.json');shutil.copytree(RUN,ROOT/'scratch/runs'/ID)
git('init','-b','task/'+ID);git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git('add','docs','scratch');git('diff','--cached','--check');git('commit','-m','docs: preserve pinned Alien Shooter startup repair and guest title evidence');commit=git('rev-parse','HEAD');git('push','--set-upstream','origin','HEAD:refs/heads/task/'+ID);ref=git('ls-remote','--heads','origin','refs/heads/task/'+ID);assert ref.split()[0]==commit
save('publication.json',dict(commit=commit,remoteRef=ref,branch='task/'+ID,trustedSSH=SSH,normalPush=True));print('VERIFIED',commit,ref,flush=True)
