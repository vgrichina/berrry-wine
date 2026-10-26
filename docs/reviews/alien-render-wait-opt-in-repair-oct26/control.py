import os,sys,pathlib,json,time,subprocess,resource,hashlib,shutil,fcntl,signal
H=pathlib.Path('/tmp/alien-render-wait-opt-in-repair-oct26'); O=H/'ops'; R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); D=pathlib.Path('/tmp/alien-shooter-render-wait-attribution-oct26/repo')
CAND='864733e0ca72eaac61d4de1aaad8d080362ea63e'; BRANCH='task/'+H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH)
for k in ['NODE_OPTIONS','NODE_PATH','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']: ENV.pop(k,None)
def save(n,j):
 p=O/n; t=p.with_suffix('.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def allocated(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if x.exists()) if p.is_dir() else p.stat().st_blocks*512
def admission():
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a and a[0].endswith(b'/codex'):
    clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096,argv=[x.decode() for x in a if x]))
  except (OSError,ValueError):pass
 wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (O/'wal-baseline.json').exists():save('wal-baseline.json',wal)
 base=json.loads((O/'wal-baseline.json').read_text())
 session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
 charges=dict(owned=allocated(H),launcher=allocated(ROOT/'scratch/usage-watch'/H.name),session=sum(allocated(p) for p in session),positiveWALOnce=sum(max(0,n-base.get(p,0)) for p,n in wal.items()),sourceGitPublicationAllowance=6*2**20,future=16*2**20,reserve=8*2**20)
 comp=dict(host=768*2**20,sharedChildPool=256*2**20,residentGrowthOnce=len(clients)*64*2**20,prospectiveUnlaunched=0)
 free=shutil.disk_usage(H).free
 # Conservatively retain the entire remaining allocation for this task, the
 # other three new tasks, and the existing 64MiB task reservation.
 peers={'gl-transient-accounting-independent-publication-oct26':64,'civ2-capture-reserve-independent-accept-oct26':64,'enigma-canonical-msg-completion-hook-repair-oct26':96,'ricochet-detached-cleanup-independent-publication-oct26':80}
 peerRemaining=sum(max(0,n*2**20-allocated(pathlib.Path('/tmp')/name)-allocated(ROOT/'scratch/usage-watch'/name)) for name,n in peers.items())
 remaining=max(0,64*2**20-charges['owned']-charges['launcher']-charges['session']-charges['positiveWALOnce'])
 projected=free-peerRemaining-remaining
 j=dict(at=time.time(),memAvailable=mem,required=sum(comp.values()),components=comp,clients=clients,charges=charges,total=sum(charges.values()),allocation=64*2**20,free=free,projectedFree=projected,floor=2982150144,residentBasis='RSS already deducted from MemAvailable; future64MiB each once, prospective320MiB is estimate only',limits=dict(gitDATAChildOnly=512*2**20,gitAggregatePhysical=256*2**20,testAggregatePhysical=128*2**20,nodeHeapSeparate=64*2**20,cpu=90,wall=120,file=24*2**20,output=2*2**20,excerpt=8192))
 save('admission-latest.json',j)
 assert mem>=j['required'] and j['total']<=j['allocation'] and projected>=j['floor'],json.dumps(j)[:2000]
 return j
def limits(git):
 os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*2**20,24*2**20))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(512*2**20,512*2**20))
def run(a,name,git=False,cwd=None):
 admission();start=time.monotonic();cap=(256 if git else 128)*2**20;peak=0;reason=None
 before=resource.getrusage(resource.RUSAGE_CHILDREN)
 out=O/(name+'.out');err=O/(name+'.err')
 with out.open('wb') as f,err.open('wb') as e:
  p=subprocess.Popen(a,cwd=cwd,env=ENV,stdout=f,stderr=e,preexec_fn=lambda:limits(git))
  while p.poll() is None:
   tree={}
   for x in pathlib.Path('/proc').glob('[0-9]*'):
    try:
     st=(x/'stat').read_text().rsplit(')',1)[1].split();tree[int(x.name)]=(int(st[1]),int((x/'statm').read_text().split()[1])*4096,(int(st[11])+int(st[12]))/os.sysconf('SC_CLK_TCK'))
    except (OSError,ValueError,IndexError):pass
   owned={p.pid};changed=True
   while changed:
    n={pid for pid,(par,_,_) in tree.items() if par in owned};changed=not n.issubset(owned);owned.update(n)
   # Include supervisor and its pool-wrapper parent, plus all child descendants.
   rss=sum(tree.get(pid,(0,0,0))[1] for pid in owned|{os.getpid(),os.getppid()});peak=max(peak,rss)
   used=resource.getrusage(resource.RUSAGE_CHILDREN)
   aggregateCPU=used.ru_utime+used.ru_stime-before.ru_utime-before.ru_stime+sum(tree.get(pid,(0,0,0))[2] for pid in owned)
   if aggregateCPU>90:reason='aggregate-cpu'
   if rss>cap:reason='physical'
   if time.monotonic()-start>120:reason='wall'
   if out.stat().st_size+err.stat().st_size>2*2**20:reason='output'
   if reason:os.killpg(p.pid,signal.SIGKILL)
   time.sleep(.005)
  rc=p.wait()
 after=resource.getrusage(resource.RUSAGE_CHILDREN)
 fixtures={str(p):sha(p) for x in a if (p:=pathlib.Path(x)).is_file() and p.suffix in ['.js','.py']}
 if a[0]=='/usr/local/bin/node' and (O/'challenge.js').exists():fixtures[str(O/'challenge.js')]=sha(O/'challenge.js')
 j=dict(argv=a,cwd=str(cwd),exit=rc,wall=time.monotonic()-start,cpu=after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime,peakRSS=peak,cap=cap,reason=reason,outputBytes=out.stat().st_size+err.stat().st_size,gitDATAChildOnly=git,fixtureHashes=fixtures,supervision='sampled process tree + supervisor + execution-pool wrapper')
 save(name+'.json',j)
 if rc or reason:raise RuntimeError(j)
 return out.read_text().strip()
def git(*args):
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  return run(['/usr/bin/git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-C',str(R),*args],'git-'+str(time.time_ns()),True)
if __name__=='__main__':
 if sys.argv[1]=='git':print(git(*sys.argv[2:])[:8192])
 elif sys.argv[1]=='node':print(run(['/usr/local/bin/node','--max-old-space-size=64',*sys.argv[3:]],sys.argv[2],cwd=R)[:8192])
 elif sys.argv[1]=='python':print(run(['/usr/bin/python3',*sys.argv[3:]],sys.argv[2],cwd=R)[:8192])
