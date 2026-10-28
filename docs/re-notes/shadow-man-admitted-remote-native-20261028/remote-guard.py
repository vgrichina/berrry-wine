import ctypes,hashlib,json,os,pathlib,re,resource,selectors,shutil,signal,subprocess,sys,time
H=pathlib.Path('/tmp/shadow-task/evidence');H.mkdir(parents=True,exist_ok=True);R=pathlib.Path('/tmp/shadow-task/repo');FILE=25165824;LOG=524288
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV={'PATH':str(pathlib.Path(NODE).parent)+':/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1','NODE_OPTIONS':'--max-old-space-size=2048 --require=/tmp/shadow-task/ops/native-module-bound.cjs'}
def dump(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
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
  for f in R.rglob('*'):
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

label=sys.argv[1];argv=sys.argv[2:];seconds=900 if label=='canonical-build' else 150 if label.startswith('native-') else 60
minimum=2684354560 if seconds==900 else 1610612736 if seconds==150 else 805306368
mem=int(re.search(r'^MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text(),re.M)[1])*1024
assert mem>=minimum,(mem,minimum)
if label.startswith('native-'):ENV['NODE_OPTIONS']='--max-old-space-size=512 --require=/tmp/shadow-task/ops/native-module-bound.cjs'
if label=='control-output':LOG=32
if label=='control-wall':seconds=1
if label=='control-file':pass
if label=='canonical-build':
 latch=H/'canonical-build-attempted';f=latch.open('x');f.write('one canonical attempt\n');f.close();assert argv==['bash','tools/build.sh']
dump(label+'.command.json',dict(argv=argv,cwd=str(R),environment=ENV,memAvailable=mem,minimum=minimum,limits=pathlib.Path('/proc/self/limits').read_text(),cpu=seconds,wall=seconds,wrapperSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()))
code=bounded(argv,label,cpu=seconds,wall=seconds);sys.exit(code)
