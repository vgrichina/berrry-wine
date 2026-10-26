from common import *
import fcntl
lock=open('/tmp/wine-game-capture-bx_xfbwmcty.lock','a+')
print('Awaiting serialized owned runner retirement; no guest retry',flush=True)
while True:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);break
 except BlockingIOError:
  assert time.time()<1793042100,'handback deadline';time.sleep(.5)
r=py('''import pathlib,json,shutil,os
H=pathlib.Path(ROOT);R=H/'runner';assert str(H.resolve())==str(H) and not R.is_symlink()
before=sum(p.stat().st_blocks*512 for p in R.rglob('*') if p.is_file())
own=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  c=(p/'cmdline').read_bytes().split(b'\\0')
  if c and pathlib.Path(c[0].decode(errors='replace')).name=='node' and any(str(H).encode() in x for x in c):own.append(int(p.name))
 except OSError:pass
assert not own,own
shutil.rmtree(R)
print(json.dumps(dict(retired='runner only',reclaimedBytes=before,guestProcesses=own,gameFixtureUntouched=True,moduleUntouched=True,evidenceUntouched=True,standingDonorsUntouched=True)))
'''.replace('ROOT',repr(str(H))))
save('owned-runner-retirement.json',dict(r,at=time.time(),reason='Measured publication projection67992768 exceeded67108864. Retire verified disposable task-owned remote runner closure after evidence retrieval; exact source/Git/hash recovery recipe retained. No gate relaxed.'));print(json.dumps(r))
