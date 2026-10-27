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
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if x.exists()) if p.is_dir() else p.stat().st_blocks*512
def gate():
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 events=ROOT/'scratch/usage-watch/airstrike-caption-interior-geometry-repair-oct27'; ev=size(events)
 sid=json.loads((events/'events.jsonl').open().readline())['thread_id']
 ev+=sum(size(p) for p in pathlib.Path('/home/user/.codex/sessions').glob('**/*'+sid+'.jsonl'))
 wal={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not (H/'wal-baseline.json').exists():dump('wal-baseline.json',wal)
 base=json.loads((H/'wal-baseline.json').read_text());ev+=sum(max(0,v-base.get(k,v)) for k,v in wal.items())
 used=size(H)+size(R)+ev;free=shutil.disk_usage(H).free;required=320*M+256*M+805306368
 q=dict(at=time.time(),MemAvailable=mem,required=required,existingPeerRSS='already in MemAvailable',clientCountedOnce=320*M,sharedPoolCountedOnce=256*M,used=used,events=ev,allocation=128*M,publicationGrowth=24*M,reserve=8*M,margin=8*M,controlReserve=24*M,free=free,projectedFree=free-128*M)
 q['pass']=mem>=required and used+64*M<=128*M and free-128*M>=2982150144
 dump('accounting.json',q);return None if q['pass'] else 'fresh aggregate admission denied'
def main():
 mode,label,*args=sys.argv[1:];out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch();err.touch()
 if gate():dump(label+'.json',dict(blocked=True,gitStarted=False,accounting=json.loads((H/'accounting.json').read_text())));raise SystemExit('admission denied; no retry')
 git=mode in ('git','gitpy');cmd=['prlimit','--data=536870912','--','git','-C',str(R),*args] if mode=='git' else args
 dump(label+'.command.json',dict(argv=cmd,ssh=SSH,environmentSHA256=hashlib.sha256(json.dumps(sorted(os.environ.items())).encode()).hexdigest(),inheritedLimits={str(k):resource.getrlimit(k) for k in (0,1,2,9)},cwd=os.getcwd(),mounts=[],mountValidation='No guest/Node/API or mount argv in offline Python-only task'))
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 def check():
  if out.stat().st_size+err.stat().st_size>2*M:return 'operation output cap'
  if sum(p.stat().st_size for p in H.glob('*.std*'))>M:return 'cumulative output cap'
  if size(H)+size(R)>90*M:return 'task disk cap'
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  if git:fcntl.flock(lock,fcntl.LOCK_EX)
  q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(256 if git else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
 (H/(label+'.supervisor-output')).write_bytes(q.pop('output'));dump(label+'.json',q)
 print(label,json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cleanupComplete')}))
 assert q['exit']==0 and not q['stopReason'] and q['cleanupComplete'],q
if __name__=='__main__':main()
