import json,os,sys,time,shutil
from pathlib import Path
H=Path(__file__).parent
TASK=H.parent
L=Path('/home/user/wine-assembly/scratch/usage-watch/enigma-staging-footprint-independent-accept-oct26')
SESSION=Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T07-31-25-01a1771f-08b3-7462-b9fb-752de0181e02.jsonl')
def alloc(p):
    seen=set(); total=0
    if not p.exists(): return 0
    for root,ds,fs in os.walk(p) if p.is_dir() else [(str(p.parent),[],[p.name])]:
        for q in ([Path(root)] if p.is_dir() else [])+[Path(root)/f for f in fs]:
            s=q.lstat(); key=(s.st_dev,s.st_ino)
            if key not in seen: total+=s.st_blocks*512;seen.add(key)
    return total
baseline=H/'sqlite-baseline.json'
if not baseline.exists():
    baseline.write_text(json.dumps({str(p):alloc(p) for p in Path('/home/user/.codex').glob('*sqlite*')}))
b=json.loads(baseline.read_text()); high=H/'sqlite-highwater.json'
delta=max(sum(max(0,alloc(Path(p))-v) for p,v in b.items()),json.loads(high.read_text()) if high.exists() else 0)
high.write_text(json.dumps(delta))
charges=dict(task=alloc(TASK),launcherSession=alloc(L)+alloc(SESSION)+sum(alloc(Path(str(L)+s)) for s in ['.task.txt','-admission.json']),positiveDBOnce=delta,futureSessionDB=12582912,futureFixtureGitEvidence=16777216,reserve=8388608)
mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
free=shutil.disk_usage(TASK).free
j=dict(phase=sys.argv[1],time=time.time(),charges=charges,peak=sum(charges.values()),cap=67108864,growth=58720256,memAvailable=mem,client=536870912,heap=16777216,memFloor=805306368,freeDisk=free,diskFloor=2982150144)
j['pass']=j['peak']<=67108864 and mem-536870912-16777216>=805306368 and free-58720256>=2982150144
(H/('admission-'+sys.argv[1]+'.json')).write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(j));assert j['pass']
