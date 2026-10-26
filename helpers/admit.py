import sys,json,pathlib,shutil,datetime
from account import accounting
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-city-founding-gameplay-oct26')
a=accounting();future=40*1048576+32*1048576+8*1048576+8*1048576
free=shutil.disk_usage(R).free
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
clients=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
  if '/codex' in cmd and 'exec' in cmd:
   rss=int(next(l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024;clients.append(dict(pid=int(p.name),rss=rss))
 except (OSError,StopIteration):pass
r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,future=future,captures=41943040,publication=8388608,futureSessionEventsWAL=33554432,reserve=8388608,allocation=134217728,projected=a['total']+future,diskFree=free,projectedHostFree=free-future,hostFloor=2982150144,memAvailable=mem,requiredMemAvailable=3489660928,residentClients=clients,ramPolicy='Residents already deducted once; host768MiB guest768MiB other2Git512MiB each Enigma128MiB GLcontroller128MiB remaininggrowth; no prospective320MiB repeat')
r['admitted']=mem>=3489660928 and r['projected']<=134217728 and free-future>=2982150144
(R/(sys.argv[1]+'-admission.json')).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k not in ['accounting','residentClients']}));sys.exit(0 if r['admitted'] else 4)
