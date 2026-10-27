import pathlib,os,json,shutil,time
O=pathlib.Path('/tmp/ricochet-pinned-unlink-independent-accept-oct27/ops');H=pathlib.Path('/home/user');E=H/'wine-assembly/scratch/usage-watch/ricochet-pinned-unlink-independent-accept-oct27';M=1048576
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
 try:
  a=p.read_bytes().split(b'\0')
  if a and a[0].endswith(b'/codex') and b'exec' in a:
   rss=int(next(l.split()[1] for l in (p.parent/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
   clients.append(dict(pid=int(p.parent.name),rss=rss,prospective=max(0,320*M-rss)))
 except (OSError,ProcessLookupError):pass
def allocated(p):
 if p.is_file():return p.stat().st_blocks*512
 return sum(f.lstat().st_blocks*512 for f in p.rglob('*') if not f.is_symlink())
first=json.loads((E/'events.jsonl').open().readline());session=first['thread_id'];sessions=list((H/'.codex/sessions').rglob('*'+session+'*'));assert sessions
parts={'ownedRepoOps':allocated(O.parent),'externalLaunchEvents':allocated(E),'session':sum(allocated(p) for p in sessions)}
wal=H/'.codex/state_5.sqlite-wal';parts['fullCurrentWAL']=allocated(wal) if wal.exists() else 0
used=sum(parts.values());r=dict(at=time.time(),session=session,parts=parts,walAccounting='Unknown baseline; full WAL charged once',clients=clients,MemAvailable=mem,requiredRAM=sum(c['prospective'] for c in clients)+(256+768)*M,sharedPool=256*M,headroom=768*M,clientCeiling=320*M,allocation=128*M,localReserve=8*M,controlReserve=24*M,reportGitAndGrowth=32*M,margin=8*M,accounted=used+72*M,projectedFree=shutil.disk_usage(O).free-72*M,diskFloor=2982150144,sessionFiles=[str(p) for p in sessions])
r['passed']=r['accounted']<=r['allocation'] and r['projectedFree']>=r['diskFloor'] and mem>=r['requiredRAM'] and all(c['rss']<=320*M for c in clients)
(O/('admission-'+str(time.time_ns())+'.json')).write_text(json.dumps(r,indent=2));print(json.dumps(r));assert r['passed'],'fresh complete admission rejected'
