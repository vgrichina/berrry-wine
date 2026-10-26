from ctl import *
from work import *
def step(n):
 v=ctl(dict(action='step',n=n));s=ctl(dict(action='snapshot'));assert s['frozen']['credits']==0;print(json.dumps(dict(ack=v,snapshot=s)),flush=True);return s
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
 if sys.argv[1]=='launch':
  r=py('import pathlib,json,shutil,hashlib;h=pathlib.Path("/tmp/alien-shooter-current-gameplay-api-oct26");print(json.dumps(dict(memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free,wasm=hashlib.file_digest((h/"current.wasm").open("rb"),"sha256").hexdigest(),exe=hashlib.file_digest((h/"runner/test/binaries/candidates/reflexive-alien-shooter/game/AlienShooter.exe").open("rb"),"sha256").hexdigest())))');save('immediate-preguest-readback.json',r);v=json.loads(r['stdout']);assert v['memAvailable']>=3758096384 and v['free']-201326592>=2982150144
  m=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;assert m>=2483027968 and shutil.disk_usage(H).free-36*2**20>=2982150144
  save('guest-detach.json',remote('python3 '+shlex.quote(R+'/supervisor.py')+' guest',detach=True));time.sleep(.4);print(ctl(dict(action='snapshot')),flush=True);step(50);inp('dlg-click:1');step(100);print('READY NEXT',flush=True)
 elif sys.argv[1]=='step':step(int(sys.argv[2]))
 elif sys.argv[1]=='png':capture(sys.argv[2])
 elif sys.argv[1]=='input':inp(sys.argv[2])
 elif sys.argv[1]=='quit':print(ctl(dict(action='quit')))
