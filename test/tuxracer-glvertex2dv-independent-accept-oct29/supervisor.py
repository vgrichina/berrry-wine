import os,sys,json,pathlib,resource,subprocess,time,signal,tempfile,hashlib
O=pathlib.Path('/tmp/tuxracer-glvertex2dv-independent-accept-oct29').resolve(); R=O/'repo'; M=1048576
sys.path.insert(0,str(O));import limit_contract
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
BASE=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch'); NAME=O.name
D=json.loads((BASE/(NAME+'-dispatch.json')).read_text()); A=json.loads((BASE/(NAME+'-admission.json')).read_text())
SESSION=next(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_SESSION_ID']+'*'))
WALS=list(pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
def allocated(p):
 total=0
 for base,dirs,files in os.walk(p):
  for n in files:
   try: total+=(pathlib.Path(base)/n).stat().st_blocks*512
   except FileNotFoundError:pass
 return total
wal0=sum(p.stat().st_size for p in WALS)
if not (O/'baseline.json').exists():
 (O/'baseline.json').write_text(json.dumps({'session':str(SESSION),'sessionBytes':SESSION.stat().st_size,'walBaselinePositiveOnce':wal0,'walPaths':[str(p) for p in WALS],'limits':{str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]},'at':time.time()}))
B=json.loads((O/'baseline.json').read_text()); parent=limit_contract.configure_parent()
ENV=os.environ.copy();ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.loads(pathlib.Path(D['objectStores']).read_text())['stores']);ENV['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';ENV['PYTHONDONTWRITEBYTECODE']='1'
def save(n,v):
 p=O/(n+'.json'); s=json.dumps(v,separators=(',',':'));assert len(s)<M;p.write_text(s)
def admission(label):
 st=os.statvfs(O); mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 task=allocated(O); session=max(0,SESSION.stat().st_size-B['sessionBytes']); wal=max(0,sum(p.stat().st_size for p in WALS)-B['walBaselinePositiveOnce'])
 rec={'at':time.time(),'device':O.stat().st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'free':st.f_bavail*st.f_frsize,'aggregate':A['aggregate'],'aggregateSHA':'9e00d796ea3db7af30c77df4107c28567ab2c49dd9a8a00565650104ff74fb82','projection':A['aggregate'],'taskAllocated':task,'sessionGrowth':session,'walPositiveOnce':wal,'ceiling':48*M,'floor':2982150144,'MemAvailable':mem,'memRequired':A['memRequired']}
 rec['PASS']=rec['free']-rec['projection']>=rec['floor'] and mem>=rec['memRequired'] and task+session+wal<48*M
 with (O/'admissions.jsonl').open('a') as f:f.write(json.dumps({'operation':label,**rec})+'\n')
 if not rec['PASS']:save('FIRST-RESOURCE-FAILURE',rec);raise RuntimeError('ADMISSION STOP')
 return rec

def run(argv, *, cwd, git=False, node=False, mutate=False, init=False, label='op'):
 p=pathlib.Path(cwd).resolve(strict=True)
 if not p.is_relative_to(O):raise ValueError('outside owned root')
 if git:
  if argv[:3]!=['git','-C',str(R)] or p!=R:raise ValueError('Git explicit owned -C/cwd required')
  if init:
   if (R/'.git').exists():raise ValueError('already initialized')
  elif mutate:
   for flag,expected in [('--show-toplevel',str(R)),('--absolute-git-dir',str(R/'.git'))]:
    q=run(['git','-C',str(R),'rev-parse',flag],cwd=R,git=True,label=label+'-identity')
    if q['stdout'].strip()!=expected:raise ValueError('git identity mismatch')
 admission(label)
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
  if node:resource.setrlimit(resource.RLIMIT_DATA,ORIGINAL_DATA)
  else:limit_contract.child_limits(git)
 with tempfile.TemporaryFile(dir=O) as out,tempfile.TemporaryFile(dir=O) as err:
  start=time.monotonic(); proc=subprocess.Popen(argv,cwd=p,env=ENV,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True); peak=0
  try:
   while True:
    rss=0
    for x in pathlib.Path('/proc').iterdir():
     if not x.name.isdigit():continue
     try:
      stat=(x/'stat').read_text().split(); prss=int((x/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
      if int(stat[4])==proc.pid:rss+=prss
     except (OSError,ValueError,IndexError):continue
    peak=max(peak,rss)
    parentrss=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
    if rss>512*M or parentrss>128*M or out.tell()+err.tell()>2*M or time.monotonic()-start>120:raise RuntimeError('resource cap STOP')
    if proc.poll() is not None:break
    time.sleep(.03)
  except BaseException as ex:
   save('FIRST-RESOURCE-FAILURE',{'operation':label,'error':str(ex),'rss':peak,'at':time.time()});raise
  finally:
   try:os.killpg(proc.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   proc.wait()
  out.seek(0);err.seek(0); b=out.read(2*M+1);e=err.read(2*M+1)
  rec={'argv':argv,'cwd':str(p),'code':proc.returncode,'stdout':b.decode(errors='replace'),'stderr':e.decode(errors='replace'),'peakGroupRSS':peak,'parentRSS':parentrss,'seconds':time.monotonic()-start}
  save(label,rec)
  if proc.returncode:raise RuntimeError(label+' FAILED: '+e[:1000].decode(errors='replace'))
  return rec

def git(args,*,mutate=False,label='git',init=False):return run(['git','-C',str(R)]+args,cwd=R,git=True,mutate=mutate,init=init,label=label)
if __name__=='__main__':
 action=sys.argv[1]
 if action=='prepare':
  controls={}
  for n,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/tuxracer-glvertex2dv-dispatch-repair-oct29'})]:
   try:run(['/bin/pwd'],**kw)
   except (TypeError,ValueError):controls[n]='REJECTED BEFORE SPAWN'
   else:raise RuntimeError('negative control failed')
  save('containment',{'controls':controls,'sentinel':run(['/bin/pwd'],cwd=O,label='sentinel')['stdout'],'parentLimits':parent,'mountArgv':[],'intendedMountFiles':[],'SSH':ENV['GIT_SSH_COMMAND']})
  pins={}
  for n,v in D['sourcePins'].items():
   b=(R/n).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'];pins[n]=v
  save('source-pins',pins)
  git(['init'],init=True,label='init')
  git(['config','core.sparseCheckout','true'],mutate=True,label='sparse-config')
  git(['config','core.sparseCheckoutCone','false'],mutate=True,label='sparse-cone')
  (R/'.git/info/sparse-checkout').write_text('\n'.join('/'+n for n in D['sourcePins'])+'\n/test/'+NAME+'/\n')
  git(['read-tree',D['candidate']],mutate=True,label='sparse-index')
  git(['update-ref','refs/heads/task/'+NAME,D['candidate']],mutate=True,label='branch')
  git(['symbolic-ref','HEAD','refs/heads/task/'+NAME],mutate=True,label='head')
  save('candidate',git(['show','--format=fuller','--stat',D['candidate']],label='candidate-show'))
  for i,n in enumerate(D['sourcePins']):
   blob=git(['rev-parse',D['candidate']+':'+n],label='blob-'+str(i))['stdout'].strip()
   expected=hashlib.sha1(b'blob '+str((R/n).stat().st_size).encode()+b'\0'+(R/n).read_bytes()).hexdigest();assert blob==expected
  save('node-startup',run(['/usr/bin/node','--max-old-space-size=128','-e','const fs=require("fs");console.log(JSON.stringify({node:process.execPath,version:process.version,flags:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8")}))'],cwd=R,node=True,label='node-startup-run'))
  print('PREPARED')
 elif action=='node':
  result=run(['/usr/bin/node','--max-old-space-size=128']+sys.argv[2:],cwd=R,node=True,label='node-'+pathlib.Path(sys.argv[2]).stem); print(json.dumps({'code':result['code'],'stdout':result['stdout'][:4500],'peakGroupRSS':result['peakGroupRSS']}))
