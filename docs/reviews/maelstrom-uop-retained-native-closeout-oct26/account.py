import pathlib,json,time,shutil,sys
O=pathlib.Path(__file__).resolve().parent;H=O.parent;C=pathlib.Path('/home/user/.codex');L=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/H.name
alloc=lambda p:max(p.stat().st_size,p.stat().st_blocks*512)
def size(p):return sum(alloc(f) for f in p.rglob('*') if not f.is_symlink() and f.is_file())
sessions=list((C/'sessions/2026/10/26').glob('*01a1773f-421d-7421-b96e-3919826a8357.jsonl'));assert len(sessions)==1
base=json.load(open(O/'db-baseline.json'))
charges=dict(owned=size(H),launcher=size(L),session=sum(alloc(p) for p in sessions),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in base.items()),WALSHM=sum(alloc(p) for p in C.glob('*.sqlite-*')),remoteIncrementalBudget=2*1048576,futurePublication=3*1048576,futureSessionLauncherDB=6*1048576,reserve=8*1048576)
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free;peak=sum(charges.values());ok=peak<=67108864 and mem-536870912-16777216>=805306368 and free-sum(charges[k] for k in ['futurePublication','futureSessionLauncherDB','reserve'])>=2982150144
j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,client=536870912,heap=16777216,remainingFloor=805306368,diskFree=free,diskFloor=2982150144,standing='old local repo/ops and retained remote canonical source/binaries used in place, not copied; identities in reconcile and pinned checkpoints',passChecks=ok)
(O/(sys.argv[1] if len(sys.argv)>1 else 'resource-current.json')).write_text(json.dumps(j,indent=2));print(json.dumps(j));assert ok,'admission failed'
