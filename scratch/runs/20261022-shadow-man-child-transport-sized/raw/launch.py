import pathlib,sys,json,os,subprocess,time,signal,selectors,datetime,shutil
from preflight import O,R,old,previous,sha
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,17,8,tzinfo=datetime.timezone.utc)
assert not (O/'attempt.json').exists()
b=json.loads((O/'preflight.json').read_text());assert b['passAll'];assert old.seals()==b['seals'];assert previous()==b['previous'];old.conflicts()
assert shutil.disk_usage(O).free>=4*1024**3+272*1024**2
(O/'tmp').mkdir()
original=json.loads((R/'setup-run/command.json').read_text())
remove=['--spawn-processes','--pipe-child-args=','--capture-launch=','--reg-export=','--save-vfs=','--max-seconds=','--png=','--control=']
cmd=[x for x in original if not any(x==p or(p.endswith('=') and x.startswith(p)) for p in remove)]
cmd[1:1]=['--require',str(O/'observer.cjs')]
cmd+=['--real-ticks','--max-seconds=55','--spawn-processes','--pipe-child-args=--real-ticks','--png='+str(O/'parent-final.png')]
assert not any(x.startswith(('--input=','--time-scale=','--frozen')) for x in cmd)
assert cmd.count('--real-ticks')==1
(O/'command.json').write_text(json.dumps(cmd,indent=2))
at=datetime.datetime.now(datetime.timezone.utc).isoformat();start=time.monotonic()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,17,8,tzinfo=datetime.timezone.utc)
(O/'attempt.json').write_text(json.dumps(dict(at=at,attempt=1,aggregateBoundSeconds=60,retries=0,guestInput=False)))
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'),TMPDIR=str(O/'tmp'))
p=subprocess.Popen(cmd,cwd=R/'runtime',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
(O/'pid.json').write_text(json.dumps(dict(pid=p.pid,pgid=p.pid)))
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);log=(O/'output.log').open('xb');n=0;reason=None;peak=0
def sizes():
 total=raw=0
 for f in O.rglob('*'):
  if f.is_file():
   s=f.stat().st_size;total+=s
   if 'tmp' not in f.relative_to(O).parts:raw+=s
 return total,raw
while time.monotonic()-start<58:
 for key,_ in sel.select(.02):
  data=os.read(key.fileobj.fileno(),65536)
  if not data:sel.unregister(key.fileobj);continue
  remain=512*1024-n;log.write(data[:max(0,remain)]);n+=min(max(0,remain),len(data))
  if len(data)>remain:reason='stdout-quota'
 try:total,raw=sizes();peak=max(peak,total)
 except FileNotFoundError:continue
 if total>256*1024**2 or raw>8*1024**2-65536:reason='allocation-quota'
 if (O/'stop-request.json').exists():reason=json.loads((O/'stop-request.json').read_text())['reason']
 if reason:break
 if p.poll() is not None:
  reason='parent-exit';break
if reason is None:reason='monotonic-time-bound'
def kill(sig):
 try:os.killpg(p.pid,sig)
 except ProcessLookupError:pass
kill(signal.SIGTERM)
try:p.wait(timeout=max(.1,59-(time.monotonic()-start)))
except subprocess.TimeoutExpired:kill(signal.SIGKILL);p.wait(timeout=.5)
kill(signal.SIGKILL)
for key,_ in sel.select(0):
 data=os.read(key.fileobj.fileno(),65536);log.write(data[:max(0,512*1024-n)])
log.close()
total,raw=sizes();peak=max(peak,total)
assert old.seals()==b['seals'];assert previous()==b['previous']
out=dict(startedAt=at,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsedSeconds=time.monotonic()-start,parentExitCode=p.returncode,reason=reason,peakObservedBytes=peak,totalBytes=total,rawBytes=raw,cap=256*1024**2,reserve=16*1024**2,freeBytes=shutil.disk_usage(O).free,originalSeals=len(b['seals']),previousSeals=len(b['previous']),preserved=True,**old.conflicts())
assert out['elapsedSeconds']<60;assert peak<=256*1024**2;assert raw<=8*1024**2
(O/'exit.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
