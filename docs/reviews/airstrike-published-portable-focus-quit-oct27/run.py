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
 events=ROOT/'scratch/usage-watch/airstrike-published-portable-focus-quit-oct27'
 sid=json.loads((events/'events.jsonl').open().readline())['thread_id']
 sessions=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl'))
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (H/'wal-baseline.json').exists():dump('wal-baseline.json',wal)
 base=json.loads((H/'wal-baseline.json').read_text())
 external=size(events)+sum(size(p) for p in sessions)+sum(max(0,n-base.get(p,n)) for p,n in wal.items())
 used=size(R)+size(H)+external
 # Preserve all task buckets and the launcher's805306368B fleet future
 # reservation conservatively; materialized peer RSS/disk is already measured.
 future=max(0,192*M-used)+805306368; free=shutil.disk_usage(H).free
 remaining=sum(max(0,320*M-p['rss']) for p in peers)
 # Once a batch client has appeared it cannot become prospective again on exit.
 observed={p['pid'] for p in peers}
 for receipt in H.glob('*.admission.json'):
  observed.update(p['pid'] for p in json.loads(receipt.read_text()).get('livePeers',[]))
 prospective=0 # This task client is live and counted above; no stale future reservations.
 q=dict(at=time.time(),memAvailable=mem,requiredRemainingRAM=remaining+prospective*320*M+512*M+805306368,livePeers=peers,remainingClientGrowth=remaining,prospectiveClients=prospective,ramAccounting='MemAvailable already includes live RSS; remaining growth only, prospective clients once, shared pool once',free=free,projectedFree=free-future,sourceGit=size(R),ops=size(H),external=external,used=used,futureDiskReservation=future,publicationReserve=24*M,growthReserve=56*M,allocation=192*M,buckets=dict(sourceGit=24*M,events=24*M,ops=64*M,publication=24*M,growthReserve=56*M))
 q['pass']=mem>=q['requiredRemainingRAM'] and free-future>=2982150144 and used+80*M<=192*M and size(R)<=24*M and size(H)<=64*M and external<=24*M and all(p['rss']<=320*M for p in peers)
 dump(label+'.admission.json',q)
 return None if q['pass'] else 'fresh task-specific resource admission rejected'
def main():
 mode,label,*args=sys.argv[1:];isgit=mode=='git'
 refusal=gate(label)
 if refusal:dump(label+'.blocked.json',dict(reason=refusal,operationStarted=False));raise SystemExit(refusal)
 os.chdir(R)
 cmd=['prlimit','--data=536870912','--','git',*args] if isgit else args
 out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch();err.touch()
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output bound'
  # User limits: output2MiB per operation; DISPLAY8192B/operation,
  # cumulative DISPLAY1MiB. Original wrapper incorrectly charged retained logs.
  if sum(min(p.stat().st_size,2000 if p.suffix=='.stdout' else 1500) for p in H.glob('*.std*'))>M:return 'cumulative display bound'
  return gate(label)
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if isgit:fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if isgit else 512 if mode == "node" else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
  data=q.pop('output');(H/(label+'.supervisor-output')).write_bytes(data)
  q.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),ssh=SSH,supervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},environmentSHA256=hashlib.sha256(json.dumps(sorted(os.environ.items())).encode()).hexdigest(),stdout=str(out),stderr=str(err),mount='N/A: no runtime/mount argv authorized')
  dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
 print(out.read_text()[:2000]);print(err.read_text()[:1500])
 assert not q['stopReason'] and q['exit']==0 and q['cleanupComplete'],label
if __name__=='__main__':main()
