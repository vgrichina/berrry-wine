import pathlib,json,subprocess,os,time,signal,hashlib,datetime,resource,urllib.request,threading
r=pathlib.Path('/home/user/enigma-original'); out=r/'capture';out.mkdir(exist_ok=True)
args=json.loads((r/'guest-args.json').read_text())
env=dict(os.environ,TZ='UTC')
node=subprocess.check_output(['which','node'],text=True).strip()
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(150,155))
 resource.setrlimit(resource.RLIMIT_FSIZE,(4*1048576,4*1048576))
cmd=[node,'--max-old-space-size=512','test/run.js']+args
rec={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':cmd,'phase':'startup','events':[],'gameplayAccepted':False}
def save(): (out/'runtime-evidence.json').write_text(json.dumps(rec,indent=2))
p=None
def hardwall():
 time.sleep(116)
 if p is not None:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait()
 rec.update(reason='116s invocation hard wall',phase='terminated');save();os._exit(124)
threading.Thread(target=hardwall,daemon=True).start()
def ctl(payload):
 req=urllib.request.Request('http://127.0.0.1:18127/ctl',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=4) as f: b=json.load(f)
 rec['events'].append({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':payload,'ack':b});save();return b
def mem():return int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
assert mem()>=int(2.5*1073741824)
startup=subprocess.run([node,'--max-old-space-size=512','-e',"const fs=require('fs');console.log(JSON.stringify({node:process.execPath,limits:fs.readFileSync('/proc/self/limits','utf8'),heap:require('v8').getHeapStatistics().heap_size_limit}))"],env=env,preexec_fn=limits,capture_output=True,text=True,timeout=10)
rec['startup']={'exit':startup.returncode,'stdout':startup.stdout,'stderr':startup.stderr};save();assert startup.returncode==0
t=time.monotonic(); reason='bounded completion';p=None
try:
 with (out/'stdout.log').open('wb') as a,(out/'stderr.log').open('wb') as b:
  p=subprocess.Popen(cmd,cwd=r/'runner',env=env,stdout=a,stderr=b,start_new_session=True,preexec_fn=limits)
  rec.update(phase='initializing',pid=p.pid);save()
  ready=False
  while time.monotonic()-t<105 and p.poll() is None:
   elapsed=time.monotonic()-t
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
     s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
    except (OSError,ValueError):pass
   ids={p.pid}
   while True:
    n=len(ids);ids|={i for i,v in rows.items() if v[0] in ids}
    if len(ids)==n:break
   rss=sum(rows.get(i,(0,0))[1] for i in ids);rec['peakRSS']=max(rss,rec.get('peakRSS',0))
   if rss>2*1073741824 or mem()<int(2.5*1073741824):reason='physical memory gate';break
   if sum(x.stat().st_size for x in out.glob('*.log'))>2*1048576:reason='log gate';break
   if not ready:
    try:
     ctl({'action':'ping'});ctl({'action':'frozen','mode':'off'});ready=True;rec['phase']='production-initialization-running';save()
    except (OSError,ValueError) as e:rec['lastControlError']=repr(e)
   if ready and elapsed>22 and not (out/'initial.png').exists():
    try:
     ctl({'action':'png','path':str(out/'initial.png')});rec['phase']='initial-capture';save()
    except (OSError,ValueError) as e:rec['captureError']=repr(e)
   if (out/'finish').exists():reason='controller finished';break
   time.sleep(.25)
  if p.poll() is None:
   try:ctl({'action':'png','path':str(out/'final.png')})
   except Exception as e:rec['finalCaptureError']=repr(e)
   try:ctl({'action':'quit'})
   except Exception:pass
   try:p.wait(timeout=2)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=1)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  rec.update(exit=p.returncode,reason=reason,elapsed=time.monotonic()-t,phase='stopped')
finally:
 if p and p.poll() is None:os.killpg(p.pid,signal.SIGKILL);p.wait()
 rec['files']=[dict(path=x.name,bytes=x.stat().st_size,sha256=hashlib.sha256(x.read_bytes()).hexdigest()) for x in out.iterdir() if x.is_file() and x.name!='runtime-evidence.json']
 save()
