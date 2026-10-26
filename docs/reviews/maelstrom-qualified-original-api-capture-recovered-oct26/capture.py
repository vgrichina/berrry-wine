from common import *
import fcntl
assert json.load(open(O/'checkpoint-staged.json'))['passing']
lock=open('/tmp/wine-game-capture-bx_xfbwmcty.lock','a+')
while True:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
 except BlockingIOError:
  if time.time()+90>=1793041800:raise RuntimeError('cutoff while waiting for guest lock')
  time.sleep(2)
assert time.time()+90<1793041800
save('guest-lock.json',dict(pid=os.getpid(),acquiredAt=time.time(),path=lock.name))
j=remote('python3 '+shlex.quote(str(O/'remote-inventory.py')));save('remote-preguest-api.json',j);inv=json.loads(j['stdout']);assert inv['passChecks']
account('immediate-preguest',remoteProjection=inv['ownedAllocated']+2097152)
# Revalidate unchanged small launcher inputs and accepted module immediately before scarce guest.
s='''import pathlib,hashlib,json
H=pathlib.Path(%r);m=json.load(open(H/'manifest.json'))
for x in m:
 p=H/x['target'];h=hashlib.sha256();f=p.open('rb')
 while b:=f.read(8192):h.update(b)
 assert p.stat().st_size==x['bytes'] and h.hexdigest()==x['sha256'],x['target']
assert (H/'guest').is_dir() and not list((H/'guest').iterdir())
assert not (H/'ops/guest-invoked.json').exists()
print(json.dumps(dict(passChecks=True,pins=len(m),diagnosticState='fresh instance required; adapter rejects nonzero initial native state',guestFilesInitiallyEmpty=True)))
'''%str(H)
j=py(s);save('remote-immediate-inputs-api.json',j)
assert not (O/'one-guest-launch.json').exists();save('one-guest-launch.json',dict(at=time.time(),attempt=1,box=BOX,cutoff='2026-10-26T19:10:00Z',command='python3 '+str(O/'supervise.py')+' guest'))
j=remote('python3 '+shlex.quote(str(O/'supervise.py'))+' guest',90);save('guest-api.json',j)
r=json.loads(j['stdout']);save('checkpoint-guest-terminal.json',r);assert not r['remainingGroup']
print(json.dumps(dict(exit=r['exit'],reason=r['reason'],elapsed=r['elapsed'],remainingGroup=r['remainingGroup'],peakGroupRSS=r['peakGroupRSS'])))
