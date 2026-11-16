"""Policy checks only. These never stand in for actual native mouse proof."""
import importlib.util
import pathlib
import tempfile
import unittest
import json

spec = importlib.util.spec_from_file_location('tim', pathlib.Path(__file__).resolve().parents[1] / 'tools/tim-smart-handle-controller.py')
tim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tim)

# This is an executed native 16-bit COM probe, using the existing actual
# INT33 fixture. It has no game model, object handles, puzzle state or solver.
# It qualifies transport mechanics only; an actual TIM flip remains separate.
NATIVE_JS = r'''
(async()=>{
 const assert=require('assert/strict');const dir=process.env.TIM_PROBE_DIR,mode=process.env.TIM_PROBE_MODE;
 const {rig}=require(process.cwd()+'/test/toyvm-mouse-callback.test.js');
 const r=await rig(0);let progress=0,engine,downSeen=false,refusedZero=null;
 const {rgbaConsole}=require(process.cwd()+'/tools/toyvm/framebuffer');
 const {PNG}=require(process.cwd()+'/node_modules/pngjs');
 const capture=()=>{assert.equal(r.m.mouse.buttons,0,'no capture while held');return {...rgbaConsole(r.m.con),text:true}};
 const inputCalls=[];
 const adapter={capture,ownsTarget:()=>true,programIdentity:()=>sha(r.f.bytes),progress:()=>progress,
  mouseInput:(x,y,b)=>{inputCalls.push({kind:'mouse',x,y,buttons:b,at:Date.now()});r.live.mouseInput(x,y,b,0,0)},
  releaseMouse:()=>{inputCalls.push({kind:'releaseMouse',at:Date.now()});r.live.releaseMouse()},
  releaseKeys:()=>{inputCalls.push({kind:'releaseKeys',at:Date.now()});r.live.releaseKeys()},keyDown:()=>{throw Error('not in mouse probe')}};
 const frames=[];
 const keep=s=>{const p=new PNG({width:s.width,height:s.height});p.data.set(s.rgba);const png=PNG.sync.write(p);const name='native-frame-'+frames.length+'.png';fs.writeFileSync(dir+'/'+name,png,{flag:'wx'});frames.push({...bind(s),name,sha256:sha(png),progress:s.progress});return {...bind(s),admission:s.admission,png:name,pngSHA256:sha(png),capturedAt:s.capturedAt/1000,width:s.width,height:s.height}};
 const invokePolicy=(name,action)=>{
  const p=cp.spawnSync('python3',['-B','test/test-tim-smart-handle-controller.py','--probe-admit',dir,name,JSON.stringify(action)],{encoding:'utf8'});
  immutable(dir+'/policy-'+name+'-wait.json',{pid:p.pid,exit:p.status,signal:p.signal,actualWait:!p.error,stdoutEOF:!p.error,stderrEOF:!p.error,stdoutBytes:Buffer.byteLength(p.stdout||''),stderrBytes:Buffer.byteLength(p.stderr||''),at:Date.now(),method:'spawnSync actual child completion'});
  assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
 };
 const q={kind:mode==='drag'?'drag':mode==='hover'?'hover':'click',x:70,y:55,toX:120,toY:85,button:mode==='right'?2:1,holdMs:100};
 const nativeDeadline=Date.now()+200000;
 engine=await createFiniteEngine({directory:dir,session:'native-COM-probe',deadline:nativeDeadline,independentUpMs:['watchdog','cancel','heldinput'].includes(mode)?300:1750,review:async(s,refresh)=>{
  let c=keep(s);
  if(mode==='writtenstale'){
   immutable(dir+'/lease.json',{session:'native-COM-probe',startedAt:(nativeDeadline-900000)/1000,deadline:nativeDeadline/1000,nativeSeconds:900,watchdogSeconds:920,quitReserveSeconds:180,maximumHoldMs:1400,independentUpMs:1750});
   immutable(dir+'/probe-capture-fresh.json',c);
   const written=invokePolicy('fresh',q);
   assert(fs.existsSync(dir+'/command-'+s.frameId+'.json'));
   await new Promise(resolve=>setTimeout(resolve,5100));
   return written;
  }
  if(mode==='unsent'){
   immutable(dir+'/lease.json',{session:'native-COM-probe',startedAt:(nativeDeadline-900000)/1000,deadline:nativeDeadline/1000,nativeSeconds:900,watchdogSeconds:920,quitReserveSeconds:180,maximumHoldMs:1400,independentUpMs:1750});
   immutable(dir+'/probe-capture-stale.json',c);
   await new Promise(resolve=>setTimeout(resolve,6304));
   const refusal=invokePolicy('stale',{kind:'drag',x:50,y:45,toX:100,toY:90,button:1,holdMs:100});
   assert.equal(refusal.status,'REFUSED_UNSENT');assert.equal(r.word(r.at('count')),0);assert.equal(r.m.mouse.events.length,0);assert.equal(r.m.mouse.buttons,0);assert.equal(inputCalls.length,0);
   assert(!fs.readdirSync(dir).some(f=>/^(command-|consumed-|down-|arm-)/.test(f)));
   // Native execution after refusal must still produce zero callbacks. This
   // is the native probe's own log, never a read from a game.
   for(let i=0;i<200;i++){r.s.step();progress++}
   assert.equal(r.word(r.at('count')),0);
   refusedZero={callbacks:0,queuedEvents:0,buttons:0,inputCalls:0,refusal,actualNativeSteps:200};
   s=refresh(refusal);c=keep(s);immutable(dir+'/probe-capture-fresh.json',c);
   // A separate fixture review chooses a different intent and coordinates.
   // This is transport qualification, not a personal game review or solver.
   return invokePolicy('fresh',{kind:'click',x:70,y:55,button:1,holdMs:100});
  }
  return {...bind(s),nonce:crypto.randomUUID(),action:q,review:{mode:'menu'}}
 },observe:async s=>{keep(s)}});
 process.on('SIGTERM',()=>{try{engine.cancel('supervisor cancellation')}catch{}});
 if(['writtenstale','quitreserve'].includes(mode)){
  if(mode==='quitreserve')immutable(dir+'/quit-phase.json',{irreversible:true,diagnostic:true});
  await assert.rejects(engine.act(adapter),mode==='writtenstale'?/review expired/:/Quit reserve/);
  for(let i=0;i<200;i++){r.s.step();progress++}
  assert.equal(r.word(r.at('count')),0);assert.equal(r.m.mouse.events.length,0);assert.equal(r.m.mouse.buttons,0);assert.equal(inputCalls.length,0);
  await engine.close();assert.equal(engine.result.status,'UNKNOWN');
  assert(!fs.readdirSync(dir).some(f=>/^(up-|down-|arm-|unsent-confirmed-)/.test(f)));
  immutable(dir+'/native-probe.json',{mode,comSha256:sha(r.f.bytes),moduleSha256:sha(r.vm.bytes),events:[],inputCalls,frames,result:engine.result,actualNativeCallbackExecution:true,gameplayFixture:false});
  console.log('PASS actual native terminal '+mode);return;
 }
 await engine.act(adapter);
 const end=Date.now()+5000;
 try{
  while(engine.awaitingExecution&&Date.now()<end){
   r.s.step();progress++;await engine.afterStep(adapter);
   if(engine.result.held&&!downSeen){
    downSeen=true;
    if(mode==='parentdeath'){
     r.until(()=>r.word(r.at('count'))>=2&&!r.s.mouseCallback,'native press before owner death');
     immutable(dir+'/parent-death-native-press.json',{count:r.word(r.at('count')),buttons:r.m.mouse.buttons,comSha256:sha(r.f.bytes),moduleSha256:sha(r.vm.bytes),nativePressExecuted:true});
     process.exit(17);
    }
    if(mode==='cancel'){engine.cancel('native qualification cancellation');break}
    if(mode==='watchdog'){await new Promise(resolve=>setTimeout(resolve,350));break}
    if(mode==='heldinput'){
     await assert.rejects(engine.act(adapter),/capture while held/);
     assert.equal(frames.length,1,'no capture or review while held');
     break;
    }
   }
  }
 }catch(e){if(!['cancel','watchdog','lateack','dropack'].includes(mode))throw e}
 if(mode==='lateack'){
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(engine.result.status,'UNKNOWN','late ACK never revives input');
 }
 if(engine.result.held){const end=Date.now()+1800;while(engine.result.held&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,10))}
 // Let the actual COM handler execute the queued UP and RETF, without any new
 // input or capture while down. This is diagnostic execution, never gameplay.
 for(let i=0;i<3000;i++){r.s.step();progress++}
 await engine.close();
 const count=r.word(r.at('count')),events=Array.from({length:count},(_,i)=>Array.from({length:6},(_,j)=>r.word(r.at('records')+32*i+2*j)));
 assert.equal(r.m.mouse.buttons,0);assert(count>0);
 if(mode==='hover'){assert(events.every(e=>e[1]===0));assert(events.some(e=>e[0]&1))}
 else if(['lateack','dropack'].includes(mode)){
  assert(events.every(e=>e[1]===0));assert(events.every(e=>!(e[0]&6)));
  assert.equal(inputCalls.length,1,'hover is delivered, no cleanup input follows UNKNOWN');assert.equal(inputCalls[0].buttons,0);
  assert.equal(engine.result.status,'UNKNOWN');
  const before=events.length;await assert.rejects(engine.act(adapter),/ACK timeout|UNKNOWN|guard lost/);
  assert.equal(r.word(r.at('count')),before);
 }else{const bit=mode==='right'?8:2,up=mode==='right'?16:4;assert(events.some(e=>e[0]&bit));assert(events.some(e=>e[0]&up));assert.equal(events.at(-1)[1],0)}
 if(mode==='drag')assert(events.some(e=>e[0]&1&&e[1]===1&&e[2]===120&&e[3]===85));
 for(const file of fs.readdirSync(dir).filter(f=>f.startsWith('down-'))){const d=JSON.parse(fs.readFileSync(dir+'/'+file)),u=JSON.parse(fs.readFileSync(dir+'/'+file.replace('down-','up-')));assert(u.at-d.at<=1500,'actual finite hold <=1500ms')}
 if(mode==='unsent'){assert(refusedZero);assert.equal(events.filter(e=>e[0]&2).length,1);assert.equal(events.filter(e=>e[0]&4).length,1)}
 immutable(dir+'/native-probe.json',{mode,comSha256:sha(r.f.bytes),moduleSha256:sha(r.vm.bytes),events,inputCalls,frames,refusedZero,result:engine.result,actualNativeCallbackExecution:true,gameplayFixture:false});
 console.log('PASS actual native '+mode);
})().catch(e=>{console.error(e);process.exit(1)});
'''


