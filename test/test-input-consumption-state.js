'use strict';

// Execute byte-exact production regions in a parked host fixture. No module,
// compiler, guest initializer or game is loaded. The source hash is in receipts.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { inputEventHwnd } = require('../lib/host-window');
const { createInputConsumptionTrace } = require('./input-consumption-trace');
const source = fs.readFileSync(require.resolve('./run.js'), 'utf8');
function region(from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert(a >= 0 && b > a, `production markers: ${from}`);
  return source.slice(a, b);
}
const initialization = region('  const inputConsumptionTrace =', '  // Every OTHER import table');
const input = region('  let lastInputEvent = null;', '  let lastMouseTracePos =');
const control = region('  const controlSafeValue =', '  const control = (CONTROL || CONTROL_STDIN)');
function fixture(enabled = true, factory = createInputConsumptionTrace, controlCode = control) {
  const fail = () => { throw Error('forbidden work/clock/mutation'); };
  const exports = { get_eip: () => 0x55995b, get_yield_reason: () => 1,
    get_wait_handle: () => 0xe0005, get_wait_timeout: () => 100,
    get_focus_hwnd: () => 0x10001, get_main_hwnd: () => 0x10001,
    get_sleep_yielded: fail, run: fail, post_message_q: fail };
  const renderer = { windows: {}, canvas: { width: 800, height: 600 },
    inputQueue: [], _asyncKeys: {32: true}, _physicalKeys: {32: false},
    _asyncPressedKeys: {32: true}, checkInput: fail, getAsyncKeyState: fail };
  const c = vm.createContext({ createInputConsumptionTrace: factory, inputEventHwnd,
    TRACE_INPUT_DISPATCH: enabled, logs: [], h: {}, renderer,
    instance: { exports }, threadManager: { backend: 'cooperative', threads: new Map(),
      _mainThreadState: { state: 'active', suspendCount: 0 }, _mainSleepUntil: 150,
      _waitNow: fail, pollMainWait: fail, runSlice: fail },
    inputEvent: null, crossThreadMsgs: [], inputQueue: [], installingFiles: false,
    scheduledInput: [], tickState: {batch:5003}, controlFrozen: true, controlRunCredits: 0,
    videoRecorder: null, batchClock: {getTickMsPerBatch: () => 5},
    guestClock: {publish: fail, ticks: fail},
    TRACE_API: false, TRACE_API_PAUSED: false,
    parseInputEntries: () => [{ action:'keydown', wParam:32, batch:5003 }],
    liveOutstanding: new Map(), Date: {now: fail},
  });
  // Tracing normally publishes a time on hook calls; count those calls but
  // freeze observation must make none. This fixture never executes a guest.
  let publishes = 0;
  c.guestClock.publish = () => { publishes++; return 15; };
  vm.runInContext(initialization + input + controlCode, c);
  return { c, renderer, exports, publishes: () => publishes,
    trace: vm.runInContext('inputConsumptionTrace', c),
    send: cmd => { c.request = cmd; return JSON.parse(JSON.stringify(vm.runInContext('handleControlCommand(request)', c))); } };
}

