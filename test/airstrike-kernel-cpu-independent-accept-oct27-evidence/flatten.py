from pathlib import Path
seen=set()
def visit(p):
 p=p.resolve()
 if p in seen:return
 seen.add(p)
 f=p/'info/alternates'
 if f.exists():
  for l in f.read_text().splitlines():visit(Path(l) if l.startswith('/') else p/l)
visit(Path('/tmp/airstrike-cgroup-cpu-receipt-oct27/repo/.git/objects'))
Path('/tmp/airstrike-kernel-cpu-independent-accept-oct27/repo/.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(seen)))
print('direct read-only stores',len(seen))
