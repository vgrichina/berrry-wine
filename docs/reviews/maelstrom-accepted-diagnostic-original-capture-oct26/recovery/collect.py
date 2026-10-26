import pathlib,json,base64,zlib,shlex
from common import *
names=['tree-validation.json','watchdog-negative-control.json','output-control/receipt.json','guest/command.json','guest/terminal.json','guest/output.log','guest/native.jsonl','guest/native.jsonl.raw.jsonl']
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');names='+repr(names)+';print(json.dumps([dict(path=n,bytes=(h/n).stat().st_size,sha256=hashlib.sha256((h/n).read_bytes()).hexdigest()) for n in names if (h/n).exists()]))');save('collect-inventory-api.json',j);inventory=json.loads(j['stdout']);assert sum(x['bytes'] for x in inventory)<=2097152
for x in inventory:
 assert x['bytes']<=131072,x
 b=b''
 for off in range(0,x['bytes'],48000):
  code='import pathlib,base64,zlib;p=pathlib.Path('+repr(str(H/x['path']))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(zlib.compress(f.read(48000))).decode())'
  j=py(code);b+=zlib.decompress(base64.b64decode(j['stdout'].strip()))
 assert len(b)==x['bytes'] and sha(b)==x['sha256'];p=O/'collected'/x['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
save('collected-manifest.json',inventory)
terminal=json.load(open(O/'collected/guest/terminal.json'));raw=[];native=[]
for name,dest in [('guest/native.jsonl.raw.jsonl',raw),('guest/native.jsonl',native)]:
 p=O/'collected'/name
 if p.exists():dest.extend(json.loads(line) for line in p.read_text().splitlines())
save('checkpoint-guest.json',dict(attempts=1,terminal=terminal,raw=raw,native=native))
j=py('import pathlib,os,json;h=pathlib.Path('+repr(str(H))+');owned=[]\nfor p in pathlib.Path("/proc").iterdir():\n if not p.name.isdigit():continue\n try:\n  cmd=(p/"cmdline").read_bytes().replace(b"\\0",b" ").decode(errors="replace")\n  if '+repr(str(H/'runner/test/run.js'))+' in cmd and cmd.split()[0].split("/")[-1]=="node" and int(p.name)!=os.getpid():owned.append(dict(pid=int(p.name),cmd=cmd[:400]))\n except (FileNotFoundError,PermissionError,ProcessLookupError):pass\nprint(json.dumps(dict(ownedGuests=owned,box="bx_7qwjxps7",state="RUNNING",lifecycle="leave running; coordinator shutdown05:50UTC",expiry="2026-10-26T06:06:24.385Z",allocated=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob("*") if p.is_file()))))');save('cleanup-api.json',j)
rr=json.loads(j['stdout']);assert not rr['ownedGuests'];assert terminal['remainingGroup']==False
account('postguest',rr['allocated']);print(json.dumps(dict(terminal=terminal,nativeRecords=len(native),rawStages=[r.get('stage') for r in raw])))
