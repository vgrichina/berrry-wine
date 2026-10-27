import pathlib,json,time,os
h=pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27');s=json.loads((h/'guest/supervision.json').read_text());owned=[]
paths={str(h/n) for n in ['remote-supervisor.py','remote-child.py','serial.py']}|{'/tmp/ricochet-cleanup-round-play-oct27/runner/test/run.js'}
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\0');a=[x.decode(errors='replace') for x in a if x]
  if any(x in paths for x in a):owned.append(dict(pid=int(p.name),argv=a))
 except (FileNotFoundError,ProcessLookupError):pass
j=dict(at=time.time(),ownedLive=owned,cleanupComplete=s['cleanupComplete'] and not owned,box='bx_e9mecsag',state='RUNNING',expiry='2026-10-27T09:43:37Z',shutdownOwner='coordinator',stagedFilesPreserved=True,noSignalsSentByCleanup=True,platform={str(p):p.read_text().strip() for p in [pathlib.Path('/sys/fs/cgroup/memory.max'),pathlib.Path('/sys/fs/cgroup/cpu.max')] if p.exists()})
(h/'owned-cleanup.json').write_text(json.dumps(j));print(json.dumps(j));assert j['cleanupComplete']
