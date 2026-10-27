from work import *
from concurrent.futures import ThreadPoolExecutor
import tarfile
j=py('''import pathlib,json,hashlib,tarfile,os
h=pathlib.Path('''+repr(R)+''');t=h/'diagnostics.tar.gz';files=[h/'guest/command.json',h/'guest/terminal.json',h/'guest/output.log',h/'filename-enumeration.json',h/'closure.json',h/'pre-guest.json',h/'expected.json',h/'guest-invocation-once',h/'control-blocked']
files += [p for d in ['config','startup','control'] for p in (h/d).rglob('*') if p.is_file()]
with tarfile.open(t,'w:gz') as z:
 for p in files:
  if p.is_file():z.add(p,arcname=str(p.relative_to(h)),recursive=False)
rows=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  a=(p/'cmdline').read_bytes().split(b'\\0')
  if any(str(h/x).encode() in a for x in ['supervisor.py','phase.py','runner/test/run.js','runner/test/alien-gameplay-sequence.py']):rows.append(int(p.name))
 except OSError:pass
r=dict(bytes=t.stat().st_size,sha256=hashlib.file_digest(t.open('rb'),'sha256').hexdigest(),ownedLive=rows,allocated=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob('*')]),images=[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()) for p in (h/'guest').glob('*.png')]);print(json.dumps(r));assert not rows
''');save('collection-metadata.json',j);m=json.loads(j['stdout']);assert m['bytes']<=2*2**20

def chunk(off):
 j=py('import pathlib,base64;p=pathlib.Path('+repr(R+'/diagnostics.tar.gz')+');f=p.open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(5000)).decode())');return base64.b64decode(j['stdout'])
with ThreadPoolExecutor(max_workers=3) as ex:b=b''.join(ex.map(chunk,range(0,m['bytes'],5000)))
assert sha(b)==m['sha256'];p=O/'diagnostics.tar.gz';p.write_bytes(b)
with tarfile.open(p) as t:t.extractall(O/'collected',filter='data')
p=subprocess.run(['boat','--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0;save('box-handoff-state.json',json.loads(p.stdout));print(json.dumps(m),flush=True)
