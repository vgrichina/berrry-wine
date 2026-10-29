import json,os,pathlib,resource,signal,subprocess,time
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo';M=1048576
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def admission(label):
 d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-ftruncate-runtime-independent-accept-oct29-admission.json').read_text());s=os.statvfs(ROOT)
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 r=dict(label=label,at=time.time(),device=ROOT.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=s.f_bavail*s.f_frsize,MemAvailable=mem,requiredBytes=d['requiredBytes'],futureGrowth=d['futureGrowthIncludingUncertaintyBuffer'],aggregate=d['aggregate'],owners=d['owners'],WAL='positive growth included once in inherited forecast')
 r['PASS']=r['free']-r['futureGrowth']>=r['requiredBytes'] and mem>=d['memRequired']
 with (ROOT/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('admission failed; STOP')
def run(argv,*,cwd):
 p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
 if not p.is_relative_to(ROOT):raise ValueError('outside owned root')
 p=p.resolve(strict=True)
 if not p.is_relative_to(ROOT):raise ValueError('symlink escape')
 git=argv[0]=='git'
 if git and (argv[1:3]!=['-C',str(REPO)] or p!=REPO or (REPO/'.git').resolve()!=REPO/'.git'):raise ValueError('Git target')
 admission(argv[0]+' '+str(argv[3:5] if git else argv[1:3]))
 a=ROOT/'capture.stdout';b=ROOT/'capture.stderr';start=time.monotonic()
 with a.open('wb') as o,b.open('wb') as e:
  q=subprocess.Popen(argv,cwd=p,stdout=o,stderr=e,env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1'),preexec_fn=lambda:child_limits(git),start_new_session=True)
  while q.poll() is None:
   total=0;parent=0
   for proc in pathlib.Path('/proc').iterdir():
    if not proc.name.isdigit():continue
    try:
     s=(proc/'stat').read_text().rsplit(')',1)[1].split();rss=max(0,int(s[21]))*os.sysconf('SC_PAGE_SIZE')
     if int(s[2])==q.pid:total+=rss
     if int(proc.name)==os.getpid():parent=rss
    except (OSError,ValueError):pass
   if total>512*M or parent>128*M or time.monotonic()-start>120 or a.stat().st_size+b.stat().st_size>2*M:
    os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError('supervisor bound')
   time.sleep(.02)
  rc=q.wait()
 out=a.read_bytes();err=b.read_bytes()
 if len(out)+len(err)>2*M:raise RuntimeError('capture cap')
 if rc:raise RuntimeError(str(rc)+': '+err[:1024].decode(errors='replace'))
 return out.decode().strip()
def identity():
 assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=REPO)==str(REPO)
 assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=REPO)==str(REPO/'.git')
def controls():
 rec=configure_parent();rec['controls']={}
 for key,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-domain-pinned-ftruncate-file-limit-oct29'})]:
  try:run(['/bin/pwd'],**kw)
  except (TypeError,ValueError):rec['controls'][key]='REJECTED BEFORE SPAWN'
  else:raise AssertionError(key)
 rec['sentinel']=run(['/bin/pwd'],cwd=REPO);assert rec['sentinel']==str(REPO)
 rec['pythonDATA']=json.loads(run(['/usr/bin/python3','-B','-c','import resource,json;print(json.dumps(resource.getrlimit(resource.RLIMIT_DATA)))'],cwd=REPO))
 assert rec['pythonDATA']==[128*M,128*M]
 identity();rec['PASS']=True
 (ROOT/'startup-controls-corrected.json').write_text(json.dumps(rec,indent=2))
if __name__=='__main__':controls()
