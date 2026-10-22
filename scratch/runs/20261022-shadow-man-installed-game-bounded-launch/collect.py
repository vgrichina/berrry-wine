import sys,pathlib,json,base64,hashlib
from remote import *
code="""import pathlib,json,base64
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22/bounded-diagnostic');O=pathlib.Path('/home/user/shadow-man-install-quota-oct22/bounded-game');rows=[]
for base,prefix in [(R,'fixed'),(O,'raw')]:
 for p in base.iterdir():
  if p.is_file() and p.suffix in ['.json','.jsonl','.png','.log']:
   assert p.stat().st_size<2000000;rows.append(dict(path=prefix+'/'+p.name,data=base64.b64encode(p.read_bytes()).decode()))
print(json.dumps(rows))
"""
r=run(code,None,30)
rows=json.loads(r['stdout'])
for x in rows:
 p=E/x['path'];p.parent.mkdir(exist_ok=True);p.write_bytes(base64.b64decode(x['data']))
save('retrieval.json',dict(files=[dict(path=x['path'],size=(E/x['path']).stat().st_size,sha256=hashlib.sha256((E/x['path']).read_bytes()).hexdigest()) for x in rows]))
print('retrieved',len(rows))
