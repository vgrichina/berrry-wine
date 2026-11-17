"""Manual operator transport qualification, never TIM progress or a solver.

--fixture requires predecessor release and an externally held runtime lock.
--capture is intended to be followed by view_image IN THE SAME tool call.
--gesture is one direct call after personal review; it never refreshes a scene.
All admission/native rules are delegated unchanged to the existing controller.
"""
import importlib.util
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tim', ROOT / 'tools/tim-smart-handle-controller.py')
tim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tim)


NATIVE_JS = r'''
(async()=>{
 const assert=require('assert/strict'),dir=process.env.TIM_PATH_DIR;
 const {Machine,loadExe}=require(process.cwd()+'/tools/toyvm/dos');
 const {makeVm}=require(process.cwd()+'/tools/toyvm/vm');
 const {DosSession}=require(process.cwd()+'/tools/toyvm/dos-loop');
 const {LiveRun}=require(process.cwd()+'/tools/toyvm/live');
 const {rgbaFrame,screenSurface}=require(process.cwd()+'/tools/toyvm/framebuffer');
 const {PNG}=require(process.cwd()+'/node_modules/pngjs');
 // Authored native diagnostic, with 40+ shapes. Every pixel and its changed
 // marker are written by executed x86, not a host-side painting adapter.
 const bytes=[],labels={},refs=[];
 const b=(...v)=>bytes.push(...v),w=v=>b(v&255,v>>8&255);
 const label=n=>labels[n]=bytes.length+256;
 const ref=n=>{refs.push([bytes.length,n]);w(0)};
 const rect=(x,y,width,height,color)=>{
  b(0xbf);w(y*320+x);b(0xb2,color,0xbb);w(height); // DI,DL,BX
  const row=bytes.length;b(0xb9);w(width);b(0x88,0xd0,0xf3,0xaa,0x81,0xc7);w(320-width);
  b(0x4b,0x75);b((row-(bytes.length+1))&255);
 };
 b(0xb8);w(0x13);b(0xcd,0x10,0xb8);w(0xa000);b(0x8e,0xc0,0xfc);
 rect(0,0,320,200,3);rect(0,0,320,10,1);rect(284,10,36,180,6);rect(0,180,320,20,1);
 for(let i=0;i<7;i++){rect(5+i*39,184,32,10,7);rect(8+i*39,187,25,4,i+8)}
 for(let i=0;i<5;i++){rect(289,15+i*32,25,26,7);rect(294,20+i*32,15,16,i+9)}
 for(let i=0;i<3;i++){
  const x=25+i*77,y=132-i*38;
  rect(x,y,57,5,9);rect(x+2,y+1,4,3,15);rect(x+49,y+1,4,3,15);
  rect(x+10,y-27,17,17,4+i);rect(x+13,y-24,11,11,12+i);
  rect(x+38,y-12,15,9,2);rect(x+40,y-10,3,4,10);
 }
 rect(6,168,270,4,4);rect(258,88,6,80,7);rect(247,82,17,6,7);
 for(let i=0;i<22;i++)rect(172+i*3,116-i,3,2,14);
 b(0x0e,0x07,0xb9);w(127);b(0xba);ref('handler');b(0xb8);w(12);b(0xcd,0x33);
 label('loop');b(0xfb,0x90,0xeb,0xfc);
 label('handler');
 b(0x50,0x53,0x51,0x52,0x56,0x57,0x06); // preserve callback registers
 b(0x2e,0xff,0x06);ref('count');
 b(0xa9);w(2);b(0x74);const skip=bytes.length;b(0);
 // Six white pixels per row at the manually chosen press location.
 b(0x89,0xd0,0xbe);w(320);b(0xf7,0xe6,0x01,0xc8,0x89,0xc7,0xb8);w(0xa000);b(0x8e,0xc0,0xb0,15,0xba);w(6);
 const mark=bytes.length;b(0xb9);w(6);b(0xfc,0xf3,0xaa,0x81,0xc7);w(314);b(0x4a,0x75);b((mark-(bytes.length+1))&255);
 bytes[skip]=bytes.length-(skip+1);
 b(0x07,0x5f,0x5e,0x5a,0x59,0x5b,0x58,0xcb);
 label('count');w(0);
 for(const [at,n]of refs){bytes[at]=labels[n]&255;bytes[at+1]=labels[n]>>8}
 const f=Buffer.from(bytes),m=new Machine(new Uint8Array(0),{autoKey:false});
 const vm=await makeVm('tailcall',{portIn:(p,w)=>m.portIn(p,w),portOut:(p,v,w)=>m.portOut(p,v,w)});
 m.setMemory(vm.mem,vm.exports);m.installIvt();const info=loadExe(vm.mem,f);vm.setAll({...info,flags:0xf202});
 const s=new DosSession(vm,m,{slice:128,stuckLimit:0});
 for(let i=0;i<100000&&vm.get('gip')!==labels.loop;i++)s.step();
 assert.equal(vm.get('gip'),labels.loop,'native painted scene and registered callback');
 const live=Object.assign(Object.create(LiveRun.prototype),{machine:m,inputStopped:false});
 let progress=0,latest,engine;
 const inputCalls=[];
 const adapter={capture:()=>{assert.equal(m.mouse.buttons,0);const surface=screenSurface(m);assert.equal(surface.text,false);return {...rgbaFrame(vm.mem,m.palette,surface.geom),text:false}},
  ownsTarget:()=>true,programIdentity:()=>sha(f),progress:()=>progress,
  mouseInput:(x,y,buttons)=>{inputCalls.push({at:Date.now(),x,y,buttons});live.mouseInput(x,y,buttons,0,0)},
  releaseMouse:()=>live.releaseMouse(),releaseKeys:()=>live.releaseKeys(),keyDown:()=>{throw Error('mouse fixture')}};
 const save=(n,v)=>immutable(dir+'/'+n+'.json',v);
 const publish=s=>{
  const start=Date.now(),p=new PNG({width:s.width,height:s.height});p.data.set(s.rgba);const png=PNG.sync.write(p),name='scene-'+s.frameId+'.png';
  fs.writeFileSync(dir+'/'+name,png,{flag:'wx'});
  latest={...bind(s),width:s.width,height:s.height,capturedAt:s.capturedAt/1000,progress:s.progress,admission:s.admission,png:name,pngSHA256:sha(png)};
  save('scene-'+s.frameId,latest);fs.writeFileSync(dir+'/latest.tmp',JSON.stringify(latest));fs.renameSync(dir+'/latest.tmp',dir+'/latest.json');
  save('publish-'+s.frameId,{start,returnedAt:Date.now(),capturedAt:s.capturedAt});
 };
 const deadline=Date.now()+900000;
 save('lease',{session:'personally-reviewed-native-complex-fixture',startedAt:(deadline-900000)/1000,deadline:deadline/1000,nativeSeconds:900,watchdogSeconds:920,quitReserveSeconds:180,maximumHoldMs:1400,independentUpMs:1750});
 save('fixture-build',{comSha256:sha(f),moduleSha256:sha(vm.bytes),nativeDrawing:true,gameProgress:false});
 engine=await createFiniteEngine({directory:dir,session:'personally-reviewed-native-complex-fixture',deadline,cadenceMs:0,
  review:async(s,refresh)=>{
   publish(s);
   for(;;){
    if(fs.existsSync(dir+'/UNKNOWN.json'))throw Error('terminal UNKNOWN');
    const command=dir+'/command-'+latest.frameId+'.json',decisionPath=dir+'/decision-'+latest.frameId+'.json';
    if(fs.existsSync(decisionPath)){
     const d=JSON.parse(fs.readFileSync(decisionPath));
     if(d.status==='REFUSED_UNSENT'){s=refresh(d);publish(s);continue}
     if(d.status!=='INPUT'||Date.now()-d.at>1000&&!fs.existsSync(command))throw Error('ambiguous command transport');
     if(fs.existsSync(command)){const c=JSON.parse(fs.readFileSync(command));assert.equal(c.nonce,d.nonce);save('native-prewrite-'+latest.frameId,{at:Date.now(),capturedAt:s.capturedAt});return c}
    }else if(fs.existsSync(command))throw Error('command without decision');
    if(fs.existsSync(dir+'/refresh-'+latest.frameId+'.json')){s=refresh();publish(s)}
    if(Date.now()>=deadline)throw Error('native deadline');
    await new Promise(r=>setTimeout(r,10));
   }
  },observe:async(s,a)=>{save('consequence-'+a.nonce,{...bind(s),at:Date.now(),progress:s.progress,rgbaSha256:sha(s.rgba)});publish(s)}});
 process.on('SIGTERM',()=>engine.cancel('fixture cancellation'));
 try{
  await engine.act(adapter);
  while(engine.awaitingExecution&&!engine.done){s.step();progress++;await engine.afterStep(adapter);await new Promise(r=>setTimeout(r,1))}
  for(let i=0;i<100;i++){s.step();progress++}
 }finally{await engine.close();assert.equal(m.mouse.buttons,0);save('fixture-result',{at:Date.now(),control:engine.result,inputCalls,callbacks:vm.mem[(info.cs<<4)+labels.count],nativeMouseButtons:m.mouse.buttons,queuedEvents:m.mouse.events.length,nativeDrawing:true,gameProgress:false})}
})().catch(e=>{console.error(e);process.exitCode=1});
'''


