import os,pathlib,subprocess,json,hashlib,time,shlex,base64,zlib,resource,fcntl,signal,shutil
H=pathlib.Path(__file__).parent; T=H.parent; R=str(T); BOX='bx_pj94q932'; B='/home/user/.ascii/boat'
D=pathlib.Path('/tmp/input-consumption-clock-independent-closeout-oct24/repo'); REV='5691793a58b4670fd2a621114d7926100a1e47de'
BRANCH='task/penguin-visible-projectile-gameplay-oct27'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j): (H/n).write_text(json.dumps(j,indent=2)+'\n')
def git(args,cwd=D):
 held=[]
 while not held:
  with open('/tmp/wine-ops-light-pool-mutex','a') as m:
   fcntl.flock(m,fcntl.LOCK_EX)
   for i in range(2):
    f=open('/tmp/wine-ops-light-pool-slot-'+str(i),'a')
    try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);held.append(f)
    except BlockingIOError:f.close()
   if len(held)!=2:
    for f in held:f.close()
    held=[]
  if not held:time.sleep(.2)
 try:
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX)
   def lim():
    resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(8388608,8388608))
   env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
   p=subprocess.Popen(['git','-C',str(cwd),*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,preexec_fn=lim,start_new_session=True)
   start=time.monotonic(); peak=0
   # communicate drains output while a monitor enforces physical memory.
   import threading
   reason=[]
   def watch():
    nonlocal peak
    while p.poll() is None:
     rss=0
     for q in pathlib.Path('/proc').iterdir():
      if not q.name.isdigit():continue
      try:
       s=(q/'stat').read_text().split(') ',1)[1].split()
       if int(s[2])==p.pid:rss+=int((q/'statm').read_text().split()[1])*4096
      except (OSError,ValueError,IndexError):pass
     peak=max(peak,rss)
     if rss>268435456 or time.monotonic()-start>120:
      reason.append('physical/wall');os.killpg(p.pid,signal.SIGKILL);break
     time.sleep(.05)
   th=threading.Thread(target=watch);th.start();out,err=p.communicate();th.join()
   with (H/'git-history.jsonl').open('a') as f:f.write(json.dumps(dict(argv=args,cwd=str(cwd),exit=p.returncode,peak=peak,outputBytes=len(out)+len(err),guard=reason))+'\n')
   assert not reason and p.returncode==0,(args,p.returncode,err[:1000])
   return out
 finally:
  for f in held:f.close()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=65536
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+20)
 j=json.loads(p.stdout)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId')))+'\n')
 assert (H/'api-history.jsonl').stat().st_size<1048576
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1500])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def payload(x):return git(['show',x.get('revision',REV)+':'+x['path']],pathlib.Path(x.get('donor',D))) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def send(b,target):
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode()
  py('import pathlib,zlib,base64;p=pathlib.Path('+repr(R+'/'+target)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')))')
def get(src,dst):
 meta=json.loads(py('import pathlib,hashlib,json,zlib;b=pathlib.Path('+repr(src)+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),zbytes=len(zlib.compress(b)))))')['stdout']);assert meta['bytes']<=4194304
 out=bytearray()
 for off in range(0,meta['zbytes'],4096):
  out.extend(base64.b64decode(py('import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(src)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())')['stdout']))
 b=zlib.decompress(out);assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];dst.write_bytes(b);return meta
def size(p):return sum(q.stat().st_size for q in p.rglob('*') if q.is_file())
