import pathlib, subprocess, json, hashlib, os, time, shutil
ROOT=pathlib.Path('/tmp/renderer-side-polling-merged-branch-oct26')
OPS=ROOT/'ops'; REPO=ROOT/'repo'
BASE='d6168240d93f2a92d401a6264efab0c3985e1ba0'
CAND='54af699eee71ed0cebc95de71ffd9248e6814679'
PARENT='67b01162d74016f0f9f9915e1b07d7a81f942770'
ORIGINAL='9148ceb18768955f647130c2e936228429892477'
REVIEW='ff4429ad5f3007ae42cf03898966c4f192999284'
BRANCH='task/renderer-side-polling-merged-branch-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
DONORS=[pathlib.Path(p) for p in ['/tmp/save-bundle-collision-retained-integrate-oct26/repo','/tmp/renderer-side-modifier-polling-repair-oct26/repo','/tmp/renderer-side-polling-independent-accept-oct26/repo']]
REVIEWDIR=DONORS[2]/'docs/reviews/renderer-side-polling-independent-accept-oct26'
DOCREL='docs/reviews/renderer-side-polling-merged-branch-oct26'
def sha(b): return hashlib.sha256(b).hexdigest()
def write(p,obj):
 p=pathlib.Path(p); p.parent.mkdir(parents=True,exist_ok=True)
 t=p.with_suffix(p.suffix+'.tmp'); t.write_text(json.dumps(obj,indent=2)+'\n'); t.replace(p)
def run(args,cwd=None,check=True):
 p=subprocess.run(args,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072, 'capture limit'
 if check and p.returncode: raise RuntimeError((args,p.returncode,p.stderr[:2000].decode(errors='replace')))
 return p
def git(*args,repo=REPO): return run(['git','-C',str(repo),*args]).stdout
def resource(stage):
 launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-merged-branch-oct26')
 session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*01a176ef-c743-7012-89ef-f6f8029927f4*'))
 files=[p for d in [ROOT,launcher] for p in d.rglob('*') if p.is_file() and not p.is_symlink()]+session
 owned=sum(p.stat().st_size for p in files); allocated=sum(p.stat().st_blocks*512 for p in files)
 mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(ROOT).free
 future=12*1024**2; reserve=8*1024**2; allowance=12*1024**2
 projected=max(owned,allocated)+future+reserve+allowance
 fleet=[]
 for d in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if 'codex' in cmd or 'start-worker.py' in cmd:
    rss=int(next(s.split()[1] for s in (d/'status').read_text().splitlines() if s.startswith('VmRSS:')))*1024
    fleet.append({'pid':int(d.name),'rss':rss,'argv':cmd[:1200]})
  except (OSError,StopIteration,ProcessLookupError): pass
 obj={'stage':stage,'at':time.time(),'ownedBytes':owned,'allocatedBytes':allocated,'futureSessionEventsPositiveWalOnce':future,'reserve':reserve,'checkoutEvidenceGitPublicationGrowthAllowance':allowance,'projectedPeak':projected,'limit':67108864,'freeDisk':free,'freeAfterGrowth':free-(projected-max(owned,allocated)),'memAvailable':mem,'afterClientHeap':mem-536870912-16777216,'ramFloor':805306368,'aggregateActualFleet':fleet,'standingTools':{'node':shutil.which('node'),'git':shutil.which('git'),'python':shutil.which('python3')},'standingReadonlyDonors':[str(p) for p in DONORS]}
 obj['pass']=projected<=67108864 and obj['freeAfterGrowth']>=2982150144 and obj['afterClientHeap']>=805306368
 write(OPS/('resources-'+stage+'.json'),obj)
 assert obj['pass'],json.dumps({k:v for k,v in obj.items() if k!='aggregateActualFleet'})
 print(stage,'resource PASS',owned,projected,mem,free)
