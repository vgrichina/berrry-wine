import sys,pathlib,json,base64,hashlib
H=pathlib.Path(__file__).parent;sys.path.insert(0,str(H));from transport import remote,R,save
def get(rel,dest):
 r=remote('import pathlib,sys,hashlib,json;p=pathlib.Path(sys.argv[1]);b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))',R+'/'+rel);s=json.loads(r['stdout']);assert s['bytes']<=4*1048576
 dest=pathlib.Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
 with dest.open('wb') as f:
  for i in range(0,s['bytes'],4500):
   r=remote('import pathlib,base64,sys;f=pathlib.Path(sys.argv[1]).open("rb");f.seek(int(sys.argv[2]));print(base64.b64encode(f.read(4500)).decode())',R+'/'+rel,str(i));f.write(base64.b64decode(r['stdout']))
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==s['sha256'];return dict(path=rel,**s)
if __name__=='__main__':
 for n in sys.argv[1:]:print(json.dumps(get('evidence/'+n,H/'remote'/n)))
