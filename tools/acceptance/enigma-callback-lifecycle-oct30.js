'use strict';
// Independent bounded acceptance for fb314a9dcbc9075318123932a15c964fc230910e.
// No guest, full build or browser. No production source is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const vm = require('node:vm');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const filename = require.resolve('../../test/test-callback-lifecycle-trace.js');
const original = fs.readFileSync(filename, 'utf8');
assert.equal(hash(original), 'ad8cc8c3230f981329bdb000eab3438ed4b329dd2d6ccd17d6d073d2fecadb5f');
const end = original.indexOf('// Distinguishing controls:');
assert(end > 0);
const wrapOnly = process.argv.includes('--wrap-only');
const boundary = original.slice(0, wrapOnly ? original.indexOf('// Earliest production boundary first:') : end);
// Earliest behavior: unchanged candidate CLI initializer + host pump parity,
// admission/busy/restore tests. The remaining old groups are reused, not replayed.
const fixtureStart = original.indexOf('function makeExports(');
const fixtureEnd = original.indexOf('\nfunction audio(', fixtureStart);
const seededFixture = original.slice(fixtureStart, fixtureEnd)
  .replace('function makeExports(', 'function makeSeededExports(')
  .replace('compile(source, new Map()', 'compile(source + seedFunction, new Map()');
const seedFunction = '(func (export "seed_idle") (param $n i32) (global.set $audio_trace_serial (local.get $n)) (global.set $audio_trace_returned (local.get $n)))';
// A consistent idle fixture seeds serial AND last-returned together;
// extracted candidate admission/return/collector code remains byte identical.
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(boundary + '\nconst seedFunction = ' + JSON.stringify(seedFunction) +
  ';\n' + seededFixture +
  '\nmodule.exports = { makeExports, makeSeededExports, audio, createCallbackLifecycleTrace, ThreadManager };', filename);