def capture(directory):
    root = Path(directory)
    entered = time.time()
    png = tim.refresh_scene(root)
    returned = time.time()
    scene = json.loads((root / 'latest.json').read_text())
    tim.exclusive(root / ('capture-return-' + scene['frameId'] + '.json'),
                  dict(enteredAt=entered, returnedAt=returned, capturedAt=scene['capturedAt'],
                       frameId=scene['frameId'], nativeToCaptureReturnMs=1000*(returned-scene['capturedAt'])))
    return dict(png=str(png.resolve()), frameId=scene['frameId'], capturedAt=scene['capturedAt'],
                returnedAt=returned)


def gesture(directory, frame, mode, scene, target, consequence, raw, handoff=None):
    """No intent or action is stored until this post-review invocation."""
    root = Path(directory)
    entered = time.time()
    current = json.loads((root / 'latest.json').read_text())
    assert current['frameId'] == frame, 'different scene: inspect full current image again'
    handoff = json.loads(handoff) if handoff else None
    events = []
    original_digest, original_exclusive = tim.digest, tim.exclusive
    original_admit = tim.Policy.admit

    def measured_digest(path):
        before = time.time()
        value = original_digest(path)
        events.append(dict(phase='hash', path=str(path), start=before, end=time.time()))
        return value

    def measured_exclusive(path, value):
        before = time.time()
        original_exclusive(path, value)
        events.append(dict(phase='record', path=Path(path).name, start=before, end=time.time()))

    def pinned_admit(policy, capture, review, action, now=None):
        assert capture == current, 'different scene: inspect full current image again'
        events.append(dict(phase='admit-enter', at=time.time(), frameId=frame))
        return original_admit(policy, capture, review, action, now)

    tim.digest, tim.exclusive = measured_digest, measured_exclusive
    tim.Policy.admit = pinned_admit
    try:
        action = tim.parse_gesture(raw)
        if (root / 'ONE-original-intent.json').exists() and mode != 'quit':
            lease = json.loads((root / 'lease.json').read_text())
            assert time.time() + lease['independentUpMs']/1000 < lease['startedAt'] + 600, 'construction cutoff: start native panel/Quit early'
        validated = time.time()
        result = tim.operate(root, mode, scene, target, consequence, action)
    finally:
        tim.digest, tim.exclusive = original_digest, original_exclusive
        tim.Policy.admit = original_admit
        original_exclusive(root / ('operator-timing-' + frame + '.json'),
                           dict(enteredAt=entered, validatedAt=locals().get('validated'),
                                returnedAt=time.time(), capturedAt=current['capturedAt'], events=events,
                                handoff=handoff,
                                intentCreatedOnlyDuringPostReviewOperate=True))
    return result


