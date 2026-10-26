import os,sys,json,pathlib,resource,subprocess,time,hashlib,shutil,signal,urllib.request
P=pathlib.Path('/tmp/dashboard-sidebar-private-browser-activation-oct26');R=P/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');L=pathlib.Path('/home/user/wine-dashboard-b0b9bc090/ops')
D=pathlib.Path('/tmp/dashboard-sidebar-independent-publication-oct26/repo')
LAUNCH=ROOT/'scratch/usage-watch'/P.name
BASE='7681b752d7c3fe565a49e92832c3d9825bec7ed9';BRANCH='task/'+P.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE='/usr/local/bin/node'; APP='81fd237e43112d93f946ed327e3d4e9cdd57ed1f7fc0642d2583e0b3e8693059'
OLD='7c1c314cfaab858da8a840399b5c9785b0ca1626919304b6069886d119aa4132'
def save(n,x):
 p=P/n;p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,indent=2)+'\n');t.replace(p)
def sha(p):
 h=hashlib.sha256()
 with pathlib.Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 return h.hexdigest()
def size(p):
 try:return max(p.stat().st_size,p.stat().st_blocks*512)
 except FileNotFoundError:return 0
def wal():return {str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}
def gate(label,browser=False):
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 processes=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   name=(p/'exe').resolve().name
   if 'codex' in name or name in ['chrome','node']:
    processes.append(dict(pid=int(p.name),exe=name,rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 baseline=json.loads((P/'accounting-baseline.json').read_text());ws=wal();positive=sum(max(0,v-baseline['wal'].get(k,0)) for k,v in ws.items())
 session=pathlib.Path(baseline['session']);actual=sum(size(f) for root in [P,LAUNCH] for f in root.rglob('*') if f.is_file() and not f.is_symlink())+size(session)+positive
 required=2*268435456+(3*335544320+1342177280 if browser else 4*335544320)+805306368
 projected=max(40*1024**2,actual+8*1024**2+8*1024**2);free=shutil.disk_usage(P).free
 receipt=dict(label=label,at=time.time(),MemAvailable=mem,processes=processes,existingRSSAlreadyInMemAvailable=True,newClientsReserved=2,newClientBytesEach=268435456,lightAllowances=3 if browser else 4,lightAllowanceEach=335544320,browserAggregateAllowance=1342177280 if browser else None,browserPriorMeasuredAggregateRSS=1228795904,physicalFloor=805306368,requiredAvailable=required,ownedBytes=actual,positiveWALGrowthCountedOnce=positive,sessionBytes=size(session),projectedBytesIncluding8MiBReserveAnd8MiBGrowth=projected,hardBytes=67108864,hostFree=free,hostRemainingProjected=free-(projected-actual))
 receipt['pass']=mem>=required and projected<=67108864 and receipt['hostRemainingProjected']>=2982150144
 save('resources-'+label+'.json',receipt)
 if not receipt['pass']:raise RuntimeError('resource admission denied: '+label)
 return receipt
def limits(git):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(name,argv,git=False,cwd=None,expected=0,inputBytes=None,wall=120,browser=False):
 out=P/(name+'.stdout');err=P/(name+'.stderr');env=os.environ.copy();env.update(GIT_SSH_COMMAND=SSH,NODE_OPTIONS='--max-old-space-size=192',GIT_TERMINAL_PROMPT='0',TMPDIR=str(P/'tmp'));(P/'tmp').mkdir(exist_ok=True)
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,env=env,stdin=subprocess.PIPE if inputBytes else subprocess.DEVNULL,stdout=o,stderr=e,preexec_fn=lambda:limits(git),start_new_session=True);start=time.monotonic();peak=0;diskpeak=0
  if inputBytes:p.stdin.write(inputBytes);p.stdin.close()
  while p.poll() is None:
   rss=0
   for q in pathlib.Path('/proc').glob('[0-9]*'):
    try:
     if os.getpgid(int(q.name))==p.pid:rss+=int((q/'statm').read_text().split()[1])*4096
    except (OSError,ValueError,ProcessLookupError):pass
   peak=max(peak,rss)
   if browser:diskpeak=max(diskpeak,sum(size(f) for f in P.rglob('*') if f.is_file() and not f.is_symlink()))
   if time.monotonic()-start>wall or out.stat().st_size+err.stat().st_size>2097152 or (browser and (rss>1342177280 or diskpeak>48*1024**2)):
    os.killpg(p.pid,signal.SIGKILL);p.wait();save(name+'-denial.json',dict(rss=rss,diskBytes=diskpeak,elapsed=time.monotonic()-start));raise RuntimeError('wall/output/browser RSS/disk operation cap')
   time.sleep(.05)
 save(name+'.json',dict(argv=argv,cwd=str(cwd),exitCode=p.returncode,elapsed=time.monotonic()-start,peakSampledProcessGroupRSS=peak,peakOwnedDirectoryBytes=diskpeak,gitDataOnly=git,stdoutSHA256=sha(out),stderrSHA256=sha(err),cpuSeconds=90,wallSeconds=wall,fileBytes=25165824,outputBytes=2097152,nodeOptions=env['NODE_OPTIONS'],ssh=SSH))
 if p.returncode!=expected:raise RuntimeError(f'Unexpected exit {p.returncode}: {name}.json')
 return out.read_bytes()[:8192].decode(errors='replace').strip()
def git(name,*args,**kw):return run(name,['git',*args],git=True,cwd=kw.pop('cwd',R),**kw)
def get(path,cap=524288):
 with urllib.request.urlopen('http://127.0.0.1:8098'+path,timeout=15) as r:
  if r.headers.get('Content-Length'):assert int(r.headers['Content-Length'])<=cap
  b=r.read(cap+1);assert len(b)<=cap
  return dict(status=r.status,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),cacheControl=r.headers.get('Cache-Control')),b
