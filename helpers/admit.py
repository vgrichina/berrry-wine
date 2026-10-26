import sys,json,pathlib,shutil,datetime,os
from account import accounting
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-complete-setup-map-gameplay-oct26')
a=accounting();future=83886080;free=shutil.disk_usage(R).free
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
clients=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if '/codex' in cmd and 'exec' in cmd and 'python3 -' not in cmd:
   rss=int(next(l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
   clients.append(dict(pid=int(p.name),rss=rss))
 except (OSError,StopIteration):pass
required=805306368+805306368+268435456+6*67108864+335544320
receipt=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,futureIncluding8MiBReserve=future,captureProjection=20*2097152,remotePublicationBound=8388608,remoteRuntimeBytes=0,allocation=201326592,projected=a['total']+future,diskFree=free,hostProjectedFree=free-future,hostRequiredFree=2982150144,memAvailable=mem,required=required,residentClientsAlreadyDeducted=clients,guestPhysicalCap=805306368,hostReserve=805306368,GLCap=268435456,remoteHelperCaps=402653184,prospectiveClientAllowance=335544320,completedHeavyReserved=0)
receipt['admitted']=mem>=required and a['total']+future<=201326592 and free-future>=2982150144
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['accounting','residentClientsAlreadyDeducted']}))
sys.exit(0 if receipt['admitted'] else 4)