if (process.argv.includes('--gap')) {
  const f = fixture();
  const s = f.send({action:'snapshot', id:'before-space'});
  assert(!('inputConsumption' in s));
  assert(!('queues' in s));
  assert.throws(() => f.send({action:'input-state', id:'before-space'}), /need/);
  console.log('PASS pinned production gap: frozen snapshot has no queues/keys/counters/waits; input-state unavailable');
} else if (!process.argv.includes('--remaining')) {
  // Actual flag declaration, not a test-only flag spelling.
  const flag = region("const TRACE_INPUT_DISPATCH = hasFlag('trace-input-dispatch');", '\n');
  for (const enabled of [false, true]) {
    assert.strictEqual(vm.runInNewContext(flag + '\nTRACE_INPUT_DISPATCH', {
      hasFlag: name => enabled && name === 'trace-input-dispatch',
    }), enabled);
  }
  const f = fixture(), off = fixture(false);
  const request = {action:'input-state', id:'space-5003/observe-1'};
  const legacy = f.send({action:'snapshot', id:'legacy'});
  assert.deepStrictEqual(off.send({action:'snapshot', id:'legacy'}), legacy);
  assert(!('queues' in legacy));
  assert.throws(() => off.send(request), /needs --trace-input-dispatch/);
  assert.deepStrictEqual(off.c.logs, []);
  const before = () => JSON.stringify({ renderer:f.renderer, scheduled:f.c.scheduledInput,
    pending:f.c.inputEvent, cross:f.c.crossThreadMsgs, buttons:f.c.inputQueue,
    credits:f.c.controlRunCredits, frozen:f.c.controlFrozen, tick:f.c.tickState,
    main:f.c.threadManager._mainThreadState, sleep:f.c.threadManager._mainSleepUntil,
    threads:[...f.c.threadManager.threads], logs:f.c.logs });
  const a = before(), p = f.publishes();
  const initial = f.send(request);
  assert.strictEqual(initial.requestId, request.id);
  assert.strictEqual(initial.batch, 5003);
  assert.deepStrictEqual(initial.counters, {scheduled:0,enqueued:0,dequeued:0,routed:0,dispatched:0});
  for (const q of ['scheduled','pending','crossThread','buttons','renderer'])
    assert.strictEqual(initial.queues[q].count, 0);
  assert.deepStrictEqual(initial.keys[32], {_physicalKeys:false,_asyncKeys:true,_asyncPressedKeys:true});
  assert.strictEqual(initial.threads.main.yieldReason, 1);
  assert.strictEqual(initial.threads.main.waitHandle, 0xe0005);
  assert.strictEqual(initial.threads.main.sleepUntil, 150);
  assert.strictEqual(initial.threads.main.sleepActive, 'unknown');
  assert.strictEqual(initial.sdlConsumption, 'unknown');
  assert.strictEqual(initial.queues.guestPostQueue, 'unknown');
  assert.strictEqual(before(), a);
  assert.strictEqual(f.publishes(), p, 'frozen read spent clock publication/probe');

  for (const bad of [{action:'input-state'}, {action:'input-state',id:''},
    {action:'input-state',id:3}, {action:'input-state',id:'x'.repeat(129)},
    {action:'input-state',id:'x\ny'}, {...request,n:1}, {...request,cmd:'step 1'}]) {
    assert.throws(() => f.send(bad), /input-state needs only/);
    assert.strictEqual(before(), a);
  }
  for (const [frozen, credits] of [[false,0],[true,1],[true,-1]]) {
    f.c.controlFrozen = frozen; f.c.controlRunCredits = credits;
    const old = before();
    assert.throws(() => f.send(request), /zero credits/);
    assert.strictEqual(before(), old);
  }
  f.c.controlFrozen = true; f.c.controlRunCredits = 0;

  // Run actual production enqueue/ACK branch; ACK cannot increment dequeue.
  assert.deepStrictEqual(f.send({id:'space-down',cmd:'keydown:32'}), {queued:true,batch:5003});
  const pending = f.send(request);
  assert.strictEqual(pending.queues.scheduled.count, 1);
  assert.strictEqual(pending.queues.scheduled.head[0].wParam, 32);
  assert.deepStrictEqual(pending.counters, initial.counters);
  const evt = {hwnd:0,msg:0x100,wParam:32,lParam:0};
  f.c.inputEvent = f.trace.enqueue(evt, {batch:5003});
  assert.strictEqual(f.send(request).queues.pending.count, 1);
  assert.strictEqual(f.send(request).counters.dequeued, 0);
  assert.strictEqual(f.c.h.check_input(), 32 << 16 | 0x100);
  const dequeued = f.send(request);
  assert.strictEqual(dequeued.queues.pending.count, 0);
  assert.strictEqual(dequeued.counters.dequeued, 1);
  assert.strictEqual(dequeued.counters.routed, 0);
  assert.strictEqual(dequeued.last.dequeue.enqueueId, 1);
  assert.strictEqual(dequeued.last.dequeue.source, 'pending');
  assert.strictEqual(f.c.h.check_input_hwnd(0x10001), 0x10001);
  const routed = f.send(request);
  assert.strictEqual(routed.counters.routed, 1);
  assert.strictEqual(routed.last.route.dequeueId, dequeued.last.dequeue.id);
  assert.strictEqual(routed.counters.dispatched, 0);

  // Execute actual production DispatchMessage trace hook against a MSG fixture.
  const dispatch = region("    if (TRACE_INPUT_DISPATCH && (t === 'DispatchMessageA'", '    for (const spec of TRACE_API_MEM)');
  f.c.memory = {buffer:new ArrayBuffer(128)};
  const dv = new DataView(f.c.memory.buffer);
  f.exports.get_esp = () => 0; f.exports.get_image_base = () => 0;
  dv.setUint32(4, 32, true);
  [0x10001,0x100,32,0].forEach((v,i) => dv.setUint32(32+i*4,v,true));
  f.c.t = 'DispatchMessageA'; f.c.translateGuest = n => n;
  vm.runInContext(dispatch, f.c);
  const dispatched = f.send(request);
  assert.strictEqual(dispatched.counters.dispatched, 1);
  assert.strictEqual(dispatched.last.dispatch.correlation, 'unavailable');
  assert.strictEqual(dispatched.last.dispatch.wParam, 32);
  console.log('PASS production flag/init/ACK/control/check_input/route/DispatchMessage boundary; disabled legacy and no-work guards');

  // Bounded state, detached responses, cooperative/worker/unavailable state.
  for (let i = 0; i < 1000; i++) f.renderer.inputQueue.push({...evt});
  for (let i = 0; i < 32; i++) f.c.threadManager.threads.set(i,
    {tid:i,state:'active',sleepUntil:120,instance:{exports:f.exports}});
  const bounded = f.send(request);
  assert.strictEqual(bounded.queues.renderer.count, 1000);
  assert.strictEqual(bounded.queues.renderer.head.length, 16);
  assert.strictEqual(bounded.queues.renderer.truncated, true);
  assert.strictEqual(bounded.threads.count, 32);
  assert.strictEqual(bounded.threads.head.length, 16);
  assert.strictEqual(bounded.threads.truncated, true);
  assert(Buffer.byteLength(JSON.stringify(bounded)) < 16384);
  bounded.last.dequeue.id = -1;
  assert.strictEqual(f.send(request).last.dequeue.id, 1);
  f.c.threadManager.threads = new Map([[9,{tid:9,link:{},state:'active',sleepUntil:120}]]);
  f.c.threadManager.backend = 'worker';
  assert.strictEqual(f.send(request).threads.head[0].eip, 'unknown');
  f.c.threadManager = null; f.c.renderer = null;
  delete f.exports.get_wait_timeout;
  const unavailable = f.send(request);
  assert.strictEqual(unavailable.threads.count, 'unknown');
  assert.strictEqual(unavailable.threads.main.waitTimeout, 'unknown');
  assert.strictEqual(unavailable.keys[32]._asyncKeys, 'unknown');
  assert.strictEqual(unavailable.queues.renderer.count, 'unknown');
  assert.strictEqual(unavailable.threads.main.sleepUntil, 'unknown');

  const cap = fixture(true, options => createInputConsumptionTrace({...options,limit:2,counterLimit:2}));
  for (let i = 0; i < 20; i++) {
    cap.trace.schedule({batch:1});
    cap.trace.enqueue(evt,{batch:1}); cap.trace.dequeue(evt,'pending');
    cap.trace.route(1,1); cap.trace.dispatch('DispatchMessageA',1,0x100,32,0);
  }
  const saturated = cap.send(request);
  assert.deepStrictEqual(saturated.counters,{scheduled:2,enqueued:2,dequeued:2,routed:2,dispatched:2});
  assert.strictEqual(saturated.saturated,true);
  assert.strictEqual(saturated.last.dequeue.id,'unavailable');
  assert.strictEqual(saturated.last.dequeue.enqueueId,'unavailable');
  assert.strictEqual(cap.c.logs.length,3);
  assert.strictEqual(cap.publishes(),2);
  console.log('PASS validation/no side effects, pending/dequeued/routed/dispatched, empty queues, size bounds, saturation, unknown waits/SDL');

  // Reject detached production wiring and forbidden clock reads in observation.
  const detached = fixture(true, createInputConsumptionTrace,
    control.replace("if (cmd.action === 'input-state')", "if (cmd.action === 'detached-input-state')"));
  assert.throws(() => detached.send(request), /need/);
  const probing = fixture(true, createInputConsumptionTrace,
    control.replace('() => ({ scheduledInput', '() => (guestClock.ticks(), { scheduledInput'));
  assert.throws(() => probing.send(request), /forbidden work/);
  const draining = fixture(true, createInputConsumptionTrace,
    control.replace('() => ({ scheduledInput,', '() => ({ scheduledInput: scheduledInput.splice(0),'));
  draining.c.scheduledInput.push({batch:5003});
  draining.send(request);
  assert.throws(() => assert.strictEqual(draining.c.scheduledInput.length,1), /0 !== 1/);
  console.log('PASS rejecting detached wiring, clock probe and queue-draining controls');
} else {
  // Additional source-boundary cases; completed groups need not be repeated.
  const f = fixture(), request = {action:'input-state',id:'extra-boundaries'};
  const evt = {hwnd:0,msg:0x101,wParam:32,lParam:0};
  f.c.renderer = null;
  assert.strictEqual(f.c.h.check_input(),0);
  assert.strictEqual(f.send(request).counters.dequeued,0);
  f.c.crossThreadMsgs.push(evt);
  f.c.h.check_input();
  assert.strictEqual(f.send(request).last.dequeue.source,'cross-thread');
  assert.strictEqual(f.send(request).last.dequeue.enqueueId,'unavailable');
  f.c.inputQueue.push(evt);
  f.c.installingFiles = true;
  assert.strictEqual(f.c.h.check_input(),0);
  assert.strictEqual(f.send(request).queues.buttons.count,1);
  f.c.installingFiles = false;
  f.c.h.check_input();
  assert.strictEqual(f.send(request).last.dequeue.source,'button-queue');
  f.renderer.checkInput = () => evt;
  f.c.renderer = f.renderer;
  f.c.h.check_input();
  assert.strictEqual(f.send(request).last.dequeue.source,'renderer');
  const before = f.send(request).counters;
  for (let i = 0; i < 1200; i++) f.trace.dequeue(evt,'renderer');
  const after = f.send(request);
  assert.strictEqual(after.counters.dequeued,before.dequeued+1200,
    'counters must survive textual trace cap');
  assert.strictEqual(f.c.logs.filter(x => x.includes('further observations suppressed')).length,1);
  const hostile = '\u0000'.repeat(1024);
  const item = Object.fromEntries(['action','batch','hwnd','msg','wParam','lParam'].map(k => [k,hostile]));
  f.c.scheduledInput = Array(1000).fill(item);
  f.c.inputQueue = Array(1000).fill(item);
  f.c.crossThreadMsgs = Array(1000).fill(item);
  f.c.inputEvent = item;
  f.renderer.inputQueue = Array(1000).fill(item);
  const bounded = f.send(request);
  assert(Buffer.byteLength(JSON.stringify(bounded)) < 256*1024);
  assert.strictEqual(bounded.queues.scheduled.head[0].action.length,64);
  f.exports.get_wait_timeout = () => { throw Error('unavailable'); };
  assert.strictEqual(f.send(request).threads.main.waitTimeout,'unknown');
  assert.throws(() => createInputConsumptionTrace({enabled:true,counterLimit:Infinity}),/invalid/);
  const off = fixture(false);
  off.trace.schedule({batch:0}); off.trace.enqueue(evt,{batch:0});
  off.trace.dequeue(evt,'renderer'); off.trace.route(1,1); off.trace.dispatch('DispatchMessageA',1,256,32,0);
  assert.deepStrictEqual(off.c.logs,[]);
  assert.strictEqual(off.publishes(),0);
  console.log('PASS empty poll, cross-thread/button/renderer hooks, blocked poll, counters after log cap, hostile size bound, throwing getter unknown and disabled hooks');
  if (process.env.INPUT_STATE_RECEIPT) fs.writeFileSync(process.env.INPUT_STATE_RECEIPT,
    JSON.stringify({kind:'production-region fixture, no guest',sample:after,hostileResponseBytes:Buffer.byteLength(JSON.stringify(bounded))},null,2)+'\n');
}
