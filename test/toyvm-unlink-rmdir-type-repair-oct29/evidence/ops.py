import sys,os,json,time,pathlib,subprocess,resource,hashlib,signal
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path(__file__).parent.resolve();REPO=ROOT/'repo';E=ROOT/'e';E.mkdir(exist_ok=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
BASE=None
def admission():
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=sum(x.stat().st_blocks*512 for x in ROOT.rglob('*') if x.is_file())
 assert allocated<24*1048576,("owned allocation",allocated)
 assert st.f_bavail*st.f_frsize>=3200253952+24*1048576
 assert mem>=2147483648
 return dict(free=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,budget=25165824,componentsMiB=dict(sourceGit=3,evidence=1,WAL=8,publication=3,uncertainty=9),positiveWALGrowthCountedOnce=True,parentLimits=BASE)
def rows():
 out={}
 for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   s=f.read_text().rsplit(')',1)[1].split();out[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
  except (OSError,ValueError):pass
 return out
def run(name,argv,*,cwd,git=False,wall=120):
 cwd=pathlib.Path(cwd).resolve(strict=True)
 assert cwd.is_relative_to(ROOT)
 if git:assert argv[:3]==['git','-C',str(REPO)]
 assert BASE is not None,'run supervisor directly with original inherited hard limit'
 a=admission();started=time.monotonic();out=E/(name+'.stdout');err=E/(name+'.stderr')
 env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND=SSH,BOAT_NO_UPDATE='1')
 with out.open('wb') as o,err.open('wb') as e:
  q=subprocess.Popen(argv,cwd=cwd,stdout=o,stderr=e,preexec_fn=lambda:child_limits(git),env=env,start_new_session=True)
  while q.poll() is None:
   r=rows();ids={q.pid}
   while True:
    n=len(ids);ids|={pid for pid,v in r.items() if v[0] in ids}
    if n==len(ids):break
   reason=None
   if time.monotonic()-started>wall:reason='wall'
   if sum(r.get(i,(0,0))[1] for i in ids)>512*1048576:reason='groupRSS'
   if r.get(os.getpid(),(0,0))[1]>128*1048576:reason='parentRSS'
   if out.stat().st_size+err.stat().st_size>2*1048576:reason='capture'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.03)
 rec=dict(argv=argv,cwd=str(cwd),exit=q.returncode,elapsed=time.monotonic()-started,admission=a,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size)
 assert sum(x.stat().st_size for x in E.rglob('*') if x.is_file())<1048576
 (E/(name+'.json')).write_text(json.dumps(rec,indent=2));print(json.dumps(rec)[:2500]);print(out.read_text()[:3500]);print(err.read_text()[:1000]);return q.returncode,out.read_text()
if __name__=='__main__':
 BASE=configure_parent()
 name=sys.argv[1];isgit=sys.argv[2]=='git';argv=sys.argv[2:]
 if isgit:argv=['git','-C',str(REPO)]+argv[1:]
 rc,_=run(name,argv,cwd=REPO,git=isgit);sys.exit(rc)
