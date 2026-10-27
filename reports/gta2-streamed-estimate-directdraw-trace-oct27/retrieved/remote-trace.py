import os,sys,pathlib,json,time,subprocess,hashlib,importlib.util,selectors
H=pathlib.Path('/home/user/wineops-gta2-causal-trace-oct27');O=H/'ops';R=H/'repo'
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV=dict(HOME='/home/user',PATH=str(pathlib.Path(NODE).parent)+':/usr/local/bin:/usr/bin:/bin',LANG='C.UTF-8',TZ='UTC',PYTHONDONTWRITEBYTECODE='1',NODE_OPTIONS='--max-old-space-size=2048')
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
def sha(p):
 h=hashlib.sha256()
 with pathlib.Path(p).open('rb') as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
mode=sys.argv[1]
if mode.endswith('-inner'):
 mode=mode[:-6]
 save(mode+'-identity.json',dict(node=NODE,nodeSHA256=sha(NODE),env=ENV,cwd=str(R),limits=pathlib.Path('/proc/self/limits').read_text(),at=time.time()))
 if mode=='startup':argv=[NODE,'-e','console.log(JSON.stringify({ok:true,version:process.version,execPath:process.execPath,limits:require("fs").readFileSync("/proc/self/limits","utf8"),heap:require("v8").getHeapStatistics().heap_size_limit}))']
 elif mode=='preflight':argv=[NODE,str(O/'preflight.js')]
 elif mode=='guest':
  names=['DirectDrawCreate','IDirectDraw_QueryInterface','IDirectDraw_SetCooperativeLevel','IDirectDraw_SetDisplayMode','IDirectDraw_CreateSurface','IDirectDrawSurface_GetAttachedSurface']
  mem=['IDirectDraw_QueryInterface:1:16','IDirectDraw_CreateSurface:1:124','IDirectDrawSurface_GetAttachedSurface:1:16']+[n+':0:16' for n in names[1:]]
  argv=[NODE,'test/run.js','--app=gta2_demo','--no-build','--control-stdin','--frozen','--batch-size=1000','--max-batches=200000','--max-seconds=230','--quiet-api','--quiet-blocks','--trace-api='+','.join(names),'--trace-api-mem='+','.join(mem),'--trace-stack='+','.join(names),'--trace-at=0x5ca69b','--trace-at-limit=1','--trace-dx']
 else:raise RuntimeError(mode)
 save(mode+'-argv.json',argv)
 with (O/(mode+'.stdout')).open('xb') as out,(O/(mode+'.stderr')).open('xb') as err:
  p=subprocess.Popen(argv,cwd=R,env=ENV,stdin=subprocess.PIPE if mode=='guest' else subprocess.DEVNULL,stdout=subprocess.PIPE if mode=='guest' else out,stderr=err)
  save(mode+'-start.json',dict(pid=p.pid,at=time.time(),pending=True))
  if mode=='guest':
   selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ);buf=bytearray();ident=0;pending=None;causal=False;controls=[];deadline=time.monotonic()+225
   def request(action,**kw):
    global ident,pending,buf,causal
    assert pending is None;ident+=1;cmd=dict(id=ident,action=action,**kw);pending=ident;controls.append(dict(request=cmd,at=time.time()));save('controls.json',controls)
    p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush();end=min(deadline,time.monotonic()+15)
    while time.monotonic()<end:
     for _,_ in selector.select(.05):
      b=os.read(p.stdout.fileno(),65536)
      if not b:raise RuntimeError('guest EOF with pending request '+str(pending))
      out.write(b);out.flush();buf.extend(b);assert out.tell()+err.tell()<=8388608
      while b'\n' in buf:
       line,_,rest=buf.partition(b'\n');buf=bytearray(rest)
       if line.startswith(b'[TRACE-AT #'):causal=True
       if line.startswith(b'[ctl] '):
        reply=json.loads(line[6:]);assert reply.get('id')==pending and reply.get('ok'),reply
        controls[-1]['reply']=reply;controls[-1]['completedAt']=time.time();save('controls.json',controls);pending=None;return reply['value']
      assert len(buf)<=65536
     if p.poll() is not None:raise RuntimeError('guest terminal before ACK')
    raise RuntimeError('ACK deadline; no replay')
   status={}
   try:
    snap=request('snapshot');assert snap['frozen']['frozen'] and snap['frozen']['credits']==0
    save('initial-modules.json',request('eval',code='mods'))
    for _ in range(200):
     assert time.monotonic()<deadline
     ack=request('step',n=250);assert ack['ran']==250 and ack['steps']==250 and ack['frozen']
     snap=request('snapshot');assert snap['frozen']['frozen'] and snap['frozen']['credits']==0
     if causal:
      save('terminal-modules.json',request('eval',code='mods'))
      save('terminal-registers.json',request('eval',code='({eax:exports.get_eax()>>>0,esi:exports.get_esi()>>>0,eip:exports.get_eip()>>>0})'))
      status=dict(causalBoundaryObserved=True,snapshot=snap);request('quit');break
    else:raise RuntimeError('bounded steps exhausted')
   except Exception as e:status=dict(error=repr(e),pending=pending,causalBoundaryObserved=causal)
   finally:
    if p.poll() is None:
     p.stdin.close()
     try:p.wait(timeout=2)
     except subprocess.TimeoutExpired:p.terminate()
    result=p.wait(timeout=5)
    while True:
     b=p.stdout.read(65536)
     if not b:break
     out.write(b);assert out.tell()+err.tell()<=8388608
    save('controller-terminal.json',dict(**status,exit=result,at=time.time(),pending=pending))
  else:result=p.wait()
  save(mode+'-exit.json',dict(exit=result,at=time.time()))
 sys.exit(result)
assert time.time()<1793110080
O.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('trusted',O/'remote-supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def check():
 if time.time()>=1793110080:return 'guest cutoff'
 if sum(p.stat().st_size for p in [O/(mode+'.stdout'),O/(mode+'.stderr')] if p.exists())>8388608:return 'output budget'
 used=sum(p.lstat().st_blocks*512 for p in H.rglob('*') if p.is_file())
 if used+67108864+16777216>1073741824:return 'remote allocation'
r=s.supervise(['/usr/bin/python3',__file__,mode+'-inner'],rss_limit=4294967296,cpu_limit=180,wall_limit=240,output_limit=8388608,check=check)
(O/(mode+'.supervisor.log')).write_bytes(r.pop('output'));save(mode+'-supervisor.json',r)
print(json.dumps({k:v for k,v in r.items() if k!='owned'}));sys.exit(0 if r['exit']==0 and not r['stopReason'] and r['cleanupComplete'] else 1)
