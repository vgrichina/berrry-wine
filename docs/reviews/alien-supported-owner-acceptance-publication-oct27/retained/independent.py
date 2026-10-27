"""Independent assertions around the exact production CLI, offline protocol only."""
import sys,os,json,time,hashlib,subprocess,importlib.util,socket,signal
from pathlib import Path
sys.dont_write_bytecode=True
import manage as a
GROUP=sys.argv[1]
sys.argv=[sys.argv[0],str(a.O/('new-'+GROUP))]
spec=importlib.util.spec_from_file_location('production_fixture',a.R/'test/fixtures/alien-menu-controller/test_supervised.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
c=f.Supervised('test_positive_original_and_live_competitors');c.setUp()
def read(p):return json.loads(p.read_text())
def seal(h):
 names=['budget.json','admitted-budget.json','approval.json','menu-frame.json','delegation.json','owner.json','usage.json','sequence-ledger.json','startup-ledger.json','command.json']
 return {n:(h/n).read_bytes().hex() for n in names if (h/n).exists()}
def claims():
 registry=Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()))
 return {str(p):a.sha(p) for p in registry.glob('*.json')}
def competing(endpoint,h,pid,label):
 d=c.base/label;d.mkdir()
 for n,v in [('budget.json',dict(runId='replacement',startedAt=time.time(),deadline=time.time()+120,captureLimit=999,capturesUsed=0)),('process.json',dict(pid=pid,endpoint=endpoint,startTicks=Path('/proc/%d/stat'%pid).read_text().rsplit(') ',1)[1].split()[19]))]:
  (d/n).write_text(json.dumps(v))
 argv=[sys.executable,str(f.LEGACY),'--invocation',str(d),'--endpoint',endpoint,'--terminal-file',str(d/'terminal.json'),'--after-batches','1','--approve-new-game']
 before=claims();state=seal(h);wire=c.wire(h)
 r=subprocess.run(argv,capture_output=True,text=True,timeout=5)
 assert r.returncode==1 and 'attachment retired' in r.stdout,(r.stdout,r.stderr)
 assert claims()==before and seal(h)==state and c.wire(h)==wire
 assert not any((d/n).exists() for n in ('owner.json','admitted-budget.json','delegation.json','usage.json','terminal.json'))
 evidence=dict(argv=argv,exit=r.returncode,stdout=r.stdout,stderr=r.stderr,newClaim=False,HTTP=0,originalStateUnchanged=True,originalWire=wire)
 (d/'independent-result.json').write_text(json.dumps(evidence,indent=2));return evidence
