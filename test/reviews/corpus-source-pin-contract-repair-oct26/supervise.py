import os,sys,subprocess,resource,pathlib,json,time,selectors,hashlib
TASK=pathlib.Path('/tmp/corpus-source-pin-contract-repair-oct26'); ROOT=pathlib.Path('/home/user/wine-assembly')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
name,cwd,*argv=sys.argv[1:]; env=os.environ.copy();env['GIT_SSH_COMMAND']=SSH;env['NODE_OPTIONS']='--max-old-space-size=192'
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024*1024,24*1024*1024))
 if pathlib.Path(argv[0]).name=='git':resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 os.setsid()
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
clients=[]
for proc in pathlib.Path('/proc').iterdir():
 if not proc.name.isdigit():continue
 try:
  if pathlib.Path(os.readlink(proc/'exe')).name!='codex':continue
  rss=int(next(l.split()[1] for l in (proc/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
  clients.append({'pid':int(proc.name),'rss':rss})
 except (OSError,StopIteration):pass
baselinePids={c['pid'] for c in json.loads((TASK/'ops/admission.json').read_text())['clients']}
newWorkers=[]
for c in clients:
 try:
  cmd=pathlib.Path('/proc',str(c['pid']),'cmdline').read_bytes()
  if c['pid'] not in baselinePids and b'--profile\x00wine-worker' in cmd:newWorkers.append(c['pid'])
 except OSError:pass
prospective=max(0,4-len(newWorkers))*268435456
assert mem>=805306368+sum(c['rss'] for c in clients)+prospective+268435456,(mem,clients,prospective)
assert __import__('shutil').disk_usage(TASK).free>=2982150144
start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits); chunks=[]; size=0; sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
try:
 while sel.get_map():
  assert time.monotonic()-start<120,'wall limit'
  for key,_ in sel.select(0.1):
   b=os.read(key.fileobj.fileno(),8192)
   if not b:sel.unregister(key.fileobj);continue
   size+=len(b);assert size<=2*1024*1024,'capture limit';chunks.append(b)
 p.wait(timeout=max(.01,120-(time.monotonic()-start)))
except BaseException:
 os.killpg(p.pid,9);p.wait();raise
output=b''.join(chunks);(TASK/'ops'/f'{name}.log').write_bytes(output)
r={'argv':argv,'cwd':cwd,'exitCode':p.returncode,'seconds':time.monotonic()-start,'outputBytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'limits':{'cpu':90,'wall':120,'file':25165824,'capture':2097152,'gitOnlyData':536870912},'nodeOptions':env['NODE_OPTIONS'],'memAvailable':mem,'measuredClients':clients,'prospectiveAllowance':prospective,'materializedReservedWorkers':newWorkers,'nodePhysicalAllowance':268435456}
(TASK/'ops'/f'{name}.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));print(output[:6000].decode(errors='replace') if not name.startswith('quiet-') else '[output retained without excerpt]')
sys.exit(p.returncode)
