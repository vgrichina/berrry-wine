from ops import *
box=json.loads((E/'box.json').read_text())['id']
rc,out,err=run(['/home/user/.ascii/boat','--json','stop',box],cwd=OWN,name='snapshot-stop',timeout=120)
print(json.dumps(dict(box=box,stopExit=rc,stdoutBytes=len(out),stderrBytes=len(err))))
assert rc==0
rc,out,err=run(['/home/user/.ascii/boat','--json','info',box],cwd=OWN,name='stopped-info',timeout=30)
info=json.loads(out)
def states(o):
 if isinstance(o,dict):
  for k,v in o.items():
   if k=='state':yield v
   else:yield from states(v)
 elif isinstance(o,list):
  for v in o:yield from states(v)
found=list(states(info));record('actual-stopped',dict(box=box,states=found,verified=any(x in ('stopped','STOPPED') for x in found),infoSHA256=hashlib.sha256(out.encode()).hexdigest()));print(json.dumps(dict(box=box,states=found)))
assert any(x in ('stopped','STOPPED') for x in found)
