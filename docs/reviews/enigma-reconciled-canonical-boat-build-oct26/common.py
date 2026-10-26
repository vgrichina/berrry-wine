import pathlib,os,json,hashlib,subprocess,resource,shutil,time,signal,fcntl,sys
H=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26');O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly')
SRC=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26/source');REV='e8bceb042bc3eff6bab73642988be29a7522287e';BR='task/'+H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node';POOL=str(ROOT/'scratch/usage-watch/light-execution-pool-oct26.py')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(j,indent=2)+'\n');os.replace(t,p)
def alloc(p):
 seen=set();n=0
 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  try:s=q.lstat()
  except FileNotFoundError:continue
  k=(s.st_dev,s.st_ino)
  if k not in seen:n+=s.st_blocks*512;seen.add(k)
 return n
def gate(stage):
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   c=p.joinpath('cmdline').read_bytes()
   if b'/bin/codex' in c and (b'exec\0' in c or b'resume\0' in c):clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024))
  except (OSError,IndexError):pass
 baseline=json.load(open(O/'db-baseline.json'));wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in baseline.items())
 session=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
 actual=dict(own=alloc(H),launcher=alloc(ROOT/'scratch/usage-watch'/H.name),session=session,positiveWAL=wal)
 # Full remaining task allowance, inclusive of all future categories and reserve.
 used=sum(actual.values());remaining=max(0,83886080-used)
 # GL runtime task released ccc3be6c, coordinator replaced it with the bounded
 # 64 MiB offline repair (board 23:40:51). Existing released bytes stay in free.
 # Alien repair released f4455d87; coordinator dispatched a new 64 MiB
 # independent acceptance at 23:45:28. Preserve that unfinished reservation.
 peerCaps={'alien-terminal-failfast-independent-accept-oct26':64,'gl-runner-mutable-evidence-namespace-repair-oct26':64}
 peers={n:max(0,cap*1048576-alloc(pathlib.Path('/tmp')/n)-alloc(ROOT/'scratch/usage-watch'/n)) for n,cap in peerCaps.items()}
 free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 need=(768+256+64*len(clients))*1048576
 j=dict(at=time.time(),stage=stage,actual=actual,used=used,allocation=83886080,ownRemaining=remaining,peerRemaining=peers,free=free,projectedFree=free-remaining-sum(peers.values()),floor=2982150144,memAvailable=mem,requiredMemory=need,clients=clients,residentRSSAlreadyDeducted=True,positiveWALCountedOnce=True,allocationCategoriesMiB=dict(compressed=8,git=16,modulesReports=16,sessionEventsWAL=16,futurePublication=16,reserve=8))
 j['pass']=used<=83886080 and j['projectedFree']>=2982150144 and mem>=need
 save('admission-'+stage+'.json',j);assert j['pass'],j
def limits(git):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def supervised(cmd,git=False,label='command',cwd=None,inputPath=None):
 gate(label)
 cap=(256 if git else 128)*1048576;start=time.monotonic();peak=0;peakcpu=0;buf=bytearray();reason='natural';tracked={}
 lock=open('/tmp/wine-ops-production-git.lock','a') if git else None
 if lock:fcntl.flock(lock,fcntl.LOCK_EX)
 try:
  p=subprocess.Popen(cmd,stdin=open(inputPath,'rb') if inputPath else subprocess.DEVNULL,cwd=cwd or R,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=lambda:limits(git),env=dict(os.environ,TMPDIR=str(O),GIT_SSH_COMMAND=SSH));os.set_blocking(p.stdout.fileno(),False)
  while True:
   stats={}
   for q in pathlib.Path('/proc').glob('[0-9]*'):
    try:
     s=q.joinpath('stat').read_text().split(') ')[1].split();stats[int(q.name)]=(int(s[1]),int(s[2]),int(s[11])+int(s[12]),int(s[21])*4096,s[19])
    except (OSError,IndexError,ValueError):pass
   owned={p.pid};changed=True
   while changed:
    old=len(owned);owned|={pid for pid,v in stats.items() if v[0] in owned};changed=len(owned)!=old
   owned|={pid for pid,v in stats.items() if v[1]==p.pid}
   supervisors={os.getpid()};parent=os.getppid()
   for _ in range(3):
    if parent not in stats:break
    try:line=pathlib.Path('/proc/'+str(parent)+'/cmdline').read_bytes()
    except OSError:break
    if b'python3' not in line:break
    supervisors.add(parent);parent=stats[parent][0]
   rss=sum(stats.get(pid,(0,0,0,0))[3] for pid in owned|supervisors)
   for pid in owned:
    if pid in stats:tracked[(pid,stats[pid][4])]=stats[pid][2]
   cpu=sum(tracked.values())/os.sysconf('SC_CLK_TCK');peak=max(peak,rss);peakcpu=max(peakcpu,cpu)
   try:buf.extend(os.read(p.stdout.fileno(),65536))
   except BlockingIOError:pass
   if len(buf)>2097152:reason='output'
   elif rss>cap:reason='physical-memory'
   elif cpu>90:reason='cpu'
   elif time.monotonic()-start>120:reason='wall'
   elif shutil.disk_usage(H).free<2982150144:reason='disk'
   if reason!='natural':break
   if p.poll() is not None:
    buf.extend(p.stdout.read() or b'');break
   time.sleep(.01)
  if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
  p.wait()
  # Group descendants must not survive the command.
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  (O/(label+'-output.log')).write_bytes(buf[:2097152]);save(label+'-execution.json',dict(argv=cmd,cwd=str(cwd or R),exit=p.returncode,reason=reason,peakSampledRSS=peak,physicalCap=cap,cpu=peakcpu,wall=time.monotonic()-start,outputBytes=len(buf),limits=dict(cpu=90,wall=120,file=25165824,output=2097152,excerpt=8192,gitDATA=536870912 if git else 'unchanged inherited',nodeHeap64='separate from physical cap'),descendantsTracked=len(tracked),supervisorIncluded=True))
  assert reason=='natural' and p.returncode==0 and len(buf)<=2097152,(label,reason,p.returncode,buf[:8192].decode(errors='replace'))
  return bytes(buf)
 finally:
  if lock:lock.close()
def pool(cmd,git=False,label='command',cwd=None,inputPath=None):
 req=O/'request.json';req.write_text(json.dumps(dict(cmd=cmd,git=git,label=label,cwd=str(cwd or R),inputPath=str(inputPath) if inputPath else None)))
 p=subprocess.run(['python3',POOL,'--slots','2' if git else '1','--','python3',str(O/'invoke.py'),str(req)],capture_output=True)
 assert p.returncode==0,p.stdout[:8192]+p.stderr[:8192]
 return (O/(label+'-output.log')).read_bytes()
seq=0
def g(*args,cwd=None):
 global seq
 seq+=1
 return pool(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*args],git=True,label='git-'+str(os.getpid())+'-'+str(seq),cwd=cwd)