const { makeExports, makeSeededExports, audio, createCallbackLifecycleTrace, ThreadManager } = m.exports;
const groups = [];
if (!wrapOnly) {
groups.push('unchanged-production-boundary');
// Adversarial pending identity must survive eviction, including busy events.
const bounded = createCallbackLifecycleTrace({ capacity: 2 });
const e = makeExports(), host = audio(e, bounded).host;
host.pumpWaveOutCompletions();
for (let i = 0; i < 11; i++) host.pumpWaveOutCompletions();
let s = bounded.snapshot();
assert.equal(s.pending.length, 1);
assert.equal(s.events.length, 2);
assert.equal(s.events.every(v => v.event === 'busy' && v.token === null), true);
assert.equal(s.overwritten, 10);
e.finish();
s = bounded.snapshot();
assert.equal(s.pending.length, 0);
assert.equal(s.events.at(-1).event, 'returned');
assert.equal(s.events.at(-1).token, 1);
assert.equal(s.overwritten, 11);
groups.push('pending-survives-ring-eviction-and-reentrant-busy');
// Equal tokens on three owners cannot borrow an unrelated owner's return.
const isolated = createCallbackLifecycleTrace();
const owners = [11,22,33].map(tid => {
  const x = makeExports(); x.init(tid);
  return { x, h: audio(x, isolated).host };
});
owners.forEach(v => v.h.pumpWaveOutCompletions());
owners[0].h.pumpWaveOutCompletions();
owners[1].x.finish(); isolated.observe(owners[1].x);
let snap = isolated.snapshot();
assert.deepEqual(snap.pending.map(v => v.thread), [11,33]);
assert.deepEqual(snap.events.filter(v => v.event === 'returned').map(v => v.thread), [22]);
assert.equal(new Set(snap.events.filter(v => v.event === 'admitted').map(v => v.owner)).size, 3);
owners[2].x.finish(); isolated.observe(owners[2].x);
owners[0].x.finish(); isolated.observe(owners[0].x);
assert.deepEqual(isolated.snapshot().events.filter(v => v.event === 'returned').map(v => v.thread), [22,33,11]);
groups.push('three-owner-token-thread-isolation');
// Partial and old export surfaces must stay explicitly unavailable.
for (const fake of [
  { fire_wave_out_callback_bound: () => 1 },
  { fire_wave_out_callback_bound: () => 1, set_audio_callback_trace: () => { throw Error('partial export enabled'); } },
]) {
  const t = createCallbackLifecycleTrace();
  audio(fake,t).host.pumpWaveOutCompletions();
  assert.equal(t.snapshot().events[0].completion, 'unavailable');
  assert.equal(t.snapshot().pending.length, 0);
  assert.equal(t.snapshot().events.some(v => v.event === 'returned'), false);
}
groups.push('old-and-partial-modules-remain-incomplete');
// Independent release fanout, failed overrelease, and exact consumption wire.
const trace = createCallbackLifecycleTrace();
const main = { get_sync_table: () => 0, get_current_thread_id: () => 1 };
const tm = new ThreadManager(null, { buffer: new SharedArrayBuffer(65536) },
  { exports: main }, null, { callbackLifecycleTrace: trace });
const sem = tm.createSemaphore(0, 2, '');
const waiters = [2,3].map(tid => ({ state: 'active', instance: { exports: {
  get_yield_reason: () => 1, get_wait_handle: () => sem,
  get_wait_handles_ptr: () => 0, get_wait_stack_bytes: () => 12,
  get_current_thread_id: () => tid,
} } }));
waiters.forEach((v,i) => tm.threads.set(i+1,v));
assert.equal(tm.releaseSemaphore(sem,1,0),1);
assert.equal(tm.releaseSemaphore(sem,1,0),1);
assert.deepEqual(waiters.map(v=>v.grantedWaitTrace),[1,2]);
assert.equal(tm.releaseSemaphore(sem,3,0),0);
let semEvents = trace.snapshot().events;
assert.deepEqual(semEvents.filter(v=>v.event==='semaphore-grant').map(v=>v.release),[1,2]);
assert.deepEqual(semEvents.filter(v=>v.event==='semaphore-release').map(v=>[v.release,v.result,v.before,v.after]),
  [[1,1,0,0],[2,1,0,0],[3,0,0,0]]);
const manager = fs.readFileSync(require.resolve('../../lib/thread-manager'), 'utf8');
const consumeStart = manager.indexOf('            result = 0;   // a release already handed this wait its unit');
const consume = manager.slice(consumeStart, manager.indexOf('          } else {',consumeStart));
for (const thread of waiters) {
  vm.runInNewContext(consume, {thread, waitHandle:sem, e:thread.instance.exports,
    result:null, _callbackLifecycleTrace:trace});
  thread.grantedWait = 0; // enclosing scheduler does this, not the extracted body
}
semEvents = trace.snapshot().events;
assert.deepEqual(semEvents.filter(v=>v.event==='semaphore-grant-consumed').map(v=>[v.context.thread,v.release]),[[2,1],[3,2]]);
tm.threads.clear();
assert.equal(tm.releaseSemaphore(sem,1,0),1);
assert.equal(tm.waitSingle(sem,0,7),0);
assert.equal(trace.snapshot().events.at(-1).release,null);
groups.push('independent-semaphore-release-consume-correlation');
}
// A valid idle state has serial == last returned, with no active callback.
// Seed near wrap, then require actual production admission and finish twice.
const wrap = makeSeededExports(), wrapped = createCallbackLifecycleTrace();
wrap.seed_idle(-2);
const wh = audio(wrap, wrapped).host;
const transitions = [];
for (const token of [0xffffffff,1]) {
  wh.pumpWaveOutCompletions();
  let snap = wrapped.snapshot();
  assert.equal(wrap.get_audio_callback_trace(0) >>> 0,token);
  assert.equal(wrap.is_mm_timer_callback_active(),1);
  assert.equal(snap.pending.length,1);
  assert.equal(snap.events.at(-1).event,'admitted');
  const before = {active:wrap.get_audio_callback_trace(0), returned:wrap.get_audio_callback_trace(1),
    pending:snap.pending.length};
  wrap.finish();
  snap = wrapped.snapshot();
  assert.equal(snap.events.at(-1).event,'returned');
  assert.equal(snap.events.at(-1).token,token);
  assert.equal(snap.pending.length,0);
  assert.equal(wrap.get_audio_callback_trace(0),0);
  transitions.push({token,before,returned:snap.events.at(-1)});
}
groups.push('consistent-idle-token-wrap-no-premature-return');
const result = {
  candidate:'fb314a9dcbc9075318123932a15c964fc230910e',
  status:'PASS_BOUNDED_ACCEPTANCE',
  checksPassed:groups,
  fixture:{originalTestSHA256:hash(original), unchangedBoundarySHA256:hash(boundary),
    seededFixtureSHA256:hash(seededFixture), seedFunction,
    scope:'exact production WAT functions; synthetic continuation helpers and idle state setter only'},
  transitions,
  reused:'implementation-oct29 completion-receipt.json and acceptance-checkpoint.json; independent-checks first five passing groups if --wrap-only',
  invalidatedExperiment:'independent-checks final wrap probe seeded serial alone while retaining an inconsistent historical return marker; REJECTED_COUNTEREXAMPLE there is invalid and is NOT a production counterexample',
  unqualified:['actual x86 callback invocation/authentication','guest execution','full build','browser','full CLI execution','enclosing runSlice'],
};
console.log(JSON.stringify(result,null,2));
