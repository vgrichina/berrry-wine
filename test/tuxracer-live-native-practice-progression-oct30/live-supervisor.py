import pathlib,subprocess,resource,time,os,signal,json,hashlib,selectors
R=pathlib.Path('/home/user/tuxracer-render');O=R/'capture-live-native-oct30';M=1048576
N='/home/user/.nvm/versions/node/v24.22.1/bin/node';FLAGS=['--max-old-space-size=512']
ORIG={k:resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}
def bound(k,n,hard=True):
 s,h=resource.getrlimit(k);v=min([n]+([s] if s!=-1 else [])+([h] if h!=-1 else []));resource.setrlimit(k,(v,v if hard else h))
bound(resource.RLIMIT_DATA,128*M,False);bound(resource.RLIMIT_FSIZE,12*M);bound(resource.RLIMIT_CPU,60)
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
def pin(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(65536):h.update(b)
 return dict(bytes=p.stat().st_size,sha256=h.hexdigest())
def alloc():
 n=sum(p.lstat().st_blocks*512 for p in [R,*R.rglob('*')])+sum(p.lstat().st_blocks*512 for p in pathlib.Path('/home/user').glob('*.tar.gz'))
 assert n+8*M<=256*M,n
 return dict(allocated=n,reserve=8*M,cap=256*M)
def limits():
 for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS]:resource.setrlimit(k,ORIG[k])
 bound(resource.RLIMIT_CPU,60);bound(resource.RLIMIT_FSIZE,12*M)
def rss(pid):
 rows={}
 for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
  except (OSError,ValueError):pass
 ids={pid}
 while True:
  nxt=ids|{i for i,v in rows.items() if v[0] in ids}
  if nxt==ids:break
  ids=nxt
 return sum(rows.get(i,(0,0))[1] for i in ids)
def spawn(argv,name):
 assert R.resolve()==pathlib.Path('/home/user/tuxracer-render')
 x=(O/(name+'.stdout')).open('xb');y=(O/(name+'.stderr')).open('xb')
 p=subprocess.Popen(argv,cwd=R,stdin=subprocess.PIPE,stdout=x,stderr=y,preexec_fn=limits,start_new_session=True)
 x.close();y.close();return p
def watch(p,name,wall):
 start=time.monotonic();peak=0;reason=None
 while p.poll() is None:
  mem=rss(p.pid);peak=max(peak,mem)
  if time.monotonic()-start>wall:reason='wall'
  elif mem>2*1024*M:reason='groupRSS2GiB'
  elif sum((O/(name+s)).stat().st_size for s in ['.stdout','.stderr'])>524288:reason='capture512KiB'
  if reason:os.killpg(p.pid,signal.SIGKILL);break
  time.sleep(.03)
 p.wait();return dict(exit=p.returncode,signal=-p.returncode if p.returncode<0 else None,wall=time.monotonic()-start,peakRSS=peak,reason=reason)
