from ops import *
d=json.loads((E/'pins.json').read_text());assert time.time()<1793248200 # 04:07 UTC leaves cleanup margin
record('fixture',dict(sha256=hashlib.sha256((OWN/'fixture.py').read_bytes()).hexdigest(),ordinarySingleProcess=True,allocationBytes=96*1048576))
args=['/home/user/.ascii/boat','--json','new','--ttl','1800','--name','toyvm-rss-oct29']
files={str('/tmp/tvrss/dispatch.json'):E/'pins.json','/tmp/tvrss/remote_test.py':OWN/'remote_test.py','/tmp/tvrss/fixture.py':OWN/'fixture.py','/tmp/tvrss/cancellation.json':pathlib.Path(d['originalCancellationReceipt'])}
for rel in d['sourcePins']:files['/tmp/tvrss/repo/'+rel]=REPO/rel
for remote,local in files.items():args.extend(['--file',remote+'='+str(local)])
record('boat-file-argv',dict(argv=args,intendedFiles=[dict(remote=r,local=str(l),sha256=hashlib.sha256(l.read_bytes()).hexdigest()) for r,l in files.items()],commaBearingFiles=[r for r in files if ',' in r]))
rc,out,err=run(args,cwd=OWN,name='create',timeout=120)
ids=[]
for line in out.splitlines():
 try:obj=json.loads(line)
 except ValueError:continue
 def find(o):
  if isinstance(o,dict):
   for k,v in o.items():
    if k in ('id','sandboxId','sandbox_id') and isinstance(v,str) and v.startswith('bx_'):ids.append(v)
    else:find(v)
  elif isinstance(o,list):
   for v in o:find(v)
 find(obj)
assert len(set(ids))==1,(rc,out[:1000],err[:500])
box=ids[0];record('box',dict(id=box,ttl=1800,cutoff='2026-10-29T04:35:00Z',shutdownOwner='worker explicitly delegated snapshot-stop before handback'));print('created '+box+' exit '+str(rc))
