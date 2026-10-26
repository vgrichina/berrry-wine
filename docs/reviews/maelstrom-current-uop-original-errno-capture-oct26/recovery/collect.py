from common import *
import base64,zlib
names=['tree-validation.json','ops/guest/command.json','ops/guest/terminal.json','ops/guest/output.log','guest/native.jsonl','guest/native.jsonl.raw.jsonl']
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');names='+repr(names)+';print(json.dumps([dict(path=n,bytes=(h/n).stat().st_size,sha256=hashlib.sha256((h/n).read_bytes()).hexdigest()) for n in names if (h/n).exists()]))');save('collect-inventory-api.json',j);inventory=json.loads(j['stdout']);assert sum(x['bytes'] for x in inventory)<=2097152
for row in inventory:
 assert row['bytes']<=131072
 p=O/'collected'/row['path'];p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('wb') as out:
  for off in range(0,row['bytes'],18000):
   j=py('import pathlib,zlib,base64;p=pathlib.Path('+repr(str(H/row['path']))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(zlib.compress(f.read(18000))).decode())');out.write(zlib.decompress(base64.b64decode(j['stdout'])))
 assert p.stat().st_size==row['bytes'] and sha(p.read_bytes())==row['sha256']
save('collected-manifest.json',inventory)
j=py('import pathlib,json,os;h='+repr(str(H))+';owned=[]\nfor p in pathlib.Path("/proc").iterdir():\n if not p.name.isdigit():continue\n try:\n  c=(p/"cmdline").read_bytes().replace(b"\\0",b" ").decode(errors="replace")\n  if h in c and c.split()[0].split("/")[-1] in ["node","python3"] and int(p.name)!=os.getpid():owned.append(dict(pid=int(p.name),cmd=c[:400]))\n except (FileNotFoundError,PermissionError,ProcessLookupError):pass\nprint(json.dumps(dict(owned=owned,box="bx_vs4xtsz3",state="RUNNING",shutdownOwner="coordinator",guestCutoff="2026-10-26T10:00:00Z",handback="2026-10-26T10:05:00Z",shutdown="2026-10-26T10:10:00Z",expiry="2026-10-26T10:32:43.299Z")))');save('handback-process-api.json',j);r=json.loads(j['stdout']);assert not r['owned']
j=py('import pathlib,json;h=pathlib.Path("/home/user/.ascii/processes");files=[p for p in h.rglob("*") if p.lstat().st_mtime>1793007420];a=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512);print(json.dumps(dict(files=len(files),allMetadataAllocated=sum(a(p) for p in files),basis="all process artifacts since worker launch conservatively includes coordinator")))');save('remote-process-artifacts.json',json.loads(j['stdout']))
rr=remoteInventory();save('remote-final.json',rr);account('postguest',rr['allocated']+json.loads(j['stdout'])['allMetadataAllocated'],rr['allocated']+json.loads(j['stdout'])['allMetadataAllocated'])
print(json.dumps(dict(collected=len(inventory),noOwnedProcesses=True,box=BOX,state='RUNNING')))
