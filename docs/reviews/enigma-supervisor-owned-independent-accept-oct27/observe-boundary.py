"""Observe unchanged reproducer failure without modifying its execution or assertions."""
import admin as a
import runpy,traceback,sys
try:
 runpy.run_path(str(a.O/'inherited-alternate-listener.py'),run_name='__main__')
except BaseException as ex:
 tb=ex.__traceback__;scope=None
 while tb:
  if tb.tb_frame.f_code.co_filename==str(a.O/'inherited-alternate-listener.py'):scope=tb.tb_frame.f_globals
  tb=tb.tb_next
 observed=dict(exception=type(ex).__name__,message=str(ex),traceback=traceback.format_exc(),candidate=a.CANDIDATE,classification='REQUIRED_ORIGINAL_LIVE_PREREQUISITE_UNREACHABLE_NOT_COMPETITOR_ACCEPTANCE')
 if scope:
  fake=scope.get('fake');first=scope.get('first');idle=scope.get('idle')
  observed.update(commands=fake.commands,events=fake.events,batch=fake.batch,firstExit=first.poll() if first else None,secondStarted=scope.get('second') is not None,phaseExists=scope['phase'].exists(),config=scope.get('c1'),idleExit=idle.poll())
  if first:
   out,err=first.communicate(timeout=1);observed.update(firstStdout=out.decode(),firstStderr=err.decode())
 a.save('unchanged-boundary-outcome.json',observed)
 a.save('checkpoint.json',dict(candidate=a.CANDIDATE,status='BLOCKED_AT_MANDATORY_UNCHANGED_FIRST_BOUNDARY',evidence='unchanged-boundary-outcome.json',remaining=['Original-live unchanged alternate-listener gate','Independent new supervisor CLI challenges','Separately admitted real runtime'],productionDefectEstablished=False))
 print(observed['classification']);print(observed['traceback'])
 raise SystemExit(1)
