import os,sys,pathlib,json,time,subprocess,signal,hashlib
import limit_contract as lc
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
lc.configure_parent()
def admission():
 s=os.statvfs(ROOT);free=s.f_bavail*s.f_frsize
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 used=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file())
 rec=dict(at=time.time(),device=ROOT.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=free,MemAvailable=mem,taskPhysical=used,allocation=24*1048576,futureMiB=dict(sourceGit=3,evidence=1,WAL=8,publication=3,uncertainty=9),aggregateReceipt='/home/user/wine-assembly/scratch/usage-watch/toyvm-rename-topology-corrected-independent-accept-oct29-admission.json')
 rec['PASS']=free-24*1048576>=3200253952 and mem>=2147483648 and used<=24*1048576
 with (ROOT/'admissions.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
 assert rec['PASS'],rec
def rows():
 out={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   s=(p/'stat').read_text().rsplit(')',1)[1].split();out[int(p.name)]=(int(s[1]),int(s[21])*4096,int(s[2]))
  except (OSError,ValueError):pass
 return out
def run(argv,*,cwd,git=False):
 p=pathlib.Path(cwd).resolve(strict=True)
 assert p.is_relative_to(ROOT)
 if git:assert argv[:3]==['git','-C',str(REPO)]
 admission();n=len(list(ROOT.glob('capture-*.out')));out=ROOT/f'capture-{n}.out';err=ROOT/f'capture-{n}.err'
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
 start=time.monotonic()
 with out.open('wb') as o,err.open('wb') as e:
  child=subprocess.Popen(argv,cwd=p,env=env,stdout=o,stderr=e,start_new_session=True,preexec_fn=lambda:lc.child_limits(git))
  while child.poll() is None:
   rs=rows(); group=sum(v[1] for v in rs.values() if v[2]==child.pid)
   if time.monotonic()-start>120 or rs.get(os.getpid(),(0,0,0))[1]>128*1048576 or group>512*1048576 or out.stat().st_size+err.stat().st_size>2*1048576:
    os.killpg(child.pid,signal.SIGKILL);child.wait();raise RuntimeError('operation resource guard')
   time.sleep(.02)
 data=out.read_bytes();errors=err.read_bytes()
 assert child.returncode==0,(argv,child.returncode,errors[:2048])
 return data
def git(*args,mutate=False):
 if mutate:
  assert git('rev-parse','--show-toplevel').decode().strip()==str(REPO)
  assert git('rev-parse','--absolute-git-dir').decode().strip()==str(REPO/'.git')
 return run(['git','-C',str(REPO),*args],cwd=REPO,git=True)
if __name__=='__main__':
 if sys.argv[1]=='git':print(git(*sys.argv[2:],mutate=sys.argv[2] not in ['rev-parse','status','diff','ls-remote','show','ls-files','config']).decode()[:8192])
 elif sys.argv[1]=='test':print(run([sys.executable,'-B',*sys.argv[2:]],cwd=REPO).decode()[:8192])
