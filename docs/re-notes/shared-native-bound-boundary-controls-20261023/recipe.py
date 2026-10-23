#!/usr/bin/env python3
"""Single authorized --large execution; no backend/staging/Memory/Instance.
Bounded capture derived from sealed donor recipe.py; changes recorded in report.
"""
import ctypes,hashlib,json,os,pathlib,re,resource,selectors,shutil,signal,subprocess,sys,time
sys.dont_write_bytecode=True
H=pathlib.Path(__file__).resolve().parent;R=H.parents[2]
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shared-native-bound-boundary-controls-oct23')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T05-41-21-01a16747-3137-7543-bc59-e2ded3a2b4c6.jsonl')
FILE=25165824;LOG=524288
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
ENV.pop('NODE_OPTIONS',None);ENV.pop('WINE_REGION_SHAKE',None)
ENV['NODE_OPTIONS']='--max-old-space-size=128'
NODE='/usr/local/bin/node'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def size(p):return sum(q.lstat().st_size for q in [p,*p.rglob('*')] if not q.is_symlink())
def admission():
 assert sha(H/'native-module-bound.cjs')=='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
 assert sha(H/'guard-controls.cjs')=='03d7585204d973afdf5cade79667a032c31fb6b7e80ce5dc4adf33788f8b7644'
 tools=json.loads((H/'first-admission.json').read_text())['tools']
 for t in tools:assert sha(pathlib.Path(t['path']))==t['sha256']
 assert sha(pathlib.Path(NODE))==tools[0]['sha256']
 owned=size(R);external=size(EXT)+SESSION.stat().st_size;growth=8388608;reserve=8388608;future=6291456;free=shutil.disk_usage(R).free
 memory=int(re.search(r'^MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text(),re.M).group(1))*1024
 # Enumerate command lines without broad log/donor scans; deny overlapping large
 # controls or compiler. Do not signal any other task's process.
 conflicts=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:a=(p/'cmdline').read_bytes().split(b'\0'); exe=pathlib.Path(a[0].decode()).name
  except (OSError,IndexError,UnicodeError):continue
  if exe in ['node','nodejs'] and any(b'build-compile-wat.js' in x or b'compile-src.js' in x or (b'guard-controls.cjs' in x and b'--large' in a) for x in a):conflicts.append({'pid':p.name,'argv':[x.decode(errors='replace') for x in a]})
 x=dict(owned=owned,external=external,futureGrowth=growth,evidenceGitTempAllowance=future,reserve=reserve,total=owned+external+growth+future+reserve,cap=67108864,hostFree=free,hostFreeAfterGrowth=free-growth-future,hostFloor=2982150144,MemAvailable=memory,minimumMemAvailable=805306368,overlappingOperations=conflicts,memoryPlan=dict(oldSpace=134217728,buffers=34603008,nativeValidationAllowance=134217728,processRuntimeStacksCodeAllowance=134217728,headroom=99614720,total=536870912,oldSpaceIsRSSLimit=False,nativeLiveMax=1,Memory=False,Instance=False))
 x['admitted']=x['total']<=x['cap'] and x['hostFreeAfterGrowth']>=x['hostFloor'] and memory>=805306368 and not conflicts
 dump('control-admission.json',x);assert x['admitted'],x
def childlimits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(FILE,FILE))
def bounded(argv,label,cwd=R):
 # Pipe limits are separate from regular-file RLIMIT; subreaper guarantees reap.
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=childlimits)
 sel=selectors.DefaultSelector();logs={};counts={'stdout':0,'stderr':0};start=time.monotonic();reason=None;term=None
 for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);logs[name]=(H/(label+'.'+name)).open('wb')
 while sel.get_map() or p.poll() is None:
  now=time.monotonic()
  if reason is None and now-start>60:reason='wall timeout'
  if reason is not None and term is None:
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   term=now
  if term is not None and now-term>=5:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  for key,_ in sel.select(.05):
   b=os.read(key.fileobj.fileno(),65536)
   if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
   name=key.data;remaining=LOG-sum(counts.values());logs[name].write(b[:max(0,remaining)]);counts[name]+=len(b)
   if sum(counts.values())>LOG:reason='aggregate stdout/stderr overflow'
  for f in R.rglob('*'):
   if f.is_file() and f.stat().st_size>FILE:reason='regular file overflow '+str(f)
 code=p.wait()
 # Reap this process group even if the direct child exited successfully.
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 deadline=time.monotonic()+5
 while True:
  try:
   found,status=os.waitpid(-1,os.WNOHANG)
   if found:continue
  except ChildProcessError:break
  if time.monotonic()>=deadline:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   break
  time.sleep(.02)
 for f in logs.values():f.close()
 try:
  while True:os.waitpid(-1,0)
 except ChildProcessError:pass
 result=dict(argv=argv,cwd=str(cwd),exit=code,reason=reason,elapsed=time.monotonic()-start,streamBytes=counts,reaped=True,pid=p.pid,cpuSeconds=60,wallSeconds=60,fileMax=FILE,aggregateLogMax=LOG,termThenKillSeconds=5)
 dump(label+'.json',result)
 return code if reason is None else 125

if __name__=='__main__':
 assert not (H/'attempt.json').exists(),'one-shot consumed; no retry'
 dump('attempt.json',dict(state='admission pending; one shot consumed',guard=sha(H/'native-module-bound.cjs')))
 try:
  admission()
  code=bounded([NODE,'--max-old-space-size=128',str(H/'guard-controls.cjs'),'--large'],'guard-large')
  if code:sys.exit(code)
  result=json.loads((H/'guard-large.stdout').read_text())
  assert result['large'] and result['nativeCalls']==3 and len(result['results'])==9 and result['limit']==8388608
  assert result['Memory']==False and result['Instance']==False
  dump('result.json',dict(verdict='PASS missing boundary/mutation controls only',exit=code,controlResult=result,noCanonicalModuleProduced=True,independentSourceAcceptance='POSITIONT owner pending'))
 except Exception as e:
  dump('blocker.json',dict(type=type(e).__name__,error=str(e)));raise
