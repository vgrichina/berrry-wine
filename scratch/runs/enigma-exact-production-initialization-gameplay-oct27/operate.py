import pathlib,json,time,subprocess,urllib.request,os,resource,threading,signal,hashlib,sys
H=pathlib.Path(__file__).parent.parent;E=H/'ops/guest';E.mkdir(exist_ok=True);start=time.monotonic();at=time.time();CUTOFF=1793062500
# Entire invocation including supervisor/controller is one aggregate tree.
def save(n,j):
 p=E/(n+'.tmp');p.write_text(json.dumps(j,indent=2));p.replace(E/n)
def scan():
 rows={}
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=(q/'stat').read_text();v=s[s.rfind(')')+2:].split();rows[int(q.name)]=dict(ppid=int(v[1]),state=v[0],start=v[19],cpu=(int(v[11])+int(v[12]))/os.sysconf('SC_CLK_TCK'),rss=int(v[21])*os.sysconf('SC_PAGE_SIZE'))
  except (OSError,ValueError,IndexError):pass
 return rows
def mem():return int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
a=json.loads((H/'guest-args.json').read_text());env=dict(os.environ)
for k in ['WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP']:env.pop(k,None)
assert mem()>=3758096384 and time.time()<CUTOFF
assert not (E/'command.json').exists()
# Same executable/heap/environment/limits as guest, no guest invocation.
q=subprocess.run(a[:2]+['-e','console.log(JSON.stringify({version:process.version,execArgv:process.execArgv,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))'],cwd=H/'runner',env=env,preexec_fn=limits,capture_output=True,text=True,timeout=5)
save('node-startup.json',dict(exit=q.returncode,stdout=q.stdout,stderr=q.stderr));assert q.returncode==0
startup=json.loads(q.stdout); limitlines=startup['limits'].splitlines(); assert all('unlimited' in next(x for x in limitlines if x.startswith(name)) for name in ['Max data size','Max address space'])
f=(E/'output.log').open('wb');p=subprocess.Popen(a,cwd=H/'runner',env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);os.set_blocking(p.stdout.fileno(),False)
save('command.json',dict(argv=a,pid=p.pid,at=at,memAvailable=mem(),limits=dict(cpuTree=90,wall=120,rssTree=3221225472,file=25165824,output=2097152,captures=8,captureBytes=2097152),environment={k:v for k,v in env.items() if k.startswith(('NODE','WINE','ENIGMA'))}))
done=threading.Event();known={};peak=0;cpuPeak=0;outputBytes=0;reason='running'
def monitor():
 global peak,cpuPeak,outputBytes,reason
 while not done.is_set():
  rows=scan();owners={os.getpid()}
  for _ in range(len(rows)):
   added={pid for pid,s in rows.items() if s['ppid'] in owners}-owners
   if not added:break
   owners.update(added)
  known.update({pid:rows[pid] for pid in owners if pid in rows});live={pid:s for pid,s in rows.items() if pid in known and known[pid]['start']==s['start'] and s['state']!='Z'}
  rss=sum(s['rss'] for s in live.values());cpu=sum(s['cpu'] for s in known.values());peak=max(peak,rss);cpuPeak=max(cpuPeak,cpu)
  try:b=os.read(p.stdout.fileno(),8192)
  except BlockingIOError:b=b''
  if b:f.write(b[:max(0,2097152-outputBytes)]);f.flush();outputBytes+=len(b)
  if rss>3221225472 or cpu>=90 or outputBytes>2097152 or mem()<805306368 or time.monotonic()-start>110 or time.time()>=CUTOFF:
   reason='aggregate-limit-or-cutoff';os.killpg(p.pid,signal.SIGTERM);return
  if p.poll() is not None:reason='guest-terminal';return
  time.sleep(.025)
t=threading.Thread(target=monitor,daemon=True);t.start();pending=False;batch=None;requests=0;steps=0;total=0;captures=0;clicked=False
trace=(E/'requests.jsonl').open('a')
def control(c):
 global requests
 row=dict(at=time.time(),request=c,startingBatch=batch,pending=pending)
 try:
  assert p.poll() is None and reason=='running','terminal guest'
  r=urllib.request.Request('http://127.0.0.1:18127/ctl',data=json.dumps(c).encode(),headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(r,timeout=3) as r:b=r.read(8193)
  assert len(b)<=8192;row['originalResponse']=b.decode();v=json.loads(b);assert v.get('ok') is True,v;return v['value']
 except Exception as ex:row['error']=repr(ex);raise
 finally:row['ended']=time.time();trace.write(json.dumps(row)+'\n');trace.flush();requests+=1

def snapshot():
 global batch
 assert not pending;s=control(dict(action='snapshot'));assert s['frozen']==dict(frozen=True,tickMs=s['frozen']['tickMs'],credits=0,recording=False),s;batch=s['batch'];return s

def step(n):
 global pending,steps,total
 assert not pending and 1<=n<=256;pending=True;r=control(dict(action='step',n=n));assert r['ran']==n and r['steps']==n and r['frozen'] is True,r
 pending=False;s=snapshot();assert s['batch']==r['batch'];steps+=1;total+=n;return s

def capture(name):
 global captures
 assert captures<8 and not pending
 r=control(dict(action='png',path=str(E/name)));p1=E/name;b=p1.read_bytes();assert len(b)<=2097152 and b[16:24]==bytes.fromhex('00000280000001e0');captures+=1;save(name+'.json',dict(response=r,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),batch=batch));return r
