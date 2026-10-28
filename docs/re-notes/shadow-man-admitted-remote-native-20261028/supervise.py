import os,sys,pathlib,json,subprocess,resource,ctypes,selectors,time,signal
H=pathlib.Path(__file__).resolve().parents[1]; label,*argv=sys.argv[1:];dest=H/'evidence';dest.mkdir(exist_ok=True)
seconds=int(os.environ.get('TASK_SECONDS','60'));minimum=int(os.environ.get('TASK_MINMEM','805306368'));mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
assert mem>=minimum,(mem,minimum)
ctypes.CDLL(None).prctl(36,1,0,0,0)
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','USER','LANG','LC_ALL','TZ']};env.update(PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(seconds,seconds));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if pathlib.Path(argv[0]).name=='git':
  resource.setrlimit(resource.RLIMIT_DATA,(268435456,268435456));resource.setrlimit(resource.RLIMIT_RSS,(268435456,268435456))
record={'argv':argv,'cwd':os.getcwd(),'environment':env,'parentLimits':{str(k):resource.getrlimit(k) for k in [resource.RLIMIT_CPU,resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_FSIZE]},'memAvailable':mem,'cpu':seconds,'wall':seconds,'cap':524288,'termKill':5,'subreaper':True};(dest/(label+'.command.json')).write_text(json.dumps(record,indent=2))
logs={n:open(dest/(label+'.'+n),'wb') for n in ['stdout','stderr']};start=time.monotonic();reason=None;term=None;count=0;peak=0
try:p=subprocess.Popen(argv,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
except Exception as e:
 logs['stderr'].write(repr(e).encode());record.update(spawnError=repr(e),exit=None);(dest/(label+'.json')).write_text(json.dumps(record,indent=2));raise
sel=selectors.DefaultSelector()
for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name)
def kill(sig):
 try:os.killpg(p.pid,sig)
 except ProcessLookupError:pass
while sel.get_map() or p.poll() is None:
 now=time.monotonic()
 if now-start>seconds:reason=reason or 'wall'
 if reason and term is None:kill(signal.SIGTERM);term=now
 if term and now-term>=5:kill(signal.SIGKILL)
 for key,_ in sel.select(.05):
  b=os.read(key.fileobj.fileno(),8192)
  if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
  room=max(0,524288-count);logs[key.data].write(b[:room]);count+=len(b)
  if count>524288:reason='output cap'
 # RSS includes entire owned process group.
 rss=0
 for q in pathlib.Path('/proc').iterdir():
  if not q.name.isdigit():continue
  try:
   st=(q/'stat').read_text().split(') ',1)[1].split()
   if int(st[2])==p.pid:rss+=int(st[21])*os.sysconf('SC_PAGE_SIZE')
  except (OSError,IndexError,ValueError):pass
 peak=max(peak,rss)
 if os.environ.get('TASK_REMOTE')!='1' and rss>402653184:reason='local client RSS'
code=p.wait();kill(signal.SIGTERM);deadline=time.monotonic()+5
while True:
 try:
  kid,status=os.waitpid(-1,os.WNOHANG)
  if kid:continue
 except ChildProcessError:break
 if time.monotonic()>deadline:kill(signal.SIGKILL)
 time.sleep(.02)
for f in logs.values():f.close()
record.update(exit=code,reason=reason,capturedBytes=count,peakGroupRSS=peak,elapsed=time.monotonic()-start,reaped=True)
(dest/(label+'.json')).write_text(json.dumps(record,indent=2));print(json.dumps({'label':label,'exit':code,'reason':reason,'bytes':count,'peakRSS':peak}));sys.exit(125 if reason else code)
