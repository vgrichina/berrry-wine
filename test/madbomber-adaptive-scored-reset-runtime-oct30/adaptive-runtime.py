import pathlib,json,subprocess,os,time,signal,hashlib,datetime,resource,shutil
from feedback import observe
from controller import Controller
R=pathlib.Path('/home/user/madbomber-runtime'); O=R/'capture-adaptive-oct30'; O.mkdir(exist_ok=True)
M=1048576
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sample():
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=R.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in R.rglob('*'))
 packet=pathlib.Path('/tmp/mad-packet')
 if packet.exists(): allocated+=packet.lstat().st_blocks*512
 return dict(MemAvailable=mem,allocated=allocated)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(160,165));resource.setrlimit(resource.RLIMIT_FSIZE,(4*M,4*M))
def groups():
 rows={}
 for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
  except (OSError,ValueError):pass
 return rows
def members(rows,pid):
 ids={pid}
 while True:
  n=len(ids);ids|={i for i,v in rows.items() if v[0] in ids}
  if len(ids)==n:return ids
rows=json.loads((R/'verified-inputs.json').read_text())['rows']
for x in rows:
 p=R/x['path']; b=p.read_bytes()
 assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'] and oct(p.stat().st_mode&0o777)==x['mode'],x['path']
a=sample(); (O/'admission.json').write_text(json.dumps(a))
assert a['allocated']<=248*M, a # RAM admission disabled by owner; measure only
node=shutil.which('node');env=dict(os.environ)
assert not env.get('NODE_OPTIONS'), 'unexpected NODE_OPTIONS'
for lim in [resource.RLIMIT_DATA,resource.RLIMIT_AS]:
 assert resource.getrlimit(lim)==(-1,-1),('incompatible inherited limit',lim,resource.getrlimit(lim))
probe="const fs=require('fs'); console.log(JSON.stringify({execPath:process.execPath,argv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),node:process.version,started:true}))"
p=subprocess.run([node,'--max-old-space-size=512','-e',probe],cwd=R/'runner',env=env,preexec_fn=limits,capture_output=True,timeout=8)
assert p.returncode==0,(p.returncode,p.stderr[:1000])
(O/'node-startup.json').write_bytes(p.stdout)
if '--probe-only' in os.sys.argv: print(p.stdout.decode());os.sys.exit()
originalData=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*M,originalData[1]))
def guestLimits():
 resource.setrlimit(resource.RLIMIT_DATA,originalData)
 limits()
cmd=[node,'--max-old-space-size=512','test/run.js','--app=madbomber','--no-build','--wasm='+str(R/'runner/build/wine-assembly.wasm'),'--control-stdin','--no-threads','--real-ticks','--time-scale=1','--real-calendar','--tz=UTC','--batch-size=200000','--max-batches=10000000','--max-seconds=150','--quiet-api','--no-close','--trace-input']
controller=Controller();sent=[];screenshots=0;peak=0;reason='guest exited';nextFrame=12;pending=None;lastMtime=0;observations=[]
start=now();t=time.monotonic()
with (O/'stdout.log').open('wb') as a,(O/'stderr.log').open('wb') as b:
 p=subprocess.Popen(cmd,cwd=R/'runner',stdin=subprocess.PIPE,stdout=a,stderr=b,env=env,start_new_session=True,preexec_fn=guestLimits)
 (O/'live.json').write_text(json.dumps({'pid':p.pid,'startedAt':start,'command':cmd}))
 def send(event):
  global screenshots
  if event.get('action')=='png':
   assert screenshots<320; screenshots+=1
   assert pathlib.Path(event['path']).parent==O
  assert event.get('action') in (None,'png'), 'harness quit disallowed as gameplay'
  p.stdin.write((json.dumps(event)+'\n').encode());p.stdin.flush()
  sent.append({'elapsed':time.monotonic()-t,'event':event})
 try:
  while p.poll() is None:
   elapsed=time.monotonic()-t
   observation=None
   feedback=O/'feedback.png'
   if pending is not None and feedback.exists() and feedback.stat().st_mtime_ns!=lastMtime:
    try:
     observation=observe(feedback)
     lastMtime=feedback.stat().st_mtime_ns
     observations.append({'elapsed':elapsed,**observation})
     pending=None
    except (AssertionError,ValueError,OSError):pass
   for event in controller.tick(elapsed,observation):
    if 'save' in event:shutil.copyfile(feedback,O/event['save'])
    elif 'capture' in event:send({'action':'png','path':str(O/event['capture'])})
    else:send(event)
   if elapsed>=nextFrame and controller.transition is None and pending is None:
    send({'action':'png','path':str(feedback)});pending=elapsed;nextFrame=elapsed+.65
   if pending is not None and elapsed-pending>4:raise RuntimeError('render feedback dispatch timeout; no overlapping request')
   r=groups();rss=sum(r.get(i,(0,0))[1] for i in members(r,p.pid));peak=max(peak,rss)
   logs=sum(x.stat().st_size for x in O.glob('*.log'));pngs=list(O.glob('*.png'))
   reason0=None
   if elapsed>=149:reason0='guest supervisor wall bound'
   elif rss>2*1024**3:reason0='process group RSS exceeded 2GiB'
   elif logs>2*M:reason0='logs exceeded 2MiB'
   elif sum(x.stat().st_size for x in pngs)>16*M:reason0='selected PNG total exceeded 16MiB'
   elif any(x.stat().st_size>4*M for x in pngs):reason0='PNG exceeded 4MiB'
   elif int(elapsed)%10==0 and sample()['allocated']>248*M:reason0='remote allocation reserve'
   if reason0:reason=reason0;break
   time.sleep(.1)
 except Exception as e:reason='control/supervisor exception '+repr(e)
 finally:
  if p.poll() is None:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=3)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 result={'app':'original Mad Bomber','qualification':'HISTORICAL build','startedAt':start,'finishedAt':now(),'elapsed':time.monotonic()-t,'exitCode':p.returncode,'reason':reason,'peakGroupRSS':peak,'command':cmd,'events':sent,'observations':observations,'controller':{'scoredPixelsChanged':controller.scored,'gameoverBucketObservation':controller.ended,'transition':controller.transition},'runtimeSource':'72e7a30d6e36df896eb25007b6139d750e715720','buildSource':'30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d','wasmSHA256':'728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c','captures':[{'path':str(f),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in O.glob('*.png')],'allocation':sample(),'scope':'one production invocation; visual gates require inspection'}
 (O/'runtime-evidence.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
