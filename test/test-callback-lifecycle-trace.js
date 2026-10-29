'use strict';

// Local production-component / wire test. No PE, browser or guest is run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createAudioHost } = require('../lib/host-audio');
const { ThreadManager } = require('../lib/thread-manager');
const { createCallbackLifecycleTrace } = require('../lib/callback-lifecycle-trace');
const { compile } = require('../tools/watx');
const raw = fs.readFileSync(require.resolve('../src/13-exports.wat'), 'utf8');
const handlers = fs.readFileSync(require.resolve('../src/09a-handlers.wat'), 'utf8');
const clean = s => s.replace(/;;[^\n]*/g, '');
function form(source, key) {
  source = clean(source);
  const start = source.indexOf(key);
  assert(start >= 0, key);
  let depth = 0;
  for (let n = start; n < source.length; n++) {
    if (source[n] === '(') depth++;
    if (source[n] === ')' && --depth === 0) return source.slice(start, n + 1);
  }
  throw new Error('unclosed form ' + key);
}

function makeExports(mutation = '') {
  // Extract the ACTUAL admission, restoration and validated finish function.
  // Synthetic helpers stand in for guest memory/continuation authentication;
  // they do not implement or claim to test the x86 RET/invocation validator.
  let functions = ['fire_wave_out_callback_bound', 'fire_audio_callback_bound',
    'wave_callback_restore_wait'].map(n => form(raw, '(func $' + n)).join('\n');
  functions += '\n' + form(handlers, '(func $mm_callback_finish');
  const start = raw.indexOf('  (global $audio_trace_enabled');
  const diagnostics = raw.slice(start, raw.indexOf('  (func $fire_audio_callback_bound', start));
  functions += '\n' + diagnostics;
  if (mutation === 'omitted') functions = functions.replace(
    '(global.set $audio_trace_returned (global.get $audio_trace_active))', '');
  if (mutation === 'mismatch') functions = functions.replace(
    '(global.set $audio_trace_returned (global.get $audio_trace_active))',
    '(global.set $audio_trace_returned (i32.add (global.get $audio_trace_active) (i32.const 1)))');
  const getters = ['get_eip', 'get_esp', 'get_current_thread_id', 'get_yield_reason',
    'get_wait_handle', 'get_wait_timeout', 'get_wait_stack_bytes', 'is_mm_timer_callback_active'];
  functions += '\n' + getters.map(n => form(raw, '(func (export "' + n + '")')).join('\n');
  const names = new Set([...functions.matchAll(/global\.(?:get|set) (\$[\w_]+)/g)].map(m => m[1]));
  const globals = [...names].filter(n => !n.startsWith('$audio_trace_')).map(n =>
    `(global ${n} (mut i32) (i32.const 0))`).join('\n');
  const source = `(memory 1) (export "memory" (memory 0))
    ${globals}
    (global $saved_eip (mut i32) (i32.const 0))
    (global $saved_esp (mut i32) (i32.const 0))
    (func $mm_callback_begin (param i32) (param i32)
      (i32.store offset=20 (i32.const 128) (i32.const 1))
      (global.set $mm_callback_depth (i32.const 1)))
    (func $mm_callback_check (result i32) (i32.const 128))
    (func $invocation_leave (param i64))
    (func $save_caller_regs
      (global.set $saved_eip (global.get $eip))
      (global.set $saved_esp (i32.load offset=16 (global.get $reg_base))))
    (func $restore_caller_regs
      (global.set $eip (global.get $saved_eip))
      (i32.store offset=16 (global.get $reg_base) (global.get $saved_esp)))
    (func $gs32 (param $addr i32) (param $value i32)
      (i32.store (local.get $addr) (local.get $value)))
    (func (export "init") (param $tid i32)
      (global.set $current_thread_id (local.get $tid))
      (global.set $reg_base (i32.const 0))
      (global.set $eip (i32.const 4660))
      (i32.store offset=16 (i32.const 0) (i32.const 60000))
      (global.set $yield_reason (i32.const 1))
      (global.set $wait_handle (i32.const 917508))
      (global.set $wait_timeout (i32.const -1))
      (global.set $wait_stack_bytes (i32.const 12)))
    (func (export "finish") (call $mm_callback_finish))
    ${functions}`;
  const result = compile(source, new Map(), { mode: 'production' });
  assert(result.success, result.error);
  const e = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
  e.init(1);
  return e;
}

function audio(e, trace) {
  const memory = new SharedArrayBuffer(65536);
  const voices = { _map: {}, notifyPump: () => 0, open: () => 7, _installUnlock() {} };
  const sharedAudio = { voices };
  const ctx = { exports: e, sharedAudio, getMemory: () => memory, audioClockMs: () => 100 };
  if (trace) ctx.callbackLifecycleTrace = trace;
  const host = createAudioHost(ctx, {});
  const handle = host.imports.wave_out_open(22050, 2, 16, 3, 0xec9bd0, 123);
  for (const addr of [4096, 8192]) {
    new DataView(memory).setUint32(addr + 16, 0x10, true);
    host.imports.wave_out_schedule_done(handle, addr, addr, 0);
  }
  return { host, sharedAudio };
}

