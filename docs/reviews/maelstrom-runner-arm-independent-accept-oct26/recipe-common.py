import pathlib,subprocess,os,json,hashlib,time,resource,shutil,signal
H=pathlib.Path('/tmp/maelstrom-runner-arm-independent-accept-oct26');O=H/'ops';R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');C=pathlib.Path('/home/user/.codex')
D=pathlib.Path('/tmp/maelstrom-initialized-runner-arm-repair-oct26/repo')
REV='3fef8f026fffb4f47261097edd51e14cbd044964';BR='task/'+H.name
E=R/'docs/reviews'/H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE=shutil.which('node')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def alloc(p):
 try:s=p.stat();return max(s.st_size,s.st_blocks*512)
 except FileNotFoundError:return 0
def size(p):return alloc(p)+sum(alloc(x) for x in p.rglob('*')) if p.is_dir() else alloc(p)
def limits(isgit=False):
 for k,v in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,25165824)]+([(resource.RLIMIT_DATA,536870912)] if isgit else []):resource.setrlimit(k,(v,v))
def run(argv,cwd=None,isgit=False,input=None):
 if pathlib.Path(argv[0]).name=='node':
  env=dict(os.environ,GIT_SSH_COMMAND=SSH)
  save('node-exact-configuration.json',dict(executable=NODE,executableSHA256=sha(pathlib.Path(NODE).read_bytes()),flags=['--max-old-space-size=192'],environmentSHA256=sha(json.dumps(env,sort_keys=True).encode()),environmentKeys=sorted(env),cpu=90,wall=120,file=25165824,output=2097152,data='inherited unlimited',addressSpace='inherited unlimited'))
 p=subprocess.Popen(argv,cwd=cwd,env=dict(os.environ,GIT_SSH_COMMAND=SSH),preexec_fn=lambda:limits(isgit),stdin=subprocess.PIPE if input is not None else None,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 try:out,err=p.communicate(input,timeout=120)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait();raise
 assert len(out)+len(err)<=2097152,'output guard'
 if err:
  with (O/'command-stderr.log').open('ab') as f:f.write(err)
 if p.returncode:save('first-command-failure.json',dict(argv=argv,code=p.returncode,stderr=err[:8192].decode(errors='replace')))
 assert p.returncode==0,(p.returncode,err[:2000])
 return out
def git(*args,cwd=R,input=None):return run(['git','-c','pack.threads=1','-c','pack.window=0',*args],cwd,True,input)
def gate(stage):
 baseline=json.load(open(O/'db-baseline.json'));sid=os.environ.get('CODEX_SESSION_ID','');sessions=list((C/'sessions/2026/10/26').glob('*'+sid+'*.jsonl')) if sid else []
 charges=dict(local=size(H),launcher=size(ROOT/'scratch/usage-watch'/H.name),session=sum(alloc(p) for p in sessions),positiveWAL=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in baseline.items()),future=8388608,reserve=8388608)
 total=max(41943040,sum(charges.values()));mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free
 procs=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace');rss=int(next((l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')),'0'))*1024
   if rss and any(x in cmd for x in ['codex','node','start-worker']):procs.append(dict(pid=int(p.name),rss=rss,command=cmd[:180]))
  except OSError:pass
 demand=268435456+4*335544320+805306368
 j=dict(charges=charges,projected=total,memAvailable=mem,processes=procs,aggregateRSS=sum(p['rss'] for p in procs),requiredMemory=demand,hostFree=free,hostAfterProjectedGrowth=free-max(0,total-charges['local']),liveRSSAlreadyExcluded=True)
 j['pass']=total<=67108864 and j['hostAfterProjectedGrowth']>=2982150144 and mem>=demand
 save('resources-'+stage+'.json',j);assert j['pass'],j
 return j
