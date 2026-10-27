"""Independent actual-CLI challenge: one live original state, alternate inherited FD.

Both sockets are constructed by the same original HTTP-serving process and
both handlers reference the exact same FakeProduction state. The alternate
PID only sleeps with an inherited socket FD; it does not serve HTTP or own an
independent guest. No production code, prior evidence, or registry is changed.
"""
import sys, os, json, pathlib, subprocess, threading, time, importlib.util, hashlib
sys.dont_write_bytecode=True
import admin as a
spec=importlib.util.spec_from_file_location('offline_fixture',a.R/'test/fixtures/enigma-controller/test_controller.py')
f=importlib.util.module_from_spec(spec); spec.loader.exec_module(f)
TOOL=a.R/'tools/enigma-frozen-gameplay-controller.py'
def cli(p): return subprocess.Popen([sys.executable,str(TOOL),'--config',str(p)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def finish(p):
 out,err=p.communicate(timeout=10)
 return dict(exit=p.returncode,stdout=out.decode(),stderr=err.decode())
def claim(c):
 identity=dict(boot=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),pid_namespace=os.stat('/proc/self/ns/pid').st_ino,pid=c['pid'],start_ticks=str(c['process_start_ticks']))
 return pathlib.Path('/tmp')/f'enigma-frozen-controller-{os.getuid()}'/(hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()+'.jsonl')
with f.FakeProduction(real_delay=True) as fake:
 original_pid=os.getpid(); original_ticks=f.ctl.process_identity(original_pid)
 # Reuse the actual handler CLASS/closure, not a second FakeProduction object.
 alias=type(fake.server)(('127.0.0.1',0),fake.server.RequestHandlerClass)
 alias_thread=threading.Thread(target=alias.serve_forever,kwargs={'poll_interval':.01},daemon=True)
 idle=subprocess.Popen([sys.executable,'-S','-c','import time; time.sleep(120)'],pass_fds=(alias.fileno(),),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 alias_thread.start(); first=None; second=None
 try:
  for name in ('inherited-original','inherited-competitor'): (a.O/name).mkdir()
  c1=fake.config(a.O/'inherited-original',pid=original_pid,process_start_ticks=original_ticks,checkpoint_batches=1,request_timeout=.2,review_seconds=10,decision_path=str(a.O/'inherited-not-reviewed.json'))
  p1=a.O/'inherited-original/config.json';p1.write_text(json.dumps(c1,indent=2)+'\n')
  original_socket=os.readlink('/proc/self/fd/'+str(fake.server.fileno()))
  alias_socket=os.readlink('/proc/self/fd/'+str(alias.fileno()))
  idle_fds={p.name:os.readlink(p) for p in pathlib.Path(f'/proc/{idle.pid}/fd').iterdir()}
  assert alias_socket in idle_fds.values() and original_socket not in idle_fds.values()
  first=cli(p1)
  phase=pathlib.Path(c1['evidence_dir'])/'phase.json';end=time.monotonic()+5
  while not phase.exists() and first.poll() is None and time.monotonic()<end:time.sleep(.005)
  assert phase.exists() and first.poll() is None,'original actual owner must be live at review'
  original_claim=claim(c1); original_claim_bytes=original_claim.read_bytes()
  c2=dict(c1,url=f'http://127.0.0.1:{alias.server_port}/ctl',pid=idle.pid,process_start_ticks=f.ctl.process_identity(idle.pid),evidence_dir=str(a.O/'inherited-competitor/evidence'),review_seconds=0)
  p2=a.O/'inherited-competitor/config.json';p2.write_text(json.dumps(c2,indent=2)+'\n')
  competing_claim=claim(c2);assert not competing_claim.exists()
  before=len(fake.commands); before_events=len(fake.events); before_batch=fake.batch
  second=cli(p2); second_result=finish(second)
  appended=fake.commands[before:]; first_live=first.poll() is None
  original_claim_unchanged=original_claim.read_bytes()==original_claim_bytes
  competitor_claim_exists=competing_claim.exists()
  a.save('inherited-wire.json',dict(beforeCommands=before,commands=fake.commands,events=fake.events,competingCommands=appended,competingEvents=fake.events[before_events:],beforeBatch=before_batch,afterBatch=fake.batch))
  (a.O/'inherited-original-claim.jsonl').write_bytes(original_claim.read_bytes())
  if competitor_claim_exists:(a.O/'inherited-competitor-claim.jsonl').write_bytes(competing_claim.read_bytes())
  observed=dict(verdict='PASS_REFUSAL' if not appended and second_result['exit']==1 and not competitor_claim_exists else 'REJECT_INHERITED_ALTERNATE_LISTENER_RENEWS_ORIGINAL_AUTHORITY',expected=dict(exit=1,HTTP=0,newProcessClaim=False),actual=dict(second=second_result,HTTP=len(appended),commands=appended,newProcessClaim=competitor_claim_exists,evidenceCreated=pathlib.Path(c2['evidence_dir']).exists()),original=dict(pid=original_pid,startTicks=original_ticks,url=c1['url'],socket=original_socket,alternateSocket=alias_socket,liveBeforeAndAfterCompetition=first_live,claimUnchanged=original_claim_unchanged),unrelatedInheritedHolder=dict(pid=idle.pid,startTicks=c2['process_start_ticks'],fdLinks=idle_fds,url=c2['url'],doesNotServeHTTP=True),sameState=True,sharedHandlerClass=alias.RequestHandlerClass is fake.server.RequestHandlerClass,unchangedAuthority={k:c1[k]==c2[k] for k in ('started_at','deadline_at','max_batches','terminal_path','supervisor_limits')},implementationUnmodified=True,persistentStateCleared=False,productionCLI=[sys.executable,str(TOOL),'--config',str(p2)])
  # End original only after recording competition; this terminal is cleanup,
  # not a new aggregate allowance or an ownership reset.
  pathlib.Path(c1['terminal_path']).write_text('{"test":"stop original after independent observation"}\n')
  observed['first']=finish(first)
  a.save('inherited-identity-outcome.json',observed)
  assert not appended and second_result['exit']==1 and not competitor_claim_exists,observed
  assert first_live and original_claim_unchanged,observed
  print('PASS inherited alternate listener refused without HTTP/new claim')
 finally:
  for p in (first,second):
   if p is not None and p.poll() is None:p.kill();p.communicate(timeout=5)
  idle.terminate();idle.wait(timeout=5)
  alias.shutdown();alias.server_close();alias_thread.join(timeout=5)
