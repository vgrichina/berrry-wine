import os,sys,json,time,resource,subprocess,signal,pathlib,hashlib
ROOT=pathlib.Path('/tmp/tuxracer-original-launch-registration-oct29/repo').resolve()
E=ROOT/'evidence'; E.mkdir(exist_ok=True)
BASE='4f48ba55572815d015ec9ac15f1f1284f770b40d'
ENV={k:os.environ[k] for k in ('PATH','HOME','LANG','TZ') if k in os.environ}
ENV['TZ']='UTC'
ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.load(open('/home/user/wine-assembly/scratch/usage-watch/tuxracer-original-launch-registration-oct29-object-stores.json'))['stores'])
ENV['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/29/rollout-2026-10-29T02-50-26-01a18590-dd6a-7610-a237-4b960957fd46.jsonl')
def size(p):
 try:return p.stat().st_size
 except FileNotFoundError:return 0
WALS=list(pathlib.Path('/home/user/.codex').glob('*-wal'))
if not (E/'initial.json').exists():
 json.dump({'at':time.time(),'session':str(SESSION),'sessionBytes':size(SESSION),'walBaseline':{str(p):size(p) for p in WALS},'inheritedLimits':{str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},'mountArgv':[],'mountValidation':'empty; no mount operation authorized','allocation':50331648,'aggregate':150994944},open(E/'initial.json','w'),indent=2)
INITIAL=json.load(open(E/'initial.json'))
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,ORIGINAL_DATA[1]))
def admission(label):
 st=os.statvfs(ROOT); own=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file() and not p.is_symlink())
 growth=max(0,size(SESSION)-INITIAL['sessionBytes'])+sum(max(0,size(pathlib.Path(p))-n) for p,n in INITIAL['walBaseline'].items())
 mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
 r={'at':time.time(),'label':label,'device':ROOT.stat().st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'freeBytes':st.f_bavail*st.f_frsize,'aggregate':150994944,'ownedAllocatedBytes':own,'positiveSessionWalGrowthCountedOnce':growth,'projectedTaskPeak':own+growth+13225945+16*1024**2,'MemAvailable':mem}
 r['PASS']=r['freeBytes']-150994944>=2982150144 and r['projectedTaskPeak']<=50331648 and mem>=512*1024**2
 with open(E/'admissions.jsonl','a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('admission rejection '+json.dumps(r))
def owned(cwd):
 p=pathlib.Path(cwd).resolve()
 if p!=ROOT and ROOT not in p.parents:raise ValueError('outside owned directory')
 if not p.is_dir():raise ValueError('missing owned cwd')
 return p

def run(argv,*,cwd,init=False,capture=False):
 p=owned(cwd); admission(argv[0]+' '+str(argv[1:3]))
 git=argv[0]=='git'
 if init and (p!=ROOT or (ROOT/'.git').exists() or argv[:2]!=['git','init']):raise ValueError('initialization requires new exact owned repository')
 if git:
  argv=['git','-C',str(p)]+argv[1:]
  if not init:
   for args,expected in [(['rev-parse','--show-toplevel'],str(ROOT)),(['rev-parse','--absolute-git-dir'],str(ROOT/'.git'))]:
    got=run(['git-probe']+args,cwd=p,capture=True).strip()
    if got!=expected:raise RuntimeError('Git identity mismatch '+got)
 if argv[0]=='git-probe':argv=['git','-C',str(p)]+argv[1:];git=True
 def limits():
  os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
  resource.setrlimit(resource.RLIMIT_DATA,(256*1024**2,)*2) if git else resource.setrlimit(resource.RLIMIT_DATA, ORIGINAL_DATA if pathlib.Path(argv[0]).name=='node' else (128*1024**2,)*2)
 # Node must inherit no supervisor DATA restriction. Spawn through prlimit configured before Python cap? see separate Node entry below.
 # Node gets original inherited DATA/AS; physical caps remain monitored.
 out=E/'operation-output.tmp'
 with open(out,'wb') as f, open(E/'operation-stderr.tmp','wb') as err:
  proc=subprocess.Popen(argv,cwd=p,env=ENV,stdout=f,stderr=err,preexec_fn=limits)
  start=time.monotonic();peak=0
  try:
   while proc.poll() is None:
    rss=0
    for q in pathlib.Path('/proc').iterdir():
     if not q.name.isdigit():continue
     try:
      stat=(q/'stat').read_text().split(); resident=int((q/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
      if int(stat[4])==proc.pid:
       rss+=resident
       if resident>(256 if git else 128)*1024**2:raise RuntimeError('physical RSS cap')
     except (FileNotFoundError,ProcessLookupError,PermissionError):pass
    peak=max(peak,rss)
    if rss>512*1024**2 or time.monotonic()-start>120 or size(out)>2*1024**2:raise RuntimeError('group/wall/output cap')
    time.sleep(.03)
   data=out.read_text(errors='replace')
   with open(E/'operations.jsonl','a') as f:f.write(json.dumps({'argv':argv,'exit':proc.returncode,'seconds':time.monotonic()-start,'peakGroupPhysicalRSS':peak,'sha256':hashlib.sha256(data.encode()).hexdigest()})+'\n')
   if proc.returncode:raise RuntimeError(data[:7000])
   if capture:return data
   print(data[:7000])
  finally:
   try:os.killpg(proc.pid,signal.SIGKILL)
   except ProcessLookupError:pass
if __name__=='__main__':
 if sys.argv[1]=='init':
  run(['git','init','-b','task/tuxracer-original-launch-registration-oct29'],cwd=ROOT,init=True)
  for args in [['config','core.sparseCheckout','true'],['config','core.sparseCheckoutCone','false'],['config','user.name','Wine Ops'],['config','user.email','wine-ops@localhost'],['remote','add','origin','git@github.com:vgrichina/wine-assembly.git']]:run(['git']+args,cwd=ROOT)
  (ROOT/'.git/info/sparse-checkout').write_text('/lib/apps.js\n/test/run.js\n/tools/recovery/tuxracer-original-win32-recovery-oct28.py\n')
  run(['git','read-tree',BASE],cwd=ROOT)
  run(['git','update-ref','refs/heads/task/tuxracer-original-launch-registration-oct29',BASE],cwd=ROOT)
 else:run(sys.argv[1:],cwd=ROOT)
