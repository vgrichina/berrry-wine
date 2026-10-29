import os,sys,json,time,pathlib,hashlib,resource,subprocess,signal
OWN=pathlib.Path('/tmp/tuxracer-original-pe-startup-import-contract-oct29/repo').resolve()
OUT=OWN/'test/tuxracer-original-pe-startup-import-contract-oct29'
ROOT=pathlib.Path('/home/user/wine-assembly'); TASK='tuxracer-original-pe-startup-import-contract-oct29'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
def save(name,obj):
 p=OUT/name;p.write_text(json.dumps(obj,indent=2)+'\n')
def admission(label):
 st=os.statvfs(OWN); a=json.loads((ROOT/f'scratch/usage-watch/{TASK}-admission.json').read_text()); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 r={'at':time.time(),'operation':label,'device':os.stat(OWN).st_dev,'f_bavail':st.f_bavail,'blockSize':st.f_frsize,'freeBytes':st.f_bavail*st.f_frsize,'aggregate':a['aggregate'],'projection':st.f_bavail*st.f_frsize-a['aggregate'],'MemAvailable':mem,'requiredMem':a['memRequired']}
 r['PASS']=r['projection']>=2982150144 and mem>=r['requiredMem'];p=OUT/'admissions.jsonl'
 with p.open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('FIRST ADMISSION FAILURE: '+json.dumps(r))
def valid(cwd):
 p=pathlib.Path(cwd).resolve()
 if p!=OWN and OWN not in p.parents:raise ValueError('cwd outside owned task')
 return p
def env():
 e=os.environ.copy(); stores=json.loads((ROOT/f'scratch/usage-watch/{TASK}-object-stores.json').read_text())['stores'];e['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores);e['GIT_SSH_COMMAND']=SSH;e['GIT_TERMINAL_PROMPT']='0';return e
def run(argv,*,cwd,git=False,mutate=False,initial=False,label='command'):
 cwd=valid(cwd);admission(label)
 if git:
  if argv[0]!='git' or argv[1:3]!=['-C',str(OWN)]:raise ValueError('Git explicit -C required')
  if mutate and not initial:
   top=run(['git','-C',str(OWN),'rev-parse','--show-toplevel','--absolute-git-dir'],cwd=OWN,git=True,label='validate-git-identity').decode().splitlines()
   if top!=[str(OWN),str(OWN/'.git')]:raise ValueError('Git identity mismatch')
 cap=256 if git else 128
 def limits():
  os.setsid();resource.setrlimit(resource.RLIMIT_DATA,(cap*1024**2,cap*1024**2));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
 stem=label.replace('/','_');out=OUT/(stem+'.stdout');err=OUT/(stem+'.stderr');start=time.monotonic();peak=0;reason=None
 with out.open('wb') as fo,err.open('wb') as fe:
  p=subprocess.Popen(argv,cwd=cwd,env=env(),stdout=fo,stderr=fe,preexec_fn=limits)
  while p.poll() is None:
   group=0
   for x in pathlib.Path('/proc').iterdir():
    if not x.name.isdigit():continue
    try:
     stat=(x/'stat').read_text().split(); rss=int(stat[23])*os.sysconf('SC_PAGE_SIZE')
     if int(stat[4])==p.pid:
      group+=rss
      if rss>(256 if git else 128)*1024**2:reason='process RSS cap'
    except (OSError,ValueError,IndexError):pass
   peak=max(peak,group)
   if group>512*1024**2:reason='group RSS cap'
   if time.monotonic()-start>120:reason='wall cap'
   if out.stat().st_size+err.stat().st_size>2*1024**2:reason='capture cap'
   if reason:os.killpg(p.pid,signal.SIGKILL);break
   time.sleep(.025)
  rc=p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 save(stem+'.receipt.json',{'argv':argv,'cwd':str(cwd),'rc':rc,'reason':reason,'peakGroupRSS':peak,'descendantCleanup':'kill process group after wait','seconds':time.monotonic()-start})
 if rc or reason:raise RuntimeError(f'{label}: rc={rc} reason={reason}; see stderr')
 return out.read_bytes()
if __name__=='__main__':
 if sys.argv[1]=='git':
  args=sys.argv[2:];mutation=args[0] in ['init','read-tree','config','checkout','add','commit','push','update-ref','symbolic-ref']
  data=run(['git','-C',str(OWN)]+args,cwd=OWN,git=True,mutate=mutation,initial=args[0]=='init',label='git-'+args[0]);sys.stdout.buffer.write(data[:8192])
