import os,sys,time,json,pathlib,resource,subprocess,hashlib
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path('/tmp/toyvm-real-descendant-cpu-limit-oct29'); REPO=ROOT/'repo'; M=1048576
LIMITS=configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_SSH_COMMAND']=SSH

def append(name,data):
 with (ROOT/name).open('a') as f:f.write(json.dumps(data,sort_keys=True)+'\n')
def admission(op):
 s=os.statvfs(ROOT); mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 rec={'op':op,'at':time.time(),'device':ROOT.stat().st_dev,'f_bavail':s.f_bavail,'blockSize':s.f_frsize,'freeBytes':s.f_bavail*s.f_frsize,'MemAvailable':mem,'requiredBytes':3225419776,'memRequired':2147483648,'allocation':25165824,'projection':{'sourceGit':3*M,'evidence':M,'WAL':8*M,'publish':3*M,'uncertainty':9*M}}
 rec['PASS']=rec['freeBytes']>=rec['requiredBytes'] and mem>=rec['memRequired'];append('admissions.jsonl',rec)
 if not rec['PASS']:raise RuntimeError('ADMISSION REJECTED')
def valid(cwd):
 p=pathlib.Path(cwd)
 if not p.is_absolute() or '..' in p.parts or not p.is_relative_to(ROOT):raise ValueError('forbidden cwd before existence')
 p=p.resolve(strict=True)
 if not p.is_relative_to(ROOT):raise ValueError('outside cwd')
 return p

def run(argv,*,cwd,git=False,timeout=120,check=True):
 cwd=valid(cwd);admission(argv[0]); seq=len(list(ROOT.glob('op-*.out'))); base=ROOT/('op-%03d'%seq)
 started=time.monotonic()
 with base.with_suffix('.out').open('wb') as out,base.with_suffix('.err').open('wb') as err:
  p=subprocess.Popen(argv,cwd=cwd,stdout=out,stderr=err,preexec_fn=lambda:child_limits(git))
  peak=0
  while p.poll() is None:
   try:rss=int(next(x.split()[1] for x in pathlib.Path('/proc/%d/status'%p.pid).read_text().splitlines() if x.startswith('VmRSS:')))*1024;peak=max(peak,rss)
   except (FileNotFoundError,StopIteration,ProcessLookupError):pass
   size=out.tell()+err.tell()
   if peak>512*M or size>2*M or time.monotonic()-started>timeout:
    p.kill();p.wait();append('operations.jsonl',{'argv':argv,'failure':'outer safety limit','rss':peak});raise RuntimeError('outer safety limit')
   time.sleep(.02)
  code=p.wait()
 a=base.with_suffix('.out').read_bytes();b=base.with_suffix('.err').read_bytes();append('operations.jsonl',{'argv':argv,'cwd':str(cwd),'exit':code,'stdout':base.with_suffix('.out').name,'stderr':base.with_suffix('.err').name,'peakRSS':peak,'elapsed':time.monotonic()-started})
 if check and code:raise RuntimeError('operation failed %s exit %s stderr %s'%(argv[0],code,b[:400]))
 return code,a,b

def git(*args,check=True,mutate=False):
 if mutate and (REPO/'.git').exists():
  for flag,expected in [('--show-toplevel',REPO),('--absolute-git-dir',REPO/'.git')]:
   _,a,_=run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,git=True)
   if pathlib.Path(a.decode().strip()).resolve()!=expected.resolve():raise RuntimeError('Git identity mismatch')
 return run(['git','-C',str(REPO),*args],cwd=REPO,git=True,check=check)

if __name__=='__main__':
 action=sys.argv[1]
 if action=='preflight':
  negatives={}
  for name,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-shortpath-descendant-timeout-oct29/repo'})]:
   try:run(['/bin/pwd'],**kw)
   except (TypeError,ValueError):negatives[name]='rejected before spawn'
   else:raise RuntimeError('negative failed')
  _,a,_=run(['/bin/pwd'],cwd=ROOT);append('preflight.jsonl',{'limits':LIMITS,'negative':negatives,'sentinel':a.decode().strip(),'mountArgv':[],'mountParser':'not invoked: no guest mounts','SSH':SSH})
  pins=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-descendant-cpu-limit-oct29-dispatch.json').read_text())['sourcePins']
  for path,pin in pins.items():
   b=(REPO/path).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
  append('preflight.jsonl',{'sourcePins':pins,'PASS':True})
  _,a,b=run(['/home/user/.ascii/boat','--help'],cwd=ROOT);print(a.decode()[:5000])
 elif action=='boat':
  code,a,b=run(['/home/user/.ascii/boat',*sys.argv[2:]],cwd=ROOT,check=False);print('exit',code);print(a.decode()[:6000]);print(b.decode()[:500])
 elif action=='gitinit':
  git('init',mutate=True)
  stores=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-descendant-cpu-limit-oct29-object-stores.json').read_text())['stores'];(REPO/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
  git('config','core.sparseCheckout','true',mutate=True);git('config','core.sparseCheckoutCone','false',mutate=True)
  pins=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-descendant-cpu-limit-oct29-dispatch.json').read_text())['sourcePins'];(REPO/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in pins)+'\n/test/toyvm-real-descendant-cpu-limit-oct29/\n')
  git('checkout','-b','task/toyvm-real-descendant-cpu-limit-oct29','5a88ca099b962e946160afd2d4d71a950bf46db3',mutate=True)
  print('initialized')
