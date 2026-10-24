import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re
def terminal_capture():
 name=os.environ.get('ENIGMA_TERMINAL_RECEIPT')
 if not name or not os.path.exists(name):return None
 with open(name,'rb') as f:data=f.read(1025)
 assert len(data)<=1024,'terminal capture receipt size'
 record=json.loads(data)
 assert record.get('version')==1 and record.get('terminal') is True
 assert record.get('reason')=='capture-byte-limit' and record.get('artifactAccepted') is False
 assert record.get('runnerSHA256')=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
 assert record.get('captureSHA256')=='6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079'
 assert record.get('code')=='ERR_ASSERTION'
 assert record.get('profile') in (None,'default','single-frame')
 if record.get('profile')=='single-frame':
  assert record.get('message') in ('capture byte limit','capture frame limit','capture cumulative byte limit')
 else:
  assert record.get('message')=='capture byte limit'
 return record
# Retained-output transport
"""Inlined into the SHA-pinned supervisor by transformSupervisor.

Only the supervisor owns the retained log. The child inherits a pipe, so its
artifact RLIMIT_FSIZE cannot enlarge retained stdout/stderr, even at fast exit.
"""
class RetainedOutput:
 def __init__(self, pipe, log):
  self.pipe=pipe;self.log=log;self.bytes=0;self.capped=False;self.eof=False
  self.tail=b'';self.fault=False
  os.set_blocking(pipe.fileno(),False)
 def drain(self):
  # Bound each turn as well as retention; reaching the cap terminates the run.
  parts=[]
  while not self.capped and not self.eof and not self.fault:
   try:part=os.read(self.pipe.fileno(),min(8192,131072-self.bytes))
   except BlockingIOError:break
   if not part:self.eof=True;break
   written=self.log.write(part)
   if written!=len(part):raise OSError('retained output short write')
   self.bytes+=written;parts.append(part)
   self.tail=(self.tail+part)[-16384:]
   self.fault=bool(re.search(rb'RuntimeError:|unreachable|\[crash\]|png FAILED|capture byte limit|capture dimensions',self.tail))
   self.capped=self.bytes==131072
  self.log.flush()
  return b''.join(parts)
 def close(self):
  self.pipe.close()

artifact_profiles={"default":131072,"single-frame":2097152}
artifact_profile=os.environ.get('ENIGMA_CAPTURE_PROFILE','default')
assert artifact_profile in artifact_profiles,'capture profile'
artifact_file_limit=artifact_profiles[artifact_profile]
H=pathlib.Path(__file__).parent
ctypes.CDLL(None).prctl(36,1,0,0,0)
def stop(p):
 term=kill=False
 try:os.killpg(p.pid,signal.SIGTERM);term=True
 except ProcessLookupError:pass
 deadline=time.monotonic()+1
 while time.monotonic()<deadline:
  p.poll()
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
  time.sleep(.03)
 try:os.killpg(p.pid,signal.SIGKILL);kill=True
 except ProcessLookupError:pass
 p.wait();reaped=[]
 deadline=time.monotonic()+2
 while True:
  try:
   pid,status=os.waitpid(-1,os.WNOHANG)
   if pid==0:
    if time.monotonic()<deadline:time.sleep(.03);continue
    break
   reaped.append([pid,status])
  except ChildProcessError:break
 try:os.killpg(p.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 assert not remaining
 return dict(TERM=term,KILL=kill,returncode=p.returncode,reaped=reaped,remainingGroup=remaining)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(artifact_file_limit,artifact_file_limit))
if sys.argv[1]=='negative-control':
 p=subprocess.Popen([sys.executable,'-c','import signal,time,subprocess,sys;signal.signal(signal.SIGTERM,signal.SIG_IGN);subprocess.Popen([sys.executable,"-c","import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(20)"]);time.sleep(.1);print("ready",flush=True);time.sleep(20)'],stdout=subprocess.PIPE,start_new_session=True)
 assert p.stdout.readline()==b'ready\n';receipt=stop(p);assert receipt['TERM'] and receipt['KILL'] and receipt['returncode']==-9
 (H/'watchdog-negative-control.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));sys.exit(0)
if sys.argv[1]=='output-control':
 E=H/'output-control';E.mkdir(exist_ok=False)
 with open(E/'output.log','wb') as f:
  p=subprocess.Popen([sys.executable,'-c','import os,time;os.write(1,b"x"*131072);time.sleep(20)'],stdout=f,start_new_session=True,preexec_fn=limits)
  deadline=time.monotonic()+5
  while (E/'output.log').stat().st_size<131072 and time.monotonic()<deadline:time.sleep(.01)
  assert (E/'output.log').stat().st_size==131072
  receipt=stop(p);receipt.update(reason='output-guard',bytes=(E/'output.log').stat().st_size,failedOutputRetained=True)
 (E/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));sys.exit(0)
assert sys.argv[1]=='guest' 
assert time.time()<1792854960,'latest start15:16UTC'
E=H/'guest';E.mkdir(exist_ok=False)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=2684354560
assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize-60000000>=2982150144
assert os.getuid()==1000
args=json.load(open(H/'guest-args.json'))
env=dict(os.environ);env.pop('WINE_RUN_EXTRA_ARGS',None);env.pop('WINE_REGION_MAP',None);env['MAELSTROM_CAPTURE_INSTALL']='1'
log=open(E/'output.log','wb');p=subprocess.Popen(args,cwd=H/'runner',env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits);start=time.monotonic();output=RetainedOutput(p.stdout,log)
(E/'command.json').write_text(json.dumps(dict(argv=args,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,uid=os.getuid(),environment=dict(MAELSTROM_CAPTURE_INSTALL='1',removed=['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']),limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=60,guestSeconds=60,maxBatches=10000000,outputBytes=131072)),indent=2));why='natural';offset=0;tail=b''
try:
 while p.poll() is None:
  if terminal_capture() is not None:why='capture-byte-limit';break
  if time.monotonic()-start>60:why='wall-guard';break
  part=output.drain()
  if output.capped:why='output-guard';break
  tail=(tail+part)[-16384:]
  if re.search(rb'RuntimeError:|unreachable|\[crash\]|png FAILED|capture byte limit|capture dimensions',tail):why='first-observable-fault';break
  time.sleep(.02)
finally:
 receipt=stop(p)
 try:
  output.drain()
  if output.capped and why=='natural':why='output-guard'
  if output.fault and why=='natural':why='first-observable-fault'
 finally:output.close()
 receipt.update(reason=why,elapsed=time.monotonic()-start,box='bx_zmaewrem',lifecycle='leave RUNNING; coordinator owns shutdown15:23UTC',expires='2026-10-24T15:27:08.953Z',outputBytes=(E/'output.log').stat().st_size)
 capture_terminal=terminal_capture()
 if capture_terminal is not None:receipt.update(reason='capture-byte-limit',captureTerminal=capture_terminal)
 log.close();(E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
if capture_terminal is not None:raise SystemExit(1)
if capture_terminal is None and (why!='natural' or p.returncode):raise SystemExit(1)
