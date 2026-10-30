import pathlib,json,subprocess,os,time,signal,hashlib,datetime,resource,urllib.request,threading
r=pathlib.Path('/home/user/enigma-original');out=r/'capture';out.mkdir(exist_ok=True)
args=json.loads((r/'guest-args.json').read_text());env=dict(os.environ,TZ='UTC')
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(150,155));resource.setrlimit(resource.RLIMIT_FSIZE,(4*1048576,4*1048576))
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def mem():return int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
rec=dict(utc=utc(),argv=[node,'--max-old-space-size=512','test/run.js']+args,events=[(30,'before',None),(31,'freeze-down',{'action':'frozen','mode':'on'}),(31.1,'move',{'cmd':'mousemove:343:213'}),(31.2,'arm-boundary',{'action':'message-boundary','on':True}),(31.3,'down',{'cmd':'mousedown:343:213'}),(31.4,'poll-after-down-enqueue',{'action':'guest-poll','on':True}),(31.5,'trace-on',{'action':'trace-api','on':True}),(31.6,'resume-down',{'action':'frozen','mode':'off'}),(32.5,'freeze-up',{'action':'frozen','mode':'on'}),(32.6,'up',{'cmd':'mouseup:343:213'}),(32.7,'poll-after-up-enqueue',{'action':'guest-poll','on':True}),(32.8,'resume-up',{'action':'frozen','mode':'off'}),(33.8,'trace-off',{'action':'trace-api','on':False}),(34,'poll-final',{'action':'guest-poll'}),(36,'after-mouse',None),(38,'final',None)]
t=time.monotonic();reason='bounded production completion';ready=False;done=set()
try:
 with (out/'stdout.log').open('wb') as a,(out/'stderr.log').open('wb') as b:
  p=subprocess.Popen(rec['argv'],cwd=r/'runner',env=env,preexec_fn=limits,stdout=a,stderr=b,start_new_session=True);rec['pid']=p.pid;save()
  while p.poll() is None and time.monotonic()-t<40:
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
    except (OSError,ValueError):pass
   ids={p.pid}
   while True:
    n=len(ids);ids|={i for i,v in rows.items() if v[0] in ids}
    if len(ids)==n:break
   rss=sum(rows.get(i,(0,0))[1] for i in ids);rec['peakRSS']=max(rec.get('peakRSS',0),rss)
   if rss>2*1073741824 or mem()<int(2.5*1073741824):reason='physical memory denial';break
   if sum(f.stat().st_size for f in out.glob('*.log'))>2*1048576:reason='log limit';break
   if sum(f.lstat().st_blocks*512 for f in r.rglob('*'))+8*1048576>256*1048576:reason='allocation denial';break
   if not ready:
    try:ctl({'action':'ping'});ctl({'action':'trace-api','on':False});ctl({'action':'frozen','mode':'off'});ready=True;t=time.monotonic()
    except (OSError,ValueError) as e:rec['lastConnectError']=str(e)
   if ready:
    for at,name,v in events:
     if name not in done and time.monotonic()-t>=at:
      if v is None:capture(name)
      else:ctl(v)
      done.add(name)
   time.sleep(.15)
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
 rec['traceSelected']=[x for x in (out/'stdout.log').read_text(errors='replace').splitlines() if x.startswith(('[input', '[message-boundary]', '[check_input', '[trace-api]', '[guest-poll]'))][-320:]; rec['files']=[dict(path=f.name,bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in out.iterdir() if f.is_file() and f.name!='runtime-evidence.json'];save()
