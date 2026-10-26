import pathlib,os,sys,json,time,resource,subprocess,signal,selectors,ctypes,shutil
H=pathlib.Path('/tmp/maelstrom-qualified-original-api-capture-recovered-oct26');O=H/'ops';mode=sys.argv[1]
assert mode in ['startup','guest'];cutoff=1793041800.0
ctypes.CDLL(None).prctl(36,1,0,0,0)
wall=85;cpu=90;assert time.time()+wall+5<cutoff
env={k:os.environ[k] for k in ['PATH','HOME','LANG','LC_ALL','TZ'] if k in os.environ}
env.update(TMPDIR=str(O),PYTHONDONTWRITEBYTECODE='1')
for k in ['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','MAELSTROM_CAPTURE_INSTALL','WINE_ASSEMBLY_WASM']:env.pop(k,None)
envSHA=__import__('hashlib').sha256(json.dumps(env,sort_keys=True).encode()).hexdigest()
if mode=='guest':assert json.load(open(O/'startup/terminal.json'))['environmentSHA256']==envSHA,'startup environment changed'
node='/home/user/.nvm/versions/node/v24.22.1/bin/node';assert shutil.which('node')==node
if mode=='guest':
 argv=json.load(open(H/'guest-args.json'));argv[0]=node;cwd=H/'runner'
 assert (O/'startup/terminal.json').exists() and json.load(open(O/'startup/terminal.json'))['exit']==0
 assert (O/'mount-enumeration.json').exists()
 assert not (O/'guest-invoked.json').exists();(O/'guest-invoked.json').write_text(json.dumps(dict(at=time.time(),attempt=1,cutoff=cutoff)))
else:
 argv=[node,'--max-old-space-size=512','-e','console.log(JSON.stringify({node:process.execPath,version:process.version,argv:process.execArgv,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k==="TMPDIR"||k==="PYTHONDONTWRITEBYTECODE"||k==="NODE_OPTIONS"||k.startsWith("MNE_"))),limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'];cwd=H/'runner'
def lim():
 resource.setrlimit(resource.RLIMIT_CPU,(cpu,cpu));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
E=O/mode;E.mkdir(exist_ok=False);start=time.monotonic();log=open(E/'output.log','wb')
p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=lim,stdin=subprocess.DEVNULL)
limits={k:resource.prlimit(p.pid,getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']}
assert limits['RLIMIT_DATA']==(-1,-1) and limits['RLIMIT_AS']==(-1,-1)
receipt=dict(mode=mode,supervisorPID=os.getpid(),childPID=p.pid,pgid=p.pid,argv=argv,cwd=str(cwd),at=time.time(),wall=wall,cpu=cpu,fileMax=25165824,outputMax=131072,capturesTotalMax=2097152,heapMiB=512,arenaMiB=512 if mode=='guest' else 0,limits=limits,box='bx_xfbwmcty',environmentSHA256=__import__('hashlib').sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),envOverrides={'TMPDIR':str(O),'PYTHONDONTWRITEBYTECODE':'1'},clearedEnvironment=['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','MAELSTROM_CAPTURE_INSTALL','WINE_ASSEMBLY_WASM'])
(E/'command.json').write_text(json.dumps(receipt,indent=2));sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);os.set_blocking(p.stdout.fileno(),False);total=0;why='natural';peak=0
try:
 while sel.get_map() or p.poll() is None:
  if time.monotonic()-start>wall or time.time()>=cutoff:why='wall/cutoff';break
  rss=0
  for q in pathlib.Path('/proc').iterdir():
   if not q.name.isdigit():continue
   try:
    if os.getpgid(int(q.name))==p.pid:rss+=int(next((l.split()[1] for l in (q/'status').read_text().splitlines() if l.startswith('VmRSS:')),'0'))*1024
   except (OSError,ProcessLookupError):pass
  peak=max(peak,rss)
  if rss>2684354560:why='physical RSS cap';break
  captures=sum(f.stat().st_size for d in [H/'guest',E] for f in d.rglob('*') if f.is_file())
  if captures>2097152:why='capture aggregate cap';break
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
   else:time.sleep(.03)
  except ChildProcessError:break
 try:os.killpg(p.pid,0);remaining=True
 except ProcessLookupError:remaining=False
 log.close();receipt.update(exit=p.returncode,reason=why,elapsed=time.monotonic()-start,outputBytes=total,TERM=term,KILL=kill,reaped=reaped,remainingGroup=remaining,peakGroupRSS=peak,maxRSSBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 (E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));assert not remaining
