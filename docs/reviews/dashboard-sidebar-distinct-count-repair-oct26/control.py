import os, sys, json, pathlib, resource, subprocess, time, hashlib, shutil, signal
P=pathlib.Path('/tmp/dashboard-sidebar-distinct-count-repair-oct26')
R=P/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly')
LAUNCH=ROOT/'scratch/usage-watch'/P.name
D=pathlib.Path('/tmp/blocker-count-telegram-regression-publication-oct26/repo')
REV='938ea5bb01a25c51a9d70db756be3873fefe68f7'
BRANCH='task/dashboard-sidebar-distinct-count-repair-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE='/usr/local/bin/node'
def save(n,x):
 p=P/n; tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(x,indent=2)+'\n');tmp.replace(p)
def sha(p):
 h=hashlib.sha256()
 with pathlib.Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 return h.hexdigest()
def allocated(p):
 try:return p.stat().st_blocks*512
 except FileNotFoundError:return 0
def wal():return {str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}
def gate(label):
 clients=[]
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   if 'codex' not in (q/'exe').resolve().name:continue
   args=(q/'cmdline').read_bytes().split(b'\0')
   clients.append(dict(pid=int(q.name),rss=int((q/'statm').read_text().split()[1])*4096,flags=[a.decode() for a in args if a.startswith(b'model_') or a==b'gpt-6.1-sol']))
  except (OSError,ValueError):pass
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 baseline=json.loads((P/'wal-baseline.json').read_text()); current=wal()
 positive=sum(max(0,v-baseline.get(k,0)) for k,v in current.items())
 actual=sum(allocated(f) for root in [P,LAUNCH] for f in root.rglob('*') if f.is_file() and not f.is_symlink())+positive
 projected=max(32*1024**2,actual+8*1024**2)+8*1024**2
 free=shutil.disk_usage(P).free
 required=805306368+268435456+256*1024**2
 x=dict(label=label,at=time.time(),MemAvailable=mem,clients=clients,aggregateClientRSS=sum(c['rss'] for c in clients),existingRSSAlreadyCountedInMemAvailable=True,newClientReserveCountedOnce=268435456,nodePhysicalAllowance=256*1024**2,physicalFloor=805306368,requiredAvailable=required,ownedAllocatedIncludingLauncherAndPositiveWAL=actual,positiveWALConservativeUpperBound=positive,wal=current,projectedBytesIncluding8MiBReserve=projected,hardBytes=67108864,hostFree=free,hostRemainingProjected=free-(projected-actual))
 x['pass']=mem>=required and projected<=67108864 and x['hostRemainingProjected']>=2982150144
 save('resources-'+label+'.json',x)
 if not x['pass']:raise RuntimeError('resource admission denied: '+label)
 return x
def limits(git):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(argv,git=False,cwd=None,expected=0):
 i=len(list(P.glob('command-*.json')))
 out=P/f'command-{i}.stdout';err=P/f'command-{i}.stderr'
 env=os.environ.copy();env['GIT_SSH_COMMAND']=SSH;env['NODE_OPTIONS']='--max-old-space-size=192';env['GIT_TERMINAL_PROMPT']='0'
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=o,stderr=e,preexec_fn=lambda:limits(git),start_new_session=True)
  start=time.monotonic()
  while p.poll() is None:
   if time.monotonic()-start>120 or out.stat().st_size+err.stat().st_size>2097152:
    os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError('command wall/output cap')
   time.sleep(.025)
 receipt=dict(argv=argv,cwd=str(cwd),exitCode=p.returncode,elapsed=time.monotonic()-start,gitDataOnly=git,stdout=str(out),stderr=str(err),stdoutSHA256=sha(out),stderrSHA256=sha(err),cpuSeconds=90,wallSeconds=120,fileBytes=25165824,outputBytes=2097152,nodeOptions=env['NODE_OPTIONS'])
 save(f'command-{i}.json',receipt)
 if p.returncode!=expected:raise RuntimeError(f'Unexpected exit {p.returncode}, receipt command-{i}.json')
 b=out.read_bytes()
 if len(b)>8192:raise RuntimeError('return excerpt cap; raw output retained')
 return b.decode().strip()
def git(*args,**kw):return run(['git',*args],git=True,cwd=kw.pop('cwd',R),**kw)
if __name__=='__main__':
 save('wal-baseline.json',wal());gate('precheckout')
 for f in ['/home/user/.ssh/wine_github_ed25519','/home/user/.ssh/wine_github_known_hosts']:assert pathlib.Path(f).is_file()
 startup=json.loads(run([NODE,'--max-old-space-size=192','-e','const fs=require("fs");console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss,NODE_OPTIONS:process.env.NODE_OPTIONS,startup:true}))']))
 save('node-startup.json',startup)
 assert 'unlimited' in next(x for x in startup['limits'].splitlines() if x.startswith('Max data size'))
 text=(ROOT/'test/run.js').read_text();parser=text[text.index('const getArg ='):text.index('// Was `--name=...`')]
 parsed=json.loads(run([NODE,'--max-old-space-size=192','-e','const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}))']))
 assert parsed==dict(tree=[],mount=[])
 save('launch-configuration.json',dict(ssh=SSH,actualMountArgv=[],intendedFiles=[],parsed=parsed,canonicalParserSHA256=hashlib.sha256(parser.encode()).hexdigest(),noGuestOrMount=True,nodeStartup='node-startup.json',rootRefReceipt=json.loads((LAUNCH/'root-ref-digest.json').read_text())))
 R.mkdir();git('init','-b',BRANCH)
 git('config','user.name','Codex');git('config','user.email','codex@users.noreply.github.com')
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 # Reuse exact accepted existing leaf-first alternate closure; never edit donor/shared Git.
 closure=pathlib.Path('/tmp/blocker-count-private-dashboard-activation-oct26/flat-alternates.txt')
 paths=closure.read_text().splitlines();assert 0<len(paths)<=2048
 assert all(len(p.encode())<8192 and pathlib.Path(p).is_dir() for p in paths)
 (R/'.git/objects/info/alternates').write_text('\n'.join(paths)+'\n')
 save('alternate-reuse.json',dict(stores=len(paths),closureSHA256=sha(closure),readOnlyDonor=str(D),priorWarningEvidence='/tmp/blocker-count-private-dashboard-activation-oct26/repo/docs/reviews/blocker-count-private-dashboard-activation-oct26/git-warnings.json',method='unchanged bounded leaf-first existing stores; isolated Git configuration only'))
 assert git('cat-file','-t',REV)=='commit'
 git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
 (R/'.git/info/sparse-checkout').write_text('/ops/app.js\n/ops/blocker-model.js\n/ops/dashboard-sidebar-count.test.js\n/docs/reviews/dashboard-sidebar-distinct-count-repair-oct26/\n')
 git('update-ref','refs/heads/'+BRANCH,REV);git('read-tree','-mu',REV)
 expected={'ops/app.js':'7c1c314cfaab858da8a840399b5c9785b0ca1626919304b6069886d119aa4132','ops/blocker-model.js':'1d3ebcd5e31e1eb2e91eb78e9996da2ae8f12840d1a2c30a11fe61c307fe3f7b'}
 for n,h in expected.items():assert sha(R/n)==h and sha(D/n)==h
 save('pinned-inputs.json',dict(base=REV,donor=str(D),hashes=expected,rootReadOnly=True,mainOwnership=False))
 print(json.dumps(dict(precheckout='PASS',startup='PASS',mount='empty canonical parser PASS',pinned='PASS',stores=len(paths))))
