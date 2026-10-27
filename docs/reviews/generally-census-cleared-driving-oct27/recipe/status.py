from common import *
import sys
tag=sys.argv[1]
code='''import pathlib,json,hashlib,time,os
r=pathlib.Path(BASE);h=r/'ops';names=['compile-attempt.json','compile-supervision.json','compile.stdout','compile.stderr','compile-launch.stdout','compile-launch.stderr','guest-attempt.json','guest-supervision.json','terminal.json','launch.json']
v={}
for n in names:
 p=h/n
 if p.exists():
  b=p.read_bytes();v[n]=dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),text=b.decode(errors='replace')[-1400:] if n.endswith(('.json','.stderr')) else None)
v['remoteAllocated']=sum(p.stat().st_blocks*512 for p in r.rglob('*') if p.is_file());v['moduleExists']=(r/'runner/build/wine-assembly.wasm').exists();v['at']=time.time();print(json.dumps(v))
'''.replace('BASE',repr(REMOTE))
x=py('status-'+tag,code);save('status-'+tag+'.json',json.loads(x['stdout']));print(x['stdout'][:5500])
