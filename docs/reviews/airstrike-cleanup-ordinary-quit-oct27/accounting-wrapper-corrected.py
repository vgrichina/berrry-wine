import os,sys,pathlib,json,time,hashlib,shutil,resource,importlib.util,fcntl,shlex
H=pathlib.Path(__file__).parent
ROOT=pathlib.Path('/home/user/wine-assembly')
R=H.parent/'repo'
M=1048576
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
sp=importlib.util.spec_from_file_location('supervisor',S);sup=importlib.util.module_from_spec(sp);sp.loader.exec_module(sup)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1')
def size(p):
 for attempt in range(3):
  try:return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')]) if p.is_dir() else p.lstat().st_blocks*512
  except FileNotFoundError:
   if not p.exists():return 0
 raise RuntimeError('unstable size '+str(p))
def dump(name,q):
 p=H/(name+'.tmp');p.write_text(json.dumps(q,indent=2)+'\n');p.replace(H/name)
def gate():
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a and pathlib.Path(os.fsdecode(a[0])).name=='codex' and b'exec' in a:
    peers.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096,argvSHA256=hashlib.sha256(b'\0'.join(a)).hexdigest()))
  except (OSError,ValueError):pass
 own=size(R)+size(H)+size(ROOT/'scratch/usage-watch/airstrike-cleanup-ordinary-quit-oct27')
 # Complete fleet reservation remains conservative for unlaunched lanes. Actual
 # peer materialization already reduces free disk; credit no unknown peer bytes.
 # Own session/events and positive WAL are inside a separate measured bucket.
 sessionid=json.loads((ROOT/'scratch/usage-watch/airstrike-cleanup-ordinary-quit-oct27/events.jsonl').open().readline())['thread_id']
 sessions=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sessionid+'.jsonl'))
 assert len(sessions)==1
 eventbytes=sum(size(p) for p in sessions)
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 b=H/'wal-baseline.json'
 if not b.exists():dump('wal-baseline.json',wal)
 baseline=json.loads(b.read_text());positive=sum(max(0,n-baseline.get(p,n)) for p,n in wal.items())
 used=own+eventbytes+positive
 peerRemaining=[]
 for name in ('enigma-cleanup-startgame-oct27','alien-cleanup-menu-mission-oct27','ricochet-cleanup-round-play-oct27','penguin-causal-independent-accept-cleanup-oct27'):
  d=ROOT/'scratch/usage-watch'/name
  material=size(pathlib.Path('/tmp')/name)+size(d)
  e=d/'events.jsonl'
  if e.exists():
   sid=json.loads(e.open().readline())['thread_id']
   material+=sum(size(p) for p in pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl'))
  peerRemaining.append(dict(task=name,actual=material,remaining=max(0,96*M-material)))
 future=max(0,96*M-used)+sum(p['remaining'] for p in peerRemaining)+16*M
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 free=shutil.disk_usage(H).free
 required=sum(max(0,320*M-p['rss']) for p in peers)+max(0,5-len(peers))*320*M+256*M+805306368
 q=dict(at=time.time(),ownMaterialized=own,sessionAllocated=eventbytes,positiveWAL=positive,used=used,allocation=96*M,peerRemaining=peerRemaining,completedPenguinReservationReleased=True,coordinatorAndDrift=16*M,future=future,free=free,projectedFree=free-future,floor=2982150144,memAvailable=mem,requiredRemainingRAM=required,peers=peers,buckets=dict(sourceGit=20*M,events=16*M,ops=20*M,reserve=40*M),sourceGit=size(R),ops=size(H))
 q['pass']=q['projectedFree']>=q['floor'] and mem>=required and used+40*M<=96*M and q['sourceGit']<=20*M and q['ops']<=20*M and eventbytes+positive<=16*M and len(peers)<=5 and all(p['rss']<=320*M for p in peers)
 dump('accounting.json',q)
 return None if q['pass'] else 'aggregate admission rejected'
def main():
 assert gate() is None,json.loads((H/'accounting.json').read_text())
 mode,label,*args=sys.argv[1:]
 cmd=['prlimit','--data=536870912','--','git',*args] if mode=='git' else (args if mode=='exec' else [sys.executable,'-B',*args])
 out=H/(label+'.stdout');err=H/(label+'.stderr')
 # Open both streams before process creation; preserve separation even on setup failure.
 out.touch();err.touch()
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output limit'
  if sum(p.stat().st_size for p in H.glob('*.std*'))>M:return 'cumulative output limit'
  return gate()
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if mode=='git':fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if mode=='git' else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
  data=q.pop('output');(H/(label+'.supervisor-output')).write_bytes(data)
  q.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),ssh=SSH,supervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},stdout=str(out),stderr=str(err),environmentIdentitySHA256=hashlib.sha256(json.dumps({k:os.environ.get(k) for k in ('GIT_SSH_COMMAND','GIT_NO_LAZY_FETCH','GIT_CONFIG_NOSYSTEM','GIT_OPTIONAL_LOCKS','PYTHONDONTWRITEBYTECODE')},sort_keys=True).encode()).hexdigest())
  dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
 print(out.read_text()[:4096]);print(err.read_text()[:2048])
 assert not q['stopReason'] and q['exit']==0 and q['cleanupComplete'],q
if __name__=='__main__':main()
