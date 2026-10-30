import sys,os,json,time,pathlib,subprocess,resource,hashlib,signal
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path(__file__).parent.resolve();REPO=ROOT/'repo';E=ROOT/'e'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
BASE=None
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
def admission():
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=ROOT.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in ROOT.rglob('*'))
 aggregate=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/runtime-three-0316-oct30-aggregate.json').read_text())
 sample=dict(at=time.time(),device=st.f_fsid,f_bavail=st.f_bavail,blockSize=st.f_frsize,free=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,budget=67108864,aggregate=aggregate,parentLimits=BASE)
 checks=dict(allocation=allocated<64*1048576,disk=sample['free']>=3200253952+48*1048576,forecast=sample['free']-aggregate['futureGrowthIncludingUncertaintyBuffer']>=aggregate['requiredBytes'],memory=mem>=2147483648)
 sample['checks']=checks
 if not all(checks.values()):
  path=ROOT/'first-failed-admission-pinned-relaunch.json'
  try:
   with path.open('x') as f:json.dump(sample,f)
  except FileExistsError:pass
  raise AssertionError(('first admission denial; stop all operations',checks))
 (ROOT/'latest-successful-admission-pinned-relaunch.json').write_text(json.dumps(sample))
 return sample

def check_evidence():
 assert sum(x.stat().st_size for x in E.rglob('*') if x.is_file())<=1048576,'compact E overflow'

def rows():
 out={}
 for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   s=f.read_text().rsplit(')',1)[1].split();out[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
  except (OSError,ValueError):pass
 return out
def run(name,argv,*,cwd,git=False,wall=90):
 lexical=pathlib.Path(os.path.abspath(cwd))
 assert lexical.is_relative_to(ROOT),'outside owned root before existence'
 cwd=pathlib.Path(cwd).resolve(strict=True)
 assert cwd.is_relative_to(ROOT)
 if git:assert argv[:3]==['git','-C',str(REPO)]
 assert BASE is not None,'run supervisor directly with original inherited hard limit'
 a=admission();started=time.monotonic();out=E/(name+'.stdout');err=E/(name+'.stderr')
 env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND=SSH,BOAT_NO_UPDATE='1')
 with out.open('wb') as o,err.open('wb') as e:
  def child():
   if pathlib.Path(argv[0]).name in ('node','boat'):
    resource.setrlimit(resource.RLIMIT_DATA,ORIGINAL_DATA)
   else:child_limits(git)
  if git:
   for args,expected in [(['rev-parse','--show-toplevel'],str(REPO)),(['rev-parse','--absolute-git-dir'],str(REPO/'.git'))]:
    check=subprocess.run(['git','-C',str(REPO)]+args,cwd=REPO,env=env,capture_output=True,preexec_fn=lambda:child_limits(True),timeout=10)
    assert check.returncode==0 and not check.stderr and check.stdout.decode().strip()==expected,'Git identity mismatch'
  q=subprocess.Popen(argv,cwd=cwd,stdout=o,stderr=e,preexec_fn=child,env=env,start_new_session=True)
  while q.poll() is None:
   r=rows();ids={q.pid}
   while True:
    n=len(ids);ids|={pid for pid,v in r.items() if v[0] in ids}
    if n==len(ids):break
   reason=None
   if time.monotonic()-started>wall:reason='wall'
   if sum(r.get(i,(0,0))[1] for i in ids)>512*1048576:reason='groupRSS'
   if r.get(os.getpid(),(0,0))[1]>128*1048576:reason='parentRSS'
   if out.stat().st_size+err.stat().st_size>512*1024:reason='capture'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.03)
 # Native API transfer payloads are evidence by hash, not duplicated base64.
 # Admission, subprocess argv, limits and capture enforcement stay unchanged.
 evidence_argv=[x if len(x)<4096 else {'bytes':len(x.encode()),'sha256':hashlib.sha256(x.encode()).hexdigest(),'payloadOmitted':True} for x in argv]
 rec=dict(argv=evidence_argv,cwd=str(cwd),exit=q.returncode,elapsed=time.monotonic()-started,admission=a,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size)
 check_evidence()
 (E/(name+'.json')).write_text(json.dumps(rec,indent=2));print(json.dumps({k:rec[k] for k in ['argv','cwd','exit','elapsed','stdoutBytes','stderrBytes']})[:700]);print(out.read_text()[:1200]);print(err.read_text()[:400]);return q.returncode,out.read_text()
if __name__=='__main__':
 BASE=configure_parent()
 E.mkdir(exist_ok=True)
 name=sys.argv[1];isgit=sys.argv[2]=='git';argv=sys.argv[2:]
 if isgit:argv=['git','-C',str(REPO)]+argv[1:]
 rc,_=run(name,argv,cwd=REPO,git=isgit);sys.exit(rc)
