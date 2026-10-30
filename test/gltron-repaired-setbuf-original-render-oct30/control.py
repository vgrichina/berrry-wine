import os,pathlib,json,subprocess,time,resource,hashlib,selectors,signal
R=pathlib.Path(__file__).resolve().parent; E=R/'evidence';E.mkdir(exist_ok=True);REPO=R/'repo';M=1048576
BASE='16627061ccc5f151fbe568178471b3076f37cf42'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
B='/home/user/.ascii/boat'
def pin(b):return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def save(n,v): (E/n).write_text(json.dumps(v,indent=2))
def admission(label):
 f=json.loads((R/'coordinator-allocation-forecast.json').read_text());launch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/R.name
 sid=json.loads((launch/'events.jsonl').open().readline())['thread_id'];roll=list(pathlib.Path('/home/user/.codex/sessions/2026/10/30').glob('*'+sid+'.jsonl'));assert len(roll)==1
 roots=[pathlib.Path(x) for x in f['roots']]+roll;seen=set();used=0
 for root in roots:
  for p in ([root,*root.rglob('*')] if root.is_dir() else [root]):
   s=p.lstat();k=(s.st_dev,s.st_ino)
   if k not in seen:used+=s.st_blocks*512;seen.add(k)
 disk=os.statvfs(R);free=disk.f_bavail*disk.f_frsize
 v=dict(at=time.time(),roots=list(map(str,roots)),sessionID=sid,physical=used,workReserve=8*M,publicationReserve=8*M,startupReserve=3*M,plannedArtifactsAndTransfer=1048576,forecast=used+20*M,cap=64*M,hostFree=free,futureGrowth=267292672,hostFloor=2*1024*M,RAMAdmission=False,processRSS=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE'))
 v['PASS']=v['forecast']<=v['cap'] and free-267292672>=2*1024*M;save(label+'.json',v);assert v['PASS'],v
 return v
def run(argv,label,cwd=REPO,wall=60,cpu=60,git=False,limit=524288):
 assert not (E/(label+'.json')).exists(),label
 assert sum(p.stat().st_size for p in E.rglob('*') if p.is_file() and p.suffix in ['.stdout','.stderr'])+limit<=4*M
 def limits():
  for k,n in [(resource.RLIMIT_FSIZE,12*M),(resource.RLIMIT_CPU,cpu)]:
   s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,h))
  if git:
   s,h=resource.getrlimit(resource.RLIMIT_DATA);resource.setrlimit(resource.RLIMIT_DATA,(min(s,256*M) if s!=-1 else 256*M,h))
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_TERMINAL_PROMPT='0',PYTHONDONTWRITEBYTECODE='1',TZ='UTC',GIT_CONFIG_COUNT='2',GIT_CONFIG_KEY_0='gc.auto',GIT_CONFIG_VALUE_0='0',GIT_CONFIG_KEY_1='maintenance.auto',GIT_CONFIG_VALUE_1='false')
 t=time.monotonic();q=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits,start_new_session=True);sel=selectors.DefaultSelector();out=bytearray();err=bytearray();peak=0;violation=None
 sel.register(q.stdout,selectors.EVENT_READ,out);sel.register(q.stderr,selectors.EVENT_READ,err)
 while sel.get_map() or q.poll() is None:
  for k,_ in sel.select(.04):
   b=os.read(k.fileobj.fileno(),8192)
   if not b:sel.unregister(k.fileobj);continue
   room=max(0,limit-len(out)-len(err));k.data.extend(b[:room])
   if len(b)>room:violation='capture overflow'
  rss=0
  for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
   try:
    v=p.read_text().rsplit(')',1)[1].split()
    if int(v[3])==q.pid:rss+=int(v[21])*os.sysconf('SC_PAGE_SIZE')
   except (OSError,ValueError,IndexError):pass
  peak=max(peak,rss)
  if rss>2*1024*M:violation='aggregate RSS'
  if time.monotonic()-t>wall:violation='wall'
  if violation:
   try:os.killpg(q.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   q.wait();break
 q.wait();sel.close()
 for stream,b in [('stdout',out),('stderr',err)]: (E/(label+'.'+stream)).write_bytes(b)
 rec=dict(argv=[x if len(x)<1000 else pin(x.encode()) for x in argv],exit=q.returncode,wall=time.monotonic()-t,peakRSS=peak,violation=violation,FSIZE=12*M,capture=limit,gitDataChildOnly=256*M if git else None)
 save(label+'.json',rec)
 if q.returncode or violation:raise RuntimeError(label+': '+str(rec)+' '+err.decode(errors='replace')[:1000])
 return bytes(out)
def native(args,label,wall=60):return [json.loads(x) for x in run([B,'--no-update','--json',*args],label,cwd=R,wall=wall).decode().splitlines()]
def git(args,label):return run(['git','-C',str(REPO),*args],label,git=True)
