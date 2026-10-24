import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re
H=pathlib.Path(__file__).parent
ctypes.CDLL(None).prctl(36,1,0,0,0)
def stop(p):
 term=kill=False
 try:os.killpg(p.pid,signal.SIGTERM);term=True
 except ProcessLookupError:pass
 deadline=time.monotonic()+.7
 while time.monotonic()<deadline:
  p.poll()
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
  time.sleep(.03)
 try:os.killpg(p.pid,signal.SIGKILL);kill=True
 except ProcessLookupError:pass
 p.wait();reaped=[]
 while True:
  try:
   pid,status=os.waitpid(-1,os.WNOHANG)
   if pid==0:break
   reaped.append([pid,status])
  except ChildProcessError:break
 try:os.killpg(p.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 return dict(TERM=term,KILL=kill,returncode=p.returncode,reaped=reaped,remainingGroup=remaining)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
if sys.argv[1]=='negative-control':
 p=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print("ready",flush=True);time.sleep(20)'],stdout=subprocess.PIPE,start_new_session=True)
 assert p.stdout.readline()==b'ready\n';receipt=stop(p);assert receipt['TERM'] and receipt['KILL'] and not receipt['remainingGroup'] and receipt['returncode']==-9
 (H/'watchdog-negative-control.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));sys.exit(0)
assert time.time()<1792818990, 'deadline leaves 90s before05:18UTC'
name=sys.argv[1];assert name in ['control','treatment'];E=H/name;E.mkdir(exist_ok=False)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=2684354560
assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize-62148948>=2982150144
args=json.load(open(H/(name+'-args.json')))
env=dict(os.environ);env.pop('WINE_RUN_EXTRA_ARGS',None);env.pop('WINE_REGION_MAP',None)
log=open(E/'output.log','wb');p=subprocess.Popen(args,cwd=pathlib.Path('/tmp/penguin-integrated-clock-firing-oct24/runner'),env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,preexec_fn=limits);start=time.monotonic()
(E/'command.json').write_text(json.dumps(dict(argv=args,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=90,guestSeconds=60,maxBatches=43000,outputBytes=524288)),indent=2));why='natural'
try:
 while p.poll() is None:
  if time.monotonic()-start>90:why='wall-guard';break
  if (E/'output.log').stat().st_size>524288:why='capture-guard';break
  time.sleep(.03)
finally:
 receipt=stop(p);receipt.update(reason=why,elapsed=time.monotonic()-start,box='bx_fkg5uw8h',lifecycle='leave RUNNING; coordinator owns shutdown05:20UTC',expires='2026-10-24T05:24:53.790Z',guestExitClaim=False)
 log.close();(E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
