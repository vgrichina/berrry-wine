from work import *
# Collect bounded durable artifacts once; no execution or second guest.
info=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');files=[p for p in (h/"guest").rglob("*") if p.is_file()];print(json.dumps([dict(path=str(p.relative_to(h)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]))')
save('guest-artifact-inventory-api.json',info);rows=json.loads(info['stdout']);save('guest-artifact-inventory.json',rows)
for row in rows:
 assert row['bytes']<=(2097152 if row['path'].endswith('.png') else 131072),row
 target=H/'retained'/row['path'];target.parent.mkdir(parents=True,exist_ok=True)
 with target.open('wb') as f:
  for off in range(0,row['bytes'],18000):
   code='import pathlib,base64;f=open('+repr(R+'/'+row['path'])+',"rb");f.seek('+str(off)+');print(base64.b64encode(f.read(18000)).decode())'
   j=py(code);f.write(base64.b64decode(j['stdout'].strip()))
 assert target.stat().st_size==row['bytes'] and sha(target.read_bytes())==row['sha256']
# Bounded streaming collection of helper receipts; do not print payloads.
for name in ['preflight.json','tree-validation.json.gz']:
 meta=json.loads(py('import pathlib,json,hashlib;p=pathlib.Path('+repr(R+'/'+name)+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))')['stdout'])
 assert meta['bytes']<=262144
 p=H/'retained'/name;p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as f:
  for off in range(0,meta['bytes'],18000):
   j=py('import base64;f=open('+repr(R+'/'+name)+',"rb");f.seek('+str(off)+');print(base64.b64encode(f.read(18000)).decode())');f.write(base64.b64decode(j['stdout'].strip()))
 assert sha(p.read_bytes())==meta['sha256']
cleanup=py('import pathlib,json,subprocess;h=pathlib.Path('+repr(R)+');r=subprocess.run(["ps","-eo","pid,ppid,pgid,args"],capture_output=True,text=True);lines=[l for l in r.stdout.splitlines() if "node" in l and '+repr(R+'/runner/test/run.js')+' in l and "python3 -c" not in l];print(json.dumps(dict(taskNode=lines,guestDirectory=str(h/"guest"),dependentExists=(h/"guest/dependent-after-supervisor").exists(),terminalExists=(h/"guest/terminal.json").exists(),captureTerminalExists=(h/"guest/capture-terminal.json").exists())))')
save('ops/cleanup-api.json',cleanup);assert not json.loads(cleanup['stdout'])['taskNode']
save('ops/box-handback.json',json.loads(subprocess.check_output([B,'--no-update','--json','info',BOX])))
measure('post-guest');print('BOUNDED ARTIFACTS COLLECTED AND HASH VERIFIED; owned guest nodes absent; box lifecycle untouched')
