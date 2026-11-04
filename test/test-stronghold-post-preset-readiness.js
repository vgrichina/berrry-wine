'use strict';
// Offline evidence/driver controls. No emulator, browser, game execution or input.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const prior = path.join(root, 'scratch/runs/20261104-stronghold-setup-preset-native-world');
const native = require('../scratch/runs/20261104-stronghold-explicit-idle-input/native-start-boundary.cjs');
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.existsSync(p) ? fs.readFileSync(p) : zlib.gunzipSync(fs.readFileSync(p + '.gz'));
const seal = JSON.parse(read(path.join(prior, 'artifact-seal.json')));
function retained(name) {
  const pin = seal.files.find(f => f.path === name);
  assert.ok(pin, 'original seal entry: ' + name);
  const b = read(path.join(prior, name));
  assert.equal(b.length, pin.bytes); assert.equal(hash(b), pin.sha256);
  return b;
}
const snapshot = JSON.parse(retained('recovered/closed/route-native-boundary-19.json'));
const failedPNG = retained('recovered/closed/route-native-boundary-19.png');
const failedClass = native.classifyPNG(failedPNG);
assert.equal(hash(failedPNG), '9fcc66eea4ba565a7fce8bc891e811219687e1c2f5f9419f806361aee9c404fe');
assert.equal(failedClass.scene, 'unknown');
assert.equal(failedClass.patches[0].sha256, native.PATCHES[0].scenario[0]);
assert.notEqual(failedClass.patches[1].sha256, native.PATCHES[1].scenario[0]);
native.assertReady(snapshot.state); // Drained host is necessary, insufficient for native setup.
const readyPNG = read(path.join(root, 'scratch/runs/20261104-stronghold-browser-village/review/zephyr-ready.png'));
assert.equal(hash(readyPNG), 'e0dda59a268679e21f6bc31f15e80ea2420c51544267d4c789edd38fbd07ef93');
assert.equal(native.classifyPNG(readyPNG).scene, 'scenario');
const source = retained('route-driver.cjs').toString();
assert.equal(hash(source), 'bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de');

// Actual original PE bytes, not a reconstructed handler. Address mapping is
// derived from PE sections so a changed executable fails before interpretation.
const exe = fs.readFileSync(path.join(root, 'test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe'));
assert.equal(hash(exe), '9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f');
const pe = exe.readUInt32LE(0x3c), opt = pe + 24, imageBase = exe.readUInt32LE(opt + 28);
const sections = pe + 24 + exe.readUInt16LE(pe + 20);
function bytes(va, n) {
  const rva = va - imageBase;
  for (let i = 0; i < exe.readUInt16LE(pe + 6); i++) {
    const s = sections + i * 40, start = exe.readUInt32LE(s + 12), size = exe.readUInt32LE(s + 16);
    if (rva >= start && rva + n <= start + size) {
      const off = exe.readUInt32LE(s + 20) + rva - start;
      return exe.subarray(off, off + n);
    }
  }
  throw Error('unmapped original VA');
}
function instruction(va, hex) { assert.equal(bytes(va, hex.length / 2).toString('hex'), hex, va.toString(16)); }
// Preset-1 activation queues choice 1 and explicitly clears the native edge.
instruction(0x42da1c, 'c7055c16690001000000');
instruction(0x42da26, 'c7057c0f690001000000');
instruction(0x42da71, '8935a426bd01');
// Update does not apply the pending preset on input-free frames when edge=0.
instruction(0x42db53, '391da426bd01');
instruction(0x42db59, '742c');
instruction(0x42db72, 'e819090000'); // call 0x42e490 (application handler)
// Native mouse poll clears edge, sets it only on a new held transition.
instruction(0x468b41, '897e34');
instruction(0x468b50, '895e34');
// The main loop supplies this exact mouse object to that poll method.
instruction(0x576a7e, 'b97026bd01e8a81eefff');
assert.equal(0x1bd2670 + 0x34, 0x1bd26a4);
instruction(0x42d866, 'a32c336900'); // hover-only description index
instruction(0x429b1b, 'e820400000'); // setup drawing calls pending updater
// Pending callback and hover callback are distinct in original descriptor.
assert.equal(bytes(0x5ba668 + 0x14, 4).readUInt32LE(), 0x42d880);
assert.equal(bytes(0x5ba668 + 0x1c, 4).readUInt32LE(), 0x42d850);
assert.equal(bytes(0x5ba6b8 + 0x18, 4).readUInt32LE(), 1);

