'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, 'repo'));
const { createBatchClock } = require(root + '/lib/batch-clock');
const { createGuestClockSource } = require(root + '/lib/guest-clock');
const { createStartupClock } = require(root + '/lib/startup-clock');
const { createInputConsumptionTrace } = require(root + '/test/input-consumption-trace');
const { inputEventHwnd } = require(root + '/lib/host-window');
const src = fs.readFileSync(root + '/test/run.js', 'utf8');
function slice(a, b) {
  const start = src.indexOf(a), end = src.indexOf(b, start);
  assert(start >= 0 && end > start, a);
  return src.slice(start, end);
}
const setup = slice('  const inputConsumptionTrace = createInputConsumptionTrace({', '  // Every OTHER import table');
const poll = slice('  let lastInputEvent = null;', '  let lastMouseTracePos');
const dispatch = slice("    if (TRACE_INPUT_DISPATCH && (t === 'DispatchMessageA'", '    for (const spec of TRACE_API_MEM)');
const startupWrapper = slice('  if (startupClock.active && !REAL_TICKS) {', '  // Published for the --dx-lock-pause-ms');
// Install the complete production renderer input module without constructing a
// canvas or guest. Region metadata is unused by the tested FIFO/key-state path.
const rendererContext = vm.createContext({
  RegionMap: { BASE: { DI_MOUSE_INPUT_STATE: 0 } }, memUtils: {},
});
vm.runInContext(fs.readFileSync(root + '/lib/renderer-input.js', 'utf8'), rendererContext);
vm.runInContext('class R {} ; installInputHandlers(R); globalThis.RendererInput = R;', rendererContext);
function fixture(enabled, opts = {}) {
  const batchClock = createBatchClock(200);
  const guestClock = opts.clock || createGuestClockSource({ batchClock });
  const renderer = new rendererContext.RendererInput();
  renderer.inputQueue = []; renderer._buttonHoldFloorMs = -1;
  renderer._inputNowMs = () => guestClock.publish();
  const c = vm.createContext({ batchClock, guestClock, tickState: batchClock.state,
    TRACE_INPUT_DISPATCH: enabled, createInputConsumptionTrace, h: {}, logs: [],
    renderer, inputEvent: null, crossThreadMsgs: [], inputQueue: null,
    installingFiles: false, inputEventHwnd,
    memory: { buffer: new ArrayBuffer(1024) }, translateGuest: n => n,
    instance: { exports: { get_esp: () => 64, get_image_base: () => 0 } },
  });
  vm.runInContext(setup + poll, c);
  return { c, batchClock, guestClock, renderer };
}
function run(enabled) {
  const f = fixture(enabled), {c, batchClock, renderer} = f;
  const tuples = [[0x100,65,0x1e0001],[0x101,65,0xc01e0001],
    [0x100,65,0x1e0001],[0x101,65,0xc01e0001],
    [0x201,1,0x8001ffff],[0x202,0,0x8001ffff],
    [0x201,1,0x8001ffff],[0x202,0,0x8001ffff]];
  batchClock.state.batch = 2;
  const identities = [];
  for (const [msg,wParam,lParam] of tuples) {
    c.evt = { msg, wParam, lParam, hwnd: 0 };
    identities.push(c.evt);
    vm.runInContext('renderer.inputQueue.push(inputConsumptionTrace.enqueue(evt, {batch:2}))', c);
  }
  batchClock.state.batch = 7;
  const output = [];
  for (let i=0;i<tuples.length;i++) {
    output.push([c.h.check_input(), c.h.check_input_hwnd(0x123),
      c.h.check_input_wparam(), c.h.check_input_lparam()]);
    assert.strictEqual(renderer._activeInputEvent, identities[i], 'actual renderer retains identity');
  }
  assert.strictEqual(renderer.peekAsyncKeyState(65) & 0x8000, 0);
  const n = c.logs.length;
  assert.strictEqual(c.h.check_input(), 0);
  assert.strictEqual(c.logs.length, n, 'no new observation on empty poll');
  // The WAT caller invokes route only after a nonzero packed event.
  // A fresh no-event route has no dequeue identity and emits no timing record.
  const empty = fixture(enabled); empty.c.h.check_input_hwnd(0x123);
  assert(!empty.c.logs.some(l => l.startsWith('[input-dequeue-route]')));
  batchClock.state.batch = 11;
  const dv = new DataView(c.memory.buffer); dv.setUint32(68,128,true);
  [0x123,0x100,65,0x1e0001].forEach((n,i)=>dv.setUint32(128+i*4,n,true));
  c.t='DispatchMessageA'; vm.runInContext(dispatch,c);
  c.t='DispatchMessageW'; vm.runInContext(dispatch,c);
  if(enabled) {
    const deq = c.logs.filter(l=>l.startsWith('[input-dequeue]'));
    assert.strictEqual(deq.length,8);
    deq.forEach((l,i)=>assert(l.includes(`enqueueId=${i+1} scheduledBatch=2`) && l.includes('batch=7 guestMs=1400')));
    const ds=c.logs.filter(l=>l.startsWith('[dispatch-input]'));
    assert.strictEqual(ds.length,2);
    ds.forEach(l=>assert(l.includes('batch=11 guestMs=2200') && l.includes('correlation=unavailable') && !l.includes('dequeueId=')));
  }
  return {output, state:JSON.stringify(batchClock.state), legacy:c.logs.filter(l=>/^\[check_input/.test(l))};
}
assert.deepStrictEqual(run(true),run(false));
console.log('PASS actual renderer FIFO identity, duplicate balanced keys/mouse, delayed7/later11 dispatch, empty polls, routing, disabled equivalence');
// All record types share the cap; even the clock is not sampled after it.
let samples=0;const logs=[];
const cap=createInputConsumptionTrace({enabled:true,logs,snapshot:()=>{samples++;return {batch:0,guestMs:0};}});
for(let i=0;i<2000;i++) {cap.enqueue({}, {batch:0});cap.dequeue({},'renderer');cap.route(1,2);cap.dispatch('DispatchMessageA',1,0x100,65,0);}
assert.strictEqual(logs.length,1001);assert.strictEqual(samples,1000);
console.log('PASS production1000 cap across mixed observations;1000 snapshots plus one notice');
// Real-clock snapshots use the scaled/mapped publish path without guest probes.
let now=500, probes=0;
const real=createGuestClockSource({realTicks:true,clockOrigin:500,timeScale:2,now:()=>now,mapElapsed:n=>n/4});
real.ticks=()=>{probes++;throw Error('trace spent a guest probe');};
const r=fixture(true,{clock:real});now=700;
r.c.inputEvent={msg:0x100,wParam:65,lParam:0};r.c.h.check_input();
assert(r.c.logs.some(l=>l.includes('guestMs=100 clock=real lastGuestTick=unavailable')));assert.strictEqual(probes,0);
console.log('PASS real scaled/mapped publish and no guest probes');
// Reproducer: execute the unchanged production startup wrapper, not a model
// of its mapping. The advertised lastGuestTick must equal the guest return.
const bc=createBatchClock(200), startupClock=createStartupClock({factor:0.01,maxMs:30000,endOn:'firstPresent:directdraw'});
const c=vm.createContext({batchClock:bc,startupClock,REAL_TICKS:false,ctx:{}});
vm.runInContext(startupWrapper,c);
const clock=createGuestClockSource({batchClock:bc});
Object.assign(c,{guestClock:clock,tickState:bc.state,TRACE_INPUT_DISPATCH:true,createInputConsumptionTrace,logs:[]});
vm.runInContext(setup,c);
bc.state.batch=7;
const actualGuestTick=clock.ticks();
const before=JSON.stringify(bc.state);
vm.runInContext('inputConsumptionTrace.schedule({batch:2,action:"keydown"})',c);
assert.strictEqual(JSON.stringify(bc.state),before,'snapshot spends no batch probe');
const line=c.logs.at(-1), reported=Number(/lastGuestTick=(\d+)/.exec(line)[1]);
assert.strictEqual(actualGuestTick,14);assert.strictEqual(reported,1400);
console.log(JSON.stringify({reproducer:'startup-dilated-batch-clock',actualGuestTick,reportedLastGuestTick:reported,line}));
if(process.argv.includes('--assert-correct-last-tick')) assert.strictEqual(reported,actualGuestTick,'lastGuestTick is not the last guest-visible return');
console.log('CONFIRMED correctness gap: raw lastTick is labeled lastGuestTick under production startup dilation');
