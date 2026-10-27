"""Actual production Python CLI/Popen/monitor/controller path, offline children.

No Node, guest, browser or independent acceptance claim. Evidence persists when
ENIGMA_SUPERVISED_EVIDENCE is provided. Historical attach failures remain in the
prior ops directories; rejected attachment is now the deliberately public API.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest

HERE = Path(__file__).resolve().parent
TOOL = HERE.parents[2]/'tools/enigma-supervised-gameplay.py'
CTL = TOOL.with_name('enigma-frozen-gameplay-controller.py')


class SupervisedTests(unittest.TestCase):
    def setUp(self):
        retained = os.environ.get('ENIGMA_SUPERVISED_EVIDENCE')
        self.tmp = None if retained else tempfile.TemporaryDirectory()
        self.root = Path(retained or self.tmp.name)/self._testMethodName
        self.root.mkdir(parents=True)
        if self.tmp:
            self.addCleanup(self.tmp.cleanup)
        self.children = []
        self.addCleanup(self.cleanup)

    def cleanup(self):
        for p in self.children:
            if p.poll() is None:
                p.terminate()
            p.communicate(timeout=5)

    def config(self, name='one', fault='', **schedule):
        d = self.root/name
        d.mkdir()
        with socket.socket() as s:
            s.bind(('127.0.0.1',0))
            port = s.getsockname()[1]
        c = dict(command=[sys.executable,str(HERE/'child_server.py'),'--port',str(port),'--root',str(d),'--fault',fault],
                 cwd=str(HERE),url=f'http://127.0.0.1:{port}/ctl',launch_dir=str(d/'launch'),
                 cutoff_at=time.time()+60,duration_seconds=12,ready_seconds=2,
                 limits=dict(cpu=20,wall=15,physical=100663296,file=25165824,output=2097152),
                 controller=dict(max_batches=100,checkpoint_batches=1,after_action_batches=1,cleanup_batches=1,
                    max_captures=2,capture_bytes=2097152,width=640,height=480,checkpoint_seconds=3,
                    after_action_seconds=1,review_seconds=0,request_timeout=.15,cleanup_seconds=.5,
                    decision_path=str(d/'decision.json')))
        c['controller'].update(schedule)
        return d,c

    def launch(self, d, c, env=None):
        path=d/'launch.json'
        path.write_text(json.dumps(c))
        p=subprocess.Popen([sys.executable,str(TOOL),'--launch-config',str(path)],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
        self.children.append(p)
        return p

    def finish(self,p,d):
        out,err=p.communicate(timeout=20)
        result=dict(exit=p.returncode,stdout=out.decode(),stderr=err.decode())
        (d/'cli-result.json').write_text(json.dumps(result))
        return result

    def phase(self,p,d):
        path=d/'launch/controller/phase.json'
        end=time.monotonic()+6
        while not path.exists() and p.poll() is None and time.monotonic()<end:
            time.sleep(.01)
        self.assertIsNone(p.poll(),(p.returncode,p.communicate() if p.poll() is not None else ''))
        self.assertTrue(path.exists())

    def wire(self,d):
        return [json.loads(x) for x in (d/'wire.jsonl').read_text().splitlines()]

    def legacy(self,d,c):
        path=d/'legacy.json';path.write_text(json.dumps(c))
        registry=Path('/tmp')/f'enigma-frozen-controller-{os.getuid()}'
        before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in registry.glob('*')}
        r=subprocess.run([sys.executable,str(CTL),'--config',str(path)],capture_output=True,text=True,timeout=5)
        self.assertEqual(r.returncode,1)
        self.assertIn('existing-guest-attachment-retired',r.stdout)
        self.assertEqual(before,{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in registry.glob('*')})
        self.assertFalse(Path(c['evidence_dir']).exists())

    def cleaned(self,d):
        out=json.loads((d/'launch/supervisor-outcome.json').read_text())
        self.assertEqual(out['remainingOwnedLive'],[])
        self.assertTrue((d/'launch/terminal.json').exists())
        return out

    def diagnostic_fixture(self, mode, *, startup=True, executable=True):
        d,c=self.config(mode)
        # A real Python executable fixture named node enters the unchanged
        # production preflight dispatch. No Node engine or guest is executed.
        program=d/('node' if startup else 'command-fixture')
        program.write_text('#!'+sys.executable+'\n'+'''
import json,os,resource,sys,threading
mode=MODE
preflight='-e' in sys.argv
if preflight and mode!='startup-failure':
 print(json.dumps(dict(version='offline-python-fixture',execArgv=sys.argv[1:],
  sentinel='STARTUP-STDOUT',limits=open('/proc/self/limits').read())))
 os.write(2,b'STARTUP-STDERR\\n'+b'E'*16384)
 sys.exit(0)
prefix=b'STARTUP' if preflight else b'COMMAND'
size=196608 if mode=='simultaneous' else (131072 if mode=='cap' else 0)
def emit(fd,label,fill):
 data=prefix+b'-'+label+b'\\n'+fill*size
 while data:
  data=data[os.write(fd,data):]
threads=[threading.Thread(target=emit,args=(1,b'STDOUT',b'O')),
         threading.Thread(target=emit,args=(2,b'STDERR',b'E'))]
for thread in threads:thread.start()
for thread in threads:thread.join()
sys.exit(23 if preflight else 29)
'''.replace('MODE',repr(mode)))
        program.chmod(0o700 if executable else 0o600)
        c['command']=[str(program)]
        return d,c

    def assert_diagnostic_streams(self,d,stage):
        names=('node-startup-stdout.log','node-startup-stderr.log') if stage=='startup' else ('output.log','stderr.log')
        out,err=((d/'launch'/name).read_bytes() for name in names)
        prefix=stage.upper().encode()
        self.assertIn(prefix+b'-STDOUT',out)
        self.assertNotIn(prefix+b'-STDERR',out)
        self.assertIn(prefix+b'-STDERR',err)
        self.assertNotIn(prefix+b'-STDOUT',err)
        self.assertNotEqual((d/'launch'/names[0]).stat().st_ino,(d/'launch'/names[1]).stat().st_ino)
        return out,err

    def test_diagnostic_startup_failure_distinct_from_creation(self):
        d,c=self.diagnostic_fixture('startup-failure')
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        self.assert_diagnostic_streams(d,'startup')
        startup=json.loads((d/'launch/node-startup.json').read_text())
        self.assertEqual(startup['exit'],23)
        self.assertEqual(startup['status'],'exited')
        self.assertEqual(self.cleaned(d)['processDiagnostics']['command']['status'],'not-started')
        self.assertEqual((d/'launch/output.log').read_bytes(),b'')
        self.assertEqual((d/'launch/stderr.log').read_bytes(),b'')

    def test_diagnostic_startup_json_then_command_failure(self):
        d,c=self.diagnostic_fixture('command-failure')
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        self.assert_diagnostic_streams(d,'startup')
        self.assert_diagnostic_streams(d,'command')
        startup=json.loads((d/'launch/node-startup.json').read_text())
        self.assertEqual(startup['exit'],0)
        self.assertEqual(json.loads(startup['output'])['sentinel'],'STARTUP-STDOUT')
        outcome=self.cleaned(d)
        self.assertEqual(outcome['processDiagnostics']['command']['exit'],29)
        self.assertFalse(outcome['delegated'])

    def test_diagnostic_simultaneous_streams_no_loss_or_deadlock(self):
        d,c=self.diagnostic_fixture('simultaneous',startup=False)
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        out,err=self.assert_diagnostic_streams(d,'command')
        self.assertEqual(out,b'COMMAND-STDOUT\n'+b'O'*196608)
        self.assertEqual(err,b'COMMAND-STDERR\n'+b'E'*196608)
        outcome=self.cleaned(d)
        self.assertEqual(outcome['outputBytes'],len(out)+len(err))
        self.assertEqual(outcome['childReturncode'],29)

    def test_diagnostic_combined_output_cap(self):
        d,c=self.diagnostic_fixture('cap',startup=False)
        c['limits']['output']=1024
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        outcome=self.cleaned(d)
        self.assertIn('aggregate-resource-limit',outcome['reason'])
        logs=[d/'launch'/name for name in ('output.log','stderr.log','node-startup-stdout.log','node-startup-stderr.log')]
        self.assertEqual(sum(p.stat().st_size for p in logs),1024)
        self.assertGreater(outcome['outputBytes'],1024)

    def test_diagnostic_failed_spawn_retains_files_and_error(self):
        for startup in (True,False):
            d,c=self.diagnostic_fixture('spawn-'+str(startup),startup=startup,executable=False)
            self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
            outcome=self.cleaned(d)
            stage='startup' if startup else 'command'
            diag=outcome['processDiagnostics'][stage]
            self.assertEqual(diag['status'],'spawn-failed')
            self.assertIn('Permission denied',diag['error'])
            self.assertIsNone(diag['exit'])
            self.assertEqual(outcome['owned'],[])
            for name in ('output.log','stderr.log','node-startup-stdout.log','node-startup-stderr.log'):
                self.assertEqual((d/'launch'/name).read_bytes(),b'')

    def test_diagnostic_failed_setup_retains_empty_streams(self):
        d,c=self.diagnostic_fixture('setup-failure')
        c['command'].append('--flag-without-equals')
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        outcome=self.cleaned(d)
        self.assertIn('node-startup-requires-explicit-equals-flags',outcome['status'])
        self.assertTrue(all(diag['status']=='not-started' for diag in outcome['processDiagnostics'].values()))
        self.assertEqual(outcome['owned'],[])
        for name in ('output.log','stderr.log','node-startup-stdout.log','node-startup-stderr.log'):
            self.assertEqual((d/'launch'/name).read_bytes(),b'')

    def test_diagnostic_cleanup_tail_cap_cannot_report_success(self):
        d,c=self.config('cleanup-tail')
        wrapper=d/'cleanup-tail.py'
        wrapper.write_text('''
import os,runpy,signal,sys
def tail(*args):
 os.write(2,b'CLEANUP-STDERR\\n'+b'E'*4096)
 raise SystemExit(0)
signal.signal(signal.SIGTERM,tail)
sys.argv=sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')
''')
        c['command'].insert(1,str(wrapper))
        c['limits']['output']=1024
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        outcome=self.cleaned(d)
        self.assertTrue(outcome['failed'])
        self.assertTrue(outcome['outputLimitExceeded'])
        self.assertEqual((d/'launch/output.log').read_bytes(),b'')
        self.assertTrue((d/'launch/stderr.log').read_bytes().startswith(b'CLEANUP-STDERR\n'))
        self.assertEqual((d/'launch/stderr.log').stat().st_size,1024)

    def test_positive_real_entry_ack_zero_and_reviewed_input(self):
        d,c=self.config(fault='review',review_seconds=1)
        r=self.finish(self.launch(d,c),d)
        self.assertEqual(r['exit'],0,r)
        wire=self.wire(d)
        child=json.loads((d/'child.json').read_text())
        self.assertTrue(all(x['pid']==child['pid'] for x in wire))
        commands=[x['command'] for x in wire]
        self.assertEqual(sum('cmd' in x for x in commands),1)
        for i,x in enumerate(commands):
            if x.get('action')=='step':
                self.assertEqual(commands[i+1],{'action':'snapshot'})
        click=next(i for i,x in enumerate(commands) if 'cmd' in x)
        self.assertEqual(commands[click-1],{'action':'snapshot'})
        self.assertEqual(sum(x.get('action')=='png' for x in commands),2)
        self.assertEqual(commands[-1],{'action':'quit'})
        self.assertFalse(self.cleaned(d)['failed'])

    def test_live_original_competitors_and_changed_outputs_cannot_attach(self):
        unrelated=subprocess.Popen([sys.executable,'-S','-c','import time;time.sleep(60)'],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.children.append(unrelated)
        d,c=self.config(review_seconds=4)
        p=self.launch(d,c);self.phase(p,d)
        child=json.loads((d/'child.json').read_text())
        journal=d/'launch/authority.jsonl';before=journal.read_bytes();wire=self.wire(d)
        original=json.loads((d/'launch/controller/config.json').read_text())
        for i,updates in enumerate(({},dict(url=f"http://127.0.0.1:{child['alternate_port']}/ctl",pid=child['idle_pid']),
                                    dict(deadline_at=time.time()+110,started_at=time.time(),max_batches=999999))):
            legacy=dict(original,evidence_dir=str(d/f'forbidden-{i}'),**updates)
            self.legacy(d,legacy)
            self.assertIsNone(p.poll())
            self.assertEqual(self.wire(d),wire)
            self.assertEqual(journal.read_bytes(),before)
        # Editing the original launch file cannot change the running closure.
        altered=dict(c,duration_seconds=110,url=f"http://127.0.0.1:{child['alternate_port']}/ctl")
        (d/'launch.json').write_text(json.dumps(altered))
        self.assertEqual(self.finish(p,d)['exit'],0)
        self.cleaned(d)
        self.assertIsNone(unrelated.poll(), 'supervisor must not clean up unrelated processes')
        # A second production launch cannot reuse this directory or endpoint.
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        self.assertEqual(sum(json.loads(x)['event']=='new-launch' for x in journal.read_text().splitlines()),1)

    def test_failure_no_reconnect_timeout_caps_and_terminal_child(self):
        for fault in ('wrong-ack','credits','timeout','die','stale-review'):
            with self.subTest(fault=fault):
                d,c=self.config(fault,fault,review_seconds=.2)
                r=self.finish(self.launch(d,c),d)
                self.assertEqual(r['exit'],1,r)
                commands=[x['command'] for x in self.wire(d)]
                self.assertFalse(any('cmd' in x for x in commands))
                self.assertLessEqual(sum(x.get('action')=='step' for x in commands),1 if fault!='stale-review' else 2)
                if fault in ('timeout','die'):
                    self.assertEqual(commands[-1],{'action':'step','n':1})
                self.assertTrue(self.cleaned(d)['failed'])
                original=json.loads((d/'launch/controller/config.json').read_text())
                self.legacy(d,dict(original,evidence_dir=str(d/'forbidden-reconnect')))
                self.assertEqual(commands,[x['command'] for x in self.wire(d)])
        d,c=self.config('caps',max_batches=3)
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        self.assertEqual([x['command'] for x in self.wire(d)],[{'action':'snapshot'}])
        self.cleaned(d)

    def test_distinct_supervised_children_independent(self):
        a,ca=self.config('a',review_seconds=.5)
        b,cb=self.config('b',review_seconds=.5)
        # Sequential transport children keep the whole offline test tree below
        # its 128 MiB admission. Each retains an independent original lifetime.
        self.assertEqual(self.finish(self.launch(a,ca),a)['exit'],0)
        self.assertEqual(self.finish(self.launch(b,cb),b)['exit'],0)
        self.assertNotEqual(self.wire(a)[0]['pid'],self.wire(b)[0]['pid'])
        self.cleaned(a);self.cleaned(b)

    def test_invalid_schedule_or_attach_rejected_before_child(self):
        d,c=self.config()
        for update in (dict(duration_seconds=float('inf')),dict(pid=os.getpid()),dict(duration_seconds=111)):
            invalid=dict(c,**update)
            self.assertEqual(self.finish(self.launch(d,invalid),d)['exit'],1)
            self.assertFalse((d/'child.json').exists())
            self.assertFalse((d/'launch').exists())

    def test_send_boundary_death_terminal_and_identity_change(self):
        for mode in ('death','terminal','identity','crash'):
            d,c=self.config(mode)
            injection=d/'inject';injection.mkdir()
            # Inject at urllib.Request construction, AFTER durable intent and
            # BEFORE the controller's final live check/socket operation.
            (injection/'sitecustomize.py').write_text('''
import urllib.request,json,os,signal,pathlib
original=urllib.request.Request
def request(*args,**kwargs):
 c=json.loads(kwargs.get('data',b'{}'))
 if c.get('action')=='step':
  root=pathlib.Path(os.environ['BOUNDARY_ROOT'])
  child=json.loads((root/'child.json').read_text())
  mode=os.environ['BOUNDARY_MODE']
  if mode=='death':
   os.kill(child['pid'],signal.SIGKILL)
   os.waitpid(child['pid'],0)
  elif mode=='terminal':
   (root/'launch/terminal.json').write_text('{}')
  elif mode=='identity':
   # Explicit synthetic identity observation, not an actual PID reuse claim.
   read=pathlib.Path.read_text
   def changed(path,*a,**k):
    raw=read(path,*a,**k)
    if str(path)==f"/proc/{child['pid']}/stat":
     at=raw.rfind(')')+2;fields=raw[at:].split();fields[19]='0'
     return raw[:at]+' '.join(fields)
    return raw
   pathlib.Path.read_text=changed
  else:
   raise SystemExit('injected-controller-crash-after-intent')
 return original(*args,**kwargs)
urllib.request.Request=request
''')
            env=dict(os.environ,PYTHONPATH=str(injection),BOUNDARY_ROOT=str(d),BOUNDARY_MODE=mode)
            self.assertEqual(self.finish(self.launch(d,c,env),d)['exit'],1)
            self.assertEqual([x['command'] for x in self.wire(d)],[{'action':'snapshot'}])
            outcome=self.cleaned(d)
            self.assertTrue(outcome['delegated'])
            events=[json.loads(x) for x in (d/'launch/authority.jsonl').read_text().splitlines()]
            self.assertEqual(sum(x['event']=='delegation-consumed' for x in events),1)
            self.assertTrue(any(x['event']=='request-intent' and x['request'].get('action')=='step' for x in events))
            original=json.loads((d/'launch/controller/config.json').read_text())
            self.legacy(d,dict(original,evidence_dir=str(d/'forbidden')))

    def test_actual_output_and_aggregate_physical_caps(self):
        for name,limits in (('output',dict(output=1024)),('physical',dict(physical=33554432))):
            d,c=self.config(name,fault='output' if name=='output' else '')
            c['limits'].update(limits)
            self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
            outcome=self.cleaned(d)
            self.assertTrue(outcome['failed'])
            self.assertIn('aggregate-resource-limit',outcome['reason'])
            self.assertLessEqual((d/'launch/output.log').stat().st_size,c['limits']['output'])

    def test_original_supervisor_process_cannot_launch_replacement(self):
        d,c=self.config('first')
        second,other=self.config('second')
        config=self.root/'pair.json';config.write_text(json.dumps([c,other]))
        script=self.root/'one-process.py'
        script.write_text('''
import importlib.util,json,sys
s=importlib.util.spec_from_file_location('production',sys.argv[1])
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
first,second=json.load(open(sys.argv[2]))
assert m.supervise_new(first)==0
try:
 m.supervise_new(second)
except m.controller.Refusal as ex:
 assert str(ex)=='supervisor-process-already-used-no-replacement'
 print('PASS one original supervisor process cannot launch replacement')
else:
 raise AssertionError('second runtime accepted')
''')
        p=subprocess.Popen([sys.executable,str(script),str(TOOL),str(config)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.children.append(p)
        self.assertEqual(self.finish(p,d)['exit'],0)
        self.cleaned(d)
        self.assertFalse((second/'child.json').exists())
        self.assertFalse((second/'launch').exists())


if __name__=='__main__':
    unittest.main()
