import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re
H=pathlib.Path('/tmp/penguin-retained-codec-oct24');E=H/'run';E.mkdir(exist_ok=False);ctypes.CDLL(None).prctl(36,1,0,0,0)
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=2684354560;assert os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize-56814417>=2982150144
args=['node','--max-old-space-size=512',str(H/'runner/test/run.js'),'--no-build','--wasm='+str(H/'runtime/build/wine-assembly.wasm'),'--exe='+str(H/'game/penguin-command.exe'),'--exe-guest-path=C:\\penguin-command.exe','--cwd=C:\\','--args=--windowed --nosound','--dlls='+','.join(str(H/'game'/x) for x in ['msvcrt.dll','SDL.dll','zlib1.dll','libpng12-0.dll','jpeg.dll','SDL_image.dll','SDL_mixer.dll']),'--vfs-include=data/gfx/*.png','--vfs-include=data/gfx/*.jpg','--quiet-api','--no-close','--max-seconds=60','--max-batches=200000','--control-stdin','--memory-mb=512','--png='+str(E/'exit.png'),'--save-vfs='+str(E/'vfs'),'--save-vfs-suffix=.dat']
env=dict(os.environ);env.pop('WINE_RUN_EXTRA_ARGS',None);env.pop('WINE_REGION_MAP',None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
log=open(E/'output.log','wb');p=subprocess.Popen(args,cwd=H/'runner',env=env,stdin=subprocess.PIPE,stdout=log,stderr=log,start_new_session=True,preexec_fn=limits);start=time.monotonic();(E/'command.json').write_text(json.dumps(dict(argv=args,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=90,guestSeconds=60,maxBatches=200000)),indent=2));cursor=0;sent=False;why='natural';events=[]
try:
 while p.poll() is None:
  elapsed=time.monotonic()-start
  if elapsed>90:why='wall-guard';break
  if (E/'output.log').stat().st_size>512*1024:why='capture-guard';break
  if elapsed>4 and not sent:
   cmds=[dict(action='snapshot',id='startup-state'),dict(action='png',path=str(E/'startup.png'),id='startup-capture')]
   for cmd in cmds:p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush();events.append(dict(t=elapsed,command=cmd))
   sent=True
  inbox=H/'input.ndjson'
  if inbox.exists():
   lines=inbox.read_text().splitlines()
   for line in lines[cursor:]:
    cmd=json.loads(line);p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush();events.append(dict(t=elapsed,command=cmd))
   cursor=len(lines)
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
 log.close();(E/'input-events.json').write_text(json.dumps(events,indent=2));(E/'terminal.json').write_text(json.dumps(dict(reason=why,returncode=p.returncode,elapsed=time.monotonic()-start,TERM=term,KILL=kill,reaped=reaped,remainingGroup=remaining,box='bx_9nngcsvf',lifecycle='leave RUNNING coordinator owns shutdown',expires='2026-10-24T02:47:54Z'),indent=2))
