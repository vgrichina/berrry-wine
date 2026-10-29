import os,sys,json,pathlib,subprocess,time,resource,hashlib,signal,datetime
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path('/tmp/toyvm-ftruncate-regrowth-write-budget-oct29').resolve()
REPO=ROOT/'repo'; E=ROOT/'evidence'; E.mkdir(exist_ok=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
configure_parent()
def save(name,x):
 p=E/name; b=(json.dumps(x,indent=2)+'\n').encode(); assert len(b)<=1048576; p.write_bytes(b)
def admission(label):
 st=os.statvfs(ROOT); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 total=sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file())
 baseline=E/'resource-baseline.json';walGrowth=0;sessionGrowth=0
 if baseline.exists():
  b=json.loads(baseline.read_text())
  walGrowth=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in b['WAL'].items() if pathlib.Path(p).exists())
  sessionGrowth=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in b['sessionEvents'].items() if pathlib.Path(p).exists())
 rec=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),label=label,device=os.stat(ROOT).st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,free=st.f_bavail*st.f_frsize,MemAvailable=mem,ownedLogicalBytes=total,reservation=25165824,remainingGrowth=25165824,requiredFloor=3200253952,aggregateReceipt='/home/user/wine-assembly/scratch/usage-watch/toyvm-ftruncate-regrowth-write-budget-oct29-admission.json')
 rec.update(positiveWALGrowthCountedOnce=walGrowth,sessionEventsGrowth=sessionGrowth,accountedCurrent=total+walGrowth+sessionGrowth)
 rec['PASS']=rec['free']-rec['remainingGrowth']>=rec['requiredFloor'] and mem>=2147483648 and rec['accountedCurrent']<25165824
 save(label+'-admission.json',rec); assert rec['PASS'],rec
def run(label,argv,*,cwd,git=False,timeout=120,check=True):
 lexical=pathlib.Path(os.path.abspath(cwd)); assert lexical.is_relative_to(ROOT)
 cwd=lexical.resolve(strict=True); assert cwd.is_relative_to(ROOT)
 if git: assert argv[:3]==['git','-C',str(REPO)]
 admission(label)
 out=E/(label+'.stdout'); err=E/(label+'.stderr'); start=time.monotonic()
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,stdout=o,stderr=e,env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1'),preexec_fn=lambda:child_limits(git))
  safety=None
  while p.poll() is None:
   if time.monotonic()-start>timeout:safety='wall'
   if out.stat().st_size+err.stat().st_size>2097152:safety='capture'
   rss=0
   for pid in [os.getpid(),p.pid]:
    try:
     status=pathlib.Path('/proc')/str(pid)/'status'; r=int(next(x.split()[1] for x in status.read_text().splitlines() if x.startswith('VmRSS:')))*1024
     rss+=r
     if pid==os.getpid() and r>134217728:safety='parent RSS'
    except (FileNotFoundError,StopIteration):pass
   if rss>536870912:safety='group RSS'
   if safety:p.kill();break
   time.sleep(.02)
  rc=p.wait()
 rec=dict(argv=argv,cwd=str(cwd),exit=rc,safety=safety,elapsed=time.monotonic()-start,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size,stdoutSHA256=hashlib.sha256(out.read_bytes()).hexdigest(),stderrSHA256=hashlib.sha256(err.read_bytes()).hexdigest())
 save(label+'.json',rec)
 assert safety is None,rec
 if check:assert rc==0,rec
 return out.read_text()
def identity():
 for label,args,expected in [('toplevel',['rev-parse','--show-toplevel'],str(REPO)),('gitdir',['rev-parse','--absolute-git-dir'],str(REPO/'.git'))]:
  assert run('identity-'+label,['git','-C',str(REPO)]+args,cwd=REPO,git=True).strip()==expected
if __name__=='__main__':
 identity();print('owned Git identity PASS')
