import remote,pathlib,json,base64,hashlib,subprocess
E=remote.E;Q='/home/user/shadow-man-bounded-runtime/shadow-man-top-level-ui-capture-oct22'
r=remote.run((E/'handback.py').read_text(),'handback-api.json',30);remote.save('handback.json',json.loads(r['stdout']))
code="""import pathlib,json,hashlib
O=pathlib.Path(%r)
rows=[]
for p in sorted(O.iterdir()):
 if not p.is_file():continue
 rows.append(dict(path=p.name,size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
print(json.dumps(rows))
"""%Q
r=remote.run(code,'inventory-api.json');rows=json.loads(r['stdout']);remote.save('runtime-inventory.json',dict(files=rows));(E/'raw').mkdir(exist_ok=True)
for row in rows:
 assert row['size']<4194304,row
 data=bytearray()
 for pos in range(0,row['size'],45000):
  code="import pathlib,base64;p=pathlib.Path(%r);f=p.open('rb');f.seek(%d);print(base64.b64encode(f.read(45000)).decode())"%(Q+'/'+row['path'],pos)
  r=remote.run(code);assert not r.get('stdoutTruncated');data.extend(base64.b64decode(r['stdout']))
 assert len(data)==row['size'] and hashlib.sha256(data).hexdigest()==row['sha256']
 (E/'raw'/row['path']).write_bytes(data)
p=subprocess.run(['boat','--json','info',remote.BOX],capture_output=True,text=True);assert p.returncode==0;remote.save('box-final.json',json.loads(p.stdout))
protected=json.loads((E/'protected-before.json').read_text());after={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in protected};assert after==protected;remote.save('protected-after.json',after)
print('COLLECTED',len(rows),'root diagnostic files',sum(r['size'] for r in rows),'bytes; backup preserved; group absent')
