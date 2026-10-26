import os,sys,json,pathlib,resource,subprocess,time,hashlib,shutil,urllib.request
P=pathlib.Path('/tmp/blocker-count-private-dashboard-activation-oct26'); P.mkdir(exist_ok=True)
D=pathlib.Path('/tmp/blocker-count-telegram-regression-publication-oct26/repo')
L=pathlib.Path('/home/user/wine-dashboard-b0b9bc090/ops')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,x): (P/n).write_text(json.dumps(x,indent=2)+'\n')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(8192),b''): h.update(b)
 return h.hexdigest()
def limits(git=False):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90)); resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
 if git: resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(argv,git=False,cwd=None):
 env=os.environ.copy();env['GIT_SSH_COMMAND']=SSH;env['NODE_OPTIONS']='--max-old-space-size=192'
 r=subprocess.run(argv,cwd=cwd,env=env,preexec_fn=lambda:limits(git),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
 i=len(list(P.glob('command-*.json'))); save(f'command-{i}.json',{'argv':argv,'cwd':str(cwd),'returncode':r.returncode,'stdout':r.stdout.decode(errors='replace'),'stderr':r.stderr.decode(errors='replace'),'gitDataLimitOnly':git})
 if len(r.stdout)>8192 or len(r.stderr)>8192: raise RuntimeError('capture too large; preserved owned result')
 if r.stderr: print(r.stderr.decode(errors='replace'))
 if r.returncode: raise RuntimeError(f'command exit {r.returncode}')
 return r.stdout.decode().strip()
def ownedbytes():
 roots=[P,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/blocker-count-private-dashboard-activation-oct26')]
 return sum(f.stat().st_size for root in roots for f in root.rglob('*') if f.is_file() and not f.is_symlink())
def resources(label,browser=536870912):
 clients=[]
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   c=(q/'cmdline').read_bytes().split(b'\0');exe=(q/'exe').resolve().name
   if 'codex' not in exe: continue
   rss=int((q/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE');clients.append({'pid':int(q.name),'rss':rss,'flags':[a.decode(errors='replace') for a in c if b'model' in a or b'compac' in a or b'medium' in a or b'gpt-' in a]})
  except (OSError,ValueError,IndexError): pass
 mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
 actual=ownedbytes();projected=max(45*1024**2,actual+16*1024**2)+8*1024**2
 free=shutil.disk_usage(P).free; required=805306368+268435456+browser
 x={'at':time.time(),'label':label,'ownedBytes':actual,'projectedTotalIncluding8MiBReserve':projected,'hardBytes':67108864,'free':free,'freeAfterProjectedIncrement':free-(projected-actual),'MemAvailable':mem,'clients':clients,'aggregateClientRSS':sum(c['rss'] for c in clients),'alreadyMaterializedClientsCountedOnceInMemAvailable':True,'prospectiveClient':268435456,'physicalFloor':805306368,'browserDemandAllowance':browser,'requiredAvailable':required,'pass':projected<=67108864 and free-(projected-actual)>=2982150144 and mem>=required}
 save('resources-'+label+'.json',x)
 if not x['pass']: raise RuntimeError('resource admission denied')
 return x
def sample(label):
 pid=int(subprocess.check_output(['systemctl','show','wine-ops.service','-p','MainPID','--value'],text=True));s=pathlib.Path(f'/proc/{pid}/status').read_text()
 x={'at':time.time(),'pid':pid,'rssBytes':int(next(z.split()[1] for z in s.splitlines() if z.startswith('VmRSS:')))*1024};save('service-'+label+'.json',x);return x
def get(url,cap=8388608):
 with urllib.request.urlopen('http://127.0.0.1:8098'+url,timeout=20) as r:
  b=bytearray()
  while True:
   c=r.read(min(8192,cap+1-len(b)))
   if not c: break
   b.extend(c)
   if len(b)>cap: raise RuntimeError('HTTP byte cap exceeded before parsing')
  return {'status':r.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},bytes(b)
if __name__=='__main__':
 resources('startup'); sample('before')
 startup={'argv':sys.argv,'node':os.path.realpath('/usr/local/bin/node'),'browser':os.path.realpath('/usr/bin/google-chrome'),'ssh':SSH,'mountArgv':[],'mountValidation':'N/A: local files only; no mount or guest invocation; no filename-bearing mount argv exists','cpuSeconds':90,'commandWallSeconds':120,'fileMaxBytes':25165824,'browserWallSeconds':60,'singleExcerptBytes':8192,'nodeHeapFlag':'--max-old-space-size=192','gitDataOnlyBytes':536870912,'readOnlyDonor':str(D),'rootRefReceipt':'/home/user/wine-assembly/scratch/usage-watch/blocker-count-private-dashboard-activation-oct26/root-ref-digest.json'}
 save('startup.json',startup)
 print(run(['/usr/local/bin/node','--max-old-space-size=192','-e',"const fs=require('fs');console.log(JSON.stringify({argv:process.execArgv,node:process.execPath,limits:fs.readFileSync('/proc/self/limits','utf8'),puppeteer:require('/tmp/wa-local-runtime-deps/node_modules/puppeteer-core/package.json').version,startup:true}))"]))
 run(['git','rev-parse','HEAD'],True,D)
