import ctypes,datetime,fcntl,json,os,pathlib,resource,selectors,signal,subprocess,sys,time
TASK=pathlib.Path(__file__).resolve().parent.parent;H=TASK/'ops';R=TASK/'repo';FILE=25165824
stage=sys.argv[1];argv=sys.argv[2:];assert stage in ['cheap','compiler','module-tail','module-compat','publication']
LOG=524288 if stage in ['compiler','module-tail','module-compat'] else 131072
ENV=dict(os.environ,TMPDIR=str(H),PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
ENV.pop('NODE_OPTIONS',None);ENV.pop('WINE_REGION_SHAKE',None);ENV.pop('WINE_WAT_NAMES',None)
def dump(name,data):(H/name).write_text(json.dumps(data,indent=2)+'\n')
def bounded(argv,label,cwd=R,cpu=900,wall=900):
 # Aggregate capture bound, finite regular-file limit, process-group cleanup.
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(cpu,cpu));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector();logs={};counts={'stdout':0,'stderr':0};retained=0;start=time.monotonic();reason=None;term=None;leader_done=False
 for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);logs[name]=(H/(label+'.'+name)).open('wb')
 while sel.get_map() or p.poll() is None:
  now=time.monotonic()
  if reason is None and now-start>wall:reason='wall timeout'
  if reason is not None and term is None:
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   term=now
  if term is not None and now-term>=5:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  for key,_ in sel.select(.05):
   b=os.read(key.fileobj.fileno(),65536)
   if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
   name=key.data;keep=b[:max(0,LOG-retained)];logs[name].write(keep);retained+=len(keep);counts[name]+=len(b)
   if sum(counts.values())>LOG:reason='aggregate stdout+stderr overflow'
  for f in TASK.rglob('*'):
   if f.is_file() and f.stat().st_size>FILE:reason='regular file overflow '+str(f)
 code=p.wait()
 # Even a successful leader must not leave surviving children. These commands
 # are synchronous and do not intentionally daemonize.
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  try:os.killpg(p.pid,0)
  except ProcessLookupError:break
  try:
   while os.waitpid(-1,os.WNOHANG)[0]:pass
  except ChildProcessError:break
  time.sleep(.05)
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 try:
  while True:os.waitpid(-1,0)
 except ChildProcessError:pass
 for f in logs.values():f.close()
 remaining=[]
 for q in pathlib.Path('/proc').iterdir():
  if not q.name.isdigit():continue
  try:
   fields=(q/'stat').read_text().split(') ',1)[1].split()
   if int(fields[2])==p.pid:remaining.append(int(q.name))
  except (OSError,IndexError):pass
 assert not remaining,remaining
 result=dict(argv=argv,cwd=str(cwd),pid=p.pid,exit=code,reason=reason,elapsed=time.monotonic()-start,streamBytes=counts,aggregateLogMax=LOG,retained=retained,fileMax=FILE,cpuSeconds=cpu,wallSeconds=wall,termThenKillSeconds=5,subreaper=True,reaped=True,remainingGroup=remaining,maxChildRSSBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
 dump(label+'.json',result)
 return code if reason is None else 125

if stage in ['compiler','module-tail','module-compat']:
 assert not (H/(stage+'-attempt.json')).exists(),'one attempt; no unchanged retry'
 lock=open('/tmp/wine-ops-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 dump(stage+'-lock.json',dict(ownerPID=os.getpid(),lock='/tmp/wine-ops-heavy-runtime.lock',exclusive=True,at=time.time()))
assert subprocess.call([sys.executable,str(H/'account.py'),stage+'-admission-'+str(time.time_ns())+'.json'])==0,'fresh resource admission failed'
if stage in ['compiler','module-tail','module-compat']:dump(stage+'-attempt.json',dict(argv=argv,at=time.time(),lock='/tmp/wine-ops-heavy-runtime.lock'))
label=stage+'-'+str(time.time_ns())
code=bounded(argv,label,cpu=900 if stage in ['compiler','module-tail','module-compat'] else 60,wall=900 if stage in ['compiler','module-tail','module-compat'] else 60)
print(json.dumps(dict(label=label,exit=code)));sys.exit(code)
