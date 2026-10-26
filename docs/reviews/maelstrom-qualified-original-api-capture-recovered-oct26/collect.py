from common import *
import base64
s='''import pathlib,json,hashlib
H=pathlib.Path(%r);files=list((H/'guest').rglob('*'))
files += [H/'ops'/p for p in ['mount-enumeration.json','remote-inventory-latest.json','guest-invoked.json','startup/output.log','startup/command.json','startup/terminal.json','guest/output.log','guest/command.json','guest/terminal.json']]
rows=[]
for p in files:
 if not p.is_file():continue
 h=hashlib.sha256();f=p.open('rb')
 while b:=f.read(8192):h.update(b)
 rows.append(dict(path=str(p.relative_to(H)),bytes=p.stat().st_size,sha256=h.hexdigest()))
assert sum(x['bytes'] for x in rows)<=2097152
print(json.dumps(rows))
'''%str(H)
rows=json.loads(py(s)['stdout']);save('collected-manifest.json',rows)
for row in rows:
 p=O/'collected'/row['path'];p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as out:
  for off in range(0,row['bytes'],4096):
   s='import pathlib,base64;p=pathlib.Path('+repr(str(H/row['path']))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(4096)).decode())'
   b=base64.b64decode(py(s)['stdout']);assert len(b)==min(4096,row['bytes']-off);out.write(b)
 assert sha(p.read_bytes())==row['sha256']
print(json.dumps(dict(files=len(rows),bytes=sum(x['bytes'] for x in rows),hashesVerified=True)))
