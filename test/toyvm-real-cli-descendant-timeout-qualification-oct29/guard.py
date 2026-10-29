import os,pathlib,json,resource,subprocess,time,signal,hashlib,ctypes,sys
OWN=pathlib.Path('/tmp/toyvm-real-cli-descendant-timeout-qualification-oct29').resolve()
REPO=OWN/'repo'; E=REPO/'test/toyvm-real-cli-descendant-timeout-qualification-oct29'; ROOT=pathlib.Path('/home/user/wine-assembly'); TASK=E.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
M=1024**2
AD=ROOT/'scratch/usage-watch'/f'{TASK}-admission.json'; DP=ROOT/'scratch/usage-watch'/f'{TASK}-dispatch.json'
def save(name,obj):
 p=E/name; data=(json.dumps(obj,sort_keys=True,indent=2)+'\n').encode(); assert len(data)<M
 p.write_bytes(data)
def contained(cwd):
 p=pathlib.Path(cwd).resolve()
 if p!=OWN and OWN not in p.parents:raise ValueError('outside owned task: '+str(p))
 if not p.is_dir():raise ValueError('cwd missing')
 return p
def physical(p):
 return sum(x.stat().st_blocks*512 for x in p.rglob('*') if x.is_file())
def admission(label):
 a=json.loads(AD.read_text()); v=os.statvfs(OWN); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 b=json.loads((E/'baseline.json').read_text()); wal=sum(p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
 r=dict(at=time.time(),label=label,device=os.stat(OWN).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,freeBytes=v.f_bavail*v.f_frsize,aggregate=a['aggregate'],admissionSHA256=hashlib.sha256(AD.read_bytes()).hexdigest(),forecastRemaining=a['aggregate'],requiredBytes=a['requiredBytes'],MemAvailable=mem,memRequired=a['memRequired'],ownPhysicalBytes=physical(OWN),positiveSharedWALGrowthCountedOnce=max(0,wal-b['sharedWALBaseline']),allocation=24*M)
 r['PASS']=r['freeBytes']-r['forecastRemaining']>=r['requiredBytes'] and mem>=r['memRequired'] and r['ownPhysicalBytes']+r['positiveSharedWALGrowthCountedOnce']<24*M
 with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:save('admission-failure.json',r);raise RuntimeError('admission failed')
 return r
def rows():
 r={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   s=(p/'stat').read_text().rsplit(')',1)[1].split();r[int(p.name)]=dict(start=s[19],ppid=int(s[1]),rss=max(0,int(s[21]))*4096,cpu=sum(int(s[i]) for i in (11,12,13,14))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError):pass
 return r
def lower(k,n):
 s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,min(h,n) if h!=-1 else n))
def run(label,argv,*,cwd,git=False,check=True):
 cwd=contained(cwd);admission(label)
 def limits():
  lower(resource.RLIMIT_CPU,90);lower(resource.RLIMIT_FSIZE,12*M)
  if git:lower(resource.RLIMIT_DATA,256*M)
  elif pathlib.Path(argv[0]).name.startswith('python'):lower(resource.RLIMIT_DATA,128*M)
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(json.loads((ROOT/'scratch/usage-watch'/f'{TASK}-object-stores.json').read_text())['stores']),PYTHONDONTWRITEBYTECODE='1')
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 start=time.monotonic();seen={};peak=0;reason=None
 with (E/(label+'.stdout')).open('wb') as out,(E/(label+'.stderr')).open('wb') as err:
  p=subprocess.Popen(argv,cwd=str(cwd),env=env,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True)
  while p.poll() is None:
   rs=rows();owned={p.pid}
   for _ in range(12):owned.update(pid for pid,r in rs.items() if r['ppid'] in owned)
   selected={pid:r for pid,r in rs.items() if pid in owned or (pid in seen and seen[pid]['start']==r['start'])};seen.update(selected)
   group=sum(r['rss'] for r in selected.values());peak=max(peak,group)
   reason=('physical RSS' if any(r['rss']>128*M for r in selected.values()) or group>512*M else 'CPU' if sum(r['cpu'] for r in selected.values())>90 else 'wall' if time.monotonic()-start>120 else 'capture' if os.fstat(out.fileno()).st_size+os.fstat(err.fileno()).st_size>2*M else None)
   if reason:break
   time.sleep(.02)
  if reason:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  p.wait(timeout=5)
 # All still-owned descendants are cleaned even after normal exit.
 for pid,r in seen.items():
  cur=rows().get(pid)
  if cur and cur['start']==r['start']:
   try:os.kill(pid,signal.SIGKILL)
   except ProcessLookupError:pass
 for pid in seen:
  try:os.waitpid(pid,os.WNOHANG)
  except ChildProcessError:pass
 rec=dict(argv=argv,cwd=str(cwd),exit=p.returncode,reason=reason,wall=time.monotonic()-start,peakPhysicalGroupRSS=peak,stdoutBytes=(E/(label+'.stdout')).stat().st_size,stderrBytes=(E/(label+'.stderr')).stat().st_size)
 save(label+'.json',rec)
 if reason or (check and p.returncode):raise RuntimeError(label+' rejected; see receipt')
 return (E/(label+'.stdout')).read_text()
