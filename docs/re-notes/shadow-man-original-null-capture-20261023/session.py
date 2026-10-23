"""ONE genuine CLI session. External watchdog and read-only live-state operator."""
import pathlib,json,os,subprocess,time,signal,selectors,threading,ctypes,resource,hashlib
R=pathlib.Path('/home/user/shadow-man-original-null-capture-oct23');F=R/'fixed';M=R/'mutable';O=M/'output';RT=R/'immutable/runtime'
g=json.loads((F/'guest-gate.json').read_text());assert g['passAll'] and not (F/'attempt.json').exists()
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
def save(name,value):
 fd=os.open(F/name,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 try:os.write(fd,(json.dumps(value,indent=2)+'\n').encode());os.fsync(fd)
 finally:os.close(fd)
def limits(seconds):
 resource.setrlimit(resource.RLIMIT_CPU,(seconds,seconds));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
start=time.monotonic();failure=None;actorDone=False;lock=threading.Lock();captured=g['priorCapturedBytes'];actorGroups=[]
def first(reason,detail):
 global failure
 with lock:
  if failure is None:failure=dict(reason=reason,detail=detail,elapsed=time.monotonic()-start);save('first-failure.json',failure)
def charge(b):
 global captured
 with lock:
  room=max(0,524288-captured);captured+=len(b)
  if captured>524288 and failure is None:
   # Set via caller after releasing this non-reentrant lock.
   pass
  return b[:room],captured>524288
env=g['environment'];argv=g['command']
save('attempt.json',dict(attempt=1,startedAt=time.time(),argv=argv,environment=env,scope='actual original CLI; no argv spoof'))
wrapper='import os,json; a=json.loads('+repr(json.dumps(argv))+');os.environ["SHADOW_NULL_PID"]=str(os.getpid());os.execvpe(a[0],a,os.environ)'
p=subprocess.Popen(['python3','-c',wrapper],cwd=O,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:limits(150))
save('actual-process.json',dict(pid=p.pid,pgid=p.pid,runner=str(RT/'test/run.js'),moduleSHA256=g['moduleSHA256'],singleArenaBytes=536870912))
def ctl(args,label,stdin=None,terminal=False):
 cmd=['node','--max-old-space-size=256',str(RT/'tools/ctl.js'),'-s',':'+str(g['controlPort']),*args]
 try:
  q=subprocess.run(cmd,input=stdin,capture_output=True,text=True,env=env,timeout=3,preexec_fn=lambda:limits(60))
  b=(q.stdout+q.stderr).encode();_,over=charge(b)
  rec=dict(argv=cmd,exit=q.returncode,stdout=q.stdout,stderr=q.stderr,elapsed=time.monotonic()-start)
  save(label+'.json',rec)
  if over:raise RuntimeError('aggregate stdout/stderr overflow125')
  if terminal:return rec
  assert q.returncode==0,(label,q.returncode,q.stderr)
  if args[0]=='cmd':return rec
  if args[0]=='pipe':
   body=json.loads(q.stdout);assert body.get('ok') is True,body
   return body['value']
  return json.loads(q.stdout)
 except Exception as e:
  if terminal:save(label+'.json',dict(terminalRequest=True,errorType=type(e).__name__,detail=str(e),elapsed=time.monotonic()-start));return None
  raise
def waitTitle(title,label,old=None):
 until=time.monotonic()+10
 while time.monotonic()<until and not failure:
  s=ctl(['snapshot'],label)
  if s.get('quit') is False:
   wins=[w for w in s.get('windows',[]) if w.get('title')==title and w.get('visible') is True and w.get('isChild') is False and w.get('w',0)>0 and w.get('h',0)>0]
   if wins and (old is None or wins[-1]['hwnd']!=old):return s,wins[-1]
  time.sleep(.05)
 raise RuntimeError('fresh visible '+title+' timeout')
def picture(name):
 result=ctl(['pipe'],name+'-png',json.dumps(dict(action='png',path=str(O/(name+'.png'))))+'\n')
 assert (O/(name+'.png')).is_file() and (O/(name+'.png')).stat().st_size>0
 return result
STATE="(()=>{const rows=[];for(let s=0;s<256;s++){const h=exports.wnd_slot_hwnd(s);if(h)rows.push({hwnd:h>>>0,id:exports.ctrl_get_id(h)|0,parent:exports.wnd_get_parent(h)>>>0,style:exports.wnd_get_style_export(h)>>>0});}return {windows:Object.values(renderer.windows).map(w=>({hwnd:w.hwnd,title:w.title,visible:w.visible,isDialog:w.isDialog})),controls:rows};})()"
def state(label):return ctl(['eval',STATE],label)
def operate():
 global actorDone
 try:
  # Endpoint readiness uses snapshot; it never fabricates a launcher or input.
  import socket
  until=time.monotonic()+10
  while True:
   with socket.socket() as s:
    s.settimeout(.03)
    if s.connect_ex(('127.0.0.1',g['controlPort']))==0:break
   assert time.monotonic()<until,'endpoint timeout';time.sleep(.03)
  initial,w=waitTitle('ShadowMan Launcher','launcher-before');picture('launcher-before');state('launcher-before-controls')
  ctl(['cmd','dlg-cmd:1024'],'configuration-dispatch')
  config,cw=waitTitle('ShadowMan Configuration','configuration');picture('configuration');state('configuration-controls')
  ctl(['cmd','dlg-cmd:1'],'ok-dispatch')
  after,aw=waitTitle('ShadowMan Launcher','launcher-after-ok',old=w['hwnd']);picture('launcher-after-ok');controls=state('launcher-after-ok-controls')
  assert any(c['id']==3 and c['parent']==int(aw['hwnd'],16) for c in controls['controls']),'fresh Beenden control missing'
  save('final-intent.json',dict(actionSequence=3,cmdId=3,dequeuedPriorCommands=[1024,1],snapshot=after,controls=controls,pngActionsQueued=0,pngRoute='actual ctl pipe action:png; snapshots/eval/png bypass scheduledInput',expectedLiveHwnd=aw['hwnd'],noHistoricalBatch=True))
  ctl(['cmd','dlg-cmd:3'],'beenden-dispatch',terminal=True)
 except Exception as e:first('operator-first-failure',dict(type=type(e).__name__,detail=str(e)))
 finally:actorDone=True
thread=threading.Thread(target=operate,daemon=True);thread.start()
sel=selectors.DefaultSelector();logs={};buffers={}
for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
 os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);logs[name]=(F/('guest-'+name+'.log')).open('xb');buffers[name]=b''
