from work import *
j=py('''import pathlib,json,hashlib,tarfile,os
h=pathlib.Path('''+repr(R)+''');t=h/'diagnostics.tar.gz';files=[h/'guest/command.json',h/'guest/terminal.json',h/'guest/output.log',h/'filename-enumeration.json',h/'closure.json',h/'pre-guest.json',h/'expected-with-executable.json',h/'guest-invocation-once']
files += [p for d in ['config','startup'] for p in (h/d).glob('*') if p.is_file()]
files += list(h.glob('ctl-*.json'))
with tarfile.open(t,'w:gz') as z:
 for p in files:
  if p.is_file():z.add(p,arcname=str(p.relative_to(h)),recursive=False)
rows=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\\0')
  if str(h/'supervisor.py').encode() in a or str(h/'runner/test/run.js').encode() in a:rows.append(int(p.name))
 except OSError:pass
r=dict(bytes=t.stat().st_size,sha256=hashlib.file_digest(t.open('rb'),'sha256').hexdigest(),ownedLive=rows,allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),images=[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()) for p in (h/'guest').glob('*.png')]);print(json.dumps(r));assert not rows
''');save('collection-metadata.json',j);m=json.loads(j['stdout']);assert m['bytes']<=2*2**20
p=O/'diagnostics.tar.gz'
with p.open('wb') as f:
 for off in range(0,m['bytes'],5000):
  j=py('import pathlib,base64;p=pathlib.Path('+repr(R+'/diagnostics.tar.gz')+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');f.write(base64.b64decode(j['stdout']))
assert sha(p.read_bytes())==m['sha256']
import tarfile
with tarfile.open(p) as t:t.extractall(O/'collected',filter='data')
p=subprocess.run(['boat','--no-update','--json','exec','--status',json.loads((O/'guest-detach.json').read_text())['commandId'],BOX],capture_output=True,text=True,timeout=30)
save('guest-api-status.json',dict(exit=p.returncode,stdout=p.stdout[:8192],stderr=p.stderr[:8192]))
p=subprocess.run(['boat','--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0;save('box-handoff-state.json',json.loads(p.stdout));print('collected',m,flush=True)
