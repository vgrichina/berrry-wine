import pathlib,json,os,re,time,shutil
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex')
def alloc(p):
 if p.is_file():return max(p.stat().st_size,p.stat().st_blocks*512)
 return sum(max(x.stat().st_size,x.stat().st_blocks*512) for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else 0
def admit(label,remote=2000000,future=3000000):
 s=json.loads((O/'session.json').read_text());base=json.loads((O/'db-baseline.json').read_text());now={str(p):alloc(p) for p in C.glob('*.sqlite*')}
 charges=dict(localOwned=alloc(H),remoteOwnedProjection=remote,session=alloc(pathlib.Path(s['path'])),launcher=alloc(pathlib.Path(s['launcher'])),sharedWALSHM=sum(v for p,v in now.items() if p.endswith(('-wal','-shm'))),positiveDBgrowth=sum(max(0,v-base.get(p,0)) for p,v in now.items() if not p.endswith(('-wal','-shm'))),future=future,reserve=8388608,transferOverlap=262144,publicationFuture=750000)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 r=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,localFree=free,projectedFree=free-(remote+future+750000+262144),passAdmission=peak<=67108864 and mem>=1073741824 and free-(remote+future+750000+262144)>=2982150144)
 (O/('admission-'+label+'.json')).write_text(json.dumps(r,indent=2)+'\n');assert r['passAdmission'],r
 return r
if __name__=='__main__':print(json.dumps(admit(__import__('sys').argv[1])))