termAt=None;killSent=False
while sel.get_map() or p.poll() is None:
 now=time.monotonic()
 if now-start>=84 and failure is None:first('external-wall-watchdog','stop before90s including TERM5sKILL')
 if failure and termAt is None:
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  termAt=now
 if termAt is not None and now-termAt>=5 and not killSent:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  killSent=True
 for key,_ in sel.select(.02):
  b=os.read(key.fileobj.fileno(),65536)
  if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
  kept,over=charge(b);logs[key.data].write(kept);logs[key.data].flush()
  if over:first('aggregate-capture-overflow',125)
  buffers[key.data]+=b
  lines=buffers[key.data].split(b'\n');buffers[key.data]=lines.pop()
  for line in lines:
   import re
   if re.search(rb'RuntimeError:|^Error:|MODULE_NOT_FOUND|ENOSPC|EACCES|compile-guard:|resource-policy:|\[eip-zero\]',line):first('first-actual-runtime-error',line.decode(errors='replace'))
code=p.wait();thread.join(timeout=4)
for f in logs.values():f.flush();os.fsync(f.fileno());f.close()
try:os.killpg(p.pid,signal.SIGTERM)
except ProcessLookupError:pass
deadline=time.monotonic()+5;reaped=[]
while time.monotonic()<deadline:
 try:
  pid,status=os.waitpid(-1,os.WNOHANG)
  if pid:reaped.append(dict(pid=pid,status=status));continue
 except ChildProcessError:break
 time.sleep(.02)
try:os.killpg(p.pid,signal.SIGKILL)
except ProcessLookupError:pass
try:
 while True:
  pid,status=os.waitpid(-1,0);reaped.append(dict(pid=pid,status=status))
except ChildProcessError:pass
remaining=[]
for d in pathlib.Path('/proc').iterdir():
 if not d.name.isdigit():continue
 try:
  f=(d/'stat').read_text().split(') ',1)[1].split()
  if int(f[2])==p.pid:remaining.append(int(d.name))
 except (OSError,ValueError):pass
if remaining:first('unreaped-owned-group',remaining)
if thread.is_alive():first('operator-not-joined',True)
capture=O/'null-capture.jsonl';records=[json.loads(x) for x in capture.read_text().splitlines()] if capture.exists() else []
kinds=[x['record']['kind'] for x in records if 'record' in x]
conditions=dict(preArm=any('receipt' in x and x['receipt'].get('phase')=='pre-arm' for x in records),decodedBlock='decoded-block' in kinds,firstZero='first-zero' in kinds,modalConsume='modal-frame-consume' in kinds,modalComplete='modal-frame-complete' in kinds,terminal=any(x.get('terminal') is True and x.get('reason')=='first-zero' for x in records),actualOsExit86=code==86,allGroupsReaped=not remaining)
if not all(conditions.values()) and failure is None:first('missing-required-original-capture-records',dict(conditions=conditions,kinds=kinds,terminals=[x for x in records if 'terminal' in x]))
save('session-result.json',dict(guestAttempts=1,osExit=code,guestExit='unproven',elapsedSeconds=time.monotonic()-start,externalBoundSeconds=90,firstFailure=failure,captureConditions=conditions,capturedBytes=captured,aggregateCap=524288,remaining=remaining,reaped=reaped,operatorJoined=not thread.is_alive(),boxLeftRunning=True))
