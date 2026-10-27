"""Two actual CLIs, one real fake-control PID and state, two listener ports.
No guest process or production source is altered. Expected second wire count: 0.
"""
import sys,importlib.util,json,http.server,threading,os
from pathlib import Path
sys.dont_write_bytecode=True
O=Path(__file__).parent / 'corrected-final';O.mkdir()
fixture=Path('/tmp/alien-menu-action-budget-controller-repair-oct27/repo/test/fixtures/alien-menu-controller/test_controller.py')
sys.argv=[str(fixture),str(O/'identity-cli')]
s=importlib.util.spec_from_file_location('fixture',fixture);f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
c=f.Case('test_approved_menu_action_then_reserved_evidence_and_quit');c.setUp()
p=None;alias=None;thread=None
try:
 c.mode='live-owner'
 p,record=c.run_cli(background=True)
 assert c.input_arrived.wait(3),'first CLI did not reach reviewed input'
 assert p.poll() is None,'original owner must still be alive'
 original=c.home;before=len(c.requests)
 alias=http.server.HTTPServer(('127.0.0.1',0),c.server.RequestHandlerClass)
 thread=threading.Thread(target=alias.serve_forever,daemon=True);thread.start()
 # The same handler closes over the exact same batch/frame/input state.
 # Only endpoint port and evidence directory differ. PID/startticks unchanged.
 c.home=original/'alternate-port';c.home.mkdir();c.mode=''
 result=c.run_cli(endpoint='http://127.0.0.1:%d/ctl'%alias.server_port)
 extra=c.requests[before:]
 receipt=dict(verdict='REJECT' if extra else 'PASS',reason='one original control process/state can acquire a second owner through alternate listening port',firstCLIAlive=p.poll() is None,listenerPID=os.getpid(),startTicks=Path('/proc/self/stat').read_text().rsplit(') ',1)[1].split()[19],firstPort=c.server.server_port,alternatePort=alias.server_port,expectedSecondHTTP=0,actualSecondHTTP=len(extra),secondExit=result.returncode,secondStdout=result.stdout,secondCommands=extra,baseCandidate='91762ab7d9729b34d8ce4fdc70ad32406f1d4dfc',sourceUnmodified=False,offlineOnly=True)
 (O/'identity-rejection.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt))
 assert not extra and result.returncode==1, 'second CLI must refuse with zero HTTP'
 assert 'existing control process owner' in result.stdout
 assert p.poll() is None, 'first owner must retain continuity'
finally:
 c.resume.set()
 if p:
  stdout,stderr=p.communicate(timeout=5);record.update(returncode=p.returncode,stdout=stdout,stderr=stderr)
 if alias:alias.shutdown();thread.join();alias.server_close()
 c.home=original if 'original' in locals() else c.home
 c.doCleanups()
