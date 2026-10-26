import pathlib,os,sys,json,time,resource,subprocess,signal,selectors,fcntl,ctypes,shutil
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';mode=sys.argv[1];cutoff=1793008800.0
ctypes.CDLL(None).prctl(36,1,0,0,0)
assert mode in ['startup','compile','guest']
cpu=300 if mode=='compile' else 90;wall=300 if mode=='compile' else 60
assert time.time()+wall+5<cutoff
lock=open('/tmp/wine-qualification-heavy.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
env=dict(os.environ,MNE_CANONICAL_ROOT=str(H/'canonical'),MNE_STANDING=str(O),MNE_ANCHORS=str(O/'anchors'),TMPDIR=str(O),PYTHONDONTWRITEBYTECODE='1')
for k in ['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','MAELSTROM_CAPTURE_INSTALL']:env.pop(k,None)
node=shutil.which('node');assert node
if mode=='compile':argv=[node,'--max-old-space-size=512',str(H/'repo/tools/maelstrom-diagnostic-canonical-build.cjs')];cwd=H/'repo'
elif mode=='guest':argv=json.load(open(H/'guest-args.json'));argv[0]=node;cwd=H/'runner'
else:
 argv=[node,'--max-old-space-size=512','-e','console.log(JSON.stringify({node:process.execPath,version:process.version,argv:process.execArgv,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith("MNE_")||k==="TMPDIR"||k==="NODE_OPTIONS"))}))'];cwd=H/'repo'
def lim():
 resource.setrlimit(resource.RLIMIT_CPU,(cpu,cpu));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
assert mem>=2684354560
assert shutil.disk_usage(H).free-67108864>=2982150144
assert os.getuid()==1000
E=O/mode;E.mkdir(exist_ok=False);start=time.monotonic();log=open(E/'output.log','wb')
p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=lim,stdin=subprocess.DEVNULL)
limits={k:resource.prlimit(p.pid,getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']}
assert limits['RLIMIT_DATA'][0]==-1 and limits['RLIMIT_AS'][0]==-1
receipt=dict(mode=mode,supervisorPID=os.getpid(),childPID=p.pid,pgid=p.pid,argv=argv,cwd=str(cwd),at=time.time(),wall=wall,cpu=cpu,fileMax=25165824,outputMax=131072,heapMiB=512,arenaMiB=512 if mode=='guest' else 0,limits=limits,memAvailable=mem,free=shutil.disk_usage(H).free,env={k:v for k,v in env.items() if k.startswith('MNE_') or k in ['TMPDIR','PYTHONDONTWRITEBYTECODE']},box='bx_vs4xtsz3')
(E/'command.json').write_text(json.dumps(receipt,indent=2))
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);os.set_blocking(p.stdout.fileno(),False);total=0;why='natural'
try:
 while sel.get_map() or p.poll() is None:
  if time.monotonic()-start>wall or time.time()>=cutoff:why='wall/cutoff';break
  for key,_ in sel.select(.03):
   b=os.read(key.fileobj.fileno(),8192)
   if not b:sel.unregister(key.fileobj);continue
   log.write(b[:max(0,131072-total)]);log.flush();total+=len(b)
   if total>131072:why='output cap';break
  if why!='natural':break
finally:
 term=kill=False
 if p.poll() is None:
  try:os.killpg(p.pid,signal.SIGTERM);term=True
  except ProcessLookupError:pass
  deadline=time.monotonic()+2
  while p.poll() is None and time.monotonic()<deadline:time.sleep(.03)
 try:os.killpg(p.pid,signal.SIGKILL);kill=True
 except ProcessLookupError:pass
 p.wait();reaped=[];deadline=time.monotonic()+2
 while time.monotonic()<deadline:
  try:
   pid,status=os.waitpid(-1,os.WNOHANG)
   if pid:reaped.append([pid,status])
   else:time.sleep(.02)
  except ChildProcessError:break
 try:os.killpg(p.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 log.close();receipt.update(exit=p.returncode,reason=why,elapsed=time.monotonic()-start,outputBytes=total,TERM=term,KILL=kill,reaped=reaped,remainingGroup=remaining,maxRSSBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 (E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));assert not remaining
sys.exit(0)
