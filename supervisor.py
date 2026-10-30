import os,sys,json,time,pathlib,resource,subprocess,signal,hashlib
R=pathlib.Path(__file__).resolve().parent
E=R/'evidence'; E.mkdir(exist_ok=True)
HOST=pathlib.Path('/home/user/wine-assembly'); TASK=R.parent.name
D=json.loads((HOST/f'scratch/usage-watch/{TASK}-dispatch.json').read_text())
A=json.loads((HOST/f'scratch/usage-watch/{TASK}-admission.json').read_text())
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/29/rollout-2026-10-29T03-00-35-01a1859a-2ac7-71e1-92d3-a36cd7c43aff.jsonl')
def size(p):
 try:return p.stat().st_size
 except FileNotFoundError:return 0
def allocated(p):
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if not x.is_symlink())
def save(name,v): (E/name).write_text(json.dumps(v,indent=2)+'\n')
def append(name,v):
 with (E/name).open('a') as f:f.write(json.dumps(v)+'\n')
if not (E/'initial.json').exists():
 save('initial.json',{'at':time.time(),'session':str(SESSION),'sessionBytes':size(SESSION),'walBaseline':{str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*sqlite-wal')},'limits':pathlib.Path('/proc/self/limits').read_text(),'mountArgv':[],'mountValidation':'empty argv: no files or mount operation requested','allocation':50331648,'aggregate':A['aggregate']})
I=json.loads((E/'initial.json').read_text())
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,ORIGINAL_DATA[1]))
ENV={'PATH':os.environ['PATH'],'HOME':os.environ['HOME'],'LANG':'C.UTF-8','GIT_ALTERNATE_OBJECT_DIRECTORIES':':'.join(json.loads(pathlib.Path(D['objectStores']).read_text())['stores']),'GIT_SSH_COMMAND':'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes','PYTHONDONTWRITEBYTECODE':'1'}
def admission(label):
 st=os.statvfs(R); free=st.f_bavail*st.f_frsize
 mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 wal=sum(max(0,size(pathlib.Path(p))-b) for p,b in I['walBaseline'].items())
 pred=allocated(pathlib.Path(D['retainedPredecessorTree']))
 usage=allocated(R)+pred+max(0,size(SESSION)-I['sessionBytes'])+wal
 projection=usage+13225945*(not list((R/'test/binaries/candidates').glob('tuxracer-original-061a*')))+8*1024**2+2*1024**2
 v={'at':time.time(),'label':label,'device':R.stat().st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'freeBytes':free,'aggregate':A['aggregate'],'aggregateVersionSHA256':'2233517b2c89403ff516cec7645fec3dded15933b343834b06e06d52fb9e96f9','usage':usage,'positiveWalGrowthOnce':wal,'predecessorAllocated':pred,'projection':projection,'MemAvailable':mem}
 v['PASS']=free-A['aggregate']>=2982150144 and projection<=50331648 and mem>=512*1024**2
 append('admissions.jsonl',v)
 if not v['PASS']:raise RuntimeError('FIRST ADMISSION FAILURE '+json.dumps(v))
 if allocated(E)>1024**2 or sum(size(p) for p in E.rglob('*') if p.is_file())>1024**2:raise RuntimeError('evidence cap')
def run(argv,*,cwd):
 cwd=pathlib.Path(cwd).resolve(strict=True)
 if not cwd.is_relative_to(R):raise ValueError('outside owned repository')
 git=pathlib.Path(argv[0]).name=='git'
 if git and (len(argv)<3 or argv[1]!='-C' or pathlib.Path(argv[2]).resolve()!=R):raise ValueError('Git -C required')
 admission(' '.join(argv[:5]))
 def limits():
  os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912))
  resource.setrlimit(resource.RLIMIT_DATA,(268435456,268435456) if git else ORIGINAL_DATA if pathlib.Path(argv[0]).name=='node' else (134217728,134217728))
 out=E/'current.stdout';err=E/'current.stderr';start=time.monotonic();peak=0;perpeak=0
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=o,stderr=e,preexec_fn=limits)
  try:
   while True:
    total=0
    for pr in pathlib.Path('/proc').iterdir():
     if not pr.name.isdigit():continue
     try:
      stat=(pr/'stat').read_text().split(') ',1)[1].split()
      if int(stat[2])!=p.pid:continue
      rss=int((pr/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE');total+=rss;perpeak=max(perpeak,rss)
      if rss>134217728:raise RuntimeError('physical RSS per-process cap')
     except (FileNotFoundError,ProcessLookupError,PermissionError):pass
    peak=max(peak,total)
    if total>536870912 or time.monotonic()-start>120 or size(out)+size(err)>2097152:raise RuntimeError('group/wall/capture cap')
    if p.poll() is not None:break
    time.sleep(.025)
  finally:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   p.wait()
 b=out.read_bytes();eb=err.read_bytes()
 append('operations.jsonl',{'argv':argv,'cwd':str(cwd),'exit':p.returncode,'seconds':time.monotonic()-start,'groupRSSPeak':peak,'perProcessRSSPeak':perpeak,'stdoutSHA256':hashlib.sha256(b).hexdigest(),'stderr':eb.decode(errors='replace')[:3000],'cleanup':'process group killed/reaped'})
 return p.returncode,b,eb
def checked(argv,*,cwd):
 rc,b,e=run(argv,cwd=cwd)
 if rc:raise RuntimeError(str(argv)+' failed '+e.decode(errors='replace')[:1000])
 return b
def git(args,*,mutate=False):
 if mutate and (R/'.git').exists():
  assert checked(['git','-C',str(R),'rev-parse','--show-toplevel'],cwd=R).decode().strip()==str(R)
  assert checked(['git','-C',str(R),'rev-parse','--absolute-git-dir'],cwd=R).decode().strip()==str(R/'.git')
 return checked(['git','-C',str(R),*args],cwd=R)
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='init':
  rejected=[]
  for label,kw in [('omitted',{}),('root',{'cwd':HOST}),('donor',{'cwd':pathlib.Path(D['retainedPredecessorTree'])}),('outside',{'cwd':'/tmp'})]:
   try:run(['/bin/true'],**kw)
   except (TypeError,ValueError):rejected.append(label)
   else:raise AssertionError('containment failed')
  checked(['/usr/bin/python3','-c','import pathlib;pathlib.Path("owned-sentinel").write_text(str(pathlib.Path.cwd()))'],cwd=R)
  assert (R/'owned-sentinel').read_text()==str(R)
  save('containment.json',{'rejectedBeforeSpawn':rejected,'ownedSentinel':str(R)})
  for f,pin in D['sourcePins'].items():assert hashlib.sha256((R/f).read_bytes()).hexdigest()==pin['sha256'] and size(R/f)==pin['bytes']
  save('pins.json',D)
  git(['init'],mutate=True)
  git(['config','user.name','Wine Ops acceptance worker'],mutate=True);git(['config','user.email','wine-ops@localhost'],mutate=True)
  git(['config','core.sparseCheckout','true'],mutate=True)
  paths=list(D['sourcePins'])+['test/test-tuxracer-registration-independent-accept.js','tools/recovery/tuxracer-registration-independent-accept-oct29-report.md']
  (R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths))
  git(['read-tree',D['candidate']],mutate=True)
  git(['update-ref','refs/heads/task/'+TASK,D['candidate']],mutate=True)
  git(['symbolic-ref','HEAD','refs/heads/task/'+TASK],mutate=True)
  git(['remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],mutate=True)
  print('initialized; containment and pins PASS')
 elif mode=='exec':
  b=checked(sys.argv[2:],cwd=R);print(b.decode()[:6000])
 elif mode=='git':print(git(sys.argv[2:],mutate=True).decode()[:6000])
