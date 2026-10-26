exec(open('/tmp/alien-shooter-title-to-menu-gameplay-api-oct26/ops/control.py').read().split("if sys.argv[1]")[0])
import tarfile,io,datetime
j=w.py('''import pathlib,json,tarfile,hashlib
h=pathlib.Path('''+repr(w.R)+''');t=h/'diagnostics.tar.gz'
with tarfile.open(t,'w:gz') as out:
 for p in h.rglob('*'):
  if p.is_file() and p!=t:out.add(p,arcname=str(p.relative_to(h)),recursive=False)
print(json.dumps(dict(bytes=t.stat().st_size,sha256=hashlib.file_digest(t.open('rb'),'sha256').hexdigest(),terminal=json.loads((h/'guest/terminal.json').read_text()))))''');w.save('collection.json',j);m=json.loads(j['stdout']);assert m['bytes']<4*2**20
p=O/'diagnostics.tar.gz'
with p.open('wb') as f:
 for off in range(0,m['bytes'],5000):
  v=w.py('import pathlib,base64;f=pathlib.Path('+repr(w.R+'/diagnostics.tar.gz')+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(v['stdout']))
assert w.sha(p.read_bytes())==m['sha256']
D=O/'collected';D.mkdir(exist_ok=True)
with tarfile.open(p) as t:t.extractall(D,filter='data')
print(json.dumps(m),flush=True)