STARTUP="""const fs=require('fs'),p=require('path'),h=b=>require('crypto').createHash('sha256').update(b).digest('hex');const apps=require('./lib/apps');const e=(apps.APPS||apps).tuxracer_original_061a;const mp=e.localFileManifest;const m=JSON.parse(fs.readFileSync(mp));const v=require('./lib/app-files').validateLocalManifestSync(e,m,{resolve:u=>p.join(p.dirname(mp),u),read:u=>fs.readFileSync(u),sha256:h});console.log(JSON.stringify({PASS:true,execPath:process.execPath,version:process.version,flags:process.execArgv,cwd:process.cwd(),limits:fs.readFileSync('/proc/self/limits','utf8'),environment:Object.fromEntries(['PATH','NODE_OPTIONS','LANG','TZ'].map(k=>[k,process.env[k]||null])),argv:['--app=tuxracer_original_061a'],files:v.files.map(x=>({url:x.url,vfsPath:x.vfsPath})),commas:v.files.filter(x=>x.url.includes(',')),runner:{bytes:fs.statSync('test/run.js').size,sha256:h(fs.readFileSync('test/run.js'))},module:{bytes:fs.statSync('build/wine-assembly.wasm').size,sha256:h(fs.readFileSync('build/wine-assembly.wasm'))}}));"""
def main():
 save('prelaunch.json',dict(allocation=alloc(),node=N,nodePin=pin(pathlib.Path(N)),flags=FLAGS,inheritedLimits={str(k):v for k,v in ORIG.items()},source='a998bf36b108275335af501d8ae774731495b9b2',module=pin(R/'build/wine-assembly.wasm'),runner=pin(R/'test/run.js'),observer=pin(R/'test/main-scheduler-observer.js'),trace=pin(R/'test/input-consumption-trace.js')))
 p=spawn([N,*FLAGS,'-e',STARTUP],'startup');v=watch(p,'startup',12);save('startup-process.json',v);assert v['exit']==0,v
 startup=json.loads((O/'startup.stdout').read_text());assert startup['PASS'];save('mount-startup.json',startup)
 argv=[N,*FLAGS,'test/run.js','--app=tuxracer_original_061a','--no-build','--wasm=build/wine-assembly.wasm','--gl-renderer=software','--no-threads','--control-stdin','--max-seconds=55','--quiet-api','--quiet-blocks','--quiet-fs','--trace-input-dispatch','--trace-main-scheduler','--trace-from=16000','--trace-to=100000']
 started=time.time();cpu0=resource.getrusage(resource.RUSAGE_CHILDREN);p=spawn(argv,'runtime');save('runtime-start.json',dict(pid=p.pid,argv=argv,startedAt=started,allocation=alloc()))
 rd=(O/'runtime.stdout').open();events=(O/'controller.jsonl').open('x');buffer='';replies={};seq=0;peak=0;reason=None
 def emit(v):events.write(json.dumps(v,separators=(',',':'))+'\n');events.flush()
 def pump():
  nonlocal buffer,peak,reason
  buffer+=rd.read()
  while '\n' in buffer:
   line,buffer=buffer.split('\n',1)
   if line.startswith('[ctl] '):
    v=json.loads(line[6:]);replies[v['id']]=v;emit(dict(event='ack',hostAt=time.time(),reply=v))
  peak=max(peak,rss(p.pid))
  if peak>2*1024*M:reason='groupRSS2GiB'
  elif time.time()-started>90:reason='wall90'
  elif (O/'runtime.stdout').stat().st_size+(O/'runtime.stderr').stat().st_size>524288:reason='capture512KiB'
  if reason and p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
 def delay(seconds):
  end=time.time()+seconds
  while time.time()<end and p.poll() is None:pump();time.sleep(.03)
 def cmd(v):
  nonlocal seq
  assert p.poll() is None,'guest already exited';seq+=1;v=dict(id=str(seq),**v);emit(dict(event='send',hostAt=time.time(),command=v));p.stdin.write((json.dumps(v)+'\n').encode());p.stdin.flush();end=time.time()+8
  while v['id'] not in replies and p.poll() is None and time.time()<end:pump();time.sleep(.03)
  assert v['id'] in replies,'no acknowledgement; no replay';reply=replies[v['id']];assert reply['ok'],reply;return reply['value']
 try:
  delay(1)
  while True:
   s=cmd(dict(action='snapshot'))
   if s['batch']>=17000:break
   assert time.time()-started<43,'title readiness boundary not reached'
   delay(1)
  cmd(dict(action='png',path=str(O/'title.png')))
  cmd(dict(cmd='keydown:13'));delay(.25);cmd(dict(cmd='keyup:13'));delay(2)
  cmd(dict(action='snapshot'))
  cmd(dict(cmd='mousemove:320:260'));delay(.4);cmd(dict(cmd='click:320:260'));delay(3)
  cmd(dict(action='png',path=str(O/'new-after-practice.png')));cmd(dict(action='snapshot'));delay(2)
  cmd(dict(action='quit'))
 except BaseException as e:emit(dict(event='controller-error',at=time.time(),error=repr(e)))
 finally:
  while p.poll() is None and time.time()-started<90:pump();time.sleep(.03)
  if p.poll() is None:reason='wall90';os.killpg(p.pid,signal.SIGKILL)
  p.wait();pump()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  events.close();rd.close();cpu=resource.getrusage(resource.RUSAGE_CHILDREN)
  save('runtime-result.json',dict(startedAt=started,endedAt=time.time(),wall=time.time()-started,exit=p.returncode,signal=-p.returncode if p.returncode<0 else None,CPUuser=cpu.ru_utime-cpu0.ru_utime,CPUsystem=cpu.ru_stime-cpu0.ru_stime,peakRSS=peak,reason=reason,descendantGroupReaped=True,argv=argv,allocation=alloc()))
 save('done.json',dict(finishedAt=time.time(),completed=True))
if __name__=='__main__':
 try:main()
 except BaseException as e:save('done.json',dict(finishedAt=time.time(),completed=False,error=repr(e)))
