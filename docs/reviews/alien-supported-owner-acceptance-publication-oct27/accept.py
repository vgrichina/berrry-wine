"""One corrected original-live alternate-listener challenge; production unchanged."""
import sys
sys.dont_write_bytecode=True
import os,json,time,hashlib,subprocess,importlib.util
from pathlib import Path
import manage as a
sys.argv=[sys.argv[0],str(a.O/'boundary')]
spec=importlib.util.spec_from_file_location('fixture',a.R/'test/fixtures/alien-menu-controller/test_supervised.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
c=f.Supervised('test_positive_original_and_live_competitors');c.setUp()
def read(p):return json.loads(p.read_text())
def state(h):
 return {n:(h/n).read_bytes().hex() for n in ('budget.json','admitted-budget.json','approval.json','menu-frame.json','delegation.json','owner.json','usage.json','sequence-ledger.json','startup-ledger.json','command.json') if (h/n).exists()}
def claims():
 return {str(p):a.sha(p) for p in Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid())).glob('*.json')}
def sockets(pid):
 return {x.name:os.readlink(x) for x in Path('/proc/%d/fd'%pid).iterdir()}
def finish(argv):
 r=subprocess.run(argv,capture_output=True,text=True,timeout=5)
 return dict(argv=argv,exit=r.returncode,stdout=r.stdout,stderr=r.stderr)
try:
 # Sole setup delta: production NEW CLI/Popen owns real Python child and
 # its two same-handler/state sockets, instead of retired attach original.
 p,h,endpoint=c.start('hold')
 f.wait_file(h/'input-pending',p)
 ready=read(h/'ready.json');original=read(h/'command.json')
 owner=sockets(ready['serverPID']);holder=sockets(ready['idlePID'])
 alt=owner[str(ready['alternateFD'])];primary=owner[str(ready['primaryFD'])]
 assert alt in holder.values() and primary not in holder.values()
 assert original['pid']==ready['serverPID'] and p.poll() is None and not (h/'terminal.json').exists()
 seal=state(h);wire=c.wire(h);registry=claims()
 a.save('boundary-before.json',dict(state=seal,wire=wire,claims=registry,original=original,ready=ready,ownerFDs=owner,holderFDs=holder,originalLive=True))
 d=c.base/'competing';d.mkdir()
 alternate='http://127.0.0.1:%d/ctl'%ready['alternatePort']
 ticks=Path('/proc/%d/stat'%ready['idlePID']).read_text().rsplit(') ',1)[1].split()[19]
 (d/'process.json').write_text(json.dumps(dict(pid=ready['idlePID'],startTicks=ticks,endpoint=alternate)))
 (d/'budget.json').write_text(json.dumps(dict(runId='replacement',startedAt=time.time(),deadline=time.time()+120,captureLimit=999,capturesUsed=0)))
 attack=[sys.executable,str(f.LEGACY),'--invocation',str(d),'--endpoint',alternate,'--terminal-file',str(d/'terminal.json'),'--after-batches','1','--approve-new-game']
 legacy=finish(attack);a.save('legacy-attack.json',legacy)
 assert legacy['exit']==1 and 'attachment retired' in legacy['stdout']
 assert not any((d/n).exists() for n in ('owner.json','admitted-budget.json','delegation.json','usage.json','terminal.json'))
 assert claims()==registry and state(h)==seal and c.wire(h)==wire and p.poll() is None
 # NEW launch may never attach the original occupied primary endpoint.
 new=c.base/'new-competitor';argv=list(p.args);argv[argv.index('--invocation')+1]=str(new)
 competing=finish(argv);a.save('new-attack.json',competing)
 assert competing['exit']==1 and not new.exists()
 assert p.poll() is None and not (h/'terminal.json').exists()
 assert state(h)==seal and c.wire(h)==wire and claims()==registry
 a.save('boundary-after.json',dict(state=state(h),wire=c.wire(h),claims=claims(),originalLive=True,HTTPdelta=0,legacyNoClaim=True,newRefusedOriginalEndpoint=True,originalFiniteBudgetAndJournalUnchanged=True,sameHandlerAndState='pinned child_server.py uses Handler for both sockets',scope='cooperative supervisor protocol only'))
 (h/'release-input').touch();result=c.finish(p,h)
 cleanup=read(h/'cleanup.json');assert not cleanup['remainingOwnedLive']
 a.save('boundary-result.json',dict(verdict='PASS',candidate=a.CANDIDATE,tree=a.TREE,cleanup=cleanup,originalResult=result,exactHistoricalScriptPassed=False,authorizedSetupCorrection=True,legacyHTTP=0,newHTTP=0,productionUnchanged=True))
 print('PASS original LIVE / inherited alternate same-state listener: legacy HTTP0 no claim; NEW refuses original endpoint; finite budget and journal unchanged; owned cleanup empty')
except BaseException as ex:
 import traceback
 a.save('first-failure.json',dict(exception=repr(ex),traceback=traceback.format_exc()))
 raise
finally:c.doCleanups()
