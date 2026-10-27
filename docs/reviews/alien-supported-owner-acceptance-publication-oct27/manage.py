import os,sys,json,time,hashlib,shutil,subprocess,fcntl,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
O=Path(__file__).parent; H=O.parent; R=H/'repo'
ROOT=Path('/home/user/wine-assembly')
DONOR=Path('/tmp/alien-menu-action-budget-controller-repair-oct27/repo')
PRIOR=Path('/tmp/alien-supervisor-owned-controller-implementation-oct27/ops')
CANDIDATE='d8694f71a82df09be05ea3e9222ff1c535da47a3'
TREE='4b0279edfc0266ab0bb0a6a40c619d1d896405b2'
BR='task/alien-supported-owner-acceptance-publication-oct27'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
SUP=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):
 p=O/n;t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(v,indent=2)+'\n');os.replace(t,p)
def alloc(paths):
 seen=set();total=0
 for p in paths:
  for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
   try:s=q.lstat()
   except FileNotFoundError:continue
   k=s.st_dev,s.st_ino
   if k not in seen:seen.add(k);total+=s.st_blocks*512
 return total
def gate(label):
 wals=list(Path('/home/user/.codex').glob('*-wal'));bp=O/'wal-baseline.json'
 if not bp.exists():save(bp.name,{str(p):alloc([p]) for p in wals})
 base=json.loads(bp.read_text());wal=sum(max(0,alloc([p])-base.get(str(p),0)) for p in wals)
 session=list(Path('/home/user/.codex/sessions/2026/10/27').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
 launch=list((ROOT/'scratch/usage-watch').glob(H.name+'*'))
 used=alloc([H,*session,*launch])+wal
 free=shutil.disk_usage(H).free;mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 clients=[]
 for p in Path('/proc').glob('[0-9]*'):
  try:
   cmd=p.joinpath('cmdline').read_bytes()
   if b'/bin/codex' in cmd and (b'exec\0' in cmd or b'resume\0' in cmd):clients.append(dict(pid=int(p.name),argv=cmd.decode().split('\0'),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024))
  except (OSError,IndexError):pass
 remaining=max(8388608,33554432-used)
 j=dict(at=time.time(),used=used,allocation=33554432,positiveWALCountedOnce=wal,breakdown=dict(own=alloc([H]),sessions=alloc(session),launcher=alloc(launch)),remaining=remaining,peerFuture=100663296,free=free,projectedFree=free-remaining-100663296,floor=2982150144,memAvailable=mem,clients=clients,aggregateClientRSS=sum(c['rss'] for c in clients),futureClient=402653184,newClient=335544320,headroom=805306368,lightPool=134217728,categoriesMiB=dict(sourceGitTempEvidence=8,sessionEventsWAL=8,publication=8,reserve=8))
 j['pass']=used+8388608<=33554432 and j['projectedFree']>=j['floor'] and mem>=max(4,len(clients))*335544320+805306368+268435456
 save('admission-'+label+'.json',j);assert j['pass'],j
def pins():return {p:sha(R/p) for p in json.loads((PRIOR/'production-contract.json').read_text())['pins']}
def supervisor():
 assert sha(SUP)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 s=importlib.util.spec_from_file_location('physical_supervisor',SUP);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def execute(label,cmd):
 gate(label);before=pins();save(label+'-pins.json',before)
 harness={str(p):sha(p) for p in (O/'manage.py',O/'accept.py') if p.exists()}
 r=supervisor().supervise(cmd,rss_limit=134217728,cpu_limit=90,wall_limit=120,output_limit=2097152)
 out=r.pop('output');save(label+'-execution.json',dict(**r,argv=cmd,harnessPins=harness));(O/(label+'-output.log')).write_bytes(out)
 assert before==pins()
 completed=[g for g in ('live','uncertain','new-and-death','timeout') if (O/(g+'-result.json')).exists()]
 save('checkpoint.json',dict(candidate=CANDIDATE,tree=TREE,pins=before,completedGroup=label,result=r,remaining=['review and conditional evidence publication'],reused='/tmp/alien-supervisor-owned-independent-accept-oct27/ops/result.json'))
 print(json.dumps(r));print(out[:8192].decode(errors='replace'));return r
def git(*args,repo=None):
 label='git-%d-%d'%(os.getpid(),time.time_ns())
 cmd=[sys.executable,str(ROOT/'scratch/usage-watch/light-execution-pool-oct26.py'),'--slots','2','--',sys.executable,__file__,'git-child',label,str(repo or R),*args]
 r=subprocess.run(cmd,capture_output=True);assert r.returncode==0,(r.stdout[:8192],r.stderr[:8192]);return (O/(label+'-output.log')).read_text().strip()
if __name__=='__main__':
 if sys.argv[1]=='git-child':
  _,_,label,repo,*args=sys.argv
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX);gate(label);os.environ['GIT_SSH_COMMAND']=SSH
   cmd=['prlimit','--data=536870912:536870912','git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','-C',repo,*args]
   r=supervisor().supervise(cmd,rss_limit=268435456,cpu_limit=90,wall_limit=120,output_limit=2097152);out=r.pop('output');save(label+'-execution.json',dict(**r,argv=cmd,ssh=SSH,limitsPlacement='RLIMIT_DATA only direct Git subprocess'));(O/(label+'-output.log')).write_bytes(out)
   sys.exit(1 if r['stopReason'] else r['exit'] or 0)
 else:execute(sys.argv[1],sys.argv[2:])
