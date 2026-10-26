from ctl import *
from work import *
def step(n):
 assert 1<=n<=256;v=ctl(dict(action='step',n=n));assert v['ran']==n;s=ctl(dict(action='snapshot'));assert s['frozen']['frozen'] and s['frozen']['credits']==0;print(json.dumps(dict(ack=v,snapshot=s)),flush=True);return s
def inp(cmd):
 print(json.dumps(ctl(dict(cmd=cmd))),flush=True)
def fetch(name):
 j=py('import pathlib,json,hashlib;p=pathlib.Path('+repr(R+'/guest/'+name)+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))');m=json.loads(j['stdout']);assert m['bytes']<=2097152
 p=O/'retained'/name;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as f:
  for off in range(0,m['bytes'],5000):
   j=py('import pathlib,base64;f=pathlib.Path('+repr(R+'/guest/'+name)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(j['stdout']))
 assert sha(p.read_bytes())==m['sha256'];return str(p)
def capture(name):
 print(json.dumps(ctl(dict(action='png',path=R+'/guest/'+name))),flush=True);print(fetch(name),flush=True)
if __name__=='__main__':
 if sys.argv[1]=='step':
  total=int(sys.argv[2])
  while total: n=min(total,256);step(n);total-=n
 elif sys.argv[1]=='png':capture(sys.argv[2])
 elif sys.argv[1]=='input':inp(sys.argv[2])
 elif sys.argv[1]=='snapshot':print(json.dumps(ctl(dict(action='snapshot'))),flush=True)
 elif sys.argv[1]=='eval':print(json.dumps(ctl(dict(action='eval',code=sys.argv[2]))),flush=True)
 elif sys.argv[1]=='quit':print(ctl(dict(action='quit')))
