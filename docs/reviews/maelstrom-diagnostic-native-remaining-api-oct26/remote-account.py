import pathlib,json,shutil,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops'
rows=[]
for p in H.rglob('*'):
 if p.is_file():
  s=p.stat();rows.append(dict(path=str(p.relative_to(H)),bytes=s.st_size,allocated=max(s.st_size,s.st_blocks*512)))
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free
approval=json.load(open(O/'local-stage-admission.json'));assert approval['passed'];assert time.time()-approval['at']<180
allocated=sum(r['allocated'] for r in rows);assert allocated<=10485760
j=dict(at=time.time(),memAvailable=mem,minimumMemory=2684354560,free=free,allocated=allocated,files=rows,localAdmissionPeak=approval['peak'],passed=mem>=2684354560 and free-67108864>=2982150144)
(O/('admission-'+str(time.time_ns())+'.json')).write_text(json.dumps(j,indent=2));print(json.dumps(dict(memAvailable=mem,free=free,allocated=allocated,passed=j['passed'])));assert j['passed']
