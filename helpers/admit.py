import sys,json,pathlib,shutil,datetime
from account import accounting
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-map-movement-gameplay-oct26')
a=accounting();future=115343360;free=shutil.disk_usage(R).free
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
clients=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if '/codex' in cmd and 'exec' in cmd:
   rss=int(next(l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
   clients.append(dict(pid=int(p.name),rss=rss))
 except (OSError,StopIteration):pass
required=3489660928
r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,futureIncluding8MiBReserve=future,captureProjection=20*2097152,remotePublicationBound=8388608,remoteRuntimeBytes=0,allocation=268435456,projected=a['total']+future,diskFree=free,hostProjectedFree=free-future,hostRequiredFree=2982150144,memAvailable=mem,required=required,residentClientsAlreadyDeducted=clients,guestPhysicalCap=805306368,hostReserve=805306368,GLGitCap=536870912,remoteHelperCaps=201326592,prospectiveClientAllowance=1140850688,completedHeavyReserved=0)
r['admitted']=mem>=required and r['projected']<=r['allocation'] and free-future>=2982150144
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:v for k,v in r.items() if k not in ['accounting','residentClientsAlreadyDeducted']}));sys.exit(0 if r['admitted'] else 4)