def native_probes(root):
    """Only call after the task's predecessor source/build/runtime releases."""
    import json
    import os
    import subprocess
    import sys
    root = pathlib.Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    for mode in ('hover', 'click', 'right', 'drag', 'cancel', 'watchdog', 'parentdeath', 'unsent', 'lateack', 'dropack', 'heldinput', 'writtenstale', 'quitreserve'):
        directory = root / mode
        directory.mkdir()
        env = {**os.environ, 'TIM_PROBE_MODE': mode, 'TIM_PROBE_DIR': str(directory)}
        code = "import importlib.util,pathlib,os; s=importlib.util.spec_from_file_location('tim', 'tools/tim-smart-handle-controller.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);t=importlib.util.spec_from_file_location('test', 'test/test-tim-smart-handle-controller.py');n=importlib.util.module_from_spec(t);t.loader.exec_module(n);engine=n.fault_source(m.ENGINE_JS,os.environ['TIM_PROBE_MODE']);m.ENGINE_JS=engine;raise SystemExit(m.supervise(['node','-e',engine+n.NATIVE_JS],pathlib.Path(os.environ['TIM_PROBE_DIR']),220))"
        child = subprocess.Popen([sys.executable, '-B', '-c', code], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        wait, stdout, stderr = tim.actual_wait(child, directory, 'supervisor-child')
        (directory / 'supervisor.log').write_bytes(stdout)
        (directory / 'supervisor.stderr').write_bytes(stderr)
        expected = 17 if mode == 'parentdeath' else 0
        assert wait['exit'] == expected, (mode, wait, stderr.decode())
        for name in ('native-wait.json', 'deadline-watchdog-wait.json'):
            value = json.loads((directory / name).read_text())
            assert value['actualWait'] and value['stdoutEOF'] and value['stderrEOF']
        if mode != 'parentdeath':
            assert json.loads((directory / 'native-probe.json').read_text())['actualNativeCallbackExecution']
        else:
            assert json.loads((directory / 'parent-death-native-press.json').read_text())['nativePressExecuted']
        print('PASS', mode, 'actual waits/bothEOF')


def fault_source(source, mode):
    """Fault only a diagnostic guard ACK; no production or game hook."""
    original = "send({kind:'ARMED',nonce:m.nonce,deadline:m.deadline});"
    if mode in ('lateack', 'dropack'):
        assert source.count(original) == 1
        replacement = ('setTimeout(()=>'+original[:-1]+',1200);' if mode == 'lateack'
                       else '/* diagnostic dropped ARMED acknowledgment */')
        return source.replace(original, replacement)
    return source


def probe_admit(directory, name, action):
    """A diagnostic fixture review, expressly never a game/personal review."""
    root = pathlib.Path(directory)
    capture = json.loads((root / ('probe-capture-' + name + '.json')).read_text())
    import time
    review = {k: capture[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId')}
    review.update(source='personally-viewed-current-full-scene', completeScene='DIAGNOSTIC native COM framebuffer, no game',
                  pauseState='not-observed', mode='game', reviewedAt=time.time(), visibleTarget='diagnostic pointer target',
                  expectedVisibleConsequence='diagnostic callbacks', intentId='independent-fixture-'+name,
                  intentSource='independently-chosen-for-this-complete-scene')
    policy = tim.Policy(root, json.loads((root / 'lease.json').read_text()))
    try:
        result = policy.admit(capture, review, action)
    except tim.UnsentReviewRefusal as refusal:
        result = refusal.receipt
    print(json.dumps(result))


class PolicyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        # Arbitrary capture bytes for hash policy only, never a game fixture.
        (self.root / 'scene.png').write_bytes(b'policy bytes only')
        self.lease = dict(nativeSeconds=900, watchdogSeconds=920, quitReserveSeconds=180,
                          maximumHoldMs=1400, independentUpMs=1750, startedAt=100, deadline=1000, session='fresh')
        self.p = tim.Policy(self.root, self.lease)
        self.capture = dict(session='fresh', frameId='one', digest='frame', programId='native', targetId='target',
                            png='scene.png', pngSHA256=tim.digest(self.root / 'scene.png'), capturedAt=200, width=640, height=480,
                            admission=dict(phase='REVIEWING', held=False, delivery='NONE', token='native-review-token', recoveryFrom=None))
        self.review = {k: self.capture[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId')}
        self.review.update(source='personally-viewed-current-full-scene', completeScene='Entire scene reviewed',
                           pauseState='not-observed', mode='game', reviewedAt=201, visibleTarget='visible part',
                           expectedVisibleConsequence='visible change')
        self.review.update(intentId='personally-chosen-one', intentSource='independently-chosen-for-this-complete-scene')
        self.action = dict(kind='click', x=30, y=40, button=1, holdMs=200)

    def admit(self, now=202):
        return self.p.admit(self.capture, self.review, self.action, now=now)

    def test_single_nonce_and_duplicate_closes(self):
        result = self.admit()
        self.assertTrue(result['nonce'])
        with self.assertRaisesRegex(AssertionError, 'command already written'):
            self.admit()
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_changed_capture_closes(self):
        (self.root / 'scene.png').write_bytes(b'changed')
        with self.assertRaisesRegex(AssertionError, 'capture changed'):
            self.admit()

    def test_game_expiry_is_five_seconds(self):
        with self.assertRaises(tim.UnsentReviewRefusal):
            self.admit(205.001)
        self.assertFalse((self.root / 'UNKNOWN.json').exists())

    def test_exact_6304ms_construction_refusal_before_command_write(self):
        self.action.update(kind='drag', toX=120, toY=90)
        with self.assertRaises(tim.UnsentReviewRefusal) as caught:
            self.admit(206.304)
        receipt = caught.exception.receipt
        self.assertEqual(receipt['status'], 'REFUSED_UNSENT')
        self.assertEqual(receipt['delivery'], 'NONE')
        self.assertAlmostEqual(receipt['reviewAgeSeconds'], 6.304)
        self.assertFalse(list(self.root.glob('command-*')))
        self.assertFalse(list(self.root.glob('consumed-*')))
        self.assertNotIn('action', receipt)
        self.assertNotIn('coordinates', receipt)
        self.assertFalse((self.root / 'UNKNOWN.json').exists())

    def test_refusal_requires_native_confirmation_new_capture_and_intent(self):
        with self.assertRaises(tim.UnsentReviewRefusal) as caught:
            self.admit(206.304)
        receipt = caught.exception.receipt
        tim.exclusive(self.root / ('unsent-confirmed-' + receipt['refusalId'] + '.json'),
                      dict(refusalId=receipt['refusalId'], frameId='one', token='native-review-token',
                           zeroSend=True, at=206305))
        self.capture.update(frameId='two', capturedAt=207)
        self.capture['admission'].update(token='fresh-token', recoveryFrom=receipt['refusalId'])
        self.review.update(frameId='two', reviewedAt=208, intentId='independently-chosen-two')
        self.action = dict(kind='hover', x=80, y=70)
        result = self.admit(209)
        self.assertEqual(result['action']['kind'], 'hover')
        self.assertTrue(result['nonce'])
        self.assertNotEqual(result['nonce'], receipt['refusalId'])

    def test_stale_refusal_cannot_resubmit_old_capture(self):
        with self.assertRaises(tim.UnsentReviewRefusal):
            self.admit(206.304)
        with self.assertRaises(Exception):
            self.admit(206.305)
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_any_delivery_or_uncertainty_is_permanently_unknown(self):
        # Separate directories make every counterexample independently terminal.
        for hazard in ('hover', 'queued', 'written', 'DOWN', 'ambiguousACK', 'transportfailure'):
            with self.subTest(hazard=hazard), tempfile.TemporaryDirectory() as directory:
                root = pathlib.Path(directory)
                (root / 'scene.png').write_bytes(b'policy bytes only')
                capture = {**self.capture, 'admission': {**self.capture['admission'], 'delivery': hazard}}
                policy = tim.Policy(root, self.lease)
                if hazard == 'written':
                    tim.exclusive(root / 'command-one.json', {'status': 'already written'})
                with self.assertRaises(Exception):
                    policy.admit(capture, self.review, self.action, now=206.304)
                self.assertTrue((root / 'UNKNOWN.json').exists())
                self.assertFalse(list(root.glob('decision-*')))
                with self.assertRaisesRegex(AssertionError, 'UNKNOWN'):
                    policy.admit(self.capture, self.review, self.action, now=202)

    def test_held_or_missing_native_zero_send_attestation_is_not_recoverable(self):
        for admission in (None, {}, {**self.capture['admission'], 'held': True}):
            with self.subTest(admission=admission), tempfile.TemporaryDirectory() as directory:
                root = pathlib.Path(directory)
                (root / 'scene.png').write_bytes(b'policy bytes only')
                with self.assertRaises(Exception):
                    tim.Policy(root, self.lease).admit({**self.capture, 'admission': admission}, self.review, self.action, now=206.304)
                self.assertTrue((root / 'UNKNOWN.json').exists())

    def test_expired_review_does_not_bypass_irreversible_quit_reserve(self):
        with self.assertRaisesRegex(AssertionError, 'Quit reserve'):
            self.admit(822)
        self.assertTrue((self.root / 'quit-phase.json').exists())
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_expired_menu_at_30_seconds_refuses_without_widening(self):
        self.review['mode'] = 'menu'
        with self.assertRaises(tim.UnsentReviewRefusal):
            self.admit(230.001)

    def test_decision_claim_or_failed_command_write_is_terminal(self):
        from unittest.mock import patch
        real_exclusive = tim.exclusive

        def fail_command(path, value):
            if pathlib.Path(path).name.startswith('command-'):
                raise OSError('diagnostic transport failure')
            return real_exclusive(path, value)

        with patch.object(tim, 'exclusive', side_effect=fail_command):
            with self.assertRaisesRegex(OSError, 'transport failure'):
                self.admit()
        self.assertEqual(json.loads((self.root / 'decision-one.json').read_text())['status'], 'INPUT')
        self.assertTrue((self.root / 'UNKNOWN.json').exists())
        with self.assertRaisesRegex(AssertionError, 'UNKNOWN'):
            self.admit(206.304)

    def test_fresh_review_without_native_confirmation_cannot_recover(self):
        with self.assertRaises(tim.UnsentReviewRefusal) as caught:
            self.admit(206.304)
        self.capture.update(frameId='two', capturedAt=207)
        self.capture['admission'].update(token='new-token', recoveryFrom=caught.exception.receipt['refusalId'])
        self.review.update(frameId='two', reviewedAt=208, intentId='new-intent')
        with self.assertRaises(FileNotFoundError):
            self.admit(209)
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_native_confirmed_recovery_still_burns_old_intent(self):
        with self.assertRaises(tim.UnsentReviewRefusal) as caught:
            self.admit(206.304)
        receipt = caught.exception.receipt
        tim.exclusive(self.root / ('unsent-confirmed-' + receipt['refusalId'] + '.json'),
                      dict(refusalId=receipt['refusalId'], frameId='one', token='native-review-token', zeroSend=True, at=206305))
        self.capture.update(frameId='two', capturedAt=207)
        self.capture['admission'].update(token='new-token', recoveryFrom=receipt['refusalId'])
        self.review.update(frameId='two', reviewedAt=208)
        with self.assertRaisesRegex(AssertionError, 'old intent'):
            self.admit(209)
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_lost_capture_transport_ack_is_terminal_without_input(self):
        from unittest.mock import patch
        tim.exclusive(self.root / 'latest.json', self.capture)
        with patch.object(tim.time, 'monotonic', side_effect=[0, 3]):
            with self.assertRaisesRegex(RuntimeError, 'terminal UNKNOWN'):
                tim.refresh_scene(self.root)
        self.assertTrue((self.root / 'UNKNOWN.json').exists())
        self.assertFalse(list(self.root.glob('command-*')))
        with self.assertRaisesRegex(AssertionError, 'UNKNOWN'):
            tim.refresh_scene(self.root)

    def test_menu_expiry_is_thirty_seconds(self):
        self.review['mode'] = 'menu'
        self.admit(229)

    def test_unknown_cannot_rebind(self):
        self.p.unknown('lost ACK')
        self.capture['frameId'] = self.review['frameId'] = 'new'
        with self.assertRaisesRegex(AssertionError, 'UNKNOWN'):
            self.admit()

    def test_no_capture_replacement(self):
        tim.exclusive(self.root / 'record.json', {'a': 1})
        with self.assertRaises(FileExistsError):
            tim.exclusive(self.root / 'record.json', {'a': 2})

    def test_cutoff_irreversible(self):
        self.capture['capturedAt'] = self.review['reviewedAt'] = 821
        with self.assertRaisesRegex(AssertionError, 'Quit reserve'):
            self.admit(822)
        self.assertTrue((self.root / 'quit-phase.json').exists())

    def test_quit_control_required(self):
        self.review.update(mode='quit', visibleQuitControl='Native Quit icon')
        self.admit()
        self.assertTrue((self.root / 'quit-phase.json').exists())

    def test_hold_bound(self):
        self.action['holdMs'] = 1501
        with self.assertRaises(AssertionError):
            self.admit()

    def test_hover_has_no_button(self):
        self.action = dict(kind='hover', x=100, y=100)
        self.assertEqual(self.admit()['action']['kind'], 'hover')

    def test_drag_endpoints_inside_full_frame(self):
        self.action.update(kind='drag', toX=640, toY=10)
        with self.assertRaises(AssertionError):
            self.admit()

    def test_native_pause_needs_evidence(self):
        self.review.update(pauseState='observed-native-pause', pauseEvidence='')
        with self.assertRaisesRegex(AssertionError, 'pause requires'):
            self.admit()

    def test_lease_caller_mutation_cannot_extend(self):
        self.lease['deadline'] = 5000
        self.assertEqual(self.p.lease['deadline'], 1000)
        with self.assertRaises(TypeError):
            self.p.lease['deadline'] = 5000

    def test_atomic_record_no_partial_or_temporary_left(self):
        tim.exclusive(self.root / 'record.json', {'items': list(range(1000))})
        import json
        self.assertEqual(len(json.loads((self.root / 'record.json').read_text())['items']), 1000)
        self.assertEqual(list(self.root.glob('.*.tmp')), [])

    def test_capture_cannot_escape_run(self):
        self.capture['png'] = '../scene.png'
        with self.assertRaisesRegex(AssertionError, 'outside run'):
            self.admit()


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 5 and sys.argv[1] == '--probe-admit':
        probe_admit(sys.argv[2], sys.argv[3], json.loads(sys.argv[4]))
    elif len(sys.argv) == 3 and sys.argv[1] == '--native':
        native_probes(sys.argv[2])
    else:
        unittest.main()
