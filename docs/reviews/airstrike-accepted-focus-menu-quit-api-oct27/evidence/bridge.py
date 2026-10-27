import os,sys,json,pathlib,time,subprocess,resource,signal,selectors,hashlib,ctypes,shutil
R=pathlib.Path('/home/user/airstrike-menu-quit-oct27');H=R/'evidence';N='/home/user/.nvm/versions/node/v24.22.1/bin/node';M=1048576
def save(n,x):
 p=H/n;t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,indent=2)+'\n');os.replace(t,p)
def group(g):
 out=[]
 for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   s=p.read_text().rsplit(')',1)[1].split()
   if int(s[2])==g:out.append((int(p.parent.name),int(s[21])*4096))
  except (OSError,ValueError):pass
 return out
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(140,140));resource.setrlimit(resource.RLIMIT_FSIZE,(4*M,4*M))
env={'PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC'}
base=[N,'--max-old-space-size=512','--require',str(H/'abi-preload-relocated.cjs')]
dll=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll','msvcrt.dll','zlib.dll']
argv=base+[str(R/'runner/test/run.js'),'--no-build','--wasm='+str(R/'runner/build/wine-assembly.wasm'),'--exe='+str(R/'game/airstrike-pre6a.exe'),'--dlls='+','.join(str(R/'game'/x) for x in dll),'--vfs-tree='+str(R/'game'),'--cwd=C:\\','--quiet-api','--quiet-blocks','--no-threads','--memory-mb=512','--max-seconds=120','--max-batches=1000000','--batch-size=20000','--tick-ms-per-batch=5','--trace-input','--screen=800x600','--control-stdin','--no-close']
save('planned-argv.json',argv)
if sys.argv[1]=='startup':
 code='''const fs=require('fs'),path=require('path'),assert=require('assert');const R=process.argv[1];const planned=JSON.parse(fs.readFileSync(R+'/evidence/planned-argv.json'));const args=planned.slice(4);const source=fs.readFileSync(R+'/runner/test/run.js','utf8');const a=source.indexOf('const getArgs = name => {'),b=source.indexOf('const hasFlag =',a);const body=source.slice(a,b);const parser=new Function('args',body+';return getArgs;')(args);assert.deepStrictEqual(parser('vfs-tree'),[R+'/game']);assert.equal(parser('dlls').length,8);const {expandIncludePatterns}=require(R+'/runner/lib/vfs-host-files');const files=expandIncludePatterns(parser('vfs-tree')[0],['**/*']);const m=JSON.parse(fs.readFileSync(R+'/evidence/complete-runtime-manifest.json'));const expected=m.filter(x=>x.dest.startsWith('game/')).map(x=>x.dest.slice(5)).sort();const actual=files.map(x=>path.relative(R+'/game',x.hostPath)).sort();assert.deepStrictEqual(actual,expected);console.log(JSON.stringify({node:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),files:actual,commas:actual.filter(x=>x.includes(',')),environmentHash:require('crypto').createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex'),pass:true}));'''
 p=subprocess.run(base+['-e',code,str(R)],cwd=R/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20)
 save('node-startup.json',dict(argv=base+['-e',code,str(R)],returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0,p.stderr;print('startup PASS');sys.exit()
startup=json.loads((H/'node-startup.json').read_text());assert startup['returncode']==0
assert json.loads(startup['stdout'])['environmentHash']==hashlib.sha256(json.dumps(sorted(env.items()),separators=(',',':')).encode()).hexdigest()
assert time.time()<1793072850 # 03:47:30; reserve whole150s before03:50
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
assert mem>=2684354560+128*M+805306368
assert shutil.disk_usage(R).free-128*M>=2982150144
assert sum(p.stat().st_size for p in R.rglob('*') if p.is_file())<64*M
save('guest-admission.json',dict(at=time.time(),memAvailable=mem,remoteAllocation=128*M,physicalGroupLimit=2*1024**3,cpu=140,wall=150,maxSeconds=120,env=env,argv=argv))
ctypes.CDLL(None).prctl(36,1,0,0,0)
(H/'output.log').touch();(H/'runner.stderr').touch()
save('spawn-status.json',dict(state='attempting',at=time.time(),argv=argv))
p=subprocess.Popen(argv,cwd=R/'runner',env=env,preexec_fn=limits,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(H/'runner.stderr').open('wb'),start_new_session=True)
save('spawn-status.json',dict(state='started',pid=p.pid,at=time.time()))
start=time.monotonic();save('guest-process.json',dict(pid=p.pid,pgid=p.pid,started=time.time(),argv=argv,stdout='output.log',stderr='runner.stderr'))
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'runner');pending=b'';log=bytearray();acks={};events=[];peak=0;reason='exited';controller=None;transcript=[];captureCount=0;signals=[]
def pump(wait=.05):
 global pending,peak
 elapsed=time.monotonic()-start;rss=sum(x[1] for x in group(p.pid));peak=max(peak,rss)
 assert elapsed<150,'wall guard';assert rss<=2*1024**3,'RSS guard';assert len(log)<=2*M,'log guard'
 assert time.time()<1793073000,'guest cutoff'
 if int(elapsed*2)%10==0:save('resources.json',dict(at=time.time(),elapsed=elapsed,rss=rss,peak=peak,diskFree=shutil.disk_usage(R).free))
 for key,_ in sel.select(wait):
  if key.data!='runner':continue
  b=os.read(key.fd,65536)
  if not b:sel.unregister(key.fileobj);continue
  log.extend(b);(H/'output.log').write_bytes(log);pending+=b
  while b'\n' in pending:
   line,pending=pending.split(b'\n',1)
   if line.startswith(b'[ctl] '):
    a=json.loads(line[6:]);acks[a.get('id')]=a
 assert not any(s in log for s in [b'*** CRASH',b'Fatal error:',b'[eip-zero]']),'fault'
def send(cmd):
 assert p.poll() is None,'runner terminal';events.append(dict(at=time.time(),command=cmd));save('events.json',events);p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush()
def request(cmd):
 send(cmd);deadline=time.monotonic()+4
 while cmd['id'] not in acks:
  pump();assert time.monotonic()<deadline,'ACK timeout; no replay';assert p.poll() is None,'runner terminal before ACK'
 a=acks.pop(cmd['id']);assert a['ok'],a;return a
def capture(after):
 global captureCount
 assert captureCount<8
 name='frame-'+str(captureCount)+'.png';captureCount+=1
 a=request(dict(id='parent-png-'+str(captureCount),action='png',path=str(H/name)))
 s=request(dict(id='parent-snapshot-'+str(captureCount),action='snapshot'))
 b=(H/name).read_bytes();assert len(b)<=4*M;assert sum(x.stat().st_size for x in H.glob('frame-*.png'))<=16*M
 save('state.json',dict(state='observation-required',frame=name,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),after=after,snapshot=s,pngAck=a,at=time.time()))
 return name
