import os, sys, pathlib, json, subprocess, resource, time, selectors, shutil, hashlib
T=pathlib.Path('/tmp/corpus-source-pin-independent-accept-oct26')
R=pathlib.Path('/home/user/wine-assembly')
L=R/'scratch/usage-watch/corpus-source-pin-independent-accept-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def bytes_tree(p):
 return sum(f.lstat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink()) if p.exists() else 0
def wals():
 return {str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
def admission():
 clients=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   if pathlib.Path(os.readlink(p/'exe')).name!='codex':continue
   rss=int(next(x.split()[1] for x in (p/'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
   clients.append({'pid':int(p.name),'rss':rss})
  except (OSError,StopIteration):pass
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 initial=T/'ops/initial.json'
 old=json.loads(initial.read_text())['wal'] if initial.exists() else wals()
 walGrowth=sum(max(0,v-old.get(k,v)) for k,v in wals().items())
 owned=bytes_tree(T)+bytes_tree(L)+walGrowth
 future=24*1024*1024; reserve=8*1024*1024
 free=shutil.disk_usage(T).free
 r={'memAvailable':mem,'clients':clients,'combinedClientRSS':sum(x['rss'] for x in clients),'nodePhysicalAllowance':268435456,'physicalFloor':805306368,'prospectiveReservations':0,'accounting':'all materialized clients measured once; no future workers assigned to this task','ownedBytes':owned,'positiveSharedWALGrowthOnce':walGrowth,'futureGrowth':future,'reserve':reserve,'projected':owned+future+reserve,'allocation':67108864,'hostFree':free,'hostAfterGrowth':free-future,'hostFloor':2982150144}
 assert mem>=805306368+r['combinedClientRSS']+268435456,r
 assert r['projected']<=67108864 and r['hostAfterGrowth']>=2982150144,r
 return r
def run(name,cwd,argv):
 a=admission();env=os.environ.copy();env['GIT_SSH_COMMAND']=SSH;env['NODE_OPTIONS']='--max-old-space-size=192';env['TMPDIR']=str(T/'tmp');(T/'tmp').mkdir(exist_ok=True)
 def limit():
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
  if pathlib.Path(argv[0]).name=='git':resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  os.setsid()
 start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,env=env,preexec_fn=limit,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);chunks=[];size=0
 try:
  while sel.get_map():
   assert time.monotonic()-start<120,'wall limit'
   for k,_ in sel.select(.1):
    b=os.read(k.fileobj.fileno(),8192)
    if not b:sel.unregister(k.fileobj);continue
    size+=len(b);assert size<=2097152,'capture limit';chunks.append(b)
  p.wait(timeout=max(.01,120-(time.monotonic()-start)))
 except BaseException:
  os.killpg(p.pid,9);p.wait();raise
 output=b''.join(chunks);(T/'ops'/f'{name}.log').write_bytes(output)
 r={'argv':argv,'cwd':str(cwd),'exitCode':p.returncode,'seconds':time.monotonic()-start,'outputBytes':size,'sha256':hashlib.sha256(output).hexdigest(),'admission':a,'env':{'NODE_OPTIONS':env['NODE_OPTIONS'],'TMPDIR':env['TMPDIR'],'GIT_SSH_COMMAND':SSH},'limits':{'cpu':90,'wall':120,'file':25165824,'capture':2097152,'gitOnlyData':536870912}}
 (T/'ops'/f'{name}.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'name':name,'exitCode':p.returncode,'outputBytes':size,'receipt':str(T/'ops'/f'{name}.json')}));print(output[:4096].decode(errors='replace'));return p.returncode
if __name__=='__main__':sys.exit(run(sys.argv[1],sys.argv[2],sys.argv[3:]))