status='INITIALIZING'
try:
 deadline=time.monotonic()+8
 while '[control] listening on http://127.0.0.1:18127/ctl' not in (E/'output.log').read_text(errors='replace'):
  assert p.poll() is None and time.monotonic()<deadline,'initialization/control readiness blocker';time.sleep(.02)
 s=snapshot();save('initial-snapshot.json',s);s=step(1);save('first-n1-completion-gate.json',dict(snapshot=s,acknowledged=True,noOutstandingCredits=True));save('checkpoint.json',dict(phase='initialized-ACKall-frozen0',at=time.time(),batch=batch,steps=steps,total=total,remaining=['menu','Start Game','after-action','normalQuit']))
 while time.monotonic()-start<35:
  s=step(256);assert not s['quit'],'guest quit/trap'
 save('menu-candidate-snapshot.json',s);capture('menu-candidate.png');save('phase.json',dict(phase='AWAIT_IMAGE_REVIEW',elapsed=time.monotonic()-start,batch=batch))
 # Root inspects actual PNG before placing one safe ordinary action decision.
 while not (E/'decision.json').exists() and time.monotonic()-start<76 and reason=='running':time.sleep(.05)
 if (E/'decision.json').exists():
  d=json.loads((E/'decision.json').read_text());save('image-review-decision.json',d)
  if d.get('safeStartGame') is True:
   assert time.monotonic()-start<80 and not pending
   r=control(dict(cmd='click:'+str(d['x'])+':'+str(d['y'])));clicked=True;save('start-game-action-ACK.json',r);s=step(1);save('after-action-step1.json',s)
   until=min(95,time.monotonic()-start+8)
   while time.monotonic()-start<until:s=step(256)
   capture('after-action.png');save('after-action-snapshot.json',s);status='ORDINARY_START_ACTION_ACKNOWLEDGED_REQUIRES_REVIEW'
  else:status='MENU_OR_FRAME_BLOCKER_NO_INPUT'
 else:status='NO_IMAGE_REVIEW_DECISION_NO_INPUT'
 save('checkpoint.json',dict(phase=status,batch=batch,steps=steps,total=total,captures=captures,clicked=clicked,elapsed=time.monotonic()-start))
 # Ordinary safe Escape only if separately authorized by inspected menu decision.
 if clicked and d.get('quitWithEscape') and time.monotonic()-start<100:
  save('escape-ACK.json',control(dict(cmd='keypress:27')));s=step(1);capture('final.png')
except Exception as ex:status='EXACT_PRODUCTION_RUNTIME_BLOCKER';save('first-runtime-rejection.json',dict(error=repr(ex),at=time.time(),pending=pending,clicked=clicked,batch=batch))
finally:
 done.set();t.join(timeout=1)
 for sig in [signal.SIGTERM,signal.SIGKILL]:
  try:os.killpg(p.pid,sig)
  except ProcessLookupError:pass
  try:p.wait(timeout=.5)
  except subprocess.TimeoutExpired:pass
 try:
  while b:=os.read(p.stdout.fileno(),8192):f.write(b[:max(0,2097152-outputBytes)]);outputBytes+=len(b)
 except BlockingIOError:pass
 f.close();trace.close();rows=scan();remaining=[pid for pid,s in known.items() if pid!=os.getpid() and pid in rows and rows[pid]['start']==s['start'] and rows[pid]['state']!='Z']
 save('terminal.json',dict(reason=reason,status=status,returncode=p.returncode,elapsed=time.monotonic()-start,peakTreeRSS=peak,peakTreeCPU=cpuPeak,outputBytes=outputBytes,remainingOwnedLive=remaining,identities=known,box='bx_c7m7bu48',shutdownOwner='coordinator'))
 save('outcome.json',dict(status=status,steps=steps,acknowledgedBatches=total,requests=requests,pending=pending,lastBatch=batch,captures=captures,clicked=clicked,elapsed=time.monotonic()-start))