// Earliest production boundary first: the actual CLI initialization and host
// pump, with the exact WAT functions above. No surrogate callback pump.
const cli = fs.readFileSync(require.resolve('./run.js'), 'utf8');
const cliInit = cli.slice(cli.indexOf('  const callbackLifecycleTrace ='), cli.indexOf('  // Drain by walking'));
for (const enabled of [false, true]) {
  const listeners = [], output = [];
  vm.runInNewContext(cliInit, {
    hasFlag: n => enabled && n === 'trace-callback-lifecycle',
    require: name => { assert(enabled); assert.equal(name, '../lib/callback-lifecycle-trace'); return { createCallbackLifecycleTrace }; },
    process: { once: (name, fn) => { assert.equal(name, 'exit'); listeners.push(fn); } },
    console: { log: s => output.push(s) },
  });
  assert.equal(listeners.length, enabled ? 1 : 0);
  listeners.forEach(fn => fn());
  assert.equal(output.length, enabled ? 1 : 0);
}
assert(cli.includes('    callbackLifecycleTrace,\n    audioTap:'));
assert(cli.includes('    traceThread: TRACE_THREAD,\n    callbackLifecycleTrace,'));

const baseline = makeExports(), traced = makeExports();
const trace = createCallbackLifecycleTrace(), off = audio(baseline), on = audio(traced, trace);
for (const a of [off, on]) a.host.pumpWaveOutCompletions();
assert.equal(trace.snapshot().events.filter(e => e.event === 'returned').length, 0);
assert.equal(trace.snapshot().pending.length, 1); // fire result is admission only
for (const a of [off, on]) a.host.pumpWaveOutCompletions(); // active callback rejects next item
assert.equal(on.sharedAudio.waveFunctionDoneQueue.length, 1);
for (const e of [baseline, traced]) e.finish();
for (const a of [off, on]) a.host.pumpWaveOutCompletions(); // observes real marker before next admission
for (const e of [baseline, traced]) e.finish();
for (const a of [off, on]) a.host.pumpWaveOutCompletions(); // no queue item required to observe return
assert.deepEqual(new Uint8Array(baseline.memory.buffer), new Uint8Array(traced.memory.buffer));
for (const getter of ['get_eip', 'get_esp', 'get_yield_reason', 'get_wait_handle', 'get_wait_timeout']) {
  assert.equal(baseline[getter](), traced[getter]());
}
assert.equal(baseline.get_audio_callback_trace(0), 0);
assert.equal(baseline.get_audio_callback_trace(1), 0);
const events = trace.snapshot().events;
assert.deepEqual(events.map(e => e.event), ['admitted', 'busy', 'returned', 'admitted', 'returned']);
const returns = events.filter(e => e.event === 'returned');
assert.equal(returns.length, 2);
assert.notEqual(returns[0].token, returns[1].token);
assert.notEqual(returns[0].submission, returns[1].submission);
assert.deepEqual(returns.map(e => e.header), [4096, 8192]);
assert.deepEqual(returns[0].returned, { eip: 4660, esp: 60000, yield: 1,
  wait: 0xe0004, timeout: 0xffffffff, stackBytes: 12 });
assert.equal(events[0].saved.wait, returns[0].returned.wait);
assert.equal(events[1].queueBefore, events[1].queueAfter);
assert.equal(events[1].token, null); // a busy attempt must not borrow the in-flight identity
assert.equal(events[1].activeToken, events[0].token);

// Distinguishing controls: same production function, omitted or mismatched
// WAT return store must fail the positive lifecycle oracle.
function positiveOracle(mutation) {
  const e = makeExports(mutation), t = createCallbackLifecycleTrace(), a = audio(e, t);
  a.host.pumpWaveOutCompletions(); e.finish();
  const s = t.snapshot();
  assert.equal(s.events.filter(v => v.event === 'returned').length, 1);
}
positiveOracle('');
for (const mutation of ['omitted', 'mismatch']) assert.throws(() => positiveOracle(mutation), assert.AssertionError);

const interleaved = createCallbackLifecycleTrace();
const e1 = makeExports(), e2 = makeExports(); e2.init(2);
const a1 = audio(e1, interleaved), a2 = audio(e2, interleaved);
a1.host.pumpWaveOutCompletions(); a2.host.pumpWaveOutCompletions();
e2.finish(); interleaved.observe(e2); e1.finish(); interleaved.observe(e1);
const r = interleaved.snapshot().events.filter(v => v.event === 'returned');
assert.deepEqual(r.map(v => v.thread), [2, 1]);
assert.notEqual(r[0].owner, r[1].owner); // equal instance-local tokens never merge owners

