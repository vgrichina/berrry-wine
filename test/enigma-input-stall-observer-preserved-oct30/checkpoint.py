import pathlib,json,os,time,sys
O=pathlib.Path(__file__).resolve().parents[2].parent
f=json.loads((O/'coordinator-allocation-forecast.json').read_text())
E=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/O.name
ids={json.loads(l)['thread_id'] for l in (E/'events.jsonl').open() if json.loads(l).get('type')=='thread.started'}
assert len(ids)==1
roots=set(f['roots'])|{str(p) for id in ids for p in pathlib.Path('/home/user/.codex/sessions/2026/10/30').glob('*'+id+'*')}
seen=set();used=0
for r in roots:
 p=pathlib.Path(r)
 for q in ([p]+list(p.rglob('*')) if p.is_dir() else [p]):
  try:s=q.lstat()
  except FileNotFoundError:continue
  key=(s.st_dev,s.st_ino)
  if key not in seen:seen.add(key);used+=s.st_blocks*512
v=os.statvfs(O);free=v.f_bavail*v.f_frsize
rec=dict(at=time.time(),roots=sorted(roots),used=used,forecast=used+16777216,cap=67108864,workReserve=8388608,publicationReserve=8388608,hostFree=free,futureGrowth=267292672,hostFloor=1610612736,RAMAdmission=False,MemAvailable=next(l for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')),PASS=used+16777216<=67108864 and free-267292672>=1610612736)
(O/('allocation-'+sys.argv[1]+'.json')).write_text(json.dumps(rec,indent=2)+'\n')
print(json.dumps({k:v for k,v in rec.items() if k!='roots'}));assert rec['PASS']