def main():
    if sys.argv[1] == '--capture':
        print(json.dumps(capture(sys.argv[2])))
    elif sys.argv[1] == '--gesture':
        print(json.dumps(gesture(*sys.argv[2:])))
    elif sys.argv[1] == '--fixture':
        import os
        root = Path(sys.argv[2]).resolve()
        assert (root.parent / 'predecessors-verified.json').exists()
        os.environ['TIM_PATH_DIR'] = str(root)
        raise SystemExit(tim.supervise(['node', '-e', tim.ENGINE_JS + NATIVE_JS], root, 920))
    elif sys.argv[1] == '--native-opposition':
        import os
        import subprocess
        root = Path(sys.argv[2]).resolve()
        assert (root.parent / 'predecessors-verified.json').exists()
        base_spec = importlib.util.spec_from_file_location('probe', ROOT / 'test/test-tim-smart-handle-controller.py')
        base = importlib.util.module_from_spec(base_spec)
        base_spec.loader.exec_module(base)
        for mode, fault in [('changedscene', 'const original=adapter.capture;adapter.capture=()=>{const f=original();f.rgba[0]^=255;return f};'),
                            ('owner', 'adapter.ownsTarget=()=>false;')]:
            directory = root / mode
            directory.mkdir(parents=True, exist_ok=False)
            source = base.NATIVE_JS
            anchor = 'await new Promise(resolve=>setTimeout(resolve,5100));'
            assert source.count(anchor) == 1
            source = source.replace(anchor, fault).replace('?/review expired/:', '?/binding.capture.ownership changed/:')
            env = dict(os.environ, TIM_PROBE_DIR=str(directory), TIM_PROBE_MODE='writtenstale')
            code = "import importlib.util,json,sys;s=importlib.util.spec_from_file_location('tim','tools/tim-smart-handle-controller.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);raise SystemExit(m.supervise(['node','-e',sys.argv[1]],sys.argv[2],220))"
            p = subprocess.Popen([sys.executable, '-B', '-c', code, tim.ENGINE_JS+source, str(directory)],
                                 env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            wait, out, err = tim.actual_wait(p, directory, 'supervisor-child')
            (directory / 'supervisor.log').write_bytes(out)
            (directory / 'supervisor.stderr').write_bytes(err)
            assert wait['exit'] == 0, err.decode()
            result = json.loads((directory / 'native-probe.json').read_text())
            assert result['result']['status'] == 'UNKNOWN' and result['inputCalls'] == []
            assert result['events'] == [] and result['actualNativeCallbackExecution'] is True
            print('PASS native', mode, 'written UNKNOWN, zero native delivery')
    elif sys.argv[1] == '--pure':
        import tempfile
        import unittest
        from unittest.mock import patch

        class FrameSafety(unittest.TestCase):
            def test_changed_frame_never_creates_intent(self):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    (root / 'latest.json').write_text(json.dumps(dict(frameId='changed')))
                    with patch.object(tim, 'operate') as action:
                        with self.assertRaisesRegex(AssertionError, 'different scene'):
                            gesture(root, 'viewed', 'game', 'full scene', 'target', 'change', '{}')
                        action.assert_not_called()
                    self.assertEqual([p.name for p in root.iterdir()], ['latest.json'])

            def test_bad_schema_never_creates_intent(self):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    (root / 'latest.json').write_text(json.dumps(dict(frameId='viewed', capturedAt=time.time())))
                    with patch.object(tim, 'operate') as action:
                        with self.assertRaises(ValueError):
                            gesture(root, 'viewed', 'game', 'full scene', 'target', 'change',
                                    '{"kind":"click","x":1,"x":2,"y":3,"button":1,"holdMs":100}')
                        action.assert_not_called()
                    self.assertFalse(list(root.glob('command-*')))
                    self.assertFalse(list(root.glob('decision-*')))

            def test_frame_race_between_read_and_admission_is_refused(self):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    (root / 'latest.json').write_text(json.dumps(dict(frameId='viewed', capturedAt=time.time())))

                    def raced(*args):
                        return tim.Policy.admit(None, dict(frameId='new-scene'), {}, {})

                    with patch.object(tim, 'operate', side_effect=raced):
                        with self.assertRaisesRegex(AssertionError, 'different scene'):
                            gesture(root, 'viewed', 'game', 'full scene', 'target', 'change',
                                    '{"kind":"click","x":1,"y":3,"button":1,"holdMs":100}')
                    self.assertFalse(list(root.glob('command-*')))
                    self.assertFalse(list(root.glob('decision-*')))

        outcome = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(FrameSafety))
        raise SystemExit(not outcome.wasSuccessful())
    else:
        raise ValueError('explicit --capture, --gesture, or --fixture required')


if __name__ == '__main__':
    main()
