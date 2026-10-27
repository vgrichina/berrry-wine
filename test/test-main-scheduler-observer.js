'use strict';

// Executes byte-exact slices of the real CLI entry points with stub guest
// exports. No guest, wasm build, browser, Boat, full-runner replacement or
// ThreadManager constructor is used. The extraction receipt identifies every
// executed slice and its actual source; original excerpts are comparison only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createMainSchedulerObserver } = require('./main-scheduler-observer');
const baseline = require('./fixtures/main-scheduler-original.json');
const runSource = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const tmSource = fs.readFileSync(path.join(__dirname, '../lib/thread-manager.js'), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const cut = (s, a, b) => { const i = s.indexOf(a); assert(i >= 0, a); const j = s.indexOf(b, i); assert(j > i, b); return s.slice(i, j); };
function extract(run, tm) {
  return {
    args: cut(run, 'const args = process.argv.slice(2);', '// --tee=PATH:'),
    getArg: cut(run, 'const getArg =', 'const getArgs ='),
    window: cut(run, 'const TRACE_FROM =', '// --decode-stats[=FROM_BATCH]:'),
    flag: run.match(/^const hasFlag = .*;$/m)[0],
    init: cut(run, '  const mainSchedulerObserver =', '  const inputConsumptionTrace ='),
    gate: cut(run, '  const mainExecutionSuspended =', '\n\n  // A main thread parked'),
    ordinary: cut(run, '      if (!mainExecutionSuspended(', '\n    } catch (e) {'),
    worker: cut(run, '      let ran = 0;', '\n      if (TRACE_BATCH_TIMING)'),
    cooperative: cut(run, '      for (let s = 0; s < slices; s++) {', '\n      if (TRACE_BATCH_TIMING)'),
    input: cut(run, '  let lastInputEvent = null;', '\n  // Default hwnd routing:'),
    workerInput: cut(run, '    wh.check_input =', '\n    wh.check_input_lparam'),
    sleep: cut(tm, '  isMainSleeping(', '\n  hasLiveThreads()'),
    live: cut(tm, '  hasLiveThreads()', '\n  // Sleep is a slice yield'),
    note: cut(tm, '  noteMainSleep()', '\n  checkMainYield()'),
  };
}
const production = extract(runSource, tmSource);
const records = logs => logs.filter(x => x.startsWith('[main-scheduler] {')).map(x => JSON.parse(x.slice('[main-scheduler] '.length)));

function harness(parts, { enabled = false, extra = '', mode = 'ordinary', now = 25015,
  deadline = 25021, live = true, real = false, named = false, yieldReason = 0,
  suspended = false, timer = false, renderSend = false, render = false,
  callback = null, pending = null, cross = [], buttons = [], installing = false,
  renderEvent = null, sleepFlag = 0, sleepTimeout = 0, stopped = false,
  serial = false, workerRan = 1, active = true, throws = false, baselineMode = false,
  clockReads = null } = {}) {
  const calls = [], logs = [], dequeues = [], h = {}, wh = {};
  let clock = now, flag = sleepFlag;
  const ex = {
    get_yield_reason() { calls.push('yield'); return yieldReason; },
    get_d3d_render_token() { calls.push('render-token'); return 123; },
    clear_yield() { calls.push('clear-yield'); yieldReason = 0; },
    get_sleep_yielded() { calls.push('sleep-flag'); const v = flag; flag = 0; return v; },
    get_sleep_timeout() { calls.push('sleep-timeout'); return sleepTimeout; },
    get_ticks() { throw Error('consuming ticks probe'); },
    is_mm_timer_callback_active() { calls.push('mm-timer'); return timer; },
    run(size) {
      calls.push(['run', size]);
      if (callback) callback({ h, wh, calls, logs });
      else h.check_input();
      if (throws) throw Error('stub guest exception');
      return 42;
    },
  };
  const methods = vm.runInNewContext('new (class {' + parts.sleep + parts.live + parts.note + '})()');
  const tm = Object.assign(methods, {
    mainInstance: { exports: ex }, _mainSleepUntil: deadline,
    _waitNow() { const value = clockReads?.length ? clockReads.shift() : clock; calls.push(['wait-now', value]); return value; },
    _sleepNow() { calls.push(['sleep-now', clock]); return clock; },
    threads: new Map(live ? [[1, { state: 'waiting' }]] : []),
    isMainNamedEventWaiting() { calls.push('named'); return named; },
    isMainThreadSuspended() { calls.push('suspend'); return suspended; },
    _renderSendTargets: new Set(renderSend ? [ex] : []), backend: mode === 'worker' ? 'worker' : 'cooperative',
    resolveCooperativeThreadSend() { calls.push('resolve-send'); return false; },
    hasActiveThreads() { calls.push('active'); return active; },
    runSlice(size) { calls.push(['slice', size]); return { steps: 1 }; },
    runWorkerSlices(size) { calls.push(['worker-slice', size]); return Promise.resolve(workerRan); },
  });
  const tickState = { batch: 5003 };
  Object.defineProperty(tickState, 'pausedMs', {
    get() { calls.push('paused-read'); return clock - now; },
    set(value) { calls.push(['paused-write', value]); clock = now + value; },
  });
  let factoryCalls = 0;
  const sandbox = {
    process: { argv: ['node', 'test/run.js', ...(enabled ? ['--trace-main-scheduler'] : [])],
      env: { WINE_RUN_EXTRA_ARGS: extra } },
    console: { error() {}, log() {} },
    require(name) { assert.equal(name, './main-scheduler-observer'); factoryCalls++; return { createMainSchedulerObserver }; },
    h, wh, tid: 7, instance: { exports: ex }, threadManager: tm, tickState, logs,
    ctx: { waitD3DRender() { calls.push('wait-render'); }, d3d9Bridge: { requests: new Map() } },
    mainRenderWait: render ? { token: 123, done: false, polls: 0, since: 0 } : null,
    renderWaitAttribution: null, renderParkStats: { skippedBatches: 0 },
    inputEvent: pending, crossThreadMsgs: [...cross], inputQueue: [...buttons], installingFiles: installing,
    renderer: { checkInput() { calls.push('renderer-input'); return renderEvent; } },
    inputConsumptionTrace: { dequeue(evt, source) { dequeues.push([evt, source]); } },
    REAL_TICK_SLEEPS: real, BATCH_SIZE: 100, THREAD_BATCH_SIZE: 120, THREAD_SLICES: 3,
    THREADS_SERIAL: serial, stopped, slices: 3, workerStepsTotal: 0,
  };
  const context = vm.createContext(sandbox);
  const init = baselineMode ? 'const mainSchedulerObserver = null;' : parts.args + '\n' + parts.flag + '\n' + parts.getArg + '\n' + parts.window + '\n' + parts.init;
  vm.runInContext(init + '\n' + parts.input + '\n' + parts.workerInput + '\n' + parts.gate, context);
  return {
    calls, logs, dequeues, context, tm, h, wh, ex, factoryCalls: () => factoryCalls,
    async dispatch(which = mode) {
      const key = which === 'worker' ? 'worker' : which === 'cooperative' ? 'cooperative' : 'ordinary';
      return vm.runInContext('(async () => {\n' + parts[key] + '\n})()', context);
    },
    gate() { return vm.runInContext('mainExecutionSuspended()', context); },
    observer() { return vm.runInContext('mainSchedulerObserver', context); },
  };
}

async function acceptance(parts) {
  // First behavioral checkpoint: actual production initialization, actual gate,
  // ordinary run call and host import entry, disabled then explicitly enabled.
  const off = harness(parts, { now: 25025 });
  await off.dispatch();
  assert.equal(off.factoryCalls(), 0, 'default-off must not initialize observer');
  assert.equal(off.observer(), null);
  assert.deepEqual(records(off.logs), [], 'default-off must emit nothing');
  assert.equal(off.wh.check_input, off.h.check_input, 'default worker import identity');
  assert.equal(off.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 1);
  const due = harness(parts, { enabled: true, now: 25025 });
  await due.dispatch();
  assert.equal(due.factoryCalls(), 1);
  const rows = records(due.logs);
  assert.deepEqual(rows.map(r => r.event), ['decision', 'main-run', 'host-check-input']);
  assert.equal(rows[0].sleepChecks.at(-1).now, 25025);
  assert.equal(rows[0].sleepChecks.at(-1).deadline, 25021);
  assert.equal(rows[0].suspended, false);
  assert.equal(rows[1].decisionId, rows[0].id);
  assert.equal(rows[2].decisionId, rows[0].id);
  assert.equal(rows[2].scope, 'admitted-main-run');
  assert.deepEqual(due.calls, off.calls, 'enabled observer must spend no extra getters/clocks');

  const cases = [
    { now: 25015 }, { now: 25021 }, { now: 25025 }, { deadline: 0 },
    { deadline: 0, sleepFlag: 1, sleepTimeout: 6 },
    { live: false }, { live: false, real: true }, { real: true },
    { named: true }, { renderSend: true }, { yieldReason: 10 },
    { yieldReason: 16, render: true }, { now: 25025, suspended: true },
    { now: 25025, suspended: true, timer: true }, { now: 25025, throws: true },
    { now: 25025, stopped: true }, { now: 25025, active: false },
    { now: 25025, serial: true }, { now: 25025, workerRan: 0 },
  ];
  for (const mode of ['ordinary', 'worker', 'cooperative']) {
    for (const options of cases) {
      const config = { ...options, mode };
      const original = harness(baseline.parts, { ...config, baselineMode: true });
      const disabled = harness(parts, config);
      const enabled = harness(parts, { ...config, enabled: true });
      const results = await Promise.allSettled([original.dispatch(), disabled.dispatch(), enabled.dispatch()]);
      assert.deepEqual(results.map(r => r.status), [results[0].status, results[0].status, results[0].status]);
      assert.deepEqual(disabled.calls, original.calls, `default semantics ${mode} ${JSON.stringify(options)}`);
      assert.deepEqual(enabled.calls, original.calls, `enabled semantics ${mode} ${JSON.stringify(options)}`);
      assert.deepEqual(records(disabled.logs), []);
      const events = records(enabled.logs);
      const decisions = events.filter(r => r.event === 'decision');
      const runs = events.filter(r => r.event === 'main-run');
      const inputs = events.filter(r => r.event === 'host-check-input');
      assert.equal(runs.length, original.calls.filter(x => Array.isArray(x) && x[0] === 'run').length);
      assert.equal(inputs.length, runs.length);
      for (const run of runs) {
        const decision = decisions.find(d => d.id === run.decisionId);
        assert(decision && !decision.suspended && decision.path === run.path);
        assert(inputs.some(i => i.decisionId === decision.id));
      }
      for (const decision of decisions) {
        assert.equal(decision.batch, 5003);
        if (decision.reason === 'sleep') assert(!runs.some(r => r.decisionId === decision.id));
      }
      if (options.now === 25015 || Object.keys(options).length === 1 && options.real) {
        assert.equal(runs.length, 0);
      }
    }
  }
  // No deadline means the existing short circuit spends no wait clock read.
  const noDeadline = harness(parts, { enabled: true, deadline: 0 }); await noDeadline.dispatch();
  assert.equal(noDeadline.calls.some(x => Array.isArray(x) && x[0] === 'wait-now'), false);
  assert(records(noDeadline.logs)[0].sleepChecks.every(x => x.now === null));
  // Existing short circuits must not manufacture a live-thread result.
  const asleep = harness(parts, { enabled: true }); await asleep.dispatch();
  assert.equal(records(asleep.logs)[0].liveThreads, true);
  assert.equal(records(asleep.logs)[0].yieldReason, 0);
  const real = harness(parts, { enabled: true, real: true }); await real.dispatch();
  assert.equal(records(real.logs)[0].liveThreads, null);
  const fast = harness(parts, { enabled: true, live: false }); await fast.dispatch();
  assert.equal(records(fast.logs)[0].fastForward, true);
  assert.equal(records(fast.logs)[0].sleepChecks.at(-1).now, 25021);
  // Two real decision reads may straddle the deadline. The observation must
  // retain the actual read used at each gate, not reconstruct a single time.
  const crossing = harness(parts, { enabled: true, clockReads: [25020, 25021] });
  const originalCrossing = harness(baseline.parts, { baselineMode: true, clockReads: [25020, 25021] });
  await crossing.dispatch(); await originalCrossing.dispatch();
  assert.deepEqual(crossing.calls, originalCrossing.calls);
  assert.deepEqual(records(crossing.logs)[0].sleepChecks.map(x => [x.now, x.sleeping]), [[25020, true], [25021, false]]);
  assert.equal(records(crossing.logs)[0].suspended, false);

  // FIFO and existing input-consumption observation retain priority and values.
  const event = n => ({ msg: 0x100, wParam: n, lParam: 0, hwnd: 0 });
  for (const options of [
    { pending: event(1), cross: [event(2)], buttons: [event(3)], renderEvent: event(4) },
    { cross: [event(2)], buttons: [event(3)], renderEvent: event(4) },
    { buttons: [event(3)], renderEvent: event(4) },
    { buttons: [event(3)], installing: true, renderEvent: event(4) },
    { renderEvent: event(4) }, {},
  ]) {
    const original = harness(baseline.parts, { ...options, baselineMode: true, now: 25025 });
    const observed = harness(parts, { ...options, enabled: true, now: 25025 });
    await original.dispatch(); await observed.dispatch();
    assert.deepEqual(observed.calls, original.calls);
    assert.deepEqual(observed.dequeues, original.dequeues);
    assert.deepEqual(observed.logs.filter(x => !x.startsWith('[main-scheduler]')), original.logs);
    assert.equal(records(observed.logs).at(-1).event, 'host-check-input');
  }
  // A synchronously invoked worker import cannot claim the main-run identity.
  const worker = harness(parts, { enabled: true, now: 25025,
    callback: ({ wh, h }) => { wh.check_input(); h.check_input(); } });
  await worker.dispatch();
  const polls = records(worker.logs).filter(x => x.event === 'host-check-input');
  assert.equal(polls[0].scope, 'worker'); assert.equal(polls[0].decisionId, null);
  assert.equal(polls[0].workerTid, 7); assert.equal(polls[1].scope, 'admitted-main-run');
  worker.h.check_input();
  assert.equal(records(worker.logs).at(-1).scope, 'outside-observed-main-run');
  const thrown = harness(parts, { enabled: true, now: 25025, throws: true });
  await assert.rejects(thrown.dispatch(), /stub guest exception/); thrown.h.check_input();
  assert.equal(records(thrown.logs).at(-1).decisionId, null, 'finally releases run identity');
  const fresh = harness(parts, { enabled: true, now: 25025 }); await fresh.dispatch();
  assert.equal(records(fresh.logs)[0].id, 1, 'new invocation owns counters');
  const extra = harness(parts, { extra: '--trace-main-scheduler', now: 25025 }); await extra.dispatch();
  assert.equal(extra.factoryCalls(), 1, 'real extra-args flag path');
  const unrelated = harness(parts, { extra: '--trace-input-dispatch', now: 25025 }); await unrelated.dispatch();
  assert.equal(unrelated.factoryCalls(), 0);
  const misspelled = harness(parts, { extra: '--trace-main-scheduler=false', now: 25025 }); await misspelled.dispatch();
  assert.equal(misspelled.factoryCalls(), 0, 'exact opt-in token required');
  // The actual shared CLI trace window keeps the budget for the requested
  // late interval instead of exhausting it during thousands of startup gates.
  const windowed = harness(parts, { enabled: true, now: 25025,
    extra: '--trace-from=5003 --trace-to=5003' });
  vm.runInContext('traceGateBatch = 5002;', windowed.context);
  for (let n = 0; n < 400; n++) await windowed.dispatch();
  assert.deepEqual(records(windowed.logs), []);
  vm.runInContext('traceGateBatch = 5003;', windowed.context);
  await windowed.dispatch();
  assert.equal(records(windowed.logs)[0].id, 1);
  assert.equal(records(windowed.logs).length, 3);
  vm.runInContext('traceGateBatch = 5004;', windowed.context);
  await windowed.dispatch();
  assert.equal(records(windowed.logs).length, 3);
  const bounded = harness(parts, { enabled: true, now: 25025 });
  for (let n = 0; n < 400; n++) await bounded.dispatch();
  assert(bounded.logs.length <= 257);
  assert(Buffer.byteLength(bounded.logs.join('\n')) < 256 * 1024);
  assert.equal(bounded.calls.filter(x => Array.isArray(x) && x[0] === 'run').length, 400);
  assert(bounded.logs.at(-1).includes('limit reached'));
  assert.throws(() => createMainSchedulerObserver({ logs: [], limit: -1 }), /invalid/);
  return { firstCheckpoint: 'production default-off then enabled admission/run/host-input PASS',
    scheduleComparisons: cases.length * 3, fifoComparisons: 6, boundedRows: bounded.logs.length };
}

(async () => {
  const result = await acceptance(production);
  // Each mutation must be rejected by the same production contract, rather
  // than a helper-only assertion that merely checks the implementation shape.
  const controls = [
    ['default-on', { ...production, init: production.init.replace("hasFlag('trace-main-scheduler')", 'true') }],
    ['lost-run-wiring', { ...production, ordinary: production.ordinary.replace("mainSchedulerObserver.run('ordinary', () => instance.exports.run(BATCH_SIZE))", 'instance.exports.run(BATCH_SIZE)') }],
    ['extra-consuming-sleep-getter', { ...production, gate: production.gate.replace('threadManager.noteMainSleep();', 'instance.exports.get_sleep_yielded(); threadManager.noteMainSleep();') }],
    ['extra-decision-clock', { ...production, sleep: production.sleep.replace('observe({ now, deadline, sleeping });', 'this._waitNow(); observe({ now, deadline, sleeping });') }],
    ['forced-main-wake', { ...production, gate: production.gate.replace("if (threadManager.isMainSleeping(observation?.sleep)) return finish(true, 'sleep');", "if (false) return finish(true, 'sleep');") }],
    ['lost-worker-provenance', { ...production, workerInput: baseline.parts.workerInput }],
    ['missing-input-entry', { ...production, input: production.input.replace('if (mainSchedulerObserver) mainSchedulerObserver.hostInput();', '') }],
  ];
  const rejected = [];
  for (const [name, parts] of controls) {
    let failure;
    try { await acceptance(parts); } catch (error) { failure = error; }
    assert(failure, 'negative control escaped: ' + name);
    rejected.push({ name, rejected: true, message: failure.message.slice(0, 160) });
  }
  const receipt = { ...result, source: { runnerSHA256: sha(runSource), threadManagerSHA256: sha(tmSource) },
    baseline: { revision: baseline.revision, runnerSHA256: baseline.runnerSHA256, threadManagerSHA256: baseline.threadManagerSHA256 },
    transform: 'exact contiguous source slices, lexical VM context with stub exports; no guest/constructor/full CLI execution',
    excerpts: Object.fromEntries(Object.entries(production).map(([name, text]) => [name, { bytes: Buffer.byteLength(text), sha256: sha(text) }])),
    rejected };
  console.log(JSON.stringify(receipt, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
