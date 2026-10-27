import sys,os,json,pathlib,hashlib,shutil,time,importlib.util,subprocess,resource,fcntl
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/enigma-production-owner-boundary-independent-accept-oct27');O=H/'ops'
R=pathlib.Path('/tmp/enigma-process-ownership-controller-repair-oct27/repo')
SUP=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
CANDIDATE='f7d14e7d965a9671e4ea18da461df85b90affdad'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
POOL='/home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):
 p=O/n;t=p.with_suffix('.new');t.write_text(json.dumps(v,indent=2)+'\n');t.replace(p)
def allocated(paths):
 seen=set();total=0
 for p in paths:
  for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
   try:s=q.lstat()
   except FileNotFoundError:continue
   key=(s.st_dev,s.st_ino)
   if key not in seen:total+=s.st_blocks*512;seen.add(key)
 return total
def gate(label):
 b=json.loads((O/'baseline.json').read_text());codex=pathlib.Path('/home/user/.codex')
 sessions=list((codex/'sessions/2026/10/27').glob('*'+b['thread']+'*'))
 measured=dict(own=allocated([H]),eventsSessions=allocated([pathlib.Path(b['launch']),*sessions]),positiveWAL=sum(max(0,allocated([p])-b['wal'].get(str(p),0)) for p in codex.glob('*.sqlite-wal')))
 used=sum(measured.values());free=shutil.disk_usage(H).free
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(p/'cmdline').read_bytes()
   if b'/bin/codex' in cmd:clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096,own=b['thread'].encode() in cmd))
  except OSError:pass
 own=[x for x in clients if x['pid']==b['clientPID']]
 v=dict(at=time.time(),label=label,measured=measured,used=used,allocation=33554432,peerFuture=117440512,free=free,projectedFree=free-max(0,33554432-used)-117440512,MemAvailable=mem,clients=clients,newClientReserve=335544320,activeFutureClientReserve=402653184,testPoolReserve=134217728,physicalHeadroom=805306368,requiredAvailable=1677721600,positiveWALCountedOnce=True)
 v['ownClient']=own
 v['pass']=used+8388608<=33554432 and v['projectedFree']>=2982150144 and mem>=v['requiredAvailable'] and len(own)==1 and own[0]['rss']<=335544320
 save('admission-'+label+'.json',v)
 if not v['pass']:raise RuntimeError(v)
 return v
def run(label,argv,git=False):
 gate(label)
 assert sha(SUP)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 spec=importlib.util.spec_from_file_location('standing_supervisor',SUP);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 with open('/tmp/wine-ops-production-git.lock' if git else O/'test.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  r=s.supervise(argv,rss_limit=268435456 if git else 134217728,cpu_limit=90,wall_limit=120,output_limit=2097152,check=lambda:'disk floor' if shutil.disk_usage(H).free<2982150144 else None)
 (O/(label+'-output.log')).write_bytes(r.pop('output'));save(label+'-execution.json',dict(r,argv=argv))
 print(json.dumps(r));print((O/(label+'-output.log')).read_text()[:8192])
 return r
if __name__=='__main__':
 if sys.argv[1]=='git-direct':
  def limit():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  r=subprocess.run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*sys.argv[2:]],preexec_fn=limit,env=dict(os.environ,GIT_SSH_COMMAND=SSH,TMPDIR=str(O)))
  sys.exit(r.returncode)
 label=sys.argv[1];isgit=sys.argv[2]=='git'
 argv=[sys.executable,__file__,'git-direct',*sys.argv[3:]] if isgit else [sys.executable,str(O/'observe-boundary.py')]
 r=run(label,argv,isgit);sys.exit(1 if r['stopReason'] else r['exit'] or 0)
