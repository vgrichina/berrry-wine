import pathlib,urllib.request,json,time,sys,resource
H=pathlib.Path(__file__).parent;O=H/'serial';O.mkdir(exist_ok=True)
resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
start=time.monotonic();deadline=start+82

def ctl(c):
 at=time.time();req=urllib.request.Request('http://127.0.0.1:8128/ctl',data=json.dumps(c).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=max(1,deadline-time.monotonic())) as f:b=f.read(8192)
  j=json.loads(b)
 except Exception as e:
  (O/'first-failure.json').write_text(json.dumps(dict(at=at,request=c,error=repr(e),noReplay=True)));raise
 with (O/'control.jsonl').open('a') as f:f.write(json.dumps(dict(at=at,end=time.time(),request=c,response=j))+'\n')
 assert j['ok'],j
 return j['value']
for _ in range(150):
 try:
  req=urllib.request.Request('http://127.0.0.1:8128/ctl',data=b'{"action":"ping"}',headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=.2) as f:ready=json.loads(f.read(8192))
  assert ready['ok'];break
 except Exception:
  if (H/'guest/terminal.json').exists():sys.exit('guest terminated before control')
  time.sleep(.03)
s=ctl({'action':'snapshot'});assert s['frozen']['credits']==0 and s['frozen']['frozen']
last=s['batch'];step=1
while time.monotonic()<deadline-4:
 n=step;step=256
 # adaptive bound based on measured laststep duration, leave capture and quit margin.
 if 'duration' in globals():
  remaining=deadline-4-time.monotonic();n=min(n,max(1,int(remaining/max(duration/nprev,.00001)*.75)))
 t=time.monotonic();ack=ctl({'action':'step','n':n});duration=time.monotonic()-t;nprev=n
 s=ctl({'action':'snapshot'});assert s['batch']==last+n and s['frozen']['credits']==0 and s['frozen']['frozen'];last=s['batch']
 (O/'checkpoint.json').write_text(json.dumps(dict(batch=last,elapsed=time.monotonic()-start,snapshot=s,ack=ack)))
 if time.monotonic()-start>=52:break
ctl({'action':'png','path':str(O/'later.png')})
(O/'paused.json').write_text(json.dumps(dict(batch=last,elapsed=time.monotonic()-start,deadline=time.time()+deadline-time.monotonic())))
# Human frame inspection happens while frozen; no automated input based on titles.
while time.monotonic()<deadline:
 p=O/'continue.json'
 if p.exists():
  cmd=json.loads(p.read_text());p.unlink()
  if cmd.get('quit'):break
  for c in cmd.get('commands',[]):ctl(c)
  if cmd.get('step'):
   n=min(256,int(cmd['step']));ctl({'action':'step','n':n});s=ctl({'action':'snapshot'});assert s['frozen']['credits']==0
  if cmd.get('png'):ctl({'action':'png','path':str(O/cmd['png'])})
 time.sleep(.03)
ctl({'action':'snapshot'});ctl({'action':'quit'});(O/'done.json').write_text(json.dumps(dict(batch=last,elapsed=time.monotonic()-start)))
