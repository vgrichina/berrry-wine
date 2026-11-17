'use strict';
const assert = require('node:assert/strict');
const { ThreadManager } = require('../lib/thread-manager');
const dll = require('../lib/dll-loader');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const capture = fn => { try { fn(); return { threw: false }; } catch (error) { return { threw: true, error }; } };
function fixture() {
  // Inert ABI storage only. Production beginDllThreadNotification owns every
  // gate/pin/frame transition; this fixture supplies no cancellation logic.
  const buffer = new SharedArrayBuffer(65536), memory = { buffer };
  const view = new DataView(buffer), words = new Int32Array(buffer);
  const table = 128, life = 256, gate = 512;
  let eip = 4096, esp = 60000, eax = 1, yieldReason = 0;
  let lock = () => {}, run = () => {};
  const put = (field, value) => view.setUint32(life + field, value, true);
  view.setUint32(table, 8192, true);
  put(0, 2); put(4, 17); put(8, 1); put(24, 8200); put(48, 1);
  const ex = {
    memory, get_image_base: () => 4096, guest_to_wasm: a => a,
    get_dll_callback_lock: () => gate, get_dll_callback_owner: () => 1,
    get_current_thread_id: () => 1, get_dll_count: () => 1,
    get_dll_table: () => table, get_dll_index: () => 0,
    get_dll_lifecycle_table: () => life, get_dll_lifecycle_stride: () => 64,
    dll_load_lock_begin: () => lock(), dll_load_lock_end() {},
    get_eip: () => eip, set_eip: v => { eip = v; },
    get_esp: () => esp, set_esp: v => { esp = v; },
    get_eax: () => eax, set_eax: v => { eax = v; }, get_fs_base: () => 0,
    get_yield_reason: () => yieldReason, clear_yield: () => { yieldReason = 0; },
    set_yield_state: v => { yieldReason = v; }, get_last_run_halt: () => 4,
    take_dll_unload_kind: () => 0, run: () => run(),
  };
  return { ex, buffer, get: field => view.getUint32(life + field, true),
    gate: () => [words[gate / 4], words[gate / 4 + 1]],
    lock: fn => { lock = fn; }, run: fn => { run = fn; } };
}
function manager() {
  const events = [], hooks = {};
  const call = name => { events.push(name); if (hooks[name]) hooks[name](); };
  // Actual exported prototype, without constructing runtime/authority services.
  const tm = Object.create(ThreadManager.prototype);
  const thread = { tid: 1, state: 'active', startAddr: 4096, param: 2 };
  Object.assign(tm, {
    threads: new Map([[0xe1000, thread]]), _pendingThreads: [], _maxWorkerThreads: 1,
    _audioThreadHotUntil: new Map([[1, 99]]),
    _cancelAuthorityWait: () => call('wait'), _getVfs: () => ({ releaseIoState: () => call('vfs') }),
    _abandonMutexesOwnedBy: () => call('mutex'), _emitThreadEvent: () => call('event'),
    _onThreadExit: () => call('notify'), _log: () => call('log'),
    mainInstance: { exports: {
      beep_retire_thread: () => call('beep'), wnd_destroy_thread_windows: () => call('windows'),
      reset_thread_message_queue: () => call('queue'), release_cs_owned_by: () => { call('cs'); return 0; },
    } },
  });
  thread.link = { _threadSendWaitRetire: () => call('send') };
  const exit = () => tm._markThreadExited(0xe1000, thread, 7, 'test');
  return { tm, thread, events, hooks, exit };
}
const mandatory = ['wait','beep','vfs','windows','queue','mutex','send','cs','event','notify'];
for (const name of mandatory) test(`${name} failure cannot suppress independent fanout; retry skips successes`, () => {
  const f = manager(), error = Error(name);
  f.hooks[name] = () => { throw error; };
  const got = capture(f.exit);
  assert.equal(got.threw, true); assert.equal(got.error, error);
  assert.equal(f.thread.state, 'exited');
  assert.equal(f.tm._audioThreadHotUntil.has(1), false);
  for (const hook of mandatory) assert(f.events.includes(hook), hook+' was suppressed');
  assert.equal(f.tm._allocWorkerSlot(), name === 'event' || name === 'notify' ? 1 : 0);
  delete f.hooks[name]; f.exit();
  for (const hook of mandatory) assert.equal(f.events.filter(v => v === hook).length,
    hook === name && hook !== 'event' && hook !== 'notify' ? 2 : 1, hook);
});
for (const error of [undefined, null, Symbol('cancel'), Error('cancel')])
test(`cancel exact thrown ${typeof error} retains owner and permanent fault on retry`, () => {
  const f = manager(); let fail = true;
  const operation = { cancel() { assert.equal(f.thread.state, 'exited'); if (fail) throw error; return { status: 'cancelled' }; } };
  f.thread._dllAttachOperation = operation;
  const got = capture(f.exit); assert.equal(got.threw, true); assert.equal(got.error, error);
  assert.equal(f.thread._dllAttachOperation, operation);
  for (const hook of mandatory) assert(f.events.includes(hook));
  assert.equal(f.tm._allocWorkerSlot(), 0);
  fail = false; const retry = capture(f.exit);
  assert.equal(retry.threw, true); assert.equal(retry.error, error);
  assert.equal(f.thread._dllAttachOperation, operation);
  assert.equal(f.tm._allocWorkerSlot(), 0);
});
test('aggregate preserves every exact thrown value in fanout order', () => {
  const f = manager(), values = [null, undefined, Symbol('vfs'), Error('send')];
  f.thread._dllAttachOperation = { cancel() { throw values[1]; } };
  f.hooks.wait = () => { throw values[0]; }; f.hooks.vfs = () => { throw values[2]; };
  f.hooks.send = () => { throw values[3]; };
  const got = capture(f.exit); assert(got.error instanceof AggregateError);
  assert.deepEqual(got.error.errors, values); assert(f.events.includes('notify'));
});
test('normal and reentrant retirement notify and cancel exactly once', () => {
  const f = manager(); let cancels = 0;
  f.thread._dllAttachOperation = { cancel() { cancels++; f.exit(); return { status: 'cancelled' }; } };
  f.hooks.beep = f.exit; f.hooks.notify = f.exit;
  f.exit(); f.exit(); assert.equal(cancels, 1);
  assert.deepEqual(f.events, mandatory);
});
test('borrowed cooperative exports are fenced before cancellation and every resource hook', () => {
  const f = manager(); let calls = 0;
  f.thread.instance = { exports: { callback: () => { calls++; } } };
  const borrowed = f.tm.cooperativeCallbackExports(f.thread).callback;
  borrowed(); assert.equal(calls, 1);
  const rejected = () => assert.throws(borrowed, /caller retired/);
  f.thread._dllAttachOperation = { cancel() { rejected(); return { status: 'cancelled' }; } };
  for (const hook of mandatory) f.hooks[hook] = rejected;
  f.exit(); rejected(); assert.equal(calls, 1);
});
test('actual notification cancelling retains operation, gate and quarantine until unwound retry', () => {
  const f = manager(), n = fixture(); let during;
  const operation = dll.beginDllThreadNotification({ exports: n.ex, memoryBuffer: n.buffer }, 2);
  f.thread._dllAttachOperation = operation;
  n.run(() => {
    f.exit();
    during = { operation: f.thread._dllAttachOperation, gate: n.gate(), pin: n.get(12), slot: f.tm._allocWorkerSlot() };
    assert.equal(f.thread.state, 'exited');
  });
  assert.equal(operation.advance(10).status, 'cancelled');
  assert.equal(during.operation, operation); assert.deepEqual(during.gate, [1,1]);
  assert.equal(during.pin, 1); assert.equal(during.slot, 0);
  assert.deepEqual(n.gate(), [0,0]); assert.equal(n.get(12), 1);
  f.exit(); assert.equal(f.thread._dllAttachOperation, null);
  assert.equal(n.get(12), 1, 'unfinished guest image remains quarantined');
  assert.equal(f.tm._allocWorkerSlot(), 1);
  assert.deepEqual(f.events, mandatory);
});
test('actual notification cancel failure retains reference and exact error', () => {
  const f = manager(), n = fixture(), error = Error('metadata');
  const operation = dll.beginDllThreadNotification({ exports: n.ex, memoryBuffer: n.buffer }, 2);
  f.thread._dllAttachOperation = operation;
  n.lock(() => { throw error; });
  const got = capture(f.exit); assert.equal(got.threw, true); assert.equal(got.error, error);
  assert.equal(f.thread._dllAttachOperation, operation); assert.equal(n.get(12), 1);
  assert.equal(f.tm._allocWorkerSlot(), 0); assert(f.events.includes('notify'));
  // Notification close memoizes its terminal status even if metadata release
  // throws. The manager must not claim the retained pin was safely released.
  n.lock(() => {});
  const retry = capture(f.exit); assert.equal(retry.threw, true); assert.equal(retry.error, error);
  assert.equal(f.thread._dllAttachOperation, operation); assert.equal(n.get(12), 1);
  assert.equal(f.tm._allocWorkerSlot(), 0);
});
test('real runSlice settles reentrant notification cancellation at its advance boundary', () => {
  const f = manager(), n = fixture();
  const defaults = new ThreadManager({}, { buffer: n.buffer },
    { exports: { get_sync_table: () => 0 } }, () => ({}), {});
  for (const key of Object.keys(defaults)) if (!Object.hasOwn(f.tm, key)) f.tm[key] = defaults[key];
  f.thread.instance = { exports: n.ex }; f.thread._firstRunEmitted = true; n.ex.set_yield_state(0);
  n.run(() => { f.exit(); assert.equal(f.tm._allocWorkerSlot(), 0); });
  f.tm._loadedDlls = [];
  f.tm._quietTM = true;
  // Actual _notifyThreadAttach creates the real operation, then actual
  // runSlice advances it. No replacement scheduler or cancellation endpoint.
  f.tm.runSlice(10, { quantumSteps: 10 });
  assert.equal(f.thread.state, 'exited'); assert.equal(f.thread._dllAttachOperation, null);
  assert.equal(f.thread._exitCleanup.complete, true);
  assert.deepEqual(n.gate(), [0,0]); assert.equal(n.get(12), 1);
  assert.equal(f.tm._allocWorkerSlot(), 1);
  assert.deepEqual(f.events, mandatory.filter(name => name !== 'windows'));
});
test('void/unknown cancellation cannot falsely certify notification retirement', () => {
  for (const result of [undefined, { status: 'cancelling' }, { status: 'unexpected' }]) {
    const f = manager(), operation = { cancel: () => result };
    f.thread._dllAttachOperation = operation;
    f.exit(); f.tm._dropExitedSlotHandles(1);
    assert.equal(f.tm.threads.get(0xe1000), f.thread);
    assert.equal(f.thread._dllAttachOperation, operation); assert.equal(f.tm._allocWorkerSlot(), 0);
  }
});
test('diagnostic failure after successful CS release does not replay the release', () => {
  const f = manager(), error = Symbol('logger'); let releases = 0;
  f.tm.mainInstance.exports.release_cs_owned_by = () => { releases++; return 1; };
  f.hooks.log = () => { throw error; };
  const got = capture(f.exit); assert.equal(got.threw, true); assert.equal(got.error, error);
  assert(f.events.includes('notify')); f.exit(); assert.equal(releases, 1);
});
let failed = 0;
for (const { name, run } of tests) {
  try { run(); console.log('PASS '+name); }
  catch (error) { failed++; console.error('FAIL '+name+': '+String(error)); }
}
console.log(`${tests.length-failed}/${tests.length} passed; NO_NATIVE_RESULT`);
if (failed) process.exitCode = 1;
