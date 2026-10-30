'use strict';
// Execute byte-exact production initialization, check_input, admission and run
// call sites in a VM with controlled guest exports. This is a JS boundary test,
// not a compiled guest or gameplay test. No SDL/renderer behavior is simulated
// as acceptance evidence. A queue here is only an import-boundary fixture.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');
const runner = process.argv[2] || path.join(__dirname, 'run.js');
const observer = require(path.resolve(process.argv[3] || path.join(__dirname, 'main-scheduler-observer.js')));
const trace = require(path.join(__dirname, 'input-consumption-trace.js'));
const source = fs.readFileSync(runner, 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const oid = crypto.createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
assert(['579bca6fb9b6ab117a403dead93eddd6ca0e2338',
  '30b8b056dc87471e4d8a04fd2bc6bfaf615c587f'].includes(oid), 'unrecognized production runner');
function span(start, end) {
  const at = source.indexOf(start); assert(at >= 0 && at === source.lastIndexOf(start), start);
  const to = source.indexOf(end, at); assert(to > at, end);
  return source.slice(at, to);
}
const initialize = span("  const mainSchedulerObserver = hasFlag('trace-main-scheduler')", '  let lastMouseTracePos');
const admission = span('  const mainExecutionSuspended = ', '  // A main thread parked on a software D3D request');
const run = span("      if (!mainExecutionSuspended('ordinary')) {", '    } catch (e) {');
const worker = span('    wh.check_input = mainSchedulerObserver', '    wh.check_input_lparam');
const mutate = process.env.TUX_POLL_CONTROL === 'remove-poll-hook';
function fixture(enabled = true) {
  const logs = []; let parked = false, poll = true, fault = null, checks = 0, calls = 0;
  const queue = [];
  const ex = { get_yield_reason: () => 0, run: budget => {
    assert.equal(budget, 23); calls++;
    if (fault) throw fault;
    return poll ? context.h.check_input() : 99;
  }};
  const context = vm.createContext({ logs, h: {}, ctx: {}, renderer: {
    inputQueue: queue, checkInput: () => { checks++; return queue.shift() || null; } },
    hasFlag: name => enabled && name === 'trace-main-scheduler', traceWindowOpen: () => true,
    require: name => { assert(enabled); assert.equal(name, './main-scheduler-observer');
      return { createMainSchedulerObserver: opts => observer.createMainSchedulerObserver({
        ...opts, limit: 4, summaryEvery: 1 }) }; },
    createInputConsumptionTrace: trace.createInputConsumptionTrace,
    TRACE_INPUT_DISPATCH: true, guestClock: { ticks: () => 17, publish: () => 17 },
    tickState: { batch: 0, pausedMs: 0 }, CALENDAR_ORIGIN_MS: 0,
    inputEvent: null, crossThreadMsgs: [], inputQueue: [], installingFiles: false,
    inputEventHwnd: (evt, exports) => exports.get_focus_hwnd(),
    instance: { exports: ex }, BATCH_SIZE: 23, REAL_TICK_SLEEPS: false,
    renderWaitAttribution: null, mainRenderWait: null, renderParkStats: { skippedBatches: 0 },
    threadManager: { isMainNamedEventWaiting: () => parked, _renderSendTargets: new Set(),
      noteMainSleep() {}, isMainSleeping: () => false, isMainThreadSuspended: () => false },
    wh: {}, tid: 7,
  });
  vm.runInContext((mutate ? initialize.replace('if (mainSchedulerObserver) mainSchedulerObserver.hostInput();', '') : initialize)
    + admission + worker + '\nglobalThis.slice = () => {' + run + '};', context);
  return { context, logs, queue, ex, batch: n => { context.tickState.batch = n; context.slice(); },
    parked: v => { parked = v; }, poll: v => { poll = v; }, fault: v => { fault = v; },
    counts: () => ({ checks, calls }),
    summaries: () => logs.filter(s => s.startsWith('[main-scheduler-summary] '))
      .map(s => JSON.parse(s.slice('[main-scheduler-summary] '.length))) };
}
// Start at the actual production initializer/import boundary before broad
// module tests. First Enter and later keyup both cross this import when called.
const f = fixture();
f.queue.push({ msg: 0x100, wParam: 13, lParam: 1 }); f.batch(21787);
f.queue.push({ msg: 0x101, wParam: 13, lParam: 1 }); f.batch(26000);
f.poll(false); f.queue.push({ msg: 0x100, wParam: 13, lParam: 1 }); f.batch(30000);
f.parked(true); f.batch(31000); f.batch(32000);
let s = f.summaries().at(-1);
assert(s, 'bounded summary must survive detail exhaustion');
assert.equal(s.totals.runs, 3); assert.equal(s.totals.returned, 3);
assert.equal(s.totals.mainPolls, 2); assert.equal(s.totals.suspended, 1);
assert(f.logs.some(s => s.includes('"event":"main-run-finish"') &&
  s.includes('"returned":true') && s.includes('"mainPolls":1')));
assert.equal(s.lastDecision.reason, 'named-event'); assert.equal(f.queue.length, 1);
assert.deepEqual(f.counts(), { checks: 2, calls: 3 });
assert.equal(f.logs.filter(s => s.startsWith('[input-dequeue]')).length, 2);
// Worker attribution must remain distinct even inside an admitted main run.
f.parked(false); f.ex.run = () => f.context.wh.check_input(); f.batch(33000); f.batch(34000);
s = f.summaries().at(-1); assert.equal(s.totals.workerPolls, 1); assert.equal(s.totals.mainPolls, 2);
// The runner's ordinary boundary propagates a guest exception unchanged;
// diagnostics count the failed return and restore attribution afterwards.
const failure = new Error('guest-sentinel'); f.ex.run = () => { throw failure; };
assert.throws(() => f.batch(35000), e => e === failure);
f.context.h.check_input(); f.parked(true); f.batch(36000);
s = f.summaries().at(-1); assert.equal(s.totals.threw, 1); assert.equal(s.totals.outsidePolls, 1);
assert(f.logs.some(s => s.includes('limit reached')));
assert(f.logs.filter(s => s.startsWith('[main-scheduler] ')).length <= 5);
const off = fixture(false); off.queue.push({ msg: 0x100, wParam: 13, lParam: 1 }); off.batch(1);
assert.deepEqual(off.counts(), { checks: 1, calls: 1 }); assert.equal(off.summaries().length, 0);
// Independent module checks: return identity, exception identity and hard caps.
const logs = [], o = observer.createMainSchedulerObserver({ logs, limit: 1, summaryEvery: 1, summaryLimit: 2 });
const sentinel = {};
assert.strictEqual(o.run('outside', () => sentinel), sentinel);
for (let batch = 0; batch < 100; batch++) o.begin('ordinary', batch).finish(true, 'sleep');
assert.equal(logs.filter(s => s.startsWith('[main-scheduler-summary]')).length, 2);
assert(logs.length <= 4);
assert.throws(() => observer.createMainSchedulerObserver({ logs, summaryLimit: 129 }));
console.log(JSON.stringify({ PASS: true, runnerOID: oid, runnerSHA256: hash(source),
  spans: Object.fromEntries(Object.entries({ initialize, admission, run, worker })
    .map(([name, body]) => [name, { bytes: Buffer.byteLength(body), sha256: hash(body) }])),
  groups: ['production-initialization/import/admission/run', 'runnable-no-poll-vs-parked',
    'worker-attribution', 'throw-identity-and-restoration', 'disabled-parity', 'independent-summary-cap'] }));
