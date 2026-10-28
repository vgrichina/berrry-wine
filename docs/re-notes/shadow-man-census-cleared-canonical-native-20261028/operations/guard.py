import os,sys,pathlib,json,resource,subprocess,selectors,time,signal,ctypes
H=pathlib.Path(__file__).resolve().parent
label,*argv=sys.argv[1:]
env={k:v for k,v in os.environ.items() if k in ('HOME','USER','PATH','LANG','LC_ALL','TZ')}
env.update(PYTHONDONTWRITEBYTECODE='1',GIT_OPTIONAL_LOCKS='0',GIT_NO_LAZY_FETCH='1',BOAT_NO_UPDATE='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
ctypes.CDLL(None).prctl(36,1,0,0,0)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90))
 resource.setrlimit(resource.RLIMIT_FSIZE,((268435456 if pathlib.Path(argv[0]).name=='git' else 1048576),)*2)
 if pathlib.Path(argv[0]).name=='git':resource.setrlimit(resource.RLIMIT_DATA,(268435456,)*2)
mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
free=os.statvfs(H).f_bavail*os.statvfs(H).f_frsize
assert mem>=805306368 and free-201326592>=2982150144,(mem,free)
r={'argv':argv,'cwd':os.getcwd(),'environment':env,'memAvailable':mem,'diskAvailable':free,'cpu':90,'wall':120,'rssCap':402653184,'pythonRSSCap':134217728,'outputCap':2097152,'gitDataChildOnly':268435456,'started':time.time()}
(H/(label+'.command.json')).write_text(json.dumps(r,indent=2))
logs={k:open(H/(label+'.'+k),'wb') for k in ('stdout','stderr')}
try:p=subprocess.Popen(argv,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
except Exception as e:
 logs['stderr'].write(repr(e).encode());r.update(spawnError=repr(e),exit=None,reaped=True);(H/(label+'.json')).write_text(json.dumps(r,indent=2));raise
s=selectors.DefaultSelector()
for k,f in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(f.fileno(),False);s.register(f,selectors.EVENT_READ,k)
start=time.monotonic();total=peak=0;reason=None;term=None
while s.get_map() or p.poll() is None:
 for k,_ in s.select(.05):
  b=os.read(k.fileobj.fileno(),8192)
  if not b:s.unregister(k.fileobj);continue
  logs[k.data].write(b[:max(0,2097152-total)]);total+=len(b)
 rss=0
 for q in pathlib.Path('/proc').iterdir():
  try:
   st=(q/'stat').read_text().split(') ',1)[1].split()
   if int(st[2])==p.pid:rss+=int(st[21])*4096
  except (OSError,ValueError,IndexError):pass
 peak=max(peak,rss)
 if rss>402653184:reason='child RSS cap'
 if int(pathlib.Path('/proc/self/statm').read_text().split()[1])*4096>134217728:reason='Python RSS cap'
 if total>2097152:reason='captured output cap'
 if time.monotonic()-start>120:reason='wall cap'
 if reason and term is None:
  term=time.monotonic()
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
 if term and time.monotonic()-term>5:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
code=p.wait()
try:os.killpg(p.pid,signal.SIGTERM);time.sleep(.05);os.killpg(p.pid,signal.SIGKILL)
except ProcessLookupError:pass
while True:
 try:os.waitpid(-1,0)
 except ChildProcessError:break
for f in logs.values():f.close()
r.update(exit=code,reason=reason,bytes=total,peakGroupRSS=peak,elapsed=time.monotonic()-start,reaped=True)
(H/(label+'.json')).write_text(json.dumps(r,indent=2));print(json.dumps({k:r[k] for k in ('exit','reason','bytes','peakGroupRSS','elapsed')}));sys.exit(125 if reason else code)
