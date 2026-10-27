import os,sys,pathlib,json,hashlib,importlib.util,fcntl,resource,shutil,time
P=pathlib.Path('/tmp/generally-callback-census-boundary-repair-oct27/ops'); B=P.parent
M=1024**2
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
sp=importlib.util.spec_from_file_location('trusted',S); m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
label,mode,*cmd=sys.argv[1:]
assert not (P/(label+'.json')).exists(), 'unique operation labels required'
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_OPTIONAL_LOCKS']='0';os.environ['PYTHONDONTWRITEBYTECODE']='1'
if mode=='git':
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 cmd=['/usr/bin/prlimit','--data=536870912','--',*cmd]
def allocated(p):
 return p.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in p.rglob('*')) if p.is_dir() else p.lstat().st_blocks*512
events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/generally-callback-census-boundary-repair-oct27')
sessions=list(pathlib.Path('/home/user/.codex/sessions').glob('**/*'+os.environ['CODEX_THREAD_ID']+'.jsonl'))
wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
if not (P/'wal-baseline.json').exists():(P/'wal-baseline.json').write_text(json.dumps(wal))
baseline=json.loads((P/'wal-baseline.json').read_text())
def accounting():
 used=allocated(B)+allocated(events)+sum(allocated(p) for p in sessions)+sum(max(0,allocated(pathlib.Path(p))-n) for p,n in baseline.items() if pathlib.Path(p).exists())
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 free=shutil.disk_usage(B).free
 return dict(taskEventsSessionPositiveWALBytes=used,future=32*M,reserve=8*M,margin=8*M,allocation=192*M,memAvailable=mem,requiredMem=320*M+256*M+805306368+24*M,free=free,projectedFree=free-48*M)
admit=accounting();(P/(label+'.admission.json')).write_text(json.dumps(admit,indent=2))
assert admit['taskEventsSessionPositiveWALBytes']+48*M<=192*M and admit['memAvailable']>=admit['requiredMem'] and admit['projectedFree']>=2982150144,admit
out=P/(label+'.stdout');err=P/(label+'.stderr')
shim='import subprocess,sys; r=subprocess.run(sys.argv[3:],stdout=open(sys.argv[1],"wb"),stderr=open(sys.argv[2],"wb"));sys.exit(r.returncode)'
def check():
 if sum(x.stat().st_size for x in (out,err) if x.exists())>2*M:return 'operation output2MiB'
 a=accounting()
 if a['taskEventsSessionPositiveWALBytes']+48*M>192*M:return 'task disk allocation'
 if a['projectedFree']<2982150144:return 'disk floor'
 if a['memAvailable']<805306368:return 'memory headroom'
r=m.supervise([sys.executable,'-c',shim,str(out),str(err),*cmd],rss_limit=(256 if mode in ('git','node') else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
(P/(label+'.supervisor-output')).write_bytes(r.pop('output'))
r.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),environmentSafeSHA256=hashlib.sha256(json.dumps(sorted(os.environ.items())).encode()).hexdigest(),parentLimits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_AS,resource.RLIMIT_DATA,resource.RLIMIT_FSIZE,resource.RLIMIT_CPU)},finalAccounting=accounting())
(P/(label+'.json')).write_text(json.dumps(r,indent=2))
print(json.dumps({k:v for k,v in r.items() if k not in ('command','owned','parentLimits','finalAccounting')}))
for p in (out,err):
 if p.exists():print(p.name+': '+p.read_text(errors='replace')[:2200])
sys.exit(1 if r['stopReason'] else r['exit'] or 0)
