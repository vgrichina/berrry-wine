from work import *
from concurrent.futures import ThreadPoolExecutor

def phase(name,commands):
 j=remote('python3 '+shlex.quote(R+'/phase.py')+' '+shlex.quote(name)+' '+shlex.quote(json.dumps(commands)),timeout=30)
 save('phase-'+name+'.json',j);print(j['stdout'][:1200],flush=True);return j

def steps(n):
 a=[dict(action='snapshot')]
 while n:
  k=min(256,n);a.extend([dict(action='step',n=k),dict(action='snapshot')]);n-=k
 return a

def frame(name):return dict(action='png',path=R+'/guest/'+name+'.png')

def fetch(name):
 j=py('import pathlib,json,hashlib;p=pathlib.Path('+repr(R+'/guest/'+name+'.png')+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open("rb"),"sha256").hexdigest())))');m=json.loads(j['stdout']);assert m['bytes']<=2097152
 def chunk(off):
  v=py('import pathlib,base64;f=pathlib.Path('+repr(R+'/guest/'+name+'.png')+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');return base64.b64decode(v['stdout'])
 with ThreadPoolExecutor(max_workers=3) as ex:b=b''.join(ex.map(chunk,range(0,m['bytes'],5000)))
 assert sha(b)==m['sha256'];p=O/'frames'/ (name+'.png');p.parent.mkdir(exist_ok=True);p.write_bytes(b);save('frame-'+name+'.json',m);print(str(p),flush=True)

if __name__=='__main__':
 if sys.argv[1]=='fetch':fetch(sys.argv[2])
 elif sys.argv[1]=='step':phase(sys.argv[2],steps(int(sys.argv[3]))+([frame(sys.argv[4])] if len(sys.argv)>4 else []))
 elif sys.argv[1]=='input':phase(sys.argv[2],[dict(action='snapshot'),dict(cmd=sys.argv[3])]+steps(int(sys.argv[4]))+([frame(sys.argv[5])] if len(sys.argv)>5 else []))
 elif sys.argv[1]=='quit':phase('quit',[dict(action='snapshot'),dict(action='quit')])
 elif sys.argv[1]=='eval':phase(sys.argv[2],[dict(action='snapshot'),dict(action='eval',code=sys.argv[3])])
