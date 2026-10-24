import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re
H=pathlib.Path(__file__).parent
ctypes.CDLL(None).prctl(36,1,0,0,0)
def stop(p):
 term=kill=False
 try:os.killpg(p.pid,signal.SIGTERM);term=True
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
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
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))
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
assert time.time()<1792838100,'latest start10:35UTC'
E=H/'guest';E.mkdir(exist_ok=False)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=2684354560
assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize-60000000>=2982150144
assert os.getuid()==1000
args=json.load(open(H/'guest-args.json'))
env=dict(os.environ);env.pop('WINE_RUN_EXTRA_ARGS',None);env.pop('WINE_REGION_MAP',None);env['MAELSTROM_CAPTURE_INSTALL']='1'
log=open(E/'output.log','wb');p=subprocess.Popen(args,cwd=H/'runner',env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,preexec_fn=limits);start=time.monotonic()
(E/'command.json').write_text(json.dumps(dict(argv=args,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,uid=os.getuid(),environment=dict(MAELSTROM_CAPTURE_INSTALL='1',removed=['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']),limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=60,guestSeconds=60,maxBatches=42000,outputBytes=131072)),indent=2));why='natural';offset=0;tail=b''
try:
 while p.poll() is None:
  if time.monotonic()-start>60:why='wall-guard';break
  n=(E/'output.log').stat().st_size
  if n>=131072:why='output-guard';break
  with open(E/'output.log','rb') as f:f.seek(offset);part=f.read(8192);offset+=len(part)
  tail=(tail+part)[-16384:]
  if re.search(rb'RuntimeError:|unreachable|\[crash\]|png FAILED|capture byte limit|capture dimensions',tail):why='first-observable-fault';break
  time.sleep(.02)
finally:
 receipt=stop(p);receipt.update(reason=why,elapsed=time.monotonic()-start,box='bx_bac88fes',lifecycle='leave RUNNING; coordinator owns shutdown10:42UTC',expires='2026-10-24T10:47:44Z',outputBytes=(E/'output.log').stat().st_size)
 log.close();(E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
