import os,pathlib,resource,subprocess,time,signal,json
O=pathlib.Path(__file__).resolve().parent
R=O/'repo'; M=1048576
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def bound(k,v):
 s,h=resource.getrlimit(k); v=min([v]+([s] if s>=0 else [])+([h] if h>=0 else []));resource.setrlimit(k,(v,v))
def run(name,args,*,cwd,capture=524288):
 cwd=pathlib.Path(cwd).resolve()
 assert cwd==R.resolve() or cwd.is_relative_to(R.resolve()),'owned cwd required'
 if args[0]=='git':
  assert args[1:3]==['-C',str(R)]
  assert (R/'.git').is_dir()
 def limits():
  bound(resource.RLIMIT_FSIZE,12*M);bound(resource.RLIMIT_CPU,60)
  if args[0]=='git':bound(resource.RLIMIT_DATA,256*M)
  elif args[0]=='/usr/bin/python3':bound(resource.RLIMIT_DATA,128*M)
 if args[0]=='git':
  for flag,expected in [('--show-toplevel',str(R.resolve())),('--absolute-git-dir',str((R/'.git').resolve()))]:
   q=subprocess.run(['git','-C',str(R),'rev-parse',flag],cwd=cwd,preexec_fn=limits,capture_output=True,timeout=10,check=True)
   assert q.stdout.decode().strip()==expected
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
 start=time.monotonic();reason=None;peak=0
 with (O/(name+'.stdout')).open('xb') as a,(O/(name+'.stderr')).open('xb') as b:
  p=subprocess.Popen(args,cwd=cwd,env=env,stdout=a,stderr=b,preexec_fn=limits,start_new_session=True)
  while p.poll() is None:
   try:
    rss=int(pathlib.Path('/proc/'+str(p.pid)+'/statm').read_text().split()[1])*4096;peak=max(peak,rss)
   except (OSError,ValueError):pass
   if max((O/(name+s)).stat().st_size for s in ['.stdout','.stderr'])>capture:reason='capture512KiB'
   elif time.monotonic()-start>90:reason='wall90'
   elif peak>512*M:reason='RSS512MiB'
   if reason:os.killpg(p.pid,signal.SIGKILL);break
   time.sleep(.01)
  p.wait()
 sizes=[(O/(name+s)).stat().st_size for s in ['.stdout','.stderr']]
 if max(sizes)>capture:reason='capture512KiB'
 aggregate=sum(f.stat().st_size for pattern in ['*.stdout','*.stderr'] for f in O.glob(pattern))
 if aggregate>4*M:reason='aggregate4MiB'
 rec=dict(exit=p.returncode,reason=reason,peakRSS=peak,wall=time.monotonic()-start,generatedFileLimit=12*M,captureLimit=524288,aggregate=aggregate)
 (O/(name+'.json')).write_text(json.dumps(rec)+'\n')
 if reason or p.returncode:raise RuntimeError(str(rec))
 return (O/(name+'.stdout')).read_text()
if __name__=='__main__':
 import sys
 print(run(sys.argv[1],sys.argv[2:],cwd=R))
