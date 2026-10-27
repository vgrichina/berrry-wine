import os,sys,time,json,pathlib,subprocess,signal,resource,ctypes,re,hashlib,shutil
H=pathlib.Path(__file__).parent; T=H.parent
ctypes.CDLL(None).prctl(36,1,0,0,0)
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(4194304,4194304))
env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','WINE_ASSEMBLY_WASM','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def stop(p):
 term=kill=False
 try:os.killpg(p.pid,signal.SIGTERM);term=True
 except ProcessLookupError:pass
 end=time.monotonic()+.7
 while time.monotonic()<end:
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
def run(argv,name,wall):
 E=H/name;E.mkdir(exist_ok=False)
 mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 assert mem>=2684354560+268435456+805306368
 assert shutil.disk_usage('/tmp').free-100663296>=2982150144
 start=time.monotonic();log=open(E/'output.log','wb')
 p=subprocess.Popen(argv,cwd=T/'runner',env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,preexec_fn=limits)
 save(name+'/command.json',dict(argv=argv,pid=p.pid,pgid=p.pid,startedAt=time.time(),memAvailable=mem,node=NODE,environmentSha256=hashlib.sha256(json.dumps(env,sort_keys=True).encode()).hexdigest(),removedEnvironment=['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','WINE_ASSEMBLY_WASM','NODE_OPTIONS','NODE_PATH'],limits=dict(oldspaceMiB=512,arenaMiB=512,cpu=90,wall=wall,fileBytes=4194304,textLogBytes=524288,captureBytes=16777216,physicalGroupBytes=2147483648,remoteAllocation=100663296)))
 why='natural';peak=0;maxOwned=0
 try:
  while p.poll() is None:
   rss=0
   for q in pathlib.Path('/proc').iterdir():
    if not q.name.isdigit():continue
    try:
     s=(q/'stat').read_text().split(') ',1)[1].split()
     if int(s[2])==p.pid:rss+=int((q/'statm').read_text().split()[1])*4096
    except (OSError,ValueError,IndexError):pass
   peak=max(peak,rss);owned=sum(q.stat().st_size for q in T.rglob('*') if q.is_file());maxOwned=max(maxOwned,owned)
   if time.monotonic()-start>wall:why='wall-guard';break
   if rss>2147483648:why='physical-guard';break
   if (E/'output.log').stat().st_size>524288:why='text-guard';break
   if sum(q.stat().st_size for q in H.rglob('*.png'))>16777216:why='capture-guard';break
   if owned+8388608>100663296:why='disk-guard';break
   time.sleep(.025)
 finally:
  receipt=stop(p);log.close();receipt.update(reason=why,elapsed=time.monotonic()-start,peakGroupRSS=peak,maxTaskOwnedBytes=maxOwned,box='bx_pj94q932',state='RUNNING; coordinator owns shutdown03:20UTC',expiry='2026-10-27T03:34:40Z')
  save(name+'/terminal.json',receipt)
 return receipt
if sys.argv[1]=='startup':
 code=(H/'startup.cjs').read_text();j=run([NODE,'--max-old-space-size=512','-e',code],'startup',20);assert j['returncode']==0 and j['reason']=='natural' and not j['remainingGroup'],j;print(json.dumps(j))
else:
 assert sys.argv[1]=='guest'
 assert time.time()+90<1793070600,'guest must finish before03:10UTC'
 assert json.load(open(H/'startup/terminal.json'))['returncode']==0
 # Capacity is reserved before launch; release the reserved extents for actual PNG writes.
 reserve=H/'capture-reservation';f=open(reserve,'wb');os.posix_fallocate(f.fileno(),0,16777216);f.close()
 save('capture-reservation.json',dict(bytes=16777216,perImage=4194304,images=4,dimensions=[840,660],allocatedBeforeGuest=True));reserve.unlink()
 j=run(json.load(open(H/'decision-args.json')),'decision',90);print(json.dumps(j))
