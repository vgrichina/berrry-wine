import pathlib,json,shlex,base64,hashlib
from api import api
O=pathlib.Path(__file__).parent;D=O/'retrieved';D.mkdir(exist_ok=True)
code='import pathlib,json,hashlib;O=pathlib.Path("/home/user/wineops-gta2-causal-trace-oct27/ops");print(json.dumps([dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in O.iterdir() if p.is_file()]))'
j=api('python3 -c '+shlex.quote(code));rows=json.loads(j['stdout']);assert sum(r['bytes'] for r in rows)<1048576
(O/'remote-inventory.json').write_text(json.dumps(rows,indent=2))
for r in rows:
 assert '/' not in r['name'] and '..' not in r['name']
 with (D/r['name']).open('xb') as out:
  for offset in range(0,r['bytes'],4000):
   code='import pathlib,base64;p=pathlib.Path("/home/user/wineops-gta2-causal-trace-oct27/ops")/'+repr(r['name'])+';f=p.open("rb");f.seek('+str(offset)+');print(base64.b64encode(f.read(4000)).decode());f.close()'
   q=api('python3 -c '+shlex.quote(code));out.write(base64.b64decode(q['stdout'].strip(),validate=True))
 assert (D/r['name']).stat().st_size==r['bytes'] and hashlib.sha256((D/r['name']).read_bytes()).hexdigest()==r['sha256']
print('verified remote files',len(rows),'bytes',sum(r['bytes'] for r in rows))
