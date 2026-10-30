import pathlib,subprocess,resource,time,os,signal,json,hashlib,selectors
R=pathlib.Path('/home/user/tuxracer-render');O=R/'capture-accepted-handoff-oct30';M=1048576
N='/home/user/.nvm/versions/node/v24.22.1/bin/node';FLAGS=['--max-old-space-size=512','--require',str(O/'boundary-preload.cjs')]
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

STARTUP += "const wb=new WebAssembly.Module(fs.readFileSync('build/wine-assembly.wasm'));console.log(JSON.stringify({getters:WebAssembly.Module.exports(wb).filter(x=>/get_.*(eip|api|wait|tick|cycle|step|instr|yield|sleep|block)/.test(x.name)).map(x=>x.name)}));"
# Task-only sampler; standalone staging must put stall-sampler.cjs beside this file.
PROBE_MODULE=R/'capture-audio-mutex-oct30/stall-sampler.cjs'
_SAMPLER=PROBE_MODULE.read_text()
PROBE="(function sample() {"+_SAMPLER.split("function sample() {",1)[1].split("\nfunction compare(",1)[0]+")()"

def main():
 save('runtime-prelaunch.json',dict(allocation=alloc(),runner=pin(R/'test/run.js'),module=pin(R/'build/wine-assembly.wasm'),inheritedLimits={str(k):v for k,v in ORIG.items()}))
 argv=[N,*FLAGS,'test/run.js','--app=tuxracer_original_061a','--no-build','--wasm=build/wine-assembly.wasm','--gl-renderer=software','--no-threads','--control-stdin','--max-seconds=70','--quiet-api','--quiet-blocks','--quiet-fs','--trace-input-dispatch']
 started=time.time();cpu0=resource.getrusage(resource.RUSAGE_CHILDREN);p=spawn(argv,'runtime');save('runtime-start.json',dict(pid=p.pid,argv=argv,startedAt=started))
 rd=(O/'runtime.stdout').open();events=(O/'controller.jsonl').open('x');buffer='';replies={};seq=0;peak=0;reason=None
 def emit(v):events.write(json.dumps(v,separators=(',',':'))+'\n');events.flush()
 def pump():
  nonlocal buffer,peak,reason
  buffer+=rd.read()
  while '\n' in buffer:
   line,buffer=buffer.split('\n',1)
   if line.startswith('[ctl] '):
    v=json.loads(line[6:]);replies[v['id']]=v;emit(dict(event='ack',at=time.time(),reply=v))
  peak=max(peak,rss(p.pid))
  if peak>2*1024*M:reason='groupRSS2GiB'
  elif time.time()-started>90:reason='wall90'
  elif max((O/'runtime.stdout').stat().st_size,(O/'runtime.stderr').stat().st_size)>524288:reason='capture512KiB'
  if reason and p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
 def delay(seconds):
  end=time.time()+seconds
  while time.time()<end and p.poll() is None:pump();time.sleep(.03)
 def cmd(v,timeout=8):
  nonlocal seq
  assert p.poll() is None,'guest exited';seq+=1;v=dict(id=str(seq),**v);emit(dict(event='send',at=time.time(),command=v));p.stdin.write((json.dumps(v)+'\n').encode());p.stdin.flush();end=time.time()+timeout
  while v['id'] not in replies and p.poll() is None and time.time()<end:pump();time.sleep(.02)
  assert v['id'] in replies,'no acknowledgement; no replay';reply=replies[v['id']];assert reply['ok'],reply;return reply['value']
 def capture(label):
  state=cmd(dict(action='eval',code=PROBE));cmd(dict(action='png',path=str(O/(label+'.png'))));save(label+'-state.json',state)
  # Lossy display derivative; exact PNG remains on the task box.
  js="const s=require('skia-canvas');(async()=>{const i=await s.loadImage(process.argv[1]);const c=new s.Canvas(i.width,i.height);c.getContext('2d').drawImage(i,0,0);require('fs').writeFileSync(process.argv[2],c.toBufferSync('jpg',{quality:.75}));})().catch(e=>{console.error(e);process.exit(1)});"
  q=subprocess.run([N,'--max-old-space-size=256','-e',js,str(O/(label+'.png')),str(O/(label+'.jpg'))],cwd=R,preexec_fn=limits,capture_output=True,timeout=5)
  assert q.returncode==0,q.stderr
  save(label+'-ready.json',dict(at=time.time(),png=pin(O/(label+'.png')),jpg=pin(O/(label+'.jpg'))))
 try:
  while p.poll() is None:
   pump()
   if 'PE loaded.' in (O/'runtime.stdout').read_text() and time.time()-started>4:break
   if time.time()-started>35:raise RuntimeError('runtime readiness deadline')
   time.sleep(.03)
  capture('title')
  for decision in range(1,5):
   f=O/('decision-'+str(decision)+'.json')
   while not f.exists() and p.poll() is None and time.time()-started<78:pump();time.sleep(.03)
   if not f.exists():break
   d=json.loads(f.read_text());emit(dict(event='inspected-decision',at=time.time(),decision=d))
   if d.get('quit'):cmd(dict(action='quit'));break
   for action in d['commands']:
    if 'delay' in action:delay(action['delay'])
    else:cmd(action)
   delay(d.get('settle',1));capture(d['label'])
  if p.poll() is None:cmd(dict(action='quit'))
 except BaseException as e:emit(dict(event='controller-error',at=time.time(),error=repr(e)))
 finally:
  while p.poll() is None and time.time()-started<90:pump();time.sleep(.03)
  if p.poll() is None:reason='wall90';os.killpg(p.pid,signal.SIGKILL)
  p.wait();pump()
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  events.close();rd.close();cpu=resource.getrusage(resource.RUSAGE_CHILDREN)
  save('runtime-result.json',dict(startedAt=started,endedAt=time.time(),wall=time.time()-started,exit=p.returncode,peakRSS=peak,reason=reason,CPUuser=cpu.ru_utime-cpu0.ru_utime,CPUsystem=cpu.ru_stime-cpu0.ru_stime,descendantGroupReaped=True,argv=argv,allocation=alloc()))
 save('done.json',dict(finishedAt=time.time(),completed=True))

PROBE='globalThis.__audioBoundarySnapshot()'
if __name__=='__main__':
 p=spawn([N,*FLAGS,'-e',STARTUP],'mount'); r=watch(p,'mount',15); save('mount-validation.json',r); assert r['exit']==0 and not r['reason']; main()

