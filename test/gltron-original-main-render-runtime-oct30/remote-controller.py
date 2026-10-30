import os,pathlib,json,subprocess,time,resource,selectors,signal,hashlib,sys
R=pathlib.Path('/home/user/gltron-render');os.chdir(R);M=1048576
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def save(n,v):(R/n).write_text(json.dumps(v,indent=2))
def alloc():
 seen=set();used=0
 for p in [R,*R.rglob('*')]:
  s=p.lstat();k=(s.st_dev,s.st_ino)
  if k not in seen:used+=s.st_blocks*512;seen.add(k)
 assert used+8*M<=256*M,used
 return used
def run(argv,label,cpu,wall,heap=512,cap=8192):
 alloc()
 def limits():
  for k,n in [(resource.RLIMIT_CPU,cpu),(resource.RLIMIT_FSIZE,12*M)]:
   s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,h))
 env=dict(os.environ,TZ='UTC',NODE_PATH='/home/user/wine-assembly/node_modules')
 for k in ['WINE_RUN_EXTRA_ARGS','WINE_ASSEMBLY_WASM','WINE_REGION_SHAKE','WINE_WAT_COMPILER','NODE_OPTIONS']:env.pop(k,None)
 start=time.time();q=subprocess.Popen(argv,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits,start_new_session=True);sel=selectors.DefaultSelector();out=bytearray();err=bytearray();peak=0;violation=None
 sel.register(q.stdout,selectors.EVENT_READ,out);sel.register(q.stderr,selectors.EVENT_READ,err)
 while sel.get_map() or q.poll() is None:
  for k,_ in sel.select(.04):
   b=os.read(k.fileobj.fileno(),8192)
   if not b:sel.unregister(k.fileobj);continue
   room=max(0,cap-len(out)-len(err));k.data.extend(b[:room])
   if len(b)>room:violation='stdout/stderr capture overflow'
  rss=0
  for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
   try:
    v=p.read_text().rsplit(')',1)[1].split()
    if int(v[3])==q.pid:rss+=int(v[21])*os.sysconf('SC_PAGE_SIZE')
   except (OSError,ValueError,IndexError):pass
  peak=max(peak,rss)
  if rss>2*1024*M:violation='aggregate process RSS 2GiB'
  if time.time()-start>wall:violation='wall'
  if label=='guest' and time.time()>=json.loads((R/'assignment.json').read_text())['cutoffEpoch']:violation='guest cutoff'
  if violation:
   try:os.killpg(q.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   q.wait();break
 q.wait();sel.close()
 (R/(label+'.stdout.log')).write_bytes(out);(R/(label+'.stderr.log')).write_bytes(err)
 v=dict(argv=argv,startedAt=__import__('datetime').datetime.fromtimestamp(start,__import__('datetime').timezone.utc).isoformat(),exit=q.returncode,wall=time.time()-start,peakRSS=peak,violation=violation,FSIZE=12*M,capture=cap,limits={'cpu':cpu,'wall':wall,'heapMiB':heap,'aggregateRSS':2*1024*M},nodeEnvironment=env.get('NODE_PATH'))
 save(label+'.json',v);return v
node='/usr/bin/node';flags=[node,'--max-old-space-size=512']
mode=sys.argv[1]
if mode=='preflight':
 for cpu in [120,60]:
  r=run(flags+['-e','console.log(JSON.stringify({node:process.version,execPath:process.execPath,argv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'],'node-startup-'+str(cpu),cpu,20)
  assert r['exit']==0 and not r['violation']
 # PNG read/write and renderer availability without constructing a guest.
 r=run(flags+['-e','const assert=require("assert"),{PNG}=require("pngjs"),p=new PNG({width:2,height:2});p.data.fill(255);const b=PNG.sync.write(p);assert.equal(PNG.sync.read(b).width,2);assert.equal(typeof require("./lib/canvas-compat").createCanvas,"function");console.log(JSON.stringify({png:require.resolve("pngjs"),bytes:b.length,parser:true,canvas:true}));'],'png-parser-smoke',60,20)
 assert r['exit']==0 and not r['violation']
 # Same capture controller: legitimate generated file > capture, output rejected.
 r=run(['/usr/bin/python3','-B','-c','import pathlib;p=pathlib.Path("large-disposable");p.write_bytes(b"x"*600000);p.unlink();print("ok")'],'generated-control',60,20,cap=8192);assert r['exit']==0 and not r['violation']
 r=run(['/usr/bin/python3','-B','-c','import os;os.write(1,b"x"*9000)'],'output-control',60,20,cap=8192);assert r['violation']=='stdout/stderr capture overflow'
 save('remote-preflight.json',dict(PASS=True,physical=alloc(),generatedFSIZE=12*M,capture=8192,PNGParser=True,stdoutController=True))
elif mode=='compile':
 r=run(flags+['tools/build-compile-wat.js'],'compile',120,180)
 if r['exit'] or r['violation']:save('result.json',dict(status='COMPILE_FAILED',compile=r,guestInvocations=0,module=None))
 else:
  modules={str(p.relative_to(R)):pin(p) for p in (R/'build').glob('*.wasm')};assert 'build/wine-assembly.wasm' in modules
  save('build-identity.json',dict(source='311c42abb41adc1fc16e06b4276005d15db553b2',modules=modules));save('result.json',dict(status='COMPILED',compile=r,guestInvocations=0,modules=modules))
elif mode=='guest':
 assert json.loads((R/'result.json').read_text())['status']=='COMPILED'
 a=json.loads((R/'assignment.json').read_text());assert time.time()<a['cutoffEpoch'];(R/'one-guest-invocation.lock').open('x').write(str(time.time()));(R/'capture').mkdir()
 args=json.loads((R/'launch-configuration.json').read_text())['configuration']['args']
 r=run(flags+['test/run.js',*args],'guest',60,90)
 images={str(p.relative_to(R)):pin(p) for p in (R/'capture').glob('*.png')};assert all(v['bytes']<=300000 for v in images.values())
 save('result.json',dict(status='GUEST_ATTEMPTED',guestInvocations=1,guest=r,build=json.loads((R/'build-identity.json').read_text()),images=images,gameplayAccepted=False,inputEvents=[],scope='One unchanged original invocation; screenshots require human inspection. No repair or retest.'))
else:raise ValueError(mode)
print(json.dumps(dict(mode=mode,physical=alloc(),status=json.loads((R/'result.json').read_text())['status'] if (R/'result.json').exists() else 'PREFLIGHT_PASS')))
