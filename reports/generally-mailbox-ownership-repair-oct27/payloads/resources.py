from pathlib import Path
import os,json,time,sys
R=Path('/tmp/generally-mailbox-ownership-repair-oct27');O=R/'ops';M=1048576
baseline=json.loads((O/'admission.json').read_text())['walBaseline']
roots=[R,Path('/home/user/wine-assembly/scratch/usage-watch/generally-mailbox-ownership-repair-oct27'),Path('/home/user/.codex/sessions/2026/10/27/rollout-2026-10-27T13-49-26-01a17d9f-7b8d-7730-b898-99e8967a7ca5.jsonl')]
manifest=[]
for root in roots:
 for p in ([root]+list(root.rglob('*')) if root.is_dir() else [root]):
  s=p.lstat();manifest.append(dict(path=str(p),allocated=s.st_blocks*512,bytes=s.st_size))
wal={s:max(0,Path(s).stat().st_blocks*512-size) for s,size in baseline.items()}
measured=sum(x['allocated'] for x in manifest)+sum(wal.values())
reserve=dict(publication=16*M,eventsAndWAL=48*M,growth=32*M,reserve=8*M)
projected=measured+sum(reserve.values())
clients=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  if Path(os.readlink(p/'exe')).name=='codex':
   s=(p/'stat').read_text().split(') ',1)[1].split();clients.append(dict(pid=int(p.name),rss=max(0,int(s[21]))*4096))
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
avail=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
remaining=sum(max(0,320*M-x['rss']) for x in clients);needed=remaining+768*M+805306368
free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;future=960*M
result=dict(timestamp=time.time(),manifest=manifest,positiveWALGrowth=wal,measured=measured,reserves=reserve,projected=projected,allocation=256*M,available=avail,clients=clients,additionalClientGrowth=remaining,serializedChild=768*M,headroom=768*M,requiredAdditional=needed,freeDisk=free,aggregateFuture=future,projectedFree=free-future,diskFloor=2982150144,standingInputs='immutable donors, installed Node/Python/Git and original WAL bytes excluded, no copies hidden with links')
result['pass']=projected<=256*M and avail>=needed and free-future>=2982150144
(O/(sys.argv[1]+'.json')).write_text(json.dumps(result,indent=2))
print(json.dumps({k:result[k] for k in ('measured','projected','available','requiredAdditional','projectedFree','pass')}))
assert result['pass']
