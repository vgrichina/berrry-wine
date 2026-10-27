import os,sys,pathlib,json,time,hashlib,importlib.util,shlex,subprocess,queue,threading,resource,shutil
R=pathlib.Path('/tmp/generally-census-cleared-driving-oct27');H=R/'ops';M=1048576;N='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV={'PATH':str(pathlib.Path(N).parent)+':/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1','NODE_OPTIONS':'--max-old-space-size=2048'}
def save(n,x):
 p=H/n;q=p.with_suffix(p.suffix+'.tmp');q.write_text(json.dumps(x,indent=2));q.replace(p)
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def load():
 p=H/'supervisor-original.py';assert sha(p)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 # Task remote allowance: only CPU180 differs from trusted local supervisor.
 text=p.read_text().replace('lower_limit(resource.RLIMIT_CPU, 90)','lower_limit(resource.RLIMIT_CPU, 180)')
 q=H/'supervisor-remote.py';q.write_text(text);s=importlib.util.spec_from_file_location('sup',q);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
argv=[N,'--max-old-space-size=2048',str(R/'runner/test/run.js'),'--app=generally','--vfs-tree='+str(R/'runner/test/binaries/candidates/generally'),'--no-build','--wasm='+str(R/'runner/build/wine-assembly.wasm'),'--screen=800x600','--control-stdin','--frozen','--max-seconds=235','--max-batches=10000000','--quiet-api','--quiet-blocks','--trace-input','--trace-input-dispatch','--repaint-every=1000','--batch-size=20000','--tick-ms-per-batch=2','--stuck-after=0','--no-close']
os.environ.clear();os.environ.update(ENV)
def supervise(cmd,label,rss,wall=240,output=2*M,cpu=180):
 sup=load();out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch(exist_ok=False);err.touch(exist_ok=False)
 sampled=[0,0]
 def check():
  if time.time()>=1793106480:return 'guest cutoff13:08UTC'
  logbytes=out.stat().st_size+err.stat().st_size
  if label=='guest':logbytes+=sum(p.stat().st_size for p in [H/'launch.stdout',H/'launch.stderr'] if p.exists())
  if logbytes>output:return 'output allocation'
  if time.monotonic()-sampled[0]>1:
   sampled[:]=[time.monotonic(),sum(p.stat().st_blocks*512 for p in R.rglob('*') if p.is_file())]
  if sampled[1]+64*M>1024*M:return 'remote allocation1GiB including64MiB reserve'
  return None
 cmd=['/usr/bin/env','-i',*[k+'='+v for k,v in ENV.items()],*cmd]
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 q=sup.supervise(['/bin/bash','-c',shell],rss_limit=rss,cpu_limit=cpu,wall_limit=wall,output_limit=output,check=check);(H/(label+'.supervisor-output')).write_bytes(q.pop('output'))
 save(label+'-supervision.json',dict(q,command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),environmentSHA256=hashlib.sha256(json.dumps(sorted(ENV.items())).encode()).hexdigest(),nodeSHA256=sha(N),argvSHA256=hashlib.sha256(json.dumps(argv).encode()).hexdigest(),inherited={str(k):resource.getrlimit(k) for k in (0,1,2,9)},supervisorSHA256=sha(H/'supervisor-remote.py')))
 assert q['exit']==0 and not q['stopReason'] and q['cleanupComplete'],q
 print(json.dumps({k:v for k,v in q.items() if k!='owned'}))
mode=sys.argv[1];os.chdir(R/'runner')
if mode=='prebuild':
 rows=json.loads((H/'stage-manifest.json').read_text())
 for x in rows:
  p=R/x['target'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],x['target']
 save('staged-closure.json',dict(at=time.time(),files=len(rows),bytes=sum(x['bytes'] for x in rows),source='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',allPinsPass=True))
 save('plan.json',dict(argv=argv,environment=ENV,limits=dict(compileRSS=6*1024**3,guestRSS=4*1024**3,heap=2048*M,cpu=180,wall=240,file=24*M,compileOutput=4*M,guestOutput=2*M),source='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba'))
 supervise([N,'--max-old-space-size=2048',str(H/'remote-startup-v4.cjs')],'startup-prebuild-v4',4*1024**3,wall=30)