const legacy = createCallbackLifecycleTrace(), fake = { fire_wave_out_callback_bound: () => 1 };
audio(fake, legacy).host.pumpWaveOutCompletions();
assert.equal(legacy.snapshot().events[0].completion, 'unavailable');
assert.equal(legacy.snapshot().events.some(v => v.event === 'returned'), false);
const tiny = createCallbackLifecycleTrace({ capacity: 2 });
for (let i = 0; i < 9; i++) tiny.semaphore({ event: 'test', i }, null);
assert.equal(tiny.snapshot().events.length, 2);
assert.deepEqual(tiny.snapshot().events.map(v => v.i), [7, 8]);
assert.equal(tiny.snapshot().overwritten, 7);
assert.throws(() => createCallbackLifecycleTrace({ capacity: 257 }), RangeError);

// New semaphore trace interactions only: actual release/grant/acquire code,
// with synthetic parked thread exports (not SDL execution).
const st = createCallbackLifecycleTrace(), semCallback = makeExports();
const semMain = { ...semCallback, get_sync_table: () => 0 };
audio(semMain, st).host.pumpWaveOutCompletions();
const tm = new ThreadManager(null, { buffer: new SharedArrayBuffer(65536) }, { exports: semMain }, null,
  { callbackLifecycleTrace: st });
const sem = tm.createSemaphore(0, 4, '');
const parked = { state: 'active', instance: { exports: {
  get_yield_reason: () => 1, get_wait_handle: () => sem,
  get_wait_handles_ptr: () => 0, get_wait_stack_bytes: () => 12, get_current_thread_id: () => 2,
} } };
tm.threads.set(1, parked);
assert.equal(tm.releaseSemaphore(sem, 1, 0), 1);
assert.equal(parked.grantedWait, sem);
assert.equal(parked.grantedWaitTrace, 1);
const se = st.snapshot().events.filter(v => v.event.startsWith('semaphore-'));
assert.equal(se[0].event, 'semaphore-grant');
assert.equal(se[0].context.thread, 2);
assert.equal(se[0].release, se[1].release);
assert.equal(se[0].handle, se[1].handle);
assert.equal(se[1].callbackToken, st.snapshot().events[0].token);
assert.equal(se[1].owner, st.snapshot().events[0].owner);
assert.equal(se[1].context.thread, 1);
assert.deepEqual([se[1].before, se[1].after, se[1].result], [0, 0, 1]);
// Extract and execute the actual consumption branch; the enclosing scheduler
// needs a full guest. This is a wire test of trace placement, not a runSlice claim.
const managerSource = fs.readFileSync(require.resolve('../lib/thread-manager'), 'utf8');
const consumeStart = managerSource.indexOf('            result = 0;   // a release already handed this wait its unit');
const consume = managerSource.slice(consumeStart, managerSource.indexOf('          } else {', consumeStart));
vm.runInNewContext(consume, { thread: parked, waitHandle: sem, e: parked.instance.exports, result: null,
  _callbackLifecycleTrace: st });
assert.equal(st.snapshot().events.at(-1).event, 'semaphore-grant-consumed');
assert.equal(st.snapshot().events.at(-1).release, 1);
assert.equal(parked.grantedWaitTrace, null);
tm.threads.clear();
assert.equal(tm.releaseSemaphore(sem, 1, 0), 1);
assert.equal(tm.waitSingle(sem, 0, 3), 0);
assert.equal(st.snapshot().events.at(-1).event, 'semaphore-acquire');
assert.equal(st.snapshot().events.at(-1).thread, 3);
assert.equal(st.snapshot().events.at(-1).release, null); // no invented count-to-release association
assert.equal(tm.releaseSemaphore(sem, 0, 0), 0);
assert.equal(st.snapshot().events.at(-1).result, 0);
tm.workerBackend = {};
tm.releaseSemaphore(sem, 0, 0);
assert.equal(st.snapshot().events.at(-1).owner, null); // broker caller cannot be inferred as main

for (let n = 0; n < 40; n++) tiny.before({});
tiny.admission({}, { handle: 1, waveHdrGA: 2 }, 1, 1, 0, null);
assert.equal(tiny.snapshot().events.at(-1).completion, 'unavailable');

console.log(JSON.stringify({ status: 'PASS', scope: 'production JS + extracted production WAT functions with synthetic helpers; no guest/browser/full build',
  controls: ['disabled parity', 'CLI default off and opt in', 'admitted/busy/returned', 'two mutated return controls rejected',
    'interleaved owners', 'missing exports incomplete', 'bounded ring', 'semaphore release/grant/consumption/acquire'],
  sourceHashes: Object.fromEntries(['../lib/host-audio.js', '../lib/thread-manager.js', '../lib/callback-lifecycle-trace.js',
    '../src/13-exports.wat', '../src/09a-handlers.wat', './run.js'].map(p => [p,
      crypto.createHash('sha256').update(fs.readFileSync(require.resolve(p))).digest('hex')])) }));
