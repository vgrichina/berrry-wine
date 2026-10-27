import subprocess,resource,fcntl,time,os,sys,json,pathlib,signal
H=pathlib.Path(__file__).parent
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_NO_LAZY_FETCH']='1'
def git(args,out=None):
 cmd=['python3','/home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py','--slots','2','--',sys.executable,str(__file__),'--direct',*args]
 r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
 if r.returncode:raise RuntimeError(str(r.returncode)+' '+r.stderr.decode()[:4000]+' '+r.stdout.decode(errors='replace')[:1000])
 if out:pathlib.Path(out).write_bytes(r.stdout)
 return r.stdout
if __name__=='__main__':
 if sys.argv[1]=='--direct':
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX)
   def limits():
    resource.setrlimit(resource.RLIMIT_DATA,(512*1048576,512*1048576));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
   p=subprocess.Popen(['git',*sys.argv[2:]],stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits,start_new_session=True)
   start=time.monotonic()
   while p.poll() is None:
    rss=0
    for x in pathlib.Path('/proc').glob('[0-9]*/stat'):
     try:
      s=x.read_text().rsplit(')',1)[1].split()
      if int(s[2])==p.pid:rss+=int(s[21])*4096
     except (OSError,ValueError):pass
    if rss>256*1048576 or time.monotonic()-start>110:os.killpg(p.pid,9);raise RuntimeError('Git physical/wall guard')

    try:p.communicate(timeout=.1)
    except subprocess.TimeoutExpired:pass
   a,b=p.communicate();sys.stdout.buffer.write(a);sys.stderr.buffer.write(b);sys.exit(p.returncode)
 else:sys.stdout.buffer.write(git(sys.argv[1:]))
