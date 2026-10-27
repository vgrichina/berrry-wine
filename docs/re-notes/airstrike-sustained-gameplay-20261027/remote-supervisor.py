import os,sys,json,pathlib,time,subprocess,resource,signal,selectors,hashlib,ctypes,shutil
R=pathlib.Path('/home/user/airstrike-sustained-oct27');H=R/'evidence';H.mkdir(exist_ok=True);N='/home/user/.nvm/versions/node/v24.22.1/bin/node'
def save(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def group(g):
 out=[]
 for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   s=p.read_text().rsplit(')',1)[1].split()
   if int(s[2])==g:out.append((int(p.parent.name),int(s[21])*4096))
  except (OSError,ValueError):pass
 return out
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(140,140));resource.setrlimit(resource.RLIMIT_FSIZE,(4*1048576,4*1048576))
env={'PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC'};flags=['--max-old-space-size=512'];base=[N,*flags,'--require',str(H/'abi-preload.cjs')];dll=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll','msvcrt.dll','zlib.dll']
argv=base+[str(R/'runner/test/run.js'),'--no-build','--wasm='+str(R/'runner/build/wine-assembly.wasm'),'--exe='+str(R/'game/airstrike-pre6a.exe'),'--dlls='+','.join(str(R/'game'/x) for x in dll),'--vfs-tree='+str(R/'game'),'--cwd=C:\\','--quiet-api','--quiet-blocks','--no-threads','--memory-mb=512','--max-seconds=115','--max-batches=1000000','--batch-size=20000','--tick-ms-per-batch=5','--trace-input','--screen=800x600','--control-stdin','--no-close','--png='+str(H/'quit-outcome.png')]
save('planned-argv.json',argv)
if sys.argv[1]=='startup':
 code='''const fs=require('fs'),path=require('path'),assert=require('assert');const R=process.argv[1];const planned=JSON.parse(fs.readFileSync(R+'/evidence/planned-argv.json'));const args=planned.slice(4);const source=fs.readFileSync(R+'/runner/test/run.js','utf8');const a=source.indexOf('const getArgs = name => {'),b=source.indexOf('const hasFlag =',a);const body=source.slice(a,b);const parser=new Function('args',body+';return getArgs;')(args);assert.deepStrictEqual(parser('vfs-tree'),[R+'/game']);assert.equal(parser('dlls').length,8);const {expandIncludePatterns}=require(R+'/runner/lib/vfs-host-files');const files=expandIncludePatterns(parser('vfs-tree')[0],['**/*']);const m=JSON.parse(fs.readFileSync(R+'/manifest.json'));const expected=m.filter(x=>x.dest.startsWith('game/')).map(x=>x.dest.slice(5)).sort();const actual=files.map(x=>path.relative(R+'/game',x.hostPath)).sort();assert.deepStrictEqual(actual,expected);console.log(JSON.stringify({node:process.execPath,version:process.version,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),parserSource:body,files:actual,commas:actual.filter(x=>x.includes(',')),environmentHash:require('crypto').createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex'),pass:true}));'''
 p=subprocess.run(base+['-e',code,str(R)],cwd=R/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=20);save('node-startup.json',{'argv':base+['-e','<canonical parser and startup check>',str(R)],'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr;print('startup and canonical filename enumeration PASS');sys.exit()
assert time.time()<1793070600,'cutoff reached'
startup=json.loads((H/'node-startup.json').read_text());assert startup['returncode']==0
assert json.loads(startup['stdout'])['environmentHash']==hashlib.sha256(json.dumps(sorted(env.items()),separators=(',',':')).encode()).hexdigest(),'startup environment changed'
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
used=sum(p.stat().st_size for p in R.rglob('*') if p.is_file());assert used+16*1048576+2*1048576+16*1048576+8*1048576<100663296
assert mem>=2684354560+256*1048576;assert shutil.disk_usage(R).free-100663296>=2982150144
save('guest-admission.json',{'at':time.time(),'memoryAvailable':mem,'used':used,'allocation':100663296,'captureAllowance':16*1048576,'perPNG':4*1048576,'textAllowance':2*1048576,'reserve':8*1048576,'physicalGroupLimit':2*1024**3,'wall':150,'guestMaxSeconds':115,'cpu':140,'argv':argv,'envHash':hashlib.sha256(json.dumps(sorted(env.items())).encode()).hexdigest()})
ctypes.CDLL(None).prctl(36,1,0,0,0)
p=subprocess.Popen(argv,cwd=R/'runner',env=env,preexec_fn=limits,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);start=time.monotonic();save('guest-process.json',{'pid':p.pid,'pgid':p.pid,'started':time.time(),'argv':argv})
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);buf=b'';total=0;pending=None;events=[];peak=0;fault=False;reason='exited';idx=0
# Serial ordinary input; each acknowledgement precedes the next command.
schedule=[(5,'keypress:13'),(7,'click:600:21'),(8,'click:750:400'),(9,'keydown:188'),(10,'keydown:37'),(10.5,'keyup:37'),(12,'keydown:190'),(20,'png:'+str(H/'play-20s.png')),(25,'keyup:190'),(30,'keydown:39'),(30.5,'keyup:39'),(38,'keydown:190'),(50,'png:'+str(H/'play-50s.png')),(55,'keyup:190'),(65,'keydown:37'),(65.6,'keyup:37'),(72,'keydown:190'),(85,'png:'+str(H/'play-85s.png')),(89,'keyup:190'),(89.2,'keyup:188'),(91,'keypress:27')]+[(92+i*.4,'keypress:40') for i in range(6)]+[(95,'keypress:13')]
schedule=[e for t,c in schedule for e in ([(t,c.replace('keypress:','keydown:')),(t+.12,c.replace('keypress:','keyup:'))] if c.startswith('keypress:') else [(t,c)])]
with (H/'output.log').open('wb') as log:
 while p.poll() is None or sel.get_map():
  now=time.monotonic()-start;members=group(p.pid);rss=sum(x[1] for x in members);peak=max(peak,rss)
  pngs=list(H.glob('*.png'));pngbytes=sum(x.stat().st_size for x in pngs);used=sum(x.stat().st_size for x in R.rglob('*') if x.is_file())
  if now>150 or rss>2*1024**3 or pngbytes>16*1048576 or any(x.stat().st_size>4*1048576 for x in pngs) or used+8*1048576>100663296 or shutil.disk_usage(R).free<2982150144:reason='resource guard';break
  if pending and now-pending['sent']>10:reason='control acknowledgement timeout';break
  if not pending and idx<len(schedule) and now>=schedule[idx][0] and p.poll() is None:
   e={'index':idx,'cmd':schedule[idx][1],'sent':now};p.stdin.write((json.dumps({'cmd':e['cmd']})+'\n').encode());p.stdin.flush();events.append(e);pending=e;idx+=1;save('input-events.json',events)
  for key,_ in sel.select(.05):
   data=os.read(key.fd,8192)
   if not data:sel.unregister(key.fileobj);continue
   if total+len(data)>1048576:reason='text guard';break
   total+=len(data);log.write(data);log.flush();buf+=data
   if b'*** CRASH' in data or b'Fatal error:' in data:fault=True;reason='guest fault';break
   while b'\n' in buf:
    line,buf=buf.split(b'\n',1)
    if line.startswith(b'[ctl] '):
     ack=json.loads(line[6:]);events[-1]['ack']=ack;events[-1]['ackAt']=now;save('input-events.json',events)
     if ack.get('ok') is False:reason='control rejection';break
     pending=None
  if reason!='exited':break
signals=[]
if p.poll() is None:
 os.killpg(p.pid,signal.SIGTERM);signals.append('TERM');
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);signals.append('KILL')
p.wait(timeout=5)
for _ in range(100):
 try:
  q,_=os.waitpid(-1,os.WNOHANG)
  if not q:break
 except ChildProcessError:break
remaining=group(p.pid);save('terminal.json',{'returncode':p.returncode,'reason':reason,'fault':fault,'elapsed':time.monotonic()-start,'signals':signals,'remaining':remaining,'peakGroupRSS':peak,'logBytes':total,'commandsSent':idx,'plannedCommands':len(schedule),'finished':time.time()});assert not remaining;print(json.dumps(json.loads((H/'terminal.json').read_text())))
