from work import *
def fetch(name):
 j=py('import pathlib,json,hashlib; p=pathlib.Path('+repr(R+'/ops/'+name)+');b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))');meta=json.loads(j['stdout']);p=O/'remote'/name;p.parent.mkdir(parents=True,exist_ok=True)
 assert meta['bytes']<=25165824
 with p.open('wb') as f:
  for off in range(0,meta['bytes'],4096):
   j=py('import pathlib,json,base64;p=pathlib.Path('+repr(R+'/ops/'+name)+');f=p.open("rb");f.seek('+str(off)+');print(json.dumps(dict(data=base64.b64encode(f.read(4096)).decode())))');f.write(base64.b64decode(json.loads(j['stdout'])['data']))
 assert p.stat().st_size==meta['bytes'] and sha(p.read_bytes())==meta['sha256'];return dict(path=name,**meta)
if sys.argv[1]=='menu':
 gate('collect-menu');print(json.dumps(fetch('launch/controller/menu-candidate.png')));print(json.dumps(fetch('launch/controller/menu-candidate.png.json')));print(json.dumps(fetch('launch/controller/phase.json')))
elif sys.argv[1]=='decision':
 frame=json.loads((O/'remote/launch/controller/menu-candidate.png.json').read_text());d=dict(reviewed=True,safeStartGame=sys.argv[2]=='yes',frameSHA256=frame['sha256'],batch=frame['batch'])
 if d['safeStartGame']:d.update(x=int(sys.argv[3]),y=int(sys.argv[4]))
 save('decision.json',d);transfer([('ops/decision.json',O/'decision.json')]);print('decision delivered once',d)
elif sys.argv[1]=='all':
 gate('collect-all')
 j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R+'/ops')+');rows=[]\nfor p in sorted(h.rglob("*")):\n if p.is_file() and p.name not in ["runtime-map.json","expected-modes.json","parser-check.cjs","mount-enumeration.json"] and "__pycache__" not in str(p):rows.append(dict(path=str(p.relative_to(h)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))\n(h/"evidence-inventory.json").write_text(json.dumps(rows));print(json.dumps(dict(files=len(rows),bytes=sum(r["bytes"] for r in rows),inventoryBytes=(h/"evidence-inventory.json").stat().st_size)))')
 save('remote-inventory-summary.json',json.loads(j['stdout']));print(j['stdout']);fetch('evidence-inventory.json');rows=json.loads((O/'remote/evidence-inventory.json').read_text());assert sum(r['bytes'] for r in rows)<6*1048576
 for r in rows:
  p=O/'remote'/r['path']
  if p.is_file() and p.stat().st_size==r['bytes'] and sha(p.read_bytes())==r['sha256']:continue
  v=fetch(r['path']);assert v['sha256']==r['sha256']
 print('all bounded remote evidence collected',len(rows))