def waitObservation(frame):
 path=H/(frame+'.observation.json');deadline=time.monotonic()+35 if controller is None else time.monotonic()+8
 while not path.exists():
  pump();assert time.monotonic()<deadline,'factual observation absent';assert p.poll() is None,'terminal while observing'
 o=json.loads(path.read_text());transcript.append(o);save('observations.json',transcript);return o
try:
 while time.monotonic()-start<5:pump()
 # Ordinary startup Enter and desktop caption clicks, not state/memory changes.
 for i,cmd in enumerate(['keydown:13','keyup:13','click:600:21','click:700:31']):
  request(dict(id='parent-start-'+str(i),cmd=cmd))
  until=time.monotonic()+.2
  while time.monotonic()<until:pump()
 frame=capture(None);o=waitObservation(frame)
 controller=subprocess.Popen([sys.executable,'-B',str(H/'airstrike-menu-controller.py')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(H/'controller.stderr').open('wb'),start_new_session=True)
 controller.stdin.write((json.dumps(o)+'\n').encode());controller.stdin.flush()
 while controller.poll() is None and p.poll() is None:
  import select
  if not select.select([controller.stdout],[],[],.02)[0]:pump();continue
  line=controller.stdout.readline()
  if not line:break
  cmd=json.loads(line);send(cmd);deadline=time.monotonic()+4
  while cmd['id'] not in acks and p.poll() is None:
   pump();assert time.monotonic()<deadline,'controller ACK timeout'
  if p.poll() is not None:break
  a=acks.pop(cmd['id']);controller.stdin.write((json.dumps({'ack':a})+'\n').encode());controller.stdin.flush()
  if cmd['cmd'].startswith('keyup:') and cmd['cmd']!='keyup:13':
   frame=capture(cmd['id']);o=waitObservation(frame);controller.stdin.write((json.dumps(o)+'\n').encode());controller.stdin.flush()
 if p.poll() is None and controller.poll() is not None:raise RuntimeError('controller refused: '+(H/'controller.stderr').read_text())
 while p.poll() is None:pump()
 pump(0)
except Exception as e:
 reason=str(e);save('bridge-failure.json',dict(reason=reason,at=time.time()))
finally:
 if p.poll() is None:
  os.killpg(p.pid,signal.SIGTERM);signals.append('TERM after failed contract')
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);signals.append('KILL');p.wait()
 for _ in range(5):
  try:pump(0)
  except Exception:break
 remaining=group(p.pid);normal=p.returncode==0 and '[Exit] code=0' in log.decode(errors='replace').splitlines() and not signals and not remaining and b'[max-seconds]' not in log
 t=dict(reason='guest-exit' if normal else reason,guestExitCode=0 if normal else None,runnerExitCode=p.returncode,signals=signals,cleanupComplete=not remaining,evidence='terminal.json/output.log',timeout=b'[max-seconds]' in log,controlQuit=False,wmClose=False,fault=any(s in log for s in [b'*** CRASH',b'Fatal error:',b'[eip-zero]']),hostExitObserved=normal,runnerLog=log.decode(errors='replace'),remaining=remaining,elapsed=time.monotonic()-start,peakGroupRSS=peak)
 save('terminal.json',t)
 if controller is not None:
  if controller.poll() is None:
   try:controller.stdin.write((json.dumps({'terminal':t})+'\n').encode());controller.stdin.flush();controller.wait(timeout=2)
   except Exception:controller.terminate();controller.wait(timeout=2)
  save('controller-terminal.json',dict(exit=controller.returncode,stderr=(H/'controller.stderr').read_text(),remaining=group(controller.pid)))
 save('state.json',dict(state='finished',normalQuit=normal,reason=reason,at=time.time(),controllerExit=controller.returncode if controller else None))
 print(json.dumps(dict(normalQuit=normal,reason=reason,runnerExit=p.returncode,remaining=remaining)))
