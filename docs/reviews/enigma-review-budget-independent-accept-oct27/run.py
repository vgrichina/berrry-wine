import os,sys,pathlib,json,time,hashlib,shutil,resource,importlib.util,fcntl,shlex
H=pathlib.Path(__file__).parent; R=H.parent/'repo'; ROOT=pathlib.Path('/home/user/wine-assembly'); M=1048576
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
sp=importlib.util.spec_from_file_location('supervisor',S);sup=importlib.util.module_from_spec(sp);sp.loader.exec_module(sup)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1')
def dump(n,v):
 p=H/(n+'.tmp');p.write_text(json.dumps(v,indent=2)+'\n');p.replace(H/n)
def size(p):
 total=0
 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  try:total+=x.lstat().st_blocks*512
  except FileNotFoundError:pass
 return total
def gate(label):
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  try:
   args=(p/'cmdline').read_bytes().split(b'\0')
   if args and pathlib.Path(os.fsdecode(args[0])).name=='codex' and b'exec' in args:
    peers.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096,argvSHA256=hashlib.sha256(b'\0'.join(args)).hexdigest()))
  except (OSError,ValueError):pass
 events=ROOT/'scratch/usage-watch/enigma-review-budget-independent-accept-oct27'
 sid=json.loads((events/'events.jsonl').open().readline())['thread_id']
 sessions=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl'))
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (H/'wal-baseline.json').exists():dump('wal-baseline.json',wal)
 base=json.loads((H/'wal-baseline.json').read_text())
 external=size(events)+sum(size(p) for p in sessions)+sum(max(0,n-base.get(p,n)) for p,n in wal.items())
 used=size(R)+size(H)+external; future=24*M; free=shutil.disk_usage(H).free
 q=dict(at=time.time(),memAvailable=mem,requiredRemainingRAM=320*M+256*M+805306368,livePeers=peers,ramAccounting='Live peer RSS already reflected in MemAvailable; reserve new client320MiB conservatively plus shared child pool256MiB and headroom805306368',free=free,projectedFree=free-future,sourceGit=size(R),ops=size(H),external=external,used=used,publicationPeakAndGrowth=future,margin=8*M,reserve=8*M,allocation=128*M)
 q['pass']=mem>=q['requiredRemainingRAM'] and free-future>=2982150144 and used+future+16*M<=128*M
 dump(label+'.admission.json',q)
 return None if q['pass'] else 'fresh task-specific resource admission rejected'
def main():
 mode,label,*args=sys.argv[1:];isgit=mode=='git'
 refusal=gate(label)
 if refusal:dump(label+'.blocked.json',dict(reason=refusal,operationStarted=False));raise SystemExit(refusal)
 cmd=['prlimit','--data=536870912','--','git',*args] if isgit else args
 out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch();err.touch()
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output bound'
  if sum(p.stat().st_size for p in H.rglob('*.std*'))>M:return 'cumulative output bound'
  return gate(label)
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if isgit:fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if isgit else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
  data=q.pop('output');(H/(label+'.supervisor-output')).write_bytes(data)
  q.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),ssh=SSH,supervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},environmentSHA256=hashlib.sha256(json.dumps(sorted(os.environ.items())).encode()).hexdigest(),stdout=str(out),stderr=str(err),mount='N/A: no runtime/mount argv authorized')
  dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
 print(out.read_text()[:2500]);print(err.read_text()[:1500])
 assert not q['stopReason'] and q['exit']==0 and q['cleanupComplete'],label
if __name__=='__main__':main()
