import pathlib,os,sys,json,time,hashlib,shutil,resource,subprocess,signal,fcntl
H=pathlib.Path('/tmp/ricochet-readback-measured-client-accept-oct26'); O=H/'ops'; REPO=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); LOG=ROOT/'scratch/usage-watch'/H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name,j):
 p=O/name;t=p.with_suffix('.new');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def alloc(p):
 if not p.exists():return 0
 seen=set();n=0
 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  try:s=q.lstat()
  except FileNotFoundError:continue
  k=s.st_dev,s.st_ino
  if k not in seen:n+=s.st_blocks*512;seen.add(k)
 return n
def gate(label):
 b=O/'wal-baseline.json'
 if not b.exists():save(b.name,{str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')})
 wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in json.loads(b.read_text()).items())
 sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'));assert len(sessions)==1
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if not a[0].endswith(b'/codex') or b'exec' not in a:continue
   rss=int((p/'status').read_text().split('VmRSS:')[1].split()[0])*1024
   clients.append(dict(pid=int(p.name),rss=rss,argv=[x.decode() for x in a if x],futureGrowth=67108864))
  except (OSError,IndexError):pass
 charges=dict(local=alloc(H),session=alloc(sessions[0]),events=alloc(LOG),dispatch=sum(alloc(p) for p in LOG.parent.glob(LOG.name+'*') if p.is_file()),positiveWALOnce=wal,future=25165824,reserve=8388608,publication=8388608)
 # Four measured-client launches have occurred; no future launch is authorized here.
 required=805306368*2+268435456+len(clients)*67108864
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 free=shutil.disk_usage(H).free
 # Conservatively retain all three peer allocations plus CivII64MiB and own unspent allocation.
 remaining=3*100663296+67108864+max(0,100663296-sum(v for k,v in charges.items() if k not in ('future','reserve','publication')))
 j=dict(label=label,at=time.time(),charges=charges,total=sum(charges.values()),allocation=100663296,memAvailable=mem,requiredMemory=required,clients=clients,unlaunchedClients=0,hostFree=free,remainingPermittedGrowth=remaining,projectedFree=free-remaining,diskFloor=2982150144)
 j['pass']=j['total']<=j['allocation'] and mem>=required and j['projectedFree']>=j['diskFloor'];save('admission-'+label+'.json',j)
 assert j['pass'],{k:v for k,v in j.items() if k!='clients'}
 return j
def rows():
 r={}
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=(p/'stat').read_text();a=s[s.rfind(')')+2:].split();r[int(p.name)]=(int(a[1]),a[19],int(a[21])*4096,(int(a[11])+int(a[12]))/100,a[0])
  except (OSError,IndexError,ValueError):pass
 return r
def run(label,argv,git=False):
 gate(label);lock=None
 if git:
  lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 cap=268435456 if git else 134217728
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
  if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(O))
 start=time.monotonic();known={};peak=cpu=0;n=0;reason='natural';eof=False
 p=subprocess.Popen(argv,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);os.set_blocking(p.stdout.fileno(),False)
 with (O/(label+'.output')).open('wb') as out:
  while True:
   rr=rows();owned={os.getpid(),p.pid,os.getppid()}
   while True:
    more={pid for pid,s in rr.items() if s[0] in owned}-owned
    if not more:break
    owned.update(more)
   known.update({pid:rr[pid] for pid in owned if pid in rr})
   live={pid:s for pid,s in rr.items() if pid in known and known[pid][1]==s[1] and s[4]!='Z'}
   peak=max(peak,sum(s[2] for s in live.values()));cpu=max(cpu,sum(s[3] for s in known.values()))
   try:
    b=os.read(p.stdout.fileno(),8192);eof=not b
   except BlockingIOError:b=b''
   n+=len(b);out.write(b)
   if n>2097152:reason='output'
   if peak>cap:reason='physicalRSS'
   if cpu>=90:reason='CPU'
   if time.monotonic()-start>=120:reason='wall'
   if reason!='natural' or (p.poll() is not None and eof):break
   time.sleep(.005)
  # Track descendant identities, including children that changed process groups.
  for pid,s in live.items():
   if pid not in (os.getpid(),os.getppid()):
    try:os.kill(pid,signal.SIGKILL)
    except ProcessLookupError:pass
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait(timeout=1)
 if lock:lock.close()
 j=dict(argv=argv,executable=shutil.which(argv[0]),returncode=p.returncode,reason=reason,wall=time.monotonic()-start,peakPhysicalAggregate=peak,physicalCap=cap,cpu=cpu,outputBytes=n,limits=dict(CPU=90,wall=120,file=25165824,output=2097152,excerpt=8192,GitDataChildOnly=536870912 if git else None),inheritedSupervisorLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},ownedIdentities={str(pid):s[1] for pid,s in known.items() if pid!=os.getpid()});save(label+'.json',j)
 assert j['returncode']==0 and reason=='natural',j
 assert n<=8192,'excerpt guard; retain full output without printing'
 print((O/(label+'.output')).read_text(),end='')
if __name__=='__main__':
 if sys.argv[1]=='gate':print(json.dumps({k:v for k,v in gate(sys.argv[2]).items() if k!='clients'}))
 else:run(sys.argv[2],sys.argv[3:],sys.argv[1]=='git')
