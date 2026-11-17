#!/usr/bin/env python3
"""Real delayed startup, deadline, cancellation, drain and join regressions."""
import ctypes,importlib.util,json,os,pathlib,signal,subprocess,sys,time,types
ROOT=pathlib.Path(__file__).resolve().parent.parent
def load(name):
 s=importlib.util.spec_from_file_location('fixture_'+name.replace('-','_'),ROOT/'tools'/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def helper(run,case):
 r=pathlib.Path(run);start=time.monotonic();m=load('halflife2-reviewed-next.py')
 if case=='error':
  print('helper error',file=sys.stderr,flush=True);return 7
 if case in ('timeout','cancel'):
  signal.signal(signal.SIGTERM,signal.SIG_IGN)
  while True:
   with (r/'polls').open('a') as f:f.write('poll\n')
   time.sleep(.02)
 if case=='cancel-release':
  child=subprocess.Popen([sys.executable,'-c',"import time;time.sleep(.6);print('release EOF')"],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  def cancel(sig,frame):raise SystemExit(128+sig)
  signal.signal(signal.SIGTERM,cancel)
  (r/'release-armed').touch()
  try:time.sleep(30)
  finally:
   a,b=child.communicate(timeout=2)
   (r/'release-wait.json').write_text(json.dumps(dict(actualWait=True,stdoutEOF=True,stderrEOF=True,exit=child.returncode)))
  return 0
 def call(command,timeout):
  assert command==dict(action='native-startup-readiness') and 0<timeout<=1
  ready=case=='delayed' and time.monotonic()-start>=9
  return dict(contract='native-startup-readiness-v1',ready=ready,failures=[] if ready else ['main.visible'],
      snapshot=dict(mainHwnd='0x1',modalHwnd='0x0',focus='0x2',focusTopLevel='0x1'),ordinaryOwner={})
 def save(name,value):(r/name).write_text(json.dumps(value))
 model=types.SimpleNamespace(R=r,time=time,reserve=lambda:None,identity=lambda:{'same':'actor'},
     read=lambda n:json.loads((r/n).read_text()),call=call,save=save,PORT=123)
 try:m.startup(model)
 except BaseException as e:
  save('PERMANENT-UNKNOWN.json',dict(error=str(e),at=time.time(),noLaterRequests=True));return 1
 print('startup complete',flush=True);print('stderr drained',file=sys.stderr,flush=True)
 return 0
def supervise(run,case):
 m=load('halflife2-restored-native.py')
 return m.supervise_controller(run,['startup'],[sys.executable,'-B',__file__,'helper',run,case])
def main(out):
 out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=False)
 m=load('halflife2-restored-native.py')
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0 # reap the waiting owner after its parent dies
 assert m.controller_operation(['startup'])['innerSeconds']==15
 assert m.controller_operation(['capture','image'])['innerSeconds']==3
 assert m.controller_operation(['intent','next','image','20','30','install'])['innerSeconds']==3
 assert m.controller_operation(['review','image','personal review','Next >','install','0x1','20','30'])
 for args in ([],['startup','extra'],['intent','next','image','20','30'],['intent','next','image','20','30','game'],['capture']):
  try:m.controller_operation(args)
  except AssertionError:pass
  else:raise AssertionError(args)
 results=[]
 for case in ('delayed','unready','error','timeout','cancel','cancel-release','parent-death'):
  r=out/case;r.mkdir();(r/'launch.json').write_text(json.dumps(dict(rootPort=123,deadline=time.time()+90,gameplayCutoff=time.time()+60)))
  cmd=[sys.executable,'-B',__file__,'supervise',str(r),'cancel' if case=='parent-death' else case]
  if case=='parent-death':
   cmd=[sys.executable,'-c',"import subprocess,sys,time,pathlib; p=subprocess.Popen(sys.argv[2:]);pathlib.Path(sys.argv[1]).write_text(str(p.pid));time.sleep(60)",str(r/'owner-pid'),*cmd]
  p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  adopted=None
  if case.startswith('cancel') or case=='parent-death':
   end=time.monotonic()+10
   while not list(r.glob('controller-supervision/*/runtime-start.json')) or (case=='cancel-release' and not (r/'release-armed').exists()):
    assert time.monotonic()<end;time.sleep(.01)
   if case=='parent-death':p.kill()
   else:p.send_signal(signal.SIGTERM)
  a,b=p.communicate(timeout=35)
  if case=='parent-death':
   pid,status=os.waitpid(int((r/'owner-pid').read_text()),0)
   adopted=dict(pid=pid,actualWait=True,exit=os.waitstatus_to_exitcode(status))
  w=json.loads(next(r.glob('controller-supervision/*/wait.json')).read_text())
  assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'] and not w['remainingAfterRuntime'],w
  assert all(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'] and v['returncode']==0 for v in w['watchdogs']),w
  assert (p.returncode==0)==(case=='delayed'),(case,a,b,w)
  assert (r/'PERMANENT-UNKNOWN.json').exists()==(case!='delayed')
  if case=='delayed':
   ready=json.loads((r/'startup-ready.json').read_text());assert 8<ready['completedAt']-ready['startedAt']<15
  if case=='unready':assert not w['timedOut'] and 'startup readiness UNKNOWN' in json.loads((r/'PERMANENT-UNKNOWN.json').read_text())['error']
  if case=='timeout':assert w['timedOut']
  if case=='cancel-release':assert json.loads((r/'release-wait.json').read_text())['exit']==0
  if case=='parent-death':
   owner=json.loads(next(r.glob('controller-supervision/*/parent-process-owner.json')).read_text())
   assert owner['parentDeathObserved'] and adopted['exit']==143
  count=(r/'polls').read_bytes() if (r/'polls').exists() else None;time.sleep(.1)
  assert count==((r/'polls').read_bytes() if (r/'polls').exists() else None),'polling survived UNKNOWN'
  try:m.supervise_controller(r,['startup'],[sys.executable,'-c','raise Exception("must not spawn")']) if case!='delayed' else None
  except AssertionError:pass
  else:assert case=='delayed','UNKNOWN replay admitted'
  results.append(dict(case=case,outerActualWait=True,outerStdoutEOF=True,outerStderrEOF=True,adoptedOwnerWait=adopted,wait=w))
 (out/'proof.json').write_text(json.dumps(dict(passed=True,results=results),indent=2))
 print('PASS delayed 9s startup, unchanged 15s unready limit, errors, outer timeout, cancellation, independent release drain, actual waits/both EOF and terminal UNKNOWN')
if __name__=='__main__':
 if sys.argv[1]=='helper':sys.exit(helper(*sys.argv[2:]))
 if sys.argv[1]=='supervise':sys.exit(supervise(*sys.argv[2:]))
 main(sys.argv[1])
