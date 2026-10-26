import pathlib,json,shutil,time,os
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex');ROOT=pathlib.Path('/home/user/wine-assembly')
def alloc(p):
 s=p.lstat();return max(s.st_size,s.st_blocks*512)
def size(root):return sum(alloc(p) for p in root.rglob('*') if p.is_file() or p.is_symlink()) if root.exists() else 0
base=json.load(open(O/'sqlite-baseline.json'));launch=ROOT/'scratch/usage-watch'/H.name
ss=list((C/'sessions/2026/10/26').glob('*01a17680-4926-7db3-b46e-1ea30122518e.jsonl'));assert len(ss)==1
remote=10485760
if (O/'remote-size.json').exists():remote=max(remote,json.load(open(O/'remote-size.json'))['allocated']+2097152)
charges=dict(owned=size(H),launcher=size(launch),session=sum(alloc(p) for p in ss),WALSHM=sum(alloc(p) for p in C.glob('*.sqlite-*')),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in base.items()),remoteWithFuture=remote,publicationFuture=4194304,evidenceFuture=1048576,sessionDBfuture=4194304,reserve=8388608,board=8192)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,projectedFree=free-peak,diskFloor=2982150144,memAvailable=mem,minMem=805306368,passed=peak<=67108864 and free-peak>=2982150144 and mem>=805306368,standing='readonly donors/installations in place; lstat counts link bytes, never their targets')
(O/('admission-'+os.environ.get('CASE_ID','current')+'.json')).write_text(json.dumps(j,indent=2));print(json.dumps(j));assert j['passed'],'actual admission failure; stop without unchanged retry'