def service():
 found=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   a=(p/'cmdline').read_bytes().split(b'\0')
   if b'/home/user/wine-dashboard-b0b9bc090/ops/server.js' in a and b'--port=8098' in a:
    found.append(dict(pid=int(p.name),argv=[x.decode() for x in a if x],exe=str((p/'exe').resolve()),cwd=str((p/'cwd').resolve()),startTicks=(p/'stat').read_text().split()[21],rss=int((p/'statm').read_text().split()[1])*4096))
  except (OSError,ValueError):pass
 assert len(found)==1
 return found[0]
if __name__=='__main__':
 sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob('*.jsonl'));session=max(sessions,key=lambda p:p.stat().st_mtime)
 save('accounting-baseline.json',dict(wal=wal(),session=str(session)));gate('precheckout')
 for f in ['/home/user/.ssh/wine_github_ed25519','/home/user/.ssh/wine_github_known_hosts']:assert pathlib.Path(f).is_file()
 startup=json.loads(run('startup',[NODE,'--max-old-space-size=192','-e','const fs=require("fs");console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss,NODE_OPTIONS:process.env.NODE_OPTIONS,startup:true}))']))
 save('node-startup.json',startup)
 for label in ['Max data size','Max address space']:assert 'unlimited' in next(x for x in startup['limits'].splitlines() if x.startswith(label))
 text=(ROOT/'test/run.js').read_text();parser=text[text.index('const getArg ='):text.index('// Was `--name=...`')]
 parsed=json.loads(run('mount-empty',[NODE,'--max-old-space-size=192','-e','const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}))']))
 assert parsed==dict(tree=[],mount=[])
 save('launch-configuration.json',dict(ssh=SSH,actualMountArgv=[],intendedFiles=[],parsed=parsed,canonicalParserSHA256=hashlib.sha256(parser.encode()).hexdigest(),noGuestOrMount=True,rootRefReceipt=json.loads((LAUNCH/'root-ref-digest.json').read_text())))
 assert sha(D/'ops/app.js')==APP
 R.mkdir();git('init','init','-b',BRANCH);git('author-name','config','user.name','Codex');git('author-email','config','user.email','codex@users.noreply.github.com');git('remote-add','remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 copied=[]
 for f in (D/'.git/objects').glob('[0-9a-f][0-9a-f]/*'):
  if not f.is_file():continue
  t=R/'.git/objects'/f.parent.name/f.name;t.parent.mkdir(exist_ok=True);shutil.copyfile(f,t);copied.append(dict(object=f.parent.name+f.name,bytes=f.stat().st_size,sha256=sha(f)))
 (R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n');save('flat-closure.json',dict(donor=str(D),objects=copied,bytes=sum(x['bytes'] for x in copied),standingRootAlternate=True))
 assert git('donor-head','rev-parse','HEAD',cwd=D)==BASE
 assert git('pinned-blob','rev-parse',BASE+':ops/app.js')==git('donor-blob','hash-object',str(D/'ops/app.js'))
 git('sparse-config','config','core.sparseCheckout','true');git('sparse-cone','config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('/ops/app.js\n/docs/reviews/'+P.name+'/\n')
 git('set-branch','update-ref','refs/heads/'+BRANCH,BASE);git('checkout','read-tree','-mu',BASE)
 save('standing-inputs.json',dict(nodeExecutable=str(pathlib.Path(NODE).resolve()),nodeSHA256=sha(pathlib.Path(NODE).resolve()),chromeExecutable='/opt/google/chrome/chrome',chromeSHA256=sha('/opt/google/chrome/chrome'),chromeStandingApproxBytes=690428*1024,puppeteer='/tmp/wa-local-runtime-deps/node_modules/puppeteer-core',donor=str(D),donorReceiptSHA256=sha(D.parent/'final-receipt.json'),installedToolsExecutedInPlace=True))
 print('preflight and sparse checkout PASS')
