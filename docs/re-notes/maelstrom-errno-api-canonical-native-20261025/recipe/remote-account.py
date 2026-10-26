import pathlib,json,shutil,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops'
rows=[]
for p in H.rglob('*'):
 if p.is_file():
  s=p.stat();rows.append(dict(path=str(p),bytes=s.st_size,allocated=max(s.st_size,s.st_blocks*512)))
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free
approval=json.load(open(O/'local-stage-admission.json'));assert approval['passChecks'];assert time.time()-approval['at']<180
allocated=sum(r['allocated'] for r in rows);assert allocated<=approval['charges']['remoteTotalIncludingFutures']
d=dict(at=time.time(),memAvailable=mem,minimumMemory=2684354560,free=free,allocated=allocated,localAdmissionPeak=approval['peak'],localAdmissionAt=approval['at'],localCap=approval['cap'],files=rows,passChecks=mem>=2684354560 and free-67108864>=2982150144)
(O/('admission-'+str(time.time_ns())+'.json')).write_text(json.dumps(d,indent=2));assert d['passChecks'];print(json.dumps({k:d[k] for k in ['memAvailable','free','allocated','localAdmissionPeak','passChecks']}))
