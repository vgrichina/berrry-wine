#!/usr/bin/env python3
"""Task-local bounded capture. Never invokes a build or runtime recipe."""
import ctypes,json,os,pathlib,resource,selectors,signal,subprocess,sys,time
sys.dont_write_bytecode=True
EXT=pathlib.Path(__file__).resolve().parent
ROOT=pathlib.Path('/home/user/wine-assembly-shadow-man-excerpt-bound-static-accept-oct23')
FILE=25165824; CAP=524288
ENV=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1')
def dump(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def bounded(label,argv,cwd=None,extra_env=None):
 assert not (EXT/(label+'.receipt.json')).exists(),'No unchanged retries'
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
 used=sum(json.loads(p.read_text())['capturedBytes'] for p in EXT.glob('*.receipt.json'))
 assert used<CAP
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 env=dict(ENV,**(extra_env or {}));env['TMPDIR']=str(EXT)
 t=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector();logs={'stdout':bytearray(),'stderr':bytearray()};counts=dict(stdout=0,stderr=0);reason=None;term=None
 for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name)
 def kill(sig):
  try:os.killpg(p.pid,sig)
  except ProcessLookupError:pass
 while sel.get_map() or p.poll() is None:
  now=time.monotonic()
  if reason is None and now-t>60:reason='wall limit'
  if reason and term is None:kill(signal.SIGTERM);term=now
  if term is not None and now-term>=5:kill(signal.SIGKILL)
  for key,_ in sel.select(.05):
   b=os.read(key.fileobj.fileno(),65536)
   if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
   name=key.data;counts[name]+=len(b);remaining=max(0,CAP-used-sum(map(len,logs.values())))
   logs[name].extend(b[:remaining])
   if used+sum(counts.values())>CAP:reason='aggregate capture overflow'
  for root in (EXT,ROOT):
   if root.exists() and any(f.stat().st_size>FILE for f in root.rglob('*') if f.is_file()):reason='regular file overflow'
 code=p.wait();kill(signal.SIGTERM);deadline=time.monotonic()+5
 while True:
  try:
   while os.waitpid(-1,os.WNOHANG)[0]:pass
  except ChildProcessError:break
  if time.monotonic()>=deadline:kill(signal.SIGKILL);break
  time.sleep(.05)
 kill(signal.SIGKILL)
 try:
  while True:os.waitpid(-1,0)
 except ChildProcessError:pass
 remaining=[]
 for q in pathlib.Path('/proc').iterdir():
  if not q.name.isdigit():continue
  try:
   f=(q/'stat').read_text().split(') ',1)[1].split()
   if int(f[2])==p.pid or int(f[1])==os.getpid():remaining.append(int(q.name))
  except (OSError,IndexError):pass
 if remaining:reason='unreaped descendants'
 receipt=dict(argv=argv,cwd=str(cwd or pathlib.Path.cwd()),pid=p.pid,childExit=code,exit=125 if reason else code,reason=reason,elapsedSeconds=time.monotonic()-t,cpuSeconds=60,wallSeconds=60,fileMax=FILE,aggregateCaptureMax=CAP,previousCaptureBytes=used,streamBytes=counts,capturedBytes=sum(map(len,logs.values())),aggregateAfter=used+sum(counts.values()),termThenKillSeconds=5,subreaper=True,reaped=not remaining,remaining=remaining,stdout=bytes(logs['stdout']).decode('utf8'),stderr=bytes(logs['stderr']).decode('utf8'))
 dump(EXT/(label+'.receipt.json'),receipt)
 print(json.dumps(dict(label=label,exit=receipt['exit'],bytes=receipt['capturedBytes'],reaped=receipt['reaped'])),flush=True)
 if receipt['exit']:raise SystemExit(receipt['exit'])
 return receipt
if __name__=='__main__':bounded(sys.argv[1],sys.argv[2:])
