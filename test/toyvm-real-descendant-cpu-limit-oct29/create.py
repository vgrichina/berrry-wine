from control import *
dispatch=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-descendant-cpu-limit-oct29-dispatch.json').read_text()); pins=dispatch['sourcePins'];(ROOT/'pins.json').write_text(json.dumps(pins))
r=pathlib.Path(dispatch['originalCancellationReceipt']).read_bytes();assert hashlib.sha256(r).hexdigest()==dispatch['originalCancellationReceiptPin']['sha256'];(ROOT/'receipt.json').write_bytes(r)
args=['/home/user/.ascii/boat','--json','new','--ttl','1800','--name','toyvm-descendant-cpu-oct29']
for rel in pins:args+=['--file','/tmp/tvdt/repo/'+rel+'='+str(REPO/rel)]
for name in ['pins.json','receipt.json','remote.py']:args+=['--file','/tmp/tvdt/'+name+'='+str(ROOT/name)]
_,a,b=run(args,cwd=ROOT,timeout=120)
(ROOT/'creation.jsonl').write_bytes(a)
boxes=[]
for line in a.decode().splitlines():
 try:obj=json.loads(line)
 except ValueError:continue
 def walk(v):
  if isinstance(v,dict):
   for k,w in v.items():
    if k in ('id','sandboxId') and isinstance(w,str) and w.startswith('bx_'):boxes.append(w)
    walk(w)
  elif isinstance(v,list):
   for w in v:walk(w)
 walk(obj)
assert len(set(boxes))==1, 'creation ID unknown; never retry'
box=boxes[0];(ROOT/'box-id.txt').write_text(box+'\n');print('BOX',box)
