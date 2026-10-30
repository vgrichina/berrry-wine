import sys,os,json,time,pathlib,subprocess,resource,hashlib,signal
"""Task-owned child limit topology. No inherited hard limit is raised."""
import json, os, pathlib, resource, subprocess, sys
M=1048576

def configure_parent():
    soft, hard = resource.getrlimit(resource.RLIMIT_DATA)
    if hard != resource.RLIM_INFINITY and hard < 256*M:
        raise RuntimeError('inherited DATA hard limit incompatible; stop, never raise it')
    resource.setrlimit(resource.RLIMIT_DATA, (128*M, hard))
    resource.setrlimit(resource.RLIMIT_CPU, (60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE, (12*M,12*M))
    return {'inheritedDATA':[soft,hard], 'parentDATA':list(resource.getrlimit(resource.RLIMIT_DATA)), 'policy':'parent soft128; inherited hard unchanged; Git child256 only; Python child128; physical parentRSS128 monitored by task supervisor'}

def child_limits(git=False):
    amount=(256 if git else 128)*M
    resource.setrlimit(resource.RLIMIT_DATA,(amount,amount))
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))

def selftest(owned):
    owned=pathlib.Path(owned).resolve(strict=True)
    def run(argv, *, cwd, git=False):
        lexical=pathlib.Path(os.path.abspath(os.fspath(cwd)))
        if not lexical.is_relative_to(owned): raise ValueError('outside owned root before existence check')
        p=lexical.resolve(strict=True)
        if not p.is_relative_to(owned): raise ValueError('symlink escapes owned root')
        q=subprocess.run(argv,cwd=p,preexec_fn=lambda:child_limits(git),capture_output=True,timeout=10)
        assert len(q.stdout)+len(q.stderr)<4096
        assert q.returncode==0,(q.returncode,q.stderr[:256])
        return q.stdout.decode().strip()
    rec=configure_parent(); controls={}
    for key,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-pinned-log-acceptance-publication-oct29/repo'})]:
        try:run(['/bin/pwd'],**kw)
        except (TypeError,ValueError):controls[key]='REJECTED BEFORE SPAWN'
        else:raise AssertionError('containment failed '+key)
    rec['controls']=controls
    rec['sentinel']=run(['/bin/pwd'],cwd=owned)
    rec['pythonChild']=json.loads(run([sys.executable,'-B','-c','import resource,json;print(json.dumps(list(resource.getrlimit(resource.RLIMIT_DATA))))'],cwd=owned))
    rec['gitVersion']=run(['git','-C',str(owned),'--version'],cwd=owned,git=True)
    assert rec['pythonChild']==[128*M,128*M]
    rec['PASS']=True
    print(json.dumps(rec))

ROOT=pathlib.Path(__file__).parent.resolve();REPO=ROOT/'repo';E=ROOT/'guest-poll-evidence'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
BASE=None
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
def admission():
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 roots=[ROOT,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-guest-poll-causal-runtime-oct30'),pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-compact-causal-runtime-owner133-oct30'),pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-start-game-causal-repair-owner133-oct30')]
 allocated=sum(p.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in p.rglob('*')) for p in roots if p.exists())
 sample=dict(at=time.time(),free=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,aggregateRemaining=200183808,memoryRequired=4436865024)
 sample['checks']=dict(memory=mem>=2147483648,disk=sample['free']-200183808>=3*1024**3,allocation=allocated+8*1048576<=64*1048576)
 if not all(sample['checks'].values()):
  with (E/'first-denial.json').open('x') as f:json.dump(sample,f)
  raise RuntimeError(('first genuine denial',sample))
 (E/'latest-admission.json').write_text(json.dumps(sample));return sample

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
