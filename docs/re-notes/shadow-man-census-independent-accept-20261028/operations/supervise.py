import os,sys,json,pathlib,resource,subprocess,selectors,time,signal,shutil
H=pathlib.Path(__file__).resolve().parent;D=H/'recovered-operations';D.mkdir(exist_ok=True);label,*argv=sys.argv[1:]
mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
assert mem>805306368
assert shutil.disk_usage(H).free-134217728-67108864>=2982150144
base={str(x['pid']):x['rss'] for x in json.loads((H/'initial-resources.json').read_text())['codex'] if 'exec' in x['argv']}
observed={}
for q in pathlib.Path('/proc').iterdir():
 try:
  a=(q/'cmdline').read_bytes().split(b'\0');e=os.readlink(q/'exe')
  if pathlib.Path(e).name=='codex' and b'exec' in a and b'wine-worker' in a:observed[int(q.name)]=int((q/'statm').read_text().split()[1])*4096
 except (OSError,ValueError,IndexError):pass
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','USER','LANG','LC_ALL','TZ']};env.update(PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,((268435456 if pathlib.Path(argv[0]).name=='git' else 1048576),)*2)
 if pathlib.Path(argv[0]).name=='git':resource.setrlimit(resource.RLIMIT_DATA,(268435456,268435456))
r={'argv':argv,'cwd':os.getcwd(),'environment':env,'memAvailable':mem,'clientsBaseline':base,'observedClientsAtStart':observed,'cpu':90,'wall':120,'groupRSSCap':536870912,'pythonRSSCap':134217728,'fileCap':1048576,'outputCap':2097152,'gitDataChildOnly':268435456}
(D/(label+'.command.json')).write_text(json.dumps(r,indent=2));p=subprocess.Popen(argv,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE);s=selectors.DefaultSelector();logs={k:open(D/(label+'.'+k),'wb') for k in ['stdout','stderr']}
for k,f in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(f.fileno(),False);s.register(f,selectors.EVENT_READ,k)
start=time.monotonic();count=peak=growthPeak=0;reason=None
while s.get_map() or p.poll() is None:
 for k,_ in s.select(.01):
  b=os.read(k.fileobj.fileno(),8192)
  if not b:s.unregister(k.fileobj);continue
  logs[k.data].write(b[:max(0,2097152-count)]);count+=len(b)
 rss=0;growth=0
 for q in pathlib.Path('/proc').iterdir():
  try:
   st=(q/'stat').read_text().split(') ',1)[1].split();v=int(st[21])*4096
   if int(st[2])==p.pid:rss+=v
   if str(q.name) in base:growth+=max(0,v-base[str(q.name)])
  except (OSError,ValueError,IndexError):pass
 peak=max(peak,rss);growthPeak=max(growthPeak,growth)
 if rss+growth>536870912:reason='child plus aggregate client growth RSS'
 if int(pathlib.Path('/proc/self/statm').read_text().split()[1])*4096>134217728:reason='python RSS'
 if count>2097152:reason='output'
 if time.monotonic()-start>120:reason='wall'
 if reason:
  os.killpg(p.pid,signal.SIGKILL);break
code=p.wait()
for f in logs.values():f.close()
r.update(exit=code,reason=reason,peakGroupRSS=peak,aggregateClientGrowthPeak=growthPeak,bytes=count,elapsed=time.monotonic()-start,reaped=True);(D/(label+'.json')).write_text(json.dumps(r,indent=2));print(json.dumps({k:r[k] for k in ['exit','reason','peakGroupRSS','aggregateClientGrowthPeak','bytes']}));sys.exit(125 if reason else code)
