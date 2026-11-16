"""Strict operator preflight; native controls never assert TIM mechanics."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tim', ROOT / 'tools/tim-smart-handle-controller.py')
tim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tim)


# Generated COM transport fixture only. These coordinates belong to the dummy
# control, never TIM. Each operation goes through the real --gesture CLI; the
# next is not admitted until native post-UP execution of this one has finished.
NATIVE_EXACT_JS = r'''
(async()=>{
 const assert=require('assert/strict'),dir=process.env.TIM_SCHEMA_DIR;
 const {rig}=require(process.cwd()+'/test/toyvm-mouse-callback.test.js');
 const {rgbaConsole}=require(process.cwd()+'/tools/toyvm/framebuffer');
 const {PNG}=require(process.cwd()+'/node_modules/pngjs');
 const r=await rig(0);let progress=0,child=null,invalidChecked=false;
 const calls=[],commands=[],frames=[];
 const adapter={ownsTarget:()=>true,programIdentity:()=>sha(r.f.bytes),progress:()=>progress,
  capture:()=>{assert.equal(r.m.mouse.buttons,0);return {...rgbaConsole(r.m.con),text:true}},
  mouseInput:(x,y,b)=>{calls.push({x,y,b});r.live.mouseInput(x,y,b,0,0)},
  releaseMouse:()=>r.live.releaseMouse(),releaseKeys:()=>r.live.releaseKeys(),
  keyDown:()=>{throw Error('mouse fixture only')}};
 const launch=(label,action)=>{
  const argv=['-B','tools/tim-smart-handle-controller.py','--gesture',dir,'game',
   'DIAGNOSTIC full COM framebuffer; no TIM scene','diagnostic '+label,'diagnostic callbacks only',JSON.stringify(action),label];
  const p=cp.spawn('python3',argv,{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  p.stdout.on('end',()=>stdoutEOF=true);p.stderr.on('end',()=>stderrEOF=true);
  return {pid:p.pid,done:new Promise(resolve=>p.on('close',(exit,signal)=>{
   const value={pid:p.pid,exit,signal,actualWait:true,stdoutEOF,stderrEOF,stdout,stderr,argv};
   immutable(dir+'/cli-'+label+'-wait.json',value);resolve(value);
  }))};
 };
 const publish=s=>{
  const png=new PNG({width:s.width,height:s.height});png.data.set(s.rgba);
  const bytes=PNG.sync.write(png),name='schema-scene-'+s.frameId+'.png';
  fs.writeFileSync(dir+'/'+name,bytes,{flag:'wx'});
  const c={...bind(s),admission:s.admission,width:s.width,height:s.height,
   capturedAt:s.capturedAt/1000,png:name,pngSHA256:sha(bytes)};
  fs.writeFileSync(dir+'/latest.json',JSON.stringify(c));frames.push(c);return c;
 };
 const deadline=Date.now()+240000;
 immutable(dir+'/lease.json',{session:'schema-COM-only',startedAt:(deadline-900000)/1000,deadline:deadline/1000,
  nativeSeconds:900,watchdogSeconds:920,quitReserveSeconds:180,maximumHoldMs:1400,independentUpMs:1750});
 let chosen=null,label=null;
 const engine=await createFiniteEngine({directory:dir,session:'schema-COM-only',deadline,independentUpMs:1750,
  review:async(s,refresh)=>{
   publish(s);
   if(!invalidChecked){
    const good={kind:'drag',x:70,y:55,toX:120,toY:85,button:1,holdMs:100};
    const invalid=[{kind:'drag',from:[70,55],to:[120,85],button:1,holdMs:100},
     {...good,from:[70,55]},{...good,toX:true},{...good,holdMs:79}];
    for(const field of Object.keys(good)){const v={...good};delete v[field];invalid.push(v)}
    const click={kind:'click',x:70,y:55,button:1,holdMs:100};
    for(const field of Object.keys(click)){const v={...click};delete v[field];invalid.push(v)}
    for(const [i,q] of invalid.entries()){
     const result=await launch('invalid-'+i,q).done;
     assert.notEqual(result.exit,0);assert(result.stdoutEOF&&result.stderrEOF);
     assert(!fs.existsSync(dir+'/UNKNOWN.json'));
     assert(!fs.readdirSync(dir).some(f=>/^(command-|decision-|consumed-|arm-|down-)/.test(f)));
     assert.equal(calls.length,0);assert.equal(r.m.mouse.events.length,0);assert.equal(r.m.mouse.buttons,0);
    }
    for(let i=0;i<200;i++){r.s.step();progress++}
    assert.equal(r.word(r.at('count')),0);
    immutable(dir+'/invalid-zero-delivery.json',{invalidCommands:invalid.length,adapterCalls:0,queuedEvents:0,buttons:0,
     nativeCallbacks:0,actualSubsequentNativeSteps:200,noReviewIntentOrDecision:true});
    invalidChecked=true;s=refresh();publish(s);
   }
   child=launch(label,chosen);
   const end=Date.now()+3000,filename=dir+'/command-'+s.frameId+'.json';
   while(!fs.existsSync(filename)){
    assert(!fs.existsSync(dir+'/UNKNOWN.json'));assert(Date.now()<end,'CLI did not submit');
    await new Promise(resolve=>setTimeout(resolve,5));
   }
   const c=JSON.parse(fs.readFileSync(filename));assert.deepEqual(c.action,chosen);commands.push(c);return c;
  },observe:async(s,a)=>immutable(dir+'/consequence-'+a.nonce+'.json',{...bind(s),progress:s.progress,postUPExecution:true})});
 const click=(x,y)=>({kind:'click',x,y,button:1,holdMs:100});
 // Individual dummy-control shapes; these do not encode a game solution.
 for(const item of [
  ['ordinary-click',click(70,55)],
  ['placement-drag',{kind:'drag',x:70,y:55,toX:120,toY:85,button:1,holdMs:100}],
  ['placement-click',click(120,85)],
  ['belt-pickup',{kind:'drag',x:70,y:55,toX:120,toY:85,button:1,holdMs:100}],
  ['belt-first-endpoint',click(120,85)],['belt-second-endpoint',click(140,95)],
  ['handle-click',click(150,100)]]){
  [label,chosen]=item;const before=r.word(r.at('count'));await engine.act(adapter);
  const end=Date.now()+4000;
  while(engine.awaitingExecution){assert(Date.now()<end);r.s.step();progress++;await engine.afterStep(adapter)}
  for(let i=0;i<500;i++){r.s.step();progress++}
  const result=await child.done;assert.equal(result.exit,0,result.stderr);assert(result.stdoutEOF&&result.stderrEOF);
  assert(JSON.parse(result.stdout).postUPExecution);assert.equal(r.m.mouse.buttons,0);
  const events=Array.from({length:r.word(r.at('count'))-before},(_,i)=>Array.from({length:6},(_,j)=>r.word(r.at('records')+32*(i+before)+2*j)));
  assert.equal(events.filter(e=>e[0]&2).length,1);assert.equal(events.filter(e=>e[0]&4).length,1);
  if(chosen.kind==='drag')assert(events.some(e=>e[0]&1&&e[1]===1&&e[2]===chosen.toX&&e[3]===chosen.toY));
  immutable(dir+'/native-'+label+'.json',{events,action:chosen,actualNativeCallbackExecution:true,TIMMechanismProved:false});
 }
 await engine.close();assert.equal(engine.result.status,'STOPPED');
 immutable(dir+'/native-schema-result.json',{commands:commands.length,invalidChecked,calls,frames,
  comSHA256:sha(r.f.bytes),moduleSHA256:sha(r.vm.bytes),result:engine.result,gameplayFixture:false});
 console.log('PASS exact CLI/native schema, click, placement drag, belt endpoints, handle click');
})().catch(e=>{console.error(e);process.exit(1)});
'''


def native_exact(root):
    """Call only after explicit predecessor source/build/runtime releases."""
    import os
    import subprocess
    import sys
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=False)
    code = ("import importlib.util,os,pathlib;"
            "s=importlib.util.spec_from_file_location('schema','test/test-tim-gesture-schema.py');"
            "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
            "raise SystemExit(m.tim.supervise(['node','-e',m.tim.ENGINE_JS+m.NATIVE_EXACT_JS],"
            "pathlib.Path(os.environ['TIM_SCHEMA_DIR']),260))")
    child = subprocess.Popen([sys.executable, '-B', '-c', code],
                             env={**os.environ, 'TIM_SCHEMA_DIR': str(root)},
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    wait, stdout, stderr = tim.actual_wait(child, root, 'supervisor-child')
    (root / 'supervisor.log').write_bytes(stdout)
    (root / 'supervisor.stderr').write_bytes(stderr)
    assert wait['exit'] == 0, (wait, stderr.decode())
    for name in ('native-wait.json', 'deadline-watchdog-wait.json'):
        value = json.loads((root / name).read_text())
        assert value['actualWait'] and value['stdoutEOF'] and value['stderrEOF']
    print('PASS exact CLI/native schema actual waits/bothEOF')


class GestureSchemaTest(unittest.TestCase):
    def click(self):
        return dict(kind='click', x=30, y=40, button=1, holdMs=100)

    def drag(self):
        return dict(kind='drag', x=30, y=40, toX=120, toY=90, button=1, holdMs=100)

    def test_exact_click_and_drag_are_copied_without_default_coordinates(self):
        for action in (self.click(), self.drag(), dict(kind='hover', x=0, y=0),
                       dict(kind='key', key='Escape', holdMs=80), dict(kind='wait'), dict(kind='stop')):
            checked = tim.validate_gesture(action)
            self.assertEqual(checked, action)
            self.assertIsNot(checked, action)
            self.assertEqual(tim.parse_gesture(json.dumps(action)), action)

    def test_every_missing_field_rejected_before_live_review_or_intent(self):
        for action in (self.click(), self.drag(), dict(kind='key', key='Enter', holdMs=100)):
            for field in action:
                malformed = {k: v for k, v in action.items() if k != field}
                with self.subTest(kind=action['kind'], field=field):
                    self.rejected_before_operate(malformed)

    def rejected_before_operate(self, action):
        # Even latest.json must not be read and Policy/UUID must not be reached.
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tim, 'Policy') as policy, patch.object(tim.uuid, 'uuid4') as nonce:
                with patch.object(Path, 'read_text', side_effect=AssertionError('live read reached')):
                    with self.assertRaises(ValueError):
                        tim.operate(directory, 'game', 'fixture', 'fixture', 'fixture', action)
                policy.assert_not_called()
                nonce.assert_not_called()
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_from_to_aliases_and_extra_fields_have_zero_submission(self):
        for action in (dict(kind='drag', **{'from': [30, 40], 'to': [120, 90]}, button=1, holdMs=100),
                       {**self.drag(), 'from': [30, 40]}, {**self.click(), 'toX': 90},
                       {**self.click(), 'actions': []}, [], None, 'click'):
            with self.subTest(action=action):
                self.rejected_before_operate(action)

    def test_coordinates_and_buttons_require_real_integers(self):
        for name in ('x', 'y', 'toX', 'toY', 'button', 'holdMs'):
            for value in (True, False, 1.0, '100', None, float('nan'), float('inf')):
                with self.subTest(name=name, value=value):
                    with self.assertRaises(ValueError):
                        tim.validate_gesture({**self.drag(), name: value})
        for name in ('x', 'y', 'toX', 'toY'):
            with self.assertRaises(ValueError):
                tim.validate_gesture({**self.drag(), name: -1})
        for button in (0, 3, -1):
            with self.assertRaises(ValueError):
                tim.validate_gesture({**self.click(), 'button': button})

    def test_manual_hold_bounds_80_through_1400(self):
        for hold in (80, 1400):
            self.assertEqual(tim.validate_gesture({**self.click(), 'holdMs': hold})['holdMs'], hold)
        for hold in (0, 1, 79, 1401, 1499, 1500):
            with self.assertRaises(ValueError):
                tim.validate_gesture({**self.click(), 'holdMs': hold})

    def test_bounds_use_actual_full_frame_without_clamping(self):
        self.assertEqual(tim.validate_gesture(self.drag(), 640, 480), self.drag())
        for field, value in (('x', 640), ('y', 480), ('toX', 640), ('toY', 480)):
            with self.assertRaises(ValueError):
                tim.validate_gesture({**self.drag(), field: value}, 640, 480)

    def test_json_rejects_duplicate_keys_nonfinite_and_nonobjects(self):
        for raw in ('{"kind":"click","kind":"drag"}', '{"x":NaN}', '{"x":Infinity}',
                    '[]', 'null', '"click"', '{'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                tim.parse_gesture(raw)

    def test_actual_gesture_cli_rejects_before_opening_live_directory(self):
        import sys
        for raw in ('{"kind":"drag","from":[30,40],"to":[120,90],"button":1,"holdMs":100}',
                    '{"kind":"click","kind":"drag"}', '[]', '{"x":NaN}'):
            argv = ['controller', '--gesture', '/no-live-directory', 'game', 'scene', 'target', 'consequence', raw]
            with self.subTest(raw=raw), patch.object(sys, 'argv', argv), patch.object(tim, 'Policy') as policy:
                with patch.object(Path, 'read_text', side_effect=AssertionError('live read reached')):
                    with self.assertRaises(ValueError):
                        tim.main()
                policy.assert_not_called()

    def test_outside_frame_rejected_before_review_nonce_and_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            tim.exclusive(Path(directory) / 'latest.json', dict(width=640, height=480))
            with patch.object(tim, 'Policy') as policy, patch.object(tim.uuid, 'uuid4') as nonce:
                with self.assertRaisesRegex(ValueError, 'outside complete frame'):
                    tim.operate(directory, 'game', 'scene', 'target', 'consequence', {**self.drag(), 'toX': 640})
                policy.assert_not_called()
                nonce.assert_not_called()
            self.assertEqual([p.name for p in Path(directory).iterdir()], ['latest.json'])

    def test_unknown_kind_and_key_rejected(self):
        for action in ({**self.click(), 'kind': 'belt'}, dict(kind='key', key='F1', holdMs=100)):
            with self.assertRaises(ValueError):
                tim.validate_gesture(action)

    def test_preflight_cannot_recover_an_existing_unknown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tim.exclusive(root / 'UNKNOWN.json', dict(reason='actual ambiguous delivery', irreversible=True))
            tim.validate_gesture(self.click())
            before = (root / 'UNKNOWN.json').read_bytes()
            # Admission itself retains its existing terminal rule.
            lease = dict(nativeSeconds=900, watchdogSeconds=920, quitReserveSeconds=180,
                         maximumHoldMs=1400, independentUpMs=1750, startedAt=100, deadline=1000, session='fixture')
            with self.assertRaisesRegex(AssertionError, 'UNKNOWN'):
                tim.Policy(root, lease).admit({}, {}, self.click(), now=200)
            self.assertEqual((root / 'UNKNOWN.json').read_bytes(), before)
            self.assertEqual([p.name for p in root.iterdir()], ['UNKNOWN.json'])

    def test_original_requires_new_schema_qualification_before_one_intent(self):
        import subprocess
        proof = dict(routeSHA256=tim.digest(tim.__file__),
                     testSHA256=tim.digest(ROOT / 'test/test-tim-smart-handle-controller.py'),
                     fullLockedBuildExit=0, actualNativeCallbacks=True, directWaitsBothEOF=True,
                     nativeModes=['hover', 'click', 'right', 'drag', 'cancel', 'watchdog', 'parentdeath',
                                  'unsent', 'lateack', 'dropack', 'heldinput', 'writtenstale', 'quitreserve'])
        for schema_fields in ({}, dict(schemaTestSHA256='old schema', schemaExactCLIAndNativeZeroDelivery=True),
                              dict(schemaTestSHA256=tim.digest(__file__), schemaExactCLIAndNativeZeroDelivery=False)):
            with self.subTest(fields=schema_fields), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                tim.exclusive(root / 'route-qualified.json', {**proof, **schema_fields})
                with patch.object(subprocess, 'Popen') as launch:
                    with self.assertRaises((AssertionError, KeyError)):
                        tim.start_original(root)
                    launch.assert_not_called()
                self.assertEqual([p.name for p in root.iterdir()], ['route-qualified.json'])


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == '--native-exact':
        native_exact(sys.argv[2])
    else:
        unittest.main()
