from work import *
import base64
names=json.loads(py('import pathlib,json;h=pathlib.Path('+repr(R+'/ops/guest')+');print(json.dumps([dict(name=p.name,bytes=p.stat().st_size,sha256=__import__("hashlib").sha256(p.read_bytes()).hexdigest()) for p in h.iterdir() if p.is_file()]))')['stdout']);save('guest-file-manifest.json',names)
E=O/'guest';E.mkdir(exist_ok=True)
for x in names:
 assert x['bytes']<=2097152
 p=E/x['name']
 with p.open('wb') as f:
  for off in range(0,x['bytes'],4500):
   b=py('import pathlib,base64; p=pathlib.Path('+repr(R+'/ops/guest/'+x['name'])+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(4500)).decode())')['stdout'];f.write(base64.b64decode(b))
 assert p.stat().st_size==x['bytes'] and sha(p.read_bytes())==x['sha256']
print('COLLECTED',len(names),flush=True)
