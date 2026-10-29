import os,sys,json,pathlib,subprocess,time,hashlib,datetime,signal
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'; E=ROOT/'controls'; E.mkdir(exist_ok=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
configure_parent()
def save(name,x):
 b=(json.dumps(x,indent=2)+'\n').encode(); assert len(b)<=1048576
 (E/name).write_bytes(b)
baseline=E/'baseline.json'
if not baseline.exists():
 wal={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 save('baseline.json',{'WAL':wal})
def admission(label):
 st=os.statvfs(ROOT); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 total=sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file())
 wal=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in json.loads(baseline.read_text())['WAL'].items() if pathlib.Path(p).exists())
 a=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-regrowth-retained-runtime-independent-accept-oct29-admission.json').read_text())
 rec=dict(label=label,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),free=st.f_bavail*st.f_frsize,MemAvailable=mem,ownedBytes=total,positiveWALGrowthCountedOnce=wal,allocation=24*1048576,bucketsMiB={'sourceGit':3,'evidence':1,'WAL':8,'publication':3,'uncertainty':9},aggregateOwners=a['owners'],aggregateRemainingGrowth=a['futureGrowthIncludingUncertaintyBuffer'])
 rec['PASS']=rec['free']-rec['aggregateRemainingGrowth']>=3200253952 and mem>=2147483648 and total+wal<24*1048576
 save(label+'-admission.json',rec); assert rec['PASS'],rec
def rows():
 result={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   s=(p/'stat').read_text();s=s[s.rindex(')')+2:].split();result[int(p.name)]=(int(s[1]),int(s[21])*os.sysconf('SC_PAGE_SIZE'))
  except (OSError,ValueError):pass
 return result
def run(label,argv,*,cwd,git=False):
 lexical=pathlib.Path(os.path.abspath(cwd));assert lexical.is_relative_to(ROOT)
 cwd=lexical.resolve(strict=True);assert cwd.is_relative_to(ROOT)
 if git:assert argv[:3]==['git','-C',str(REPO)]
 admission(label);out=E/(label+'.stdout');err=E/(label+'.stderr');start=time.monotonic()
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,stdout=o,stderr=e,env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1'),preexec_fn=lambda:child_limits(git),start_new_session=True)
  safety=None
  while p.poll() is None:
   r=rows();selected={p.pid}
   while True:
    new=selected|{pid for pid,(ppid,rss) in r.items() if ppid in selected}
    if new==selected:break
    selected=new
   if time.monotonic()-start>120:safety='wall'
   if out.stat().st_size+err.stat().st_size>2*1048576:safety='capture'
   if r.get(os.getpid(),(0,0))[1]>128*1048576:safety='parentRSS'
   if sum(r.get(pid,(0,0))[1] for pid in selected|{os.getpid()})>512*1048576:safety='groupRSS'
   if safety:os.killpg(p.pid,signal.SIGKILL);break
   time.sleep(.02)
  rc=p.wait()
 rec=dict(argv=argv,cwd=str(cwd),exit=rc,safety=safety,elapsed=time.monotonic()-start,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size,stdoutSHA256=hashlib.sha256(out.read_bytes()).hexdigest(),stderrSHA256=hashlib.sha256(err.read_bytes()).hexdigest())
 save(label+'.json',rec);assert safety is None and rc==0,rec
 return out.read_text()
def git(label,*args):return run(label,['git','-C',str(REPO),*args],cwd=REPO,git=True).strip()
def identity():
 assert git('identity-top','rev-parse','--show-toplevel')==str(REPO)
 assert git('identity-gitdir','rev-parse','--absolute-git-dir')==str(REPO/'.git')
 assert git('identity-branch','branch','--show-current')=='task/toyvm-regrowth-retained-runtime-independent-accept-oct29'
if __name__=='__main__':identity();print('owned identity and admission PASS')
