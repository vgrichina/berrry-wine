from common import *
code='''import pathlib,json,hashlib,tarfile,os,time
h=pathlib.Path(ROOT)
names=['compile-startup-start.json','compile-startup-receipt.json','compile-startup.stdout','compile-startup.stderr','compile-startup-supervisor-output','canonical-compile-once.json','compile-start.json','compile-receipt.json','compile.stdout','compile.stderr','compile-supervisor-output','guest-args.json','remote-supervise.py','startup.js','remote-control.py']
r=json.loads((h/'compile-receipt.json').read_text());live=[]
for pid,start in r['owned']:
 p=pathlib.Path('/proc')/str(pid)/'stat'
 if p.exists() and p.read_text().split(') ')[1].split()[19]==start:live.append([pid,start])
actual=sum(p.lstat().st_blocks*512 for p in h.rglob('*') if not p.is_symlink())
q=dict(at=time.time(),box='bx_9th86yg2',state='RUNNING_API_EXEC_OBSERVED',compileOwnedLive=live,cleanupComplete=r['cleanupComplete'],guestInvocations=int((h/'guest-once.json').exists()),modules=[str(p) for p in (h/'runner/build').glob('*.wasm')],allocatedBytes=actual,allocation=1073741824,reserve=67108864,lifecycleOwner='coordinator',expiry='2026-10-27T11:37:58.013Z',leftRunning=True)
assert not live and q['guestInvocations']==0 and not q['modules']
(h/'remote-closeout.json').write_text(json.dumps(q,indent=2));names+=['remote-closeout.json']
with tarfile.open(h/'terminal-evidence.tgz','w:gz') as t:
 for n in names:t.add(h/n,arcname=n,recursive=False)
p=h/'terminal-evidence.tgz';print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),files=names,closeout=q)))
'''.replace('ROOT',repr(REMOTE))
j,raw=py(code);q=json.loads(j['stdout']);save('remote-terminal-package.json',q)
buf=bytearray()
for off in range(0,q['bytes'],6000):
 j,raw=py('import pathlib,base64;f=pathlib.Path('+repr(REMOTE+'/terminal-evidence.tgz')+').open("rb");f.seek('+str(off)+');print(base64.b85encode(f.read(6000)).decode())');buf.extend(base64.b85decode(j['stdout'].strip().encode()))
assert len(buf)==q['bytes'] and sha(buf)==q['sha256'];(H/'terminal-evidence.tgz').write_bytes(buf)
import tarfile,io
D=H/'remote-evidence';D.mkdir()
with tarfile.open(fileobj=io.BytesIO(buf),mode='r:gz') as t:
 for x in t.getmembers():
  assert '/' not in x.name and x.isfile();(D/x.name).write_bytes(t.extractfile(x).read())
print(json.dumps(q))
