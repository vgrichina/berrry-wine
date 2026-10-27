import os,sys,json,pathlib,hashlib,time,shutil,subprocess,resource,fcntl,importlib.util
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/enigma-supervised-streamed-production-gameplay-oct27');O=H/'ops';R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');TAG=H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
SUP=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):
 p=O/n;t=p.with_suffix('.new');t.write_text(json.dumps(v,indent=2)+'\n');t.replace(p)
def allocated(paths):
 seen=set();total=0
 for p in paths:
  if not p.exists():continue
  for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
   try:s=q.lstat()
   except FileNotFoundError:continue
   key=(s.st_dev,s.st_ino)
   if key not in seen:total+=s.st_blocks*512;seen.add(key)
 return total
def gate(label):
 b=json.loads((O/'baseline.json').read_text());c=pathlib.Path('/home/user/.codex')
 external=allocated([ROOT/'scratch/usage-watch'/f'{TAG}-run1',*list((c/'sessions/2026/10/27').glob('*'+b['thread']+'*'))])
 wal=sum(max(0,allocated([p])-b['wal'].get(str(p),0)) for p in c.glob('*.sqlite-wal'))
 own=allocated([H])+external+wal
 peers=[]
 for name,n in [('airstrike-accepted-focus-menu-quit-api-oct27',56),('penguin-accepted-contract-main-integrate-oct27',48)]:
  material=allocated([pathlib.Path('/tmp')/name]);peers.append(dict(task=name,allocation=n*1048576,materialized=material,future=max(0,n*1048576-material)))
 free=shutil.disk_usage(H).free;future=sum(p['future'] for p in peers)
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 v=dict(at=time.time(),label=label,ownedAllocated=allocated([H]),externalAllocated=external,positiveWALSinceBaseline=wal,
  initialWALGrowthBeforeBaseline='not attributable; all remaining external allowance reserved',used=own,allocation=33554432,reserve=8388608,
  externalLimit=8388608,partsMiB=dict(sparseGitOps=4,captures=8,external=8,transferPublication=4,reserve=8),peers=peers,
  free=free,projected=free-max(0,33554432-own)-future,floor=2982150144,memAvailable=mem,
  physicalRequired=3*320*1048576+128*1048576+805306368)
 v['pass']=own+8388608<=33554432 and external+wal<=8388608 and v['projected']>=v['floor'] and mem>=v['physicalRequired']
 save('accounting-'+label+'.json',v)
 if not v['pass']:raise RuntimeError('resource gate rejected: '+json.dumps(v))
 return v
def run(label,args,git=False):
 gate(label);assert sha(SUP)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 spec=importlib.util.spec_from_file_location('sup',SUP);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 argv=[sys.executable,__file__,'direct-git',*args] if git else args
 with open('/tmp/wine-ops-production-git.lock' if git else O/'test.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  def check():
   try:gate('live-'+label)
   except Exception as ex:save('failure-'+label+'.json',dict(error=str(ex)));return 'resource admission rejected'
  r=s.supervise(argv,rss_limit=(256 if git else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
 out=r.pop('output');(O/(label+'-output.log')).write_bytes(out);save(label+'-execution.json',dict(r,argv=argv))
 print(json.dumps(r));print(out[:8192].decode(errors='replace'))
 if r['stopReason'] or r['exit']:raise RuntimeError('execution failed '+label)
if __name__=='__main__':
 if sys.argv[1]=='baseline':
  event=ROOT/'scratch/usage-watch'/f'{TAG}-run1/events.jsonl'
  thread=next(json.loads(x)['thread_id'] for x in event.open() if json.loads(x).get('type')=='thread.started')
  save('baseline.json',dict(at=time.time(),thread=thread,wal={str(p):allocated([p]) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}))
  print(json.dumps(gate('initial')))
 elif sys.argv[1]=='direct-git':
  def limit():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
  sys.exit(subprocess.run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*sys.argv[2:]],preexec_fn=limit,env=dict(os.environ,GIT_SSH_COMMAND=SSH,TMPDIR=str(O),GIT_OPTIONAL_LOCKS='0')).returncode)
 elif sys.argv[1]=='git':run(sys.argv[2],sys.argv[3:],True)
 elif sys.argv[1]=='gate':print(json.dumps(gate(sys.argv[2])))
 else:run(sys.argv[1],sys.argv[2:])
