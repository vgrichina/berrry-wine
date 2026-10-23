import os,sys,pathlib,json,time,subprocess,selectors,signal,resource,hashlib,ctypes,fcntl
B=pathlib.Path('/tmp/d3d-scoped-native-qualification-oct23'); ROOT=pathlib.Path('/home/user/wine-assembly')
BASELINE=ROOT/'scratch/usage-watch/d3d-scoped-native-qualification-oct23.baseline.json'
SID=os.environ.get('WINE_TASK_SESSION_ID','')
if not SID:
 for line in (ROOT/'scratch/usage-watch/d3d-scoped-native-qualification-oct23/events.jsonl').read_text().splitlines():
  e=json.loads(line)
  if e.get('type')=='thread.started': SID=e['thread_id'];break
if not SID: raise RuntimeError('missing task session identity')
LIMIT=67108864; CAP=524288; FILE=25165824
# Additional direct inspection/outer output allowance, beyond initial 65536.
DIRECT_ALLOWANCE=131072
def write(p,j): p.write_text(json.dumps(j,indent=2)+'\n')
def scan_files(d):
 out={}
 for base,ds,fs in os.walk(d):
  for n in fs:
   p=pathlib.Path(base)/n
   try:
    s=p.lstat()
    if p.is_symlink(): continue
    out[str(p)]={'size':s.st_size,'inode':s.st_ino,'device':s.st_dev}
   except FileNotFoundError:pass
 return out
def mem():return int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
def sample():
 with (B/'accounting.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  return sample_locked()
def sample_locked():
 base=json.loads(BASELINE.read_text())['standingSQLite']; statep=B/'accounting-state.json'
 st=json.loads(statep.read_text()) if statep.exists() else {'previous':base,'cumulativeGrowth':0,'captureBytes':65536,'initialStanding':sum(x['size'] for x in base.values()),'initialHostFree':os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize,'samples':0}
 now={}
 for p in pathlib.Path('/home/user/.codex').iterdir():
  if '.sqlite' in p.name:
   try:s=p.stat();now[str(p)]={'size':s.st_size,'inode':s.st_ino,'device':s.st_dev}
   except FileNotFoundError:pass
 for p,s in now.items():
  prev=st['previous'].get(p)
  st['cumulativeGrowth']+=s['size'] if prev is None or (prev['inode'],prev['device'])!=(s['inode'],s['device']) else max(0,s['size']-prev['size'])
 st['previous']=now;st['samples']+=1
 ext=scan_files(ROOT/'scratch/usage-watch/d3d-scoped-native-qualification-oct23')
 for p in pathlib.Path('/home/user/.codex/sessions').rglob('*'+SID+'*'):
  if p.is_file():s=p.stat();ext[str(p)]={'size':s.st_size,'inode':s.st_ino,'device':s.st_dev}
 own=scan_files(B)
 for p,s in {**ext,**own}.items():
  if s['size']>FILE: raise RuntimeError('per-file guard: '+p+' '+str(s['size']))
 st['externalFiles']=ext;st['externalBytes']=sum(s['size'] for s in ext.values());st['privateBytes']=sum(s['size'] for s in own.values())
 st['standingBytes']=sum(s['size'] for s in now.values());st['hostFree']=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize
 st['externalHighwater']=max(st.get('externalHighwater',0),st['externalBytes'])
 st['privateHighwater']=max(st.get('privateHighwater',0),st['privateBytes'])
 st['captureBytes']=max(st['captureBytes'],65536+DIRECT_ALLOWANCE)
 st['measuredNew']=st['privateBytes']+st['externalHighwater']+st['cumulativeGrowth'];st['peakMeasuredNew']=max(st.get('peakMeasuredNew',0),st['measuredNew'])
 write(statep,st)
 if st['measuredNew']+8388608>LIMIT:raise RuntimeError('allocation guard '+str(st['measuredNew'])+' + reserve')
 if st['hostFree']<2982150144:raise RuntimeError('host free guard')
 return st
def run(argv,phase='cheap',cwd=None,env=None):
 cfg={'cheap':(60,805306368),'python':(60,0),'prepare':(900,2684354560),'native':(150,1610612736)};wall,minimum=cfg[phase]
 st=sample();available=mem();assert available>=minimum,(available,minimum)
 if pathlib.Path(argv[0]).name=='node':
  expected={'cheap':256,'prepare':2048,'native':512}[phase]
  assert '--max-old-space-size='+str(expected) in argv,'missing exact Node heap guard'
 plan=B/'admission.json'
 if plan.exists():
  j=json.loads(plan.read_text());remaining=max(0,j['privatePeak']-st['privateBytes'])+j['futureGrowth']+8388608
  assert st['measuredNew']+remaining<=LIMIT,'projected allocation guard'
  assert st['hostFree']-remaining>=2982150144,'projected host guard'
 def pre():
  os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(wall,wall));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 start=time.monotonic();p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=pre)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);chunks=[];count=0;failure=None
 try:
  while sel.get_map():
   if time.monotonic()-start>wall:raise RuntimeError('wall guard')
   sample()
   for key,_ in sel.select(.2):
    # Bound each read against aggregate BEFORE allocating/buffering.
    st=json.loads((B/'accounting-state.json').read_text());remaining=CAP-st['captureBytes']
    if remaining<=0:raise RuntimeError('capture guard')
    b=os.read(key.fileobj.fileno(),min(4096,remaining))
    if not b:sel.unregister(key.fileobj);continue
    st['captureBytes']+=len(b);write(B/'accounting-state.json',st);count+=len(b);chunks.append(b)
  code=p.wait(timeout=5)
 except BaseException as e:
  failure=str(e)
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  code=p.returncode
 finally:
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
 rec={'argv':argv,'phase':phase,'cwd':str(cwd),'MemAvailable':available,'minimum':minimum,'cpuWall':wall,'exit':code,'failure':failure,'seconds':time.monotonic()-start,'captureBytes':count,'output':b''.join(chunks).decode(errors='replace')}
 with (B/'execution.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
 sample()
 if failure or code:raise RuntimeError('command failed: '+str(failure or code)+'; bounded output retained in '+str(B/'execution.jsonl'))
 return rec['output']
if __name__=='__main__':
 if len(sys.argv)>1:
  phase=sys.argv[1];run(sys.argv[2:],phase=phase,cwd=os.environ.get('TASK_CWD'));print(json.dumps({'exit':0,'phase':phase,'outputReceipt':str(B/'execution.jsonl')}))
 else:
  s=sample();print(json.dumps({k:s[k] for k in ['measuredNew','cumulativeGrowth','standingBytes','externalBytes','privateBytes','hostFree','captureBytes']}))
