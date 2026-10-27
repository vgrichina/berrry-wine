import pathlib,sys,subprocess,os,fcntl,resource,time,signal,threading,json
H=pathlib.Path(__file__).parent
R=H.parent/'repo'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def git(args):
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  def lim():
   resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
   resource.setrlimit(resource.RLIMIT_CPU,(90,90))
   resource.setrlimit(resource.RLIMIT_FSIZE,(8388608,8388608))
  p=subprocess.Popen(['git','-C',str(R),*args],env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lim)
  start=time.monotonic();peak=0;guard=[]
  def watch():
   nonlocal peak
   while p.poll() is None:
    rss=0
    for q in pathlib.Path('/proc').glob('[0-9]*'):
     try:
      s=(q/'stat').read_text().split(') ',1)[1].split()
      if int(s[2])==p.pid:rss+=int((q/'statm').read_text().split()[1])*4096
     except (OSError,ValueError,IndexError):pass
    peak=max(peak,rss)
    if rss>268435456 or time.monotonic()-start>120:
     guard.append('physical/wall');os.killpg(p.pid,signal.SIGKILL);break
    time.sleep(.03)
  th=threading.Thread(target=watch);th.start();out,err=p.communicate();th.join()
  with (H/'git-history.jsonl').open('a') as f:f.write(json.dumps(dict(argv=args,exit=p.returncode,peak=peak,guard=guard,outputBytes=len(out)+len(err)))+'\n')
  assert len(out)+len(err)<=2097152 and not guard and p.returncode==0,(args,p.returncode,err[:1000])
  return out
if __name__=='__main__':sys.stdout.buffer.write(git(sys.argv[1:]))
