import os,sys,pathlib,json,time,subprocess,resource,hashlib,shutil,fcntl
H=pathlib.Path('/tmp/alien-shooter-render-wait-attribution-oct26'); O=H/'ops'; R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly')
NODE=shutil.which('node')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH)
for k in ['NODE_OPTIONS','NODE_PATH','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']: ENV.pop(k,None)
def save(n,j): (O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def allocated(p):
 if not p.exists(): return 0
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if x.exists()) if p.is_dir() else p.stat().st_blocks*512
def admission():
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
 launcher=ROOT/'scratch/usage-watch'/H.name
 charges=dict(owned=allocated(H),session=sum(allocated(p) for p in session),launcher=allocated(launcher),futurePublication=32*2**20,reserve=8*2**20,remainingSourceGit=8*2**20,positiveWAL=0)
 # Baseline WAL allocation retained once; charge positive growth once per admission.
 wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 baseline=O/'wal-baseline.json'
 if not baseline.exists(): save('wal-baseline.json',wal)
 base=json.loads(baseline.read_text()); charges['positiveWAL']=sum(max(0,n-base.get(p,0)) for p,n in wal.items())
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a and a[0].endswith(b'/codex') and b'wine-worker' in a:
    rss=int((p/'statm').read_text().split()[1])*4096
    clients.append(dict(pid=int(p.name),rss=rss,growth=max(0,320*2**20-rss)))
  except (OSError,ValueError):pass
 components=dict(host=768*2**20,otherLightTests=128*2**20,serializedGit=512*2**20,ownTests=128*2**20,helpers=128*2**20,remainingClientGrowth=sum(c['growth'] for c in clients),completedGL=0,prospectiveClient=0)
 j=dict(at=time.time(),memAvailable=mem,required=sum(components.values()),components=components,clients=clients,charges=charges,total=sum(charges.values()),allocation=128*2**20,free=shutil.disk_usage(H).free,projectedFree=shutil.disk_usage(H).free-(48+8)*2**20,hostFloor=2982150144,residentBasis='GL closeout21:56 board; current clients already resident, charge only remaining320MiB growth once; no heavy-build floor for light tests')
 save('admission-latest.json',j)
 assert mem>=j['required'] and j['total']<=j['allocation'] and j['projectedFree']>=j['hostFloor'],j
 return j
def limits(git=False):
 os.setsid()
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*2**20,24*2**20))
 if git: resource.setrlimit(resource.RLIMIT_DATA,(512*2**20,512*2**20))
def run(a,name,git=False,cwd=None):
 admission(); start=time.monotonic(); cap=(512 if git else 128)*2**20
 before=resource.getrusage(resource.RUSAGE_CHILDREN)
 out=O/(name+'.out'); err=O/(name+'.err'); peak=0; reason=None
 with out.open('wb') as f,err.open('wb') as e:
  p=subprocess.Popen(a,cwd=cwd,env=ENV,stdout=f,stderr=e,preexec_fn=lambda:limits(git))
  while p.poll() is None:
   tree={};rss=0
   for proc in pathlib.Path('/proc').glob('[0-9]*'):
    try:
     stat=(proc/'stat').read_text().rsplit(')',1)[1].split()
     tree[int(proc.name)]=(int(stat[1]),int((proc/'statm').read_text().split()[1])*4096)
    except (OSError,ValueError,IndexError):pass
   owned={p.pid};changed=True
   while changed:
    new={pid for pid,(parent,_) in tree.items() if parent in owned};changed=not new.issubset(owned);owned.update(new)
   rss=sum(tree.get(pid,(0,0))[1] for pid in owned)
   # Include this task's small supervisor in the physical acceptance budget.
   rss+=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*4096
   peak=max(peak,rss)
   if peak>cap: reason='physical-memory'
   if time.monotonic()-start>120: reason='wall'
   if out.stat().st_size+err.stat().st_size>2*2**20: reason='output'
   if reason:os.killpg(p.pid,9)
   time.sleep(.01)
  rc=p.wait()
 after=resource.getrusage(resource.RUSAGE_CHILDREN)
 cpu=after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime
 j=dict(argv=a,cwd=str(cwd),exit=rc,wall=time.monotonic()-start,cpu=cpu,peakRSS=peak,physicalCap=cap,reason=reason,outputBytes=out.stat().st_size+err.stat().st_size,gitDATAChildOnly=git,physicalBasis='aggregate child process tree plus Python supervisor sampled RSS')
 save(name+'.json',j)
 if rc or reason:
  if not (O/'first-failure.json').exists():save('first-failure.json',j)
  raise RuntimeError(j)
 return out.read_text().strip()
def node(code,name):return run([NODE,'--max-old-space-size=64','-e',code],name,cwd=R if R.exists() else H)
def git(*a):
 # Shared Git lanes cooperate using one lock; never overlap our tests.
 with open('/tmp/wine-assembly-light-git.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  return run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-C',str(R),*a], 'git-'+str(time.time_ns()),True)
if __name__=='__main__':
 if sys.argv[1]=='startup':
  node("console.log(JSON.stringify({exec:process.execPath,args:process.execArgv,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(NODE|WINE)/.test(k))),limits:require('fs').readFileSync('/proc/self/limits','utf8')}))",'node-startup')
 elif sys.argv[1]=='test':run([NODE,'--max-old-space-size=64',str(R/'test/test-render-wait-attribution.js')],'acceptance',cwd=R)
