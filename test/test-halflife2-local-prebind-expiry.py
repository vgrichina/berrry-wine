#!/usr/bin/env python3
"""Real caller/listener regression: local refusal alone permits a new review.

Authored fixture only; never selects an original installer's controls.
"""
import importlib.util,json,os,pathlib,subprocess,sys,time,hashlib
ROOT=pathlib.Path(__file__).resolve().parent.parent

def load(name):
 s=importlib.util.spec_from_file_location('prebind_'+name.replace('-','_'),ROOT/'tools'/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def main(out,pin,case):
 out=pathlib.Path(out).resolve();out.mkdir(parents=True,exist_ok=False)
 run=out/case;read=lambda n:json.loads((run/n).read_text())
 fixture=ROOT/'scratch/runs/20261117-halflife2-age-page-native-input-latency/age-dialog.exe'
 env=dict(os.environ,HL2_TASK_RUN=str(out.parent),HL2_RUN=str(run),HL2_RESTORED_PIN=pin,
  HL2_WORKING_AUTHORED='1',HL2_INPUT_LATENCY_TRACE='1',HL2_LIFECYCLE_TRACE='1',
  WINE_PUBLIC_INPUT_TRACE=str(run/'public-input.jsonl'),HL2_EDIT_LAYOUT_REPAIR='1',
  HL2_RETAINED_LAYOUT_REPAIR=str(ROOT/'scratch/runs/20261117-halflife2-agreement-capture-delay-cause/fixture'),
  HL2_AUTHORED_FIXTURE=str(fixture),HL2_AUTHORED_FIXTURE_SHA256=hashlib.sha256(fixture.read_bytes()).hexdigest())
 p=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/halflife2-restored-native.py'),'--supervised'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 m=load('halflife2-restored-native.py');results=[]
 def ctl(args,expected=0,command=None):
  rc=m.supervise_controller(run,args,command);assert rc==expected,(args,rc,expected)
  results.append(dict(args=args,rc=rc));return rc
 def review(scene,label,kind='install'):
  snap=read(scene+'.json')['snapshot']
  b=next(w for w in snap['windows'] if w['live'] and w['visible'] and w['title']==label)
  xy=[str(b['screenX']+10),str(b['screenY']+10)]
  ctl(['review',scene,'Authored complete-image protocol test; no personal original review claim',label,kind,b['hwnd'],*xy])
  return xy
 def step(scene,label,name,kind='install'):
  ctl(['capture',scene]);xy=review(scene,label,kind)
  ctl(['intent',name,scene,*xy,kind])
 try:
  end=time.monotonic()+60
  while not (run/'native-pid.json').exists():
   assert p.poll() is None and time.monotonic()<end;time.sleep(.02)
  os.environ.update(DELPHI5_RUN=str(run),DELPHI5_PORT=str(read('launch.json')['rootPort']))
  # Fully published launch receipt, then an actual exclusive listener check.
  h=load('vb5cce-reviewed-control.py')
  while True:
   try:identity=h.identity();break
   except (AssertionError,FileNotFoundError):
    assert p.poll() is None and time.monotonic()<end;time.sleep(.02)
  (run/'exclusive-listener-ready.json').write_text(json.dumps(dict(identity=identity,at=time.time(),beforeFirstController=True)))
  ctl(['startup']);ctl(['capture','initial']);xy=review('initial','Next >')
  # Actual wall time; never alter captured timestamps or freshness limits.
  delay=max(0,read('initial.json')['at']+30.1-time.time())
  (run/'review-delay.json').write_text(json.dumps(dict(startedAt=time.time(),seconds=delay)))
  time.sleep(delay)
  if case=='changedowner':
   v=read('initial.json');v['target']=dict(v['target'],startToken='wrong')
   (run/'initial.json').write_text(json.dumps(v))
  elif case=='ambiguous':
   journal=run/'prebind-transport.jsonl';rows=[json.loads(v) for v in journal.read_text().splitlines()]
   rows[-1]['token']='unrelated-completion'
   journal.write_text(''.join(json.dumps(v)+'\n' for v in rows))
  elif case=='inflight':
   with (run/'prebind-transport.jsonl').open('a') as f:f.write(json.dumps(dict(token='unsettled',phase='started',action='native-reviewed-capture'))+'\n')
  elif case=='incomplete':
   v=read('initial-review.json');v['rawCompleteScene']=False
   (run/'initial-review.json').write_text(json.dumps(v))
  elif case=='sideeffect':(run/'prior-release-arm.json').write_text('{}')
  if case in ('positive','positive-quit','transport','realUNKNOWN'):
   ctl(['bind','initial'],75)
   assert not (run/'PERMANENT-UNKNOWN.json').exists() and not (run/'bind-intent.json').exists()
   requests=(run/'requests.jsonl').read_bytes()
   assert not any(json.loads(v)['action'].startswith('guarded-') for v in requests.splitlines())
   if case=='transport':
    # Lose the actual native capture response at the caller boundary. The
    # listener remains real/live, and the transport journal stays unfinished.
    rc=m.supervise_controller(run,['capture','new'],
      [sys.executable,'-B',__file__,'--lost-response','capture','new']);assert rc!=0
    assert (run/'new.png').exists() and not (run/'new.json').exists()
    assert 'authored lost actual capture response' in read('PERMANENT-UNKNOWN.json')['error']
   elif case=='positive-quit':
    ctl(['capture','new']);review('new','Cancel','quit');ctl(['bind','new'])
    # Also prove that ordinary post-bind captures no longer enter recovery.
    ctl(['capture','bound']);xy=review('bound','Cancel','quit')
    ctl(['intent','reviewed-cancel','bound',*xy,'quit'])
    assert read('reviewed-cancel-observation.json')['outcome']=='process-exited'
   elif case=='realUNKNOWN':
    ctl(['capture','new']);xy=review('new','Next >');ctl(['bind','new'])
    os.environ['HL2_TEST_TRANSPORT_PAUSE']='.55'
    try:
     rc=m.supervise_controller(run,['intent','late','new',*xy,'install'],
       [sys.executable,'-B',str(ROOT/'test/test-halflife2-age-input-latency.py'),'intent','late','new',*xy,'install'])
    finally:os.environ.pop('HL2_TEST_TRANSPORT_PAUSE',None)
    assert rc!=0
    assert read('late-down.json')['receipt']['reason']=='immutable deadline expired'
   else:
    ctl(['capture','new']);xy=review('new','Next >');ctl(['bind','new'])
    ctl(['intent','agreement-next','new',*xy,'install'])
    step('age','Next >','age-next')
    step('destination','Cancel','destination-cancel','quit')
    assert read('destination-cancel-observation.json')['outcome']=='process-exited'
    assert read('new.json')['captureId']!=read('initial.json')['captureId']
  else:
   rc=m.supervise_controller(run,['bind','initial']);assert rc!=0 and rc!=75
   errors=''.join(v.read_text() for v in run.glob('controller-supervision/bind-*/stderr.log'))
   anchor={'ambiguous':'inflight/ambiguous transport','inflight':'incomplete transport proof',
     'incomplete':"r['rawCompleteScene']",'changedowner':"rr['target']==m.identity()",'sideeffect':'prior binding, armed release or side effect'}[case]
   assert anchor in errors,errors
  if case not in ('positive','positive-quit'):
   assert (run/'PERMANENT-UNKNOWN.json').exists()
   before=(run/'requests.jsonl').read_bytes()
   try:m.supervise_controller(run,['capture','forbidden'])
   except AssertionError:pass
   else:raise AssertionError('UNKNOWN allowed recovery capture')
   assert before==(run/'requests.jsonl').read_bytes()
  (out/'proof.json').write_text(json.dumps(dict(passed=True,case=case,realCallerAndListener=True,realDelayedReview=True,operations=results),indent=2))
 finally:
  if p.poll() is None and not (run/'native-wait.json').exists():(run/'stop-native.json').write_text('{}')
  a,b=p.communicate(timeout=30)
  (out/'owner-wait.json').write_text(json.dumps(dict(pid=p.pid,returncode=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()),indent=2))
 print('PASS',case)

def lost_response(args):
 run=pathlib.Path(os.environ['DELPHI5_RUN']);assert (run/'authored-input.json').is_file()
 h=load('halflife2-reviewed-next.py');adapt=h.receipt_clock_body
 def modified(body):
  return adapt(body)+b'''
_prebind_real_call=call
def call(command,*args,**kwargs):
    result=_prebind_real_call(command,*args,**kwargs)
    if command.get('action')=='native-reviewed-capture':
        raise OSError('authored lost actual capture response')
    return result
'''
 h.receipt_clock_body=modified;sys.argv=['tools/halflife2-reviewed-next.py',*args]
 return h.controller()

if __name__=='__main__':
 if sys.argv[1]=='--lost-response':sys.exit(lost_response(sys.argv[2:]))
 main(*sys.argv[1:])
