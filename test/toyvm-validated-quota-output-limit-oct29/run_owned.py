import os,sys,pathlib,json,time,subprocess,resource,hashlib
import limit_contract as lc
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'
lc.configure_parent()
def admission(label):
 s=os.statvfs(ROOT); m=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 r=dict(label=label,at=time.time(),device=os.stat(ROOT).st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=s.f_bavail*s.f_frsize,MemAvailable=m,required=3225419776,memRequired=2147483648)
 r['PASS']=r['free']>=r['required'] and m>=r['memRequired']
 with (ROOT/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('admission rejected')
def run(argv,*,cwd,label,git=False):
 p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
 if not p.is_relative_to(ROOT):raise ValueError('lexical cwd outside task')
 p=p.resolve(strict=True)
 if not p.is_relative_to(ROOT):raise ValueError('canonical cwd outside task')
 admission(label)
 env=os.environ.copy();env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
 out=ROOT/(label+'.stdout');err=ROOT/(label+'.stderr')
 def limits():lc.child_limits(git);os.setsid()
 start=time.monotonic(); incident=None
 with out.open('wb') as a,err.open('wb') as b:
  q=subprocess.Popen(argv,cwd=p,env=env,stdout=a,stderr=b,preexec_fn=limits)
  while q.poll() is None:
   rss=0
   for d in pathlib.Path('/proc').iterdir():
    if not d.name.isdigit():continue
    try:
     st=(d/'stat').read_text().rsplit(')',1)[1].split()
     if int(st[2])==q.pid:rss+=int(st[21])*os.sysconf('SC_PAGE_SIZE')
    except (OSError,ValueError,IndexError):pass
   ownrss=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
   if rss>512*1048576 or ownrss>128*1048576 or time.monotonic()-start>120 or out.stat().st_size+err.stat().st_size>2*1048576:
    incident='outer safety exceeded';os.killpg(q.pid,9);break
   time.sleep(.05)
  rc=q.wait()
 r=dict(argv=argv,cwd=str(p),exit=rc,incident=incident,wall=time.monotonic()-start,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size)
 (ROOT/(label+'.json')).write_text(json.dumps(r,indent=2)+'\n')
 print(json.dumps(r))
 return rc
if __name__=='__main__':
 label=sys.argv[1];args=sys.argv[2:];git=args[0]=='git'
 if git:
  for flag,expected in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
   check='check-'+label+flag.replace('-','')
   assert run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,label=check,git=True)==0
   assert (ROOT/(check+'.stdout')).read_text().strip()==expected
 sys.exit(run(args,cwd=REPO,label=label,git=git))
