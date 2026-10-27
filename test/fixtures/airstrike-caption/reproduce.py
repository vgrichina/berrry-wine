"""Independent OFFLINE protocol rejection oracle. No Node/guest/gameplay evidence."""
import copy,hashlib,importlib.util,json,pathlib,subprocess,sys,threading,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo'
def load(n,p):
 s=importlib.util.spec_from_file_location(n,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
t=load('candidate_fixture',R/'test/test-airstrike-console-obscuration.py')
b=t.b;m=t.m
def snap():
 s=copy.deepcopy(t.SNAPSHOT);s['windows'][0]['h']=8;return s
if len(sys.argv)>1 and sys.argv[1]=='--fake-transport':
 d=pathlib.Path(sys.argv[2]);s=snap();print('OFFLINE FAKE protocol transport; no renderer or guest',file=sys.stderr,flush=True)
 for line in sys.stdin:
  cmd=json.loads(line)
  with (d/'received.jsonl').open('a') as f:f.write(json.dumps(cmd)+'\n')
  if 'cmd' in cmd:
   print('FAKE transport terminal immediately after input; no actual dispatch/gameplay log',file=sys.stderr,flush=True);sys.exit(0)
  if cmd['action']=='snapshot':v=s
  elif cmd['action']=='png':
   data=b'OFFLINE synthetic unchanged frame';pathlib.Path(cmd['path']).write_bytes(data);v=dict(path=cmd['path'],bytes=len(data))
  else:raise AssertionError(cmd)
  print('[ctl] '+json.dumps(dict(id=cmd['id'],ok=True,value=v)),flush=True)
 sys.exit(0)
s=snap();o=t.approved();o['startupSnapshot']=s
cli=subprocess.run([sys.executable,'-B',str(R/'tools/airstrike-menu-controller.py')],input=json.dumps(dict(observation=o))+'\n',text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
(H/'reproducer-cli.stdout').write_text(cli.stdout);(H/'reproducer-cli.stderr').write_text(cli.stderr)
commands=[json.loads(x) for x in cli.stdout.splitlines()]
directory=H/'independent-unsafe-height';directory.mkdir()
obj=b.Bridge([sys.executable,'-B',__file__,'--fake-transport',str(directory)],R/'tools/airstrike-menu-controller.py',directory/'evidence',guest_seconds=12)
done=threading.Event();errors=[]
def review():
 seen=set()
 try:
  while not done.wait(.005):
   p=obj.root/'review-request.json'
   if not p.exists():continue
   q=json.loads(p.read_text())
   if q['token'] in seen:continue
   seen.add(q['token']);a=t.approved();a.pop('startupSnapshot');a['evidence']=q['path']
   reply={k:q[k] for k in ('session','token','sha256','after')};reply['observation']=a
   b.save(obj.root/('review-'+q['token']+'.json'),reply)
 except Exception as e:errors.append(str(e))
thread=threading.Thread(target=review);thread.start()
try:result=obj.run()
finally:done.set();thread.join(2)
received=[json.loads(x) for x in (directory/'received.jsonl').read_text().splitlines()]
inputs=[x for x in received if 'cmd' in x]
renderer=(H/'production-renderer-input.js').read_text()
assert hashlib.sha256(renderer.encode()).hexdigest()=='4ea9ba14249a361b6c498c8e019cc27b761bc080af755eab04616b85af5ca051'
assert 'canvasY >= r.y && canvasY < r.y + r.h' in renderer
main=s['windows'][0];x,y=656,33
inside=main['x']<=x<main['x']+main['w'] and main['y']<=y<main['y']+main['h']
report=dict(verdict='REJECT' if inputs or commands else 'PASS',kind='OFFLINE FAKE transport, actual pinned Controller CLI and Bridge.run; static exact renderer rectangle oracle; NOT gameplay',snapshot=s,point=[x,y],pointInsideMain=inside,expected='No input: no safe Airstrike caption exists in height8 rectangle',controllerCLI=dict(exit=cli.returncode,commands=commands),bridge=dict(result=result,inputs=inputs,reviewErrors=errors),rendererSHA256=hashlib.sha256(renderer.encode()).hexdigest(),causalBoundary='renderer handleMouseDown sortedWins filters point outside [y,y+h); no target activation',terminalAfterClick='fake transport exited after receiving unsafe click; no subsequent keys; cleanup complete')
(H/'independent-rejection.json').write_text(json.dumps(report,indent=2)+'\n')
assert not inside and commands==[dict(id='airstrike-1',cmd='click:656:33')] and inputs==commands
assert result['cleanup']['complete'] and not errors and not thread.is_alive()
print('REJECT: actual Controller CLI and Bridge.run dispatch click656:33 outside main rectangle y20..28. No keys; terminal cleanup complete. Offline transport only.')
