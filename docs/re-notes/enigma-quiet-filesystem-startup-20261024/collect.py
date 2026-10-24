from work import *
names=['preflight.json','tree-validation.json.gz','guest/output.log','guest/command.json','guest/terminal.json','guest/startup.png']
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(R)+');print(json.dumps([dict(path=n,bytes=(h/n).stat().st_size,sha256=hashlib.sha256((h/n).read_bytes()).hexdigest()) for n in '+repr(names)+' if (h/n).exists()]))');save('collect-inventory.json',j);rows=json.loads(j['stdout']);total=0
for row in rows:
 n=row['path'];length=row['bytes'];assert length<=393216
 data=bytearray()
 for off in range(0,length,8192):
  count=min(8192,length-off);total+=count;assert total<=650000
  r=py('import pathlib,base64;p=pathlib.Path('+repr(R+'/'+n)+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read('+str(count)+')).decode())');data.extend(base64.b64decode(r['stdout']))
 p=H/'collected'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);assert len(data)==length and sha(data)==row['sha256']
code='''import pathlib,os,json,shutil
h=pathlib.Path(ROOT);rows=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  cmd=(d/'cmdline').read_bytes().split(b'\\0');exe=pathlib.Path(os.readlink(d/'exe')).name
  if exe in ['node','nodejs'] and any(str(h).encode() in a for a in cmd):rows.append(dict(pid=int(d.name),cmd=[x.decode(errors='replace') for x in cmd]))
 except (OSError,ProcessLookupError):pass
print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage('/tmp').free,ownedBytes=sum(p.stat().st_blocks*512 for p in [h,*h.rglob('*')]),taskNode=rows)))
'''.replace('ROOT',repr(R))
save('cleanup-api.json',py(code));assert not json.loads(json.load(open(H/'cleanup-api.json'))['stdout'])['taskNode']
r=subprocess.run([B,'--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);save('box-handback.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,lifecycle='leave RUNNING; coordinator owns shutdown10:42UTC',expiry='2026-10-24T10:47:44Z'));assert r.returncode==0
measure('postcollect');print('collected exact bytes',total)
