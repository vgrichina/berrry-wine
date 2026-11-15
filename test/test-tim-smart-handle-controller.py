"""Policy checks only. These never stand in for actual native mouse proof."""
import importlib.util
import pathlib
import tempfile
import unittest

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
 const r=await rig(0);let progress=0,engine,downSeen=false;
 const {rgbaConsole}=require(process.cwd()+'/tools/toyvm/framebuffer');
 const {PNG}=require(process.cwd()+'/node_modules/pngjs');
 const capture=()=>{assert.equal(r.m.mouse.buttons,0,'no capture while held');return {...rgbaConsole(r.m.con),text:true}};
 const adapter={capture,ownsTarget:()=>true,programIdentity:()=>sha(r.f.bytes),progress:()=>progress,
  mouseInput:(x,y,b)=>r.live.mouseInput(x,y,b,0,0),releaseMouse:()=>r.live.releaseMouse(),releaseKeys:()=>r.live.releaseKeys(),keyDown:()=>{throw Error('not in mouse probe')}};
 const frames=[];
 const keep=s=>{const p=new PNG({width:s.width,height:s.height});p.data.set(s.rgba);const png=PNG.sync.write(p);const name='native-frame-'+frames.length+'.png';fs.writeFileSync(dir+'/'+name,png,{flag:'wx'});frames.push({...bind(s),name,sha256:sha(png),progress:s.progress})};
 const q={kind:mode==='drag'?'drag':mode==='hover'?'hover':'click',x:70,y:55,toX:120,toY:85,button:mode==='right'?2:1,holdMs:100};
 engine=await createFiniteEngine({directory:dir,session:'native-COM-probe',deadline:Date.now()+200000,independentUpMs:mode==='watchdog'?300:1750,review:async s=>{keep(s);return {...bind(s),nonce:crypto.randomUUID(),action:q,review:{mode:'menu'}}},observe:async s=>{keep(s)}});
 process.on('SIGTERM',()=>{try{engine.cancel('supervisor cancellation')}catch{}});
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
   }
  }
 }catch(e){if(!['cancel','watchdog'].includes(mode))throw e}
 // Let the actual COM handler execute the queued UP and RETF, without any new
 // input or capture while down. This is diagnostic execution, never gameplay.
 for(let i=0;i<3000;i++){r.s.step();progress++}
 await engine.close();
 const count=r.word(r.at('count')),events=Array.from({length:count},(_,i)=>Array.from({length:6},(_,j)=>r.word(r.at('records')+32*i+2*j)));
 assert.equal(r.m.mouse.buttons,0);assert(count>0);
 if(mode==='hover'){assert(events.every(e=>e[1]===0));assert(events.some(e=>e[0]&1))}
 else{const bit=mode==='right'?8:2,up=mode==='right'?16:4;assert(events.some(e=>e[0]&bit));assert(events.some(e=>e[0]&up));assert.equal(events.at(-1)[1],0)}
 if(mode==='drag')assert(events.some(e=>e[0]&1&&e[1]===1&&e[2]===120&&e[3]===85));
 for(const file of fs.readdirSync(dir).filter(f=>f.startsWith('down-'))){const d=JSON.parse(fs.readFileSync(dir+'/'+file)),u=JSON.parse(fs.readFileSync(dir+'/'+file.replace('down-','up-')));assert(u.at-d.at<=1500,'actual finite hold <=1500ms')}
 immutable(dir+'/native-probe.json',{mode,comSha256:sha(r.f.bytes),moduleSha256:sha(r.vm.bytes),events,frames,result:engine.result,actualNativeCallbackExecution:true,gameplayFixture:false});
 console.log('PASS actual native '+mode);
})().catch(e=>{console.error(e);process.exitCode=1});
'''


def native_probes(root):
    """Only call after the task's predecessor source/build/runtime releases."""
    import json
    import os
    import subprocess
    import sys
    root = pathlib.Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    for mode in ('hover', 'click', 'right', 'drag', 'cancel', 'watchdog', 'parentdeath'):
        directory = root / mode
        directory.mkdir()
        env = {**os.environ, 'TIM_PROBE_MODE': mode, 'TIM_PROBE_DIR': str(directory)}
        code = "import importlib.util,pathlib,os; s=importlib.util.spec_from_file_location('tim', 'tools/tim-smart-handle-controller.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);t=importlib.util.spec_from_file_location('test', 'test/test-tim-smart-handle-controller.py');n=importlib.util.module_from_spec(t);t.loader.exec_module(n);raise SystemExit(m.supervise(['node','-e',m.ENGINE_JS+n.NATIVE_JS],pathlib.Path(os.environ['TIM_PROBE_DIR']),220))"
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


class PolicyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        # Arbitrary capture bytes for hash policy only, never a game fixture.
        (self.root / 'scene.png').write_bytes(b'policy bytes only')
        self.lease = dict(nativeSeconds=900, watchdogSeconds=920, quitReserveSeconds=180,
                          maximumHoldMs=1500, independentUpMs=1750, startedAt=100, deadline=1000, session='fresh')
        self.p = tim.Policy(self.root, self.lease)
        self.capture = dict(session='fresh', frameId='one', digest='frame', programId='native', targetId='target',
                            png='scene.png', pngSHA256=tim.digest(self.root / 'scene.png'), capturedAt=200, width=640, height=480)
        self.review = {k: self.capture[k] for k in ('session', 'frameId', 'digest', 'programId', 'targetId')}
        self.review.update(source='personally-viewed-current-full-scene', completeScene='Entire scene reviewed',
                           pauseState='not-observed', mode='game', reviewedAt=201, visibleTarget='visible part',
                           expectedVisibleConsequence='visible change')
        self.action = dict(kind='click', x=30, y=40, button=1, holdMs=200)

    def admit(self, now=202):
        return self.p.admit(self.capture, self.review, self.action, now=now)

    def test_single_nonce_and_duplicate_closes(self):
        result = self.admit()
        self.assertTrue(result['nonce'])
        with self.assertRaises(FileExistsError):
            self.admit()
        self.assertTrue((self.root / 'UNKNOWN.json').exists())

    def test_changed_capture_closes(self):
        (self.root / 'scene.png').write_bytes(b'changed')
        with self.assertRaisesRegex(AssertionError, 'capture changed'):
            self.admit()

    def test_game_expiry_is_five_seconds(self):
        with self.assertRaisesRegex(AssertionError, 'expired'):
            self.admit(205.001)

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
    if len(sys.argv) == 3 and sys.argv[1] == '--native':
        native_probes(sys.argv[2])
    else:
        unittest.main()
