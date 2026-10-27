import os,sys,json,time,pathlib,hashlib,importlib.util,subprocess,fcntl,resource,shutil
H=pathlib.Path('/tmp/gta2-fullscreen-mode-cause-repair-oct27'); O=H/'ops'; R=H/'repo'; ROOT=pathlib.Path('/home/user/wine-assembly')
TRUST=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_SSH_COMMAND']=SSH; os.environ['GIT_OPTIONAL_LOCKS']='0'; os.environ['PYTHONDONTWRITEBYTECODE']='1'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,v):
 p=O/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def alloc(p):
 if not p.exists():return 0
 return sum(q.lstat().st_blocks*512 for q in [p,*p.rglob('*')] if not q.is_symlink()) if p.is_dir() else p.stat().st_blocks*512
def gate(label):
 bp=O/'baseline.json'
 if not bp.exists(): save('baseline.json',dict(wal={str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}))
 b=json.loads(bp.read_text());wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in b['wal'].items())
 tags=['gta2-fullscreen-mode-cause-repair-oct27','generally-loading-ack-cause-repair-oct27','airstrike-startup-space-cause-repair-oct27']
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(p/'cmdline').read_bytes().split(b'\0');s=(p/'stat').read_text().split(') ')[1].split()
   if cmd and pathlib.Path(os.fsdecode(cmd[0])).name=='codex' and b'exec' in cmd:clients.append(dict(pid=int(p.name),rss=int(s[21])*4096))
  except (OSError,IndexError):pass
 ep=ROOT/'scratch/usage-watch'/H.name; actual=alloc(H)+alloc(ep)+wal
 ev=ep/'events.jsonl';tid=None
 if ev.exists():
  with ev.open() as f:tid=json.loads(next(f)).get('thread_id')
 if tid:actual+=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*'))
 # MemAvailable already excludes current RSS: reserve only remaining client growth.
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=sum(max(0,335544320-x['rss']) for x in clients)+max(0,3-len(clients))*335544320+805306368+805306368
 free=shutil.disk_usage(H).free; remaining=3*268435456 # conservative: other allocations not subtracted twice
 v=dict(at=time.time(),actual=actual,allocation=268435456,reserve=8388608,walPositiveCountedOnce=wal,clients=clients,memAvailable=mem,requiredRemainingRAM=required,freeDisk=free,reservedIncrementalGrowth=remaining,projectedFree=free-remaining,diskFloor=2982150144,taskProjection=dict(sourceGit=16777216,staging=8388608,evidence=16777216,sessionEventsWAL=100663296,publication=16777216,growth=100663296,reserve=8388608))
 v['pass']=actual+8388608<=268435456 and mem>=required and free-remaining>=2982150144;save('admission-'+label+'.json',v);assert v['pass'],v
def run(label,argv,kind='python'):
 gate(label);assert sha(TRUST.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 s=importlib.util.spec_from_file_location('trusted',TRUST);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
 if kind=='git':argv=['/usr/bin/prlimit','--data=536870912:536870912','--',*argv]
 def check():
  n=sum((O/(label+'.'+x)).stat().st_size for x in ['stdout','stderr'] if (O/(label+'.'+x)).exists())
  return 'output-file-limit' if n>2097152 else None
 lock=open('/tmp/wine-ops-production-git.lock','a') if kind=='git' else None
 if lock:fcntl.flock(lock,fcntl.LOCK_EX)
 try:r=m.supervise([sys.executable,str(O/'streams.py'),label,*argv],rss_limit={'python':134217728,'node':805306368,'git':268435456}[kind],cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
 finally:
  if lock:lock.close()
 out=r.pop('output');(O/(label+'.supervisor.log')).write_bytes(out);save(label+'.execution.json',dict(argv=argv,kind=kind,result=r))
 print(json.dumps(dict(label=label,**{k:v for k,v in r.items() if k!='owned'})));assert r['exit']==0 and not r['stopReason'] and r['cleanupComplete'],r
 print((O/(label+'.stdout')).read_text(errors='replace')[:6000])
if __name__=='__main__':run(sys.argv[1],sys.argv[3:],sys.argv[2])
