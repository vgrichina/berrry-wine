from transport import *
import base64
names=['preflight.json','tree-validation.json','fresh-admission.json','guest/output.log','guest/command.json','guest/terminal.json']
j=py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');print(json.dumps([{ "path":n,"bytes":(h/n).stat().st_size} for n in '+repr(names)+' if (h/n).exists()]))')
save('collect-inventory-api.json',j);rows=json.loads(j['stdout']);total=0
for row in rows:
 n=row['path'];length=row['bytes'];assert length<=131072
 chunks=[]
 for off in range(0,length,8192):
  lengthSlice=min(8192,length-off);total+=lengthSlice;assert total<=2097152
  j=py('import pathlib,base64;p=pathlib.Path('+repr(str(H/n))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read('+str(lengthSlice)+')).decode())');chunks.append(base64.b64decode(j['stdout']))
 p=H/'collected'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b''.join(chunks));assert p.stat().st_size==length
save('capture-accounting.json',dict(collected=total,additionalAllowance=2097152,priorHistoricalChargesRetained=True,slice=8192,instructionReadCap=65536,codeReadCap=8192))
code='''import pathlib,os,json,shutil
h=pathlib.Path(ROOT);rows=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  cmd=(d/'cmdline').read_bytes().split(b'\\0');exe=pathlib.Path(os.readlink(d/'exe')).name
  if exe in ['node','nodejs'] and any(str(h).encode() in arg for arg in cmd):rows.append(dict(pid=int(d.name),cmd=[v.decode(errors='replace') for v in cmd]))
 except (OSError,ProcessLookupError):pass
print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage('/tmp').free,ownedBytes=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob('*') if p.is_file()),taskNode=rows)))
'''.replace('ROOT',repr(str(H)))
j=py(code);save('cleanup-api.json',j);assert not json.loads(j['stdout'])['taskNode']
print(json.dumps(dict(collection=True,bytes=total,taskNode=0)))