sentinel=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(110)'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
sentinel_start=Path('/proc/%d/stat'%sentinel.pid).read_text().rsplit(') ',1)[1].split()[19]
result={}
try:
 if GROUP=='live':
  p,h,e=c.start('hold',approve=False,extra=['--startup-batches','0','--captures-used','4'])
  f.wait_file(h/'menu-frame.json',p)
  frame=read(h/'menu-frame.json');command=read(h/'command.json');ready=read(h/'ready.json')
  assert frame['path']==str(h/'menu-before.png') and frame['sha256']==a.sha(h/'menu-before.png')
  assert frame['runId']==command['runId'] and frame['batch']==4722
  (h/'approval.json').write_text(json.dumps(dict(runId=frame['runId'],batch=frame['batch'],frameSHA256=frame['sha256'],humanReviewed=True,reviewId='independent-protocol-review',action='New Game',command='click:98:296')))
  f.wait_file(h/'input-pending',p)
  links={x.name:os.readlink(x) for x in Path('/proc/%d/fd'%ready['idlePID']).iterdir()}
  alt=os.readlink('/proc/%d/fd/%d'%(ready['serverPID'],ready['alternateFD']))
  primary=os.readlink('/proc/%d/fd/%d'%(ready['serverPID'],ready['primaryFD']))
  assert alt in links.values() and primary not in links.values()
  state=seal(h);assert not (h/'terminal.json').exists() and p.poll() is None
  first=competing(e,h,ready['serverPID'],'same-endpoint')
  alternate='http://127.0.0.1:%d/ctl'%ready['alternatePort']
  second=competing(alternate,h,ready['idlePID'],'inherited-alternate')
  # A second actual supervisor cannot attach to the existing primary listener.
  argv=list(p.args);idx=argv.index('--invocation')+1;new=c.base/'second-supervisor';argv[idx]=str(new)
  r=subprocess.run(argv,capture_output=True,text=True,timeout=5)
  assert r.returncode==1 and not new.exists() and seal(h)==state and p.poll() is None
  assert not (h/'terminal.json').exists()
  a.save('live-observation.json',dict(originalSupervisorPID=p.pid,originalChildPID=ready['serverPID'],originalStartTicks=Path('/proc/%d/stat'%ready['serverPID']).read_text().rsplit(') ',1)[1].split()[19],originalLive=True,originalState=state,childOwnsEndpoint=True,sameHandlerClosure='pinned child_server.py Handler class used by both sockets',inheritedOnlyAlternate=links,primarySocket=primary,alternateSocket=alt,competitors=[first,second],secondSupervisor=dict(argv=argv,exit=r.returncode,stdout=r.stdout,stderr=r.stderr),HTTPBefore=c.wire(h)))
  (h/'release-input').touch();final=c.finish(p,h)
  commands=c.commands(h)
  assert commands[:4]==[dict(action='snapshot'),dict(action='png',path=str(h/'menu-before.png')),dict(action='snapshot'),dict(cmd='click:98:296')]
  assert [x['n'] for x in commands if x.get('action')=='step']==[128,128]
  assert sum(x.get('action')=='png' for x in commands)==4 and commands[-1]==dict(action='quit')
  assert final['capturesCharged']==8 and read(h/'cleanup.json')['remainingOwnedLive']==[]
  # Existing invocation remains terminal even if a fresh child command is supplied.
  terminal=(h/'terminal.json').read_bytes();wire=c.wire(h)
  r=subprocess.run(p.args,capture_output=True,text=True,timeout=5)
  assert r.returncode==1 and (h/'terminal.json').read_bytes()==terminal and c.wire(h)==wire
  result=dict(verdict='PASS',simulatedProtocolOnly=True,final=final,commands=commands,terminalReopen=dict(exit=r.returncode,stdout=r.stdout),realChildIdentity=command)
 elif GROUP=='uncertain':
  p,h,e=c.start('uncertain');c.finish(p,h,1)
  assert c.commands(h)==[dict(action='snapshot'),dict(cmd='click:98:296')]
  ledger=read(h/'sequence-ledger.json');assert ledger['status']=='terminal' and ledger['pending']['command']==dict(cmd='click:98:296')
  # No surviving child endpoint; public attachment still must not create claims.
  before=claims();r=subprocess.run([sys.executable,str(f.LEGACY),'--invocation',str(c.base/'reconnect'),'--endpoint',e],capture_output=True,text=True,timeout=5)
  assert r.returncode==1 and claims()==before and not (c.base/'reconnect').exists()
  result=dict(verdict='PASS',pending=ledger['pending'],commands=c.commands(h),cleanup=read(h/'cleanup.json'),noReconnect=True)
 elif GROUP=='timeout':
  # Fixture-only delta: withhold the input ACK beyond the production HTTP
  # timeout. The production CLI, transport and supervision remain byte-exact.
  source=a.R/'test/fixtures/alien-menu-controller/child_server.py'
  raw=source.read_text();needle="            if mode == 'uncertain':\n"
  assert raw.count(needle)==1
  directory=a.O/'timeout-child';directory.mkdir()
  changed=raw.replace(needle,"            if mode == 'timeout':\n                time.sleep(22)\n"+needle)
  fixture=directory/'child_server.py';fixture.write_text(changed)
  a.save('timeout-fixture-delta.json',dict(original=str(source),originalSHA=a.sha(source),new=str(fixture),newSHA=a.sha(fixture),delta="Insert if mode == 'timeout': time.sleep(22) before uncertain-input branch; no other changes"))
  f.FIX=directory
  p,h,e=c.start('timeout')
  started=time.monotonic();out,err=p.communicate(timeout=26)
  (c.base/'timeout-cli.json').write_text(json.dumps(dict(argv=p.args,exit=p.returncode,stdout=out,stderr=err)))
  assert p.returncode==1,(out,err)
  ledger=read(h/'sequence-ledger.json')
  assert ledger['status']=='terminal' and ledger['pending']['command']==dict(cmd='click:98:296')
  assert c.commands(h)==[dict(action='snapshot'),dict(cmd='click:98:296')]
  cleanup=read(h/'cleanup.json');assert cleanup['remainingOwnedLive']==[]
  assert (h/'terminal.json').exists() and read(h/'delegation.json')['consumed']
  before=c.wire(h);r=subprocess.run([sys.executable,str(f.LEGACY),'--invocation',str(c.base/'reconnect'),'--endpoint',e],capture_output=True,text=True,timeout=5)
  assert r.returncode==1 and c.wire(h)==before and not (c.base/'reconnect').exists()
  result=dict(verdict='PASS',actualHTTPTimeout=True,elapsed=time.monotonic()-started,stdout=out,stderr=err,pending=ledger['pending'],commands=c.commands(h),cleanup=cleanup,noReplayOrReconnect=True)
 elif GROUP=='new-and-death':
  p,h,e=c.start(name='new-legitimate');c.finish(p,h)
  new=read(h/'command.json');old=read(a.O/'new-live/test_positive_original_and_live_competitors/original/command.json')
  assert new['runId']!=old['runId'] and new['pid']!=old['pid']
  assert c.commands(h)[-1]==dict(action='quit')
  p,h,e=c.start('hold',name='death',approve=False)
  child=read(h/'command.json');ready=read(h/'ready.json')
  assert child['pid']==ready['serverPID']
  os.kill(child['pid'],signal.SIGKILL)
  c.finish(p,h,1)
  assert c.commands(h)==[] and read(h/'cleanup.json')['remainingOwnedLive']==[]
  result=dict(verdict='PASS',distinctLegitimateGuests=[old,new],childDeathBeforeReviewHTTP=0,cleanup=read(h/'cleanup.json'))
 else:raise AssertionError(GROUP)
 assert sentinel.poll() is None and Path('/proc/%d/stat'%sentinel.pid).read_text().rsplit(') ',1)[1].split()[19]==sentinel_start
 result['unrelatedSentinelPreserved']=dict(pid=sentinel.pid,startTicks=sentinel_start)
 a.save(GROUP+'-result.json',result)
 print('PASS independent '+GROUP)
finally:
 c.doCleanups()
 if sentinel.poll() is None:sentinel.terminate()
 sentinel.wait(timeout=5)
