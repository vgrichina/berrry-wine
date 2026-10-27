import os,sys,pathlib,json,time,hashlib,shutil,resource,importlib.util,fcntl,shlex
H=pathlib.Path(__file__).parent; R=H.parent/'repo'; M=1048576
ROOT=pathlib.Path('/home/user/wine-assembly')
D=pathlib.Path('/tmp/penguin-retained-frame-recovery-oct27')
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
assert sha(S)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
sp=importlib.util.spec_from_file_location('supervisor',S);sup=importlib.util.module_from_spec(sp);sp.loader.exec_module(sup)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1')
def dump(n,v):
 p=H/(n+'.tmp');p.write_text(json.dumps(v,indent=2)+'\n');p.replace(H/n)
def size(p):
 if not p.exists():return 0
 total=p.lstat().st_blocks*512
 if p.is_dir():
  for base,dirs,files in os.walk(p):
   for n in dirs+files:
    try:total+=(pathlib.Path(base)/n).lstat().st_blocks*512
    except FileNotFoundError:pass
 return total
last=0;failure=None
def gate(force=False):
 global last,failure
 if failure:return failure
 if not force and time.monotonic()-last<1:return None
 last=time.monotonic()
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   args=(p/'cmdline').read_bytes().split(b'\0')
   if args and pathlib.Path(os.fsdecode(args[0])).name=='codex' and b'exec' in args:
    peers.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=sum(max(0,320*M-p['rss']) for p in peers)+256*M+805306368
 events=ROOT/'scratch/usage-watch/penguin-retained-raw-publication-oct27'
 sid=os.environ.get('CODEX_THREAD_ID','unknown')
 sessions=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl')) if sid!='unknown' else []
 assert sessions,'task session accounting unavailable'
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (H/'wal-baseline.json').exists():dump('wal-baseline.json',wal)
 base=json.loads((H/'wal-baseline.json').read_text())
 footprint=dict(donorRepo=size(D/'repo'),donorOps=size(D/'ops'),reportRepo=size(R),ops=size(H),events=size(events),sessions=sum(size(p) for p in sessions),positiveWAL=sum(max(0,n-base.get(p,n)) for p,n in wal.items()))
 used=sum(footprint.values());future=48*M;reserve=8*M;free=shutil.disk_usage(H).free
 q=dict(at=time.time(),memAvailable=mem,requiredRemainingRAM=required,clientCap=320*M,childPool=256*M,headroom=805306368,peers=peers,livePeersAlreadyReflectedInMemAvailable=True,footprint=footprint,used=used,future=future,reserve=reserve,allocation=128*M,freeDisk=free,projectedFree=free-future-reserve,diskFloor=2982150144)
 q['pass']=mem>=required and q['projectedFree']>=2982150144 and used+future+reserve<=128*M and all(p['rss']<=320*M for p in peers)
 if not (H/'admission.json').exists():dump('admission.json',q)
 dump('accounting.json',q)
 if not q['pass']:
  failure='aggregate admission rejected'
  if not (H/'resource-first-guard.json').exists():dump('resource-first-guard.json',q)
 return failure
def main():
 mode,label,*args=sys.argv[1:];isgit=mode=='git'
 assert gate(True) is None
 cmd=['prlimit','--data=536870912','--','git',*args] if isgit else args
 out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch(exist_ok=False);err.touch(exist_ok=False)
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output bound'
  if sum(p.stat().st_size for p in H.glob('*.std*'))>M:return 'cumulative output bound'
  return gate()
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if isgit:fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if isgit else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
  (H/(label+'.supervisor-output')).write_bytes(q.pop('output'))
  q.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),cwd=os.getcwd(),ssh=SSH,supervisorSHA256=sha(S),wrapperSHA256=sha(pathlib.Path(__file__)),inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},gitChildOnlyDATA=536870912 if isgit else None,stdout=str(out),stderr=str(err),safeEnvironment={k:os.environ.get(k) for k in ('PATH','LANG','LC_ALL','TZ','GIT_SSH_COMMAND','GIT_NO_LAZY_FETCH','GIT_OPTIONAL_LOCKS','PYTHONDONTWRITEBYTECODE','GIT_CONFIG_NOSYSTEM')})
  dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cpuSeconds','cleanupComplete')}))
 print(out.read_text()[:700]);print(err.read_text()[:700])
 assert not q['stopReason'] and q['exit']==0 and q['cleanupComplete']
if __name__=='__main__':main()
