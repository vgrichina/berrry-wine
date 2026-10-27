"""Offline retained-startup regression; no guest, Node or substituted runner."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import sys
import subprocess
import tempfile
import threading
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    return m
m = load('controller', ROOT/'tools/airstrike-menu-controller.py')
b = load('bridge', ROOT/'tools/airstrike-observation-bridge.py')
D = pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/retained')
REQUEST = json.loads((D/'review-request.json').read_text())
SNAPSHOT = REQUEST['snapshot']
TARGET = SNAPSHOT['windows'][1]

def approved():
    return dict(after=None, focus='unknown', unobscured=False, keysReleased=True,
                evidence=REQUEST['path'], state='startup', startupPrompt='Press any key to start',
                consoleObstruction=copy.deepcopy(TARGET), startupSnapshot=copy.deepcopy(SNAPSHOT))

def observed(after, state='startup'):
    return dict(after=after, focus='airstrike', unobscured=True, keysReleased=True,
                evidence='offline next observation', state=state, startupPrompt='Press any key to start')

def queued(i, command, snapshot=None, batch=5000):
    log = fixture_log(command, batch)
    return dict(ack=dict(id='airstrike-'+str(i), ok=True, value=dict(queued=True,batch=batch)),
                completion=dict(inputId='airstrike-'+str(i),
                  step=dict(id='bridge-step',ok=True,value=dict(ran=1,steps=1,frozen=True,batch=batch+1)),
                  snapshot=dict(id='bridge-snapshot',ok=True,value=dict(batch=batch+1,frozen=dict(frozen=True,credits=0))),
                  logs=[log]))

def fixture_log(command, batch):
    if command == 'click:656:33':
        return f'[input] click 656,33 at batch {batch}'
    action, vk = command.split(':')
    return f'[input] {action} vk={vk} at batch {batch}'

def drive(messages):
    it=iter(messages);commands=[]
    c=m.Controller(lambda:next(it),commands.append)
    try: c.run()
    except (m.Refusal,StopIteration,m.Terminal) as e: return commands, str(e)
    return commands, 'success'

class Startup(unittest.TestCase):
    def test_actual_controller_cli_startup_contract(self):
        messages=[dict(observation=approved()),queued(1,'click:656:33',SNAPSHOT),
                  dict(observation=observed('airstrike-1')),queued(2,'keydown:32',batch=5001),
                  queued(3,'keyup:32',batch=5002),dict(observation=observed('airstrike-3','gameplay'))]
        result=subprocess.run([sys.executable,'-B',str(ROOT/'tools/airstrike-menu-controller.py')],
                              input=''.join(json.dumps(x)+'\n' for x in messages),text=True,
                              stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
        self.assertEqual(result.returncode,2)
        self.assertEqual([json.loads(x)['cmd'] for x in result.stdout.splitlines()],
                         ['click:656:33','keydown:32','keyup:32','keydown:27'])
        self.assertEqual(json.loads(result.stderr)['status'],'refused')

    def test_actual_bridge_entry_with_reviewed_startup_and_wrong_target(self):
        for mode in ('normal', 'wrong-target', 'stale-review'):
            directory = pathlib.Path(tempfile.mkdtemp(prefix='startup-'+mode+'-', dir=ROOT.parent/'ops'))
            obj = b.Bridge([sys.executable, '-B', __file__, '--startup-runner', str(directory)],
                           ROOT/'tools/airstrike-menu-controller.py', directory/'evidence', guest_seconds=15)
            done = threading.Event();errors=[]
            def review():
                seen=set()
                try:
                    while not done.wait(.005):
                        path=obj.root/'review-request.json'
                        if not path.exists():continue
                        request=json.loads(path.read_text())
                        if request['token'] in seen:continue
                        seen.add(request['token']);after=request['after']
                        if after is None:
                            o=approved();o['evidence']=request['path'];o.pop('startupSnapshot')
                            if mode=='wrong-target':o['consoleObstruction']['hwnd']='0x99999'
                        else:
                            i=int(after.rsplit('-',1)[1]);state='startup' if i==1 else 'gameplay' if i==3 else 'menu'
                            o=observed(after,state)
                            if state=='menu':o.update(header='Airstrike menu',items=m.ITEMS,selected=(i-5)//2)
                        reply={k:request[k] for k in ('session','token','sha256','after')};reply['observation']=o
                        if mode=='stale-review':reply['token']='stale'
                        b.save(obj.root/('review-'+request['token']+'.json'),reply)
                except Exception as e:errors.append(str(e))
            t=threading.Thread(target=review);t.start()
            try:result=obj.run()
            finally:done.set();t.join(2)
            self.assertFalse(t.is_alive());self.assertEqual(errors,[])
            self.assertTrue(result['cleanup']['complete'])
            received=[json.loads(x) for x in (directory/'received.jsonl').read_text().splitlines()]
            inputs=[x['cmd'] for x in received if 'cmd' in x]
            if mode=='normal':
                self.assertEqual(result['status'],'normal-quit-observed',result)
                self.assertEqual(inputs,['click:656:33','keydown:32','keyup:32','keydown:27','keyup:27']+['keydown:40','keyup:40']*6+['keydown:13'])
                events=json.loads((obj.root/'events.json').read_text())
                self.assertEqual(sum(e['kind']=='frozen-input-complete' for e in events),17)
            else:self.assertEqual(inputs,[],result)

    def test_exact_original_observation_remains_failclosed(self):
        v=json.loads((D/'review-9b55685e506a4124abd456510ebaf254.json').read_text())
        commands,reason=drive([dict(observation=v['observation'])])
        self.assertEqual(commands,[]);self.assertIn('insufficient-observation',reason)

    def test_retained_image_and_production_caption_contract(self):
        self.assertEqual(hashlib.sha256((D/'9b55685e506a4124abd456510ebaf254.png').read_bytes()).hexdigest(),REQUEST['sha256'])
        p=ROOT.parent/'ops/production-run.js';source=p.read_text()
        self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809')
        for s in ["kind === 'click'", "const evs = parseInputEntries([`${tickState.batch | 0}:${entry}`]);", "ev.action === 'click' && renderer && renderer.handleMouseDown", "renderer.handleMouseDown(ev.x, ev.y, 1);", "renderer.handleMouseUp(ev.x, ev.y, 1);", "return { queued: true, batch: tickState.batch | 0 };"]:
            self.assertIn(s,source)
        self.assertEqual(m.execution_log('click:656:33',5000,SNAPSHOT),'[input] click 656,33 at batch 5000')
        self.assertEqual(m.activation_command(approved(),SNAPSHOT),'click:656:33')
        renderer=ROOT.parent/'ops/production-renderer-input.js'
        self.assertEqual(hashlib.sha256(renderer.read_bytes()).hexdigest(),'4ea9ba14249a361b6c498c8e019cc27b761bc080af755eab04616b85af5ca051')
        source=renderer.read_text()
        for snippet in ['this._raiseWindowGroup(win);','this._setKeyboardInputOwner(win);',
                        'if (we && currentFocus !== targetFocus) this._setInputFocus(w, targetFocus);',
                        "if (hit === 2) {\n          prepareDirectInput();\n          this._beginWindowDrag(win, canvasX, canvasY);"]:
            self.assertIn(snippet,source)

    def test_reviewed_activation_then_fresh_startup_before_any_key(self):
        commands,reason=drive([dict(observation=approved()),queued(1,'click:656:33',SNAPSHOT),
          dict(observation=observed('airstrike-1')),queued(2,'keydown:32',batch=5001),queued(3,'keyup:32',batch=5002),
          dict(observation=observed('airstrike-3','gameplay'))])
        self.assertEqual([x['cmd'] for x in commands],['click:656:33','keydown:32','keyup:32','keydown:27'])
        self.assertNotIn('Enter',reason)

    def test_wrong_unknown_window_target_and_geometry(self):
        for change in [dict(hwnd='0x99999'),dict(title='Console - unrelated'),dict(isChild=True),dict(visible=False),dict(x=-9999),dict(w=0)]:
            o=approved();o['consoleObstruction'].update(change)
            self.assertEqual(drive([dict(observation=o)])[0],[])
        for mutate in ['main','extra','focus','credits','running','stale','no-prompt']:
            o=approved();s=o['startupSnapshot']
            if mutate=='main':o['consoleObstruction']=copy.deepcopy(s['windows'][0])
            if mutate=='extra':s['windows'].append(dict(hwnd='0x999',title='Console'))
            if mutate=='focus':s['focus']='0x10002'
            if mutate=='credits':s['frozen']['credits']=1
            if mutate=='running':s['frozen']['frozen']=False
            if mutate=='stale':o['after']='old'
            if mutate=='no-prompt':del o['startupPrompt']
            self.assertEqual(drive([dict(observation=o)])[0],[],mutate)
        o=approved();o['startupSnapshot']['windows'][1]['w']=800
        o['consoleObstruction']=copy.deepcopy(o['startupSnapshot']['windows'][1])
        self.assertEqual(drive([dict(observation=o)])[0],[]) # no exposed safe caption

    def test_no_repeat_or_key_after_uncertain_activation(self):
        for response in [dict(ack=dict(id='wrong',ok=True,value={})),dict(terminal={}),queued(1,'click:656:33',SNAPSHOT)]:
            if 'completion' in response:response['completion']['snapshot']['value']['frozen']['credits']=1
            self.assertEqual(len(drive([dict(observation=approved()),response])[0]),1)
        # No second activation, no key if obstruction persists or next review stale.
        for next_o in [approved(),observed('old'),dict(observed('airstrike-1'),unobscured=False)]:
            self.assertEqual(len(drive([dict(observation=approved()),queued(1,'click:656:33',SNAPSHOT),dict(observation=next_o)])[0]),1)

    def bridge_obj(self):
        obj=b.Bridge.__new__(b.Bridge);obj.module=m;obj.command=None;obj.response_deadline=time.monotonic()+5
        obj.after=None;obj.console_review=approved();obj.activated=False;obj.logs={'stdout':bytearray()};obj.events=[]
        focus=b.Bridge.focus(SNAPSHOT)
        obj.reviewed_capture=('token',dict(sha256=REQUEST['sha256'],snapshot=copy.deepcopy(SNAPSHOT),focus=focus))
        obj.expected_focus=focus
        return obj

    def test_bridge_dispatches_only_exact_reviewed_action(self):
        for cmd in ['click:32:32','click:634:21','click:616:21']:
            obj=self.bridge_obj();obj.write=lambda c:self.fail('must not dispatch')
            with self.assertRaises(b.Stop):obj.send(dict(id='airstrike-1',cmd=cmd))
        obj=self.bridge_obj();sent=[];obj.write=sent.append
        obj.capture=lambda *a:copy.deepcopy(obj.reviewed_capture[1])
        obj.send(dict(id='airstrike-1',cmd='click:656:33'))
        self.assertEqual(len(sent),1);self.assertIsNone(obj.console_review)

    def test_bridge_rejects_stale_image_window_batch_and_credit_state(self):
        for kind in ['image','window','batch','credits','expired','unreviewed']:
            obj=self.bridge_obj();fresh=copy.deepcopy(obj.reviewed_capture[1]);obj.write=lambda c:self.fail('must not dispatch')
            if kind=='image':fresh['sha256']='changed'
            if kind=='window':fresh['focus']['windows']=[]
            if kind=='batch':fresh['snapshot']['batch']+=1
            if kind=='credits':fresh['snapshot']['frozen']['credits']=1
            if kind=='expired':obj.response_deadline=0
            if kind=='unreviewed':obj.console_review=None
            obj.capture=lambda *a:fresh
            with self.assertRaises(b.Stop,msg=kind):obj.send(dict(id='airstrike-1',cmd='click:656:33'))

    def test_bridge_activation_frozen_completion_uses_actual_log(self):
        for bad in [None,'log','step','credits']:
            obj=self.bridge_obj();obj.dispatch_snapshot=SNAPSHOT;obj.guest_deadline=time.monotonic()+5
            obj.input_log_start=0
            line=m.execution_log('click:656:33',5000,SNAPSHOT)
            obj.logs={'stdout':bytearray(((line if bad!='log' else 'wrong')+'\n').encode())};obj.event=lambda *a,**k:None
            responses=iter([dict(id='step',ok=True,value=dict(ran=0 if bad=='step' else 1,steps=1,frozen=True,batch=5001)),dict(id='snapshot',ok=True,value=dict(batch=5001,frozen=dict(frozen=True,credits=1 if bad=='credits' else 0)))])
            obj.request_ack=lambda *a,**k:next(responses)
            cmd=dict(id='airstrike-1',cmd='click:656:33');value=dict(ack=dict(id=cmd['id'],ok=True,value=dict(queued=True,batch=5000)))
            if bad:
                with self.assertRaises(b.Stop):obj.complete_frozen(cmd,value)
            else:self.assertEqual(obj.complete_frozen(cmd,value)['completion']['logs'],[line])

def fake_runner(directory):
    """Only transport fixture; exact runner source is separately pinned above."""
    snapshot=copy.deepcopy(SNAPSHOT);pending=None;state=0
    print('FAKE startup runner; no guest',file=sys.stderr,flush=True)
    for line in sys.stdin:
        cmd=json.loads(line)
        with (pathlib.Path(directory)/'received.jsonl').open('a') as f:f.write(json.dumps(cmd)+'\n')
        if cmd.get('action')=='snapshot':value=copy.deepcopy(snapshot)
        elif cmd.get('action')=='png':
            data=('FAKE startup image '+str(state)).encode();pathlib.Path(cmd['path']).write_bytes(data)
            value=dict(path=cmd['path'],bytes=len(data))
        elif cmd.get('action')=='step':
            assert pending is not None
            print(fixture_log(pending,snapshot['batch']),flush=True)
            if pending=='click:656:33':assert snapshot['focus']==snapshot['mainHwnd']
            state+=1;snapshot['batch']+=1;pending=None
            value=dict(ran=1,steps=1,frozen=True,batch=snapshot['batch'])
        else:
            assert pending is None
            if cmd['cmd']=='keydown:13':print('[Exit] code=0',flush=True);return
            pending=cmd['cmd'];value=dict(queued=True,batch=snapshot['batch'])
        print('[ctl] '+json.dumps(dict(id=cmd['id'],ok=True,value=value)),flush=True)

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--startup-runner':fake_runner(sys.argv[2])
    else:unittest.main(verbosity=2)