elif mode=='continue-build-two':
 assert (H/'compile-attempt.json').exists() and not (H/'continuation-two-attempt.json').exists()
 previous=json.loads((H/'compile-supervision.json').read_text());second=json.loads((H/'compile-continuation-supervision.json').read_text());assert second['exit']==1 and second['stopReason'] is None;previous['cpuSeconds']+=second['cpuSeconds'];previous['wallSeconds']+=second['wallSeconds'];assert previous['exit']==1 and previous['stopReason'] is None
 assert not (R/'runner/build/wine-assembly.wasm').exists()
 source=(R/'runner/tools/build.sh').read_text();mark='node tools/toyvm/bundle-browser.js --check';start=source.index(mark);suffix=source[start:]
 script='set -e\ncd '+shlex.quote(str(R/'runner'))+'\n'+suffix;p=H/'canonical-build-remaining.sh';p.write_text(script)
 consumed=sum((H/n).stat().st_size for n in ['compile.stdout','compile.stderr','compile-continuation.stdout','compile-continuation.stderr'])
 save('continuation-two-attempt.json',dict(at=time.time(),canonicalSourceSHA256=hashlib.sha256(source.encode()).hexdigest(),suffixSHA256=hashlib.sha256(suffix.encode()).hexdigest(),firstLine=source[:start].count('\n')+1,alreadyChargedCPU=previous['cpuSeconds'],alreadyChargedWall=previous['wallSeconds'],alreadyChargedOutput=consumed,compilerInvocationsBefore=0,reason='coordinator closure also omitted committed toyvm bundles; restore exact pinned blobs then continue remaining canonical script without replaying passed prefix or resetting budget'))
 supervise(['bash',str(p)],'compile-continuation-two',6*1024**3,wall=240-previous['wallSeconds'],output=4*M-consumed,cpu=180-previous['cpuSeconds'])
elif mode=='compile':
 assert not (H/'compile-attempt.json').exists();save('compile-attempt.json',dict(at=time.time(),canonical='bash tools/build.sh'))
 supervise(['bash','tools/build.sh'],'compile',6*1024**3,output=4*M)
elif mode=='preguest':
 supervise([N,'--max-old-space-size=2048',str(H/'remote-startup-v4.cjs'),'--module'],'startup-preguest',4*1024**3,wall=30)
 save('module.json',dict(sha256=sha(R/'runner/build/wine-assembly.wasm'),bytes=(R/'runner/build/wine-assembly.wasm').stat().st_size))
elif mode=='run':
 assert not (H/'guest-attempt.json').exists();assert time.time()+240<1793106480
 save('guest-attempt.json',dict(at=time.time(),argv=argv))
 supervise(['/usr/bin/python3','-B',__file__,'bridge'],'guest',4*1024**3)
elif mode=='bridge':
 q=queue.Queue();out=open(H/'launch.stdout','wb');err=open(H/'launch.stderr','wb')
 child=subprocess.Popen(argv,cwd=R/'runner',env=ENV,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err)
 save('launch.json',dict(pid=child.pid,at=time.time(),argv=argv,environment=ENV))
 def reader():
  for line in child.stdout:
   out.write(line);out.flush()
   if line.startswith(b'[ctl] '):q.put(json.loads(line[6:]))
 threading.Thread(target=reader,daemon=True).start()
 seen=set();(H/'requests').mkdir(exist_ok=True);(H/'replies').mkdir(exist_ok=True)
 try:
  while child.poll() is None:
   for p in sorted((H/'requests').glob('*.json')):
    if p.name in seen:continue
    seen.add(p.name);req=json.loads(p.read_text());child.stdin.write((json.dumps(req)+'\n').encode());child.stdin.flush()
    deadline=time.monotonic()+40
    while True:
     if child.poll() is not None:raise RuntimeError('guest exited pending '+p.name)
     if time.monotonic()>deadline:raise RuntimeError('uncertain ACK timeout '+p.name)
     try:reply=q.get(timeout=.02)
     except queue.Empty:continue
     assert reply['id']==req['id'] and reply.get('ok'),reply
     save('replies/'+p.name,dict(at=time.time(),request=req,reply=reply));break
   time.sleep(.01)
 finally:
  save('terminal.json',dict(at=time.time(),returncode=child.poll(),pending=child.poll() is None,seen=sorted(seen)))
  out.close();err.close()
