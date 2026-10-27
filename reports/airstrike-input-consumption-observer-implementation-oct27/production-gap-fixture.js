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
function fixture(enabled = true) {
  const fail = () => { throw Error('forbidden work/clock/mutation'); };
  const exports = { get_eip: () => 0x55995b, get_yield_reason: () => 1,
    get_wait_handle: () => 0xe0005, get_wait_timeout: () => 100,
    get_focus_hwnd: () => 0x10001, get_main_hwnd: () => 0x10001,
    get_sleep_yielded: fail, run: fail, post_message_q: fail };
  const renderer = { windows: {}, canvas: { width: 800, height: 600 },
    inputQueue: [], _asyncKeys: {32: true}, _physicalKeys: {32: false},
    _asyncPressedKeys: {32: true}, checkInput: fail, getAsyncKeyState: fail };
  const c = vm.createContext({ createInputConsumptionTrace, inputEventHwnd,
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
  vm.runInContext(initialization + input + control, c);
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
} else {
  // Acceptance appended after the pinned gap checkpoint.
  module.exports = { fixture, source, region };
}
