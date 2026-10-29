import os,sys,json,time,resource,subprocess,signal,pathlib,hashlib
ROOT=pathlib.Path('/tmp/toyvm-recovered-caller-acceptance-oct29'); REPO=ROOT/'repo'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
STORES=json.load(open('/home/user/wine-assembly/scratch/usage-watch/recovered-three-oct29-object-stores.json'))['stores']
ENV=dict(os.environ,GIT_ALTERNATE_OBJECT_DIRECTORIES=os.pathsep.join(STORES),GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
seq=max([int(p.stem.split('-')[1]) for p in ROOT.glob('op-*.out')]+[0])
def admission(label):
 s=os.statvfs(ROOT); mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
 initial=json.load(open(ROOT/'initial.json'));wal=sum(max(0,os.stat(p).st_size-v) for p,v in initial['walBaselines'].items());session=os.stat(initial['session']).st_size
 owned=sum(f.stat().st_blocks*512 for f in ROOT.rglob('*') if f.is_file())
 r=dict(at=time.time(),operation=label,device=os.stat(ROOT).st_dev,f_bavail=s.f_bavail,blocksize=s.f_frsize,free=s.f_bavail*s.f_frsize,MemAvailable=mem,aggregate=100663296,minimum=3149922304,ownPhysical=owned,sessionBytes=session,positiveWALOnce=wal,projection=initial['projection'])
 r['PASS']=r['free']>=3149922304 and mem>=2147483648 and owned+session+wal<=25165824
 with open(ROOT/'admission.jsonl','a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('ADMISSION FAIL '+json.dumps(r))
def run(argv,*,cwd,git=False):
 global seq
 cwd=pathlib.Path(cwd).resolve()
 if cwd!=ROOT and ROOT not in cwd.parents:raise ValueError('outside owned task')
 admission(str(argv)[:400]);seq+=1;stem=ROOT/('op-%03d'%seq)
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912));resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*1048576,)*2)
 with open(str(stem)+'.out','wb') as out,open(str(stem)+'.err','wb') as err:
  proc=subprocess.Popen(argv,cwd=str(cwd),env=ENV,stdout=out,stderr=err,start_new_session=True,preexec_fn=limits)
  start=time.monotonic();peak=0;incident=None
  while proc.poll() is None:
   total=0
   for entry in os.scandir('/proc'):
    if not entry.name.isdigit():continue
    try:
     st=open(entry.path+'/stat').read().split();rss=int(st[23])*os.sysconf('SC_PAGE_SIZE')
     if int(st[4])==proc.pid:
      total+=rss
      if rss>(512 if git else 128)*1048576:incident='physical RSS cap'
    except (OSError,ValueError,IndexError):pass
   peak=max(peak,total)
   if total>512*1048576:incident='group RSS cap'
   if time.monotonic()-start>120:incident='wall cap'
   if os.stat(str(stem)+'.out').st_size+os.stat(str(stem)+'.err').st_size>2097152:incident='capture cap'
   if incident:os.killpg(proc.pid,signal.SIGKILL);break
   time.sleep(.02)
  proc.wait()
  try:os.killpg(proc.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 r=dict(argv=argv,cwd=str(cwd),returncode=proc.returncode,peakGroupRSS=peak,wall=time.monotonic()-start,incident=incident,stdout=str(stem)+'.out',stderr=str(stem)+'.err')
 with open(ROOT/'commands.jsonl','a') as f:f.write(json.dumps(r)+'\n')
 if incident or proc.returncode:raise RuntimeError('COMMAND FAIL '+json.dumps(r))
 return pathlib.Path(str(stem)+'.out').read_bytes()
def git(args,*,mutate=False,initialize=False):
 if initialize:
  assert not (REPO/'.git').exists() and args[0]=='init'
 elif mutate:
  assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=REPO,git=True).decode().strip()==str(REPO)
  assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=REPO,git=True).decode().strip()==str(REPO/'.git')
 return run(['git','-C',str(REPO),*args],cwd=REPO,git=True)
