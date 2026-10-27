import sys,os,json,time,pathlib,importlib.util,resource,subprocess,hashlib,fcntl,shutil
BASE=pathlib.Path('/tmp/enigma-progressive-menu-readiness-repair-oct27'); OPS=BASE/'ops'
TRUST='/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def dump(p,v): p.write_text(json.dumps(v,indent=2)+'\n')
def allocated(p):
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if not x.is_symlink()) if p.exists() else 0
if sys.argv[1]=='--child':
 c=json.loads(pathlib.Path(sys.argv[2]).read_text()); name=c['name']; env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_TERMINAL_PROMPT='0',PYTHONDONTWRITEBYTECODE='1',GIT_OPTIONAL_LOCKS='0')
 dump(OPS/(name+'-process.json'),dict(argv=c['argv'],cwd=c.get('cwd'),envSHA256=hashlib.sha256(json.dumps(sorted(env.items())).encode()).hexdigest(),inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ('RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_DATA','RLIMIT_AS')},SSH=SSH))
 lock=None
 if c.get('git'):
  lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 def git_limits(): resource.setrlimit(resource.RLIMIT_DATA,(512*1024**2,512*1024**2))
 with open(OPS/(name+'.stdout'),'xb') as out,open(OPS/(name+'.stderr'),'xb') as err:
  try:
   p=subprocess.Popen(c['argv'],cwd=c.get('cwd'),env=env,stdout=out,stderr=err,preexec_fn=git_limits if c.get('git') else None); rc=p.wait()
  except BaseException as ex:
   err.write(repr(ex).encode());raise
 dump(OPS/(name+'-exit.json'),dict(exit=rc,stdoutBytes=out.name and pathlib.Path(out.name).stat().st_size,stderrBytes=pathlib.Path(err.name).stat().st_size))
 sys.exit(rc)
assert hashlib.sha256(pathlib.Path(TRUST).read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
c=json.loads(pathlib.Path(sys.argv[1]).read_text());spec=importlib.util.spec_from_file_location('sup',TRUST);sup=importlib.util.module_from_spec(spec);spec.loader.exec_module(sup)
# Existing peer RSS is already reflected by MemAvailable. Reserve future clients once.
ledger=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/source-repair-fleet-admission-oct27.json').read_text())
events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-progressive-menu-readiness-repair-oct27')
def check():
 used=allocated(BASE);ev=allocated(events);free=shutil.disk_usage(BASE).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 if used+ev+40*1024**2>128*1024**2:return 'task allocation'
 if allocated(BASE/'repo')>20*1024**2 or allocated(OPS)>52*1024**2 or ev>16*1024**2:return 'task bucket'
 if free-ledger['futureDisk']<2982150144:return 'host disk floor'
 if mem<805306368+256*1024**2:return 'host memory headroom and childpool'
 if sum(p.stat().st_size for p in OPS.glob(c['name']+'.std*'))>2*1024**2:return 'operation output cap'
 return None
failure=check();assert not failure,failure
r=sup.supervise([sys.executable,__file__,'--child',sys.argv[1]],rss_limit=(256 if c.get('git') else 128)*1024**2,cpu_limit=90,wall_limit=120,output_limit=2*1024**2,check=check)
r['output']=r['output'].decode(errors='replace');r['taskBytes']=allocated(BASE);r['eventBytes']=allocated(events);r['trustedSupervisorSHA256']=hashlib.sha256(pathlib.Path(TRUST).read_bytes()).hexdigest();dump(OPS/(c['name']+'-supervision.json'),r)
print(json.dumps(r));sys.exit(1 if r['stopReason'] else r['exit'] or 0)
