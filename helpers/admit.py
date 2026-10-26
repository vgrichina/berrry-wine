import pathlib,json,sys,datetime,shutil,os
from account import accounting,R
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
clients=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  args=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if '/bin/codex ' in args and (' exec ' in args or ' resume ' in args):
   rss=int(next(l.split()[1] for l in (d/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
   clients.append(dict(pid=int(d.name),rss=rss,argv=args[:2000]))
 except (OSError,StopIteration):pass
components=dict(guest=805306368,hostReserve=805306368,concurrentGL=268435456,remoteHelpers=3*67108864,prospectiveClient=335544320)
required=sum(components.values()); a=accounting(); future=33554432; free=shutil.disk_usage(R).free
o=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=sys.argv[1],memAvailable=mem,requiredMemAvailable=required,memoryComponents=components,residentClientsAlreadyDeducted=True,clients=clients,otherHeavyProcessesNotReserved='Prior CivII compile and GL heavy challenge completed/not currently running; full assigned GL task cap retained',accounting=a,futureIncluding8MiBReserve=future,totalProjection=a['total']+future,allocationCap=134217728,diskFree=free,projectedHostFree=free-future,requiredHostFree=2982150144,standingInputsReadonlyExcluded=True,remoteBytes=0,admitted=mem>=required and a['total']+future<=134217728 and free-future>=2982150144)
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(o,indent=2)+'\n');print(json.dumps({k:v for k,v in o.items() if k not in ['clients','accounting']}));sys.exit(0 if o['admitted'] else 1)
