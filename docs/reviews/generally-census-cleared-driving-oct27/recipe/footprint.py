from common import *
import sys
def alloc(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')]) if p.is_dir() else p.stat().st_blocks*512
ep=ROOT/'scratch/usage-watch'/H.parent.name;ev=ep/'events.jsonl';tid=None
if ev.exists():
 with ev.open() as f:
  for line in f:
   q=json.loads(line)
   if q.get('thread_id'):tid=q['thread_id'];break
sessions=list(pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*')) if tid else []
wal={str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}
if not (H/'wal-baseline.json').exists():save('wal-baseline.json',wal)
base=json.loads((H/'wal-baseline.json').read_text());growth=sum(max(0,n-base.get(p,n)) for p,n in wal.items())
used=alloc(H.parent)+alloc(ep)+sum(alloc(p) for p in sessions)+growth
q=dict(at=time.time(),owned=alloc(H.parent),launcher=alloc(ep),sessions=[dict(path=str(p),bytes=alloc(p)) for p in sessions],positiveWalOnce=growth,total=used,localLimit=192*M,reserve=8*M,publicationAndControlGrowth=24*M,passGate=used+32*M<=192*M)
save('complete-footprint-'+sys.argv[1]+'.json',q);print(json.dumps(q));assert q['passGate'],q