// Execute unchanged route state machine with an explicitly synthetic IO/base
// adapter. This tests route guards, NOT delivery or native transition causality.
function fixture(outcome = 'zephyr-ready', maxSteps = 4096) {
  let image = 'choose-type', stage = 'choose', used = 0, expired = false;
  const s = structuredClone(snapshot.state), events = [], steps = [];
  function input(msg, mask, point) {
    const m = s.main, hwnd = m.windows.find(w => w.visible).hwnd;
    const e = type => ({msg:type, hwnd, mouseX:point.x, mouseY:point.y, mouseButtons:mask,
      wParam:type === 0x84 ? 0 : mask, lParam:((point.y & 65535) << 16) | (point.x & 65535)});
    m.mouseButtonsMask = mask; m.inputTelemetry.mouseButtons = mask;
    m.inputQueue = msg === 0x201 ? [e(0x84), e(msg)] : [e(msg)];
    m.activeInput = null; m.lastInput = null;
    Object.assign(m.inputTelemetry.hostRendererFields, {active:null, mask, queue:m.inputQueue});
    events.push(msg);
    if (msg === 0x200) image = stage === 'choose' ? 'choose-type-custom-hover' : 'actual-scene20-preset1-hover';
    if (msg === 0x202) {
      image = stage === 'choose' ? 'actual-scene20-observation' : outcome;
      stage = 'preset';
    }
  }
  const io = {state:async()=>s, controls:()=>({keys:[], buttons:[]}),
    move:async p=>input(0x200,0,p), down:async p=>input(0x201,1,p), up:async p=>input(0x202,0,p)};
  class Base {
    constructor(io, options) { this.io=io; this.max=options.maxSteps; this.used=0; }
    async step() {
      if (this.used + 64 > this.max) throw Error('aggregate step cap');
      this.used += 64; used=this.used; steps.push(64);
      s.main.inputQueue=[]; s.main.activeInput=null; s.main.lastInput=null;
      Object.assign(s.main.inputTelemetry.hostRendererFields,{active:null,queue:s.main.inputQueue});
    }
    async capture() { return {png:Buffer.from(image), state:structuredClone(s), geometry:s.main.geometry}; }
  }
  const deps = {
    '../20261104-stronghold-explicit-idle-input/native-start-boundary.cjs': {...native, NativeStartDriver:Base, pageAdapter:()=>io},
    './navigation.cjs': {scene:b=>b.toString(), routes:{'choose-type':{x:1,y:2},'actual-scene20-observation':{x:67,y:491,expected:'zephyr-ready'}}},
    './integer-route-point.cjs':{integerRoutePoint:(_g,x,y)=>({x,y})},
    './presentation.cjs':{qualifiedIO:x=>x},
    './freshness.cjs':{assertFresh:(a,b)=>assert.equal(hash(a.png),hash(b.png))},
    './independent-layout.cjs':{classify:b=>b.toString()}
  };
  const mod={exports:{}};
  vm.runInNewContext('(function(require,module){'+source+'\n})', {Buffer})(name=>{
    assert.ok(deps[name], name); return deps[name];
  },mod);
  const options={maxSteps, page:{}, boundary:{run:f=>f()}, review:async c=>({personallyViewed:true,observation:'synthetic control',sha256:c.sha256,scene:c.scene}), live:()=>{if(expired)throw Error('original deadline');}};
  const driver=mod.exports.createRouteDriver(options);
  return {driver, dispatch:action=>driver.dispatch({action}), used:()=>used, events, steps,
    expire:()=>{expired=true;}, module:mod.exports, options, state:s};
}
async function reachPreset(f) {
  for (const action of ['route-review-choose','route-review-hover','route-gesture',
    'route-stability','route-stability','route-stability','route-review','route-next','route-review-preset-hover']) await f.dispatch(action);
}
(async()=>{
  const positive=fixture(); await reachPreset(positive);
  const result=await positive.dispatch('route-press-preset');
  assert.equal(result.continuation,'handoff'); assert.equal(result.steps,1152);
  const handoff=await positive.dispatch('route-handoff'); assert.equal(handoff.startExecuted,false);
  assert.ok(positive.steps.every(n=>n===64));
  await assert.rejects(positive.dispatch('route-press-preset'),/route terminal/);
  for(const scene of ['unknown','world','actual-scene20-observation']) {
    const negative=fixture(scene); await reachPreset(negative);
    await assert.rejects(negative.dispatch('route-press-preset'),new RegExp('first unexpected preset result: '+scene));
    const stopped=negative.used(), count=negative.events.length;
    await assert.rejects(negative.dispatch('route-arrival'),/route terminal/);
    await assert.rejects(negative.dispatch('route-handoff'),/route terminal/);
    assert.equal(negative.used(),stopped); assert.equal(negative.events.length,count);
  }
  const deadline=fixture(); await reachPreset(deadline); deadline.expire();
  const before=deadline.used(); await assert.rejects(deadline.dispatch('route-press-preset'),/original deadline/);
  assert.equal(deadline.used(),before);
  await assert.rejects(deadline.dispatch('route-press-preset'),/route terminal/);
  const capped=fixture('zephyr-ready',1024); await reachPreset(capped);
  await assert.rejects(capped.dispatch('route-press-preset'),/aggregate step cap/);
  assert.equal(capped.used(),1024);
  assert.throws(()=>positive.module.createRouteDriver({...positive.options,maxSteps:4097}),/aggregate cap 4096/);
  const telemetry=fixture(); telemetry.module.telemetry(telemetry.state);
  telemetry.state.main.inputTelemetry.hostRendererFields.mask=1;
  assert.throws(()=>telemetry.module.telemetry(telemetry.state),/foreign renderer/);
  console.log('PASS original PE gates; sealed boundary19 rejected; exact ready positive; unchanged route positive/three unexpected scenes/terminal/deadline/aggregate/ACK/foreign telemetry controls. Synthetic IO is not native settling proof.');
})().catch(e=>{console.error(e);process.exitCode=1;});
