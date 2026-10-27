"""Independent actual Alien CLI: same handler/state, inherited alternate FD.
Only the original test fixture's input-ACK hold is extended to leave enough
observation time. Production budget/clock/terminal and all source stay unchanged.
"""
import os,sys,json,time,threading,subprocess,importlib.util,http.server
from pathlib import Path
sys.dont_write_bytecode=True
import manage as a
sys.argv=[sys.argv[0],str(a.O/'fixture')]
spec=importlib.util.spec_from_file_location('offline',a.R/'test/fixtures/alien-menu-controller/test_controller.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
case=f.Case('test_approved_menu_action_then_reserved_evidence_and_quit');case.setUp()
class Hold:
 def __init__(self):self.event=threading.Event()
 def wait(self,unused):return self.event.wait(30)
 def set(self):self.event.set()
case.resume=Hold();case.mode='live-owner'
alias=http.server.HTTPServer(('127.0.0.1',0),case.server.RequestHandlerClass)
thread=threading.Thread(target=alias.serve_forever,kwargs={'poll_interval':.01},daemon=True);thread.start()
idle=subprocess.Popen([sys.executable,'-S','-c','import time; time.sleep(110)'],pass_fds=(alias.fileno(),),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def ticks(pid):return Path('/proc/%d/stat'%pid).read_text().rsplit(') ',1)[1].split()[19]
def claim(pid):
 identity=dict(bootId=Path('/proc/sys/kernel/random/boot_id').read_text().strip(),pidNamespace=os.readlink('/proc/%d/ns/pid'%pid),pid=pid,startTicks=ticks(pid))
 data=json.dumps(identity,sort_keys=True,separators=(',',':')).encode()
 return Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()))/(a.hashlib.sha256(data).hexdigest()+'.json')
def finish(p,record):
 out,err=p.communicate(timeout=12);record.update(returncode=p.returncode,stdout=out,stderr=err);return record
first=second=None;original=case.home
try:
 orig_socket=os.readlink('/proc/self/fd/'+str(case.server.fileno()));alt_socket=os.readlink('/proc/self/fd/'+str(alias.fileno()))
 inherited={p.name:os.readlink(p) for p in Path('/proc/%d/fd'%idle.pid).iterdir()}
 assert alt_socket in inherited.values() and orig_socket not in inherited.values()
 assert case.server.RequestHandlerClass is alias.RequestHandlerClass
 first,r1=case.run_cli(background=True)
 assert case.input_arrived.wait(8) and first.poll() is None,'original must be live at pending input ACK'
 original_claim=claim(os.getpid());claim_bytes=original_claim.read_bytes()
 original_files={n:(original/n).read_bytes() for n in ('budget.json','approval.json','menu-frame.json','process.json')}
 before=len(case.requests);before_batch=case.batch
 endpoint='http://127.0.0.1:%d/ctl'%alias.server_port
 case.home=a.O/'competitor';case.home.mkdir()
 competitor_claim=claim(idle.pid);assert not competitor_claim.exists()
 # Both sockets use the SAME original handler closure. Only release the alias
 # handler from the fixture's input hold; primary is already waiting on Hold.
 case.mode=''
 second,r2=case.run_cli(background=True,endpoint=endpoint,process=dict(pid=idle.pid,startTicks=ticks(idle.pid),endpoint=endpoint))
 second_result=finish(second,r2);appended=case.requests[before:]
 original_live=first.poll() is None;claim_unchanged=original_claim.read_bytes()==claim_bytes
 new_claim=competitor_claim.exists()
 a.save('inherited-wire.json',dict(beforeCommands=before,beforeBatch=before_batch,afterBatch=case.batch,requests=case.requests,competingRequests=appended))
 (a.O/'original-claim.json').write_bytes(claim_bytes)
 if new_claim:(a.O/'competitor-claim.json').write_bytes(competitor_claim.read_bytes())
 outcome=dict(verdict='PASS_REFUSAL' if second.returncode==1 and not appended and not new_claim else 'REJECT_INHERITED_ALTERNATE_LISTENER_RENEWS_ORIGINAL_AUTHORITY',expected=dict(exit=1,HTTP=0,newClaim=False),actual=dict(second=second_result,HTTP=len(appended),newClaim=new_claim),original=dict(pid=os.getpid(),startTicks=ticks(os.getpid()),socket=orig_socket,alternateSocket=alt_socket,liveBeforeAndAfterCompetition=original_live,claimUnchanged=claim_unchanged,claimPath=str(original_claim)),inheritedHolder=dict(pid=idle.pid,startTicks=ticks(idle.pid),fdLinks=inherited,claimPath=str(competitor_claim),doesNotServeHTTP=True),sameHandlerClosure=True,sameState=True,authorityUnchanged={n:(case.home/n).read_bytes()==original_files[n] for n in ('budget.json','approval.json','menu-frame.json')},terminalUnchanged=not case.terminal.exists(),originalConfigUnchanged=all((original/n).read_bytes()==v for n,v in original_files.items()),originalInvocation=str(original),competingInvocation=str(case.home),implementationUnmodified=True,persistentRegistryCleared=False,argvOriginal=r1['argv'],argvCompetitor=r2['argv'])
 assert original_live and claim_unchanged and outcome['terminalUnchanged'] and all(outcome['authorityUnchanged'].values()) and outcome['originalConfigUnchanged']
 a.save('inherited-identity-outcome.json',outcome)
 # Cleanup after evidence snapshot, without modifying the original terminal.
 case.resume.set();outcome['originalAfterObservationCleanup']=finish(first,r1)
 a.save('inherited-identity-outcome.json',outcome)
 assert outcome['verdict']=='PASS_REFUSAL',outcome
 print('PASS inherited alternate FD refused before HTTP/new claim')
finally:
 case.resume.set()
 for p in (first,second):
  if p is not None and p.poll() is None:p.kill();p.communicate(timeout=5)
 idle.terminate();idle.wait(timeout=5)
 alias.shutdown();alias.server_close();thread.join(timeout=5)
 case.home=original;case.doCleanups()
