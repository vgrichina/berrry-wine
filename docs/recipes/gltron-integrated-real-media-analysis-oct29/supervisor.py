import os, pathlib, json, time, resource, signal, subprocess, hashlib, datetime
ROOT=pathlib.Path('/tmp/gltron-integrated-real-media-analysis-oct29')
REPO=ROOT/'repo'
E=ROOT/'evidence'
BASE=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
D=json.loads((BASE/'gltron-integrated-real-media-analysis-oct29-dispatch.json').read_text())
ENV=os.environ.copy()
ENV.update(GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(json.loads(pathlib.Path(D['objectStores']).read_text())['stores']),GIT_OPTIONAL_LOCKS='0',GIT_TERMINAL_PROMPT='0',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(ROOT),PALETTE_BROWSER_SUPERVISED='1')
def save(name,value):
 (E/name).write_text(json.dumps(value,indent=2)+'\n')
def physical(path):
 seen=set();n=0
 for d,ds,fs in os.walk(path):
  for f in fs:
   s=os.lstat(os.path.join(d,f));k=(s.st_dev,s.st_ino)
   if k not in seen:seen.add(k);n+=s.st_blocks*512
 return n
def admission(op):
 s=os.statvfs(ROOT);b=json.loads((E/'baseline.json').read_text())
 wal=sum(max(0,os.stat(p).st_blocks*512-v['physical']) for p,v in b['initialWAL'].items())
 session=os.stat(b['session']).st_blocks*512
 events=physical(BASE/D['task'])
 owned=physical(ROOT)
 mem=next(int(x.split()[1])*1024 for x in open('/proc/meminfo') if x.startswith('MemAvailable:'))
 r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),op=op,device=os.stat(ROOT).st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=s.f_bavail*s.f_frsize,aggregate=125829120,projection=125829120,required=3175088128,MemAvailable=mem,ownedPhysical=owned,sessionPhysical=session,externalEvents=events,positiveSharedWALOnce=wal,allocation=50331648,reserve=8388608)
 r['PASS']=r['freeBytes']-r['projection']>=r['required'] and mem>=2147483648 and owned+session+events+wal+8388608<=50331648 and physical(E)<=1048576
 with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('STOP admission '+json.dumps(r))
 return r
def validate(cwd):
 p=pathlib.Path(cwd).resolve()
 if p!=ROOT and ROOT not in p.parents:raise ValueError('outside owned task directory')
 return str(p)
def limits(isgit,isnode=False):
 if not isnode:resource.setrlimit(resource.RLIMIT_DATA,((268435456 if isgit else 134217728),)*2)
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912))
def run(argv,*,cwd,expected=0):
 cwd=validate(cwd);admission(argv[:6]);isgit=argv[0]=='git'
 if isgit:assert argv[1:3]==['-C',str(REPO)]
 n=len(list(E.glob('op-*.json')));stem=E/('op-%03d'%n);start=time.monotonic();peak=0;peakone=0;incident=None
 with open(str(stem)+'.out','wb') as out,open(str(stem)+'.err','wb') as err:
  p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=out,stderr=err,start_new_session=True,preexec_fn=lambda:limits(isgit,pathlib.Path(argv[0]).name=='node'))
  try:
   while True:
    rss=0
    for proc in pathlib.Path('/proc').iterdir():
     if not proc.name.isdigit():continue
     try:
      st=(proc/'stat').read_text().split(') ')[1].split()
      if int(st[2])!=p.pid:continue
      one=int(st[21])*os.sysconf('SC_PAGE_SIZE');rss+=one;peakone=max(one,peakone)
      lim=268435456 if isgit and int(proc.name)==p.pid else 134217728
      if one>lim:raise RuntimeError('individual physical RSS limit')
     except (OSError,ValueError,IndexError):continue
    peak=max(peak,rss)
    if rss>536870912 or time.monotonic()-start>120 or os.fstat(out.fileno()).st_size+os.fstat(err.fileno()).st_size>2097152:raise RuntimeError('group/time/capture cap')
    if p.poll() is not None:break
    time.sleep(.01)
  except Exception as ex:incident=str(ex)
  finally:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   p.wait()
 o=pathlib.Path(str(stem)+'.out').read_bytes();e=pathlib.Path(str(stem)+'.err').read_bytes()
 save(stem.name+'.json',dict(argv=argv,cwd=cwd,exit=p.returncode,stdoutBytes=len(o),stderrBytes=len(e),peakGroupRSS=peak,peakProcessRSS=peakone,seconds=time.monotonic()-start,incident=incident,groupCleanup='SIGKILL after exit, leader waited'))
 if incident or p.returncode!=expected:raise RuntimeError('STOP '+stem.name+' '+str(incident)+' '+e[:1200].decode(errors='replace'))
 return o
def git(args,*,mutate=False,initial=False):
 if initial:assert args==['init'] and not (REPO/'.git').exists()
 elif mutate:
  assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=REPO).decode().strip()==str(REPO)
  assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=REPO).decode().strip()==str(REPO/'.git')
 return run(['git','-C',str(REPO)]+args,cwd=REPO)
def controls():
 rejected=[]
 for p in ['/', '/home/user/wine-assembly',D['source']['path'],'/tmp']:
  try:run(['/usr/bin/touch',str(ROOT/'SENTINEL')],cwd=p)
  except ValueError:rejected.append(p)
 try:run(['/usr/bin/touch',str(ROOT/'SENTINEL')])
 except TypeError:rejected.append('omitted')
 assert len(rejected)==5 and not (ROOT/'SENTINEL').exists()
 save('containment.json',dict(rejected=rejected,sentinelAbsent=True))
