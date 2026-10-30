import os,sys,json,pathlib,time,subprocess,resource,signal,hashlib
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'
M=1048576
sys.path.insert(0,str(ROOT))
import limit_contract as limits
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def admission(label):
 a=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-retained-charge-independent-accept-oct29-admission.json')
 j=json.loads(a.read_text()); v=os.statvfs(ROOT); free=v.f_bavail*v.f_frsize
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 own=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file() and not p.is_symlink())
 r=dict(operation=label,time=time.time(),device=os.stat(ROOT).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,free=free,mem=mem,own=own,allocation=24*M,aggregate=j['aggregate'],forecast=j['futureGrowthIncludingUncertaintyBuffer'],required=j['requiredBytes'],receiptSHA=hashlib.sha256(a.read_bytes()).hexdigest())
 r['PASS']=free-j['futureGrowthIncludingUncertaintyBuffer']>=j['requiredBytes'] and mem>=j['memRequired'] and own<=24*M
 with (ROOT/'admission.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('resource admission rejected '+str(r))
 return r
def run(argv,*,cwd,git=False,label='operation'):
 lex=pathlib.Path(os.path.abspath(cwd))
 if not lex.is_relative_to(ROOT) or not lex.resolve(strict=True).is_relative_to(ROOT):raise ValueError('outside owned root')
 if git and argv[:3]!=['git','-C',str(REPO)]:raise ValueError('Git explicit owned -C required')
 admission(label)
 env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND=SSH,GIT_TERMINAL_PROMPT='0')
 def pre():os.setsid();limits.child_limits(git)
 out=ROOT/(label+'.stdout');err=ROOT/(label+'.stderr')
 start=time.monotonic();peak=0
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=lex.resolve(),env=env,preexec_fn=pre,stdout=o,stderr=e)
  try:
   while p.poll() is None:
    total=0
    for d in pathlib.Path('/proc').iterdir():
     if not d.name.isdigit():continue
     try:
      s=(d/'stat').read_text().split(') ',1)[1].split()
      if int(s[2])==p.pid:
       total+=int(next(x.split()[1] for x in (d/'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
     except (OSError,ValueError,StopIteration):pass
    peak=max(peak,total)
    if total>512*M or time.monotonic()-start>120 or out.stat().st_size+err.stat().st_size>2*M:raise RuntimeError('group RSS/wall/capture guard')
    time.sleep(.03)
  except BaseException:
   os.killpg(p.pid,signal.SIGKILL);p.wait();raise
 r=dict(argv=argv,cwd=str(lex),returncode=p.returncode,peakRSS=peak,wall=time.monotonic()-start,stdout=str(out),stderr=str(err))
 (ROOT/(label+'.json')).write_text(json.dumps(r,indent=2))
 if p.returncode:raise RuntimeError('subprocess rejected '+str(r))
 return out.read_bytes()
def identity():
 t=run(['git','-C',str(REPO),'rev-parse','--show-toplevel','--absolute-git-dir'],cwd=REPO,git=True,label='identity').decode().splitlines()
 assert t==[str(REPO),str(REPO/'.git')],t
if __name__=='__main__':
 limits.configure_parent();admission('parent-start');identity()
 result=run(sys.argv[1:],cwd=REPO,git=sys.argv[1]=='git',label='operation')
 print(result[:8192].decode(errors='replace'))
