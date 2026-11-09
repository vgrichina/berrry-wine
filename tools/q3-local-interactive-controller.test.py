"""Offline actual retained parent regression. No Boat, Chrome, or native retry."""
import ast
import errno
import gzip
import hashlib
import json
import os
from pathlib import Path
import pty
import runpy
import selectors
import signal
import subprocess
import sys
import threading
import time
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]).resolve();OUT.mkdir()
assert OUT.is_relative_to(ROOT/'scratch/runs')
MODULE=ROOT/'tools/q3-local-interactive-controller.py'
m=runpy.run_path(str(MODULE))
RETAINED=ROOT/'scratch/runs/20261109-q3-versioned-caller-arena-progress-1705'
CALLER=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else RETAINED/'q3-checkpoint-caller.py'
assert CALLER.is_relative_to(ROOT/'scratch/runs') and CALLER.is_file()
processes=[]
# Observable independent finite watchdog, armed before any fixture child.
watch=OUT/'watch';watch.mkdir();(watch/'targets').write_text('[]')
w=subprocess.Popen([sys.executable,'-B','-c', '''from pathlib import Path
import os,json,signal,sys,time
r=Path(sys.argv[1]);due=time.monotonic()+120
(r/'armed').write_text(json.dumps(dict(pid=os.getpid(),deadline=due)))
while time.monotonic()<due and not (r/'done').exists():time.sleep(.02)
fired=not (r/'done').exists()
if fired:
 for pid in json.loads((r/'targets').read_text()):
  try:os.killpg(pid,signal.SIGKILL)
  except ProcessLookupError:pass
(r/'terminal').write_text(json.dumps(dict(fired=fired)))
''',str(watch)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def until(fn):
 due=time.monotonic()+8
 while not fn():
  assert time.monotonic()<due,'test condition deadline'
  time.sleep(.005)
until(lambda:(watch/'armed').exists())
real_popen=subprocess.Popen
def spawn(*args,**kw):
 kw['start_new_session']=True
 p=real_popen(*args,**kw);processes.append(p)
 (watch/'targets').write_text(json.dumps([p.pid for p in processes if p.poll() is None]))
 return p

def receipt(out):
 v=json.loads((out/'controller-actual-wait.json').read_text())
 assert v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'],v
 assert not Path('/proc',str(v['pid'])).exists()
 return v

def livepipe():
 r,w=os.pipe();return os.fdopen(r,'rb',buffering=0),w

def run_case(name,code,send=None,emit=None,terminal=False):
 r,writer=livepipe();out=OUT/name;errors=[];result=[]
 def run():
  try:result.append(m['control']([sys.executable,'-B','-c',code],out,r,emit or (lambda *_:None),cleanup_seconds=3))
  except BaseException as e:errors.append(repr(e))
 with patch('subprocess.Popen',spawn):
  t=threading.Thread(target=run);t.start()
  until(lambda:bool(processes) and out.exists() and len(list(out.glob('controller.*.gz')))==2)
  if send:send(writer)
  t.join(10);assert not t.is_alive(),name
 try:os.close(writer)
 except OSError:pass
 r.close()
 assert not errors,errors
 v=receipt(out)
 assert result==[int(terminal)],(name,result)
 print('PASS',name,v,flush=True)
 return out

try:
 # Import the entire selected generated caller and its run-local inputs before
 # exercising its exact launch body below. Any process/network effect is fatal.
 imported=spawn([sys.executable,'-B','-c','''import runpy,sys
from pathlib import Path
p=Path(sys.argv[1]);sys.path.insert(0,str(p.parent));sys.argv=[str(p),'import-only','original']
def audit(event,args):
 if event in ('subprocess.Popen','socket.connect','os.fork','os.exec'):raise RuntimeError('OFFLINE caller import effect refused')
sys.addaudithook(audit)
m=runpy.run_path(str(p),run_name='q3_generated_import_test');assert callable(m['launch'])
print('PASS full selected generated caller import; no process or network')
''',str(CALLER)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 so,se=imported.communicate(timeout=8)
 (OUT/'selected-caller-import.json').write_text(json.dumps(dict(caller=str(CALLER.relative_to(ROOT)),sha256=hashlib.sha256(CALLER.read_bytes()).hexdigest(),status=imported.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode())))
 assert imported.returncode==0,se.decode()
 # Execute the exact retained interactive parent in a namespace whose only
 # subprocess is inert. Real epoll on /dev/null raises AFTER that Popen.
 old=RETAINED/'interactive.py'
 assert "p=subprocess.Popen" in old.read_text()
 child=spawn([sys.executable,'-B','-c','import time;time.sleep(30)'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.PIPE)
 old_reads=[]
 def old_spawn(*args,**kwargs):old_reads.append(args);return child
 # Replace only __file__'s directory via a tiny AST assignment; execution of
 # the original spawn/register ordering and real epoll remains unchanged.
 tree=ast.parse(old.read_text())
 for node in tree.body:
  if isinstance(node,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='R' for x in node.targets):
   node.value=ast.Call(func=ast.Name(id='Path',ctx=ast.Load()),args=[ast.Constant(str(OUT/'old'))],keywords=[])
 (OUT/'old').mkdir()
 with open('/dev/null') as null,patch('sys.stdin',null),patch('subprocess.Popen',old_spawn):
  try:exec(compile(ast.fix_missing_locations(tree),str(old),'exec'),dict(__file__=str(old)))
  except PermissionError as e:assert e.errno==errno.EPERM
  else:raise AssertionError('retained EPERM not reproduced')
 assert old_reads and child.poll() is None and not (OUT/'old/controller-actual-wait.json.gz').exists()
 child.kill();so,se=child.communicate(timeout=3)
 (OUT/'old/recovery-wait.json').write_text(json.dumps(dict(status=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
 print('PASS retained original EPERM after spawn; missing wait reproduced, test recovered child',flush=True)

 # Before-fix controls for regular-file EPERM and an already closed pipe.
 # The latter is admitted and spawns instead of refusing setup.
 for name in ('regular','eof'):
  directory=OUT/('old-'+name);directory.mkdir()
  tree=ast.parse(old.read_text())
  for node in tree.body:
   if isinstance(node,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='R' for x in node.targets):
    node.value=ast.Call(func=ast.Name(id='Path',ctx=ast.Load()),args=[ast.Constant(str(directory))],keywords=[])
  if name=='regular':
   f=directory/'stdin';f.write_text('capture\n');stream=open(f)
  else:
   rd,wr=os.pipe();os.close(wr);stream=os.fdopen(rd)
  child=spawn([sys.executable,'-B','-c','import sys;sys.stdin.buffer.read();print("old EOF admitted")'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  old_reads=[]
  with patch('sys.stdin',stream),patch('subprocess.Popen',old_spawn):
   try:exec(compile(ast.fix_missing_locations(tree),str(old),'exec'),dict(__file__=str(old)))
   except PermissionError as e:assert name=='regular' and e.errno==errno.EPERM
   except SystemExit as e:assert name=='eof' and e.code==0 and (directory/'controller-actual-wait.json.gz').exists()
   else:raise AssertionError('retained exit missing')
  stream.close();assert old_reads
  if child.poll() is None:child.kill()
  child.wait(timeout=3)
  for pipe in (child.stdin,child.stdout,child.stderr):
   if not pipe.closed:pipe.close()
 print('PASS before-fix regular-file EPERM and already-EOF creates child',flush=True)

 # Every preflight refusal must create zero children, through production CLI
 # argument authentication and production control, never a disconnected probe.
 fixture=OUT/'inert-caller.py';fixture.write_text("raise RuntimeError('must never spawn')\n")
 cli=[sys.executable,'-B',str(MODULE),'--caller',str(fixture),'--caller-sha256',hashlib.sha256(fixture.read_bytes()).hexdigest()]
 for name in ('null','regular','eof'):
  f=OUT/'input.txt';f.write_text('{"command":{"id":"forbidden"}}\n')
  if name=='eof':
   rd,wr=os.pipe();os.close(wr);stream=os.fdopen(rd,'rb')
  else:stream=open('/dev/null','rb') if name=='null' else open(f,'rb')
  out=OUT/('reject-'+name)
  # Audit in the invoked controller catches an accidental child even if it
  # exits quickly and never writes a marker.
  wrapper="import runpy,sys\ndef audit(e,a):\n if e=='subprocess.Popen':raise AssertionError('FORBIDDEN_SPAWN')\nsys.addaudithook(audit)\nsys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')"
  p=spawn([sys.executable,'-B','-c',wrapper,*cli[2:],'--evidence',str(out)],stdin=stream,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  so,se=p.communicate(timeout=5);stream.close()
  assert p.returncode==1 and b'FORBIDDEN_SPAWN' not in se and not (out/'controller-actual-wait.json').exists()
  assert json.loads((out/'first-terminal.json').read_text())['noReplay']
  (OUT/(name+'-cli-wait.json')).write_text(json.dumps(dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stderr=se.decode())))
 # Inject an OS registration EPERM for a valid live pipe: fail before spawn.
 r,wr=livepipe()
 with patch.object(selectors.EpollSelector,'register',side_effect=PermissionError(errno.EPERM,'injected register')),patch('subprocess.Popen',side_effect=AssertionError('spawn')):
  assert m['control'](['forbidden'],OUT/'reject-eperm',r)==1
 os.close(wr);r.close()
 assert 'Operation not permitted' in (OUT/'reject-eperm/first-terminal.json').read_text() or 'injected register' in (OUT/'reject-eperm/first-terminal.json').read_text()

 # Byte boundaries, including split UTF-8 and a partial trailing command.
 marker=OUT/'received'
 code="import sys,pathlib;v=sys.stdin.buffer.readline();pathlib.Path("+repr(str(marker))+").write_bytes(v);print('OUT',flush=True);print('ERR',file=sys.stderr,flush=True)"
 def send(wr):
  os.write(wr,b'{"review":"\xc3');time.sleep(.05);assert not marker.exists()
  os.write(wr,b'\xa9"}\npartial-must-not-forward')
 out=run_case('live-pipe',code,send)
 assert marker.read_bytes()==b'{"review":"\xc3\xa9"}\n'
 assert gzip.decompress((out/'controller.stdout.gz').read_bytes())==b'OUT\n'
 assert gzip.decompress((out/'controller.stderr.gz').read_bytes())==b'ERR\n'
 # Actual PTY stdin is supported (no selector substitutions).
 master,slave=pty.openpty();r=os.fdopen(slave,'rb',buffering=0)
 result=[]
 with patch('subprocess.Popen',spawn):
  t=threading.Thread(target=lambda:result.append(m['control']([sys.executable,'-B','-c',code],OUT/'terminal',r,lambda *_:None,3)));t.start()
  os.write(master,b'terminal-line\n');t.join(8);assert not t.is_alive()
 os.close(master);r.close();assert result==[0];receipt(OUT/'terminal')
 # Failure in a forwarding sink after actual spawn: first failure survives
 # later stderr/child errors, while both streams still drain and parent waits.
 def broken(*_):raise RuntimeError('first sink error')
 code="import sys;print('ready',flush=True);v=sys.stdin.buffer.read();print('late stderr',file=sys.stderr,flush=True);raise SystemExit(7)"
 out=run_case('sink-error',code,emit=broken,terminal=True)
 assert json.loads((out/'first-terminal.json').read_text())['reason']=='first sink error'
 assert b'late stderr' in gzip.decompress((out/'controller.stderr.gz').read_bytes())
 # EOF after spawn closes the child pipe, drains final diagnostics, and
 # discards an unterminated pending command without forwarding it.
 marker=OUT/'eof-received'
 code="import sys,pathlib;v=sys.stdin.buffer.read();pathlib.Path("+repr(str(marker))+").write_bytes(v);print('eof out');print('eof err',file=sys.stderr)"
 def close_input(wr):
  time.sleep(.05);os.write(wr,b'partial-capture');time.sleep(.05);os.close(wr)
 out=run_case('postspawn-eof',code,close_input,terminal=True)
 assert marker.read_bytes()==b''
 assert json.loads((out/'first-terminal.json').read_text())['reason']=='controller stdin EOF'
 # A child that ignores EOF must still be killed and actually waited at
 # the local cap. The original sink failure must survive that escalation.
 r,wr=livepipe()
 with patch('subprocess.Popen',spawn):
  assert m['control']([sys.executable,'-B','-c','import time;print("alive",flush=True);time.sleep(30)'],OUT/'forced-wait',r,broken,.05)==1
 os.close(wr);r.close();v=receipt(OUT/'forced-wait')
 assert v['forced'] and v['status']==-signal.SIGKILL
 assert json.loads((OUT/'forced-wait/first-terminal.json').read_text())['reason']=='first sink error'
 # Registration failure after Popen also reaches finally and actual wait.
 original=selectors.EpollSelector.register
 def register(self,fileobj,*args,**kw):
  if getattr(fileobj,'name',None) not in (None,) and isinstance(getattr(fileobj,'name',None),int):
   # stdin fd was registered before spawn; fail only output registration.
   if processes and fileobj is processes[-1].stdout:raise RuntimeError('postspawn registration')
  return original(self,fileobj,*args,**kw)
 r,wr=livepipe()
 with patch.object(selectors.EpollSelector,'register',register),patch('subprocess.Popen',spawn):
  assert m['control']([sys.executable,'-B','-c','import sys;sys.stdin.buffer.read();print("drained")'],OUT/'postspawn',r,lambda *_:None,3)==1
 os.close(wr);r.close();receipt(OUT/'postspawn')
 assert 'postspawn registration' in (OUT/'postspawn/first-terminal.json').read_text()
 # The retained 1705 original launch BODY executes unchanged, with the real
 # retained launch/command AST and owning Session. No import of its allocation
 # control module; only outer transport/native prerequisites are test seams.
 harness=OUT/'retained-offline.py'
 harness.write_text('''import ast,gzip,hashlib,json,os,runpy,subprocess,sys,threading,time,types
from pathlib import Path
ROOT=Path('''+repr(str(ROOT))+''');R=Path(__file__).parent/'retained-records';R.mkdir();phasebase=R/'original';phasebase.mkdir()
source=Path('''+repr(str(CALLER))+''')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='''+repr(hashlib.sha256(CALLER.read_bytes()).hexdigest())+'''
owner=runpy.run_path(str(ROOT/'tools/q3-native-launch-client.py'))
H=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):
 (R/(n+'.json')).write_text(json.dumps(v))
def transport(code,timeout):
 if 'PRELAUNCH_ACTUAL_WAIT' in code:
  (R/'actual-retained-launch-code.sha256').write_text(H(code.encode()))
  return [sys.executable,'-B','-c','import time;time.sleep(30)']
 if 't.request(out,c.id,c,55000)' in code:
  with (R/'actual-command-transport').open('a') as f:f.write(code+'\\n')
  return [sys.executable,'-B','-c','import json;print(json.dumps(dict(exitCode=1,stdout="OFFLINE first command refusal")))']
 # The real cancellation binding is retained, but never executes Boat.
 return [sys.executable,'-B','-c','import json;print(json.dumps(dict(exitCode=0,stdout="{}")))']
def factory(evidence,*_):return owner['Session'](evidence,transport)
m=types.SimpleNamespace(compose_task=owner['compose_task'],Session=factory)
C=dict(validate=lambda:True,box=lambda:(_ for _ in ()).throw(AssertionError('NO BOX')))
phase='original';BASE=R;REMOTE=str(ROOT);out=str(R/'runtime');phaseRun=str(R.relative_to(ROOT))
def load(n):return dict(passed=True)
def remote(*_):raise RuntimeError('OFFLINE independent remote proof unavailable')
fn=next(n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='launch')
exec(compile(ast.Module(body=[fn],type_ignores=[]),str(source),'exec'),globals())
try:launch()
except BaseException as e:
 save('harness-terminal',dict(error=str(e),nativeQualified=False))
 raise SystemExit(1)
''')
 r,wr=livepipe();out=OUT/'actual-retained-controller';result=[];errors=[]
 def retained():
  try:
   p=spawn([sys.executable,'-B',str(MODULE),'--caller',str(harness),'--caller-sha256',hashlib.sha256(harness.read_bytes()).hexdigest(),'--evidence',str(out)],stdin=r,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   so,se=p.communicate(timeout=15);result.append(p.returncode)
   (OUT/'actual-retained-cli-wait.json').write_text(json.dumps(dict(status=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=so.decode(),stderr=se.decode())))
  except BaseException as e:errors.append(repr(e))
 with patch('subprocess.Popen',spawn):
  t=threading.Thread(target=retained);t.start()
  records=OUT/'retained-records'
  until(lambda:(records/'actual-retained-launch-code.sha256').exists())
  # Both complete commands arrive in one read. Retained first failure must
  # prevent the later capture from reaching even the requested-command save.
  os.write(wr,b'{"command":{"id":"first","action":"key","key":"ArrowDown"}}\n{"command":{"id":"later_capture","action":"capture"}}\n')
  t.join(15);assert not t.is_alive()
 os.close(wr);r.close();assert not errors,errors
 assert result==[1];receipt(out)
 joined=json.loads((records/'original-local-joined.json').read_text())
 assert joined['launcherJoined'] and joined['terminal'] and not joined['completed']
 assert joined['terminal']['reason']=='remote result UNKNOWN: command-first',joined
 assert all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] for v in joined['receipts'])
 assert (records/'original-requested-first.json').exists()
 assert not (records/'original-requested-later_capture.json').exists()
 assert not list(records.rglob('*.png'))
 # This fixture's save seam is plain JSON; the retained sticky marker uses its
 # original .gz existence check, then is written through that explicit seam.
 assert json.loads((records/'actual-first-terminal.json').read_text())['noLaterGuestInputCaptureRetry']
 print('PASS actual retained original launch + real Session + actual retained command branch; sticky firstfailure no later capture',flush=True)
 (OUT/'result.json').write_text(json.dumps(dict(passed=True,actualRetainedCaller=True,caller=str(CALLER.relative_to(ROOT)),callerSHA256=hashlib.sha256(CALLER.read_bytes()).hexdigest(),fullCallerImport=True,nativeQualified=False,box='NOT_CREATED',remoteCustody='UNKNOWN')))
finally:
 for p in processes:
  if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
  p.wait(timeout=5)
  for stream in (p.stdin,p.stdout,p.stderr):
   if stream and not stream.closed:stream.close()
 (watch/'done').touch();so,se=w.communicate(timeout=5)
 (watch/'actual-wait.json').write_text(json.dumps(dict(status=w.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
 assert not json.loads((watch/'terminal').read_text())['fired']
print('PASS independent watchdog joined; no native runtime',flush=True)