def git(label,args,*,cwd,mutate=False,init=False):
 cwd=contained(cwd)
 if cwd!=REPO:raise ValueError('Git cwd must be owned repo')
 if init:
  if (REPO/'.git').exists():raise ValueError('already initialized')
 elif mutate:
  for flag,expected in [('--show-toplevel',REPO),('--absolute-git-dir',REPO/'.git')]:
   result=run(label+'-'+flag[2:],['git','-C',str(REPO),'rev-parse',flag],cwd=cwd,git=True)
   if pathlib.Path(result.strip()).resolve()!=expected:raise RuntimeError('Git identity mismatch')
 return run(label,['git','-C',str(REPO),*args],cwd=cwd,git=True)
def bootstrap():
 E.mkdir(parents=True,exist_ok=True)
 for path,pin in [(DP,'c3d964f8bf879688c233eeb049516c22e54fa12955600c11e4b9b21a5f7995ff'),(AD,'c08f4c9b190ca45ea3adceb42cbff676803e0d575708fecab7ff5515029b3ab9')]:assert hashlib.sha256(path.read_bytes()).hexdigest()==pin
 wal=sum(p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
 session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
 save('baseline.json',dict(at=time.time(),sessionPath=[str(x) for x in session],sessionID=os.environ['CODEX_THREAD_ID'],sharedWALBaseline=wal,initialPositiveSharedWAL=wal,positiveGrowthCount='once above initial baseline',inheritedLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE,resource.RLIMIT_AS)},allocationRetained=True))
 tests=[]
 for kw in [{},{'cwd':ROOT},{'cwd':pathlib.Path('/tmp/toyvm-real-backend-caller-qualification-oct29')},{'cwd':'/'}]:
  try:run('forbidden-sentinel',['/usr/bin/touch',str(E/'FORBIDDEN')],**kw);raise AssertionError('invalid cwd spawned')
  except (TypeError,ValueError):tests.append(str(kw)+' rejected')
 assert not (E/'FORBIDDEN').exists()
 assert run('owned-sentinel',['/bin/pwd'],cwd=REPO).strip()==str(REPO)
 save('containment-controls.json',dict(negativeControls=tests,sentinel=True))
 d=json.loads(DP.read_text())
 for name,pin in d['sourcePins'].items():assert hashlib.sha256((REPO/name).read_bytes()).hexdigest()==pin['sha256']
 save('launch-configuration.json',dict(gitSSH=SSH,mountArgv=[],intendedMountFiles=[],canonicalGuestParser='not applicable: no guest runner and empty mount argv; reuse identical predecessor configuration',sourcePins=d['sourcePins']))
 git('init',['init'],cwd=REPO,init=True)
 for label,args in [('sparse-config',['config','core.sparseCheckout','true']),('sparse-mode',['config','core.sparseCheckoutCone','false'])]:git(label,args,cwd=REPO,mutate=True)
 (REPO/'.git/info/sparse-checkout').write_text('/'+str(E.relative_to(REPO))+'/\n')
 git('read-tree',['read-tree',d['candidate']],cwd=REPO,mutate=True)
 git('branch',['symbolic-ref','HEAD','refs/heads/task/'+TASK],cwd=REPO,mutate=True)
 git('base',['update-ref','HEAD',d['candidate']],cwd=REPO,mutate=True)
 git('origin',['remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],cwd=REPO,mutate=True)
 for label,args in [('name',['config','user.name','Wine Ops']),('email',['config','user.email','wine-ops@users.noreply.github.com'])]:git(label,args,cwd=REPO,mutate=True)
 print('bootstrap PASS')
if __name__=='__main__':bootstrap()
