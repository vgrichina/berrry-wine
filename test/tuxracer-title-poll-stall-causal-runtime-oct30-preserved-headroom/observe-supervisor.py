import pathlib,subprocess,resource,time,os,signal,json,hashlib,selectors
R=pathlib.Path('/home/user/tuxracer-render');O=R/'capture-causal-oct30';M=1048576
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

STARTUP += "const wb=new WebAssembly.Module(fs.readFileSync('build/wine-assembly.wasm'));console.log(JSON.stringify({getters:WebAssembly.Module.exports(wb).filter(x=>/get_.*(eip|api|wait|tick|cycle|step|instr|yield|sleep|block)/.test(x.name)).map(x=>x.name)}));"
PROBE="""(()=>{const names=['get_eip','get_dbg_prev_eip','get_dbg_prev2_eip','get_esp','get_eax','get_yield_reason','get_wait_handle','get_wait_handles_ptr','get_wait_all','get_wait_timeout','get_wait_stack_bytes','get_yield_flag','get_sleep_yielded','get_sleep_timeout','get_steps','get_api_calls','get_last_run_blocks'];const values=Object.fromEntries(names.map(k=>[k,exports[k]?exports[k]():null]));return {batch:tickState.batch,clockState:Object.fromEntries(Object.entries(tickState).filter(([k,v])=>typeof v==='number')),values,stack:Array.from({length:8},(_,i)=>exports.guest_read32(exports.get_esp()+i*4)>>>0),ipBytes:Array.from(new Uint8Array(memory.buffer,g2w(exports.get_eip()),24)),modules:mods instanceof Map?Array.from(mods):mods,ctxKeys:Object.keys(ctx).filter(k=>/thread|input|sync|clock|api/i.test(k))}})()"""
def main():
 save('runtime-prelaunch.json',dict(allocation=alloc(),runner=pin(R/'test/run.js'),module=pin(R/'build/wine-assembly.wasm'),inheritedLimits={str(k):v for k,v in ORIG.items()}))
 argv=[N,*FLAGS,'test/run.js','--app=tuxracer_original_061a','--no-build','--wasm=build/wine-assembly.wasm','--gl-renderer=software','--no-threads','--control-stdin','--max-seconds=55','--quiet-api','--quiet-blocks','--quiet-fs']
 # The original runner and module are unchanged. Neither scheduler nor input
 # observer is enabled: a flat guest state here distinguishes observer artifact.
 started=time.time();cpu0=resource.getrusage(resource.RUSAGE_CHILDREN);p=spawn(argv,'runtime');save('runtime-start.json',dict(pid=p.pid,argv=argv,startedAt=started))
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
  elif max((O/'runtime.stdout').stat().st_size,(O/'runtime.stderr').stat().st_size)>524288:reason='capture512KiB'
  if reason and p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
 def delay(seconds):
  end=time.time()+seconds
  while time.time()<end and p.poll() is None:pump();time.sleep(.03)
 def cmd(v,timeout=12):
  nonlocal seq
  assert p.poll() is None,'guest exited';seq+=1;v=dict(id=str(seq),**v);emit(dict(event='send',hostAt=time.time(),command=v));p.stdin.write((json.dumps(v)+'\n').encode());p.stdin.flush();end=time.time()+timeout
  while v['id'] not in replies and p.poll() is None and time.time()<end:pump();time.sleep(.03)
  assert v['id'] in replies,'no acknowledgement; no replay';reply=replies[v['id']];assert reply['ok'],reply;return reply['value']
 try:
  # Delay only initial command transport until runtime has installed its reader;
  # native input is separately gated on the actual known rendered title hash.
  while p.poll() is None:
   pump()
   text=(O/'runtime.stdout').read_text()
   if 'PE loaded.' in text and time.time()-started>3:break
   if time.time()-started>40:raise RuntimeError('runtime readiness deadline')
   time.sleep(.05)
  samples=[];ready=False
  for i in range(12):
   samples.append(cmd(dict(action='eval',code=PROBE),timeout=20))
   frame=cmd(dict(action='png',path=str(O/'before.png')))
   img=pin(O/'before.png');emit(dict(event='frame-check',frame=frame,pin=img))
   if img['sha256']=='bc919a5423476c23686c8d0231a4480e51b20250338cec7b09b50447641014f9':ready=True;break
   if time.time()-started>42:break
   delay(2)
  assert ready,'actual title render not observed; no input sent'
  for i in range(3):samples.append(cmd(dict(action='eval',code=PROBE)));delay(.6)
  cmd(dict(cmd='keydown:13'));delay(.25);cmd(dict(cmd='keyup:13'))
  for i in range(5):delay(.7);samples.append(cmd(dict(action='eval',code=PROBE)))
  cmd(dict(action='png',path=str(O/'after.png')))
  save('state-samples.json',samples);save('frames.json',dict(before=pin(O/'before.png'),after=pin(O/'after.png'),titleHashRequired=True))
  cmd(dict(action='quit'))
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
if __name__=='__main__':main()
