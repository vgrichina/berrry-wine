import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re
H=pathlib.Path('/tmp/penguin-controlled-firing-oct24');mode=sys.argv[1];assert mode in ['control','firing'];E=H/mode;E.mkdir(parents=True,exist_ok=False);ctypes.CDLL(None).prctl(36,1,0,0,0)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=2684354560;assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize-62905873>=2982150144
ev=['32000:png:'+str(E/'menu.png'),'33000:mousemove:420:360','34000:mousedown:420:360','34500:mouseup:420:360','34600:mousemove:260:220']
for b in [34510,34790,34810,34850,34910,35000,35200,35500,36000,37000,40000,45000]:ev.append(str(b)+':png:'+str(E/('b'+str(b)+'.png')))
if mode=='firing':ev+=['34800:keydown:65','34900:keyup:65']
ev.sort(key=lambda x:int(x.split(':')[0]))
args=['node','--max-old-space-size=512',str(H/'runner/test/run.js'),'--no-build','--wasm='+str(H/'runtime/build/wine-assembly.wasm'),'--exe='+str(H/'game/penguin-command.exe'),'--exe-guest-path=C:\\penguin-command.exe','--cwd=C:\\','--args=--windowed --nosound','--dlls='+','.join(str(H/'game'/x) for x in ['msvcrt.dll','SDL.dll','zlib1.dll','libpng12-0.dll','jpeg.dll','SDL_image.dll','SDL_mixer.dll']),'--vfs-include=data/gfx/*.png','--vfs-include=data/gfx/*.jpg','--input='+','.join(ev),'--quiet-api','--quiet-blocks','--no-close','--max-seconds=60','--max-batches=45001','--tick-ms-per-batch=200','--control-stdin','--memory-mb=512','--png='+str(E/'exit.png'),'--save-vfs='+str(E/'vfs'),'--save-vfs-suffix=.dat']
env=dict(os.environ);env.pop('WINE_RUN_EXTRA_ARGS',None);env.pop('WINE_REGION_MAP',None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
log=open(E/'output.log','wb');p=subprocess.Popen(args,cwd=H/'runner',env=env,stdin=subprocess.PIPE,stdout=log,stderr=log,start_new_session=True,preexec_fn=limits);start=time.monotonic();(E/'command.json').write_text(json.dumps(dict(argv=args,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=90,guestSeconds=60,maxBatches=45001)),indent=2));cursor=0;sent=False;why='natural';events=[]
try:
 while p.poll() is None:
  elapsed=time.monotonic()-start
  if elapsed>90:why='wall-guard';break
  if (E/'output.log').stat().st_size>512*1024:why='capture-guard';break
  if False:
   cmds=[dict(action='snapshot',id='startup-state'),dict(action='png',path=str(E/'startup.png'),id='startup-capture')]
   for cmd in cmds:p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush();events.append(dict(t=elapsed,command=cmd))
   sent=True
  time.sleep(.05)
except BrokenPipeError:why='guest-closed-stdin'
finally:
 term=False;kill=False
 try:os.killpg(p.pid,signal.SIGTERM);term=True
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
  p.poll();time.sleep(.05)
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
 log.close();(E/'input-events.json').write_text(json.dumps(events,indent=2));(E/'terminal.json').write_text(json.dumps(dict(reason=why,returncode=p.returncode,elapsed=time.monotonic()-start,TERM=term,KILL=kill,reaped=reaped,remainingGroup=remaining,box='bx_spn54373',lifecycle='leave RUNNING coordinator owns shutdown',expires='2026-10-24T03:52:49.910Z'),indent=2))
