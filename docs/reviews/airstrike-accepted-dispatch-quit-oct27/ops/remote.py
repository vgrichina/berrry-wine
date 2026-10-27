import os,sys,pathlib,json,time,hashlib,resource,importlib.util,shlex,shutil
R=pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27');H=R/'ops';M=1048576
N='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV={'PATH':str(pathlib.Path(N).parent)+':/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
def save(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
def module(p,name):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
sup=module(H/'supervisor.py','supervisor')
base=[N,'--max-old-space-size=512','--require',str(H/'abi-preload.cjs')]
dll=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll','msvcrt.dll','zlib.dll']
argv=base+[str(R/'runner/test/run.js'),'--no-build','--wasm='+str(R/'runner/build/wine-assembly.wasm'),'--exe='+str(R/'game/airstrike-pre6a.exe'),'--dlls='+','.join(str(R/'game'/x) for x in dll),'--vfs-tree='+str(R/'game'),'--cwd=C:\\','--quiet-api','--quiet-blocks','--no-threads','--memory-mb=512','--max-seconds=120','--max-batches=1000000','--batch-size=20000','--tick-ms-per-batch=5','--trace-input','--screen=800x600','--control-stdin','--no-close','--frozen']
save('planned-argv.json',argv)
config=dict(node=N,nodeSHA256=sha(N),base=base,argvSHA256=hashlib.sha256(json.dumps(argv).encode()).hexdigest(),environmentSHA256=hashlib.sha256(json.dumps(sorted(ENV.items())).encode()).hexdigest(),cwd=str(R/'runner'),preloadSHA256=sha(H/'abi-preload.cjs'),startupSHA256=sha(H/'startup.cjs'),limits=dict(rss=2*1024**3,heap=512*M,cpu=90,wall=120,file=24*M,output=2*M),inherited={str(k):resource.getrlimit(k) for k in (2,9,0,1)},runnerSHA256=sha(R/'runner/test/run.js'),moduleSHA256=sha(R/'runner/build/wine-assembly.wasm'))
os.environ.clear();os.environ.update(ENV)
def supervised(cmd,label):
 out=H/(label+'.stdout');err=H/(label+'.stderr');out.touch();err.touch()
 def check():
  if time.time()>=1793098080:return 'authoritative guest cutoff'
  if out.stat().st_size+err.stat().st_size>2*M:return 'output bound'
  logical=sum(p.stat().st_size for p in R.rglob('*') if p.is_file())
  if logical>256*M:return 'remote staging allocation'
 shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
 q=sup.supervise(['/bin/bash','-c',shell],rss_limit=2*1024**3,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
 (H/(label+'.supervisor-output')).write_bytes(q.pop('output'));save(label+'-supervision.json',dict(q,configuration=config,stdout=str(out),stderr=str(err)));return q
if sys.argv[1]=='startup':
 rows=json.loads((H/'runtime-map.json').read_text())['files']
 for x in rows:assert (R/x['target']).stat().st_size==x['bytes'] and sha(R/x['target'])==x['sha256'],x['target']
 save('remote-closure.json',dict(files=len(rows),bytes=sum(x['bytes'] for x in rows),allPinsPass=True,configuration=config))
 q=supervised(['/usr/bin/env','-i',*[k+'='+v for k,v in ENV.items()],'/usr/bin/prlimit','--fsize=4194304','--',*base,str(H/'startup.cjs'),str(R)],'startup');assert q['exit']==0 and not q['stopReason'] and q['cleanupComplete'],q
 save('startup-accepted.json',config);print('exact startup and canonical mounts PASS')
elif sys.argv[1]=='run':
 assert json.loads((H/'startup-accepted.json').read_text())==json.loads(json.dumps(config)),'startup exact config mismatch'
 assert time.time()+120<1793098080,'insufficient time before cutoff'
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;assert mem>=2*1024**3+128*M+805306368
 assert shutil.disk_usage(R).free-256*M>=2982150144
 save('guest-admission.json',dict(at=time.time(),memAvailable=mem,diskFree=shutil.disk_usage(R).free,configuration=config))
 q=supervised(['/usr/bin/python3','-B',__file__,'bridge'],'guest');print(json.dumps(q))
elif sys.argv[1]=='bridge':
 b=module(R/'runner/tools/airstrike-observation-bridge.py','accepted_bridge')
 assert sha(R/'runner/tools/airstrike-observation-bridge.py')=='3d2cc3e3fb01c099b07260a3130a88dbb957519ec3fe43d4a13de0d78a1296ee'
 class RuntimeBridge(b.Bridge):
  captures=0;bootstrapped=False
  def capture(self,*args,**kw):
   if self.captures>=16:raise b.Stop('sixteen capture cap')
   self.captures+=1;x=super().capture(*args,**kw)
   if pathlib.Path(x['path']).stat().st_size>300000:raise b.Stop('measured capture plan individual300000B cap')
   return x
  def observation(self):
   if not self.bootstrapped:
    self.bootstrapped=True
    for i in range(10):
     done=self.request_ack('step',n=5000);state=self.request_ack('snapshot')
     if done['value'].get('ran')!=5000 or state['value'].get('frozen',{}).get('credits')!=0:raise b.Stop('bootstrap step completion uncertain')
     if any(str(w.get('title','')).startswith('Airstrike') and w.get('visible') for w in state['value'].get('windows',[])):break
   return super().observation()
 bridge=RuntimeBridge(argv,R/'runner/tools/airstrike-menu-controller.py',H/'game-evidence',cwd=R/'runner',env=ENV,guest_seconds=115,wall_seconds=120)
 print(json.dumps(bridge.run()))
