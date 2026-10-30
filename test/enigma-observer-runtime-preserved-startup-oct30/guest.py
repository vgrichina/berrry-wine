import pathlib,json,subprocess,os,time,signal,hashlib,datetime,resource,urllib.request,threading
r=pathlib.Path('/home/user/enigma-original');out=r/'stall-observer-capture';out.mkdir(exist_ok=True)
args=json.loads((r/'native-keyboard-args.json').read_text());args=[('--png='+str(out/'final.png')) if x.startswith('--png=') else x for x in args];env=dict(os.environ,TZ='UTC')
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
original_data=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,original_data[1]))
resource.setrlimit(resource.RLIMIT_CPU,(60,60))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,original_data);resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def mem():return int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
rec=dict(utc=utc(),argv=[node,'--max-old-space-size=512','test/run.js']+args,events=[],gameplayAccepted=False,route='original compiled runtime; software canvas; no threads')
def save():(out/'runtime-evidence.json').write_text(json.dumps(rec,indent=2))
def ctl(v):
 req=urllib.request.Request('http://127.0.0.1:18127/ctl',data=json.dumps(v).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=3) as f:b=json.load(f)
 rec['events'].append(dict(utc=utc(),command=v,ack=b));save();return b
def capture(name):
 ctl({'action':'input-stall'})
 snap=ctl({'action':'snapshot'})
 ctl({'action':'png','path':str(out/(name+'.png'))})
 if name=='before':
  windows=snap.get('value',{}).get('windows',[])
  assert any(w.get('title')=='Enigma - Main Menu' for w in windows),'Main Menu not rendered; stop before input'
assert pathlib.Path('/home/user/enigma-original/guest-args.json').exists()
rec['MemAvailableObservation']=mem()
startup=subprocess.run([node,'--max-old-space-size=512','-e',"const fs=require('fs');console.log(JSON.stringify({node:process.execPath,version:process.version,limits:fs.readFileSync('/proc/self/limits','utf8'),heap:require('v8').getHeapStatistics().heap_size_limit,environment:{TZ:process.env.TZ}}))"],cwd=r/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=10)
rec['startup']=dict(exit=startup.returncode,stdout=startup.stdout,stderr=startup.stderr,utc=utc());save();assert startup.returncode==0;assert json.loads(startup.stdout)['version']=='v24.22.1'
p=None
def hardwall():
 time.sleep(89)
 if p is not None:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 rec.update(reason='89s hard wall',utcEnd=utc());save();os._exit(124)
threading.Thread(target=hardwall,daemon=True).start()
events=[(31.99,'poll-up-key',{'action':'guest-poll','on':True}),(32.85,'poll-up-key-off',{'action':'guest-poll','on':False}),(36,'sample36',{'action':'input-stall'}),(42,'sample42',{'action':'input-stall'}),(29,'before',None),(30,'tab-down',{'cmd':'keydown:9'}),(30.8,'tab-up',{'cmd':'keyup:9'}),(32,'up-down',{'cmd':'keydown:38'}),(32.8,'up-up',{'cmd':'keyup:38'}),(34,'enter-down',{'cmd':'keydown:13'}),(34.005,'poll-enter',{'action':'guest-poll','on':True}),(34.03,'poll-enter-off',{'action':'guest-poll','on':False}),(34.8,'enter-up',{'cmd':'keyup:13'}),(38,'after-keyboard',None),(44,'final',None)]

t=time.monotonic();reason='bounded production completion';ready=False;done=set()
try:
 with (out/'stdout.log').open('wb') as a,(out/'stderr.log').open('wb') as b:
  p=subprocess.Popen(rec['argv'],cwd=r/'runner',env=env,preexec_fn=limits,stdout=a,stderr=b,start_new_session=True);rec['pid']=p.pid;save()
  while p.poll() is None and time.monotonic()-t<46:
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
    except (OSError,ValueError):pass
   ids={p.pid}
   while True:
    n=len(ids);ids|={i for i,v in rows.items() if v[0] in ids}
    if len(ids)==n:break
   rss=sum(rows.get(i,(0,0))[1] for i in ids);rec['peakRSS']=max(rec.get('peakRSS',0),rss)
   rec['MemAvailableObservation']=mem()
   if rss>2*1073741824:reason='process RSS denial';break
   if sum(f.stat().st_size for f in out.glob('*.log'))>524288:reason='capture limit';break
   if sum(f.stat().st_size for f in out.iterdir() if f.is_file())>4*1048576:reason='aggregate capture limit';break
   if sum(f.lstat().st_blocks*512 for f in r.rglob('*'))+8*1048576>256*1048576:reason='allocation denial';break
   if not ready:
    try:ctl({'action':'ping'});ctl({'action':'trace-api','on':False});ready=True;t=time.monotonic()
    except (OSError,ValueError) as e:rec['lastConnectError']=str(e)
   if ready:
    for at,name,v in events:
     if name not in done and time.monotonic()-t>=at:
      if v is None:capture(name)
      else:
       ctl({'action':'input-stall'})
       ctl(v)
       ctl({'action':'input-stall'})
      done.add(name)
      if name=='after-keyboard':
       snap=ctl({'action':'snapshot'})
       if any(w.get('title')=='Enigma - Main Menu' for w in snap.get('value',{}).get('windows',[])):
        events.extend([(39,'mouse-move',{'cmd':'mousemove:343:213'}),(39.2,'mouse-down',{'cmd':'mousedown:343:213'}),(40,'mouse-up',{'cmd':'mouseup:343:213'}),(40.001,'poll-up',{'action':'guest-poll','on':True}),(40.002,'boundary-up',{'action':'message-boundary','on':True}),(40.003,'api-up',{'action':'trace-api','on':True}),(40.03,'poll-up-off',{'action':'guest-poll','on':False}),(40.031,'boundary-off',{'action':'message-boundary','on':False}),(40.032,'api-off',{'action':'trace-api','on':False})])

   time.sleep(.005)
  if p.poll() is None:
   ctl({'action':'snapshot'});ctl({'action':'quit'})
   try:p.wait(timeout=2)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=1)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  rec.update(exit=p.returncode,reason=reason,elapsed=time.monotonic()-t,utcEnd=utc())
finally:
 if p is not None:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait(timeout=3)
  rec['cleanup']=dict(processReaped=True,returncode=p.returncode,processGroup=p.pid)
 rec['traceSelected']=[x for x in (out/'stdout.log').read_text(errors='replace').splitlines() if x.startswith(('[input', '[message-boundary]', '[check_input', '[trace-api]', '[guest-poll]'))][-40:]; rec['files']=[dict(path=f.name,bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in out.iterdir() if f.is_file() and f.name!='runtime-evidence.json'];save()
