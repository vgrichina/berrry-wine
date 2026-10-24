from work import *
names=['preflight.json','tree-validation.json','watchdog-negative-control.json','output-control/receipt.json','guest/output.log','guest/command.json','guest/terminal.json','guest/menu.png','guest/play.png','guest/input.png']
j=py('import pathlib,json;h=pathlib.Path('+repr(str(H))+');print(json.dumps([{ "path":n,"bytes":(h/n).stat().st_size} for n in '+repr(names)+' if (h/n).exists()]))')
save('collect-inventory-api.json',j);rows=json.loads(j['stdout']);total=200000
for row in rows:
 n=row['path'];length=row['bytes'];assert length<=131072
 chunks=[]
 for off in range(0,length,8192):
  lengthSlice=min(8192,length-off);total+=lengthSlice;assert total<=1048576
  j=py('import pathlib,base64;p=pathlib.Path('+repr(str(H/n))+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read('+str(lengthSlice)+')).decode())');chunks.append(base64.b64decode(j['stdout']))
 p=H/'collected'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b''.join(chunks));assert p.stat().st_size==length
save('capture-accounting.json',dict(priorConservative=200000,collected=total-200000,total=total,cap=1048576,slice=8192,instructionReadCap=65536,instructionReadEstimate=4096,codeSliceCap=8192))
code='''import pathlib,os,json,shutil
h=pathlib.Path(ROOT);rows=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  cmd=(d/'cmdline').read_bytes().split(b'\\0');exe=pathlib.Path(os.readlink(d/'exe')).name
  if exe in ['node','nodejs'] and any(str(h).encode() in arg for arg in cmd):rows.append(dict(pid=int(d.name),cmd=cmd))
 except (OSError,ProcessLookupError):pass
print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage('/tmp').free,ownedBytes=sum(p.stat().st_size for p in h.rglob('*') if p.is_file()),taskNode=rows)))
'''.replace('ROOT',repr(str(H)))
save('cleanup-api.json',py(code));assert not json.loads(json.load(open(H/'cleanup-api.json'))['stdout'])['taskNode']
account('postguest');print('collection/cleanup PASS')
