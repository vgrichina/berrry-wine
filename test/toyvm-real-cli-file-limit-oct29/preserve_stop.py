from control import *
import base64
box=json.loads((ROOT/'box.json').read_bytes())['id']
code='import pathlib,json,base64; p=pathlib.Path("/tmp/tvfile"); print(json.dumps({n:base64.b64encode((p/n).read_bytes()).decode() for n in ["runtime.json","cli.stdout","cli.stderr","remote-preflight.json"]}))'
rc,out,err=run(['/home/user/.ascii/bin/boat','--no-update','--json','exec','--timeout','10',box,'--','/usr/bin/python3','-B','-c',code],cwd=REPO,label='preserve')
assert rc==0
result=json.loads(out)
def strings(x):
 if isinstance(x,dict):
  for v in x.values():yield from strings(v)
 elif isinstance(x,list):
  for v in x:yield from strings(v)
 elif isinstance(x,str):yield x
payload=None
for s in strings(result):
 try:
  j=json.loads(s)
  if isinstance(j,dict) and 'runtime.json' in j:payload=j
 except ValueError:pass
if payload is None and 'runtime.json' in result:payload=result
assert payload is not None
ev=ROOT/'remote-evidence';ev.mkdir()
for n,v in payload.items():(ev/n).write_bytes(base64.b64decode(v))
assert sum(p.stat().st_size for p in ev.iterdir())<1048576
rc,_,_=run(['/home/user/.ascii/bin/boat','--no-update','--json','stop',box],cwd=REPO,label='stop');assert rc==0
rc,out,err=run(['/home/user/.ascii/bin/boat','--no-update','--json','info',box],cwd=REPO,label='stopped');assert rc==0
j=json.loads(out);s=j['sandbox'];assert s['state']=='stopped' and s['stop']['status']=='completed' and s['snapshotAvailable'] and s['lastSnapshotStatus']=='completed'
(ROOT/'lifecycle.json').write_text(json.dumps(dict(box=box,state=s['state'],expiry=s['archiveAfter'],ttl=s['ttlSeconds'],stoppedAt=s['stoppedAt'],snapshotAvailable=s['snapshotAvailable'],snapshotCompletedAt=s['snapshotCompletedAt'],stop=s['stop'],shutdownReceipt='stopped.stdout'),indent=2)+'\n')
r=json.loads((ev/'runtime.json').read_bytes())
print(json.dumps(dict(PASS=r['PASS'],box=box,state=s['state'],failure=r['cli'].get('backendReceipt',{}).get('filesystem',{}))))
