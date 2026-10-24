from work import *
names=['preflight.json','tree-validation.json','watchdog-negative-control.json','guest/output.log','guest/command.json','guest/terminal.json','guest/menu.png','guest/play.png','guest/input.png']
j=py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');print(json.dumps([{ "path":n,"bytes":(h/n).stat().st_size} for n in '+repr(names)+' if (h/n).exists()]))')
save('collect-inventory-api.json',j);rows=json.loads(j['stdout']);total=75000
for row in rows:
 n=row['path'];length=row['bytes'];assert length<=524288
 chunks=[]
 for off in range(0,length,8192):
  size=min(8192,length-off);total+=size;assert total<=1048576
  code='import pathlib,base64;p=pathlib.Path('+repr(str(H/n))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read('+str(size)+')).decode())'
  j=py(code);chunks.append(base64.b64decode(j['stdout']))
 p=H/'collected'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b''.join(chunks));assert p.stat().st_size==length
save('capture-accounting.json',dict(prior=75000,collected=total-75000,total=total,cap=1048576,slice=8192,instructionReadCap=65536,instructionReadEstimate=30000))
cleanup='import os,pathlib,json,shutil;h=pathlib.Path('+repr(str(H))+');rows=[]\nfor d in pathlib.Path("/proc").iterdir():\n if d.name.isdigit():\n  try:\n   cmd=(d/"cmdline").read_bytes();\n   if b"node" in cmd and str(h).encode() in cmd: rows.append(dict(pid=int(d.name),cmd=cmd.decode(errors="replace")))\n  except (OSError,ProcessLookupError):pass\nprint(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,ownedBytes=sum(p.stat().st_size for p in h.rglob("*") if p.is_file()),taskNode=rows)))'
save('cleanup-api.json',py(cleanup));account('postguest')
print('collected',rows,flush=True)
