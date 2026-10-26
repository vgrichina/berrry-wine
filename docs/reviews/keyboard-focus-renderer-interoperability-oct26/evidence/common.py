import pathlib, subprocess, json, hashlib, os, time, shutil, resource
ROOT=pathlib.Path('/tmp/keyboard-focus-renderer-interoperability-oct26')
OPS=ROOT/'ops'; REPO=ROOT/'repo'
HOST=pathlib.Path('/home/user/wine-assembly')
RENDER='0d2aaf964b31d4191a76cf84900d7433b4611fa4'
BROWSER='2b5eaa0b0db6ef12882a38b6cd143291144d4150'
RD=pathlib.Path('/tmp/renderer-side-polling-merged-branch-oct26/repo')
BD=pathlib.Path('/tmp/browser-key-focus-release-repair-oct26/repo')
BRANCH='task/keyboard-focus-renderer-interoperability-oct26'
DOC='docs/reviews/keyboard-focus-renderer-interoperability-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def sha(b): return hashlib.sha256(b).hexdigest()
def write(p,obj):
 p=pathlib.Path(p); p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(obj,indent=2)+'\n')
def run(args,cwd=None,check=True,timeout=60):
 p=subprocess.run(args,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072,'capture limit'
 if check and p.returncode: raise RuntimeError((args,p.returncode,p.stderr[:2000].decode(errors='replace')))
 return p
def git(*args,repo=REPO): return run(['git','-C',str(repo),*args]).stdout
def admission(stage):
 launcher=HOST/'scratch/usage-watch/keyboard-focus-renderer-interoperability-oct26'
 sessions=[]; fleet=[]; seen=set()
 for d in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if 'codex' in cmd or 'start-worker.py' in cmd:
    rss=int(next(s.split()[1] for s in (d/'status').read_text().splitlines() if s.startswith('VmRSS:')))*1024
    fleet.append({'pid':int(d.name),'rss':rss,'argv':cmd[:1800]})
  except (OSError,StopIteration): pass
 # Session identity is provided by the task launcher; locate only this task's metadata.
 events=launcher/'events.jsonl'
 if events.exists():
  with events.open() as f: first=json.loads(f.readline(8192))
  sid=first.get('thread_id')
  if sid: sessions.extend(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 launch_results=list(launcher.glob('*.json'))
 for p in launch_results:
  if p.stat().st_size<8192:
   try:
    obj=json.loads(p.read_text()); sid=obj.get('session_id') or obj.get('sessionId')
    if sid: sessions.extend(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
   except (ValueError,AttributeError): pass
 paths=[p for d in [ROOT,launcher] if d.exists() for p in d.rglob('*') if p.is_file() and not p.is_symlink()]+sessions
 paths=list({str(p):p for p in paths}.values())
 logical=sum(p.stat().st_size for p in paths); allocated=sum(p.stat().st_blocks*512 for p in paths)
 used=max(logical,allocated); projected=max(56*1024**2,used+12*1024**2+8*1024**2+8*1024**2)
 free=shutil.disk_usage(ROOT).free
 mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
 obj={'stage':stage,'at':time.time(),'ownedLogical':logical,'ownedAllocated':allocated,'projectedPeak':projected,'allocation':67108864,'futureSessionEventsPositiveWALOnce':12582912,'reserve':8388608,'otherGrowth':8388608,'freeDisk':free,'freeAfterGrowth':free-(projected-used),'memAvailable':mem,'afterClientHeap':mem-553648128,'ramFloor':805306368,'fleet':fleet,'sessionFiles':[str(p) for p in sessions],'standingTools':{n:shutil.which(n) for n in ['node','git','python3']},'standingReadonlyDonors':[str(RD),str(BD)],'limits':{'nodeHeapMiB':16,'fileBytes':25165824,'outputBytes':131072,'captureBytes':2097152,'readExcerptBytes':8192}}
 obj['pass']=projected<=67108864 and obj['freeAfterGrowth']>=2982150144 and obj['afterClientHeap']>=805306368
 write(OPS/('resources-'+stage+'.json'),obj); assert obj['pass'],str(obj)
 print(stage,'PASS',used,projected,free,mem)
