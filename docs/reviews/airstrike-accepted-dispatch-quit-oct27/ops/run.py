import os,sys,pathlib,json,time,hashlib,shutil,resource,importlib.util,fcntl,shlex
H=pathlib.Path(__file__).parent;R=H.parent/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');M=1048576
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
sp=importlib.util.spec_from_file_location('supervisor',S);sup=importlib.util.module_from_spec(sp);sp.loader.exec_module(sup)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1')
def dump(n,v):
 p=H/(n+'.'+str(os.getpid())+'.tmp');p.write_text(json.dumps(v,indent=2)+'\n');p.replace(H/n)
def size(p):
 total=0
 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]):
  try:total+=x.lstat().st_blocks*512
  except FileNotFoundError:pass
 return total
def gate():
 peers=[]
 for p in pathlib.Path('/proc').iterdir():
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if a and pathlib.Path(os.fsdecode(a[0])).name=='codex' and b'exec' in a:peers.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 events=ROOT/'scratch/usage-watch/airstrike-accepted-dispatch-quit-oct27';sid=json.loads((events/'events.jsonl').open().readline())['thread_id']
 ev=size(events)+sum(size(p) for p in pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl'))
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (H/'wal-baseline.json').exists():dump('wal-baseline.json',wal)
 baseline=json.loads((H/'wal-baseline.json').read_text());ev+=sum(max(0,v-baseline.get(k,v)) for k,v in wal.items())
 used=size(R)+size(H)+ev;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=sum(max(0,320*M-p['rss']) for p in peers)+256*M+805306368;free=shutil.disk_usage(H).free
 q=dict(at=time.time(),memAvailable=mem,requiredRemainingRAM=required,peers=peers,free=free,future=469762048,projectedFree=free-469762048,sourceGit=size(R),ops=size(H),events=ev,used=used,reserve=40*M,allocation=128*M)
 q['pass']=mem>=required and q['projectedFree']>=2982150144 and used+40*M<=128*M and q['sourceGit']<=20*M and q['ops']<=52*M and ev<=16*M
 dump('accounting.json',q);return None if q['pass'] else 'aggregate admission rejected'
def main():
 assert gate() is None,json.loads((H/'accounting.json').read_text())
 mode,label,*args=sys.argv[1:];isgit=mode in ('git','archive')
 if mode=='archive':args=['-C','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23','archive','--format=tar','--output='+str(H/'git-sources.tar'),'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a','--',*json.loads((H/'git-paths.json').read_text())]
 cmd=['prlimit','--data=536870912','--','git',*args] if isgit else args
 out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch();err.touch()
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output bound'
  if sum(p.stat().st_size for p in H.glob('*.std*'))>M:return 'cumulative output bound'
  return gate()
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if isgit:fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if isgit else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
  (H/(label+'.supervisor-output')).write_bytes(q.pop('output'))
  q.update(commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),command=cmd,ssh=SSH,supervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),inheritedLimits={str(k):resource.getrlimit(k) for k in (2,9,0,1)},environmentSHA256=hashlib.sha256(json.dumps(sorted(os.environ.items())).encode()).hexdigest(),stdout=str(out),stderr=str(err));dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}));print(out.read_text()[:2500]);print(err.read_text()[:1000]);assert not q['stopReason'] and q['exit']==0 and q['cleanupComplete'],q
if __name__=='__main__':main()
