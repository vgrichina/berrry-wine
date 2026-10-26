from common import *
import fcntl,base64
lock=open('/tmp/wine-game-capture-bx_xfbwmcty.lock','a+')
while True:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
 except BlockingIOError:
  if time.time()>=1793041710:raise RuntimeError('cutoff while waiting for shared box lock')
  time.sleep(2)
save('stage-lock.json',dict(pid=os.getpid(),acquiredAt=time.time(),path=lock.name))
account('before-staging',remoteProjection=28000000)
# Independent chunked base64 roundtrip, crossing the exact18000-byte chunk boundary.
test=O/'transfer-roundtrip.bin';test.write_bytes(bytes(range(256))*141)
receipt=put(test)
j=py('import pathlib,base64,hashlib,json;p=pathlib.Path('+repr(str(test))+');b=p.read_bytes();print(json.dumps(dict(first=base64.b64encode(b[:24]).decode(),middle=base64.b64encode(b[17990:18020]).decode(),last=base64.b64encode(b[-24:]).decode(),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))')
check=json.loads(j['stdout']);b=test.read_bytes();assert check['middle']==base64.b64encode(b[17990:18020]).decode() and check['last']==base64.b64encode(b[-24:]).decode()
save('transfer-roundtrip.json',dict(passChecks=True,write=receipt,readback=check,chunkBytes=18000,maxRequestBytes=35000))
put(O/'remote-inventory.py');j=remote('python3 '+shlex.quote(str(O/'remote-inventory.py')));save('remote-before-staging-api.json',j)
manifest=json.load(open(H/'manifest.json'));expanded=sum(x['bytes']+4096 for x in manifest)
account('archive-transfer',remoteProjection=expanded+(O/'closure.tar.gz').stat().st_size+2097152)
save('archive-transfer.json',put(O/'closure.tar.gz'))
for p in [H/'manifest.json',H/'guest-args.json',O/'supervise.py']:put(p)
# Extraction is confined to this owned directory; validate exact hashes then remove transport archive.
s='''import pathlib,tarfile,json,hashlib,os
H=pathlib.Path(%r);m=json.load(open(H/'manifest.json'))
with tarfile.open(H/'ops/closure.tar.gz') as t:
 assert len(t.getmembers())==len(m)
 for x in t.getmembers():assert x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts
 t.extractall(H,filter='data')
for x in m:
 p=H/x['target'];h=hashlib.sha256();f=p.open('rb')
 while b:=f.read(8192):h.update(b)
 assert p.stat().st_size==x['bytes'] and h.hexdigest()==x['sha256'],x['target']
(H/'guest').mkdir(exist_ok=False)
for p in [H/'guest',H/'ops']:
 f=p/'.append-probe'
 with f.open('xb') as w:w.write(b'first\\n');w.flush();os.fsync(w.fileno())
 with f.open('ab') as w:w.write(b'second\\n');w.flush();os.fsync(w.fileno())
 assert f.read_bytes()==b'first\\nsecond\\n';f.unlink()
(H/'ops/closure.tar.gz').unlink()
print(json.dumps(dict(passChecks=True,files=len(m),bytes=sum(x['bytes'] for x in m),appendParentsVerified=True,transportArchiveRemoved=True)))
'''%str(H)
save('remote-extract-verify.py',dict(script=s));j=py(s);save('remote-extract-verify-api.json',j)
validator=pathlib.Path('/tmp/maelstrom-retained-logger-original-capture-oct26/ops/validate-tree.cjs').read_text()
validator=validator.replace('/tmp/maelstrom-current-uop-original-errno-capture-oct26',str(H)).replace('/tmp/maelstrom-retained-logger-original-capture-oct26',str(H))
(O/'validate-tree.cjs').write_text(validator);put(O/'validate-tree.cjs')
# Syntax and import checks do not compile/instantiate a wasm module or replay an acceptance group.
j=remote('cd '+shlex.quote(str(H/'runner'))+' && /home/user/.nvm/versions/node/v24.22.1/bin/node --max-old-space-size=512 --check test/run.js && /home/user/.nvm/versions/node/v24.22.1/bin/node --max-old-space-size=512 '+shlex.quote(str(O/'validate-tree.cjs')));save('mount-api.json',j)
j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' startup');save('startup-api.json',j)
r=json.loads(j['stdout']);assert r['exit']==0 and not r['remainingGroup']
save('checkpoint-staged.json',dict(passing=True,at=time.time(),guestAttempts=0,moduleSHA256='98e136b5e61a0b731e3ecc84fa17eafe1a91fa2a86ba1a4451697abb15c89ad4',startup=r,mount=json.loads(json.load(open(O/'mount-api.json'))['stdout']),remoteHashesVerified=True))
print('STAGING+MOUNT+STARTUP PASS; guestAttempts=0')
