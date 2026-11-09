from pathlib import Path
import importlib.util,json,gzip,hashlib,subprocess,os,time,threading,uuid,signal,sys,fcntl
ROOT=Path('/home/user/wine-assembly');BASE=Path(__file__).resolve().parent;R=BASE/'prepared';R.mkdir(exist_ok=True)
REMOTE=str(ROOT);RUN=str(R.relative_to(ROOT));OUT=REMOTE+'/scratch/runs/20261108-q3-gl-readiness-gameplay/changed-control-1475-native'
H=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):
 with gzip.open(R/(n+'.json.gz'),'xb') as f:f.write(json.dumps(v,indent=2).encode());f.flush()
def load(n):return json.loads(gzip.decompress((R/(n+'.json.gz')).read_bytes()))
spec=importlib.util.spec_from_file_location('q3_current',ROOT/'tools/q3-native-launch-client.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
taskpath=ROOT/'scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/task.py'
task=m.compose_task(taskpath,H(taskpath.read_bytes()));c=task['c']
c.R=R;c.ROOT=ROOT;c.REMOTE=REMOTE;c.RUN=RUN;c.access.ROOT=R
task.update(BASE=BASE,R=R,REMOTE=REMOTE,OUT=OUT,save=save)
def box():return load('boat-created')['box']['id']
c.box=box

def remote(label,code,timeout=40):
 save(label+'-command',dict(at=time.time(),code=code,box=box(),noRetry=True))
 p=subprocess.Popen(['boat','--no-update','--json','exec',box(),'--timeout',str(timeout),'--','python3','-B','-c',code],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 target=dict(pid=p.pid,start=Path('/proc',str(p.pid),'stat').read_text().rsplit(')',1)[1].split()[19]);save(label+'-child',target)
 try:so,se=p.communicate(timeout=timeout+15)
 except subprocess.TimeoutExpired:
  p.terminate()
  try:so,se=p.communicate(timeout=10)
  except subprocess.TimeoutExpired:p.kill();so,se=p.communicate()
  save(label+'-actual-wait',dict(**target,status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,timeout=True));raise
 save(label+'-actual-wait',dict(**target,status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
 save(label+'-result',dict(status=p.returncode,stdout=so.decode(),stderr=se.decode()))
 rows=[json.loads(l) for l in so.decode().splitlines() if l.startswith('{')]
 v=rows[0] if len(rows)==1 and 'stdout' in rows[0] else {**next((x for x in reversed(rows) if x.get('type')=='exit'),{}),'stdout':''.join(x.get('data','') for x in rows if x.get('type')=='stdout')}
 assert p.returncode==0 and rows and v.get('exitCode',0)==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),(label,'first actual failure terminal',p.returncode,v)
 return v.get('stdout','')

def release():
 # Independent remote lane: active peer boxes are not a runtime gate.
 lines=(ROOT/'messageboard.txt').read_text().splitlines()
 line=next(l for l in reversed(lines) if 'q3-capture-observed-arena-2035 finalpublished RELEASE STOP' in l)
 assert 'mainc43c85981' in line
 save('candidate-release',dict(line=line,independentRemoteLane=True,noSharedProviderMutation=True))
 return line

def validate():
 assert os.statvfs('/home').f_bavail*os.statvfs('/home').f_frsize>1500000000
 raw=gzip.decompress((BASE/'prepared/runtime-pins.json.gz').read_bytes());assert H(raw)==json.loads((BASE/'parent-manifest.json').read_bytes())['manifestSHA256'];pins=json.loads(raw)
 for p in pins['files']:
  b=(ROOT/p['path']).read_bytes();assert len(b)==p['size'] and H(b)==p['sha256'],p['path']
 return pins

def watchdog():
 life=load('lifecycle');ident=load('identity');save('watchdog-armed',dict(pid=os.getpid(),uuid=ident['uuid'],deadline=life['overallDeadline'],configSHA256=H((R/'lifecycle.json.gz').read_bytes()),start=Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19]))
 while time.time()<life['overallDeadline'] and not (R/'normal-stop-confirmed.json.gz').exists():
  with gzip.open(R/'watchdog-heartbeat.jsonl.gz','ab') as f:f.write((json.dumps(dict(at=time.time(),uuid=ident['uuid'],deadline=life['overallDeadline']))+'\n').encode())
  time.sleep(.5)
 if not (R/'normal-stop-confirmed.json.gz').exists():
  if (R/'boat-created.json.gz').exists():
   target=load('boat-created')['box'];observed=c.access.sanitized(c.access.api('GET','sandboxes/'+target['id']))
   assert observed['id']==target['id'] and ident['uuid'] in observed['name'],'watchdog UUID mismatch; no signal'
   save('watchdog-exact-target',observed);save('watchdog-stop',c.access.api('POST','sandboxes/'+target['id']+'/stop',{}))
  else:save('watchdog-create-unresolved',dict(uuid=ident['uuid'],noRetry=True))
 save('watchdog-terminal',dict(at=time.time(),uuid=ident['uuid'],deadline=life['overallDeadline'],normalStopConfirmed=(R/'normal-stop-confirmed.json.gz').exists()))

def allocate():
 pins=validate();line=release()
 with open(str(BASE/'independent-remote-lane.lock'),'a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  ident=dict(uuid=str(uuid.uuid4()),at=time.time());save('identity',ident);life=dict(overallDeadline=time.time()+1500,immutable=True,release=line,manifestSHA256=json.loads((BASE/'parent-manifest.json').read_bytes())['manifestSHA256']);save('lifecycle',life);os.chmod(R/'lifecycle.json.gz',0o444)
  w=subprocess.Popen([sys.executable,'-B',str(BASE/'control.py'),'watchdog'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  due=time.time()+5
  while not (R/'watchdog-armed.json.gz').exists():assert time.time()<due;time.sleep(.02)
  armed=load('watchdog-armed');assert armed['uuid']==ident['uuid'] and armed['deadline']==life['overallDeadline']
  assert armed['configSHA256']==H((R/'lifecycle.json.gz').read_bytes())
  assert armed['pid']==w.pid and w.poll() is None
  assert Path('/proc',str(w.pid),'stat').read_text().rsplit(')',1)[1].split()[19]==armed['start']
  assert time.time()-(R/'watchdog-heartbeat.jsonl.gz').stat().st_mtime<2
  save('watchdog-observed-before-create',dict(at=time.time(),armed=armed,alive=True,heartbeatFresh=True))
  body=dict(type='default',name='q3-startup-autoattach-cause-2045-'+ident['uuid'],ttlSeconds=int(life['overallDeadline']-time.time()),noEnv=True)
  save('boat-create-attempt',dict(body=body,uuid=ident['uuid'],at=time.time()))
  v=c.access.sanitized(c.access.api('POST','sandboxes',body,ident['uuid']));save('boat-created',dict(at=time.time(),box=v,shutdownDelegated=True));print(json.dumps(v),flush=True)
  with (ROOT/'messageboard.txt').open('a') as f:f.write(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+' q3-startup-autoattach-cause-2045 RUNTIME_OWN '+v['id']+' UUID'+ident['uuid']+' ONE finiteTTL expires'+str(v.get('archiveAfter'))+' prearmedimmutable25minUUIDwatchdog ONE changed-control fixture/cancellation then conditional ONE original\n')
  so,se=w.communicate(timeout=max(1,life['overallDeadline']-time.time()+60));save('watchdog-actual-wait',dict(pid=w.pid,status=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode()));save('lifecycle-lock-released',dict(at=time.time(),actualWait=True))

def provision():
 import runpy
 pins=validate()
 files=list(pins['files'])
 for path in [R/'runtime-pins.json.gz',R/'lifecycle.json.gz',BASE/'runtime-pins.json.gz']:
  b=path.read_bytes();files.append(dict(path=str(path.relative_to(ROOT)),size=len(b),sha256=H(b)))
 def url(path):
  return c.access.api('POST','sandboxes/'+box()+'/files/upload-url',dict(path=path,ttlSeconds=900))['url']
 with gzip.open(R/'uploads.jsonl.gz','xb') as f:
  def record(event):
   f.write((json.dumps(event)+'\n').encode());f.flush()
  runpy.run_path(str(ROOT/'tools/q3-provider-upload.py'))['provision_files'](ROOT,files,REMOTE,url,record)
 for phase in ['cancellation','original']:
  phaseRun=str((BASE/phase/'prepared').relative_to(ROOT))
  code='from pathlib import Path\nimport subprocess,gzip,json\nr=Path('+repr(REMOTE+'/'+phaseRun)+');r.mkdir(parents=True);(r/"runtime-pins.json.gz").write_bytes(Path('+repr(REMOTE+'/'+RUN+'/runtime-pins.json.gz')+').read_bytes());p=subprocess.run(["python3","-B",'+repr(REMOTE+'/tools/q3-native-prelaunch.py')+','+repr(REMOTE)+',str(r/"preflight"),'+repr(REMOTE+'/'+str((BASE/phase/'runtime.py').relative_to(ROOT)))+',"--check-only"],cwd='+repr(REMOTE)+')'
  # The actual wrapper requires a fresh directory for each barrier publication.
  code=code.replace('p=subprocess.run', '(r/"preflight").mkdir();(r/"preflight/runtime-pins.json.gz").write_bytes((r/"runtime-pins.json.gz").read_bytes());p=subprocess.run')+'\nraise SystemExit(p.returncode)'
  print(remote('fresh-remote-check-'+phase,code,60),flush=True)

if __name__=='__main__':
 {'watchdog':watchdog,'allocate':allocate,'provision':provision}[sys.argv[1]]()
