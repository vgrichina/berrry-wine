import pathlib,json,shutil,time,sys,os,hashlib,subprocess
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex');ROOT=pathlib.Path('/home/user/wine-assembly')
alloc=lambda p:max(p.stat().st_size,p.stat().st_blocks*512)
def size(root):
 return sum(alloc(p) for p in root.rglob('*') if not p.is_symlink() and p.is_file()) if root.exists() else 0
base=json.load(open(O/'sqlite-baseline.json'));launch=ROOT/'scratch/usage-watch'/H.name
ss=list((C/'sessions/2026/10/26').glob('*01a17673-51b6-7191-990e-3692c445aec6.jsonl'))
assert len(ss)==1,'exact actual session required'
charges=dict(owned=size(H),launcher=size(launch),session=sum(alloc(p) for p in ss),WALSHM=sum(alloc(p) for p in C.glob('*.sqlite-*')),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in base.items()),modulesFuture=0 if (O/'build-outputs.json').exists() else 4194304,publicationFuture=6291456,evidenceFuture=1048576,sessionDBfuture=4194304,reserve=8388608,board=8192)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
minimum=2684354560 if os.environ.get('HEAVY_STAGE')=='1' else 1073741824
j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,projectedFree=free-peak,diskFloor=2982150144,memAvailable=mem,minMem=minimum,passed=peak<=67108864 and free-peak>=2982150144 and mem>=minimum,standing='canonical compiler/source gzip/anchors/oracle/readonly flattened leaves and installed tools in place; zero copied standing bytes')
(O/('admission-'+os.environ.get('CASE_ID','current')+'.json')).write_text(json.dumps(j,indent=2));print(json.dumps(j));assert j['passed'],'actual admission failure; stop without retry'
